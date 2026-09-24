"use client";

import { useEffect, useState } from "react";
import { LABEL, FIELD, PRIMARY, NOTE_DANGER } from "@/components/paper";

function safeNext(v: string | null): string {
  return v && v.startsWith("/") && !v.startsWith("//") ? v : "/app";
}

export default function GatePage() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [next, setNext] = useState("/app");

  useEffect(() => {
    setNext(safeNext(new URLSearchParams(window.location.search).get("next")));
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/gate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || "Wrong password.");
      window.location.assign(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-bg px-4 py-10 text-ink">
      <form onSubmit={submit} className="w-full max-w-sm">
        <div className="border-b border-ink pb-3">
          <h1 className="text-2xl font-semibold tracking-tight">Digital Chef AI</h1>
          <p className="mt-1 text-sm text-ink-2">Enter the kitchen password to continue.</p>
        </div>
        <div className="mt-5">
          <label className={LABEL} htmlFor="gate-password">Password</label>
          <input id="gate-password" type="password" autoFocus value={password} onChange={(e) => setPassword(e.target.value)} className={FIELD} placeholder="Password" />
        </div>
        {error && <p className={`${NOTE_DANGER} mt-3`}>{error}</p>}
        <button disabled={busy || !password} className={`${PRIMARY} mt-4 w-full py-3 text-base`}>
          {busy ? "Checking…" : "Enter →"}
        </button>
      </form>
    </div>
  );
}
