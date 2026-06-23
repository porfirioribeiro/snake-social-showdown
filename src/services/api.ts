import type {
  ActiveGameSummary,
  GameMode,
  GameState,
  ScoreEntry,
  User,
} from "./types";

export interface Api {
  // auth
  getCurrentUser(): Promise<User | null>;
  login(username: string, password: string): Promise<User>;
  signup(username: string, password: string): Promise<User>;
  logout(): Promise<void>;

  // games
  createGame(mode: GameMode): Promise<GameState>;
  updateGame(state: GameState): Promise<void>;
  getGame(id: string): Promise<GameState | null>;
  listActiveGames(): Promise<ActiveGameSummary[]>;
  subscribeGame(id: string, cb: (s: GameState) => void): () => void;
  subscribeActiveGames(cb: (list: ActiveGameSummary[]) => void): () => void;

  // scores
  submitScore(score: number, mode: GameMode): Promise<void>;
  getLeaderboard(mode: GameMode, limit?: number): Promise<ScoreEntry[]>;
}
