"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

function safeNext(v: string | null): string {
  return v && v.startsWith("/") && !v.startsWith("//") ? v : "/library";
}

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [next, setNext] = useState("/library");
  const supabase = createClient();

  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    setNext(safeNext(p.get("next")));
    const e = p.get("error");
    if (e === "auth") setError("That sign-in link didn't work — request a new one.");
    else if (e) setError(e);
  }, []);

  function start() {
    setBusy(true);
    setError("");
    setNote("");
  }

  async function signIn(e: React.FormEvent) {
    e.preventDefault();
    if (!supabase) return;
    start();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setError(
        /invalid login credentials/i.test(error.message)
          ? "Wrong email or password. No password yet? Use “Set / reset password” below."
          : error.message
      );
      setBusy(false);
      return;
    }
    window.location.assign(next);
  }

  async function createAccount() {
    if (!supabase) return;
    if (!email || password.length < 8) {
      setError("Enter your email and a password of at least 8 characters, then click Create account.");
      return;
    }
    start();
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}` },
    });
    setBusy(false);
    if (error) {
      setError(
        /already/i.test(error.message)
          ? "That email already has an account — sign in, or use “Set / reset password”."
          : /signups? (are )?not allowed|disabled/i.test(error.message)
            ? "New accounts are created by your admin — ask them to add you, then sign in here."
            : error.message
      );
      return;
    }
    if (data.session) {
      window.location.assign(next);
      return;
    }
    setNote("Account created. Check your email and click the confirmation link — it signs you in.");
  }

  async function resetPassword() {
    if (!supabase) return;
    if (!email) {
      setError("Enter your email first.");
      return;
    }
    start();
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent("/auth/password")}`,
    });
    setBusy(false);
    if (error) setError(error.message);
    else setNote("Check your email for a link to set your password. Open it in this same browser.");
  }

  async function magicLink() {
    if (!supabase) return;
    if (!email) {
      setError("Enter your email first.");
      return;
    }
    start();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}` },
    });
    setBusy(false);
    if (error) setError(error.message);
    else setNote("Check your email — the sign-in link is on its way. Open it in this same browser.");
  }

  const input =
    "mt-3 w-full rounded-xl border border-line bg-bg px-3 py-2.5 text-base focus:border-accent focus:outline-none";
  const secondary =
    "rounded-md border border-line px-3 py-2 text-xs font-bold text-ink-2 hover:bg-bg disabled:opacity-50";

  return (
    <div className=" flex min-h-screen items-center justify-center bg-bg px-4 text-ink">
      <form onSubmit={signIn} className="w-full max-w-sm rounded-xl border border-line-2 bg-card p-6 shadow-sm">
        <h1 className=" text-2xl font-semibold">Digital Chef AI</h1>

        {!supabase ? (
          <p className="mt-2 text-sm text-ink-2">
            Sign-in isn&apos;t set up yet (no database connected), so the app is open.{" "}
            <a href="/library" className="font-bold text-accent">Go to your library →</a>
          </p>
        ) : (
          <>
            <p className="mt-1 text-sm text-ink-2">Sign in to your kitchen.</p>
            <input type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} className={input} placeholder="chef@campus.edu" />
            <input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} className={input} placeholder="Password" />
            {error && <p className="mt-2 text-sm font-semibold text-danger">{error}</p>}
            {note && <p className="mt-2 text-sm font-semibold text-success">{note}</p>}
            <button disabled={busy || !email || !password} className="mt-4 w-full rounded-md bg-accent px-4 py-3 text-sm font-bold text-accent-ink shadow-sm disabled:opacity-50">
              {busy ? "Working…" : "Sign in →"}
            </button>
            <div className="mt-3 flex flex-wrap gap-2">
              <button type="button" onClick={createAccount} disabled={busy} className={secondary}>
                Create account
              </button>
              <button type="button" onClick={resetPassword} disabled={busy} className={secondary}>
                Set / reset password
              </button>
              <button type="button" onClick={magicLink} disabled={busy} className={secondary}>
                Email me a sign-in link
              </button>
            </div>
            <p className="mt-3 text-[11px] text-ink-3">
              First time? Enter your email + a password and click <b>Create account</b>. Signed up by email link before? Use <b>Set / reset password</b>.
            </p>
          </>
        )}
      </form>
    </div>
  );
}
