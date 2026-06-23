.PHONY: install backend frontend backend-tests frontend-tests test

install:
	cd backend && uv sync --dev
	cd frontend && npm install

backend:
	cd backend && uv run uvicorn app.main:app --reload --port 8000

frontend:
	cd frontend && npm run dev

backend-tests:
	cd backend && uv run pytest

frontend-tests:
	cd frontend && npm test

test: backend-tests frontend-tests
