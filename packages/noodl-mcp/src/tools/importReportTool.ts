/**
 * LIB-006: `get_import_report` — the legacy import report, for an external agent.
 *
 * This is the other half of the hand-off. Inside the editor, the authoring loop
 * gets the report through `ContextBuilder.importReport()`; an agent driving the
 * project through MCP gets it here. `COMPATIBILITY-POLICY.md` accepts "the
 * importing user's AI assistant fixes it" as the answer for anything the
 * importer cannot convert — that is only true if the assistant can be told what
 * broke, and this is the telling.
 *
 * Read-only, and always registered: knowing what an import could not convert is
 * useful long before anyone is allowed to change anything.
 *
 * @module noodl-mcp/tools/importReportTool
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import fs from 'node:fs';
import path from 'node:path';
import { z } from 'zod';

import { IMPORT_REPORT_FORMAT_VERSION, IMPORT_REPORT_JSON_PATH, renderReportForAssistant } from '../editor-deps';
import type { ImportReport } from '../editor-deps';
import type { ProjectBinding } from '../project/ProjectBinding';
import type { ProjectStore } from '../project/ProjectStore';
import { guarded, jsonResult } from './util';

/**
 * Read the project's report, or `undefined`.
 *
 * The server reads the file itself rather than going through the editor's
 * `loadReport.ts`, which wraps Electron's filesystem. Same shallow validation,
 * for the same reason: a report is an aid, and deep-validating a file a user may
 * have hand-edited would reject more than it saved.
 */
export function readReport(projectDir: string): ImportReport | undefined {
  const file = path.join(projectDir, IMPORT_REPORT_JSON_PATH);
  try {
    if (!fs.existsSync(file)) {
      return undefined;
    }
    const parsed = JSON.parse(fs.readFileSync(file, 'utf8')) as Partial<ImportReport>;
    if (parsed?.reportFormatVersion !== IMPORT_REPORT_FORMAT_VERSION) {
      return undefined;
    }
    if (!Array.isArray(parsed.findings) || !parsed.verdict) {
      return undefined;
    }
    return parsed as ImportReport;
  } catch {
    return undefined;
  }
}

export function registerImportReportTool(server: McpServer, binding: ProjectBinding): void {
  server.registerTool(
    'get_import_report',
    {
      title: 'Get the legacy import report',
      description:
        'What a legacy Noodl project import could and could not convert, for this project. Returns the ' +
        'per-construct outcomes (converted / converted-with-changes / placeholder / dropped), the catalog ' +
        'types to consider for each unconverted one, and a computed verdict — including, where it applies, ' +
        'that rebuilding is cheaper than repairing. Call this before proposing repairs to an imported ' +
        'project. Returns notImported when the project was not imported or converted cleanly.',
      inputSchema: {
        outcome: z
          .enum(['converted', 'converted-with-changes', 'placeholder', 'dropped'])
          .optional()
          .describe('Only return findings with this outcome. Omit for all of them.'),
        format: z
          .enum(['json', 'prose'])
          .optional()
          .describe(
            'json (default) returns the structured findings; prose returns the same report rendered as the ' +
              'briefing an assistant is given inside the editor.'
          )
      }
    },
    guarded(({ outcome, format }: { outcome?: ImportReport['findings'][number]['outcome']; format?: 'json' | 'prose' }) => {
      const report = readReport(binding.require().projectDir);
      if (!report) {
        return jsonResult({
          notImported: true,
          note: `No readable ${IMPORT_REPORT_JSON_PATH} in this project. Either it was authored in NodeGX rather than imported, or the report predates the current format.`
        });
      }

      if (format === 'prose') {
        return jsonResult({
          verdict: report.verdict,
          briefing:
            renderReportForAssistant(report) ??
            'Everything in this project converted. There is nothing for an assistant to repair.'
        });
      }

      const findings = outcome ? report.findings.filter((f) => f.outcome === outcome) : report.findings;
      return jsonResult({
        source: report.source,
        generatedAt: report.generatedAt,
        counts: report.counts,
        coverage: report.coverage,
        verdict: report.verdict,
        handoff: report.handoff,
        findings,
        // Named rather than implied: a filtered call still says how much it left
        // behind, so an agent cannot mistake a filter for the whole truth.
        findingsReturned: findings.length,
        findingsTotal: report.findings.length
      });
    })
  );
}
