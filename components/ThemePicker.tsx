"use client";

import { useEffect, useState } from "react";

/**
 * TEMPORARY — lets the founder click between the candidate looks on the real screens.
 * Each id matches an `html[data-theme=…]` block in globals.css; "copper" is the base look
 * (no attribute). The choice is a plain cookie so every page opens in the same look.
 * Once a look is chosen: delete this file, the <ThemePicker /> in TopBar, the cookie script
 * in app/layout.tsx and the unused theme blocks.
 */
const LOOKS = [
  { id: "whites", label: "A · Whites" },
  { id: "copper", label: "B · Copper" },
  { id: "night", label: "C · Night" },
  { id: "paper", label: "D · Paper" },
] as const;

type LookId = (typeof LOOKS)[number]["id"];
const COOKIE = "chefai-theme";

export function ThemePicker() {
  const [look, setLook] = useState<LookId>("copper");

  useEffect(() => {
    const current = document.documentElement.dataset.theme as LookId | undefined;
    if (current) setLook(current);
  }, []);

  function pick(id: LookId) {
    if (id === "copper") delete document.documentElement.dataset.theme;
    else document.documentElement.dataset.theme = id;
    document.cookie = `${COOKIE}=${id}; path=/; max-age=31536000; samesite=lax`;
    setLook(id);
  }

  return (
    <div className="no-print fixed bottom-4 right-4 z-50 flex items-center gap-1 rounded-lg border border-line-2 bg-card p-1 text-xs shadow-lg">
      <span className="px-2 font-medium text-ink-3">Look</span>
      {LOOKS.map((l) => (
        <button
          key={l.id}
          type="button"
          onClick={() => pick(l.id)}
          className={`rounded-md px-2.5 py-1.5 font-semibold ${
            look === l.id ? "bg-ink text-card" : "text-ink-2 hover:bg-bg"
          }`}
        >
          {l.label}
        </button>
      ))}
    </div>
  );
}
