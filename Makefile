CONTAINER ?= docker
IMAGE_NAME ?= snake-social-showdown
PORT ?= 8000
DB_PATH ?= $(CURDIR)/backend/snake.db

.PHONY: install backend frontend dev backend-tests frontend-tests test test-integration build postgres docker-build docker-run docker

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

postgres:
	$(CONTAINER) run -id \
		--name snake-db \
		-e POSTGRES_USER=snakesocial \
		-e POSTGRES_PASSWORD=snakesocial \
		-e POSTGRES_DB=snakesocial \
		-p 5432:5432 \
		-v snake_pgdata:/var/lib/postgresql/data \
		postgres:16-alpine

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

docker: docker-build docker-run
