import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/spectate")({
  head: () => ({
    meta: [
      { title: "Spectate — Snake Arena" },
      { name: "description", content: "Watch live Snake games in progress." },
    ],
  }),
  component: SpectateLayout,
});

function SpectateLayout() {
  return <Outlet />;
}
