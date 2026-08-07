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
 * Wired in by FH-019 slice 1, after sitting unreachable since it was written.
 * What it was waiting for was a way to get the open project's registered
 * libraries into `noodl-core-ui`; that is `./authoringContext.ts`, and
 * {@link libraryCompletionSource} below reads it per keystroke, so a library
 * registered in Settings completes in an editor that was already open.
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

import { getCodeAuthoringContext, type AuthoringLibrary } from './authoringContext';
import { completesTopLevel } from './utils/completionPosition';

/**
 * The shape `projectmodules.ts`'s `RegisteredLibrary` and the editor-side
 * `AuthoringContextBuilder`'s `RegisteredLibraryInfo` both satisfy. An alias of
 * {@link AuthoringLibrary}, kept for the callers that already name it.
 */
export type LibraryCompletionSource = AuthoringLibrary;

/**
 * Build a completion source over a fixed list of libraries. Filters to entries
 * with a non-empty `global` (an unverified/mid-edit library in the settings
 * form has none yet, and offering to complete an empty string would match
 * everything).
 *
 * {@link libraryCompletionSource} is what the editor registers; this factory is
 * what makes the behaviour testable without a project.
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

  return function boundLibraryCompletionSource(context: CompletionContext): CompletionResult | null {
    if (options.length === 0) return null;

    // `\w*` (zero-or-more, matching `noodlCompletionSource`'s own convention)
    // rather than requiring a leading char — an explicit request (Ctrl+Space)
    // at an empty position should still list what's available. A library's
    // global is a top-level name, so a member position is never ours, explicit
    // or not (FH-017 slice 1 — the twin of `noodl-completions.ts`'s guard).
    const word = context.matchBefore(/\w*/);
    if (!word) return null;
    if (!completesTopLevel(context, word)) return null;

    const filtered = options.filter((o) => o.label.toLowerCase().startsWith(word.text.toLowerCase()));
    if (filtered.length === 0) return null;

    return { from: word.from, options: filtered };
  };
}

/**
 * The source the editor registers: the open project's libraries, read when the
 * completion is asked for rather than when the editor was mounted.
 *
 * Rebuilding the option list per keystroke is deliberate and cheap — a project
 * has a handful of libraries, and the alternative is a cache that is stale for
 * exactly as long as an editor stays open, which for the popout is the whole
 * session.
 */
export function libraryCompletionSource(context: CompletionContext): CompletionResult | null {
  return createLibraryCompletionSource(getCodeAuthoringContext().libraries)(context);
}
