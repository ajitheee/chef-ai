/**
 * Shared-password gate for the pilot (no database needed). The cookie holds a
 * SHA-256 of the password, never the password itself. Web Crypto so it runs
 * in both the edge middleware and Node route handlers.
 */
export const GATE_COOKIE = "chefai_gate";

export async function gateToken(password: string): Promise<string> {
  const data = new TextEncoder().encode(`chefai:${password}`);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
