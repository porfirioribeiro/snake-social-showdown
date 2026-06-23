import time
from dataclasses import dataclass, field
from uuid import uuid4

from app.models import (
    ActiveGameSummary,
    GameMode,
    GameState,
    ScoreEntry,
    StoredUser,
    User,
)


def now_ms() -> int:
    return int(time.time() * 1000)


def new_id(prefix: str) -> str:
    return f"{prefix}_{uuid4().hex[:12]}"


def make_game(
    user: User,
    mode: GameMode,
    *,
    game_id: str | None = None,
    score: int = 0,
    alive: bool = True,
    timestamp: int | None = None,
) -> GameState:
    ts = timestamp or now_ms()
    return GameState(
        id=game_id or new_id("game"),
        userId=user.id,
        username=user.username,
        mode=mode,
        width=20,
        height=20,
        snake=[{"x": 10, "y": 10}, {"x": 9, "y": 10}, {"x": 8, "y": 10}],
        food={"x": 4 + (score % 10), "y": 7},
        dir={"x": 1, "y": 0},
        score=score,
        alive=alive,
        startedAt=ts - 60_000,
        updatedAt=ts,
    )


@dataclass
class Store:
    users: dict[str, StoredUser] = field(default_factory=dict)
    username_index: dict[str, str] = field(default_factory=dict)
    tokens: dict[str, str] = field(default_factory=dict)
    games: dict[str, GameState] = field(default_factory=dict)
    scores: list[ScoreEntry] = field(default_factory=list)

    def add_user(self, username: str, password_hash: str, user_id: str | None = None) -> User:
        normalized = username.strip()
        key = normalized.lower()
        if not normalized:
            raise ValueError("Username is required")
        if key in self.username_index:
            raise ValueError("Username already taken")
        user = StoredUser(
            id=user_id or new_id("user"),
            username=normalized,
            password_hash=password_hash,
        )
        self.users[user.id] = user
        self.username_index[key] = user.id
        return User(id=user.id, username=user.username)

    def find_user_by_username(self, username: str) -> StoredUser | None:
        user_id = self.username_index.get(username.strip().lower())
        if not user_id:
            return None
        return self.users.get(user_id)

    def public_user(self, user_id: str) -> User | None:
        user = self.users.get(user_id)
        if user is None:
            return None
        return User(id=user.id, username=user.username)

    def create_session(self, user_id: str, token: str) -> None:
        self.tokens[token] = user_id

    def clear_session(self, token: str | None) -> None:
        if token:
            self.tokens.pop(token, None)

    def user_for_token(self, token: str) -> User | None:
        user_id = self.tokens.get(token)
        if not user_id:
            return None
        return self.public_user(user_id)

    def active_games(self) -> list[ActiveGameSummary]:
        games = sorted(self.games.values(), key=lambda game: game.updatedAt, reverse=True)
        return [
            ActiveGameSummary(
                id=game.id,
                username=game.username,
                mode=game.mode,
                score=game.score,
                alive=game.alive,
            )
            for game in games
        ]

    def leaderboard(self, mode: GameMode, limit: int) -> list[ScoreEntry]:
        return sorted(
            (score for score in self.scores if score.mode == mode),
            key=lambda score: (-score.score, score.createdAt),
        )[:limit]


def create_seeded_store() -> Store:
    from app.passwords import hash_password

    store = Store()
    alice = store.add_user("alice", hash_password("password"), "u_alice")
    bruno = store.add_user("bruno", hash_password("password"), "u_bruno")
    celine = store.add_user("celine", hash_password("password"), "u_celine")

    base = now_ms()
    store.games["game_alice_walls"] = make_game(
        alice, GameMode.walls, game_id="game_alice_walls", score=8, timestamp=base - 8_000
    )
    store.games["game_bruno_wrap"] = make_game(
        bruno, GameMode.wrap, game_id="game_bruno_wrap", score=14, timestamp=base - 4_000
    )
    store.games["game_celine_walls"] = make_game(
        celine, GameMode.walls, game_id="game_celine_walls", score=5, timestamp=base - 2_000
    )

    for user, mode, score, offset in [
        (alice, GameMode.walls, 42, 90_000),
        (bruno, GameMode.wrap, 57, 80_000),
        (celine, GameMode.walls, 31, 70_000),
        (alice, GameMode.wrap, 28, 60_000),
        (bruno, GameMode.walls, 24, 50_000),
    ]:
        store.scores.append(
            ScoreEntry(
                id=new_id("score"),
                userId=user.id,
                username=user.username,
                mode=mode,
                score=score,
                createdAt=base - offset,
            )
        )

    return store


store = create_seeded_store()


def get_store() -> Store:
    return store
