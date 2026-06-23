import { describe, it, expect } from "vitest";
import { createGame, setDirection, tick, BOARD_W, BOARD_H } from "@/game/engine";

const baseOpts = { id: "g1", userId: "u1", username: "p1", rng: () => 0.999 };

describe("engine", () => {
  it("creates a 3-cell snake heading right", () => {
    const g = createGame({ ...baseOpts, mode: "walls" });
    expect(g.snake).toHaveLength(3);
    expect(g.dir).toEqual({ x: 1, y: 0 });
    expect(g.alive).toBe(true);
    expect(g.score).toBe(0);
  });

  it("tick moves the head and trims the tail when not eating", () => {
    const g = createGame({ ...baseOpts, mode: "walls" });
    const head = g.snake[0];
    // place food far away so we don't eat
    const g2 = { ...g, food: { x: 0, y: 0 } };
    const next = tick(g2);
    expect(next.snake[0]).toEqual({ x: head.x + 1, y: head.y });
    expect(next.snake).toHaveLength(3);
  });

  it("ignores direct reversal", () => {
    const g = createGame({ ...baseOpts, mode: "walls" });
    const reversed = setDirection(g, { x: -1, y: 0 });
    expect(reversed.dir).toEqual({ x: 1, y: 0 });
  });

  it("walls mode kills on wall hit", () => {
    let g = createGame({ ...baseOpts, mode: "walls" });
    g = { ...g, snake: [{ x: BOARD_W - 1, y: 0 }], dir: { x: 1, y: 0 }, food: { x: 0, y: 5 } };
    const next = tick(g);
    expect(next.alive).toBe(false);
  });

  it("wrap mode wraps around edges", () => {
    let g = createGame({ ...baseOpts, mode: "wrap" });
    g = { ...g, snake: [{ x: BOARD_W - 1, y: 3 }], dir: { x: 1, y: 0 }, food: { x: 0, y: 5 } };
    const next = tick(g);
    expect(next.alive).toBe(true);
    expect(next.snake[0]).toEqual({ x: 0, y: 3 });
  });

  it("wrap mode wraps vertically too", () => {
    let g = createGame({ ...baseOpts, mode: "wrap" });
    g = { ...g, snake: [{ x: 4, y: 0 }], dir: { x: 0, y: -1 }, food: { x: 0, y: 5 } };
    const next = tick(g);
    expect(next.snake[0]).toEqual({ x: 4, y: BOARD_H - 1 });
  });

  it("eating food grows snake and increases score", () => {
    const g = createGame({ ...baseOpts, mode: "walls" });
    const head = g.snake[0];
    const withFood = { ...g, food: { x: head.x + 1, y: head.y } };
    const next = tick(withFood);
    expect(next.score).toBe(1);
    expect(next.snake).toHaveLength(4);
  });

  it("self collision ends the game", () => {
    let g = createGame({ ...baseOpts, mode: "wrap" });
    g = {
      ...g,
      snake: [
        { x: 5, y: 5 },
        { x: 4, y: 5 },
        { x: 4, y: 6 },
        { x: 5, y: 6 },
        { x: 6, y: 6 },
        { x: 6, y: 5 },
      ],
      dir: { x: 0, y: 1 },
      food: { x: 19, y: 19 },
    };
    const next = tick(g);
    expect(next.alive).toBe(false);
  });
});
