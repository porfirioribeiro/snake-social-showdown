export type GameMode = "walls" | "wrap";

export interface User {
  id: string;
  username: string;
}

export interface ScoreEntry {
  id: string;
  userId: string;
  username: string;
  mode: GameMode;
  score: number;
  createdAt: number;
}

export type Cell = { x: number; y: number };

export interface GameState {
  id: string;
  userId: string;
  username: string;
  mode: GameMode;
  width: number;
  height: number;
  snake: Cell[];
  food: Cell;
  dir: Cell;
  score: number;
  alive: boolean;
  startedAt: number;
  updatedAt: number;
}

export interface ActiveGameSummary {
  id: string;
  username: string;
  mode: GameMode;
  score: number;
  alive: boolean;
}
