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
      setError(/already/i.test(error.message) ? "That email already has an account — sign in, or use “Set / reset password”." : error.message);
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
    "mt-3 w-full rounded-xl border-2 border-[#3A2A1E]/20 bg-[#FCF3E3] px-3 py-2.5 text-base focus:border-[#C24E33] focus:outline-none";
  const secondary =
    "rounded-full border-2 border-[#3A2A1E]/25 px-3 py-2 text-xs font-bold text-[#3A2A1E]/70 hover:bg-[#3A2A1E]/5 disabled:opacity-50";

  return (
    <div className="font-techno flex min-h-screen items-center justify-center bg-[#FCF3E3] px-4 text-[#3A2A1E]">
      <form onSubmit={signIn} className="w-full max-w-sm rounded-3xl border-2 border-[#3A2A1E] bg-[#FFFBF2] p-6 shadow-[0_10px_0_0_#3A2A1E]">
        <h1 className="font-display text-2xl font-semibold">Digital Chef AI</h1>

        {!supabase ? (
          <p className="mt-2 text-sm text-[#3A2A1E]/70">
            Sign-in isn&apos;t set up yet (no database connected), so the app is open.{" "}
            <a href="/library" className="font-bold text-[#C24E33]">Go to your library →</a>
          </p>
        ) : (
          <>
            <p className="mt-1 text-sm text-[#3A2A1E]/65">Sign in to your kitchen.</p>
            <input type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} className={input} placeholder="chef@campus.edu" />
            <input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} className={input} placeholder="Password" />
            {error && <p className="mt-2 text-sm font-semibold text-[#B0392A]">{error}</p>}
            {note && <p className="mt-2 text-sm font-semibold text-[#51613A]">{note}</p>}
            <button disabled={busy || !email || !password} className="mt-4 w-full rounded-full bg-[#C24E33] px-4 py-3 text-sm font-bold text-[#FCF3E3] shadow-[0_6px_0_0_#A33E27] disabled:opacity-50">
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
            <p className="mt-3 text-[11px] text-[#3A2A1E]/50">
              First time? Enter your email + a password and click <b>Create account</b>. Signed up by email link before? Use <b>Set / reset password</b>.
            </p>
          </>
        )}
      </form>
    </div>
  );
}
