#!/usr/bin/env sh

set -m

backend_pid=""
frontend_pid=""

cleanup() {
	trap - INT TERM EXIT

	if [ -n "$backend_pid" ]; then
		kill -TERM -"$backend_pid" 2>/dev/null || kill "$backend_pid" 2>/dev/null || true
	fi

	if [ -n "$frontend_pid" ]; then
		kill -TERM -"$frontend_pid" 2>/dev/null || kill "$frontend_pid" 2>/dev/null || true
	fi

	sleep 1

	if [ -n "$backend_pid" ]; then
		kill -KILL -"$backend_pid" 2>/dev/null || true
	fi

	if [ -n "$frontend_pid" ]; then
		kill -KILL -"$frontend_pid" 2>/dev/null || true
	fi

	wait 2>/dev/null || true
}

trap cleanup INT TERM EXIT

(cd backend && uv run uvicorn app.main:app --reload --port 8000) &
backend_pid=$!

(cd frontend && npm run dev) &
frontend_pid=$!

wait "$backend_pid" "$frontend_pid"
