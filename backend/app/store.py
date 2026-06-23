import os
import time
from collections.abc import Iterator
from contextlib import contextmanager
from uuid import uuid4

from sqlalchemy import BigInteger, Boolean, ForeignKey, Integer, String, create_engine, select
from sqlalchemy.engine import Engine
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import DeclarativeBase, Mapped, Session, mapped_column, sessionmaker
from sqlalchemy.pool import StaticPool
from sqlalchemy.types import JSON

from app.models import (
    ActiveGameSummary,
    GameMode,
    GameState,
    ScoreEntry,
    StoredUser,
    User,
)

DEFAULT_DATABASE_URL = "sqlite:///./snake.db"


def now_ms() -> int:
    return int(time.time() * 1000)


def new_id(prefix: str) -> str:
    return f"{prefix}_{uuid4().hex[:12]}"


class Base(DeclarativeBase):
    pass


class UserRow(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    username: Mapped[str] = mapped_column(String(120), nullable=False)
    normalized_username: Mapped[str] = mapped_column(String(120), nullable=False, unique=True)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)


class SessionRow(Base):
    __tablename__ = "sessions"

    token: Mapped[str] = mapped_column(String(255), primary_key=True)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)


class GameRow(Base):
    __tablename__ = "games"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    username: Mapped[str] = mapped_column(String(120), nullable=False)
    mode: Mapped[str] = mapped_column(String(16), nullable=False, index=True)
    width: Mapped[int] = mapped_column(Integer, nullable=False)
    height: Mapped[int] = mapped_column(Integer, nullable=False)
    snake: Mapped[list[dict[str, int]]] = mapped_column(JSON, nullable=False)
    food: Mapped[dict[str, int]] = mapped_column(JSON, nullable=False)
    direction: Mapped[dict[str, int]] = mapped_column("dir", JSON, nullable=False)
    score: Mapped[int] = mapped_column(Integer, nullable=False)
    alive: Mapped[bool] = mapped_column(Boolean, nullable=False)
    started_at: Mapped[int] = mapped_column(BigInteger, nullable=False)
    updated_at: Mapped[int] = mapped_column(BigInteger, nullable=False, index=True)


class ScoreRow(Base):
    __tablename__ = "scores"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    username: Mapped[str] = mapped_column(String(120), nullable=False)
    mode: Mapped[str] = mapped_column(String(16), nullable=False, index=True)
    score: Mapped[int] = mapped_column(Integer, nullable=False, index=True)
    created_at: Mapped[int] = mapped_column(BigInteger, nullable=False, index=True)


def make_engine(database_url: str) -> Engine:
    kwargs: dict = {}
    if database_url.startswith("sqlite"):
        kwargs["connect_args"] = {"check_same_thread": False}
        if database_url in {"sqlite://", "sqlite:///:memory:"}:
            kwargs["poolclass"] = StaticPool
    return create_engine(database_url, **kwargs)


def user_from_row(row: UserRow) -> User:
    return User(id=row.id, username=row.username)


def stored_user_from_row(row: UserRow) -> StoredUser:
    return StoredUser(id=row.id, username=row.username, password_hash=row.password_hash)


def game_from_row(row: GameRow) -> GameState:
    return GameState(
        id=row.id,
        userId=row.user_id,
        username=row.username,
        mode=GameMode(row.mode),
        width=row.width,
        height=row.height,
        snake=row.snake,
        food=row.food,
        dir=row.direction,
        score=row.score,
        alive=row.alive,
        startedAt=row.started_at,
        updatedAt=row.updated_at,
    )


def score_from_row(row: ScoreRow) -> ScoreEntry:
    return ScoreEntry(
        id=row.id,
        userId=row.user_id,
        username=row.username,
        mode=GameMode(row.mode),
        score=row.score,
        createdAt=row.created_at,
    )


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


class Store:
    def __init__(self, database_url: str | None = None, *, seed: bool = False) -> None:
        self.database_url = database_url or os.environ.get("DATABASE_URL", DEFAULT_DATABASE_URL)
        self.engine = make_engine(self.database_url)
        self.session_factory = sessionmaker(self.engine, expire_on_commit=False)
        Base.metadata.create_all(self.engine)
        if seed:
            self.seed_defaults()

    @contextmanager
    def session(self) -> Iterator[Session]:
        with self.session_factory() as session:
            yield session

    def add_user(self, username: str, password_hash: str, user_id: str | None = None) -> User:
        normalized = username.strip()
        key = normalized.lower()
        if not normalized:
            raise ValueError("Username is required")

        row = UserRow(
            id=user_id or new_id("user"),
            username=normalized,
            normalized_username=key,
            password_hash=password_hash,
        )
        with self.session() as session:
            session.add(row)
            try:
                session.commit()
            except IntegrityError as exc:
                session.rollback()
                raise ValueError("Username already taken") from exc
        return user_from_row(row)

    def find_user_by_username(self, username: str) -> StoredUser | None:
        key = username.strip().lower()
        with self.session() as session:
            row = session.scalar(select(UserRow).where(UserRow.normalized_username == key))
            return stored_user_from_row(row) if row is not None else None

    def public_user(self, user_id: str) -> User | None:
        with self.session() as session:
            row = session.get(UserRow, user_id)
            return user_from_row(row) if row is not None else None

    def create_session(self, user_id: str, token: str) -> None:
        with self.session() as session:
            session.add(SessionRow(token=token, user_id=user_id))
            session.commit()

    def clear_session(self, token: str | None) -> None:
        if not token:
            return
        with self.session() as session:
            row = session.get(SessionRow, token)
            if row is not None:
                session.delete(row)
                session.commit()

    def user_for_token(self, token: str) -> User | None:
        with self.session() as session:
            row = session.scalar(
                select(UserRow)
                .join(SessionRow, SessionRow.user_id == UserRow.id)
                .where(SessionRow.token == token)
            )
            return user_from_row(row) if row is not None else None

    def create_game(self, game: GameState) -> GameState:
        with self.session() as session:
            session.add(self._game_row(game))
            session.commit()
        return game

    def get_game(self, game_id: str) -> GameState | None:
        with self.session() as session:
            row = session.get(GameRow, game_id)
            return game_from_row(row) if row is not None else None

    def update_game(self, game_id: str, state: GameState) -> GameState | None:
        with self.session() as session:
            row = session.get(GameRow, game_id)
            if row is None:
                return None
            updated = state.model_copy(update={"updatedAt": now_ms()})
            self._apply_game(row, updated)
            session.commit()
            return updated

    def active_games(self) -> list[ActiveGameSummary]:
        with self.session() as session:
            rows = session.scalars(select(GameRow).order_by(GameRow.updated_at.desc())).all()
            return [
                ActiveGameSummary(
                    id=row.id,
                    username=row.username,
                    mode=GameMode(row.mode),
                    score=row.score,
                    alive=row.alive,
                )
                for row in rows
            ]

    def add_score(self, entry: ScoreEntry) -> None:
        with self.session() as session:
            session.add(
                ScoreRow(
                    id=entry.id,
                    user_id=entry.userId,
                    username=entry.username,
                    mode=entry.mode.value,
                    score=entry.score,
                    created_at=entry.createdAt,
                )
            )
            session.commit()

    def leaderboard(self, mode: GameMode, limit: int) -> list[ScoreEntry]:
        with self.session() as session:
            rows = session.scalars(
                select(ScoreRow)
                .where(ScoreRow.mode == mode.value)
                .order_by(ScoreRow.score.desc(), ScoreRow.created_at.asc())
                .limit(limit)
            ).all()
            return [score_from_row(row) for row in rows]

    def seed_defaults(self) -> None:
        with self.session() as session:
            if session.scalar(select(UserRow.id).limit(1)) is not None:
                return

        from app.passwords import hash_password

        alice = self.add_user("alice", hash_password("password"), "u_alice")
        bruno = self.add_user("bruno", hash_password("password"), "u_bruno")
        celine = self.add_user("celine", hash_password("password"), "u_celine")

        base = now_ms()
        self.create_game(
            make_game(alice, GameMode.walls, game_id="game_alice_walls", score=8, timestamp=base - 8_000)
        )
        self.create_game(
            make_game(bruno, GameMode.wrap, game_id="game_bruno_wrap", score=14, timestamp=base - 4_000)
        )
        self.create_game(
            make_game(celine, GameMode.walls, game_id="game_celine_walls", score=5, timestamp=base - 2_000)
        )

        for user, mode, score, offset in [
            (alice, GameMode.walls, 42, 90_000),
            (bruno, GameMode.wrap, 57, 80_000),
            (celine, GameMode.walls, 31, 70_000),
            (alice, GameMode.wrap, 28, 60_000),
            (bruno, GameMode.walls, 24, 50_000),
        ]:
            self.add_score(
                ScoreEntry(
                    id=new_id("score"),
                    userId=user.id,
                    username=user.username,
                    mode=mode,
                    score=score,
                    createdAt=base - offset,
                )
            )

    def _game_row(self, game: GameState) -> GameRow:
        return GameRow(
            id=game.id,
            user_id=game.userId,
            username=game.username,
            mode=game.mode.value,
            width=game.width,
            height=game.height,
            snake=[cell.model_dump() for cell in game.snake],
            food=game.food.model_dump(),
            direction=game.dir.model_dump(),
            score=game.score,
            alive=game.alive,
            started_at=game.startedAt,
            updated_at=game.updatedAt,
        )

    def _apply_game(self, row: GameRow, game: GameState) -> None:
        row.user_id = game.userId
        row.username = game.username
        row.mode = game.mode.value
        row.width = game.width
        row.height = game.height
        row.snake = [cell.model_dump() for cell in game.snake]
        row.food = game.food.model_dump()
        row.direction = game.dir.model_dump()
        row.score = game.score
        row.alive = game.alive
        row.started_at = game.startedAt
        row.updated_at = game.updatedAt


def create_seeded_store() -> Store:
    return Store(seed=True)


store: Store | None = None


def get_store() -> Store:
    global store
    if store is None:
        store = create_seeded_store()
    return store
