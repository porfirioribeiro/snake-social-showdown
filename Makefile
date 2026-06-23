.PHONY: install backend frontend dev backend-tests frontend-tests test test-integration build up down

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

up:
	docker-compose up --build

down:
	docker-compose down
