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

  constructor(baseUrl = API_BASE_URL) {
    this.baseUrl = baseUrl.replace(/\/$/, "");
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
    await this.request<void>(`/games/${encodeURIComponent(state.id)}`, {
      method: "PUT",
      body: state,
    });
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
    return this.subscribeLive<GameStateEvent | { type: "game-deleted"; gameId: string }>(
      `/games/${encodeURIComponent(id)}/ws`,
      (event) => {
        if (event.type === "game-state") cb(event.game);
        if (event.type === "game-deleted") onDone?.();
      },
      async () => {
        const game = await this.getGame(id);
        if (game) cb(game);
        else onDone?.();
      }
    );
  }

  subscribeActiveGames(cb: (list: ActiveGameSummary[]) => void): () => void {
    return this.subscribeLive<ActiveGamesEvent>(
      "/games/active/ws",
      (event) => {
        if (event.type === "active-games") cb(event.games);
      },
      async () => cb(await this.listActiveGames()),
    );
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

  private wsUrl(path: string) {
    if (this.baseUrl) {
      const base = new URL(this.baseUrl);
      base.protocol = base.protocol === "https:" ? "wss:" : "ws:";
      return `${base.toString().replace(/\/$/, "")}/api${path}`;
    }

    const loc = window.location;
    const protocol = loc.protocol === "https:" ? "wss:" : "ws:";
    return `${protocol}//${loc.host}/api${path}`;
  }

  private async request<T>(
    path: string,
    options: { method?: string; body?: JsonBody; query?: Record<string, string>; keepalive?: boolean } = {},
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

  private subscribeLive<T>(
    path: string,
    onEvent: (event: T) => void,
    poll: () => Promise<void>,
  ): () => void {
    if (typeof WebSocket === "undefined") {
      void poll();
      const interval = window.setInterval(() => void poll(), 2000);
      return () => window.clearInterval(interval);
    }

    const socket = new WebSocket(this.wsUrl(path));
    socket.onmessage = (message: MessageEvent<string>) => {
      onEvent(JSON.parse(message.data) as T);
    };
    socket.onclose = () => {
      socket.onmessage = null;
    };
    return () => {
      socket.close();
    };
  }
}

export const backendApi = new BackendApi();
