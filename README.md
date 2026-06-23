# Snake Social Showdown

Full-stack Snake game with a TanStack frontend and FastAPI backend.

## Docker

Build and start the app with Postgres:

```sh
make up
```

The app is served at `http://localhost:8000`. Stop with:

```sh
make down
```

Override the host port if needed:

```sh
PORT=8080 make up
```

The compose file defines two services: `app` (the built image) and `db`
(`postgres:16-alpine`). The app waits for Postgres to pass its healthcheck
before starting.
