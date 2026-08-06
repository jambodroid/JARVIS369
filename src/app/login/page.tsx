"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });

    setLoading(false);
    if (res.ok) {
      router.replace("/");
      router.refresh();
    } else {
      setError("Wrong password");
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm rounded-2xl border border-accent/30 bg-surface p-6 shadow-hud"
      >
        <h1 className="mb-4 flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-ink-2">
          <span className="h-1.5 w-1.5 rounded-full bg-accent shadow-[0_0_8px_2px_var(--accent)]" />
          Jarvis
        </h1>
        <input
          type="password"
          autoFocus
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
          className="w-full rounded-lg border border-border bg-surface-2 px-3 py-2 text-sm text-ink-0 placeholder-ink-3 outline-none focus:border-accent"
        />
        {error && <p className="mt-2 text-sm text-danger">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="mt-4 w-full rounded-lg bg-accent px-3 py-2 text-sm font-medium text-background disabled:opacity-50"
        >
          {loading ? "..." : "Enter"}
        </button>
      </form>
    </main>
  );
}
