"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

/** Reached from the password-reset email (the callback has already signed the user in). */
export default function SetPasswordPage() {
  const [ready, setReady] = useState<"checking" | "ok" | "none">("checking");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const supabase = createClient();

  useEffect(() => {
    if (!supabase) {
      setReady("none");
      return;
    }
    supabase.auth.getUser().then(({ data }) => setReady(data.user ? "ok" : "none"));
  }, [supabase]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!supabase) return;
    if (password.length < 8) {
      setError("Use at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("The two passwords don't match.");
      return;
    }
    setBusy(true);
    setError("");
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      setError(error.message);
      setBusy(false);
      return;
    }
    window.location.assign("/library");
  }

  const input =
    "mt-3 w-full rounded-xl border-2 border-[#3A2A1E]/20 bg-[#FCF3E3] px-3 py-2.5 text-base focus:border-[#C24E33] focus:outline-none";

  return (
    <div className="font-techno flex min-h-screen items-center justify-center bg-[#FCF3E3] px-4 text-[#3A2A1E]">
      <form onSubmit={save} className="w-full max-w-sm rounded-3xl border-2 border-[#3A2A1E] bg-[#FFFBF2] p-6 shadow-[0_10px_0_0_#3A2A1E]">
        <h1 className="font-display text-2xl font-semibold">Set your password</h1>
        {ready === "checking" && <p className="mt-2 text-sm text-[#3A2A1E]/65">One moment…</p>}
        {ready === "none" && (
          <p className="mt-2 text-sm text-[#3A2A1E]/70">
            This link has expired or was opened in a different browser.{" "}
            <a href="/login" className="font-bold text-[#C24E33]">Request a new one →</a>
          </p>
        )}
        {ready === "ok" && (
          <>
            <p className="mt-1 text-sm text-[#3A2A1E]/65">You&apos;re signed in. Choose a password for next time.</p>
            <input type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} className={input} placeholder="New password (8+ characters)" />
            <input type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} className={input} placeholder="Confirm password" />
            {error && <p className="mt-2 text-sm font-semibold text-[#B0392A]">{error}</p>}
            <button disabled={busy || !password || !confirm} className="mt-4 w-full rounded-full bg-[#C24E33] px-4 py-3 text-sm font-bold text-[#FCF3E3] shadow-[0_6px_0_0_#A33E27] disabled:opacity-50">
              {busy ? "Saving…" : "Save password →"}
            </button>
          </>
        )}
      </form>
    </div>
  );
}
