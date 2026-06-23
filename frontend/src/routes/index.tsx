import { createFileRoute, Link } from "@tanstack/react-router";
import { useServices } from "@/services/context";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Snake Arena — Play Snake online" },
      {
        name: "description",
        content: "Play classic Snake or wrap-around mode. Compete on the leaderboard and spectate live matches.",
      },
    ],
  }),
  component: Home,
});

function Home() {
  const { user } = useServices();
  return (
    <div className="space-y-10">
      <section className="text-center">
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
          Play Snake. Climb the leaderboard.
        </h1>
        <p className="mx-auto mt-3 max-w-xl text-muted-foreground">
          Two modes, live spectating, and global top scores.
        </p>
      </section>

      <section className="grid gap-4 sm:grid-cols-2">
        <ModeCard
          mode="walls"
          title="Classic Walls"
          desc="Hit a wall, you die. Old-school discipline."
          disabled={!user}
        />
        <ModeCard
          mode="wrap"
          title="Pass-Through"
          desc="Edges wrap around. Plan your loops carefully."
          disabled={!user}
        />
      </section>

      {!user && (
        <p className="text-center text-sm text-muted-foreground">
          <Link to="/login" className="text-primary underline">
            Log in
          </Link>{" "}
          or{" "}
          <Link to="/signup" className="text-primary underline">
            sign up
          </Link>{" "}
          to play.
        </p>
      )}
    </div>
  );
}

function ModeCard({
  mode,
  title,
  desc,
  disabled,
}: {
  mode: "walls" | "wrap";
  title: string;
  desc: string;
  disabled: boolean;
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-6 shadow-sm">
      <h2 className="text-xl font-semibold">{title}</h2>
      <p className="mt-2 text-sm text-muted-foreground">{desc}</p>
      {disabled ? (
        <button
          disabled
          className="mt-4 cursor-not-allowed rounded bg-muted px-4 py-2 text-sm text-muted-foreground"
        >
          Log in to play
        </button>
      ) : (
        <Link
          to="/play/$mode"
          params={{ mode }}
          className="mt-4 inline-block rounded bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          Play {title}
        </Link>
      )}
    </div>
  );
}
