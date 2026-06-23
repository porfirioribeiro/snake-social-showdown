# syntax=docker/dockerfile:1

FROM node:24-slim AS frontend-build

WORKDIR /app/frontend

COPY frontend/package*.json ./
RUN npm install -g npm@11.17.0
RUN npm ci

COPY frontend/ ./
RUN npm run build

RUN node -e 'const fs=require("fs");const path="dist/client/assets";const files=fs.readdirSync(path);const js=files.find((f)=>/^index-.*\.js$/.test(f));const css=files.find((f)=>/^styles-.*\.css$/.test(f));if(!js||!css){throw new Error("Could not find frontend entry assets");}fs.writeFileSync("dist/client/index.html", `<!doctype html>\n<html lang="en">\n<head>\n  <meta charset="utf-8" />\n  <meta name="viewport" content="width=device-width, initial-scale=1" />\n  <title>Snake Arena</title>\n  <meta name="description" content="Multiplayer Snake game with leaderboards and spectator mode." />\n  <link rel="stylesheet" href="/assets/${css}" />\n</head>\n<body>\n  <script type="module" src="/assets/${js}"></script>\n</body>\n</html>\n`);'

FROM python:3.12-slim AS backend

ENV FRONTEND_STATIC_DIR=/app/static \
    PATH="/app/.venv/bin:$PATH" \
    PYTHONUNBUFFERED=1 \
    UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy

WORKDIR /app

COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/

COPY backend/pyproject.toml backend/uv.lock ./
RUN uv sync --frozen --no-dev

COPY backend/ ./
COPY --from=frontend-build /app/frontend/dist/client /app/static

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
