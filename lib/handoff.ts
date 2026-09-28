"use client";

import type { RecipeCard } from "./recipe-card";

/**
 * A one-shot handoff from Kitchen Brain to the scaler: the card is put down,
 * the scaler picks it up on its next load, and it is gone. sessionStorage is
 * the transport (it survives the page change and dies with the tab); it is not
 * a data layer, and nothing is read from it twice.
 */

const KEY = "chefai.handoff.v1";

export type Handoff = RecipeCard;

export function setHandoff(card: Handoff): void {
  try {
    window.sessionStorage.setItem(KEY, JSON.stringify(card));
  } catch {
    // Storage blocked: the scaler simply opens empty.
  }
}

export function takeHandoff(): Handoff | null {
  try {
    const raw = window.sessionStorage.getItem(KEY);
    if (!raw) return null;
    window.sessionStorage.removeItem(KEY);
    const h = JSON.parse(raw) as Handoff;
    return h && typeof h.name === "string" && typeof h.recipeText === "string" ? h : null;
  } catch {
    return null;
  }
}
