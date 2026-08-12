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
 * One port a node declares, as far as writing code about it is concerned.
 *
 * `name` is the **display name** — what a consumer puts between the quotes of
 * `Inputs["…"]`. It never carries the `in-`/`out-` prefix a Function node's
 * internal port names use; see `utils/declaredPorts.ts` for why that prefix
 * never reaches this shape in the first place.
 *
 * `type` is the declared port type as the runtime stores it — one of the
 * `intype-`/`outtype-` enum values (`'string'`, `'number'`, `'boolean'`,
 * `'object'`, `'array'`, `'date'`, `'color'`, …), `'signal'` for an output the
 * author typed as one, or `'*'` where none was chosen. It is carried because a
 * signal output is written `Outputs.Done()` and a value output is written
 * `Outputs.x = `: an inserter that does not know which would silently create
 * the wrong kind of port.
 */
export interface PortFact {
  readonly name: string;
  readonly type: string;
}

/**
 * The node whose code is open, as far as its own ports are concerned (FUN-003).
 *
 * **Declared only.** The ports mined out of the document itself are `minePorts`
 * (`utils/scriptPorts.ts`) and stay there; a consumer that wants everything
 * unions the two. Keeping them apart is what lets a diagnostic say *"you
 * declared this port and have not used it"* — a sentence that needs both lists
 * and is impossible from either alone.
 */
export interface OpenNodeFact {
  /** The graph node's id. */
  readonly nodeId: string;
  /** Its type name, e.g. `JavaScriptFunction` or `Javascript2`. */
  readonly typeName: string;
  /** Declared in the property panel's `scriptInputs` proplist. */
  readonly declaredInputs: readonly PortFact[];
  /** Declared in the property panel's `scriptOutputs` proplist. */
  readonly declaredOutputs: readonly PortFact[];
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
  /**
   * The node whose code editor is open, when one is and when its mode has
   * declared ports at all (FUN-003).
   *
   * ⚠️ Absent is **not** the same as "this node has no ports": a Function node
   * with an empty proplist publishes an `openNode` with two empty lists.
   * Consumers gate on `validationType`, never on emptiness — see
   * `utils/declaredPorts.ts#modeHasDeclaredPorts`.
   */
  readonly openNode?: OpenNodeFact;
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

/**
 * Two slots, not one, and the reason is a live defect rather than tidiness.
 *
 * The project half is republished on a debounce whenever a parameter changes
 * anywhere in the graph (`models/CodeAuthoringContext/install.ts`), which is
 * every few keystrokes in a property field. The node half is written when a
 * code popout opens and cleared when it closes. Held in one object, the first
 * would erase the second while an editor was open, and the second would have to
 * re-supply the whole project surface to write one field.
 *
 * `current` is the composed answer, rebuilt on write rather than on read, so
 * `getCodeAuthoringContext()` stays a field read for the completion sources
 * that call it per keystroke — and returns a stable reference between writes.
 */
let projectHalf: CodeAuthoringContext = EMPTY_AUTHORING_CONTEXT;
let nodeHalf: OpenNodeFact | undefined;
let current: CodeAuthoringContext = EMPTY_AUTHORING_CONTEXT;

function recompose(): void {
  const composed: CodeAuthoringContext = { ...projectHalf };

  // The node slot is owned by whoever opened the editor. A project refresh that
  // happened to carry an `openNode` must not be able to write it, or a debounced
  // republish becomes a second, unsynchronised source of the same field.
  delete (composed as { openNode?: OpenNodeFact }).openNode;

  current = nodeHalf ? { ...composed, openNode: nodeHalf } : composed;
}

/**
 * Publish what the code editor knows about the **project**. Called by the editor
 * when the project changes; passing `null` (a project closing) restores the
 * empty surface. Leaves {@link setOpenNodeContext}'s slot untouched.
 */
export function setCodeAuthoringContext(next: CodeAuthoringContext | null): void {
  projectHalf = next ?? EMPTY_AUTHORING_CONTEXT;
  recompose();
}

/**
 * Publish the node whose code editor just opened, or `null` when it closed
 * (FUN-003).
 *
 * ⚠️ **Clearing is not optional.** Unlike the project half, which is pushed once
 * per project and is merely stale-if-wrong, this slot describes one open editor.
 * Left standing after a popout closes, the next editor opened over a different
 * node answers with the previous node's ports — a live wrong answer, not an
 * empty one, and the thing this seam is most likely to get wrong.
 *
 * Also pass `null` when opening an editor whose mode has no declared ports
 * (`'expression'`, `'json'`, `'text'`, `'css'`, `'html'`): "no ports here"
 * has to overwrite the previous node just as closing does.
 */
export function setOpenNodeContext(next: OpenNodeFact | null): void {
  nodeHalf = next ?? undefined;
  recompose();
}

/** Read the current surface. Cheap — call it per completion, not per mount. */
export function getCodeAuthoringContext(): CodeAuthoringContext {
  return current;
}
