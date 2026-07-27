/**
 * AIX-009 — the authoring loop's pull-only doc read.
 *
 * `docs/ARCHITECTURE.md` is the largest of the three project docs and is not
 * needed on most turns, so it is fetched rather than injected. That keeps the
 * default turn cheap, and — the reason it matters more than the money — keeps
 * AIX-007's cache-stable prefix identical on every turn of every session in a
 * project, whatever the task happens to need.
 *
 * This lives beside `tools.ts` rather than inside it deliberately: the tool is
 * only offered when the project actually has an ARCHITECTURE.md, so
 * `AUTHORING_TOOLS` stays a constant (the tool list is part of the cached
 * prefix on Anthropic — `tools` renders ahead of `system`) and a project without
 * docs produces byte-identical requests to before this task landed.
 *
 * @module AiAssistant/authoring/projectDocsTool
 */

import { DOC_ARCHITECTURE } from '../../ProjectDocs/docsText';
import type { ProjectDocsContent } from '../../ProjectDocs/docsText';
import type { AiToolCall, AiToolDefinition } from '../client/types';
import type { AuthoringContextBuilder } from './ContextBuilder';

export const GET_PROJECT_DOC = 'get_project_doc';

/** The doc the tool can return. One path, so there is nothing to guess wrong. */
const ARCHITECTURE_ARG = 'ARCHITECTURE.md';

/**
 * The tool definition, or nothing when this project has no ARCHITECTURE.md.
 * Offering a tool that can only answer "there is no such file" spends prefix
 * bytes and invites a wasted turn.
 */
export function projectDocTools(docs: ProjectDocsContent): AiToolDefinition[] {
  if (!docs.architecture?.trim()) return [];
  return [
    {
      name: GET_PROJECT_DOC,
      description:
        `This project's ${DOC_ARCHITECTURE} — page map, data model, backend contracts, and the reasoning ` +
        'behind them. Call it when the task depends on why the project is shaped the way it is, or on what ' +
        'an external service guarantees. It is not sent by default; one call is enough.',
      parameters: {
        type: 'object',
        properties: {
          path: {
            type: 'string',
            enum: [ARCHITECTURE_ARG],
            description: `The document to read. Only "${ARCHITECTURE_ARG}" is available to this loop.`
          }
        },
        required: ['path']
      }
    }
  ];
}

/** Feed label for the activity list. */
export function projectDocToolLabel(): string {
  return `Read project doc ${DOC_ARCHITECTURE}`;
}

/**
 * Dispatch `get_project_doc`, or return `undefined` when the call is for some
 * other tool — so the session can chain this ahead of `dispatchReadTool`
 * without either module knowing about the other's vocabulary.
 */
export function dispatchProjectDocTool(call: AiToolCall, context: AuthoringContextBuilder): string | undefined {
  if (call.name !== GET_PROJECT_DOC) return undefined;
  const requested = typeof call.arguments.path === 'string' ? call.arguments.path : ARCHITECTURE_ARG;
  const normalized = requested.replace(/^\.?\/?(docs\/)?/i, '').toUpperCase();
  if (normalized !== ARCHITECTURE_ARG.toUpperCase()) {
    return (
      `get_project_doc can only read "${ARCHITECTURE_ARG}" in this loop. ` +
      'CONVENTIONS.md and BRIEF.md are already in the reference material above.'
    );
  }
  return context.projectArchitecture();
}
