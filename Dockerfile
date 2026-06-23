# syntax=docker/dockerfile:1

# ── Stage 1: Frontend build ────────────────────────────────────────────────────
FROM node:24-slim AS frontend-build

WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm install -g npm@11.17.0
RUN npm ci
COPY frontend/ ./
RUN npm run build

# ── Stage 2: Rust toolchain + cargo-chef ──────────────────────────────────────
# Build natively for the target platform (arm64 on Apple Silicon, amd64 in CI/prod).
# The final image is debian:bookworm-slim (~10MB), avoiding musl cross-compilation
# issues with ring while still being a fraction of the Python image size.
FROM rust:1.96-bookworm AS chef
RUN cargo install cargo-chef --locked
WORKDIR /app

FROM chef AS planner
COPY backend/ .
RUN cargo chef prepare --recipe-path recipe.json

# ── Stage 3: Build Rust binary ─────────────────────────────────────────────────
FROM chef AS builder
COPY --from=planner /app/recipe.json recipe.json
RUN cargo chef cook --release --recipe-path recipe.json

COPY backend/ .
RUN cargo build --release

# Create a directory for persistent data storage, as distroless images are not able to execute shell commands to create directories.
RUN mkdir -p /data-dir

# ── Stage 4: Minimal final image ───────────────────────────────────────────────
FROM gcr.io/distroless/cc-debian13

COPY --from=builder /app/target/release/snake-backend /snake
COPY --from=frontend-build /app/frontend/dist/client /static
COPY --from=builder /data-dir /data

EXPOSE 8000

ENV FRONTEND_STATIC_DIR=/static

ENTRYPOINT ["/snake"]
