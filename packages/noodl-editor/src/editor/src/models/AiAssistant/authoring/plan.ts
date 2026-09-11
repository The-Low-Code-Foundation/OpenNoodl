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
// LAS-006 — "is this a page" has exactly one derivation in this codebase and
// this is a fourth caller of it, not a fourth copy. See `planAdvisories`.
import { looksLikePageComponent } from '../../../validation/navigation';
import type { GraphComponent, GraphNode } from '../explain/types';
import { pathToLegacyName } from './candidate';
import type { ComponentFiles } from './types';

/**
 * What one plan operation does. Deletion is deliberately absent — the
 * destructive case deserves its own thinking (spec: out of scope) — and the
 * UI says so rather than silently lacking it.
 *
 * AIB-007 adds `provision`: give this project a backend. It is the one kind
 * that authors nothing — see {@link PlanProvisionSpec}.
 */
export type PlanOperationKind = 'create' | 'update' | 'doc' | 'provision';

/**
 * AIB-007 — what a `provision` operation would create.
 *
 * Carried on the operation rather than derived at apply time, for the reason
 * every other operation carries its intent: the plan is a thing a person reads
 * and edits before it runs, and "3 collections, sign-in enabled" is only
 * reviewable if it is *in* the plan.
 *
 * This shape is the scope's `ScopeBackend` minus its prose. It lives here rather
 * than in `scoping/scope.ts` because `scope.ts` imports *this* module, and the
 * plan is the artefact that crosses to `PlanRun`, `planStaging` and the MCP
 * server — the scope does not.
 */
export interface PlanProvisionSpec {
  /** Display name for the backend the apply creates. */
  name: string;
  /**
   * Collections to pre-seed, with the columns the conversation named.
   *
   * ⚠️ Pre-seeding, not a prerequisite. `nodegx-backend` creates a collection on
   * first write, so a collection that fails to create is a **warning on a
   * succeeded provision**, never a failed apply. What creating them up front
   * buys is a Data Browser with something in it and columns with the types the
   * conversation stated rather than the types the first record implies.
   */
  collections: PlanProvisionCollection[];
  /** The conversation agreed people sign in. Drives the auth diagnostic's severity. */
  needsAuth: boolean;
}

export interface PlanProvisionCollection {
  name: string;
  columns: PlanProvisionColumn[];
}

export interface PlanProvisionColumn {
  name: string;
  /** A `nodegx-backend` column type: String, Number, Boolean, Date, Pointer… */
  type: string;
}

/**
 * LAS-006 — one port of a planned component's interface.
 *
 * `type` is free text rather than a catalog port type on purpose: the plan is a
 * contract about *names*, and the name is the half that has to line up. A model
 * that writes `type: "the product's price"` has still told the authoring turn
 * something true; one forced to pick from an enum it has not been shown would
 * have guessed, and a guessed type that then fails a check is a repair round
 * spent on the part that did not matter.
 */
export interface PlanPortDeclaration {
  name: string;
  type?: string;
  description?: string;
}

/** LAS-006 — what a planned component repeats over, when it repeats. */
export interface PlanRepeatSpec {
  /**
   * Where the rows come from: `static` is a `Static Data` node's inline JSON,
   * `query` a backend query, `variable` a Variable/Object, `array` an array
   * arriving on an input.
   */
  source: 'static' | 'query' | 'variable' | 'array';
  /**
   * The fields one row carries. These become the expected inputs of whatever
   * component draws the row — stated here so the authoring turn inherits the
   * contract instead of inventing a second set of names for it.
   */
  rowFields: string[];
}

export interface PlanOperation {
  /** Stable within the plan; assigned when the plan is built ("op-1"…). */
  id: string;
  kind: PlanOperationKind;
  /**
   * What the operation touches: a component path ("Pages/Checkout") for
   * create/update, a doc path ("docs/ARCHITECTURE.md") for doc operations, and
   * the backend's display name for a provision.
   */
  target: string;
  /**
   * One or two sentences of intent. This is what sibling operations' sessions
   * see (never each other's graphs), and what the user edits the plan by.
   */
  intent: string;
  /** Present exactly on `provision` operations. */
  provision?: PlanProvisionSpec;

  // ── LAS-006: the parts of an intent that prose could not carry ─────────────
  //
  // The plan step worked cold on both measured models — haiku's first
  // `create_plan` was a correct nine-operation decomposition. What failed is
  // what an intent *cannot say*: it named no interfaces, so no downstream turn
  // built `Component Inputs`, so every card rendered the literal word "Text".
  // The planning doctrine already asks for interfaces in the intent sentence;
  // nothing read them, because a sentence is not a field. These are.
  //
  // All optional, at the schema and here: an old caller's plan is unchanged,
  // and a two-node fix does not owe anyone a form.

  /** Component Inputs this component will expose. */
  inputs?: PlanPortDeclaration[];
  /** Signals and values it reports upward, through Component Outputs. */
  outputs?: PlanPortDeclaration[];
  /** Present when this component draws a row per item. */
  repeats?: PlanRepeatSpec;
  /** Component targets this one will place — paths or legacy names. */
  instantiates?: string[];
}

/** The row sources {@link PlanRepeatSpec} accepts, as an enum both clients render. */
export const PLAN_REPEAT_SOURCES = ['static', 'query', 'variable', 'array'] as const;

/**
 * LAS-006 — how the structured fields are described to a model, written once.
 *
 * The editor renders these into `submit_plan`'s JSON Schema and `noodl-mcp` into
 * `create_plan`'s zod shape. Two schema *dialects* are unavoidable (the clients
 * speak different tool protocols); two sets of *words* are not, and the words
 * are the part that decides whether a model fills the field. Same rule as
 * `decomposition.ts` and the AAQ-005 vocabulary table.
 */
export const PLAN_STRUCTURE_DESCRIPTIONS = {
  inputs:
    'The Component Inputs this component will expose — the names instances of it will set. Declare these ' +
    'for anything another component places: a card, a row, a section that varies. Omitting them is the ' +
    'single most common way an AI-built page renders identical placeholder chrome.',
  outputs: 'Signals and values this component reports upward, through Component Outputs (e.g. "addToCart").',
  repeats:
    'Present when this component draws one row per item. `rowFields` are the fields one row carries; they ' +
    'become the required inputs of whichever component draws the row.',
  instantiates: 'Components this one will place, by path ("Components/ProductCard"). Each must exist or be created by this plan.',
  portName: 'The port name, exactly as the instance will set it',
  portType: 'What kind of value it carries ("string", "number", "an image URL") — free text, names are what bind',
  portDescription: 'What the value means, one clause',
  repeatSource: 'Where the rows come from: static (a Static Data node\'s inline JSON), query (a backend query), variable, or array (arriving on an input)',
  repeatRowFields: 'The fields one row carries, e.g. ["name", "price", "image"]'
} as const;

export interface AuthoringPlan {
  /** The user's project-scope request, verbatim. */
  request: string;
  /** In authoring order once `orderPlanOperations` has run. */
  operations: PlanOperation[];
  /**
   * AAQ-003 — how the app this plan builds scrolls: `'page'` (the browser
   * scrolls) or `'app'` (a fixed shell with its own scrolling regions).
   *
   * Carried on the plan rather than decided at apply for the same reason
   * `provision` is: it is a project-level side effect a person should be able to
   * read before approving it. Present only on a plan derived from an agreed
   * scope — a plan the Build panel produced for an existing project says nothing
   * about scrolling, and an apply must therefore change nothing.
   */
  scroll?: 'page' | 'app';
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
  let provisions = 0;
  for (const op of plan.operations) {
    if (!op.target.trim()) {
      errors.push(`Operation ${op.id} has no target.`);
      continue;
    }
    if (!op.intent.trim()) {
      errors.push(`Operation ${op.id} (${op.kind} ${op.target}) has no intent — say what it should do.`);
    }
    if (op.kind === 'provision') {
      // AIB-007. Both checks are here rather than at apply for the reason the
      // whole function is: a plan that cannot work should cost nothing to
      // discover. A second provision is rejected rather than folded, because
      // "which of these two is the project's backend" is a question the plan has
      // no way to answer and the apply would answer by whichever ran last.
      provisions += 1;
      if (provisions > 1) {
        errors.push(
          `Operation ${op.id} is a second "provision" — a project has one backend, so fold them into one operation.`
        );
      }
      if (!op.provision) {
        errors.push(`Operation ${op.id} provisions a backend but says nothing about what it would create.`);
      }
      continue;
    }
    if (op.provision) {
      errors.push(`Operation ${op.id} is a ${op.kind}, so it cannot carry a backend to provision.`);
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

  errors.push(...structuredFieldErrors(plan, input, componentTargets));
  return errors;
}

/**
 * LAS-006 — the structured fields, checked only where they are present.
 *
 * Two classes of problem, and both are cheap here for the reason the rest of
 * `validatePlan` is: a plan that cannot work should cost nothing to discover.
 *
 *  - A structured field on an operation that cannot carry one (a `doc` has no
 *    interface; a `provision` is not a component). The same refusal shape the
 *    misplaced `provision` spec already gets.
 *  - An `instantiates` naming a component that neither exists nor is created by
 *    this plan. That is exactly the `update`-of-a-nonexistent-component error
 *    one level up: the plan states a dependency nothing satisfies, so it is not
 *    executable as written. Note the asymmetry with the *staged* check — a
 *    candidate may instantiate more than the plan declared (the plan is a floor,
 *    §3), but everything it declares must resolve.
 */
function structuredFieldErrors(
  plan: AuthoringPlan,
  input: PlanValidationInput,
  componentTargets: ReadonlySet<string>
): string[] {
  const errors: string[] = [];
  for (const op of plan.operations) {
    const declared = op.inputs || op.outputs || op.repeats || op.instantiates;
    if (op.kind === 'doc' || op.kind === 'provision') {
      if (declared) {
        errors.push(
          `Operation ${op.id} is a ${op.kind}, so it cannot declare inputs, outputs, repeats or instantiates.`
        );
      }
      continue;
    }

    for (const [field, ports] of [
      ['inputs', op.inputs],
      ['outputs', op.outputs]
    ] as const) {
      if (!ports) continue;
      const seen = new Set<string>();
      for (const port of ports) {
        const name = typeof port?.name === 'string' ? port.name.trim() : '';
        if (!name) {
          errors.push(`Operation ${op.id} declares an unnamed ${field.replace(/s$/, '')} — every port needs a name.`);
          continue;
        }
        if (seen.has(name)) {
          errors.push(`Operation ${op.id} declares "${name}" twice in ${field}.`);
        }
        seen.add(name);
      }
    }

    if (op.repeats && op.repeats.rowFields.length === 0) {
      errors.push(
        `Operation ${op.id} says it repeats but names no rowFields — say what one row carries, or drop "repeats".`
      );
    }

    for (const target of op.instantiates ?? []) {
      const name = pathToLegacyName(String(target).trim());
      if (componentTargets.has(name) || input.existingComponents.has(name)) continue;
      errors.push(
        `Operation ${op.id} says it instantiates "${target}", but no such component exists and no operation ` +
          'creates it — add the create, or fix the name.'
      );
    }
  }
  return errors;
}

/**
 * LAS-006 — what is *worth saying* about a plan that is nonetheless executable.
 *
 * Advisories, not errors: the audit's finding was that hard rejections carrying
 * a suggestion get obeyed and prose gets dropped, but the thing being asked for
 * here — "declare the interface before you draw" — is a judgement about a plan
 * that is perfectly legal without it. A refusal would make `create_plan`
 * unusable for the two-node fix the primitive-only decision explicitly protects.
 * So these are returned alongside the accepted plan, and LAS-011 measures
 * whether that was enough before anything harder is considered.
 */
export interface PlanAdvisory {
  /** The operation it is about; absent for advice about the plan as a whole. */
  operation?: string;
  message: string;
}

/**
 * The advisory predicate, and the one thing in LAS-006 the corpus overturned.
 *
 * The task file proposed keying this on a path prefix — a `create` under
 * `Components/`, `Cards/` or `Sections/`. Measured over both corpora
 * (`measurements/scan-component-paths.js`, 2026-08-08: 107 legacy + 12 v2
 * projects, 613 components), those three folders hold **16 of the 256**
 * components that declare an interface. The other 240 live in "UI Components",
 * "Product Details Page", "Search", "Checkout", "Time Slot Picker" and 30-odd
 * other ad-hoc folders, and 27 of them sit at the project root with no folder at
 * all. A prefix allowlist would have been silent on 94% of the population it was
 * written for.
 *
 * What the same scan does separate cleanly is *shape*:
 *
 *  - **0 of 51** page components declare an input. A page is navigated to, never
 *    instantiated, so it has nothing to receive.
 *  - **178 of 236 (75%)** non-page components that something instantiates
 *    declare at least one.
 *
 * So the predicate is "is this a page", which the project already answers in one
 * place — {@link looksLikePageComponent}, the same function the write gate and
 * both plan gates use to decide `isRoutedPage`. A fourth derivation of "is this a
 * page" is the class of duplication this codebase has already paid for twice.
 */
export function planAdvisories(plan: AuthoringPlan): PlanAdvisory[] {
  const advisories: PlanAdvisory[] = [];
  const isPageTarget = (target: string) => looksLikePageComponent(pathToLegacyName(target));
  const componentOps = plan.operations.filter((op) => op.kind === 'create' || op.kind === 'update');

  // The whole-plan one, first: a plan that is a single page is the flat-graph
  // failure restated as a plan. README candidate 3's cheap form — the static
  // critic's one-liner; the LLM critic stays dead per the audit verdict.
  if (componentOps.length === 1 && componentOps[0].kind === 'create' && isPageTarget(componentOps[0].target)) {
    advisories.push({
      operation: componentOps[0].id,
      message:
        `This plan is one page and nothing else. A page built in one operation is a page built top-to-bottom, ` +
        'which is how the 66-node graph happens: plan its sections as their own create operations and let the ' +
        'page instantiate them.'
    });
  }

  for (const op of plan.operations) {
    if (op.kind !== 'create') continue;
    if (isPageTarget(op.target)) continue;
    if (op.inputs?.length || op.outputs?.length || op.repeats) continue;
    advisories.push({
      operation: op.id,
      message:
        `${op.target} is not a page, so something will instantiate it — but the operation declares no inputs, ` +
        'no outputs and no repeats. An interface stated vaguely is an interface that will not line up: the turn ' +
        'that authors this component will not build Component Inputs nobody asked for, and the turn that places ' +
        'it will then set parameters that reach nothing. Declare "inputs" with the names the instances will set.'
    });
  }

  // `repeats` is the one field that constrains a *different* operation, so say
  // so where it is declared rather than hoping the authoring turn joins the two.
  for (const op of plan.operations) {
    if (!op.repeats) continue;
    advisories.push({
      operation: op.id,
      message:
        `${op.target} repeats over ${op.repeats.source} rows carrying ${op.repeats.rowFields
          .map((f) => `"${f}"`)
          .join(', ')}. Those field names are the contract: whichever component draws one row must expose ` +
        'Component Inputs with exactly those names, or the repeater will render identical rows.'
    });
  }

  return advisories;
}

/**
 * LAS-006 §3 — the plan as a contract: did the staged component expose the
 * interface its operation promised?
 *
 * Takes the exposed input names rather than the candidate's nodes, so the fact
 * "what are a component's inputs" stays in the one module that owns it
 * (`validation/componentInterface`, whose derivation reads `plug` the way
 * `componentmodel.getPorts()` does). This function only compares two lists of
 * names — which is the whole of what a contract check is.
 *
 * **Extra undeclared inputs are allowed, deliberately.** The plan is a floor,
 * not a ceiling: an authoring turn that finds it needs a `variant` input the
 * plan never imagined should add it, not be sent back to amend the plan. What is
 * refused is the reverse — a promised input that is not there, because that is
 * the one the *other* operation is about to set and the one whose absence
 * silently renders placeholder chrome (F2, the whole reason this phase exists).
 *
 * Returns the refusal lines, empty when the contract holds or declared nothing.
 */
export function planInterfaceContract(
  operation: Pick<PlanOperation, 'id' | 'target' | 'inputs'>,
  exposedInputs: readonly string[]
): string[] {
  const declared = (operation.inputs ?? []).map((p) => p.name.trim()).filter(Boolean);
  if (declared.length === 0) return [];
  const exposed = new Set(exposedInputs);
  const missing = declared.filter((name) => !exposed.has(name));
  if (missing.length === 0) return [];

  const has =
    exposedInputs.length > 0
      ? `it exposes ${exposedInputs.map((n) => `"${n}"`).join(', ')}`
      : 'it exposes none at all';
  return [
    `Operation ${operation.id} planned ${operation.target} with inputs ${declared
      .map((n) => `"${n}"`)
      .join(', ')}, but ${has}. Missing: ${missing.map((n) => `"${n}"`).join(', ')}. ` +
      'Add a Component Inputs node declaring them, each port with plug "output", and wire it to the nodes that ' +
      'display the values — or amend the plan if the interface changed. Extra inputs beyond the plan are fine; ' +
      'a missing one is a parameter the instance will set and nothing will receive.'
  ];
}

/**
 * Authoring order: the provision first, then creates (in plan order), then
 * updates, then docs.
 *
 * This is the ordering fact the spec asks to settle: an update may instantiate
 * a component a create produces, so every create's candidate must exist —
 * staged, not applied — before any update authors. Intents are prose, so
 * "which update references which create" is not parseable at plan time;
 * creates-first makes every legal reference orderable without parsing, and
 * `validatePlan` has already rejected the plans that could not be
 * (an update of a component nothing provides). Docs go last: they record what
 * the plan did.
 *
 * AIB-007 puts `provision` in front. Not because anything downstream *waits* on
 * it — staging a provision costs nothing and touches nothing — but because it is
 * the operation the user is most likely to want to drop, and a row that decides
 * whether the rest of the plan can work belongs above the rest of the plan.
 */
export function orderPlanOperations(operations: readonly PlanOperation[]): PlanOperation[] {
  const rank: Record<PlanOperationKind, number> = { provision: 0, create: 1, update: 2, doc: 3 };
  return [...operations].sort((a, b) => rank[a.kind] - rank[b.kind]);
}

/**
 * AAQ-001 — the legacy names of every component this plan puts into the project.
 *
 * Two places need this and they need the *same* answer: each authoring session,
 * so a page linking to a sibling that has not been authored yet is not told its
 * correct link is broken; and the apply's pre-check, so the same page is not
 * refused at the last step for the same reason. The second was missed, and the
 * consequence was that a plan whose first page linked to its second could pass
 * every session and then be **unappliable** — the most ordinary two-page app
 * there is. Nothing was wrong with either piece of code in isolation, which is
 * why it survived a green suite; the fact simply existed twice, and once.
 *
 * Deliberately order-independent and deliberately not the same list as the
 * apply's incremental `components`: which components will exist when this
 * transaction finishes is known before any of them do.
 *
 * Takes the shape both callers share rather than either's own type — `PlanRun`
 * holds `PlanOperation`s and the panel holds `AppliedPlanOperation`s wrapping
 * them.
 */
export function plannedComponentNames(
  operations: readonly { kind: PlanOperationKind; target: string }[],
  toLegacyName: (target: string) => string
): string[] {
  return operations
    .filter((op) => op.kind === 'create' || op.kind === 'update')
    .map((op) => toLegacyName(op.target));
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
    lines.push(`${marker} ${index + 1}. ${op.kind}  ${op.target} — ${op.intent}${provisionSuffix(op)}`);
    // LAS-006 — the declared interface, on its own line under the intent. This
    // is the point of the structured fields: the operation that *places* the
    // card reads the card's input names here, verbatim, instead of inferring
    // them from a sentence that never mentioned them.
    for (const line of interfaceLines(op)) lines.push(`      ${line}`);
  });
  lines.push(
    '',
    'Operations listed before yours are already authored: components they create exist in the project',
    'overview and can be instantiated by name. Keep names, routes and events consistent with the sibling',
    'intents above — they are the contract between operations.'
  );
  if (plan.operations.some((op) => op.inputs?.length || op.outputs?.length || op.repeats)) {
    lines.push(
      '',
      'Where an operation lists inputs, those names are binding in both directions: the component must expose',
      'Component Inputs with exactly those names (ports plugged "output"), and an instance of it may set only',
      'those. A parameter that names no input is discarded silently and the instance renders its placeholder.'
    );
  }
  // AIB-007: the one line that changes what an authoring turn is allowed to
  // assume. Cloud Data and User nodes need a backend, and until this plan is
  // applied the project does not have one — so the sentence is about what *will*
  // be true, stated as a fact the operation may rely on rather than left for the
  // model to infer from a row it has no reason to read as a promise.
  const provision = plan.operations.find((op) => op.kind === 'provision');
  if (provision?.provision) {
    const { collections, needsAuth } = provision.provision;
    lines.push(
      '',
      'This plan provisions a backend, so Cloud Data nodes will have somewhere to read and write when it is' +
        ' applied.' +
        (collections.length > 0 ? ` Collections: ${collections.map((c) => c.name).join(', ')}.` : '') +
        (needsAuth ? ' Sign-in is part of this app, so the User nodes are available too.' : '')
    );
  }
  return lines.join('\n');
}

/** "(3 collections, sign-in)" — the review-legible summary of a provision. */
export function provisionSummary(spec: PlanProvisionSpec): string {
  const parts: string[] = [
    `${spec.collections.length} collection${spec.collections.length === 1 ? '' : 's'}`
  ];
  if (spec.needsAuth) parts.push('sign-in');
  return parts.join(', ');
}

function provisionSuffix(op: PlanOperation): string {
  return op.provision ? ` (${provisionSummary(op.provision)})` : '';
}

/** LAS-006 — an operation's declared structure, as the lines a sibling reads. */
function interfaceLines(op: PlanOperation): string[] {
  const lines: string[] = [];
  const port = (p: PlanPortDeclaration) => `${p.name}${p.type ? `: ${p.type}` : ''}`;
  if (op.inputs?.length) lines.push(`inputs:  ${op.inputs.map(port).join(', ')}`);
  if (op.outputs?.length) lines.push(`outputs: ${op.outputs.map(port).join(', ')}`);
  if (op.repeats) {
    lines.push(`repeats: one row per ${op.repeats.source} item — fields ${op.repeats.rowFields.join(', ')}`);
  }
  if (op.instantiates?.length) lines.push(`places:  ${op.instantiates.join(', ')}`);
  return lines;
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
  // AIB-007: a provision is not a component and must not be counted as one, or
  // a docs-only plan that happens to add a backend reads to the doc turn as
  // "one component was built" and gets documented as such.
  const provision = entries.find((e) => e.operation.kind === 'provision');
  const provisionLine =
    provision && provision.operation.provision
      ? `This plan also gives the project a backend called "${provision.operation.target}" (${provisionSummary(
          provision.operation.provision
        )}). It is worth one sentence, not a section.`
      : undefined;

  const components = entries.filter((e) => e.operation.kind !== 'doc' && e.operation.kind !== 'provision');
  if (components.length === 0) {
    const none = 'This plan changed no components — it is a documentation-only change.';
    return provisionLine ? `${none}\n\n${provisionLine}` : none;
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
  if (provisionLine) lines.push('', provisionLine);
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
    // LAS-001 — with the plug, which is what decides whether a Component Inputs
    // port is an input of the component or an output pointed the wrong way.
    ports: (node.ports ?? [])
      .filter((p): p is typeof p & { name: string } => typeof p.name === 'string')
      .map((p) => ({ name: p.name, ...(typeof p.plug === 'string' ? { plug: p.plug } : {}) })),
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
