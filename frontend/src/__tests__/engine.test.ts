import { describe, it, expect, vi } from "vitest";
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

  it("ignores a zero direction", () => {
    const g = createGame({ ...baseOpts, mode: "walls" });
    const unchanged = setDirection(g, { x: 0, y: 0 });
    expect(unchanged).toBe(g);
  });

  it("accepts a perpendicular direction", () => {
    const g = createGame({ ...baseOpts, mode: "walls" });
    const turned = setDirection(g, { x: 0, y: 1 });
    expect(turned).not.toBe(g);
    expect(turned.dir).toEqual({ x: 0, y: 1 });
  });

  it("allows reversal for a one-cell snake", () => {
    const g = createGame({ ...baseOpts, mode: "walls" });
    const shortSnake = { ...g, snake: [g.snake[0]] };
    const reversed = setDirection(shortSnake, { x: -1, y: 0 });
    expect(reversed.dir).toEqual({ x: -1, y: 0 });
  });

  it("does not tick an already dead game", () => {
    const g = createGame({ ...baseOpts, mode: "walls" });
    const dead = { ...g, alive: false };
    expect(tick(dead)).toBe(dead);
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
    const rng = vi.fn()
      .mockReturnValueOnce(0.05)
      .mockReturnValueOnce(0.05);
    const next = tick(withFood, rng);
    expect(next.score).toBe(1);
    expect(next.snake).toHaveLength(4);
    expect(next.food).toEqual({ x: 1, y: 1 });
    expect(rng).toHaveBeenCalled();
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
