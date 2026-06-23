import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServices } from "@/services/context";
import { SnakeBoard } from "@/components/SnakeBoard";
import type { GameState } from "@/services/types";

export const Route = createFileRoute("/spectate/$id")({
  head: () => ({ meta: [{ title: "Watching game — Snake Arena" }] }),
  component: SpectateGame,
});

function SpectateGame() {
  const { id } = Route.useParams();
  const { api } = useServices();
  const [state, setState] = useState<GameState | null>(null);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    let unsub: (() => void) | undefined;
    void api.getGame(id).then((g) => {
      if (!g) {
        setMissing(true);
        return;
      }
      setState(g);
      unsub = api.subscribeGame(id, setState);
    });
    return () => unsub?.();
  }, [api, id]);

  if (missing)
    return (
      <div className="space-y-3">
        <p className="text-muted-foreground">Game not found.</p>
        <Link to="/spectate" className="text-primary underline">
          ← Back to live games
        </Link>
      </div>
    );

  if (!state) return <p className="text-muted-foreground">Loading…</p>;

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="text-center">
        <p className="text-sm text-muted-foreground">
          Watching <span className="font-medium text-foreground">@{state.username}</span> ·{" "}
          {state.mode}
        </p>
        <p className="text-2xl font-bold">Score: {state.score}</p>
      </div>
      <SnakeBoard state={state} />
      <Link to="/spectate" className="text-sm text-primary underline">
        ← All live games
      </Link>
    </div>
  );
}
