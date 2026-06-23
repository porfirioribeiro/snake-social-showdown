from collections.abc import Generator

import pytest
from fastapi.testclient import TestClient

from app.main import create_app
from app.passwords import hash_password
from app.store import Store, get_store


@pytest.fixture()
def client() -> Generator[TestClient]:
    store = Store("sqlite:///:memory:")
    alice = store.add_user("alice", hash_password("password"), "u_alice")
    bruno = store.add_user("bruno", hash_password("password"), "u_bruno")
    from app.models import GameMode, ScoreEntry
    from app.store import make_game

    store.create_game(make_game(alice, GameMode.walls, game_id="game_alice", score=7))
    store.create_game(make_game(bruno, GameMode.wrap, game_id="game_bruno", score=11))
    for score in [
        ScoreEntry(id="s1", userId=alice.id, username=alice.username, mode=GameMode.walls, score=12, createdAt=1),
        ScoreEntry(id="s2", userId=bruno.id, username=bruno.username, mode=GameMode.walls, score=30, createdAt=2),
        ScoreEntry(id="s3", userId=alice.id, username=alice.username, mode=GameMode.wrap, score=20, createdAt=3),
    ]:
        store.add_score(score)

    app = create_app()
    app.dependency_overrides[get_store] = lambda: store
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


def bearer_token(response) -> str:
    header = response.headers["Authorization"]
    assert header.startswith("Bearer ")
    return header.removeprefix("Bearer ")


def test_health_endpoint(client: TestClient) -> None:
    response = client.get("/api/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_seeded_active_games_and_leaderboard_are_available(client: TestClient) -> None:
    active = client.get("/api/games/active")
    assert active.status_code == 200
    assert {game["id"] for game in active.json()} == {"game_alice", "game_bruno"}

    leaderboard = client.get("/api/leaderboard", params={"mode": "walls", "limit": 2})
    assert leaderboard.status_code == 200
    assert [entry["score"] for entry in leaderboard.json()] == [30, 12]


def test_signup_hashes_password_and_returns_bearer_token(client: TestClient) -> None:
    signup = client.post("/api/auth/signup", json={"username": "celine", "password": "secret"})
    assert signup.status_code == 200
    assert signup.json() == {"id": signup.json()["id"], "username": "celine"}
    token = bearer_token(signup)

    me = client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert me.status_code == 200
    assert me.json()["username"] == "celine"

    duplicate = client.post("/api/auth/signup", json={"username": "celine", "password": "secret"})
    assert duplicate.status_code == 400
    assert duplicate.json() == {"message": "Username already taken"}


def test_login_rejects_bad_password_and_accepts_seeded_user(client: TestClient) -> None:
    bad = client.post("/api/auth/login", json={"username": "alice", "password": "wrong"})
    assert bad.status_code == 401
    assert bad.json() == {"message": "Invalid username or password"}

    ok = client.post("/api/auth/login", json={"username": "alice", "password": "password"})
    assert ok.status_code == 200
    assert ok.json() == {"id": "u_alice", "username": "alice"}
    assert bearer_token(ok)


def test_protected_game_and_score_endpoints_require_auth(client: TestClient) -> None:
    create = client.post("/api/games", json={"mode": "walls"})
    assert create.status_code == 401
    assert create.json() == {"message": "Not authenticated"}

    score = client.post("/api/scores", json={"mode": "walls", "score": 5})
    assert score.status_code == 401
    assert score.json() == {"message": "Not authenticated"}


def test_authenticated_user_can_create_update_and_submit_score(client: TestClient) -> None:
    login = client.post("/api/auth/login", json={"username": "alice", "password": "password"})
    token = bearer_token(login)
    headers = {"Authorization": f"Bearer {token}"}

    created = client.post("/api/games", json={"mode": "wrap"}, headers=headers)
    assert created.status_code == 200
    game = created.json()
    assert game["username"] == "alice"
    assert game["mode"] == "wrap"

    game["score"] = 99
    updated = client.put(f"/api/games/{game['id']}", json=game, headers=headers)
    assert updated.status_code == 204
    fetched = client.get(f"/api/games/{game['id']}")
    assert fetched.status_code == 200
    assert fetched.json()["score"] == 99

    submitted = client.post("/api/scores", json={"mode": "wrap", "score": 99}, headers=headers)
    assert submitted.status_code == 204
    leaderboard = client.get("/api/leaderboard", params={"mode": "wrap", "limit": 1})
    assert leaderboard.json()[0]["score"] == 99


def test_validation_errors_use_error_response_shape(client: TestClient) -> None:
    response = client.post("/api/auth/signup", json={"username": "x", "password": "123"})
    assert response.status_code == 400
    assert response.json() == {"message": "Invalid request"}


def test_store_uses_database_url_and_persists_data(monkeypatch: pytest.MonkeyPatch, tmp_path) -> None:
    database_url = f"sqlite:///{tmp_path / 'app.db'}"
    monkeypatch.setenv("DATABASE_URL", database_url)

    first_store = Store()
    first_store.add_user("diana", hash_password("password"), "u_diana")

    second_store = Store()
    user = second_store.find_user_by_username("diana")
    assert user is not None
    assert user.id == "u_diana"
