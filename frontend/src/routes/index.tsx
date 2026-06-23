import { createFileRoute, Link } from "@tanstack/react-router";
import { useServices } from "@/services/context";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Snake Arena — Play Snake online" },
      {
        name: "description",
        content:
          "Play classic Snake or wrap-around mode. Compete on the leaderboard and spectate live matches.",
      },
    ],
  }),
  component: Home,
});

function Home() {
  const { user } = useServices();
  return (
    <div className="space-y-8 sm:space-y-10">
      <section className="relative overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-background via-background to-accent/30 p-6 shadow-sm sm:p-10">
        <div className="absolute -right-20 -top-20 h-56 w-56 rounded-full bg-primary/10 blur-3xl" aria-hidden="true" />
        <div className="absolute -bottom-16 -left-16 h-52 w-52 rounded-full bg-chart-2/10 blur-3xl" aria-hidden="true" />
        <div className="relative">
          <p className="inline-flex rounded-full border border-border bg-background/80 px-3 py-1 text-xs font-medium tracking-wide text-muted-foreground">
            Snake Arena
          </p>
          <h1 className="mt-4 max-w-2xl text-4xl font-bold tracking-tight sm:text-5xl">
            Fast rounds, tight turns, and leaderboards that reset your ego.
          </h1>
          <p className="mt-4 max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">
            Pick your mode and survive as long as possible. Classic walls punishes mistakes.
            Pass-through lets you loop around edges for aggressive pathing. Every run can land on
            the board.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              to="/play/$mode"
              params={{ mode: "walls" }}
              className="inline-flex items-center rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
            >
              Play Classic Walls
            </Link>
            <Link
              to="/play/$mode"
              params={{ mode: "wrap" }}
              className="inline-flex items-center rounded-full border border-border bg-background px-5 py-2.5 text-sm font-semibold text-foreground transition-colors hover:bg-accent"
            >
              Play Pass-Through
            </Link>
            <Link
              to="/leaderboard"
              className="inline-flex items-center rounded-full px-2 py-2.5 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground"
            >
              View leaderboard
            </Link>
          </div>
          {!user && (
            <p className="mt-4 text-sm text-muted-foreground">
              You can jump straight into a mode. If needed, you will be asked to
              <Link to="/login" className="mx-1 text-primary underline underline-offset-2">
                log in
              </Link>
              first.
            </p>
          )}
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2">
        <ModeCard
          mode="walls"
          title="Classic Walls"
          desc="No wrapping, no mercy. Route planning and reaction speed decide your score."
        />
        <ModeCard
          mode="wrap"
          title="Pass-Through"
          desc="Cross edges to appear on the opposite side and bait risky, high-scoring lines."
        />
      </section>
    </div>
  );
}

function ModeCard({
  mode,
  title,
  desc,
}: {
  mode: "walls" | "wrap";
  title: string;
  desc: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-6 shadow-sm">
      <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">{desc}</p>
      <Link
        to="/play/$mode"
        params={{ mode }}
        className="mt-4 inline-flex items-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
      >
        Play {title}
      </Link>
    </div>
  );
}
