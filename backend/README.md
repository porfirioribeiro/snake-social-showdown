## Snake Social Showdown backend

FastAPI implementation of `../openapi.yaml` with a SQLAlchemy-backed store.

### Setup

```sh
uv sync
```

Use `--dev` when you want the test dependencies too:

```sh
uv sync --dev
```

### Run

```sh
uv run python main.py
```

For watch mode during development:

```sh
uv run uvicorn app.main:app --reload --port 8000
```

The API is served under `/api` at `http://localhost:8000`.

FastAPI also serves:

- Swagger UI: `http://localhost:8000/docs`
- OpenAPI JSON: `http://localhost:8000/openapi.json`

### Database

The server reads `DATABASE_URL` to choose its database connection. When it is
not set, the backend uses SQLite at `sqlite:///./snake.db`.

For local development, you can point the API at a different SQLite file:

```sh
DATABASE_URL=sqlite:///./dev.db uv run python main.py
```

For Postgres, start the database from the repository root and pass a Postgres
SQLAlchemy URL:

```sh
make postgres
DATABASE_URL=postgresql+psycopg://snakesocial:snakesocial@localhost:5432/snakesocial uv run python main.py
```

The persistence layer uses SQLAlchemy so SQLite and Postgres can both run
without changing the route handlers.

### Live game streams

Live games use WebSockets for play updates and spectator events:

- `ws://localhost:8000/api/games/active/ws` streams `active-games` messages.
- `ws://localhost:8000/api/games/{id}/ws` accepts owner `game-update`
  messages and streams `game-state` and `game-deleted` messages.

The REST game endpoints create and abandon games. In-game state changes travel
over the game WebSocket.

### Test

```sh
uv run pytest
```

### Check

Run the full backend check before committing:

```sh
uv sync --dev
uv run pytest
uv run python -m compileall app tests
```

To include the real Postgres store compatibility test, start Postgres from the
repository root and pass a test database URL. The test resets the target
database schema, so do not point it at data you want to keep:

```sh
make postgres
POSTGRES_TEST_DATABASE_URL=postgresql+psycopg://snakesocial:snakesocial@localhost:5432/snakesocial uv run pytest tests/test_store_models.py
```

### Seed data

The app starts with users `alice`, `bruno`, and `celine`. Each seeded user has
the password `password`. The store also includes leaderboard scores for both
`walls` and `wrap` modes, but live games are only created by active players.

Login and signup return the user JSON from the OpenAPI contract, set a
`session` cookie, and expose the bearer token in both the `Authorization` and
`X-Access-Token` response headers.
