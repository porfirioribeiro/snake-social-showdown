import type { Cell, GameMode, GameState } from "@/services/types";

export const BOARD_W = 20;
export const BOARD_H = 20;

export function createGame(opts: {
  id: string;
  userId: string;
  username: string;
  mode: GameMode;
  rng?: () => number;
}): GameState {
  const rng = opts.rng ?? Math.random;
  const mid: Cell = { x: Math.floor(BOARD_W / 2), y: Math.floor(BOARD_H / 2) };
  const snake = [mid, { x: mid.x - 1, y: mid.y }, { x: mid.x - 2, y: mid.y }];
  return {
    id: opts.id,
    userId: opts.userId,
    username: opts.username,
    mode: opts.mode,
    width: BOARD_W,
    height: BOARD_H,
    snake,
    dir: { x: 1, y: 0 },
    food: randomFood(snake, rng),
    score: 0,
    alive: true,
    startedAt: Date.now(),
    updatedAt: Date.now(),
  };
}

function randomFood(snake: Cell[], rng: () => number): Cell {
  while (true) {
    const f = {
      x: Math.floor(rng() * BOARD_W),
      y: Math.floor(rng() * BOARD_H),
    };
    if (!snake.some((s) => s.x === f.x && s.y === f.y)) return f;
  }
}

export function setDirection(state: GameState, dir: Cell): GameState {
  // disallow direct reversal
  if (state.snake.length > 1 && state.dir.x === -dir.x && state.dir.y === -dir.y) {
    return state;
  }
  if (dir.x === 0 && dir.y === 0) return state;
  return { ...state, dir };
}

export function tick(state: GameState, rng: () => number = Math.random): GameState {
  if (!state.alive) return state;
  const head = state.snake[0];
  let nx = head.x + state.dir.x;
  let ny = head.y + state.dir.y;

  if (state.mode === "wrap") {
    nx = (nx + state.width) % state.width;
    ny = (ny + state.height) % state.height;
  } else if (nx < 0 || ny < 0 || nx >= state.width || ny >= state.height) {
    return { ...state, alive: false, updatedAt: Date.now() };
  }

  const newHead = { x: nx, y: ny };
  const ate = newHead.x === state.food.x && newHead.y === state.food.y;
  const newBody = ate ? [newHead, ...state.snake] : [newHead, ...state.snake.slice(0, -1)];

  // self-collision (skip the tail cell that will move when not eating)
  const collides = newBody.slice(1).some((c) => c.x === newHead.x && c.y === newHead.y);
  if (collides) {
    return { ...state, alive: false, updatedAt: Date.now() };
  }

  return {
    ...state,
    snake: newBody,
    food: ate ? randomFood(newBody, rng) : state.food,
    score: ate ? state.score + 1 : state.score,
    updatedAt: Date.now(),
  };
}
