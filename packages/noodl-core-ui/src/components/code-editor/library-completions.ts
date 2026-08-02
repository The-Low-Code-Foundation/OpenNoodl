/**
 * ERG-002 §2, finding #4 — "the code editors don't know [about a registered
 * library]. A Function or Script node referencing the global gets no
 * completion and no validation."
 *
 * This is the completion half of that: a factory that turns the Libraries
 * settings section's registered libraries (name + global — see
 * `RegisteredLibrary` in `noodl-editor/src/shared/utils/projectmodules.ts`)
 * into a CodeMirror completion source shaped exactly like
 * `noodlCompletionSource` in `./noodl-completions.ts`, so it can be registered
 * the same way (`javascriptLanguage.data.of({ autocomplete })`) beside it.
 *
 * NOT WIRED IN. Registering it means editing `codemirror-extensions.ts`
 * (which builds the extension list `JavaScriptEditor.tsx` passes to
 * CodeMirror) and threading the open project's registered libraries down to
 * that call — both outside this task's territory (`noodl-core-ui` is
 * "new components only" for ERG-002; the actual call site is an existing
 * file). This file exists so that follow-on wiring is "call this and pass it
 * to `.of(...)`", not "design the completion logic from scratch".
 *
 * `dev-docs/reference/REUSING-CODE-EDITORS.md` describes a Monaco-based editor
 * with `addExtraLib`-style ambient declarations; neither exists in the current
 * CodeMirror 6 implementation (see ERG-002-NOTES.md — that doc is stale). This
 * factory's shape (label/type/info triples, filtered by prefix) is the actual
 * completion mechanism this codebase has today.
 *
 * @module code-editor
 */

import { CompletionContext, CompletionResult } from '@codemirror/autocomplete';

/** The shape `AuthoringContextBuilder`'s `RegisteredLibraryInfo` and `projectmodules.ts`'s `RegisteredLibrary` both satisfy. */
export interface LibraryCompletionSource {
  /** Display name, used in the completion's `info` text. */
  name: string;
  /** The window-attached global this library defines — the thing being completed. */
  global: string;
}

/**
 * Build a completion source for a project's registered libraries. Filters to
 * entries with a non-empty `global` (an unverified/mid-edit library in the
 * settings form has none yet, and offering to complete an empty string would
 * match everything).
 */
export function createLibraryCompletionSource(
  libraries: readonly LibraryCompletionSource[]
): (context: CompletionContext) => CompletionResult | null {
  const options = libraries
    .filter((lib) => lib.global && lib.global.trim())
    .map((lib) => ({
      label: lib.global,
      type: 'namespace' as const,
      info: `${lib.name} — registered in Settings → Libraries.`
    }));

  return function libraryCompletionSource(context: CompletionContext): CompletionResult | null {
    if (options.length === 0) return null;

    // `\w*` (zero-or-more, matching `noodlCompletionSource`'s own convention)
    // rather than requiring a leading char — an explicit request (Ctrl+Space)
    // at an empty position should still list what's available.
    const word = context.matchBefore(/\w*/);
    if (!word) return null;
    if (word.from === word.to && !context.explicit) return null;

    const filtered = options.filter((o) => o.label.toLowerCase().startsWith(word.text.toLowerCase()));
    if (filtered.length === 0) return null;

    return { from: word.from, options: filtered };
  };
}
