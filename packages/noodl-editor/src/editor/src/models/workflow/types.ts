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
  | 'retry'
  | 'stop'
  | 'wait'
  | 'wait-until'
  /** CWF-002: sets what the run answers with, and ends its path. */
  | 'return';

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

/** The body of `GET /admin/workflow-step-kinds`. */
export interface StepKindCatalog {
  version: string;
  source: string;
  docs: string;
  kinds: StepKindSpec[];
  valueLanguage: ValueLanguageSpec;
  /** Present from catalog 1.2.0 (WFA-004). */
  conditionLanguage?: ConditionLanguageSpec;
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
