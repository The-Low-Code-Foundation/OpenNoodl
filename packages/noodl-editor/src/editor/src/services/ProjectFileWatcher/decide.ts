/**
 * REL-009b — the two pure decisions the file watcher rests on.
 *
 * Both live here, with no imports, for one reason: they are the whole of the
 * watcher's judgement, and everything else in this feature needs Electron, a
 * real filesystem or an editor singleton to run. Keeping them free of all three
 * is what lets them be graded in plain jest rather than only through a drive.
 *
 * @module noodl-editor/services/ProjectFileWatcher/decide
 */

/** Directory names that never contain a component and are noisy. */
const IGNORED_SEGMENTS = new Set([
  '.git',
  'node_modules',
  '.DS_Store',
  '__MACOSX',
  'noodl_modules',
  'build',
  'dist'
]);

/** The three files a v2 component is made of. Anything else in the dir is not ours. */
const COMPONENT_FILES = new Set(['component.json', 'nodes.json', 'connections.json']);

/**
 * Maps a path relative to the project directory onto the registry path of the
 * component it belongs to, or `null` if the path is not part of one.
 *
 * 🔴 The editor's own save is a two-phase `<file>.tmp` write followed by a
 * rename, so a watcher that does not drop `.tmp` sees every one of its own
 * saves twice — once as a half-written staging file that may not even parse.
 * That is the first thing this has to get right (REL-009b AC1).
 *
 *   "components/Pages/Home/nodes.json"      → "Pages/Home"
 *   "components/Header/component.json"      → "Header"
 *   "components/Pages/Home/nodes.json.tmp"  → null
 *   "components/_registry.json"             → null
 *   "nodegx.routes.json"                    → null
 */
export function componentPathFromRelativePath(relativePath: string): string | null {
  if (!relativePath) return null;

  // Normalise Windows separators; the registry path is always "/"-joined.
  const parts = relativePath.replace(/\\/g, '/').split('/').filter(Boolean);
  if (parts.length < 3) return null;
  if (parts[0] !== 'components') return null;

  const file = parts[parts.length - 1];
  if (!COMPONENT_FILES.has(file)) return null;

  const dirSegments = parts.slice(1, -1);
  if (dirSegments.length === 0) return null;
  if (dirSegments.some((s) => IGNORED_SEGMENTS.has(s) || s.startsWith('.'))) return null;

  return dirSegments.join('/');
}

/** What to do about a component whose files just changed on disk. */
export type ReloadDecision =
  /** Swap the disk copy into the project. */
  | { action: 'reload' }
  /** The disk already matches our baseline — this event is our own write coming back. */
  | { action: 'skip-unchanged' }
  /** The human has unsaved edits to this component; reloading would discard them. */
  | { action: 'refuse-dirty' };

/**
 * Decides what a change to one component's files means, from three hashes.
 *
 * - `baselineHash` — what the saver believes is on disk (`ComponentSaver.getDiskHash`).
 *   `undefined` means the saver has never seen this component: it is new on disk.
 * - `inMemoryHash` — the hash of the editor's in-memory copy. `undefined` means the
 *   project does not hold this component, so there is nothing to lose by loading it.
 * - `diskHash` — what was just read off disk.
 *
 * 🔴 **The unchanged check must come before the dirty check, and the order is
 * load-bearing.** After the editor writes a component, the baseline equals the
 * bytes it wrote, and the watcher event for that write arrives afterwards — by
 * which time the human may already have edited the component again. Testing
 * dirtiness first would answer `refuse-dirty` and put a "changed on disk outside
 * the editor" warning in front of a person for a file *the editor itself* just
 * saved. Testing the disk against the baseline first says what actually
 * happened: nothing new is on disk, so there is nothing to apply.
 */
export function decideComponentReload(args: {
  baselineHash: string | undefined;
  inMemoryHash: string | undefined;
  diskHash: string;
}): ReloadDecision {
  const { baselineHash, inMemoryHash, diskHash } = args;

  // Nothing new on disk: our own write echoing back, or a touch that changed no
  // content. Checked first — see the note above.
  if (baselineHash !== undefined && diskHash === baselineHash) {
    return { action: 'skip-unchanged' };
  }

  // We do not hold this component, so a reload cannot discard anything.
  if (inMemoryHash === undefined) {
    return { action: 'reload' };
  }

  // The in-memory copy has moved away from the baseline: the human has unsaved
  // edits. Applying the disk copy would throw them away without saying so —
  // REL-009a arm C wearing its other face, and the two rows must not answer it
  // differently.
  if (inMemoryHash !== baselineHash) {
    return { action: 'refuse-dirty' };
  }

  return { action: 'reload' };
}
