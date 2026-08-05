/**
 * AAQ-005 — one authored-candidate gate, defined once.
 *
 * ## What was actually wrong
 *
 * AAQ-005 recorded the editor/MCP divergence as a *policy* difference: both
 * clients share the validation rules, and `noodl-mcp` merely "gates on
 * `severity === 'error'` only", so the editor's `BLOCKING_WARNINGS` set has no
 * counterpart there. Read in source, that premise fails — and the failure is the
 * interesting half.
 *
 * `noodl-mcp` shares the *semantic validator* (SUB-006, via `editor-deps.ts`) and
 * **none of the four precondition checks**. `checkParameterValues`,
 * `checkBackendRequirements`, `checkNavigation` and `checkPageShape` appear
 * nowhere in that package; `editor-deps.ts` never re-exported them. So the MCP
 * write gate does not apply a laxer policy to those diagnostics — it never
 * computes them. Its `severity === 'error'` filter is correctly implemented and
 * has nothing to filter.
 *
 * That makes the consequence larger than the task file states. It is not only a
 * bare `width: 228` (a blocking *warning*) slipping through. `checkParameterValues`
 * emits roughly fifteen distinct **error**-severity diagnostics, including
 * `ConnectionOnlyParameter` — the diagnostic this very phase created, for the
 * defect that silently discarded the agent's styling. Every one of them rejects a
 * write in the editor and ships clean through Claude Code.
 *
 * And there were three gates, not two: `noodl-mcp/src/validate.ts` (the write
 * tools) and `noodl-mcp/src/tools/planTools.ts` (`validateStaged`) are separate
 * implementations, each carrying its own copy of `diagnosticKey` and its own
 * baseline-exemption logic. BCN-003's three twins of one semantics, already
 * realised, inside the task written to prevent them.
 *
 * ## What this module is
 *
 * The gate's *policy and preconditions*, as plain functions over plain data —
 * the one definition the editor binding, the MCP write gate and the MCP plan
 * gate all call. It deliberately does **not** take over project normalization or
 * own a validator instance: the two clients legitimately differ there (the editor
 * validates against an `ExplainGraph`, the MCP server against its `ProjectStore`,
 * and the MCP validator is built over the *enriched* catalog index so its catalog
 * tools and its gate can never disagree about a type). Converging those too would
 * have changed MCP's semantic results as a side effect of closing a gap in what
 * it checks at all — a regression bought with a refactor.
 *
 * Pure: no `fs`, no Electron, no editor model. It lives in `validation/` because
 * that is the layer both packages already import, which is what makes "defined
 * once" true rather than aspirational.
 *
 * @module noodl-editor/validation/authoredCandidate
 */

import { checkBackendRequirements, type ProjectBackendFacts } from './backendRequirement';
import type { CatalogIndex } from './CatalogIndex';
import { DiagnosticCode, type Diagnostic } from './diagnostics';
import { checkNavigation, checkPageShape, looksLikePageComponent, PAGE_NODE_TYPE } from './navigation';
import { checkParameterValues } from './parameterValues';

/**
 * The node shape every precondition check reads. The three checks take three
 * slightly different views of it (`ParameterizedNode`, a bare `{id,type,label}`,
 * `NavigatingNode`); this is their union, and it is what a v2 node trivially maps
 * to on both sides of the boundary.
 */
export interface AuthoredNode {
  id: string;
  type: string;
  label?: string;
  parameters?: Record<string, unknown> | null;
}

/** A component seen only as "what nodes, with what parameters" — enough to find `Page` nodes. */
export interface ComponentNodesView {
  name: string;
  nodes: readonly { type: string; parameters?: Record<string, unknown> | null }[];
}

/**
 * Warnings that block *authored* output, and only authored output.
 *
 * Raising these to `severity: 'error'` was rejected, and the reasoning is worth
 * keeping in one place rather than re-deriving per client. Project-wide, each of
 * them has a legitimate population: the 96-project corpus is full of imported
 * nodes carrying settings the catalog cannot see (`UnknownParameter`), bare
 * numbers on ports that have always defaulted to `%` (`UnitlessDimension`), and
 * component libraries that navigate to a page their host supplies
 * (`UnresolvedNavigation`). `validate:project` gaining three new error classes
 * across that corpus is a separate decision from fixing authored output.
 *
 * For a graph an agent just wrote, none of that holds. Nothing in it is legacy,
 * every type was fetched from the catalog moments earlier, and a parameter that
 * names no port is simply a value the agent believes it set and did not —
 * `Page.title`, `Page.urlPath`, `button.size` and `button.boxShadow` all shipped
 * in one build under a clean report. A navigation that lands nowhere is the same
 * class: the graph is well formed, the gate is green, and the button does
 * nothing.
 *
 * ⚠️ `PageWithoutPageNode` is deliberately absent, and this is the one place that
 * decision now lives (AAQ-011 F7 carries the bill). The rule is right — a routed
 * component with no `Page` node renders a blank screen — and it was calibrated on
 * the corpus at 6 hits. But the population that flows through *this* gate is the
 * authored one, and there it fires on 57 fixture sites across 15 spec files,
 * every one of which builds a `/Pages/…` component out of a bare Group, because
 * that is what everyone believed a page was until the launcher was driven end to
 * end. Promoting it means correcting those fixtures, which is a real change to
 * what a large part of the AI suite asserts and deserves its own read.
 */
export const AUTHORED_BLOCKING_WARNINGS: ReadonlySet<string> = new Set([
  DiagnosticCode.UnknownParameter,
  DiagnosticCode.UnitlessDimension,
  DiagnosticCode.UnresolvedNavigation
]);

/** Whether a diagnostic rejects an authored submission. */
export function isBlockingForAuthoredOutput(diagnostic: Diagnostic): boolean {
  return diagnostic.severity === 'error' || AUTHORED_BLOCKING_WARNINGS.has(diagnostic.code);
}

/**
 * A diagnostic's identity for baseline comparison: the rule, what it is about,
 * and the message.
 *
 * The message is in the key on purpose — "unknown node type Markdown" and
 * "unknown node type Foo" are different problems on the same node, and only the
 * first can be pre-existing.
 *
 * This was independently written three times (editor `authoring/validate.ts`,
 * `noodl-mcp/src/validate.ts`, `noodl-mcp/src/tools/planTools.ts`), identically,
 * with a comment in one of them observing that keeping them identical was
 * deliberate. Three copies that agree are still three copies; this is the one.
 */
export function diagnosticKey(diagnostic: Diagnostic): string {
  const l = diagnostic.location;
  return JSON.stringify([diagnostic.code, l.nodeId, l.port, l.plug, l.connection, diagnostic.message]);
}

export interface AuthoredPreconditionOptions {
  /** Legacy name of the component being submitted, e.g. `/Pages/Puppies`. */
  component: string;
  /** The candidate's own nodes. */
  nodes: readonly AuthoredNode[];
  /**
   * Every component name a navigation target could legitimately name: the
   * project's components, the candidate's own name, and whatever a plan in
   * flight is going to create.
   */
  components: readonly string[];
  /**
   * Url paths that resolve. **Omitted means "do not check paths"** — a caller
   * that cannot enumerate them cannot tell a bad path from one it does not know
   * about, and guessing reports the app's own working links as broken.
   */
  urlPaths?: readonly string[];
  /** The catalog the parameter-value check reads port types from. */
  catalog: CatalogIndex;
  /**
   * AIB-007 — what the project can offer a Cloud Data or User node. **Omitted
   * means "do not check"**, not "there is no backend": a caller that does not
   * know cannot produce a true answer, and defaulting to `hasBackend: false`
   * would report a missing backend on every project that has one.
   */
  backend?: ProjectBackendFacts;
}

/**
 * The four checks the semantic validator cannot make, in the order the editor
 * has always composed them.
 *
 * All four are *precondition* checks rather than catalog rules, and for one
 * reason: their answers depend on the project and on parameter values, neither
 * of which the normalized model carries. SUB-006 reasons about types, ports and
 * connectivity; a value's shape and a target's existence are different questions
 * asked of different data.
 *
 * The order is load-bearing only in that the editor's accepted-component report
 * and its specs have always shown them this way — `sortDiagnostics` is what
 * actually orders the output.
 */
export function authoredPreconditionDiagnostics(options: AuthoredPreconditionOptions): Diagnostic[] {
  const { component, nodes, components, urlPaths, catalog, backend } = options;
  return [
    ...checkParameterValues(nodes, catalog, { component }),
    ...(backend ? checkBackendRequirements(nodes, { ...backend, component }) : []),
    ...checkNavigation(nodes, { component, components, urlPaths }),
    ...checkPageShape(nodes, { component, isRoutedPage: looksLikePageComponent(component) })
  ];
}

/**
 * Every `urlPath` a set of components declares — what the router resolves a
 * browser URL against.
 *
 * The candidate is passed in the list like any other component; a caller
 * replacing an existing component must therefore leave the stale copy out, which
 * is the same discipline the semantic gate applies to the component list.
 */
export function declaredUrlPaths(components: readonly ComponentNodesView[]): string[] {
  const paths: string[] = [];
  for (const component of components) {
    for (const node of component.nodes) {
      if (node.type !== PAGE_NODE_TYPE) continue;
      const path = node.parameters?.['urlPath'];
      if (typeof path === 'string' && path.trim()) paths.push(path.trim());
    }
  }
  return paths;
}
