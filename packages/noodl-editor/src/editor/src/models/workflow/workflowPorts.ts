/**
 * The workflow canvas's port and type-name vocabulary (WFA-004), with nothing
 * else attached.
 *
 * These names are the translation table between a workflow *definition* and a
 * *graph*: which node type a step kind is, which port an edge leaves from, and
 * how a route name becomes a port name. Everything that converts in either
 * direction needs them.
 *
 * ## Why this is its own module (WFA-007)
 *
 * They lived in `workflowNodeLibrary.ts`, which imports `CanvasTheme` — so
 * anything reusing them dragged the whole canvas in, and the definition⇄graph
 * conversion could not be exercised outside Electron. WFA-007 needs exactly that
 * conversion in a *pure* form (a proposal is diffed before any canvas is
 * involved, and the diff has to be unit-testable in plain Node).
 *
 * So the vocabulary moved here, **verbatim**, and `workflowNodeLibrary.ts`
 * re-exports every symbol — no call site changed. This file imports nothing at
 * all, and that is the property worth keeping: adding an import here would
 * quietly put the canvas back inside the diff.
 *
 * @module models/workflow/workflowPorts
 */

/** Node type names are namespaced so nothing can collide with a runtime node. */
export const WORKFLOW_TYPE_PREFIX = 'workflow.';

/**
 * WFA-004: the prefix a workflow's canvas adapter is named with.
 *
 * It echoes the `/#__cloud__/` sheet prefix so the runtime type still resolves
 * from the name, but it is NOT a project sheet — nothing named with it is in
 * `ProjectModel`. See WFA-004-ASSESSMENT §1b.
 *
 * It lives here, with the rest of the vocabulary, because WFA-007's proposal
 * diff needs it in a module that pulls no editor in: a review graph MUST carry
 * this prefix or `ViewerConnection` stops filtering its model events.
 * `@noodl-utils/NodeGraph` re-exports it, so every existing import is unchanged.
 */
export const WORKFLOW_NAME_PREFIX = '/#__workflow__/';

/** The one input every step has: "an edge reached me". */
export const PORT_IN = 'in';
/** The unconditional success edge. */
export const PORT_NEXT = 'next';
/** The failure edge. */
export const PORT_ON_ERROR = 'onError';
/** Route output ports are `route:<name>`, so a route can be called `next` safely. */
export const ROUTE_PORT_PREFIX = 'route:';

export function routePortName(route: string): string {
  return ROUTE_PORT_PREFIX + route;
}

export function isRoutePort(portName: string): boolean {
  return portName.startsWith(ROUTE_PORT_PREFIX);
}

export function routeNameFromPort(portName: string): string {
  return portName.slice(ROUTE_PORT_PREFIX.length);
}

/**
 * Trigger node types (WFA-005). Nested INSIDE the workflow prefix on purpose —
 * `kindFromTypeName` checks for this longer prefix first and answers `undefined`,
 * so a trigger node is not a step to any of the code that asks "what kind of
 * step is this?". That matters most in `WorkflowDocument.toInput`, which walks
 * every node on the canvas: without the guard a trigger would be written into
 * the definition as a step of kind `trigger.webhook` and the backend would
 * refuse the save.
 */
export const TRIGGER_TYPE_PREFIX = 'workflow.trigger.';

/** The trigger's one output: "this is where the run starts". */
export const PORT_FIRES = 'fires';

/** A read-only fact about a trigger, shown in the property editor. */
export const PORT_TYPE_TRIGGER_INFO = 'workflow-trigger-info';

/** The cloud function a step calls, with what it resolves to (WFA-006). */
export const PORT_TYPE_FUNCTION_REF = 'workflow-function-ref';

export function typeNameForKind(kind: string): string {
  return WORKFLOW_TYPE_PREFIX + kind;
}

export function triggerTypeName(triggerType: string): string {
  return TRIGGER_TYPE_PREFIX + triggerType;
}

export function isTriggerTypeName(typeName: string): boolean {
  return typeName.startsWith(TRIGGER_TYPE_PREFIX);
}

export function triggerTypeFromTypeName(typeName: string): string | undefined {
  return isTriggerTypeName(typeName) ? typeName.slice(TRIGGER_TYPE_PREFIX.length) : undefined;
}

export function kindFromTypeName(typeName: string): string | undefined {
  // A trigger is not a step kind. Checked first, because its type name also
  // starts with the workflow prefix.
  if (isTriggerTypeName(typeName)) return undefined;
  return typeName.startsWith(WORKFLOW_TYPE_PREFIX) ? typeName.slice(WORKFLOW_TYPE_PREFIX.length) : undefined;
}

/** The port group every route output lands in, so they sort together. */
export const GROUP_ROUTES = 'Routes';
export const GROUP_PARAMS = 'Params';

/** A condition, edited as three controls rather than as JSON (WFA-004 §4). */
export const PORT_TYPE_CONDITION = 'workflow-condition';
/** A `$path` into the run's data, edited with a scope picker (WFA-003). */
export const PORT_TYPE_PATH = 'workflow-path';
/** A param that may be a literal OR a reference. */
export const PORT_TYPE_VALUE = 'workflow-value';
/** `switch`'s case table, which also names its dynamic route ports. */
export const PORT_TYPE_CASES = 'workflow-cases';
/**
 * CWF-001: the param MAPPING — author-chosen names, each holding a value in the
 * same language every other param speaks.
 *
 * It is its own port type rather than an `object` because one-port-per-declared-
 * param cannot express a dictionary whose KEYS the author invents. `switch.cases`
 * set the precedent and this follows it.
 */
export const PORT_TYPE_PARAMS = 'workflow-params';

/**
 * The name of the one SYNTHETIC port on a step card (CWF-001).
 *
 * Every other port is a declared param and its name is a key in the step's
 * `params`. This one is not: the mapping it edits IS the set of params the kind
 * does not declare, so the row writes its siblings and never a parameter of its
 * own. The double underscores are there so that a step's params — which are
 * author-named JSON keys — cannot collide with it, and `toInput` drops it
 * defensively in case anything ever writes one.
 */
export const PORT_PARAM_MAPPING = '__paramMapping__';

/**
 * CWF-005: retry's attempt count, drawn with the delay sequence it implies.
 *
 * `maxAttempts` beside `delayMs`, `backoffMultiplier`, `maxDelayMs` and `jitter`
 * is five numbers you have to do arithmetic on to know what the step will
 * actually do. This row does the arithmetic.
 */
export const PORT_TYPE_BACKOFF = 'workflow-backoff';

/**
 * CWF-004: a `transform` step's `output` — one row per field, each holding a
 * value or one operation from the served vocabulary.
 *
 * Its own port type rather than `object` for the same reason `switch.cases` has
 * one: the thing being edited is a dictionary whose KEYS the author invents, and
 * one-port-per-declared-param cannot express that. Unlike CWF-001's mapping this
 * is a single param's VALUE, so the row writes one parameter and nothing else —
 * no sibling writes, no undo group.
 */
export const PORT_TYPE_TRANSFORM = 'workflow-transform';

/**
 * The `control` name the backend serves for that param (CWF-005's mechanism).
 *
 * Keyed on the served control rather than on `param.name === 'output'`, because
 * "output" is a word the rest of CWF-004's family (Validate, Filter, Sort) will
 * want too — a control keyed on a common param name is a collision waiting to be
 * debugged.
 */
export const CONTROL_TRANSFORM_OUTPUT = 'transform-output';

/**
 * CWF-005: the served `control` names this editor has a bespoke port type for.
 *
 * A name that is not in here falls back to the control for the param's `type` —
 * which is the whole reason `control` is a served string rather than an enum. A
 * backend newer than this editor can name a control it has never heard of and the
 * row still renders something usable.
 */
export const PORT_TYPE_FOR_CONTROL: Record<string, string> = {
  'retry-backoff': PORT_TYPE_BACKOFF,
  [CONTROL_TRANSFORM_OUTPUT]: PORT_TYPE_TRANSFORM
};
