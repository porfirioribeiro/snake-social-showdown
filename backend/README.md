## Snake Social Showdown backend

FastAPI implementation of `../openapi.yaml` with an in-memory store.

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

The API is served under `/api` at `http://localhost:8000`.

FastAPI also serves:

- Swagger UI: `http://localhost:8000/docs`
- OpenAPI JSON: `http://localhost:8000/openapi.json`

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

### Seed data

The app starts with users `alice`, `bruno`, and `celine`. Each seeded user has
the password `password`. The store also includes a few active games and
leaderboard scores for both `walls` and `wrap` modes.

Login and signup return the user JSON from the OpenAPI contract, set a
`session` cookie, and expose the bearer token in both the `Authorization` and
`X-Access-Token` response headers.
