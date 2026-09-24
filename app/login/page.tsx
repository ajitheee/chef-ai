"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { LABEL, FIELD, CHIP, PRIMARY, NOTE_DANGER, NOTE_INFO } from "@/components/paper";

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

  return (
    <div className="flex min-h-screen items-center justify-center bg-bg px-4 py-10 text-ink">
      <form onSubmit={signIn} className="w-full max-w-sm">
        <div className="border-b border-ink pb-3">
          <h1 className="text-2xl font-semibold tracking-tight">Digital Chef AI</h1>
          <p className="mt-1 text-sm text-ink-2">
            {supabase ? "Sign in to your kitchen." : "Sign-in isn't set up yet (no database connected), so the app is open."}
          </p>
        </div>

        {!supabase ? (
          <a href="/library" className={`${PRIMARY} mt-5 inline-block px-4 py-2.5 text-sm`}>
            Go to your library →
          </a>
        ) : (
          <>
            <div className="mt-5">
              <label className={LABEL} htmlFor="email">Email</label>
              <input id="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} className={FIELD} placeholder="chef@campus.edu" />
            </div>
            <div className="mt-3">
              <label className={LABEL} htmlFor="password">Password</label>
              <input id="password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} className={FIELD} placeholder="Password" />
            </div>
            {error && <p className={`${NOTE_DANGER} mt-3`}>{error}</p>}
            {note && <p className={`${NOTE_INFO} mt-3`}>{note}</p>}
            <button disabled={busy || !email || !password} className={`${PRIMARY} mt-4 w-full py-3 text-base`}>
              {busy ? "Working…" : "Sign in →"}
            </button>
            <div className="mt-3 flex flex-wrap gap-1.5">
              <button type="button" onClick={createAccount} disabled={busy} className={`${CHIP} disabled:opacity-50`}>
                Create account
              </button>
              <button type="button" onClick={resetPassword} disabled={busy} className={`${CHIP} disabled:opacity-50`}>
                Set / reset password
              </button>
              <button type="button" onClick={magicLink} disabled={busy} className={`${CHIP} disabled:opacity-50`}>
                Email me a sign-in link
              </button>
            </div>
            <p className="mt-4 text-xs text-ink-3">
              First time? Enter your email and a password, then <span className="font-semibold text-ink-2">Create account</span>. Signed up by email link before? Use{" "}
              <span className="font-semibold text-ink-2">Set / reset password</span>.
            </p>
          </>
        )}
      </form>
    </div>
  );
}
