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
    <div className="font-techno flex min-h-screen items-center justify-center bg-[#FCF3E3] px-4 text-[#3A2A1E]">
      <form onSubmit={submit} className="w-full max-w-sm rounded-3xl border-2 border-[#3A2A1E] bg-[#FFFBF2] p-6 shadow-[0_10px_0_0_#3A2A1E]">
        <h1 className="font-display text-2xl font-semibold">Digital Chef AI</h1>
        <p className="mt-1 text-sm text-[#3A2A1E]/65">Enter the kitchen password to continue.</p>
        <input
          type="password"
          autoFocus
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="mt-4 w-full rounded-xl border-2 border-[#3A2A1E]/20 bg-[#FCF3E3] px-3 py-2.5 text-base focus:border-[#C24E33] focus:outline-none"
          placeholder="Password"
        />
        {error && <p className="mt-2 text-sm font-semibold text-[#B0392A]">{error}</p>}
        <button disabled={busy || !password} className="mt-4 w-full rounded-full bg-[#C24E33] px-4 py-3 text-sm font-bold text-[#FCF3E3] shadow-[0_6px_0_0_#A33E27] disabled:opacity-50">
          {busy ? "Checking…" : "Enter →"}
        </button>
      </form>
    </div>
  );
}
