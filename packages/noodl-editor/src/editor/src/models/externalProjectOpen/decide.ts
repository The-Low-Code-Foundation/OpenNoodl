/**
 * HLS-009 — what should happen when something other than a mouse asks this editor to open a
 * project.
 *
 * ## Why the decision is a pure function in its own file
 *
 * The interesting part of `open_in_editor` is not the transport, which is fifteen lines of
 * WebSocket, but the four-way choice below — and three of its four branches are states this
 * editor is *already in* when the request lands. A decision that only exists inside a listener
 * wired to a singleton router can be graded exactly one way: by launching the app and getting it
 * into each state by hand. Two of those states (a different project open with an unsaved edit
 * pending; a request naming a directory that has since been deleted) are precisely the ones a
 * person will not reproduce reliably, so in practice they would be graded by reading the code.
 *
 * Split out, they are four assertions in `tests-unit/`, which runs in plain Node — no Electron,
 * no renderer, no editor singletons. That is the same argument OBS-002 made for the provenance
 * walk, and this file is subject to the same constraint: **it must import nothing.** A single
 * `import` of `ProjectModel` here would move the whole thing back behind a launch.
 *
 * @module models/externalProjectOpen/decide
 */

/**
 * What the editor should do about one request.
 *
 * ⚠️ **`already-open` is a success, not a refusal**, and the distinction is the whole of AC2. An
 * agent that asks twice — because it retried, because two tools both wanted the project visible,
 * because the person asked again — must not get a second copy of the project, must not lose the
 * edit in the debounce window, and must not be told it failed. What it gets is the same answer as
 * the first call and a window brought to the front.
 */
export type OpenDisposition =
  /** Nothing is open. Register the folder, load it, route to the editor. */
  | { action: 'open' }
  /** This exact project is already open. Focus the window and change nothing else. */
  | { action: 'already-open' }
  /** A different project is open. Flush its pending save, return to the projects screen, then open. */
  | { action: 'switch'; leaving: string }
  /** Nothing was done, and the sentence says why in terms the caller can act on. */
  | { action: 'refuse'; reason: string };

export interface OpenRequestFacts {
  /** The `directory` field exactly as it arrived off the relay. Untrusted: any type, or absent. */
  requested: unknown;
  /**
   * The directory of the project this window currently has open, or `undefined` on the projects
   * screen.
   */
  open: string | undefined;
  /** Does `requested` name a directory that exists on disk right now? */
  exists: boolean;
  /** Does it contain a project this editor can open (`nodegx.project.json` or `project.json`)? */
  isProject: boolean;
  /**
   * Whether this platform's filesystem compares paths case-insensitively. Passed in rather than
   * read off `process.platform` so the two behaviours are both reachable from one runner.
   */
  caseInsensitive: boolean;
}

/**
 * Trailing separators and case, normalised for comparison only.
 *
 * ⚠️ **Never used as the path to open.** The value handed to the launcher is the one the caller
 * sent, because a lower-cased path is wrong on every case-sensitive filesystem and this function
 * cannot tell which one it is looking at — `caseInsensitive` says how to *compare*, not how to
 * *spell*. Folding the stored value would eventually write a directory entry nothing can find.
 */
export function comparablePath(value: string, caseInsensitive: boolean): string {
  // A trailing separator is invisible in a tool argument and changes string equality, so
  // `/a/b` and `/a/b/` are the same project asked for twice — which is exactly the retry AC2
  // is about. Both separators, because a Windows caller may send either.
  let end = value.length;
  while (end > 1 && (value[end - 1] === '/' || value[end - 1] === '\\')) end -= 1;
  const trimmed = value.slice(0, end);
  return caseInsensitive ? trimmed.toLowerCase() : trimmed;
}

/**
 * The four-way choice.
 *
 * 🔴 **Refusals are decided here as though nobody is watching**, which is the standing warning of
 * this whole phase: in CI nobody is. So none of them is "ask the user" — each names a condition
 * the caller can test and correct on its own.
 */
export function decideOpenDisposition(facts: OpenRequestFacts): OpenDisposition {
  const { requested, open, exists, isProject, caseInsensitive } = facts;

  if (typeof requested !== 'string' || requested.trim() === '') {
    return { action: 'refuse', reason: 'No directory was given. Pass the absolute path of a project folder.' };
  }

  const directory = requested.trim();

  // ⚠️ Checked before existence, because a relative path resolves against *the editor's* working
  // directory — which on a packaged macOS app is `/`. It would therefore usually fail the
  // existence check too, and report "no such directory" about a path the caller never named.
  // A wrong sentence about a real problem is the harder bug to find.
  const isAbsolute = directory.startsWith('/') || /^[A-Za-z]:[\\/]/.test(directory) || directory.startsWith('\\\\');
  if (!isAbsolute) {
    return {
      action: 'refuse',
      reason: `"${directory}" is a relative path. It would be resolved against the editor's working directory, not yours — pass an absolute path.`
    };
  }

  if (!exists) {
    return { action: 'refuse', reason: `There is no directory at "${directory}".` };
  }

  if (!isProject) {
    return {
      action: 'refuse',
      reason: `"${directory}" exists but is not a NodeGX project — it has no nodegx.project.json and no project.json.`
    };
  }

  if (open !== undefined && comparablePath(open, caseInsensitive) === comparablePath(directory, caseInsensitive)) {
    return { action: 'already-open' };
  }

  if (open !== undefined) {
    return { action: 'switch', leaving: open };
  }

  return { action: 'open' };
}
