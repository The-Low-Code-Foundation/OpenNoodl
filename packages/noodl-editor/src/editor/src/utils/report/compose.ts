/**
 * ALPHA-007 — assembling one report.
 *
 * Everything the composer sends or writes is produced here, from plain inputs,
 * with no models, no Electron and no I/O. That is not tidiness: acceptance
 * criterion 4 says redaction "fails if it is argued rather than demonstrated",
 * and a demonstration needs a hostile project fixture to be fed in and the
 * *entire* output inspected. This function is the seam that makes that possible
 * — `tests-unit/alpha-007/hostile-fixture.test.ts` calls exactly this.
 *
 * @module utils/report/compose
 */

import {
  Diagnostics,
  DIAGNOSTICS_SCHEMA,
  ProjectLike,
  buildDiagnostics,
  formatDiagnostics,
  summariseProject
} from './diagnostics';
import { ErrorTailEntry, formatErrorTail } from './errorTail';
import {
  FIELD,
  IssueFields,
  SEVERITY_OPTIONS,
  fitToBudget,
  issueUrl,
  osOptionFor
} from './issueForm';
import { RedactorOptions } from './redact';

export interface ReportUserInput {
  whatHappened: string;
  surface: string;
  /** Slug from `SEVERITY_OPTIONS`. */
  severity: string;
  freshProject: string;
  steps?: string;
}

export interface ComposeReportInput {
  reportId: string;
  /** ISO-8601 of the *screenshot*, which is taken at click time (§1). */
  capturedAt: string;
  user: ReportUserInput;
  app: { version: string; buildNumber?: string; packaged: boolean };
  os: { platform: string; arch: string; release?: string };
  editor: { route: string; document?: string };
  project?: ProjectLike | null;
  /** `project._projectFormat`; passed in so `summariseProject` stays pure. */
  projectFormat?: string;
  /** Node type names the library resolved — see `SummariseOptions.knownTypes`. */
  knownTypes?: Set<string> | null;
  ai?: { configured: boolean; provider?: string };
  errors?: readonly ErrorTailEntry[];
  /** Machine paths, for the redactor. */
  paths?: RedactorOptions;
  /** Injectable for tests. */
  now?: number;
  budgetBytes?: number;
}

export interface ComposedReport {
  /** The exact query values handed to GitHub, after budget fitting. */
  fields: IssueFields;
  url: string;
  /** The **untruncated** payload — this is what the bundle keeps. */
  diagnostics: Diagnostics;
  /** Field ids the URL budget forced us to shorten. */
  truncated: string[];
  /** Files for the exported bundle (§5), keyed by name. */
  bundle: Record<string, string>;
}

function severityLabel(slug: string): string {
  const option = SEVERITY_OPTIONS.find((entry) => entry.slug === slug);
  return option ? option.label : SEVERITY_OPTIONS[SEVERITY_OPTIONS.length - 1].label;
}

/**
 * The `diagnostics` value used when the full one will not fit.
 *
 * A *cut* JSON object is worse than a small one: Part B's parse fails outright
 * rather than degrading, and a failed parse looks like a bug in the reporter.
 * So the fence always holds valid JSON, and says where the rest is.
 */
function minimalDiagnostics(full: Diagnostics): string {
  return JSON.stringify(
    {
      schema: DIAGNOSTICS_SCHEMA,
      reportId: full.reportId,
      capturedAt: full.capturedAt,
      app: full.app,
      os: full.os,
      severity: full.severity,
      truncated: ['diagnostics'],
      note: 'Too large for the URL. The full payload is in the report folder on the reporter’s machine.'
    },
    null,
    2
  );
}

/** A human-readable copy of the issue, for the bundle's fallback path. */
function renderBundleMarkdown(fields: IssueFields, reportId: string): string {
  const section = (heading: string, body: string | undefined, fence?: string) => {
    if (!body) return '';
    const content = fence ? '```' + fence + '\n' + body + '\n```' : body;
    return `### ${heading}\n\n${content}\n\n`;
  };

  return (
    `# NodeGX problem report ${reportId}\n\n` +
    'This is the same content the "Report a problem" dialog put into the GitHub\n' +
    'issue form. If you would rather not use GitHub, send this folder — it also\n' +
    'contains the screenshot — to whoever gave you this build.\n\n' +
    section('What happened', fields[FIELD.whatHappened]) +
    section('Where', fields[FIELD.surface]) +
    section('How bad is it', fields[FIELD.severity]) +
    section('NodeGX version', fields[FIELD.version]) +
    section('Operating system', fields[FIELD.os]) +
    section('Does it happen in a brand-new project?', fields[FIELD.freshProject]) +
    section('Steps to reproduce', fields[FIELD.steps]) +
    section('Any error text', fields[FIELD.errors], 'text') +
    section('Diagnostics', fields[FIELD.diagnostics], 'json')
  );
}

export function composeReport(input: ComposeReportInput): ComposedReport {
  const now = input.now ?? Date.now();

  const tail = formatErrorTail(input.errors || [], { ...(input.paths || {}), now });

  const diagnostics = buildDiagnostics({
    reportId: input.reportId,
    capturedAt: input.capturedAt,
    app: input.app,
    os: input.os,
    editor: {
      route: input.editor.route,
      surface: input.user.surface,
      document: input.editor.document
    },
    severity: input.user.severity,
    project: summariseProject(input.project, {
      knownTypes: input.knownTypes,
      format: input.projectFormat
    }),
    ai: input.ai,
    errorCount: tail.count
  });

  const fields: IssueFields = {
    [FIELD.whatHappened]: input.user.whatHappened,
    [FIELD.surface]: input.user.surface,
    [FIELD.severity]: severityLabel(input.user.severity),
    [FIELD.version]: input.app.buildNumber
      ? `${input.app.version} (build ${input.app.buildNumber})`
      : input.app.version,
    [FIELD.os]: osOptionFor(input.os.platform, input.os.arch),
    [FIELD.freshProject]: input.user.freshProject,
    [FIELD.steps]: input.user.steps,
    [FIELD.errors]: tail.text,
    [FIELD.diagnostics]: formatDiagnostics(diagnostics)
  };

  const fitted = fitToBudget(fields, {
    budgetBytes: input.budgetBytes,
    minimalDiagnostics: minimalDiagnostics(diagnostics)
  });

  if (fitted.truncated.length) diagnostics.truncated = fitted.truncated;

  // The bundle carries the *unfitted* payload: it exists precisely so nothing
  // is lost to the URL budget (§5).
  const bundleFields: IssueFields = { ...fields, [FIELD.diagnostics]: formatDiagnostics(diagnostics) };

  return {
    fields: fitted.fields,
    url: issueUrl(fitted.fields),
    diagnostics,
    truncated: fitted.truncated,
    bundle: {
      'diagnostics.json': formatDiagnostics(diagnostics),
      'report.md': renderBundleMarkdown(bundleFields, input.reportId)
    }
  };
}

/** `r-20260803-142233-8f21`: sortable, unique enough, and safe as a folder name. */
export function newReportId(now: Date = new Date(), random: () => number = Math.random): string {
  const pad = (value: number) => String(value).padStart(2, '0');
  const date =
    `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}` +
    `-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
  const suffix = Math.floor(random() * 0x10000)
    .toString(16)
    .padStart(4, '0');
  return `r-${date}-${suffix}`;
}
