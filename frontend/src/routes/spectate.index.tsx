import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServices } from "@/services/context";
import type { ActiveGameSummary } from "@/services/types";

export const Route = createFileRoute("/spectate/")({
  component: SpectatePage,
});

function SpectatePage() {
  const { api } = useServices();
  const [games, setGames] = useState<ActiveGameSummary[]>([]);

  useEffect(() => api.subscribeActiveGames(setGames), [api]);

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Live games</h1>
      {games.length === 0 ? (
        <p className="text-muted-foreground">No active games right now.</p>
      ) : (
        <ul className="divide-y divide-border rounded-md border border-border">
          {games.map((g) => (
            <li key={g.id} className="flex items-center justify-between p-3">
              <div>
                <p className="font-medium">@{g.username}</p>
                <p className="text-xs text-muted-foreground">
                  {g.mode} · score {g.score}
                </p>
              </div>
              <Link
                to="/spectate/$id"
                params={{ id: g.id }}
                className="rounded bg-primary px-3 py-1 text-sm text-primary-foreground hover:bg-primary/90"
              >
                Watch
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
