/**
 * Component identity helpers.
 *
 * Two identifier forms exist (see docs/DESIGN.md "Identity model"):
 *  - `path`       — directory-style, canonical in this API: "Pages/Home"
 *  - `legacyName` — what component.json's `path` field stores and what
 *                   component-instance nodes use as their `type`: "/Pages/Home"
 *                   (some real projects carry a legacy "#" marker: "/#Card").
 *
 * Tools accept either; we normalise input to `path` and preserve the on-disk
 * legacyName in responses.
 */

/** Normalise any accepted component identifier to path form ("Pages/Home"). */
export function toPathForm(input: string): string {
  let p = input.trim();
  if (p.startsWith('/')) p = p.slice(1);
  if (p.startsWith('#')) p = p.slice(1);
  // Also collapse an interior "#" straight after the slash strip ("/#Card").
  return p;
}

/** The legacy name a *newly created* component gets for a given path. */
export function pathToLegacyName(path: string): string {
  return '/' + path;
}

/** Basic path hygiene for created components. Returns an error string or null. */
export function validateComponentPath(path: string): string | null {
  if (path.length === 0) return 'Component path must not be empty.';
  if (path.startsWith('/') || path.endsWith('/')) return 'Component path must not start or end with "/".';
  if (path.includes('..')) return 'Component path must not contain "..".';
  if (path.includes('\\')) return 'Component path must use "/" separators.';
  if (/[<>:"|?*\0]/.test(path)) return 'Component path contains characters that are not filesystem-safe.';
  const segments = path.split('/');
  if (segments.some((s) => s.trim().length === 0)) return 'Component path contains an empty segment.';
  if (segments.some((s) => s === '_registry.json')) return 'Component path collides with the registry file.';
  return null;
}
