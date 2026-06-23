.PHONY: install backend frontend dev backend-tests frontend-tests test build

install:
	cd backend && uv sync --dev
	cd frontend && npm install

backend:
	cd backend && uv run uvicorn app.main:app --reload --port 8000

frontend:
	cd frontend && npm run dev

dev:
	@backend_pid=""; \
	frontend_pid=""; \
	cleanup() { \
		if [ -n "$$backend_pid" ]; then kill "$$backend_pid" 2>/dev/null || true; fi; \
		if [ -n "$$frontend_pid" ]; then kill "$$frontend_pid" 2>/dev/null || true; fi; \
		wait 2>/dev/null || true; \
	}; \
	trap cleanup INT TERM EXIT; \
	(cd backend && uv run uvicorn app.main:app --reload --port 8000) & backend_pid=$$!; \
	(cd frontend && npm run dev) & frontend_pid=$$!; \
	wait $$backend_pid $$frontend_pid

backend-tests:
	cd backend && uv run pytest

frontend-tests:
	cd frontend && npm test

test: backend-tests frontend-tests

build:
	cd frontend && npm run build
