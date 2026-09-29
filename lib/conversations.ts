"use client";

import type { StoredChatMessage, ConversationSummary } from "./chat-events";

/**
 * Kitchen Brain conversations, local adapter (browser storage). The newest
 * thirty are kept. Same shape the Supabase adapter stores in its tables.
 */

type Stored = { id: string; title: string; createdAt: string; updatedAt: string; messages: StoredChatMessage[] };

const KEY = "chefai.conversations.v1";
const MAX = 30;

function readAll(): Stored[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Stored[]) : [];
  } catch {
    return [];
  }
}

function writeAll(list: Stored[]): Stored[] {
  const kept = [...list].sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1)).slice(0, MAX);
  window.localStorage.setItem(KEY, JSON.stringify(kept));
  return kept;
}

const summary = (c: Stored): ConversationSummary => ({ id: c.id, title: c.title, updatedAt: c.updatedAt });

export function listConversations(): ConversationSummary[] {
  return readAll()
    .sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1))
    .map(summary);
}

export function createConversation(title: string): ConversationSummary {
  const now = new Date().toISOString();
  const c: Stored = { id: `${Date.now()}-${Math.round(performance.now())}`, title: title.trim() || "New conversation", createdAt: now, updatedAt: now, messages: [] };
  writeAll([c, ...readAll()]);
  return summary(c);
}

export function removeConversation(id: string): ConversationSummary[] {
  return writeAll(readAll().filter((c) => c.id !== id)).map(summary);
}

export function conversationMessages(id: string): StoredChatMessage[] {
  return readAll().find((c) => c.id === id)?.messages ?? [];
}

/** Add or replace one message (a streamed answer is saved once it is complete). */
export function putMessage(id: string, msg: StoredChatMessage): void {
  const all = readAll();
  const c = all.find((x) => x.id === id);
  if (!c) return;
  const i = c.messages.findIndex((m) => m.id === msg.id);
  if (i >= 0) c.messages[i] = msg;
  else c.messages.push(msg);
  c.updatedAt = new Date().toISOString();
  writeAll(all);
}
