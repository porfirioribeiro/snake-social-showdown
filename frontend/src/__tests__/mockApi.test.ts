import { describe, it, expect, beforeEach } from "vitest";
import { MockApi } from "@/services/mockApi";

describe("MockApi", () => {
  let api: MockApi;
  beforeEach(() => {
    api = new MockApi();
  });

  it("signup logs the user in and getCurrentUser returns them", async () => {
    const u = await api.signup("alice", "pass1234");
    expect(u.username).toBe("alice");
    const cur = await api.getCurrentUser();
    expect(cur?.username).toBe("alice");
  });

  it("rejects blank usernames and short passwords", async () => {
    await expect(api.signup(" ", "pass1234")).rejects.toThrow(/username required/i);
    await expect(api.signup("short", "123")).rejects.toThrow(/password must be 4\+/i);
  });

  it("rejects duplicate usernames", async () => {
    await api.signup("bob", "pass1234");
    await expect(api.signup("bob", "other123")).rejects.toThrow(/taken/i);
  });

  it("login fails on wrong password", async () => {
    await api.signup("carol", "pass1234");
    await api.logout();
    await expect(api.login("carol", "wrong")).rejects.toThrow(/invalid/i);
  });

  it("login fails for unknown users", async () => {
    await expect(api.login("missing", "pass1234")).rejects.toThrow(/invalid/i);
  });

  it("falls back when persisted JSON is malformed", async () => {
    localStorage.setItem("snake.mock.session", "{bad json");
    localStorage.setItem("snake.mock.scores", "{bad json");
    expect(await api.getCurrentUser()).toBeNull();
    expect(await api.getLeaderboard("walls")).toEqual([]);
  });

  it("submitScore and getLeaderboard sort desc and filter by mode", async () => {
    await api.signup("d", "pass1234");
    await api.submitScore(3, "walls");
    await api.submitScore(7, "walls");
    await api.submitScore(99, "wrap");
    const wb = await api.getLeaderboard("walls");
    expect(wb.map((s) => s.score)).toEqual([7, 3]);
    const wr = await api.getLeaderboard("wrap");
    expect(wr).toHaveLength(1);
    expect(wr[0].score).toBe(99);
  });

  it("getLeaderboard honors the provided limit", async () => {
    await api.signup("limit", "pass1234");
    await api.submitScore(3, "walls");
    await api.submitScore(8, "walls");
    await api.submitScore(5, "walls");
    const scores = await api.getLeaderboard("walls", 2);
    expect(scores.map((s) => s.score)).toEqual([8, 5]);
  });

  it("submitScore requires auth", async () => {
    await expect(api.submitScore(1, "walls")).rejects.toThrow(/auth/i);
  });

  it("creates games and lists them as active; subscribeActiveGames notifies", async () => {
    await api.signup("e", "pass1234");
    const events: number[] = [];
    const unsub = api.subscribeActiveGames((l) => events.push(l.length));
    const g = await api.createGame("walls");
    // wait a microtask for async notify
    await Promise.resolve();
    await Promise.resolve();
    expect(events.at(-1)).toBe(1);
    const fetched = await api.getGame(g.id);
    expect(fetched?.id).toBe(g.id);
    unsub();
  });

  it("removes ended games from live games and notifies spectators", async () => {
    await api.signup("ended", "pass1234");
    const g = await api.createGame("walls");
    const events: number[] = [];
    const ended: boolean[] = [];
    const unsubActive = api.subscribeActiveGames((l) => events.push(l.length));
    const unsubGame = api.subscribeGame(g.id, () => undefined, () => ended.push(true));

    await api.updateGame({ ...g, alive: false });
    await Promise.resolve();

    expect(await api.getGame(g.id)).toBeNull();
    expect(await api.listActiveGames()).toEqual([]);
    expect(events.at(-1)).toBe(0);
    expect(ended).toEqual([true]);
    unsubActive();
    unsubGame();
  });

  it("active game unsubscribe stops later notifications", async () => {
    await api.signup("active-unsub", "pass1234");
    const events: number[] = [];
    const unsub = api.subscribeActiveGames((l) => events.push(l.length));
    await Promise.resolve();
    unsub();
    await api.createGame("walls");
    await Promise.resolve();
    expect(events).toEqual([0]);
  });

  it("subscribeGame receives updates", async () => {
    await api.signup("f", "pass1234");
    const g = await api.createGame("wrap");
    const received: number[] = [];
    const unsub = api.subscribeGame(g.id, (s) => received.push(s.score));
    await api.updateGame({ ...g, score: 5 });
    expect(received.at(-1)).toBe(5);
    unsub();
  });

  it("subscribeGame does not emit immediately for unknown games and unsubscribes", async () => {
    await api.signup("game-unsub", "pass1234");
    const received: number[] = [];
    const unsub = api.subscribeGame("missing", (s) => received.push(s.score));
    expect(received).toEqual([]);
    unsub();
    await api.updateGame({
      id: "missing",
      userId: "u1",
      username: "game-unsub",
      mode: "walls",
      width: 20,
      height: 20,
      snake: [{ x: 1, y: 1 }],
      dir: { x: 1, y: 0 },
      food: { x: 2, y: 2 },
      score: 4,
      alive: true,
      startedAt: 1,
      updatedAt: 1,
    });
    expect(received).toEqual([]);
  });

  it("createGame requires auth", async () => {
    await expect(api.createGame("walls")).rejects.toThrow(/auth/i);
  });
});
