import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { useServices } from "@/services/context";
import { SnakeBoard } from "@/components/SnakeBoard";
import { setDirection, tick } from "@/game/engine";
import type { GameState } from "@/services/types";

export const Route = createFileRoute("/play/$mode")({
  head: () => ({ meta: [{ title: "Play — Snake Arena" }] }),
  component: PlayPage,
});

const TICK_MS = 120;

function PlayPage() {
  const { mode } = Route.useParams();
  const navigate = useNavigate();
  const { api, user, loading } = useServices();
  const [state, setState] = useState<GameState | null>(null);
  const stateRef = useRef<GameState | null>(null);
  const submittedRef = useRef(false);

  const abandonCurrentGame = useCallback(() => {
    const cur = stateRef.current;
    if (!cur?.alive) return;
    stateRef.current = null;
    void api.abandonGame(cur.id);
  }, [api]);

  useEffect(() => {
    if (mode !== "walls" && mode !== "wrap") {
      navigate({ to: "/" });
      return;
    }
    if (loading) return;
    if (!user) {
      navigate({ to: "/login", search: { mode } });
      return;
    }
    let cancelled = false;
    stateRef.current = null;
    setState(null);
    void api.createGame(mode).then((g) => {
      if (cancelled) {
        void api.abandonGame(g.id);
        return;
      }
      stateRef.current = g;
      setState(g);
    });
    return () => {
      cancelled = true;
      abandonCurrentGame();
    };
  }, [mode, api, navigate, user, loading, abandonCurrentGame]);

  useEffect(() => {
    function onPageHide() {
      abandonCurrentGame();
    }

    window.addEventListener("pagehide", onPageHide);
    return () => window.removeEventListener("pagehide", onPageHide);
  }, [abandonCurrentGame]);

  // keyboard
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const cur = stateRef.current;
      if (!cur) return;
      const map: Record<string, { x: number; y: number }> = {
        ArrowUp: { x: 0, y: -1 },
        ArrowDown: { x: 0, y: 1 },
        ArrowLeft: { x: -1, y: 0 },
        ArrowRight: { x: 1, y: 0 },
        w: { x: 0, y: -1 },
        s: { x: 0, y: 1 },
        a: { x: -1, y: 0 },
        d: { x: 1, y: 0 },
      };
      const dir = map[e.key];
      if (!dir) return;
      e.preventDefault();
      const next = setDirection(cur, dir);
      stateRef.current = next;
      setState(next);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // tick loop
  useEffect(() => {
    const interval = setInterval(() => {
      const cur = stateRef.current;
      if (!cur || !cur.alive) return;
      const next = tick(cur);
      stateRef.current = next;
      setState(next);
      void api.updateGame(next);
      if (!next.alive && !submittedRef.current) {
        submittedRef.current = true;
        void api.submitScore(next.score, next.mode);
      }
    }, TICK_MS);
    return () => clearInterval(interval);
  }, [api]);

  if (!state) return <p className="text-muted-foreground">Loading game…</p>;

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="flex w-full max-w-md items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground">
            Mode: <span className="font-medium text-foreground">{state.mode}</span>
          </p>
          <p className="text-2xl font-bold">Score: {state.score}</p>
        </div>
        {!state.alive && (
          <button
            onClick={() => {
              submittedRef.current = false;
              void api.createGame(state.mode).then((g) => {
                stateRef.current = g;
                setState(g);
              });
            }}
            className="rounded bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
          >
            Play again
          </button>
        )}
      </div>
      <SnakeBoard state={state} />
      <p className="text-xs text-muted-foreground">Use arrow keys or WASD.</p>
    </div>
  );
}
