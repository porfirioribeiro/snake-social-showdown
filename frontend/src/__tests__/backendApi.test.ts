import { afterEach, describe, expect, it, vi } from "vitest";
import { BackendApi } from "@/services/api";
import type { GameState } from "@/services/types";

const state: GameState = {
  id: "game-1",
  userId: "user-1",
  username: "player",
  mode: "walls",
  width: 4,
  height: 3,
  snake: [{ x: 2, y: 1 }],
  food: { x: 3, y: 2 },
  dir: { x: 1, y: 0 },
  score: 9,
  alive: true,
  startedAt: 1,
  updatedAt: 2,
};

describe("BackendApi", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("sends game updates over WebSocket instead of HTTP PUT", async () => {
    const sockets: MockWebSocket[] = [];
    class MockWebSocket {
      static CONNECTING = 0;
      static OPEN = 1;
      static CLOSING = 2;
      static CLOSED = 3;

      onopen: (() => void) | null = null;
      onmessage: ((message: MessageEvent<string>) => void) | null = null;
      onclose: (() => void) | null = null;
      readyState = MockWebSocket.CONNECTING;
      send = vi.fn();
      close = vi.fn();

      constructor(readonly url: string) {
        sockets.push(this);
      }

      open() {
        this.readyState = MockWebSocket.OPEN;
        this.onopen?.();
      }
    }
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    vi.stubGlobal("WebSocket", MockWebSocket);

    const api = new BackendApi("http://api.test");
    await api.updateGame(state);

    expect(fetch).not.toHaveBeenCalled();
    expect(sockets).toHaveLength(1);
    expect(sockets[0].url).toBe("ws://api.test/api/games/game-1/ws");

    sockets[0].open();

    expect(sockets[0].send).toHaveBeenCalledWith(
      JSON.stringify({ type: "game-update", game: state }),
    );
  });
});
