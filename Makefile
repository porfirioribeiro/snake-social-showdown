CONTAINER ?= docker
IMAGE_NAME ?= snake-social-showdown
PORT ?= 8000
DB_PATH ?= $(CURDIR)/backend/snake.db
NETWORK ?= snake-social
POSTGRES_CONTAINER ?= snake-db
POSTGRES_USER ?= snakesocial
POSTGRES_PASSWORD ?= snakesocial
POSTGRES_DB ?= snakesocial
POSTGRES_PORT ?= 5432
POSTGRES_DATABASE_URL ?= postgresql+psycopg://$(POSTGRES_USER):$(POSTGRES_PASSWORD)@$(POSTGRES_CONTAINER):5432/$(POSTGRES_DB)

.PHONY: install backend frontend dev backend-tests frontend-tests test test-integration build network postgres docker-build docker-run docker-run-postgres docker-postgres docker

install:
	cd backend && uv sync --dev
	cd frontend && npm install

backend:
	cd backend && uv run uvicorn app.main:app --reload --port 8000

frontend:
	cd frontend && npm run dev

dev:
	@./scripts/dev.sh

backend-tests:
	cd backend && uv run pytest

frontend-tests:
	cd frontend && npm test

test: backend-tests frontend-tests

test-integration:
	cd backend && uv run pytest tests_integration/

build:
	cd frontend && npm run build

network:
	$(CONTAINER) network inspect $(NETWORK) >/dev/null 2>&1 || $(CONTAINER) network create $(NETWORK)

postgres: network
	$(CONTAINER) start $(POSTGRES_CONTAINER) >/dev/null 2>&1 || \
	$(CONTAINER) run -id \
		--name $(POSTGRES_CONTAINER) \
		--network $(NETWORK) \
		-e POSTGRES_USER=$(POSTGRES_USER) \
		-e POSTGRES_PASSWORD=$(POSTGRES_PASSWORD) \
		-e POSTGRES_DB=$(POSTGRES_DB) \
		-p $(POSTGRES_PORT):5432 \
		-v snake_pgdata:/var/lib/postgresql/data \
		postgres:16-alpine
	$(CONTAINER) network connect $(NETWORK) $(POSTGRES_CONTAINER) >/dev/null 2>&1 || true
	@for i in 1 2 3 4 5 6 7 8 9 10; do \
		$(CONTAINER) exec $(POSTGRES_CONTAINER) pg_isready -U $(POSTGRES_USER) -d $(POSTGRES_DB) >/dev/null 2>&1 && exit 0; \
		sleep 1; \
	done; \
	echo "Postgres did not become ready in time"; \
	exit 1

docker-build:
	$(CONTAINER) build -t $(IMAGE_NAME) .

docker-run:
	$(CONTAINER) run --rm -it \
		-p $(PORT):8000 \
		-v $(CURDIR)/backend/app:/app/app \
		-v $(CURDIR)/backend/main.py:/app/main.py \
		-v $(DB_PATH):/app/snake.db \
		-v $(CURDIR)/frontend/dist/client:/app/static \
		$(IMAGE_NAME)

docker-run-postgres: postgres
	$(CONTAINER) run --rm -it \
		--network $(NETWORK) \
		-e DATABASE_URL=$(POSTGRES_DATABASE_URL) \
		-p $(PORT):8000 \
		-v $(CURDIR)/backend/app:/app/app \
		-v $(CURDIR)/backend/main.py:/app/main.py \
		-v $(CURDIR)/frontend/dist/client:/app/static \
		$(IMAGE_NAME)

docker-postgres: docker-build docker-run-postgres

docker: docker-build docker-run
