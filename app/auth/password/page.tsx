"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { LABEL, FIELD, PRIMARY, NOTE_DANGER } from "@/components/paper";

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

  return (
    <div className="flex min-h-screen items-center justify-center bg-bg px-4 py-10 text-ink">
      <form onSubmit={save} className="w-full max-w-sm">
        <div className="border-b border-ink pb-3">
          <h1 className="text-2xl font-semibold tracking-tight">Set your password</h1>
          <p className="mt-1 text-sm text-ink-2">
            {ready === "checking" && "One moment…"}
            {ready === "ok" && "You're signed in. Choose a password for next time."}
            {ready === "none" && "This link has expired or was opened in a different browser."}
          </p>
        </div>
        {ready === "none" && (
          <a href="/login" className={`${PRIMARY} mt-5 inline-block px-4 py-2.5 text-sm`}>
            Request a new one →
          </a>
        )}
        {ready === "ok" && (
          <>
            <div className="mt-5">
              <label className={LABEL} htmlFor="new-password">New password</label>
              <input id="new-password" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} className={FIELD} placeholder="8+ characters" />
            </div>
            <div className="mt-3">
              <label className={LABEL} htmlFor="confirm-password">Confirm password</label>
              <input id="confirm-password" type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} className={FIELD} placeholder="Same again" />
            </div>
            {error && <p className={`${NOTE_DANGER} mt-3`}>{error}</p>}
            <button disabled={busy || !password || !confirm} className={`${PRIMARY} mt-4 w-full py-3 text-base`}>
              {busy ? "Saving…" : "Save password →"}
            </button>
          </>
        )}
      </form>
    </div>
  );
}
