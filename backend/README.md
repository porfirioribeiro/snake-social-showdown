## Snake Social Showdown backend

FastAPI implementation of `../openapi.yaml` with an in-memory store.

### Run

```sh
uv sync
uv run python main.py
```

The API is served under `/api`.

### Test

```sh
uv run pytest
```

### Seed data

The app starts with users `alice`, `bruno`, and `celine`. Each seeded user has
the password `password`. The store also includes a few active games and
leaderboard scores for both `walls` and `wrap` modes.

Login and signup return the user JSON from the OpenAPI contract, set a
`session` cookie, and expose the bearer token in both the `Authorization` and
`X-Access-Token` response headers.
