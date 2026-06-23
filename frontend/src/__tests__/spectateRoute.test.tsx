import { QueryClient } from "@tanstack/react-query";
import { createMemoryHistory, createRouter, RouterProvider } from "@tanstack/react-router";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { routeTree } from "@/routeTree.gen";
import type { Api } from "@/services/api";
import type { GameState } from "@/services/types";

const state: GameState = {
  id: "game-1",
  userId: "user-1",
  username: "viewer-target",
  mode: "walls",
  width: 4,
  height: 3,
  snake: [
    { x: 2, y: 1 },
    { x: 1, y: 1 },
  ],
  food: { x: 3, y: 2 },
  dir: { x: 1, y: 0 },
  score: 12,
  alive: true,
  startedAt: 1,
  updatedAt: 2,
};

const apiMock = vi.hoisted(() => ({
  getCurrentUser: vi.fn(async () => null),
  login: vi.fn(),
  signup: vi.fn(),
  logout: vi.fn(),
  createGame: vi.fn(),
  updateGame: vi.fn(),
  abandonGame: vi.fn(),
  getGame: vi.fn(async () => state),
  listActiveGames: vi.fn(async () => [
    { id: state.id, username: state.username, mode: state.mode, score: state.score },
  ]),
  subscribeGame: vi.fn((_id, cb) => {
    cb(state);
    return () => undefined;
  }),
  subscribeActiveGames: vi.fn((cb) => {
    cb([{ id: state.id, username: state.username, mode: state.mode, score: state.score }]);
    return () => undefined;
  }),
}));

vi.mock("@/services/api", async (importOriginal) => ({
  ...((await importOriginal()) as object),
  backendApi: apiMock as unknown as Api,
}));

function createContextMock() {
  return {
    beginPath: vi.fn(),
    arc: vi.fn(),
    fill: vi.fn(),
    fillRect: vi.fn(),
    fillText: vi.fn(),
    lineTo: vi.fn(),
    moveTo: vi.fn(),
    stroke: vi.fn(),
    set fillStyle(_value: string) {},
    set font(_value: string) {},
    set strokeStyle(_value: string) {},
    set textAlign(_value: CanvasTextAlign) {},
  } as unknown as CanvasRenderingContext2D;
}

describe("spectate route", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders the selected live game after clicking Watch", async () => {
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(createContextMock());
    const history = createMemoryHistory({ initialEntries: ["/spectate"] });
    const router = createRouter({
      routeTree,
      history,
      context: { queryClient: new QueryClient() },
      scrollRestoration: false,
    });

    render(<RouterProvider router={router} />);

    const watch = await screen.findByRole("link", { name: "Watch" });
    expect(watch).toHaveAttribute("href", "/spectate/game-1");

    fireEvent.click(watch);

    await waitFor(() => expect(router.state.location.pathname).toBe("/spectate/game-1"));
    expect(await screen.findByText(/Watching/i)).toBeInTheDocument();
    expect(screen.getByText(/@viewer-target/)).toBeInTheDocument();
    expect(screen.getByText("Score: 12")).toBeInTheDocument();
  });
});
