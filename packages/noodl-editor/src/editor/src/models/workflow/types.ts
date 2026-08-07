/**
 * The wire types the workflow canvas speaks (WFA-004).
 *
 * These mirror `nodegx-backend/src/workflow/types.ts` and
 * `workflow/steps/kinds.ts` STRUCTURALLY rather than by import: `nodegx-backend`
 * is a separate package with its own build, and the editor's typecheck does not
 * carry a path alias to it (WFA-002 hit exactly this and typed structurally for
 * the same reason). They describe a JSON payload that arrives over IPC, which is
 * the right thing to declare locally anyway — a wire format, not a shared class.
 *
 * The pairing is gated by a test that asserts these shapes against a running
 * backend's own `GET /admin/workflow-step-kinds`, in the pattern WF-003's
 * `deploy-assets.test.ts` established, so drift is caught rather than assumed
 * away.
 *
 * @module models/workflow/types
 */

/** Every step kind the WF-001 engine implements. */
export type StepKind =
  | 'call-function'
  | 'branch'
  | 'switch'
  | 'for-each'
  | 'merge'
  | 'stop'
  | 'wait'
  | 'wait-until'
  /** CWF-002: sets what the run answers with, and ends its path. */
  | 'return'
  /** CWF-004: builds a new object out of the run's data, with no code. */
  | 'transform'
  /** CWF-004 slice 2 — the rest of the declarative data family. */
  | 'validate'
  | 'filter'
  | 'sort'
  | 'deduplicate'
  | 'split';

/** A param's declared type, which is what picks a property-editor control. */
export type StepParamType =
  | 'string'
  | 'number'
  | 'boolean'
  | 'enum'
  | 'array'
  | 'object'
  | 'condition'
  | 'path'
  | 'any';

export interface StepParamSpec {
  name: string;
  type: StepParamType;
  required?: boolean;
  default?: unknown;
  enums?: string[];
  description: string;
  /** The row label. Falls back to `name` — see CWF-005's `maxAttempts`. */
  displayName?: string;
  /** The property-panel section this param belongs in. Defaults to `Params`. */
  group?: string;
  /**
   * A bespoke control this param wants, when the control for its `type` will not
   * do. A name this editor does not recognise falls back to the type's control,
   * which is what lets a NEWER backend name a control an OLDER editor has never
   * heard of without breaking the row.
   */
  control?: string;
  /**
   * The param is a DSL structure (a condition, a filter, `switch.cases`), not a
   * value: its operands use the value language but the executor evaluates them
   * when the step runs. WFA-003 marks these so a property editor renders its own
   * editor rather than a value/binding control.
   */
  raw?: boolean;
}

/**
 * CWF-001: a kind that also takes params the AUTHOR names.
 *
 * The engine has merged a step's params into its input by name since WFA-003;
 * this is the declaration that finally gives the canvas a row to author them in.
 * Present from catalog 1.3.0 — absent from an older backend, in which case no
 * mapping row appears and the definitions that already carry one still run.
 */
export interface StepParamMappingSpec {
  displayName: string;
  description: string;
  /** Names the backend REFUSES — the value would be discarded. */
  reserved: string[];
  /** Names that are legal but replace part of the run payload for the function. */
  shadows: string[];
}

export interface StepRouteSpec {
  name: string;
  description: string;
  /** Route names derived from a param — `switch`'s case labels. */
  dynamic?: boolean;
}

export interface StepKindSpec {
  kind: StepKind;
  displayName: string;
  category: string;
  source: string;
  summary: string;
  whenToUse: string;
  /** True when the step invokes a cloud function, and so needs `ref`. */
  invokesFunction: boolean;
  params: StepParamSpec[];
  /** CWF-001: present when the kind also takes author-named params. */
  paramMapping?: StepParamMappingSpec;
  routes: StepRouteSpec[];
  output: string;
  clientEquivalent?: string;
  notes?: string[];
}

/** WFA-003's description of how a param value may reference the run's data. */
export interface ValueLanguageSpec {
  version?: string;
  summary?: string;
  [key: string]: unknown;
}

/** One comparison operator, as the backend describes it. */
export interface ConditionOpSpec {
  name: string;
  label: string;
  /** Takes no right-hand operand — `exists`, `truthy`, `empty`, … */
  unary: boolean;
  /** Accepts regex flags — `matches` only. */
  takesFlags?: boolean;
}

/**
 * The closed operator set, served rather than bundled.
 *
 * The editor renders a condition as three controls precisely because the set is
 * closed; holding its own copy of the list would let it offer an operator the
 * target backend cannot evaluate, which is the drift the served registry exists
 * to prevent.
 */
export interface ConditionLanguageSpec {
  ops: ConditionOpSpec[];
  summary: string;
}

/** One transform operation, as the backend describes it (CWF-004). */
export interface TransformOpSpec {
  /** The key an author writes, `$`-prefixed. */
  name: string;
  /** What the picker shows. */
  label: string;
  /**
   * How many operands. `'variadic'` takes a non-empty array of them; a NUMBER
   * takes exactly that many, and `1` takes its operand verbatim rather than
   * wrapped in an array — which is what makes `{"$length": [1,2,3]}` the length
   * of that array and not a botched argument list.
   */
  arity: number | 'variadic';
  /** One label per operand, so a rows editor can name its controls. */
  args: string[];
  description: string;
}

/**
 * The closed operation vocabulary, served rather than bundled — for exactly the
 * reason `conditionLanguage` is. The editor builds its operation picker from
 * this, so removing an op from the backend removes it from the picker with no
 * editor change, and this editor can never offer an operation the target backend
 * cannot perform.
 */
export interface TransformLanguageSpec {
  summary: string;
  ops: TransformOpSpec[];
  notes: string[];
}

/** One type a `validate` path rule may assert, as the backend describes it. */
export interface ValidateTypeSpec {
  name: string;
  /** What the dropdown shows. */
  label: string;
  description: string;
}

/**
 * The closed type vocabulary a `validate` step's path rules may assert
 * (CWF-004 slice 2), served rather than bundled for the reason the other three
 * languages are: removing a type from the backend removes it from the rules
 * editor's dropdown with no editor change.
 */
export interface ValidateLanguageSpec {
  summary: string;
  types: ValidateTypeSpec[];
  ruleForms: { form: string; example: unknown; description: string }[];
  notes: string[];
}

/** The body of `GET /admin/workflow-step-kinds`. */
export interface StepKindCatalog {
  version: string;
  source: string;
  docs: string;
  kinds: StepKindSpec[];
  valueLanguage: ValueLanguageSpec;
  /** Present from catalog 1.2.0 (WFA-004). */
  conditionLanguage?: ConditionLanguageSpec;
  /**
   * CWF-004: the transform step's operation vocabulary. Absent from a pre-1.6.0
   * backend — which also serves no `transform` kind, so there is no card whose
   * picker would be empty.
   */
  transformLanguage?: TransformLanguageSpec;
  /**
   * CWF-004 slice 2: the validate step's type vocabulary. Absent from a
   * pre-1.7.0 backend — which also serves no `validate` kind, so there is no
   * card whose dropdown this could empty.
   */
  validateLanguage?: ValidateLanguageSpec;
  /**
   * CWF-005: kinds this backend no longer serves but still reads and converts,
   * as `{ oldKind: newKind }`. Absent from a pre-1.5.0 backend.
   */
  migratedKinds?: Record<string, string>;
}

/** A comparison, the leaf of a condition. */
export interface Comparison {
  left: unknown;
  op: string;
  right?: unknown;
  flags?: string;
}

export type Condition = Comparison | { all: Condition[] } | { any: Condition[] } | { not: Condition };

export function isComparison(c: unknown): c is Comparison {
  return !!c && typeof c === 'object' && typeof (c as Comparison).op === 'string';
}

export function isGroup(c: unknown): c is { all: Condition[] } | { any: Condition[] } {
  return !!c && typeof c === 'object' && (Array.isArray((c as { all?: unknown[] }).all) || Array.isArray((c as { any?: unknown[] }).any));
}

export interface WorkflowStep {
  /** Unique within the workflow, and the canvas node id (F15). */
  id: string;
  name?: string;
  kind: StepKind;
  /** The cloud function, for the kinds that invoke one. */
  ref?: string;
  params?: Record<string, unknown>;
  timeoutMs?: number;
  next?: string[];
  routes?: Record<string, string[]>;
  onError?: string[];
  /** Editor-owned canvas position. The engine never reads it. */
  ui?: { x: number; y: number };
}

export interface WorkflowDefinition {
  version: 1;
  id: string;
  name?: string;
  entry: string;
  concurrency: number;
  timeoutMs?: number;
  stepTimeoutMs?: number;
  steps: WorkflowStep[];
  createdAt: string;
  updatedAt: string;
}

/** What `PUT /admin/workflow-defs/:id` accepts — timestamps are registry-owned. */
export interface WorkflowInput {
  id?: string;
  name?: string;
  entry: string;
  concurrency?: number;
  timeoutMs?: number;
  stepTimeoutMs?: number;
  steps: WorkflowStep[];
}

/** A workflow definition together with the backend it lives on. */
export interface WorkflowRef {
  backendId: string;
  backendName: string;
  id: string;
  name: string;
  stepCount: number;
}

/**
 * A `{"$path": …}` / `{"$literal": …}` value spec (WFA-003's value language).
 * The canvas reads and writes these; it does not resolve them.
 */
export type ValueSpec = { $path: string } | { $literal: unknown };

export function isPathSpec(v: unknown): v is { $path: string } {
  return !!v && typeof v === 'object' && typeof (v as { $path?: unknown }).$path === 'string';
}

export function isLiteralSpec(v: unknown): v is { $literal: unknown } {
  return !!v && typeof v === 'object' && '$literal' in (v as object);
}
