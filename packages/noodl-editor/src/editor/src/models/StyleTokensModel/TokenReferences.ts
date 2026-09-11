/**
 * CMP-008: what counts as a `var(--token)` reference — in ONE place.
 *
 * Two sides of the library read this question and they must answer it
 * identically. The EXPORT side (`noodl-mcp`'s `libraryExport.entryTokens`,
 * CMP-007) collects the tokens a part reads so an agent can be told what a part
 * expects; the INSTALL side (`import-engine`'s `tokenGap`) subtracts the tokens
 * the host project defines to say which of them resolve to nothing.
 *
 * 🔴 **A disagreement between the two is invisible.** CMP-007 wrote the reason
 * down and then kept its own copy of the regex, which is the shape this module
 * removes: if the install's matcher is narrower than the export's, the install
 * reports a SUBSET, and a part with an unresolvable token reads exactly like a
 * clean one. An under-report has no symptom — unlike a crash, nobody finds it.
 * See the trap about a second copy of a palette drifting silently.
 *
 * Deliberately free of the editor: no models, no filesystem, no React. It is
 * re-exported to `noodl-mcp` through `editor-deps`, which is the only direction
 * that dependency is allowed to run.
 */

/**
 * The one matcher. Non-anchored and global: a token reference can appear
 * anywhere inside a parameter value (`"1px solid var(--border)"`), and a single
 * value can carry several (`"var(--space-4) var(--space-2)"`).
 *
 * ⚠️ **Never reuse this object across calls without resetting it** — a global
 * regex carries `lastIndex`. Every helper here builds its own matches in one
 * `matchAll`, which consumes it and leaves nothing behind; a caller that wants
 * the pattern should call {@link collectTokenReferences} rather than `exec` it
 * in a loop.
 */
const TOKEN_REFERENCE = /var\(\s*--([A-Za-z0-9_-]+)/g;

/**
 * Every distinct `--name` referenced anywhere in `text`, sorted.
 *
 * Takes text rather than a parsed object on purpose. A token reference is a
 * string value that can sit on any parameter of any node type, in a variant, in
 * a style definition or in a composition — walking the shapes would mean a list
 * of places to look, and a list of places to look is a list of places to forget.
 * Serialising and scanning cannot miss a location; its cost is that it would
 * also see a token named inside a comment or a label, which is an over-report in
 * a REPORT, and this never refuses anything.
 */
export function collectTokenReferences(text: string): string[] {
  const found = new Set<string>();
  for (const match of text.matchAll(TOKEN_REFERENCE)) found.add(`--${match[1]}`);
  return [...found].sort();
}

/**
 * The same question asked of an arbitrary value — an object is serialised, a
 * string is scanned as-is. `undefined` and `null` read as no references rather
 * than throwing, because a project with no metadata is an ordinary project.
 */
export function collectTokenReferencesIn(value: unknown): string[] {
  if (value === undefined || value === null) return [];
  return collectTokenReferences(typeof value === 'string' ? value : JSON.stringify(value));
}
