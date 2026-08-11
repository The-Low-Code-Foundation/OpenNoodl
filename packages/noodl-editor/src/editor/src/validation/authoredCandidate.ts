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
import {
  checkComponentPortDirection,
  checkInstanceInterfaces,
  componentInterfaceIndex,
  type ComponentInterfaceIndex,
  type ComponentInterfaceView
} from './componentInterface';
import { DiagnosticCode, type Diagnostic } from './diagnostics';
import { checkInstancePorts, type AuthoredPortLike } from './instancePorts';
import { checkNavigation, checkPageShape, looksLikePageComponent, PAGE_NODE_TYPE } from './navigation';
import { checkParameterValues } from './parameterValues';
import { checkRepeaterTemplate } from './repeaterTemplate';
import { checkResponsiveArrangement } from './responsiveArrangement';
import { checkTypographyHierarchy } from './typographyHierarchy';

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
  /** Declared instance ports, for `checkInstancePorts`. */
  ports?: readonly AuthoredPortLike[] | null;
  /**
   * Child node ids, for `checkRepeaterTemplate` (LAS-012). Hierarchy was until
   * now a `rules/` concern — `NormNode` carries `children` and the semantic
   * validator reasons about it — but "a `For Each` with children" is a question
   * about a *parameter and* a child at once, and only this layer sees both.
   */
  children?: readonly string[] | null;
}

/**
 * A stored v2 node, as much of it as the checks read. Declared here rather than
 * imported from `schemas/` so this module keeps its only dependency being the
 * other pure checks.
 */
export interface StoredNodeLike {
  id: string;
  type: string;
  label?: string;
  parameters?: Record<string, unknown> | null;
  ports?: readonly AuthoredPortLike[] | null;
  children?: readonly string[] | null;
}

/**
 * A stored v2 connection, as much of it as {@link connectedInputs} reads.
 */
export interface StoredConnectionLike {
  toId: string;
  toProperty: string;
}

/**
 * Which input ports carry a wire, as `` `${nodeId}::${port}` ``.
 *
 * LAS-012 needs it and it is the first thing in this layer that does: every
 * other precondition asks about a value, and "is this port driven instead"
 * is the one question that can turn a true finding into a false one. A
 * `template` fed by a connection is a working list, and rejecting it would be
 * the gate reporting the app's own working links as broken — the failure mode
 * `urlPaths`' "omitted means do not check" convention exists to prevent.
 */
export function connectedInputs(connections: readonly StoredConnectionLike[]): Set<string> {
  const set = new Set<string>();
  for (const c of connections) {
    if (typeof c?.toId === 'string' && typeof c?.toProperty === 'string') set.add(`${c.toId}::${c.toProperty}`);
  }
  return set;
}

/**
 * A candidate's stored nodes in the shape all five precondition checks read.
 *
 * ⚠️ This adapter existed **twice**, byte-identical apart from an `export` —
 * `authoring/validate.ts` and `noodl-mcp/src/validate.ts` — and it is the seam a
 * new field has to travel through to reach the checks. Slice 1 converged the
 * policy and left the adapter twinned, so adding `ports` here would have meant
 * editing two copies and the one that was forgotten would have quietly stopped
 * checking. That is exactly how `children` and `variant` drifted between the two
 * tool schemas in the first place.
 */
export function authoredNodes(nodes: readonly StoredNodeLike[]): AuthoredNode[] {
  return nodes.map((n) => ({
    id: n.id,
    type: n.type,
    ...(typeof n.label === 'string' && n.label ? { label: n.label } : {}),
    parameters: (n.parameters ?? null) as Record<string, unknown> | null,
    ...(n.ports ? { ports: n.ports } : {}),
    ...(n.children ? { children: n.children } : {})
  }));
}

/**
 * A component seen only as "what nodes, with what parameters and ports" — enough
 * to find `Page` nodes (`declaredUrlPaths`) and to derive its interface
 * (`componentInterfaceIndex`, LAS-001).
 *
 * `ports` is optional because one of the three callers could not supply it until
 * LAS-001 widened `ExplainGraph`'s node shape, and because a view built from a
 * source that does not carry ports is still a perfectly good answer to the
 * url-path question. A view without ports simply contributes an empty interface.
 */
export interface ComponentNodesView {
  name: string;
  nodes: readonly {
    type: string;
    parameters?: Record<string, unknown> | null;
    ports?: readonly AuthoredPortLike[] | null;
  }[];
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
 * `PageWithoutPageNode` joined them in AAQ-011 F7, and the delay is worth a
 * sentence because it was not doubt about the rule. The rule was never in
 * question — a routed component with no `Page` node renders a blank screen, and
 * that was proved live against a real preview, not argued. What blocked the
 * promotion was the fixture population: the AI suite built `/Pages/…` components
 * out of bare Groups throughout, because that is what everyone believed a page
 * was until the launcher was driven end to end. Those fixtures were not testing
 * the warning; they were teaching a shape the runtime refuses to render, and a
 * gate that a suite would fail is a gate the suite was asserting the wrong thing
 * about. They now build a real `Page` node, which is the correction and not a
 * suppression.
 *
 * The corpus is untouched by this: `validate:project` never applied the authored
 * policy, so promoting a code here cannot turn 6 corpus hits into errors.
 */
export const AUTHORED_BLOCKING_WARNINGS: ReadonlySet<string> = new Set([
  DiagnosticCode.UnknownParameter,
  DiagnosticCode.UnitlessDimension,
  DiagnosticCode.UnresolvedNavigation,
  DiagnosticCode.PageWithoutPageNode,
  // LAS-001 — the three halves of the interface gate, all promoted on the same
  // corpus run and the same argument as `PageWithoutPageNode`. Project-wide each
  // has a legitimate population (58 stale instance parameters in one real merge
  // fixture; 22 backwards ports in the reference build) and none of it is
  // authored today. For a graph an agent just wrote, an instance parameter that
  // names no input is a value it believes it set and did not — the exact
  // mechanism that shipped haiku's four identical "Text" cards under a clean
  // report, and the single gap between an architecturally correct replay and a
  // page that renders.
  DiagnosticCode.InstanceUnknownParameter,
  DiagnosticCode.InterfacelessInstance,
  DiagnosticCode.ComponentPortDirection,
  // LAS-004 — the only architecture gate in the system, and until now it blocked
  // nothing anywhere. It fired correctly on every measured build (3 warnings on
  // the reference build's exact failure, 2 on haiku's, 1 on sonnet's) and was
  // ignored by all three, which is what advice gets under pressure. The audit's
  // other measurement is the reason to expect this to work: hard rejections
  // carrying a suggestion were self-corrected at a 100% rate even by the mid-tier
  // model, and this rule's message already offers both exits. With LAS-002
  // landed, the text now actually reaches a staging agent instead of arriving as
  // the integer 1.
  DiagnosticCode.RepeatedSiblingSubtree,
  // LAS-012 — the two non-fatal halves of the repeater contract. The fatal half
  // (`RepeaterWithoutTemplate`, and `RepeaterWithVisualChildren` on a repeater
  // that also has no template) is an error and needs no entry here.
  //
  // `RepeaterTemplateUnresolved` has the `InstanceUnknownParameter` shape
  // exactly: 2 corpus hits in one legacy merge fixture whose components moved,
  // nothing authored. `RepeaterWithVisualChildren` at warning severity means the
  // list does render and the nested children are merely inert — project-wide
  // that is a tidy-up, and for a graph an agent just wrote it is the mental
  // model that produced haiku's three blank sections.
  DiagnosticCode.RepeaterTemplateUnresolved,
  DiagnosticCode.RepeaterWithVisualChildren,
  // DSG-004 §2.2 — the `sizeMode` family, split out of
  // `InactiveConditionalParameter` precisely so this decision could be made about
  // it alone. The general code stays a warning: project-wide its population is
  // 366 hits of a dozen different conditions, and `validate:project` gaining an
  // error class across that corpus is a separate decision.
  //
  // This subset has the `UnitlessDimension` shape exactly. Doctrine §8 names the
  // measured consequence — "a `width: 100%` input that renders 170px wide is
  // this, every time" — and the corpus's authored half is 17 hits, every one of
  // them real: six Text Inputs in one QA project's admin form at `width: 100%`,
  // rendering at 170px under a clean report. Zero of the 204 `Image` nodes in
  // either corpus are affected, so this promotion cannot fire on the population
  // §5 already taught correctly.
  DiagnosticCode.InertDimension
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
  /**
   * LAS-001 — every component's interface, keyed by both name forms. **Omitted
   * means "do not check"**, the same convention `urlPaths` and `backend` follow:
   * a caller that cannot enumerate the project's components cannot tell a
   * parameter that names no input from one whose component it simply has not
   * read, and guessing reports a working page as broken.
   *
   * Build it with {@link componentInterfaces} from the same views
   * `declaredUrlPaths` reads, so the two can never disagree about which
   * components exist — including the ones a plan is about to create, which is
   * what makes a multi-component plan validate correctly.
   */
  interfaces?: ComponentInterfaceIndex;
  /**
   * LAS-012 — the candidate's wired input ports, from {@link connectedInputs}.
   * **Omitted means "no connection information"**, and a `template` fed by a
   * wire then reads as unset. Zero of the corpus's 89 repeaters are wired that
   * way, so omitting it costs nothing measured; supplying it is what keeps the
   * one that eventually is from being rejected for it.
   */
  connections?: ReadonlySet<string>;
}

/**
 * The five checks the semantic validator cannot make, in the order the editor
 * has always composed them.
 *
 * All five are *precondition* checks rather than catalog rules, and for one
 * reason: their answers depend on the project, on parameter values, or on
 * instance-port declarations — none of which the normalized model carries. SUB-006
 * reasons about types, ports and connectivity; a value's shape, a target's
 * existence and a port's direction are different questions asked of different
 * data.
 *
 * The order is load-bearing only in that the editor's accepted-component report
 * and its specs have always shown them this way — `sortDiagnostics` is what
 * actually orders the output.
 *
 * `checkInstancePorts` is the fifth, added by AAQ-005: converging the two tool
 * vocabularies showed that `plug` was undeclared on one door and unchecked on
 * both, and that a port without it is inert rather than wrong.
 *
 * The sixth and seventh are LAS-001's, and they are preconditions for the
 * sharpest version of the same reason: an instance's parameters are values, and
 * the target component's interface is a project-wide fact. `NormNode` carries
 * neither, so no `rules/` rule can ask the question at all.
 *
 * The eighth is LAS-012's, and it is the first here to read *hierarchy* as well
 * as values: a `For Each` fails its contract by omitting a `template`, by naming
 * one that does not resolve, or by nesting the item content as a child, and
 * telling those three apart needs the parameters and the children in one place.
 *
 * The ninth and tenth are DSG-004's, and they are the first two *design* gates
 * in the set. They are here for the same reason as all the others — a
 * `flexDirection` and a `fontWeight` are parameter values, which `NormNode` does
 * not carry — and it is worth being explicit about what that costs: neither can
 * ever appear in `validate:project`, so both are calibrated against the corpus
 * (see their headers) and reported only on graphs an agent just wrote.
 */
export function authoredPreconditionDiagnostics(options: AuthoredPreconditionOptions): Diagnostic[] {
  const { component, nodes, components, urlPaths, catalog, backend, interfaces, connections } = options;
  return [
    ...checkParameterValues(nodes, catalog, { component }),
    ...(backend ? checkBackendRequirements(nodes, { ...backend, component }) : []),
    ...checkNavigation(nodes, { component, components, urlPaths }),
    ...checkPageShape(nodes, { component, isRoutedPage: looksLikePageComponent(component) }),
    ...checkInstancePorts(nodes, { component }),
    ...(interfaces ? checkInstanceInterfaces(nodes, { component, interfaces }) : []),
    ...checkComponentPortDirection(nodes, { component }),
    ...checkRepeaterTemplate(nodes, { component, components, connectedInputs: connections }),
    // DSG-004 §2.1 — doctrine §7's only mechanical claim, which had no gate.
    ...checkResponsiveArrangement(nodes, { component, catalog }),
    // DSG-004 §2.3 — doctrine §3, as an info that never blocks.
    ...checkTypographyHierarchy(nodes, { component, connectedInputs: connections })
  ];
}

/**
 * LAS-001 — the interface index, built from the views every client already
 * assembles for {@link declaredUrlPaths}.
 *
 * One builder rather than three, and built from the *same* list, so a component
 * a plan is about to create resolves as an interface exactly when it resolves as
 * a navigation target. Three copies of an index that agree are still three
 * copies; this is the one.
 */
export function componentInterfaces(components: readonly ComponentNodesView[]): ComponentInterfaceIndex {
  return componentInterfaceIndex(components as readonly ComponentInterfaceView[]);
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
