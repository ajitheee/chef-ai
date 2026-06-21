"use client";

/**
 * Kitchen memory = the learning loop. The chef records corrections about HIS
 * kitchen ("my combi yields 48%, not 45%", "use 10 oz garlic at 800, not 12").
 * These are sent with every scale so the engine tunes to his reality — the
 * accumulated, un-copyable advantage a fresh AI can't replicate.
 */

export type KitchenNote = { id: string; text: string; addedAt: string };

const KEY = "chefai.kitchen.v1";

export function getKitchenNotes(): KitchenNote[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as KitchenNote[]) : [];
  } catch {
    return [];
  }
}

export function addKitchenNote(text: string): KitchenNote[] {
  const note: KitchenNote = {
    id: `${Date.now()}-${Math.round(performance.now())}`,
    text: text.trim(),
    addedAt: new Date().toLocaleDateString(),
  };
  const next = [note, ...getKitchenNotes()];
  window.localStorage.setItem(KEY, JSON.stringify(next));
  return next;
}

export function removeKitchenNote(id: string): KitchenNote[] {
  const next = getKitchenNotes().filter((n) => n.id !== id);
  window.localStorage.setItem(KEY, JSON.stringify(next));
  return next;
}
