import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useServices } from "@/services/context";

export const Route = createFileRoute("/login")({
  validateSearch: (search: Record<string, unknown>) => ({
    mode: search.mode === "walls" || search.mode === "wrap" ? search.mode : undefined,
  }),
  head: () => ({ meta: [{ title: "Log in — Snake Arena" }] }),
  component: LoginPage,
});

function LoginPage() {
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
      await api.login(username, password);
      await refreshUser();
      if (mode) {
        navigate({ to: "/play/$mode", params: { mode } });
      } else {
        navigate({ to: "/" });
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-sm space-y-6">
      <h1 className="text-2xl font-bold">Log in</h1>
      <form onSubmit={submit} className="space-y-3">
        <Field label="Username" value={username} onChange={setU} />
        <Field label="Password" type="password" value={password} onChange={setP} />
        {err && <p className="text-sm text-destructive">{err}</p>}
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          {loading ? "Logging in..." : "Log in"}
        </button>
      </form>
      <p className="text-sm text-muted-foreground">
        New here?{" "}
        <Link to="/signup" search={mode ? { mode } : undefined} className="text-primary underline">
          Create an account
        </Link>
      </p>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
}) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block text-muted-foreground">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        required
      />
    </label>
  );
}
