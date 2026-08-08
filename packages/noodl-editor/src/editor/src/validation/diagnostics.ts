/**
 * SUB-006 — Semantic Validator: Diagnostic model
 *
 * Diagnostics are *data*, not strings. Every rule emits `Diagnostic` objects;
 * formatting (human-readable text, JSON) happens at the edge so the same objects
 * drive the CLI, the MCP server, and the editor's problems panel.
 *
 * The message contract matters as much as the location: a diagnostic must be
 * actionable by an AI with no other context. Where a fix is knowable we attach a
 * `suggestion` (e.g. "did you mean `Group`?") and, for port/type problems, the
 * list of valid alternatives — so the model's next attempt is informed by the
 * error alone (see SUB-006 success criteria).
 *
 * @module noodl-editor/validation/diagnostics
 */

// ─── Severity ───────────────────────────────────────────────────────────────

/**
 * Diagnostic severity.
 *
 * - `error`   — the project is definitely wrong: a static port that does not
 *               exist, a connection to a missing node, a broken parent link.
 *               CI fails on these; the CLI exits non-zero.
 * - `warning` — probably wrong, but not provably so from the catalog alone. An
 *               unknown node type is a warning by default because real projects
 *               legitimately use module-provided or version-specific nodes the
 *               catalog cannot enumerate; erroring on those would "cry wolf".
 *               `--strict` promotes warnings to errors for greenfield projects.
 * - `info`    — a note, never a failure: e.g. a port skipped because the node
 *               creates it at runtime. Surfaced so the user knows a check was
 *               deliberately *not* performed, rather than silently passing.
 */
export type Severity = 'error' | 'warning' | 'info';

export const SEVERITY_ORDER: Record<Severity, number> = {
  error: 0,
  warning: 1,
  info: 2
};

// ─── Diagnostic codes ─────────────────────────────────────────────────────────

/**
 * Stable machine-readable codes, one per rule. Consumers (CI, MCP, editor)
 * should switch on these rather than parsing messages.
 */
export enum DiagnosticCode {
  /** Two nodes share one id — the substrate's primary key is not unique. */
  DuplicateNodeId = 'duplicate-node-id',
  UnknownNodeType = 'unknown-node-type',
  NonexistentPort = 'nonexistent-port',
  DanglingConnection = 'dangling-connection',
  UnresolvedComponentRef = 'unresolved-component-ref',
  OrphanedNode = 'orphaned-node',
  /**
   * A page component's content is parented to a second visual root beside the
   * `Page` node rather than inside it, so the page renders blank.
   */
  DetachedPageContent = 'detached-page-content',
  TypeIncompatibleConnection = 'type-incompatible-connection',
  /**
   * NDA-017: a control signal fires without waiting for the asynchronous producer of a value
   * it reads, so the node evaluates against whatever arrived last.
   */
  SignalDrivenStaleInput = 'signal-driven-stale-input',
  /**
   * ERG-001: an action that is invoked, and whose chain visibly continues from some other
   * signal, reports its `Done`/`Unchanged`/`Failure`/`Completed` outcome nowhere — so the
   * chain runs on some paths through the node and stops dead on others.
   */
  UnwiredOutcome = 'unwired-outcome',
  /** Info-level: a port check was skipped because the node determines the port at runtime. */
  DynamicPortSkipped = 'dynamic-port-skipped',
  /**
   * AIB-001: a parameter carries a value of a shape the port's type cannot
   * consume — an array where the wire format is a comma-separated string, a
   * number where the port wants `{ value, unit }`, an enum value that is not
   * one of the declared options.
   */
  InvalidParameterValue = 'invalid-parameter-value',
  /**
   * AIB-001: a parameter names a port the node type does not declare. A
   * warning, never an error — a node whose ports are runtime-determined
   * legitimately carries parameters for ports the catalog cannot see, and this
   * rule skips those entirely (see `checkParameterValues`).
   */
  UnknownParameter = 'unknown-parameter',
  /**
   * A parameter sets a port that *exists* but is currently switched off by a
   * sibling parameter's value — the port's `condition` in `declaredPortGroups`
   * is not satisfied, so the runtime never reads it.
   *
   * Its own code because, like `ConnectionOnlyParameter`, it is invisible to
   * every neighbouring check: the port is genuinely declared, so
   * `UnknownParameter` cannot see it, and the value is perfectly well-formed for
   * its type, so `InvalidParameterValue` cannot either. The canonical case is
   * `Image`: `defaultSizeMode` is `contentSize`, and `objectFit` is declared
   * `condition: 'sizeMode = explicit'`. An agent writes `width`, `height` and
   * `objectFit: 'cover'` — the three things that crop a photo — and gets none of
   * them, rendering the image at its natural size. That produced the 800px-tall
   * photos that wrecked an authored page while validation reported zero problems.
   *
   * A warning, not an error: the dependency is real but the repair is a
   * *sibling* edit (set `sizeMode`), and the condition language admits forms
   * this rule deliberately declines to judge (see `conditionIsUnsatisfied`).
   * Only an unambiguously unsatisfied condition is reported.
   */
  InactiveConditionalParameter = 'inactive-conditional-parameter',
  /**
   * A parameter sets a port the catalog marks `allowConnectionsOnly` — a port
   * that only ever takes a wired connection and silently discards a statically
   * authored value.
   *
   * Always an **error**, and the reason it needs a code of its own is that it is
   * invisible to every check around it: the port genuinely exists, so
   * `UnknownParameter` cannot see it, and the value is a perfectly well-formed
   * string, so `InvalidParameterValue` cannot either. The canonical case is
   * `variant` on Text/Group/Button. An agent told to style "on-system" writes
   * `variant: "heading-1"` and nothing else — no `fontSize`, no `color` — and
   * every word on the page then renders at browser default with no diagnostic
   * anywhere. A statically-set variant must be expanded into the concrete token
   * parameters it implies.
   */
  ConnectionOnlyParameter = 'connection-only-parameter',
  /**
   * Three or more structurally identical sibling subtrees — a component that
   * was written out by hand instead of being made once and instantiated.
   *
   * The decomposition doctrine has said this in prose to both clients since
   * AAQ-008, and prose alone did not hold: the reference build that produced
   * this rule reached a 66-node page carrying three hand-duplicated trust items,
   * three section heads and three category cards. A doctrine with no check
   * behind it is advice, and advice is what gets skipped under pressure.
   *
   * Matched on STRUCTURE (types and arrangement), never on parameter values —
   * instances are supposed to differ in their values, so comparing them would
   * fire only on literal copy-paste and miss the case worth reporting. A
   * warning, always: the graph renders correctly and the repair is a refactor.
   */
  RepeatedSiblingSubtree = 'repeated-sibling-subtree',
  /**
   * LAS-003/F7 — a `position: absolute` box with neither `width` nor `height`,
   * carrying decoration (background, border, radius, shadow).
   *
   * `width` and `height` are `dimension` ports whose default is **`100` with a
   * `defaultUnit` of `%`**, so an unsized absolute box is 100% × 100% of its
   * parent. Sonnet's cold replay authored a badge pill this way: a
   * `--primary`-filled ellipse stretched over four of six product photos, and
   * the basket count spread across the full navbar. The graph was perfect.
   *
   * ⚠️ **The decoration half of the predicate is not incidental** — it is the
   * whole calibration. Unsized-absolute alone hits 151 nodes across the corpus,
   * because a full-bleed absolute box IS the overlay/scrim pattern and 122 of
   * those are legitimate. Requiring decoration narrows it to 29, of which 21
   * are editor test fixtures: what is left is sonnet's badge, the
   * ecommerce-example card, and a handful of prefabs. A rule is only as good as
   * its false-positive rate.
   *
   * A warning, not authored-blocking, and deliberately so: `popup-modal` in the
   * shipped prefab library is a decorated full-bleed scrim, which is exactly
   * this shape authored on purpose. Promotion is LAS-004's kind of decision and
   * gets made with its own evidence, not folded in here.
   */
  UnsizedAbsoluteBox = 'unsized-absolute-box',
  /**
   * LAS-003 — a raw colour literal on a colour-typed port where the project's
   * design tokens are what the system expects.
   *
   * The MCP server instructions have said "set colour params as `var(--token)`,
   * never raw hex" since AAQ-005, and until now nothing checked it — prose with
   * no gate behind it, which the phase-54 audit showed is prose that gets
   * dropped. A page whose colours are literals cannot be re-themed, and drifts
   * from the identity the project decided once.
   *
   * A warning everywhere rather than an error, because the corpus carries 553
   * of them: legacy and imported projects are full of hex by construction and
   * are not wrong, they are just not tokenised. Warnings do not block
   * `validate:project`, so this reports the truth about that content without
   * failing it.
   */
  RawColorLiteral = 'raw-color-literal',
  /**
   * A bare number on a units-typed port that is read as a **percentage** —
   * `width`, `height`, `maxWidth`, `minWidth`. `{ value, unit }` is the form
   * real content uses: across the whole repository these ports are written in
   * object form 3,589 times and as a bare number **zero** times, while bare
   * numbers on `px`-defaulting ports (`borderRadius`, `fontSize`) are common and
   * harmless. So the rule keys on the unit the port defaults to, not on the
   * value's shape.
   *
   * A warning rather than an error, because a bare number is genuinely legal —
   * `setInputValue` merges it into the port's current unit. It is nonetheless
   * blocking for *authored* output, where `width: 228` meaning 228px produced an
   * image 228% wide.
   */
  UnitlessDimension = 'unitless-dimension',
  /**
   * LIB-006: a legacy import could not convert this construct and left it in
   * place, marked. Always an error — see `rules/legacyImportPlaceholder.ts` for
   * why this is not folded into `unknown-node-type`.
   */
  LegacyImportPlaceholder = 'legacy-import-placeholder',
  /**
   * AIB-007: a node reads or writes on the project's backend, and the project
   * has none. Error when the scope explicitly agreed there is no backend,
   * warning otherwise — see `backendRequirement.ts`, which also explains why
   * this is a precondition check rather than a catalog fact.
   */
  MissingBackend = 'missing-backend',
  /**
   * AAQ-001: a navigation that lands nowhere — a Navigate node with no target,
   * or one naming a component this project does not have.
   *
   * A warning project-wide (a component library can legitimately carry a
   * Navigate aimed at a page the *host* project supplies) and blocking for
   * authored output, where every name the agent used came from an overview it
   * was given moments earlier. The mechanism it closes: the AI stack had never
   * heard of the Router, so it aimed navigation at URL paths it invented —
   * *"'navigate to path' /puppies but there is no such page"* — and nothing
   * anywhere checked that a navigation target resolved.
   */
  UnresolvedNavigation = 'unresolved-navigation',

  /**
   * A component the project will route as a page, with no `Page` node in it.
   *
   * Found by driving the launcher end to end, and it is the reason AAQ-001's
   * criterion 5 could not pass: registration worked perfectly and the app still
   * rendered **nothing**. Listing a component in a Router's `pages.routes` does
   * not make it a page. The runtime's page index is built exclusively from
   * `Page` nodes (`exporter/router.ts::_getPageInfo`), `getPagesForRouter`
   * drops every route it cannot resolve to one, and the Router then has no start
   * page to mount. Blank screen, no error, and a panel that truthfully reports
   * "The app opens on Puppies".
   *
   * Nothing said this: the authoring prompt mentioned the `Page` node only as
   * where `urlPath` lives, and `stagedComponentIsPage` treats a `/Pages/…` name
   * as sufficient — which is right for deciding what to *register* and was never
   * a statement about what renders.
   *
   * Blocking for authored output. Over the 96-project corpus it fires 6 times,
   * all inside two synthetic node-id fixtures and none in a real project.
   */
  PageWithoutPageNode = 'page-without-page-node',

  /**
   * A declared instance port with no `plug`, which makes it **inert**.
   *
   * `NodeGraphNode.getPorts(filter)` selects on `p.plug && p.plug.indexOf(filter)
   * !== -1`, and a component's interface is derived from `getPorts('input')` /
   * `getPorts('output')` on the nodes with `haveComponentPorts` (`componentmodel`).
   * So a `Component Inputs` node carrying `ports: [{ name: 'Title' }]` lands in
   * neither map: the port is written, the file validates, the canvas shows
   * nothing, and the component silently has no such input. The agent believes it
   * built a component interface and built nothing.
   *
   * Found by converging the two authoring vocabularies (AAQ-005). MCP's port
   * schema was `{ name }` with `.passthrough()`, so an external agent was never
   * told `plug` existed; the editor's schema declared it required, but that schema
   * is instruction only — `toSubmitPayload` casts unchecked — and no rule checked
   * it on either door.
   *
   * Error severity, and safe at that: across all three populations this gate sees
   * — the 96-project corpus (1483 declared instance ports, **1483 with a plug**),
   * the 15 AI spec files, and `noodl-mcp`'s fixtures — it fires zero times. A
   * plug-less instance port is not a thing anyone has ever meant to write.
   */
  PortWithoutPlug = 'port-without-plug',

  /**
   * LAS-001 — a parameter set on a component-instance node that names no input
   * of the target component.
   *
   * A component instance carries **only** the ports its `Component Inputs` node
   * declares. It has no layout, style or lifecycle ports of its own —
   * `ComponentInstanceNode` extends `Node`, not a visual node, and
   * `componentmodel.getPorts()` is the whole of its port list — so `width` on a
   * card instance is discarded exactly as a misspelled input name is. Sonnet's
   * cold replay set `width`/`minWidth` on three category-card instances and got
   * neither.
   *
   * `checkParameterValues` cannot see any of this: its first line returns for a
   * node whose type is not in the catalog, and a component reference never is.
   *
   * A warning, on the `UnknownParameter` precedent and for the same reason —
   * the corpus carries 58 of them in one real merge fixture, an app whose
   * components were renamed out from under their instances. Blocking for
   * *authored* output, where every name the agent used came from a component it
   * wrote minutes earlier.
   */
  InstanceUnknownParameter = 'instance-unknown-parameter',
  /**
   * LAS-001 — instances of a component that declares no inputs at all, carrying
   * parameters. The whole audit finding F2, and the single gap between "haiku
   * got the architecture right" and "the page renders".
   *
   * Haiku's replay instantiated `ProductCard` four times with `image`, `name`,
   * `description`, `price`, `originalPrice`, `badge` per instance, and
   * `ProductCard` exposed no `Component Inputs` — it had declared those six
   * ports on the card's root `Group`, where they are ordinary instance ports and
   * never become an interface. Four identical cards of the literal word "Text",
   * under a clean validation report.
   *
   * One diagnostic per target component rather than one per parameter per
   * instance: the repair is a single edit to a single component, and 30
   * rejections for it is a repair round spent reading. The message carries the
   * parameter names — which are exactly the interface the component should have
   * had — plus, where it can tell, *why* the interface looks empty: the ports
   * were declared on the wrong node, or with the wrong plug.
   *
   * Warning severity, and blocking for authored output. Across both corpora it
   * fires **twice**, both in haiku's replay: cleaner than `PageWithoutPageNode`
   * was when it was promoted.
   */
  InterfacelessInstance = 'interfaceless-instance',
  /**
   * LAS-001 — a component-interface port declared in the wrong direction.
   *
   * `componentmodel.getPorts()` reads `getPorts('output')` on the nodes carrying
   * `haveComponentPorts` and republishes those as the component's **inputs**, so
   * a port on a `Component Inputs` node must be plugged `"output"`. Plugged
   * `"input"` it becomes a component output instead: no instance can set it, and
   * every connection drawn out of it names an endpoint `getPorts('output')` does
   * not return, which the exporter drops as unhealthy.
   *
   * Found while calibrating {@link InterfacelessInstance}, in the last place
   * anyone would look for it: `ecommerce-example`, phase 54's reference build
   * and the prettiest page this project has produced, declares all eleven of
   * `ProductCard`'s inputs `plug: "input"`. It renders in
   * `scripts/devtools/render-from-disk.js` only because that harness rewrites
   * every Component Inputs port before handing the project to the viewer.
   *
   * Nothing reported it. `PortWithoutPlug` asks whether a port has a direction;
   * nothing asked whether it has the right one, and `nonexistentPort` accepts
   * any name present in `instancePorts`, which are collected plug-blind.
   *
   * Warning severity, blocking for authored output. 22 corpus hits, all of them
   * that one component and its copy.
   */
  ComponentPortDirection = 'component-port-direction',
  /**
   * LAS-004 — a page component whose own graph is large enough that it has
   * almost certainly inlined sections that wanted to be components.
   *
   * **Info, and it never blocks.** `repeated-sibling-subtree` catches a page
   * that duplicated a subtree; this catches the more common shape of the same
   * mistake — a page written top to bottom, which is the order a model naturally
   * works in. The audit showed cold models already decompose once the doctrine
   * reaches them (both replay Homes: 7 and 8 nodes), so this is a backstop
   * against the 66-node regression, not pressure toward over-factoring.
   *
   * The threshold is the corpus's, not the doctrine's ~25 — see
   * `rules/oversizedPage.ts` for the census and why 25 would have nagged a
   * legitimately dense login form.
   */
  OversizedPage = 'oversized-page'
}

// ─── Location ─────────────────────────────────────────────────────────────────

/**
 * Where a diagnostic applies. Every field beyond `component` is optional because
 * different rules localise to different granularities (a whole component, a
 * node, a single port, or one connection). The editor uses `nodeId` to navigate;
 * the CLI renders the whole path.
 */
export interface DiagnosticLocation {
  /** Component identifier — the legacy path/name, e.g. "/#Home". */
  component: string;
  /** Node id within the component, when the diagnostic is about a node. */
  nodeId?: string;
  /** The node's type, included for readability in messages/UI. */
  nodeType?: string;
  /** A user-facing label for the node, when available. */
  nodeLabel?: string;
  /** Port name, when the diagnostic is about a specific port. */
  port?: string;
  /** 'input' | 'output', when the diagnostic is about a specific port. */
  plug?: 'input' | 'output';
  /** The offending connection, when the diagnostic is about a wire. */
  connection?: {
    fromId: string;
    fromProperty: string;
    toId: string;
    toProperty: string;
  };
}

// ─── Diagnostic ───────────────────────────────────────────────────────────────

export interface Diagnostic {
  code: DiagnosticCode;
  severity: Severity;
  /** Primary human/AI-readable message. Actionable on its own. */
  message: string;
  location: DiagnosticLocation;
  /**
   * A single best-guess replacement, when one is knowable (e.g. the nearest
   * catalog type by edit distance). Present ⇒ high-confidence fix.
   */
  suggestion?: string;
  /**
   * A bounded list of valid alternatives (e.g. the signal inputs a Text node
   * actually has). Lets an AI pick the right one without another round-trip.
   */
  alternatives?: string[];
}

// ─── Report ───────────────────────────────────────────────────────────────────

export interface ValidationSummary {
  errors: number;
  warnings: number;
  infos: number;
  /** Total nodes examined, for context in CLI output. */
  nodesChecked: number;
  /** Connection endpoints examined. */
  endpointsChecked: number;
}

export interface ValidationReport {
  diagnostics: Diagnostic[];
  summary: ValidationSummary;
}

// ─── Construction helpers ──────────────────────────────────────────────────────

export function summarize(diagnostics: Diagnostic[], counters: { nodesChecked: number; endpointsChecked: number }): ValidationSummary {
  let errors = 0;
  let warnings = 0;
  let infos = 0;
  for (const d of diagnostics) {
    if (d.severity === 'error') errors++;
    else if (d.severity === 'warning') warnings++;
    else infos++;
  }
  return { errors, warnings, infos, ...counters };
}

/** Order diagnostics for stable display: by component, then severity, then node id. */
export function sortDiagnostics(diagnostics: Diagnostic[]): Diagnostic[] {
  return [...diagnostics].sort((a, b) => {
    if (a.location.component !== b.location.component) {
      return a.location.component < b.location.component ? -1 : 1;
    }
    if (a.severity !== b.severity) {
      return SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity];
    }
    const an = a.location.nodeId ?? '';
    const bn = b.location.nodeId ?? '';
    if (an !== bn) return an < bn ? -1 : 1;
    return a.code < b.code ? -1 : a.code > b.code ? 1 : 0;
  });
}

// ─── Formatting (the edge) ──────────────────────────────────────────────────────

const SEVERITY_TAG: Record<Severity, string> = {
  error: 'ERROR',
  warning: 'WARN',
  info: 'INFO'
};

/** One diagnostic as a single human-readable line (no color codes). */
export function formatDiagnosticLine(d: Diagnostic): string {
  const loc = d.location;
  const where: string[] = [loc.component];
  if (loc.nodeId) {
    const label = loc.nodeLabel ? ` "${loc.nodeLabel}"` : '';
    const type = loc.nodeType ? ` (${loc.nodeType})` : '';
    where.push(`node ${loc.nodeId}${label}${type}`);
  }
  if (loc.port) where.push(`${loc.plug ?? 'port'} "${loc.port}"`);
  let line = `${SEVERITY_TAG[d.severity]} [${d.code}] ${where.join(' › ')}: ${d.message}`;
  if (d.suggestion) line += `\n    → did you mean \`${d.suggestion}\`?`;
  if (d.alternatives && d.alternatives.length > 0) {
    line += `\n    → available: ${d.alternatives.join(', ')}`;
  }
  return line;
}

/** Full report as human-readable text, grouped by severity summary at the end. */
export function formatReport(report: ValidationReport, target?: string): string {
  const lines: string[] = [];
  if (target) lines.push(`# ${target}`);
  for (const d of sortDiagnostics(report.diagnostics)) {
    lines.push(formatDiagnosticLine(d));
  }
  const s = report.summary;
  lines.push('');
  lines.push(
    `${s.errors} error(s), ${s.warnings} warning(s), ${s.infos} info — ` +
      `${s.nodesChecked} nodes, ${s.endpointsChecked} endpoints checked`
  );
  return lines.join('\n');
}

/** The machine-readable form used by the CLI's --json mode and the MCP server. */
export function toJSON(report: ValidationReport, target?: string): Record<string, unknown> {
  return {
    target,
    summary: report.summary,
    diagnostics: sortDiagnostics(report.diagnostics)
  };
}
