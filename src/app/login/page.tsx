"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import {
  browserSupportsWebAuthn,
  startAuthentication,
  type AuthenticationResponseJSON,
} from "@simplewebauthn/browser";

export default function LoginPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [webauthnSupported, setWebauthnSupported] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    setWebauthnSupported(browserSupportsWebAuthn());
  }, []);

  async function handleFaceId() {
    setLoading(true);
    setError(null);

    const optionsRes = await fetch("/api/auth/passkey/auth-options", { method: "POST" });
    if (!optionsRes.ok) {
      setLoading(false);
      setError(
        optionsRes.status === 404
          ? "No Face ID registered yet -- use your password, then add Face ID from the dashboard."
          : "Couldn't start Face ID sign-in.",
      );
      setShowPassword(true);
      return;
    }
    const options = await optionsRes.json();

    let assertion: AuthenticationResponseJSON;
    try {
      assertion = await startAuthentication({ optionsJSON: options });
    } catch {
      setLoading(false);
      return; // user cancelled or it failed silently -- no need to show an error for a cancel
    }

    const verifyRes = await fetch("/api/auth/passkey/auth-verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(assertion),
    });

    setLoading(false);
    if (verifyRes.ok) {
      router.replace("/");
      router.refresh();
    } else {
      setError("Face ID sign-in failed.");
      setShowPassword(true);
    }
  }

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
      <div className="w-full max-w-sm rounded-2xl border border-accent/30 bg-surface p-6 shadow-hud">
        <h1 className="mb-4 flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-ink-2">
          <span className="h-1.5 w-1.5 rounded-full bg-accent shadow-[0_0_8px_2px_var(--accent)]" />
          Jarvis
        </h1>

        {webauthnSupported && (
          <button
            onClick={handleFaceId}
            disabled={loading}
            className="w-full rounded-lg bg-accent px-3 py-2.5 text-sm font-medium text-background disabled:opacity-50"
          >
            {loading ? "..." : "Sign in with Face ID"}
          </button>
        )}

        {error && <p className="mt-2 text-sm text-danger">{error}</p>}

        {webauthnSupported && !showPassword ? (
          <button
            onClick={() => setShowPassword(true)}
            className="mt-3 w-full text-center text-xs text-ink-3 hover:text-ink-1"
          >
            Use password instead
          </button>
        ) : (
          <form onSubmit={handleSubmit} className={webauthnSupported ? "mt-4 border-t border-border pt-4" : ""}>
            <input
              type="password"
              autoFocus={!webauthnSupported}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              className="w-full rounded-lg border border-border bg-surface-2 px-3 py-2 text-sm text-ink-0 placeholder-ink-3 outline-none focus:border-accent"
            />
            <button
              type="submit"
              disabled={loading}
              className="mt-3 w-full rounded-lg border border-border px-3 py-2 text-sm font-medium text-ink-1 disabled:opacity-50"
            >
              {loading ? "..." : "Enter"}
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
