/**
 * CWF-004 S6 — what "New function from this step" is going to create, worked
 * out before anything is created.
 *
 * The gesture is the deliverable that replaces a free JavaScript step at the
 * workflow level (CWF-004 §"On a free Function step"): *"a free function step
 * IS a one-node cloud function; the honest answer is not to move code up, it is
 * to make reaching down frictionless."* WFA-006 already built the reaching-down
 * half — a step that names a function in this project descends into its graph.
 * What was missing is the half where the function does not exist yet.
 *
 * ## Why the planning is a module of its own
 *
 * Creating the component needs `ProjectModel`, `ComponentTemplates` and the undo
 * queue — a renderer, in other words. **Deciding what to create needs none of
 * that**, and it is the half with the decisions in it: what the function is
 * called, which parameters it declares, and whether the step has to be
 * retargeted at a name it did not ask for. So it lives here, importing only the
 * port vocabulary (`workflowPorts` imports nothing at all), and it is exercised
 * from `tests-unit/` in plain Node rather than from the Electron suite.
 *
 * ## The two facts it works from
 *
 * 1. **`step.ref` is the name the author already typed.** A broken step usually
 *    names the function it wants — that is *why* it is broken — so the gesture
 *    is "create the thing this step is already asking for", with no prompt at
 *    all. A step with no `ref` gets a name derived from its label instead.
 * 2. **A step's undeclared params ARE the function's inputs** (CWF-001). They
 *    are merged into the request body by name, so declaring them on the new
 *    function's Request node (CWF-014's `params`) means the author lands in a
 *    graph whose input ports are already the values the step is sending. That
 *    is the whole value of the gesture and it costs one string.
 *
 * @module models/workflow/newFunctionFromStep
 */

import { PORT_PARAM_MAPPING } from './workflowPorts';

/**
 * What a cloud function may be called.
 *
 * A function name is a **URL path segment** — `POST /functions/<name>` — as well
 * as a component's local name and a step's `ref`, so it is held to the narrowest
 * of the three. Deliberately not a validation of what an author may *type* into
 * the `ref` row (that stays free text, WFA-006's decision); it is what this
 * gesture is willing to *mint*.
 */
export const FUNCTION_NAME_RE = /^[A-Za-z_][A-Za-z0-9_-]*$/;

export function isLegalFunctionName(name: string): boolean {
  return FUNCTION_NAME_RE.test(name);
}

/**
 * A readable function name out of arbitrary text — `"Charge card"` → `chargeCard`.
 *
 * Words are anything separated by a character a name may not contain, and they
 * are joined in the lowerCamelCase every cloud function in this repo already
 * uses (`saveOrder`, `chargeCard`). A name that would start with a digit is
 * prefixed rather than dropped, because "3ds" is a perfectly reasonable thing to
 * call a step and losing it silently would be worse than `f3ds`.
 *
 * Answers `''` for text with nothing usable in it, which is the caller's signal
 * to fall back.
 */
export function functionNameFromLabel(label: string): string {
  const words = String(label || '')
    .split(/[^A-Za-z0-9]+/)
    .filter(Boolean);
  if (!words.length) return '';

  const name = words
    .map((word, i) => (i === 0 ? word.charAt(0).toLowerCase() + word.slice(1) : word.charAt(0).toUpperCase() + word.slice(1)))
    .join('');

  return isLegalFunctionName(name) ? name : 'f' + name;
}

/**
 * `base`, `base2`, `base3`… — the convention `WorkflowGraphModel.mintStepId`
 * already uses for step ids, so the two things this feature mints are numbered
 * the same way.
 */
export function uniqueFunctionName(base: string, taken: string[]): string {
  if (!taken.includes(base)) return base;
  let n = 2;
  while (taken.includes(base + n)) n++;
  return base + n;
}

/**
 * Can this parameter name be declared on a Request node at all?
 *
 * CWF-014's declaration list is **comma-separated** (`paramNames` in
 * `requestContract.ts` splits on `,` and does not trim), and the editor's
 * `namedports/list` rule splits it the same way — WFA-009's rule that the two
 * must agree port-for-port. So a step param whose author-chosen key contains a
 * comma cannot be declared, and this gesture reports it rather than writing a
 * `params` string that would mint two ports named after halves of one key.
 *
 * A leading or trailing space is the same problem one step quieter: neither side
 * trims, so ` amount` and `amount` are different ports and only one of them is
 * the key the engine sends.
 */
export function isDeclarableParamName(name: string): boolean {
  return Boolean(name) && !name.includes(',') && name.trim() === name;
}

/** A step, in as much of its shape as this module needs. */
export interface StepShapeForPlan {
  id: string;
  label?: string;
  /** `step.ref` as the node holds it — free text, possibly absent. */
  ref?: unknown;
  parameters?: Record<string, unknown>;
}

export interface FunctionPlan {
  /** The function to create, and what the step will point at afterwards. */
  name: string;
  /** The component to create: `/#__cloud__/<name>` is added by the caller. */
  paramNames: string[];
  /** CWF-014's `params` parameter, verbatim — comma-joined, never spaced. */
  params: string;
  /**
   * True when the step's `ref` is not what the new function is called, so the
   * gesture also retargets the step. Only ever true for a step that resolves to
   * nothing, so nothing that works is rewritten.
   */
  retargets: boolean;
  /** Author-named params that cannot be declared, with the reason above. */
  undeclarable: string[];
}

export interface PlanArgs {
  /** Param names the step's KIND declares — they are the step's knobs, not the function's inputs. */
  declared: string[];
  /** Cloud function names that already exist in the project. */
  existing: string[];
}

/**
 * The author's params — the ones CWF-001's mapping row edits.
 *
 * The same subtraction `WorkflowParamsType.rows` makes, and it has to be: those
 * are the keys the engine merges into the function's request body by name, and
 * anything else on the node is either a knob the kind declared (`maxAttempts`,
 * `items`) or the two step FIELDS (`ref`, and the synthetic mapping port that
 * never stores a value).
 */
export function authorParamNames(parameters: Record<string, unknown> | undefined, declared: string[]): string[] {
  const skip = new Set([...declared, 'ref', PORT_PARAM_MAPPING]);
  return Object.entries(parameters || {})
    .filter(([name, value]) => !skip.has(name) && value !== undefined)
    .map(([name]) => name);
}

/**
 * What the gesture will do, computed from the step alone.
 *
 * Pure and total: every step produces a plan, because there is no state in which
 * "create a function for this step" has no sensible answer — the worst case is a
 * step with no name and no params, which is a function called `callfunction`
 * with no declared inputs, and that is exactly the one-node cloud function the
 * doctrine points at.
 */
export function planFunctionFromStep(step: StepShapeForPlan, args: PlanArgs): FunctionPlan {
  const ref = typeof step.ref === 'string' ? step.ref.trim() : '';

  // The name the author already typed wins, unmodified, when it is one this
  // gesture is willing to mint. Otherwise it is turned into one — and the step
  // is retargeted, which is safe precisely because the caller only offers this
  // for a step that resolves to nothing.
  //
  // Each fallback is tried on its own rather than as `label || id`: a step
  // labelled `***` has a truthy label with nothing usable in it, and folding the
  // two would then skip the id and land on the generic name.
  const wanted =
    (isLegalFunctionName(ref) ? ref : '') ||
    functionNameFromLabel(ref) ||
    functionNameFromLabel(step.label || '') ||
    functionNameFromLabel(step.id) ||
    'newFunction';

  const name = uniqueFunctionName(wanted, args.existing);

  const all = authorParamNames(step.parameters, args.declared);
  const paramNames = all.filter(isDeclarableParamName);

  return {
    name,
    paramNames,
    params: paramNames.join(','),
    retargets: name !== ref,
    undeclarable: all.filter((n) => !isDeclarableParamName(n))
  };
}
