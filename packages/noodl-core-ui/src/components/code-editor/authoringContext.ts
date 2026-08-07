/**
 * What the code editor knows about the open project.
 *
 * FH-019 slice 1. Everything the completion sources could offer used to be
 * typed into `noodl-completions.ts` as string literals, because there was no
 * way to get project knowledge into `noodl-core-ui` at all — which is also why
 * `library-completions.ts` sat built-but-unreachable from ERG-002 until now.
 *
 * ## Why a registry and not a prop
 *
 * FH-019's own plan was an `authoringContext` prop threaded through
 * `JavaScriptEditor` → `createExtensions` → a `Compartment`. Three things say
 * otherwise, and the third is decisive:
 *
 * 1. **The popout mounts once.** `JavaScriptEditor`'s CodeMirror effect is
 *    `[]`-deps by design, so a prop that changes cannot reach a live editor
 *    without a `Compartment` reconfigure — machinery whose only purpose would
 *    be to re-deliver a value the source could simply have read when asked.
 * 2. **A completion source is already a function called per keystroke.**
 *    Reading the context at *call* time is not a cache that can go stale;
 *    there is nothing to invalidate and nothing to reconfigure.
 * 3. **There are four call sites, and criterion 5 is that they behave
 *    identically.** A prop makes that a promise maintained by hand at four
 *    places, one of which (`AiChat.tsx`) constructs the editor through
 *    `React.createElement` with a literal props object. A registry makes it
 *    true by construction — a fifth call site added tomorrow is correct
 *    without being told.
 *
 * The editor pushes into this from `models/CodeAuthoringContext` at boot, the
 * same seam and for the same reason as `ProjectDocs/install.ts`: the popout is
 * constructed long after the project opens, and a panel-mounted subscription
 * would mean the first editor opened after a project change sees nothing.
 *
 * `noodl-core-ui` owns no project model and imports none. The shapes here are
 * plain data the editor fills in.
 *
 * @module code-editor
 */

/** A registered library, as far as completion is concerned. */
export interface AuthoringLibrary {
  /** Display name, used in the completion's `info` text. */
  name: string;
  /** The window-attached global this library defines — the thing being completed. */
  global: string;
}

/**
 * The project surface the code editor completes against.
 *
 * Deliberately not the whole project: this is what a *name* can be completed
 * from. Types and checking are FH-019 slice 3, which is deferred — see
 * `dev-docs/tasks/phase-42-first-hour/FH-019-TYPED-INTELLISENSE.md`.
 */
export interface CodeAuthoringContext {
  /** Libraries registered in Settings → Libraries that declare a global. */
  readonly libraries: readonly AuthoringLibrary[];
  /**
   * Every name used as a variable anywhere in the project — what
   * `Noodl.Variables.` and an Expression's `Variables.` complete to.
   */
  readonly variables: readonly string[];
  /** Ids used with `Noodl.Objects.` / an Expression's `Objects.`. */
  readonly objects: readonly string[];
  /** Ids used with `Noodl.Arrays.` / an Expression's `Arrays.`. */
  readonly arrays: readonly string[];
}

/**
 * What every editor sees before anyone has said otherwise — a Storybook story,
 * a unit test, and the real editor between boot and the first project open.
 *
 * Empty rather than illustrative on purpose: a completion list containing
 * example names would be a lie about the open project, which is the exact
 * failure this task exists to end.
 */
export const EMPTY_AUTHORING_CONTEXT: CodeAuthoringContext = {
  libraries: [],
  variables: [],
  objects: [],
  arrays: []
};

let current: CodeAuthoringContext = EMPTY_AUTHORING_CONTEXT;

/**
 * Publish what the code editor knows. Called by the editor when the project
 * changes; passing `null` (a project closing) restores the empty surface.
 */
export function setCodeAuthoringContext(next: CodeAuthoringContext | null): void {
  current = next ?? EMPTY_AUTHORING_CONTEXT;
}

/** Read the current surface. Cheap — call it per completion, not per mount. */
export function getCodeAuthoringContext(): CodeAuthoringContext {
  return current;
}
