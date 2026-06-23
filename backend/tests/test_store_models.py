import os

import pytest
from sqlalchemy import inspect
from sqlalchemy.dialects import postgresql, sqlite
from sqlalchemy.exc import IntegrityError
from sqlalchemy.schema import CreateTable

from app.models import GameMode, ScoreEntry
from app.passwords import hash_password
from app.store import Base, GameRow, ScoreRow, SessionRow, Store, UserRow, make_game, now_ms


def ddl_for(table, dialect) -> str:
    return str(CreateTable(table).compile(dialect=dialect())).lower()


@pytest.mark.parametrize("dialect", [sqlite.dialect, postgresql.dialect])
def test_store_models_compile_for_sqlite_and_postgres(dialect) -> None:
    for table in [UserRow.__table__, SessionRow.__table__, GameRow.__table__, ScoreRow.__table__]:
        assert "create table" in ddl_for(table, dialect)


@pytest.mark.parametrize("dialect", [sqlite.dialect, postgresql.dialect])
def test_epoch_millisecond_columns_use_64_bit_integer_type(dialect) -> None:
    game_ddl = ddl_for(GameRow.__table__, dialect)
    score_ddl = ddl_for(ScoreRow.__table__, dialect)

    assert "started_at bigint" in game_ddl
    assert "updated_at bigint" in game_ddl
    assert "created_at bigint" in score_ddl


def test_sqlite_enforces_foreign_keys_like_postgres() -> None:
    store = Store("sqlite:///:memory:")

    with pytest.raises(IntegrityError):
        store.create_session("missing-user", "token")


def test_dead_game_update_deletes_live_game_row() -> None:
    store = Store("sqlite:///:memory:")
    user = store.add_user("live_player", hash_password("password"), "u_live_player")
    game = store.create_game(make_game(user, GameMode.walls, game_id="game_live"))

    assert [active.id for active in store.active_games()] == ["game_live"]
    assert store.update_game(game.id, game.model_copy(update={"alive": False})) is None

    assert store.get_game(game.id) is None
    assert store.active_games() == []


@pytest.mark.skipif(
    not os.environ.get("POSTGRES_TEST_DATABASE_URL"),
    reason="POSTGRES_TEST_DATABASE_URL is not set",
)
def test_store_round_trip_with_postgres() -> None:
    store = Store(os.environ["POSTGRES_TEST_DATABASE_URL"])
    Base.metadata.drop_all(store.engine)
    Base.metadata.create_all(store.engine)

    user = store.add_user("postgres_player", hash_password("password"), "u_postgres_player")
    store.create_session(user.id, "postgres-token")
    game = store.create_game(
        make_game(
            user,
            GameMode.walls,
            game_id="game_postgres",
            score=123,
            timestamp=now_ms(),
        )
    )
    store.add_score(
        ScoreEntry(
            id="score_postgres",
            userId=user.id,
            username=user.username,
            mode=GameMode.walls,
            score=123,
            createdAt=now_ms(),
        )
    )

    inspector = inspect(store.engine)
    assert set(inspector.get_table_names()) == {"games", "scores", "sessions", "users"}
    assert store.user_for_token("postgres-token") == user
    assert store.get_game(game.id) == game
    assert store.leaderboard(GameMode.walls, 1)[0].id == "score_postgres"

    store.clear_session("postgres-token")
    assert store.user_for_token("postgres-token") is None
