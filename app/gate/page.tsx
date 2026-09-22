"use client";

import { useEffect, useState } from "react";

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
    <div className=" flex min-h-screen items-center justify-center bg-bg px-4 text-ink">
      <form onSubmit={submit} className="w-full max-w-sm rounded-xl border border-line-2 bg-card p-6 shadow-sm">
        <h1 className=" text-2xl font-semibold">Digital Chef AI</h1>
        <p className="mt-1 text-sm text-ink-2">Enter the kitchen password to continue.</p>
        <input
          type="password"
          autoFocus
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="mt-4 w-full rounded-xl border border-line bg-bg px-3 py-2.5 text-base focus:border-accent focus:outline-none"
          placeholder="Password"
        />
        {error && <p className="mt-2 text-sm font-semibold text-danger">{error}</p>}
        <button disabled={busy || !password} className="mt-4 w-full rounded-full bg-accent px-4 py-3 text-sm font-bold text-white shadow-sm disabled:opacity-50">
          {busy ? "Checking…" : "Enter →"}
        </button>
      </form>
    </div>
  );
}
