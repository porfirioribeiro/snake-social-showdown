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

  it("rejects duplicate usernames", async () => {
    await api.signup("bob", "pass1234");
    await expect(api.signup("bob", "other123")).rejects.toThrow(/taken/i);
  });

  it("login fails on wrong password", async () => {
    await api.signup("carol", "pass1234");
    await api.logout();
    await expect(api.login("carol", "wrong")).rejects.toThrow(/invalid/i);
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

  it("subscribeGame receives updates", async () => {
    await api.signup("f", "pass1234");
    const g = await api.createGame("wrap");
    const received: number[] = [];
    const unsub = api.subscribeGame(g.id, (s) => received.push(s.score));
    await api.updateGame({ ...g, score: 5 });
    expect(received.at(-1)).toBe(5);
    unsub();
  });

  it("createGame requires auth", async () => {
    await expect(api.createGame("walls")).rejects.toThrow(/auth/i);
  });
});
