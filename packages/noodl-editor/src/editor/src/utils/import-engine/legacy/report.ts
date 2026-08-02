/**
 * LIB-006: the import report — one schema, two renderings.
 *
 * {@link buildReport} assembles the object. {@link renderReportMarkdown} renders
 * that same object for a person. There is deliberately no second source: the
 * Markdown is a projection of the JSON, so an agent parsing the JSON and a human
 * reading the Markdown cannot be told different things. The task's third risk —
 * "the report is written for humans and an agent cannot use it (or vice versa)"
 * — is structural, so the mitigation has to be structural too.
 *
 * @module noodl-editor/utils/import-engine/legacy/report
 */

import {
  AssistantHandoff,
  IMPORT_REPORT_FORMAT_VERSION,
  ImportReport,
  LegacyFinding,
  LegacyOutcome
} from './types';
import { computeVerdict, tallyOutcomes, findingWeight } from './verdict';

export interface BuildReportInput {
  sourceDir: string;
  sourceProjectName?: string;
  sourceProjectVersion?: string;
  targetProjectName?: string;
  findings: LegacyFinding[];
  constructsAssessed: number;
  nodeCount: number;
  /** Source node id → target node id for re-keyed nodes. */
  nodeIdMap?: Record<string, string>;
  /** Injected so the report is reproducible in tests. */
  now?: Date;
}

/** Outcomes that mean someone has to do something. */
const NEEDS_ACTION: ReadonlySet<LegacyOutcome> = new Set<LegacyOutcome>(['placeholder', 'dropped']);

/**
 * What an assistant is told it may assume. This list is not decoration: the
 * compatibility policy accepts "the assistant will fix it" *because* these four
 * capabilities exist, so the report names them rather than leaving the assistant
 * to discover them.
 */
const HANDOFF_INSTRUCTIONS: readonly string[] = [
  'Every entry with outcome `placeholder` is a node still present in the project, with its original type name, parameters and wiring intact. Nothing was dropped; you do not need the source project to know what was there.',
  'Look each `equivalents` type up in the node catalog (SUB-004/005) before proposing a replacement — the ports differ between a legacy node and its replacement more often than not, and `portChanges` lists the ones we know about.',
  'Propose repairs through the authoring loop (AIX-002) as a whole-component candidate. It arrives as a reviewable diff against the live component; the user accepts or rejects it. Do not edit nodes in place.',
  'The semantic validator (SUB-006) will reject a candidate that leaves a placeholder unresolved or wires a port that does not exist. Run it before submitting; its diagnostics are the fastest way to find a wrong port name.',
  'When `verdict.recommendation` is `rebuild`, say so to the user before offering repairs. A specification to rebuild from is a better deliverable than twenty partial fixes, and the entries below are that specification.'
];

function buildHandoff(findings: LegacyFinding[]): AssistantHandoff {
  const repairable: string[] = [];
  const unrepairable: string[] = [];
  const catalogTypes = new Set<string>();

  for (const finding of findings) {
    if (!NEEDS_ACTION.has(finding.outcome)) {
      continue;
    }
    if (finding.equivalents.length > 0) {
      repairable.push(finding.id);
    } else {
      unrepairable.push(finding.id);
    }
    for (const type of finding.equivalents) {
      catalogTypes.add(type);
    }
  }

  return {
    repairable,
    unrepairable,
    catalogTypes: [...catalogTypes].sort(),
    instructions: [...HANDOFF_INSTRUCTIONS]
  };
}

export function buildReport(input: BuildReportInput): ImportReport {
  const { findings, constructsAssessed, nodeCount } = input;
  const counts = tallyOutcomes(findings, constructsAssessed);
  const accountedFor = findings.reduce((sum, f) => sum + findingWeight(f), 0);

  return {
    reportFormatVersion: IMPORT_REPORT_FORMAT_VERSION,
    generatedBy: 'LIB-006',
    generatedAt: (input.now ?? new Date()).toISOString(),
    source: {
      dir: input.sourceDir,
      projectName: input.sourceProjectName,
      projectVersion: input.sourceProjectVersion
    },
    target: { projectName: input.targetProjectName },
    counts,
    coverage: {
      constructsAssessed,
      findingsEmitted: findings.length,
      silentlyConverted: Math.max(0, constructsAssessed - accountedFor)
    },
    findings,
    verdict: computeVerdict({ counts, constructsAssessed, nodeCount }),
    handoff: buildHandoff(findings),
    nodeIdMap: input.nodeIdMap
  };
}

/**
 * The one-line summary an import surface shows when it is done.
 *
 * Deliberately blunt when the verdict is `rebuild`: the policy's position is
 * that saying so plainly beats a broken half-conversion, and a summary that
 * reads "Imported successfully" over a 40%-broken project is the failure mode
 * this whole task exists to prevent.
 */
export function reportSummaryLine(report: ImportReport): string {
  const { verdict, counts } = report;
  if (verdict.recommendation === 'proceed') {
    return counts['converted-with-changes'] > 0
      ? `Imported. ${counts['converted-with-changes']} construct${counts['converted-with-changes'] === 1 ? ' was' : 's were'} rewritten — see the import report.`
      : 'Imported. Everything converted.';
  }
  if (verdict.recommendation === 'rebuild') {
    return `Imported, but ${verdict.unconvertedCount} of ${report.coverage.constructsAssessed} constructs did not convert. For a project this size, rebuilding is likely cheaper than repairing — see the import report.`;
  }
  return `Imported. ${verdict.unconvertedCount} construct${verdict.unconvertedCount === 1 ? '' : 's'} could not be converted and ${verdict.unconvertedCount === 1 ? 'is' : 'are'} marked as errors on the canvas — see the import report.`;
}

// ─── Markdown rendering ──────────────────────────────────────────────────────

const OUTCOME_HEADING: Record<LegacyOutcome, string> = {
  placeholder: 'Could not be converted',
  dropped: 'Not carried across',
  'converted-with-changes': 'Converted, with changes',
  converted: 'Converted — notes'
};

/** Order sections by how much attention they deserve. */
const SECTION_ORDER: readonly LegacyOutcome[] = ['placeholder', 'dropped', 'converted-with-changes', 'converted'];

function locationLine(finding: LegacyFinding): string | undefined {
  const parts: string[] = [];
  const loc = finding.location;
  if (loc?.component) {
    parts.push(`component \`${loc.component}\``);
  }
  if (loc?.nodeLabel) {
    parts.push(`node "${loc.nodeLabel}"`);
  } else if (loc?.nodeId) {
    parts.push(`node \`${loc.nodeId}\``);
  }
  if (loc?.parameter) {
    parts.push(`parameter \`${loc.parameter}\``);
  }
  if (loc?.field) {
    parts.push(`field \`${loc.field}\``);
  }
  if (parts.length === 0 && finding.occurrences && finding.occurrences > 1) {
    return `${finding.occurrences} instances`;
  }
  return parts.length > 0 ? parts.join(', ') : undefined;
}

function renderFinding(finding: LegacyFinding): string[] {
  const lines: string[] = [];
  lines.push(`#### \`${finding.id}\``);
  lines.push('');
  lines.push(finding.message);
  lines.push('');
  const where = locationLine(finding);
  if (where) {
    lines.push(`- **Where:** ${where}`);
  }
  if (finding.converted) {
    lines.push(`- **Became:** \`${finding.converted}\``);
  }
  if (finding.equivalents.length > 0) {
    lines.push(`- **Consider:** ${finding.equivalents.map((e) => `\`${e}\``).join(', ')}`);
  }
  if (finding.portChanges && finding.portChanges.length > 0) {
    const changes = finding.portChanges.map((p) => `\`${p.from}\` → \`${p.to}\``).join(', ');
    lines.push(`- **Ports that differ:** ${changes}`);
  }
  if (finding.recommendation) {
    lines.push(`- **What to do:** ${finding.recommendation}`);
  }
  lines.push('');
  return lines;
}

/**
 * Render the report for a person. Every fact here comes off the `ImportReport`
 * object — nothing is recomputed, so the two renderings cannot drift.
 */
export function renderReportMarkdown(report: ImportReport): string {
  const lines: string[] = [];

  lines.push('# Import report');
  lines.push('');
  lines.push(
    `Imported from \`${report.source.dir}\`${report.source.projectName ? ` ("${report.source.projectName}")` : ''} on ${report.generatedAt}.`
  );
  lines.push('');
  lines.push(
    'NodeGX is a fresh start, and legacy projects import on a best-effort basis. This file is the honest half of that: every construct in the imported set is accounted for below, nothing was silently dropped, and anything that could not be converted is still in the project — visibly marked, with its original type and parameters — rather than deleted.'
  );
  lines.push('');

  // ── Verdict ──
  lines.push('## Verdict');
  lines.push('');
  lines.push(`**${report.verdict.recommendation.toUpperCase()}** — ${report.verdict.message}`);
  lines.push('');
  for (const reason of report.verdict.reasons) {
    lines.push(`- ${reason}`);
  }
  lines.push('');

  // ── Summary ──
  lines.push('## Summary');
  lines.push('');
  lines.push('| Outcome | Constructs |');
  lines.push('|---|---|');
  for (const outcome of SECTION_ORDER) {
    lines.push(`| ${OUTCOME_HEADING[outcome]} (\`${outcome}\`) | ${report.counts[outcome]} |`);
  }
  lines.push(`| **Total assessed** | **${report.coverage.constructsAssessed}** |`);
  lines.push('');
  lines.push(
    `${report.coverage.findingsEmitted} entr${report.coverage.findingsEmitted === 1 ? 'y' : 'ies'} below. The remaining ${report.coverage.silentlyConverted} construct${report.coverage.silentlyConverted === 1 ? '' : 's'} used current node types and converted without comment — they are counted, not listed.`
  );
  lines.push('');

  // ── Findings ──
  for (const outcome of SECTION_ORDER) {
    const section = report.findings.filter((f) => f.outcome === outcome);
    if (section.length === 0) {
      continue;
    }
    lines.push(`## ${OUTCOME_HEADING[outcome]}`);
    lines.push('');
    for (const finding of section) {
      lines.push(...renderFinding(finding));
    }
  }

  // ── Hand-off ──
  lines.push('## For your AI assistant');
  lines.push('');
  lines.push(
    `This report is addressed to an assistant as much as to you. The machine-readable form is \`import-report.json\` beside this file — an assistant should read that rather than parse this prose.`
  );
  lines.push('');
  if (report.handoff.repairable.length > 0) {
    lines.push(`**Repairable (${report.handoff.repairable.length}):** ${report.handoff.repairable.map((id) => `\`${id}\``).join(', ')}`);
    lines.push('');
  }
  if (report.handoff.unrepairable.length > 0) {
    lines.push(
      `**No known equivalent (${report.handoff.unrepairable.length}):** ${report.handoff.unrepairable.map((id) => `\`${id}\``).join(', ')} — these are rebuilds, not repairs.`
    );
    lines.push('');
  }
  for (const instruction of report.handoff.instructions) {
    lines.push(`- ${instruction}`);
  }
  lines.push('');

  return lines.join('\n');
}
