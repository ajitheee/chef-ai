"use client";

import type { RecipeCard } from "./recipe-card";
import type { ProductionSheet } from "./engine/schema";

/**
 * A one-shot handoff from Kitchen Brain to the scaler: the card (and the
 * sheet, when the brain already scaled it) is put down, the scaler picks it
 * up on its next load, and it is gone. sessionStorage is the transport (it
 * survives the page change and dies with the tab); it is not a data layer,
 * and nothing is read from it twice.
 */

const KEY = "chefai.handoff.v1";

export type Handoff = RecipeCard & { covers?: number; sheet?: ProductionSheet };

export function setHandoff(h: Handoff): void {
  try {
    window.sessionStorage.setItem(KEY, JSON.stringify(h));
  } catch {
    // Storage blocked: the scaler simply opens empty.
  }
}

const PROMPT_KEY = "chefai.brain-prompt.v1";

/** A line typed in the scaler's box that is for Kitchen Brain: put down here, sent as the first message there. */
export function setBrainPrompt(text: string): void {
  try {
    window.sessionStorage.setItem(PROMPT_KEY, text);
  } catch {
    // Storage blocked: Kitchen Brain opens empty and the chef types it again.
  }
}

export function takeBrainPrompt(): string | null {
  try {
    const t = window.sessionStorage.getItem(PROMPT_KEY);
    if (t === null) return null;
    window.sessionStorage.removeItem(PROMPT_KEY);
    return t.trim() ? t : null;
  } catch {
    return null;
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
