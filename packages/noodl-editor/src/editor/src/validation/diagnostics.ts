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
  MissingBackend = 'missing-backend'
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
