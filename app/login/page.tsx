"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

function LoginForm() {
  const params = useSearchParams();
  const next = params.get("next") || "/";
  const [mode, setMode] = useState<"password" | "magic">("password");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handlePasswordAuth(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setMessage(null);
    const supabase = createClient();
    const { error } = isSignUp
      ? await supabase.auth.signUp({ email, password })
      : await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) {
      setError(error.message);
      return;
    }
    if (isSignUp) {
      setMessage("Account created. Check your email to confirm, then sign in.");
      return;
    }
    window.location.href = next;
  }

  async function handleMagicLink(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setMessage(null);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback?next=${next}` },
    });
    setBusy(false);
    if (error) {
      setError(error.message);
      return;
    }
    setMessage("Check your email for a sign-in link.");
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-5">
      <div className="w-full max-w-sm rounded-xl2 border border-line bg-panel p-6 shadow-2xl">
        <div className="mb-1 text-[11px] font-bold uppercase tracking-[0.19em] text-gold">
          Executive Command Center
        </div>
        <h1 className="mb-6 text-2xl font-extrabold tracking-tight">SNK LIFE OS</h1>

        <div className="mb-5 flex gap-2 rounded-xl bg-bg p-1">
          <button
            type="button"
            onClick={() => setMode("password")}
            className={`flex-1 rounded-lg py-2 text-sm font-semibold transition ${
              mode === "password" ? "bg-panel2 text-ink" : "text-muted"
            }`}
          >
            Password
          </button>
          <button
            type="button"
            onClick={() => setMode("magic")}
            className={`flex-1 rounded-lg py-2 text-sm font-semibold transition ${
              mode === "magic" ? "bg-panel2 text-ink" : "text-muted"
            }`}
          >
            Magic Link
          </button>
        </div>

        <form onSubmit={mode === "password" ? handlePasswordAuth : handleMagicLink} className="space-y-3">
          <div>
            <label className="mb-1 block text-[11px] text-muted">Email</label>
            <input
              required
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="h-12 w-full rounded-xl border border-line bg-bg px-3 text-ink outline-none focus:border-gold"
              placeholder="you@example.com"
            />
          </div>

          {mode === "password" && (
            <div>
              <label className="mb-1 block text-[11px] text-muted">Password</label>
              <input
                required
                type="password"
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="h-12 w-full rounded-xl border border-line bg-bg px-3 text-ink outline-none focus:border-gold"
                placeholder="••••••••"
              />
            </div>
          )}

          {error && <div className="rounded-lg bg-red/10 px-3 py-2 text-sm text-red">{error}</div>}
          {message && (
            <div className="rounded-lg bg-green/10 px-3 py-2 text-sm text-green">{message}</div>
          )}

          <button
            disabled={busy}
            type="submit"
            className="h-12 w-full rounded-xl bg-gradient-to-br from-gold to-goldDark font-bold text-[#17130c] disabled:opacity-60"
          >
            {busy
              ? "Please wait…"
              : mode === "magic"
                ? "Send magic link"
                : isSignUp
                  ? "Create account"
                  : "Sign in"}
          </button>
        </form>

        {mode === "password" && (
          <button
            type="button"
            onClick={() => setIsSignUp((v) => !v)}
            className="mt-4 w-full text-center text-xs text-muted underline underline-offset-2"
          >
            {isSignUp ? "Already have an account? Sign in" : "New here? Create an account"}
          </button>
        )}
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
