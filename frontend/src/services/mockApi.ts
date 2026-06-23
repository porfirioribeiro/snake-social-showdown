import type { Api } from "./api";
import type { ActiveGameSummary, GameMode, GameState, ScoreEntry, User } from "./types";

const LS_USERS = "snake.mock.users";
const LS_SESSION = "snake.mock.session";
const LS_SCORES = "snake.mock.scores";

type StoredUser = User & { password: string };

function read<T>(key: string, fallback: T): T {
  if (typeof localStorage === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}
function write<T>(key: string, value: T) {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(key, JSON.stringify(value));
}

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

export class MockApi implements Api {
  private games = new Map<string, GameState>();
  private gameListeners = new Map<string, Set<(s: GameState) => void>>();
  private activeListeners = new Set<(list: ActiveGameSummary[]) => void>();

  // ---------- auth ----------
  async getCurrentUser(): Promise<User | null> {
    return read<User | null>(LS_SESSION, null);
  }

  async login(username: string, password: string): Promise<User> {
    const users = read<StoredUser[]>(LS_USERS, []);
    const u = users.find((x) => x.username === username);
    if (!u || u.password !== password) throw new Error("Invalid username or password");
    const session: User = { id: u.id, username: u.username };
    write(LS_SESSION, session);
    return session;
  }

  async signup(username: string, password: string): Promise<User> {
    if (!username.trim() || password.length < 4)
      throw new Error("Username required, password must be 4+ chars");
    const users = read<StoredUser[]>(LS_USERS, []);
    if (users.some((u) => u.username === username)) throw new Error("Username already taken");
    const user: StoredUser = { id: uid(), username, password };
    users.push(user);
    write(LS_USERS, users);
    const session: User = { id: user.id, username: user.username };
    write(LS_SESSION, session);
    return session;
  }

  async logout(): Promise<void> {
    if (typeof localStorage !== "undefined") localStorage.removeItem(LS_SESSION);
  }

  // ---------- games ----------
  async createGame(mode: GameMode): Promise<GameState> {
    const user = await this.getCurrentUser();
    if (!user) throw new Error("Not authenticated");
    const { createGame } = await import("@/game/engine");
    const g = createGame({ id: uid(), userId: user.id, username: user.username, mode });
    this.games.set(g.id, g);
    this.notifyActive();
    return g;
  }

  async updateGame(state: GameState): Promise<void> {
    if (!state.alive) {
      this.games.delete(state.id);
      const ls = this.gameListeners.get(state.id);
      if (ls) ls.forEach((cb) => cb(state));
      this.notifyActive();
      return;
    }
    this.games.set(state.id, state);
    const ls = this.gameListeners.get(state.id);
    if (ls) ls.forEach((cb) => cb(state));
    this.notifyActive();
  }

  async getGame(id: string): Promise<GameState | null> {
    return this.games.get(id) ?? null;
  }

  async listActiveGames(): Promise<ActiveGameSummary[]> {
    return Array.from(this.games.values()).map((g) => ({
      id: g.id,
      username: g.username,
      mode: g.mode,
      score: g.score,
    }));
  }

  subscribeGame(id: string, cb: (s: GameState) => void, onDone?: () => void): () => void {
    if (!this.gameListeners.has(id)) this.gameListeners.set(id, new Set());
    const listener = (state: GameState) => {
      cb(state);
      if (!state.alive) onDone?.();
    };
    this.gameListeners.get(id)!.add(listener);
    const cur = this.games.get(id);
    if (cur) listener(cur);
    else onDone?.();
    return () => this.gameListeners.get(id)?.delete(listener);
  }

  subscribeActiveGames(cb: (list: ActiveGameSummary[]) => void): () => void {
    this.activeListeners.add(cb);
    void this.listActiveGames().then(cb);
    return () => this.activeListeners.delete(cb);
  }

  private notifyActive() {
    void this.listActiveGames().then((list) => {
      this.activeListeners.forEach((cb) => cb(list));
    });
  }

  // ---------- scores ----------
  async submitScore(score: number, mode: GameMode): Promise<void> {
    const user = await this.getCurrentUser();
    if (!user) throw new Error("Not authenticated");
    const scores = read<ScoreEntry[]>(LS_SCORES, []);
    scores.push({
      id: uid(),
      userId: user.id,
      username: user.username,
      mode,
      score,
      createdAt: Date.now(),
    });
    write(LS_SCORES, scores);
  }

  async getLeaderboard(mode: GameMode, limit = 10): Promise<ScoreEntry[]> {
    const scores = read<ScoreEntry[]>(LS_SCORES, []);
    return scores
      .filter((s) => s.mode === mode)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }
}

export const mockApi = new MockApi();
