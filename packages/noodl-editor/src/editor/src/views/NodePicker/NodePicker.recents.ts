/**
 * Recently placed nodes (UIX-013).
 *
 * The rail's second section. Kept in `localStorage` rather than the project so
 * it follows the person, not the file, and so an unreadable value can never
 * break the picker — every read is defensive and falls back to "no recents".
 */

const STORAGE_KEY = 'nodegx_nodepicker_recent_nodes';
const MAX_RECENTS = 5;

export function getRecentNodeNames(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    return parsed.filter((x) => typeof x === 'string').slice(0, MAX_RECENTS);
  } catch {
    return [];
  }
}

export function pushRecentNodeName(name: string): void {
  if (!name) return;

  try {
    const next = [name, ...getRecentNodeNames().filter((x) => x !== name)].slice(0, MAX_RECENTS);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // A full or unavailable localStorage must not stop a node being created.
  }
}
