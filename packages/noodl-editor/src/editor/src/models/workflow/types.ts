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
  | 'wait-until';

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
  /**
   * The param is a DSL structure (a condition, a filter, `switch.cases`), not a
   * value: its operands use the value language but the executor evaluates them
   * when the step runs. WFA-003 marks these so a property editor renders its own
   * editor rather than a value/binding control.
   */
  raw?: boolean;
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

/** The body of `GET /admin/workflow-step-kinds`. */
export interface StepKindCatalog {
  version: string;
  source: string;
  docs: string;
  kinds: StepKindSpec[];
  valueLanguage: ValueLanguageSpec;
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
