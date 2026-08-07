/**
 * Validation tools: validate_component, validate_project — SUB-006 diagnostics
 * on demand over the current on-disk state.
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

import { sortDiagnostics } from '../editor-deps';
import type { ProjectStore } from '../project/ProjectStore';
import { validateOnDisk } from '../validate';
import type { ValidateComponentResponse, ValidateProjectResponse } from './responses';
import { guarded, jsonResult } from './util';

export function registerValidateTools(server: McpServer, store: ProjectStore): void {
  const strictArg = z
    .boolean()
    .optional()
    .describe('Promote "unknown node type" from warning to error (greenfield mode)');

  server.registerTool(
    'validate_component',
    {
      title: 'Validate component',
      description:
        'Run the semantic validator over one component (in full project context, so component references ' +
        'resolve). Diagnostics carry machine codes, locations, and — where knowable — a suggested fix and the ' +
        'list of valid alternatives.',
      inputSchema: {
        path: z.string().describe('Component path or legacy name'),
        strict: strictArg
      }
    },
    guarded((args: { path: string; strict?: boolean }) => {
      const { report, target } = validateOnDisk(store, { component: args.path, strict: args.strict });
      const payload: ValidateComponentResponse = {
        target,
        summary: report.summary,
        diagnostics: sortDiagnostics(report.diagnostics)
      };
      return jsonResult(payload);
    })
  );

  server.registerTool(
    'validate_project',
    {
      title: 'Validate project',
      description: 'Run the semantic validator over every component in the project.',
      inputSchema: {
        strict: strictArg
      }
    },
    guarded((args: { strict?: boolean }) => {
      const { report } = validateOnDisk(store, { strict: args.strict });
      const payload: ValidateProjectResponse = {
        summary: report.summary,
        diagnostics: sortDiagnostics(report.diagnostics)
      };
      return jsonResult(payload);
    })
  );
}
