import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServices } from "@/services/context";
import type { GameMode, ScoreEntry } from "@/services/types";

export const Route = createFileRoute("/leaderboard")({
  head: () => ({
    meta: [
      { title: "Leaderboard — Snake Arena" },
      { name: "description", content: "Top Snake scores by mode." },
    ],
  }),
  component: LeaderboardPage,
});

function LeaderboardPage() {
  const { api } = useServices();
  const [mode, setMode] = useState<GameMode>("walls");
  const [scores, setScores] = useState<ScoreEntry[]>([]);

  useEffect(() => {
    void api.getLeaderboard(mode).then(setScores);
  }, [api, mode]);

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Leaderboard</h1>
      <div className="flex gap-2">
        {(["walls", "wrap"] as const).map((m) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className={`rounded px-3 py-1 text-sm ${
              mode === m
                ? "bg-primary text-primary-foreground"
                : "border border-border hover:bg-accent"
            }`}
          >
            {m === "walls" ? "Walls" : "Pass-through"}
          </button>
        ))}
      </div>

      <table className="w-full text-sm">
        <thead className="border-b border-border text-left text-muted-foreground">
          <tr>
            <th className="py-2">#</th>
            <th className="py-2">Player</th>
            <th className="py-2 text-right">Score</th>
          </tr>
        </thead>
        <tbody>
          {scores.length === 0 && (
            <tr>
              <td colSpan={3} className="py-6 text-center text-muted-foreground">
                No scores yet — be the first!
              </td>
            </tr>
          )}
          {scores.map((s, i) => (
            <tr key={s.id} className="border-b border-border/50">
              <td className="py-2">{i + 1}</td>
              <td className="py-2 font-medium">@{s.username}</td>
              <td className="py-2 text-right tabular-nums">{s.score}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
