from collections.abc import Generator

import pytest
from fastapi.testclient import TestClient

from app.main import create_app
from app import store as store_module


@pytest.fixture()
def client(monkeypatch: pytest.MonkeyPatch, tmp_path) -> Generator[TestClient]:
    database_url = f"sqlite:///{tmp_path / 'integration.db'}"
    monkeypatch.setenv("DATABASE_URL", database_url)
    monkeypatch.setattr(store_module, "store", None)

    app = create_app()
    with TestClient(app) as test_client:
        yield test_client

    monkeypatch.setattr(store_module, "store", None)


def bearer_token(response) -> str:
    header = response.headers["Authorization"]
    assert header.startswith("Bearer ")
    return header.removeprefix("Bearer ")


def test_signup_login_submit_score_and_read_from_leaderboard(client: TestClient) -> None:
    signup = client.post("/api/auth/signup", json={"username": "player_one", "password": "secret"})
    assert signup.status_code == 200
    assert signup.json()["username"] == "player_one"

    signup_token = bearer_token(signup)
    me = client.get("/api/auth/me", headers={"Authorization": f"Bearer {signup_token}"})
    assert me.status_code == 200
    assert me.json()["username"] == "player_one"

    login = client.post("/api/auth/login", json={"username": "player_one", "password": "secret"})
    assert login.status_code == 200
    assert login.json() == signup.json()

    login_token = bearer_token(login)
    submit = client.post(
        "/api/scores",
        json={"mode": "walls", "score": 123},
        headers={"Authorization": f"Bearer {login_token}"},
    )
    assert submit.status_code == 204

    leaderboard = client.get("/api/leaderboard", params={"mode": "walls", "limit": 1})
    assert leaderboard.status_code == 200
    entries = leaderboard.json()
    assert entries == [
        {
            "id": entries[0]["id"],
            "userId": signup.json()["id"],
            "username": "player_one",
            "mode": "walls",
            "score": 123,
            "createdAt": entries[0]["createdAt"],
        }
    ]
