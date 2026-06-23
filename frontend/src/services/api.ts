import type { ActiveGameSummary, GameMode, GameState, ScoreEntry, User } from "./types";

export interface Api {
  // auth
  getCurrentUser(): Promise<User | null>;
  login(username: string, password: string): Promise<User>;
  signup(username: string, password: string): Promise<User>;
  logout(): Promise<void>;

  // games
  createGame(mode: GameMode): Promise<GameState>;
  updateGame(state: GameState): Promise<void>;
  abandonGame(id: string): Promise<void>;
  getGame(id: string): Promise<GameState | null>;
  listActiveGames(): Promise<ActiveGameSummary[]>;
  subscribeGame(id: string, cb: (s: GameState) => void, onDone?: () => void): () => void;
  subscribeActiveGames(cb: (list: ActiveGameSummary[]) => void): () => void;

  // scores
  submitScore(score: number, mode: GameMode): Promise<void>;
  getLeaderboard(mode: GameMode, limit?: number): Promise<ScoreEntry[]>;
}

type JsonBody = Record<string, unknown> | GameState;

type ActiveGamesEvent = {
  type: "active-games";
  games: ActiveGameSummary[];
};

type GameStateEvent = {
  type: "game-state";
  game: GameState;
};

type GameUpdateEvent = {
  type: "game-update";
  game: GameState;
};

type GameDeletedEvent = {
  type: "game-deleted";
  gameId: string;
};

type LiveEvent = ActiveGamesEvent | GameStateEvent | GameDeletedEvent;

type LiveMessage =
  | { type: "subscribe-active" }
  | { type: "subscribe-game"; gameId: string }
  | GameUpdateEvent;

const TOKEN_STORAGE_KEY = "snake.backend.token";
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "";

function storedToken() {
  if (typeof localStorage === "undefined") return null;
  return localStorage.getItem(TOKEN_STORAGE_KEY);
}

function setStoredToken(token: string | null) {
  if (typeof localStorage === "undefined") return;
  if (token) {
    localStorage.setItem(TOKEN_STORAGE_KEY, token);
  } else {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
  }
}

function parseBearer(header: string | null) {
  if (!header) return null;
  const match = /^Bearer\s+(.+)$/i.exec(header);
  return match?.[1] ?? null;
}

export class BackendApi implements Api {
  private readonly baseUrl: string;
  private readonly live: LiveSocket;

  constructor(baseUrl = API_BASE_URL) {
    this.baseUrl = baseUrl.replace(/\/$/, "");
    this.live = new LiveSocket(this.wsUrl.bind(this), storedToken);
  }

  async getCurrentUser(): Promise<User | null> {
    return this.request<User | null>("/auth/me");
  }

  async login(username: string, password: string): Promise<User> {
    return this.request<User>("/auth/login", {
      method: "POST",
      body: { username, password },
    });
  }

  async signup(username: string, password: string): Promise<User> {
    return this.request<User>("/auth/signup", {
      method: "POST",
      body: { username, password },
    });
  }

  async logout(): Promise<void> {
    await this.request<void>("/auth/logout", { method: "POST" });
    setStoredToken(null);
  }

  async createGame(mode: GameMode): Promise<GameState> {
    return this.request<GameState>("/games", {
      method: "POST",
      body: { mode },
    });
  }

  async updateGame(state: GameState): Promise<void> {
    this.live.sendGameUpdate(state);
  }

  async abandonGame(id: string): Promise<void> {
    await this.request<void>(`/games/${encodeURIComponent(id)}/abandon`, {
      method: "POST",
      keepalive: true,
    });
  }

  async getGame(id: string): Promise<GameState | null> {
    return this.request<GameState | null>(`/games/${encodeURIComponent(id)}`);
  }

  async listActiveGames(): Promise<ActiveGameSummary[]> {
    return this.request<ActiveGameSummary[]>("/games/active");
  }

  subscribeGame(id: string, cb: (s: GameState) => void, onDone?: () => void): () => void {
    return this.live.subscribeGame(id, cb, onDone);
  }

  subscribeActiveGames(cb: (list: ActiveGameSummary[]) => void): () => void {
    return this.live.subscribeActiveGames(cb);
  }

  async submitScore(score: number, mode: GameMode): Promise<void> {
    await this.request<void>("/scores", {
      method: "POST",
      body: { score, mode },
    });
  }

  async getLeaderboard(mode: GameMode, limit = 10): Promise<ScoreEntry[]> {
    return this.request<ScoreEntry[]>("/leaderboard", {
      query: { mode, limit: String(limit) },
    });
  }

  private url(path: string, query?: Record<string, string>) {
    const search = query ? `?${new URLSearchParams(query).toString()}` : "";
    return `${this.baseUrl}/api${path}${search}`;
  }

  private wsUrl(path: string, query?: Record<string, string>) {
    const search = query ? `?${new URLSearchParams(query).toString()}` : "";
    if (this.baseUrl) {
      const base = new URL(this.baseUrl);
      base.protocol = base.protocol === "https:" ? "wss:" : "ws:";
      return `${base.toString().replace(/\/$/, "")}/api${path}${search}`;
    }

    const loc = window.location;
    const protocol = loc.protocol === "https:" ? "wss:" : "ws:";
    return `${protocol}//${loc.host}/api${path}${search}`;
  }

  private async request<T>(
    path: string,
    options: {
      method?: string;
      body?: JsonBody;
      query?: Record<string, string>;
      keepalive?: boolean;
    } = {},
  ): Promise<T> {
    const headers = new Headers();
    const token = storedToken();
    if (token) headers.set("Authorization", `Bearer ${token}`);
    if (options.body) headers.set("Content-Type", "application/json");

    const response = await fetch(this.url(path, options.query), {
      method: options.method ?? "GET",
      credentials: "include",
      headers,
      body: options.body ? JSON.stringify(options.body) : undefined,
      keepalive: options.keepalive,
    });

    const tokenFromHeader =
      response.headers.get("X-Access-Token") ?? parseBearer(response.headers.get("Authorization"));
    if (tokenFromHeader) setStoredToken(tokenFromHeader);

    if (!response.ok) {
      throw new Error(await this.errorMessage(response));
    }

    if (response.status === 204) return undefined as T;
    return (await response.json()) as T;
  }

  private async errorMessage(response: Response) {
    try {
      const body = (await response.json()) as { message?: unknown };
      if (typeof body.message === "string") return body.message;
    } catch {
      // Fall through to the HTTP status text.
    }
    return response.statusText || "Request failed";
  }
}

type GameListener = {
  onState: (state: GameState) => void;
  onDone?: () => void;
};

class LiveSocket {
  private socket: WebSocket | null = null;
  private token: string | null = null;
  private readonly activeListeners = new Set<(list: ActiveGameSummary[]) => void>();
  private readonly gameListeners = new Map<string, Set<GameListener>>();
  private readonly pendingMessages: LiveMessage[] = [];

  constructor(
    private readonly wsUrl: (path: string, query?: Record<string, string>) => string,
    private readonly currentToken: () => string | null,
  ) {}

  subscribeActiveGames(cb: (list: ActiveGameSummary[]) => void): () => void {
    this.activeListeners.add(cb);
    this.ensureSocket();
    this.sendIfOpen({ type: "subscribe-active" });
    return () => {
      this.activeListeners.delete(cb);
      this.closeIfIdle();
    };
  }

  subscribeGame(id: string, onState: (state: GameState) => void, onDone?: () => void): () => void {
    const listener: GameListener = { onState, onDone };
    const listeners = this.gameListeners.get(id) ?? new Set<GameListener>();
    listeners.add(listener);
    this.gameListeners.set(id, listeners);
    this.ensureSocket();
    this.sendIfOpen({ type: "subscribe-game", gameId: id });
    return () => {
      listeners.delete(listener);
      if (listeners.size === 0) this.gameListeners.delete(id);
      this.closeIfIdle();
    };
  }

  sendGameUpdate(state: GameState) {
    this.send({ type: "game-update", game: state });
  }

  private ensureSocket() {
    if (typeof WebSocket === "undefined") {
      return;
    }

    const token = this.currentToken();
    if (
      this.socket &&
      this.token === token &&
      this.socket.readyState !== WebSocket.CLOSING &&
      this.socket.readyState !== WebSocket.CLOSED
    ) {
      return;
    }

    if (this.socket) {
      this.socket.close();
    }

    const socket = new WebSocket(this.wsUrl("/games/ws", token ? { token } : undefined));
    this.socket = socket;
    this.token = token;

    socket.onopen = () => {
      if (this.activeListeners.size > 0) {
        socket.send(JSON.stringify({ type: "subscribe-active" } satisfies LiveMessage));
      }
      for (const gameId of this.gameListeners.keys()) {
        socket.send(JSON.stringify({ type: "subscribe-game", gameId } satisfies LiveMessage));
      }
      for (const message of this.pendingMessages.splice(0)) {
        socket.send(JSON.stringify(message));
      }
    };

    socket.onmessage = (message: MessageEvent<string>) => {
      this.handleEvent(JSON.parse(message.data) as LiveEvent);
    };

    socket.onclose = () => {
      if (this.socket === socket) this.socket = null;
    };
  }

  private send(message: LiveMessage) {
    this.ensureSocket();
    if (this.sendIfOpen(message)) {
      return;
    }
    this.pendingMessages.push(message);
  }

  private sendIfOpen(message: LiveMessage) {
    if (this.socket?.readyState !== WebSocket.OPEN) return false;
    this.socket.send(JSON.stringify(message));
    return true;
  }

  private handleEvent(event: LiveEvent) {
    if (event.type === "active-games") {
      this.activeListeners.forEach((cb) => cb(event.games));
      return;
    }

    if (event.type === "game-state") {
      this.gameListeners.get(event.game.id)?.forEach((listener) => listener.onState(event.game));
      return;
    }

    this.gameListeners.get(event.gameId)?.forEach((listener) => listener.onDone?.());
  }

  private closeIfIdle() {
    if (this.activeListeners.size > 0 || this.gameListeners.size > 0) return;
    if (this.pendingMessages.length > 0) return;
    if (this.socket && this.socket.readyState !== WebSocket.CLOSED) {
      this.socket.close();
    }
  }
}

export const backendApi = new BackendApi();
