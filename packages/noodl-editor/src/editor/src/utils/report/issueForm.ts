/**
 * ALPHA-007 §2 — the prefill contract.
 *
 * GitHub issue *forms* accept a query parameter per field, named after the
 * field's `id` in the YAML. So the `id`s in
 * `.github/ISSUE_TEMPLATE/bug_report.yml` are a wire format shared between a
 * file nobody thinks of as code and this module. A rename on either side
 * silently produces issues with an empty version field and nobody notices for a
 * month.
 *
 * That is why the constants below are duplicated from the YAML *and* checked
 * against it by `tests-unit/alpha-007/issue-form-contract.test.ts`, which reads
 * the real file. The duplication is the point: it turns a silent break into a
 * red test (acceptance criterion 3).
 *
 * For a `dropdown`, the query value must be the **option string, verbatim** —
 * GitHub matches on the text, not an index. The contract test asserts every
 * value this module can emit is present in the YAML's option list.
 *
 * Pure: no imports, no I/O.
 *
 * @module utils/report/issueForm
 */

/** Where issues are filed. Matches `build.publish` in `package.json`. */
export const ISSUE_REPO = 'The-Low-Code-Foundation/OpenNoodl';

/** The form, by file name — GitHub's `template=` parameter takes the file. */
export const ISSUE_TEMPLATE = 'bug_report.yml';

/**
 * Every field id this module writes. Read by the contract test, so adding one
 * here without adding it to the YAML is a red test rather than a silent drop.
 */
export const FIELD = {
  whatHappened: 'what-happened',
  surface: 'surface',
  severity: 'severity',
  version: 'version',
  os: 'os',
  freshProject: 'fresh-project',
  steps: 'steps',
  errors: 'errors',
  diagnostics: 'diagnostics'
} as const;

/** `surface` dropdown options, verbatim from the YAML. */
export const SURFACE_OPTIONS = [
  'The editor (canvas, panels, menus)',
  'Preview (the live app inside the editor)',
  'A deployed or exported app',
  'The backend (data, cloud functions, workflows)',
  'The AI features (authoring, explain, review)',
  'Install, launch, or auto-update',
  'Not sure'
] as const;

/** `os` dropdown options, verbatim from the YAML. */
export const OS_OPTIONS = ['macOS (Apple Silicon)', 'macOS (Intel)', 'Windows', 'Linux'] as const;

/** `fresh-project` dropdown options, verbatim from the YAML. */
export const FRESH_PROJECT_OPTIONS = [
  'Yes — a new project does it too',
  'No — only my existing project',
  "Haven't tried",
  "Can't tell (the bug is about creating/opening projects)"
] as const;

/**
 * `severity` dropdown options, verbatim from the YAML.
 *
 * Four levels, not the three or five of the spec's open question 1. Three
 * collapses "blocks me" into "serious", and that is the only distinction that
 * changes what a maintainer does *today*; five asks a stranger to calibrate a
 * scale they have never seen. Each option is phrased as a consequence to the
 * reporter rather than a judgement about the code, because the reporter can
 * answer the first honestly and cannot answer the second at all.
 *
 * `slug` is what Part B's labelling step reads (`severity:blocker`); the label
 * cannot come from a `labels=` URL parameter, because applying labels needs
 * triage permission and a reporter is not a collaborator.
 */
export const SEVERITY_OPTIONS = [
  { label: 'Blocks me — I cannot work around it', slug: 'blocker' },
  { label: 'Serious — there is a workaround, but it costs me', slug: 'serious' },
  { label: 'Annoying — wrong, but I can carry on', slug: 'annoying' },
  { label: 'Cosmetic — it looks wrong but works', slug: 'cosmetic' }
] as const;

export type SurfaceOption = (typeof SURFACE_OPTIONS)[number];
export type OsOption = (typeof OS_OPTIONS)[number];
export type FreshProjectOption = (typeof FRESH_PROJECT_OPTIONS)[number];

/**
 * `process.platform` + `process.arch` onto the four `os` options.
 *
 * The mapping is exact and needs no guesswork, which is the whole reason `os`
 * is an app-filled field rather than a question.
 */
export function osOptionFor(platform: string, arch: string): OsOption {
  if (platform === 'darwin') return arch === 'arm64' ? 'macOS (Apple Silicon)' : 'macOS (Intel)';
  if (platform === 'win32') return 'Windows';
  return 'Linux';
}

export interface IssueFields {
  [key: string]: string | undefined;
}

/**
 * Byte budget for the prefilled query string.
 *
 * Long URLs are silently *mangled* rather than rejected, which is the worst
 * failure mode available — the reporter sees a half-filled form and assumes
 * NodeGX is broken. 6KB is well inside every browser and server limit we have
 * evidence for, and anything trimmed to fit is preserved whole in the report
 * folder (§5).
 */
export const URL_BUDGET_BYTES = 6144;

/** Appended to any field this module shortens, so the reader knows. */
export const TRUNCATION_NOTE = '\n[trimmed to fit the URL — the full copy is in the report folder]';

/**
 * Never cut the reporter's description below this. A report whose first
 * paragraph survives is still triageable; one cut to nothing is noise.
 */
const MIN_WHAT_HAPPENED = 500;

function encodeField(id: string, value: string): string {
  return encodeURIComponent(id) + '=' + encodeURIComponent(value);
}

/** The query string, in the order the fields appear in the form. */
export function encodeIssueQuery(fields: IssueFields): string {
  const parts = ['template=' + encodeURIComponent(ISSUE_TEMPLATE)];
  for (const id of Object.keys(fields)) {
    const value = fields[id];
    if (value === undefined || value === null || value === '') continue;
    parts.push(encodeField(id, value));
  }
  return parts.join('&');
}

export function issueUrl(fields: IssueFields, repo: string = ISSUE_REPO): string {
  return `https://github.com/${repo}/issues/new?` + encodeIssueQuery(fields);
}

/** Keep the *end* of a log tail — the newest lines are the ones that matter. */
function keepTail(value: string, limit: number): string {
  if (value.length <= limit) return value;
  return value.slice(value.length - limit) + TRUNCATION_NOTE;
}

/** Keep the *start* of prose — a reporter front-loads the point. */
function keepHead(value: string, limit: number): string {
  if (value.length <= limit) return value;
  return value.slice(0, limit) + TRUNCATION_NOTE;
}

export interface FitOptions {
  budgetBytes?: number;
  /**
   * A valid, minimal replacement for the `diagnostics` fence.
   *
   * `diagnostics` is never *cut* — a truncated JSON object is worse than a
   * small one, because Part B's parse fails rather than degrading. When the
   * budget bites, the whole object is swapped for this and the full copy stays
   * in the report folder.
   */
  minimalDiagnostics?: string;
}

export interface FitResult {
  fields: IssueFields;
  /** Ids that were shortened or replaced, for the `truncated` diagnostics key. */
  truncated: string[];
}

/**
 * Shrink `fields` until the query fits the budget, sacrificing in the order a
 * reader would: the captured tail first, the machine payload next, the
 * reporter's own words last.
 */
export function fitToBudget(fields: IssueFields, options: FitOptions = {}): FitResult {
  const budget = options.budgetBytes ?? URL_BUDGET_BYTES;
  const out: IssueFields = { ...fields };
  const truncated: string[] = [];

  const fits = () => encodeIssueQuery(out).length <= budget;
  const note = (id: string) => {
    if (truncated.indexOf(id) === -1) truncated.push(id);
  };

  if (fits()) return { fields: out, truncated };

  for (const limit of [2000, 800, 0]) {
    if (!out[FIELD.errors]) break;
    out[FIELD.errors] = limit ? keepTail(out[FIELD.errors] as string, limit) : '';
    note(FIELD.errors);
    if (fits()) return { fields: out, truncated };
  }

  if (out[FIELD.diagnostics] && options.minimalDiagnostics) {
    out[FIELD.diagnostics] = options.minimalDiagnostics;
    note(FIELD.diagnostics);
    if (fits()) return { fields: out, truncated };
  }

  for (const limit of [1000, 0]) {
    if (!out[FIELD.steps]) break;
    out[FIELD.steps] = limit ? keepHead(out[FIELD.steps] as string, limit) : '';
    note(FIELD.steps);
    if (fits()) return { fields: out, truncated };
  }

  // Last resort. `what-happened` is required by the form, so it is shortened
  // rather than dropped — an empty required field would block the reporter at
  // the very last step, which is exactly the drop-off this task exists to stop.
  //
  // Shrunk in a loop rather than by arithmetic: a character's *encoded* length
  // is 1–9 bytes depending on what it is, so "cut the overspend" undershoots on
  // anything but ASCII and leaves the URL over budget.
  const original = out[FIELD.whatHappened];
  if (original) {
    note(FIELD.whatHappened);
    let limit = original.length;
    while (!fits() && limit > MIN_WHAT_HAPPENED) {
      const overspend = encodeIssueQuery(out).length - budget;
      limit = Math.max(MIN_WHAT_HAPPENED, limit - Math.max(overspend, 32));
      out[FIELD.whatHappened] = keepHead(original, limit);
    }
  }

  return { fields: out, truncated };
}
