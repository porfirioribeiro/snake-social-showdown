# Snake Social Showdown

Full-stack Snake game with a TanStack frontend and FastAPI backend.

## Docker

Build the image and run the app with local volume mounts:

```sh
make docker
```

The app is served at `http://localhost:8000`.

To run the Docker app against Postgres, use the Postgres-flavored Docker target:

```sh
make docker-postgres
```

`make postgres` starts a `postgres:16-alpine` container on a shared Docker
network; `make docker-postgres` runs it automatically before starting the app.
The app container starts with
`DATABASE_URL=postgresql+psycopg://snakesocial:snakesocial@snake-db:5432/snakesocial`.

The Docker run target mounts backend source and the built frontend static files:

- `backend/app` to `/app/app`
- `backend/main.py` to `/app/main.py`
- `backend/snake.db` to `/app/snake.db`
- `frontend/dist/client` to `/app/static`

Override the container command, image name, host port, or database path when needed:

```sh
make docker CONTAINER=podman PORT=8080 IMAGE_NAME=snake-dev DB_PATH=$(pwd)/backend/snake.db
```

Postgres settings can also be overridden:

```sh
make docker-postgres POSTGRES_CONTAINER=my-db POSTGRES_PORT=55432 PORT=8080
```

Use the split targets when you only need one step:

```sh
make docker-build
make docker-run
make docker-run-postgres
```
