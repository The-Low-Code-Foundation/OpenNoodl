/**
 * AIX-011 — Project-scope authoring: the plan model
 *
 * A plan is an ordered list of operations — create a component, update a
 * component, or update a project doc — each carrying an *intent* (one or two
 * sentences) and no graph content. It is produced before any authoring
 * happens, shown to the user, and editable; authoring fans each component
 * operation out through the existing single-component loop.
 *
 * This module is deliberately pure and Electron-free: it is the ONE plan
 * model, shared verbatim by the editor orchestrator (`PlanRun`) and the MCP
 * server's plan tools (`noodl-mcp/src/tools/planTools.ts` imports it by
 * relative path, the same pattern as `editor-deps.ts`). Two orchestrators,
 * one vocabulary — the drift risk the spec names is closed structurally.
 *
 * Dependency closure lives here too, one level up from AIX-003's per-change
 * closure: an operation whose staged files instantiate a component another
 * operation creates *requires* that operation. `planExcludedWith` /
 * `planRequiredWith` mirror `excludedWith`/`requiredWith` so an invalid
 * partial apply (keep "Cart links to Checkout", drop "create Checkout") is
 * unrepresentable at the plan level for the same reason it is at the change
 * level.
 *
 * @module AiAssistant/authoring/plan
 */

import { isComponentRef } from '../../../validation/model';
import type { GraphComponent, GraphNode } from '../explain/types';
import { pathToLegacyName } from './candidate';
import type { ComponentFiles } from './types';

/**
 * What one plan operation does. Deletion is deliberately absent — the
 * destructive case deserves its own thinking (spec: out of scope) — and the
 * UI says so rather than silently lacking it.
 */
export type PlanOperationKind = 'create' | 'update' | 'doc';

export interface PlanOperation {
  /** Stable within the plan; assigned when the plan is built ("op-1"…). */
  id: string;
  kind: PlanOperationKind;
  /**
   * What the operation touches: a component path ("Pages/Checkout") for
   * create/update, a doc path ("docs/ARCHITECTURE.md") for doc operations.
   */
  target: string;
  /**
   * One or two sentences of intent. This is what sibling operations' sessions
   * see (never each other's graphs), and what the user edits the plan by.
   */
  intent: string;
}

export interface AuthoringPlan {
  /** The user's project-scope request, verbatim. */
  request: string;
  /** In authoring order once `orderPlanOperations` has run. */
  operations: PlanOperation[];
}

// ── Plan validation ───────────────────────────────────────────────────────────

export interface PlanValidationInput {
  /**
   * Legacy names ("/Pages/Home") of the components the project has today.
   * Both editor (ExplainGraph) and MCP (registry) can produce this cheaply.
   */
  existingComponents: ReadonlySet<string>;
}

/**
 * Everything wrong with a plan, phrased for the agent (or MCP caller) to act
 * on. Empty means the plan is executable. This runs at plan time — a plan
 * whose operations cannot work is rejected before a single authoring token is
 * spent, not discovered mid-run.
 */
export function validatePlan(plan: AuthoringPlan, input: PlanValidationInput): string[] {
  const errors: string[] = [];
  if (plan.operations.length === 0) errors.push('The plan has no operations.');

  const componentTargets = new Set<string>();
  for (const op of plan.operations) {
    if (!op.target.trim()) {
      errors.push(`Operation ${op.id} has no target.`);
      continue;
    }
    if (!op.intent.trim()) {
      errors.push(`Operation ${op.id} (${op.kind} ${op.target}) has no intent — say what it should do.`);
    }
    if (op.kind === 'doc') continue;

    const legacyName = pathToLegacyName(op.target);
    if (componentTargets.has(legacyName)) {
      errors.push(
        `Component "${op.target}" appears in more than one operation — fold the intents into one ${
          input.existingComponents.has(legacyName) ? 'update' : 'create'
        }.`
      );
    }
    componentTargets.add(legacyName);

    if (op.kind === 'create' && input.existingComponents.has(legacyName)) {
      errors.push(`Operation ${op.id} creates "${op.target}", but that component already exists — use an update.`);
    }
    if (op.kind === 'update' && !input.existingComponents.has(legacyName)) {
      errors.push(
        `Operation ${op.id} updates "${op.target}", but no such component exists and no operation creates it — ` +
          'use a create, or fix the name.'
      );
    }
  }
  return errors;
}

/**
 * Authoring order: creates first (in plan order), then updates, then docs.
 *
 * This is the ordering fact the spec asks to settle: an update may instantiate
 * a component a create produces, so every create's candidate must exist —
 * staged, not applied — before any update authors. Intents are prose, so
 * "which update references which create" is not parseable at plan time;
 * creates-first makes every legal reference orderable without parsing, and
 * `validatePlan` has already rejected the plans that could not be
 * (an update of a component nothing provides). Docs go last: they record what
 * the plan did.
 */
export function orderPlanOperations(operations: readonly PlanOperation[]): PlanOperation[] {
  const rank: Record<PlanOperationKind, number> = { create: 0, update: 1, doc: 2 };
  return [...operations].sort((a, b) => rank[a.kind] - rank[b.kind]);
}

// ── Cross-operation dependencies ──────────────────────────────────────────────

/** Legacy names of the components a candidate's nodes instantiate. */
export function componentRefTargets(files: ComponentFiles): Set<string> {
  const targets = new Set<string>();
  for (const node of files.nodes.nodes) {
    if (typeof node.type === 'string' && isComponentRef(node.type)) targets.add(node.type);
  }
  return targets;
}

/** An operation with its staged candidate, once authoring has produced one. */
export interface StagedOperationLike {
  operation: PlanOperation;
  files?: ComponentFiles;
}

/**
 * Operation-level `requires`: op B requires op A when A creates a component
 * that B's staged files instantiate. The same shape as a `ReviewChange`'s
 * `requires`, one level up — and consumed by the same closure algorithms.
 */
export function planOperationRequires(staged: readonly StagedOperationLike[]): Map<string, string[]> {
  const createOf = new Map<string, string>();
  for (const { operation } of staged) {
    if (operation.kind === 'create') createOf.set(pathToLegacyName(operation.target), operation.id);
  }
  const requires = new Map<string, string[]>();
  for (const { operation, files } of staged) {
    const needs = new Set<string>();
    if (files) {
      for (const ref of componentRefTargets(files)) {
        const provider = createOf.get(ref);
        if (provider && provider !== operation.id) needs.add(provider);
      }
    }
    requires.set(operation.id, [...needs]);
  }
  return requires;
}

/** Everything that must also be kept when `ids` are kept. Includes `ids`. */
export function planRequiredWith(requires: Map<string, string[]>, ids: Iterable<string>): Set<string> {
  const closed = new Set<string>();
  const queue = [...ids];
  while (queue.length > 0) {
    const id = queue.pop();
    if (id === undefined || closed.has(id)) continue;
    closed.add(id);
    for (const required of requires.get(id) ?? []) queue.push(required);
  }
  return closed;
}

/** Everything that must also be dropped when `ids` are dropped. Includes `ids`. */
export function planExcludedWith(requires: Map<string, string[]>, ids: Iterable<string>): Set<string> {
  const dependents = new Map<string, string[]>();
  for (const [id, needs] of requires) {
    for (const required of needs) {
      const list = dependents.get(required) ?? [];
      list.push(id);
      dependents.set(required, list);
    }
  }
  const closed = new Set<string>();
  const queue = [...ids];
  while (queue.length > 0) {
    const id = queue.pop();
    if (id === undefined || closed.has(id)) continue;
    closed.add(id);
    for (const dependent of dependents.get(id) ?? []) queue.push(dependent);
  }
  return closed;
}

// ── Sibling context ───────────────────────────────────────────────────────────

/**
 * The plan as one operation's session sees it: every sibling's kind, target
 * and *intent* — never a graph. This is the §2 shared-context contract: the
 * intent is what stops two pages inventing two names for one route, and the
 * budget could not carry graphs anyway.
 */
export function renderPlanContext(plan: AuthoringPlan, currentOpId: string): string {
  const lines = [
    'This task is one operation of a coordinated plan. The full plan (you are building the ➤ one):',
    ''
  ];
  plan.operations.forEach((op, index) => {
    const marker = op.id === currentOpId ? '➤' : ' ';
    lines.push(`${marker} ${index + 1}. ${op.kind}  ${op.target} — ${op.intent}`);
  });
  lines.push(
    '',
    'Operations listed before yours are already authored: components they create exist in the project',
    'overview and can be instantiated by name. Keep names, routes and events consistent with the sibling',
    'intents above — they are the contract between operations.'
  );
  return lines.join('\n');
}

/**
 * What the plan actually produced, as the doc-authoring turn sees it.
 *
 * The difference from `renderPlanContext` is tense and truth: the plan context
 * is what the plan *intends*, handed to an operation before it runs; this is
 * what the fan-out *achieved*, handed to the doc turn after every component has
 * been authored. A doc that records a component the plan failed to build is
 * worse than no doc, so failures are stated rather than omitted.
 *
 * Node counts are here on purpose and stop here: they tell the doc turn how
 * substantial a piece of work was, and the prompt (and `docLint`) forbid them
 * appearing in the prose it writes.
 */
export interface PlanOutcomeEntry {
  operation: PlanOperation;
  built: boolean;
  nodeCount?: number;
  /** Why it was not built, when it wasn't. */
  note?: string;
}

export function renderPlanOutcome(entries: readonly PlanOutcomeEntry[]): string {
  const components = entries.filter((e) => e.operation.kind !== 'doc');
  if (components.length === 0) {
    return 'This plan changed no components — it is a documentation-only change.';
  }
  const lines = ['What the plan built:', ''];
  for (const entry of components) {
    const { operation } = entry;
    const size = entry.nodeCount !== undefined ? ` (${entry.nodeCount} nodes)` : '';
    lines.push(
      entry.built
        ? `BUILT — ${operation.kind} ${operation.target}${size}: ${operation.intent}`
        : `NOT BUILT — ${operation.kind} ${operation.target}: ${operation.intent}${
            entry.note ? ` [${entry.note}]` : ''
          }`
    );
  }
  if (components.some((e) => !e.built)) {
    lines.push(
      '',
      'Do not document anything marked NOT BUILT — it does not exist. If the document already describes it,',
      'leave that text alone; it is not yours to correct here.'
    );
  }
  return lines.join('\n');
}

// ── Graph extension ───────────────────────────────────────────────────────────

/**
 * A staged candidate as an `ExplainGraph` component, so operations later in
 * the plan can see — and validate against — what earlier operations authored,
 * while the project itself stays untouched. Mirrors the serialised-project
 * adapter in `explain/graph.ts`, from v2 files instead of legacy JSON.
 */
export function graphComponentFromFiles(legacyName: string, files: ComponentFiles): GraphComponent {
  const childrenOf = new Map<string, string[]>();
  for (const node of files.nodes.nodes) {
    if (node.parent === undefined) continue;
    const siblings = childrenOf.get(node.parent) ?? [];
    siblings.push(node.id);
    childrenOf.set(node.parent, siblings);
  }
  const nodes: GraphNode[] = files.nodes.nodes.map((node) => ({
    id: node.id,
    type: node.type,
    label: typeof node.label === 'string' && node.label ? node.label : undefined,
    parameters: node.parameters ? { ...node.parameters } : {},
    parent: node.parent,
    children: node.children ? [...node.children] : childrenOf.get(node.id) ?? [],
    instancePorts: (node.ports ?? []).map((p) => p.name).filter((n): n is string => typeof n === 'string'),
    comment: undefined
  }));
  return {
    name: legacyName,
    nodes,
    connections: files.connections.connections.map((c) => ({
      fromId: c.fromId,
      fromProperty: c.fromProperty,
      toId: c.toId,
      toProperty: c.toProperty
    }))
  };
}
