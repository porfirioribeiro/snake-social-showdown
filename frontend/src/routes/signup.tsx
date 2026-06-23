import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useServices } from "@/services/context";

export const Route = createFileRoute("/signup")({
  validateSearch: (search: Record<string, unknown>) => ({
    mode: search.mode === "walls" || search.mode === "wrap" ? search.mode : undefined,
  }),
  head: () => ({ meta: [{ title: "Sign up — Snake Arena" }] }),
  component: SignupPage,
});

function SignupPage() {
  const { mode } = Route.useSearch();
  const { api, refreshUser } = useServices();
  const navigate = useNavigate();
  const [username, setU] = useState("");
  const [password, setP] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setLoading(true);
    try {
      await api.signup(username, password);
      await refreshUser();
      if (mode) {
        navigate({ to: "/play/$mode", params: { mode } });
      } else {
        navigate({ to: "/" });
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Signup failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-sm space-y-6">
      <h1 className="text-2xl font-bold">Create an account</h1>
      <form onSubmit={submit} className="space-y-3">
        <label className="block text-sm">
          <span className="mb-1 block text-muted-foreground">Username</span>
          <input
            value={username}
            onChange={(e) => setU(e.target.value)}
            className="w-full rounded border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            required
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-muted-foreground">Password (4+ chars)</span>
          <input
            type="password"
            value={password}
            onChange={(e) => setP(e.target.value)}
            className="w-full rounded border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            required
          />
        </label>
        {err && <p className="text-sm text-destructive">{err}</p>}
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          {loading ? "Creating..." : "Sign up"}
        </button>
      </form>
      <p className="text-sm text-muted-foreground">
        Have an account?{" "}
        <Link to="/login" search={mode ? { mode } : undefined} className="text-primary underline">
          Log in
        </Link>
      </p>
    </div>
  );
}
