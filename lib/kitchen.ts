"use client";

/**
 * Kitchen memory = the learning loop. The chef records corrections about HIS
 * kitchen ("my combi yields 48%, not 45%", "use 10 oz garlic at 800, not 12").
 * The active ones are sent with every scale so the engine tunes to his reality
 * — the accumulated, un-copyable advantage a fresh AI can't replicate. A note
 * can be paused (kept, not sent) without deleting it.
 */

export type KitchenNote = { id: string; text: string; addedAt: string; active?: boolean };

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

function write(next: KitchenNote[]): KitchenNote[] {
  window.localStorage.setItem(KEY, JSON.stringify(next));
  return next;
}

export function addKitchenNote(text: string): KitchenNote[] {
  const note: KitchenNote = {
    id: `${Date.now()}-${Math.round(performance.now())}`,
    text: text.trim(),
    addedAt: new Date().toLocaleDateString(),
    active: true,
  };
  return write([note, ...getKitchenNotes()]);
}

export function removeKitchenNote(id: string): KitchenNote[] {
  return write(getKitchenNotes().filter((n) => n.id !== id));
}

export function setKitchenNoteActive(id: string, active: boolean): KitchenNote[] {
  return write(getKitchenNotes().map((n) => (n.id === id ? { ...n, active } : n)));
}
