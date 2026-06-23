.PHONY: install backend frontend dev backend-tests frontend-tests test build up down

install:
	cd frontend && npm install
	cargo install cargo-watch

backend:
	cd backend && DATABASE_URL=sqlite://snake.db cargo watch -x run

frontend:
	cd frontend && npm run dev

dev:
	@./scripts/dev.sh

backend-tests:
	cd backend && cargo test

frontend-tests:
	cd frontend && npm test

test: backend-tests frontend-tests

build:
	cd frontend && npm run build

up:
	docker-compose up --build

down:
	docker-compose down
