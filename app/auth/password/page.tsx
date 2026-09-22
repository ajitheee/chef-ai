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
    "mt-3 w-full rounded-xl border border-line bg-bg px-3 py-2.5 text-base focus:border-accent focus:outline-none";

  return (
    <div className=" flex min-h-screen items-center justify-center bg-bg px-4 text-ink">
      <form onSubmit={save} className="w-full max-w-sm rounded-xl border border-line-2 bg-card p-6 shadow-sm">
        <h1 className=" text-2xl font-semibold">Set your password</h1>
        {ready === "checking" && <p className="mt-2 text-sm text-ink-2">One moment…</p>}
        {ready === "none" && (
          <p className="mt-2 text-sm text-ink-2">
            This link has expired or was opened in a different browser.{" "}
            <a href="/login" className="font-bold text-accent">Request a new one →</a>
          </p>
        )}
        {ready === "ok" && (
          <>
            <p className="mt-1 text-sm text-ink-2">You&apos;re signed in. Choose a password for next time.</p>
            <input type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} className={input} placeholder="New password (8+ characters)" />
            <input type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} className={input} placeholder="Confirm password" />
            {error && <p className="mt-2 text-sm font-semibold text-danger">{error}</p>}
            <button disabled={busy || !password || !confirm} className="mt-4 w-full rounded-md bg-accent px-4 py-3 text-sm font-bold text-accent-ink shadow-sm disabled:opacity-50">
              {busy ? "Saving…" : "Save password →"}
            </button>
          </>
        )}
      </form>
    </div>
  );
}
