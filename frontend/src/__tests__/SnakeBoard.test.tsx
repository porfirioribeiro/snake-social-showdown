import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SnakeBoard } from "@/components/SnakeBoard";
import type { GameState } from "@/services/types";

const state: GameState = {
  id: "g1",
  userId: "u1",
  username: "player",
  mode: "walls",
  width: 4,
  height: 3,
  snake: [
    { x: 2, y: 1 },
    { x: 1, y: 1 },
  ],
  dir: { x: 1, y: 0 },
  food: { x: 3, y: 2 },
  score: 0,
  alive: true,
  startedAt: 1,
  updatedAt: 1,
};

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

describe("SnakeBoard", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("draws the board, food, and snake cells", () => {
    const ctx = createContextMock();
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(ctx);

    render(<SnakeBoard state={state} />);

    const canvas = screen.getByTestId("snake-board");
    expect(canvas).toHaveAttribute("width", "80");
    expect(canvas).toHaveAttribute("height", "60");
    expect(ctx.fillRect).toHaveBeenCalledWith(0, 0, 80, 60);
    expect(ctx.arc).toHaveBeenCalledWith(70, 50, 8, 0, Math.PI * 2);
    expect(ctx.fillRect).toHaveBeenCalledWith(41, 21, 18, 18);
    expect(ctx.fillRect).toHaveBeenCalledWith(21, 21, 18, 18);
  });

  it("draws a game-over overlay when the state is not alive", () => {
    const ctx = createContextMock();
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(ctx);

    render(<SnakeBoard state={{ ...state, alive: false }} />);

    expect(ctx.fillText).toHaveBeenCalledWith("Game Over", 40, 30);
  });
});
