#!/usr/bin/env sh

backend_pid=""
frontend_pid=""
shutting_down=0

kill_tree() {
	pid="$1"
	signal="$2"

	children=$(pgrep -P "$pid" 2>/dev/null || true)
	for child in $children; do
		kill_tree "$child" "$signal"
	done

	kill "-$signal" "$pid" 2>/dev/null || true
}

cleanup() {
	if [ "$shutting_down" -eq 1 ]; then
		return
	fi

	shutting_down=1
	trap - INT TERM

	if [ -n "$backend_pid" ]; then
		kill -TERM "$backend_pid" 2>/dev/null || true
	fi

	if [ -n "$frontend_pid" ]; then
		kill_tree "$frontend_pid" TERM
	fi

	sleep 1

	if [ -n "$backend_pid" ]; then
		kill -KILL "$backend_pid" 2>/dev/null || true
	fi

	if [ -n "$frontend_pid" ]; then
		kill_tree "$frontend_pid" KILL
	fi

	wait 2>/dev/null || true
}

shutdown() {
	cleanup
	exit 0
}

trap shutdown INT TERM

(make backend) &
backend_pid=$!

(make frontend) &
frontend_pid=$!

wait "$backend_pid" "$frontend_pid"
status=$?

cleanup
exit "$status"
