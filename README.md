# Snake Social Showdown

Full-stack Snake game with a TanStack frontend and FastAPI backend.

## Docker

Build the image and run the app with local volume mounts:

```sh
make docker
```

The app is served at `http://localhost:8000`.

The Docker run target mounts backend source and the built frontend static files:

- `backend/app` to `/app/app`
- `backend/main.py` to `/app/main.py`
- `backend/snake.db` to `/app/snake.db`
- `frontend/dist/client` to `/app/static`

Override the container command, image name, host port, or database path when needed:

```sh
make docker CONTAINER=podman PORT=8080 IMAGE_NAME=snake-dev DB_PATH=$(pwd)/backend/snake.db
```

Use the split targets when you only need one step:

```sh
make docker-build
make docker-run
```
