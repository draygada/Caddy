/** Deterministic 12-hex demo hash for a log sequence number. Not a signature; the real log signs with an ephemeral demo key. */
export const hashOf = (n: number): string =>
  (((n * 2654435761) >>> 0).toString(16).padStart(8, '0') + (((n * 40503 + 7) * 2246822519) >>> 0).toString(16).padStart(8, '0')).slice(0, 12);

/** Accepts "3.4", "3,4", "3.4 m"; returns null for anything that is not a plain decimal. */
export function parseDecimal(text: string): number | null {
  const t = String(text).trim().replace(',', '.').replace(/\s*m$/i, '').trim();
  if (!/^\d+(\.\d+)?$/.test(t)) return null;
  return parseFloat(t);
}
