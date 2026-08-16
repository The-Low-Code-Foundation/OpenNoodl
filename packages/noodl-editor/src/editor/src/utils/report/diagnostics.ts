/**
 * ALPHA-007 §4 — the `diagnostics` payload, written for two readers.
 *
 * It lands in the issue body inside a `render: json` fence, which makes it a
 * stable region a human can skim and an agent can find without parsing prose:
 *
 *     gh issue view <n> --json body -q .body
 *
 * then take the first ```json fence. That is the join between Part A and
 * Part B, and it is why they are one task.
 *
 * Two rules govern every change to this file:
 *
 * 1. **Allow-list, never filter.** Every field below is named. The project is
 *    summarised into counts, booleans and a bucketed histogram; it is never
 *    walked-and-filtered. This is the actual privacy control (§3) — the
 *    regex redactor is only the second line, for free text.
 * 2. **The shape is a contract.** `schema` is bumped when a reader would break.
 *    Part B parses this; a silent shape change breaks triage without breaking
 *    anything visible.
 *
 * Pure: no imports, no I/O, no editor singletons. `collect.ts` is the impure
 * half that reads the real models and calls in here.
 *
 * @module utils/report/diagnostics
 */

/** Bumped only when an existing reader would misread the new shape. */
export const DIAGNOSTICS_SCHEMA = 1;

/** A component-instance node. Its type name *is* a component path — user content. */
export const TYPE_COMPONENT = '<component>';
/** A node type the library could not resolve. Its name may be a user's module. */
export const TYPE_UNKNOWN = '<unknown>';
/** The long tail of the histogram, collapsed to keep the payload inside budget. */
export const TYPE_OTHER = '<other>';

/** How many distinct node types survive into the histogram. */
const MAX_TYPES = 25;

/** Backend kinds we are willing to name. Anything else becomes `other`. */
const KNOWN_BACKEND_TYPES = ['nodegx', 'parse', 'byob', 'local'];

export interface NodeLike {
  typename?: string;
  children?: NodeLike[];
}

export interface ComponentLike {
  name?: string;
  graph?: {
    roots?: NodeLike[];
    connections?: unknown[];
  };
}

export interface ProjectLike {
  getComponents?(): ComponentLike[];
  getMetaData?(key: string): unknown;
}

export interface ProjectSummary {
  open: true;
  /** `'v2'`, `'legacy'` or `'unknown'` — how the project is stored on disk. */
  format: string;
  components: number;
  nodes: number;
  connections: number;
  /** Node count by type, bucketed. Never contains a component or page name. */
  nodeTypes: Record<string, number>;
  /** Whether a backend is configured. **Never** the endpoint (§3). */
  backendConfigured: boolean;
  /** Which kind, from a closed set. Absent when nothing is configured. */
  backendType?: string;
}

export interface SummariseOptions {
  /**
   * Type names the node library resolved. A type not in here is bucketed as
   * `<unknown>`, because an unresolved name can be a user's own module — and a
   * module named after their client is exactly the leak §3 forbids.
   *
   * Omit to skip the check (tests, and the case where the library has not
   * finished loading); component paths are still bucketed either way.
   */
  knownTypes?: Set<string> | null;
  /** `project._projectFormat`, supplied by the caller so this stays pure. */
  format?: string;
}

/**
 * Which name a node type may be published under.
 *
 * ⚠️ **Exported for UNI-011's graph excerpt**, which needed exactly this vocabulary and would
 * otherwise have carried a second copy of it. The rule is a privacy control, and two
 * implementations of one privacy control is the arrangement where a fix lands on one of them.
 * Nothing about the behaviour changed when the keyword was added.
 */
export function bucketTypeName(typename: string | undefined, knownTypes?: Set<string> | null): string {
  if (!typename) return TYPE_UNKNOWN;
  // Component instances carry the component's full path as their type name —
  // `/Form/Text Input`. That is the user's own naming, verbatim.
  if (typename.charAt(0) === '/') return TYPE_COMPONENT;
  if (knownTypes && !knownTypes.has(typename)) return TYPE_UNKNOWN;
  return typename;
}

/** Keep the head of the histogram; fold the tail into one entry. */
function capHistogram(counts: Record<string, number>): Record<string, number> {
  const entries = Object.keys(counts).map((key) => [key, counts[key]] as [string, number]);
  if (entries.length <= MAX_TYPES) {
    entries.sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
    const ordered: Record<string, number> = {};
    for (const [key, count] of entries) ordered[key] = count;
    return ordered;
  }

  entries.sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  const head = entries.slice(0, MAX_TYPES);
  const tail = entries.slice(MAX_TYPES);

  const capped: Record<string, number> = {};
  for (const [key, count] of head) capped[key] = count;
  capped[TYPE_OTHER] = tail.reduce((sum, entry) => sum + entry[1], 0);
  return capped;
}

/**
 * Reduce an open project to shape.
 *
 * Duck-typed on purpose: the real `ProjectModel` cannot be constructed outside
 * a renderer, and criterion 4 requires this to be demonstrated against a
 * hostile fixture rather than argued.
 *
 * Note the traversal walks `children` by hand rather than using
 * `graph.forEachNode`. That helper stops on a truthy return, which has caught
 * people in this codebase before; here there is nothing to stop for.
 */
export function summariseProject(project: ProjectLike | null | undefined, options: SummariseOptions = {}) {
  if (!project || typeof project.getComponents !== 'function') return null;

  const components = project.getComponents() || [];
  const counts: Record<string, number> = {};
  let nodes = 0;
  let connections = 0;

  const visit = (node: NodeLike) => {
    if (!node) return;
    nodes++;
    const bucket = bucketTypeName(node.typename, options.knownTypes);
    counts[bucket] = (counts[bucket] || 0) + 1;
    const children = node.children || [];
    for (const child of children) visit(child);
  };

  for (const component of components) {
    const graph = component && component.graph;
    if (!graph) continue;
    connections += (graph.connections || []).length;
    for (const root of graph.roots || []) visit(root);
  }

  const cloudServices = (typeof project.getMetaData === 'function' ? project.getMetaData('cloudservices') : null) as
    | { endpoint?: string; type?: string }
    | null
    | undefined;

  // The endpoint is read only to answer "is one configured" — the string itself
  // is never copied into the summary. That is §3's rule and the one line in
  // this file worth re-reading before changing it.
  const backendConfigured = Boolean(cloudServices && cloudServices.endpoint);

  const summary: ProjectSummary = {
    open: true,
    format: options.format || 'unknown',
    components: components.length,
    nodes,
    connections,
    nodeTypes: capHistogram(counts),
    backendConfigured
  };

  if (backendConfigured) {
    const type = String((cloudServices && cloudServices.type) || '').toLowerCase();
    summary.backendType = KNOWN_BACKEND_TYPES.indexOf(type) !== -1 ? type : 'other';
  }

  return summary;
}

export interface DiagnosticsInput {
  /** Joins the issue to the folder written on disk (§5). */
  reportId: string;
  /** ISO-8601, at screenshot time — which is *click* time, not send time. */
  capturedAt: string;
  app: {
    version: string;
    buildNumber?: string;
    /** `false` when running from source; a report from dev means something different. */
    packaged: boolean;
  };
  os: {
    /** `process.platform` verbatim: `darwin` | `win32` | `linux`. */
    platform: string;
    /** `process.arch` verbatim: `arm64` | `x64`. */
    arch: string;
    /** `os.release()`, when the caller has it. */
    release?: string;
  };
  editor: {
    /** Which page the editor was on: `projects` | `editor` | … */
    route: string;
    /** The `surface` form value, so the two never disagree. */
    surface: string;
    /** What kind of document was open: `component` | `workflow` | `code` | `none`. */
    document?: string;
  };
  /**
   * The severity the reporter chose, as a closed-vocabulary slug
   * (`blocker` | `serious` | `annoying` | `cosmetic`).
   *
   * Duplicated from the dropdown on purpose: Part B's labelling step should
   * read a slug out of the JSON fence rather than string-matching prose that a
   * copy edit can change.
   */
  severity?: string;
  project?: ProjectSummary | null;
  ai?: {
    configured: boolean;
    /** Provider id only. A key never reaches this module. */
    provider?: string;
  };
  /** How many entries the error tail held **before** truncation for the URL. */
  errorCount: number;
  /** True when the URL budget forced the issue body to carry less than the bundle. */
  truncated?: string[];
}

export interface Diagnostics extends DiagnosticsInput {
  schema: number;
}

/**
 * Assemble the payload. Flat, ordered, and stable — key order is not part of
 * the contract but a stable one keeps issue-to-issue diffs readable.
 */
export function buildDiagnostics(input: DiagnosticsInput): Diagnostics {
  const diagnostics: Diagnostics = {
    schema: DIAGNOSTICS_SCHEMA,
    reportId: input.reportId,
    capturedAt: input.capturedAt,
    app: input.app,
    os: input.os,
    editor: input.editor,
    severity: input.severity,
    project: input.project || null,
    ai: input.ai || { configured: false },
    errorCount: input.errorCount
  };

  if (input.truncated && input.truncated.length) diagnostics.truncated = input.truncated;

  return diagnostics;
}

/** The exact text that goes into the `diagnostics` form field. */
export function formatDiagnostics(diagnostics: Diagnostics): string {
  return JSON.stringify(diagnostics, null, 2);
}
