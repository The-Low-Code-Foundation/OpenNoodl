/**
 * AIX-009 — the authoring loop's pull-only doc read.
 * BLD-007 — and its one-value enum becomes the project's own list.
 *
 * `docs/ARCHITECTURE.md` is the largest of the seed docs and is not needed on
 * most turns, so it is fetched rather than injected. That keeps the default turn
 * cheap, and — the reason it matters more than the money — keeps AIX-007's
 * cache-stable prefix identical on every turn of every session in a project,
 * whatever the task happens to need.
 *
 * BLD-007 adds every doc the user wrote that declared `inject: pull`. The
 * closure it removes was not arbitrary, and the two properties that justified it
 * both survive:
 *
 *  1. **A project with no pull-injectable doc still offers no tool at all**, so
 *     its requests are byte-identical to before. `AUTHORING_TOOLS` is untouched;
 *     this list is still built beside it rather than inside it.
 *  2. ⚠️ **The tool definition is part of the cached prefix** (on Anthropic,
 *     `tools` renders ahead of `system`). It is now *project*-dependent rather
 *     than constant, which is fine — but it must be **stable within a session**,
 *     and it is: `AuthoringSession` calls `projectDocTools` once in its
 *     constructor and holds the result for the life of the session. A doc added
 *     mid-session is picked up by the *next* session, deliberately. Anyone
 *     tempted to rebuild this list per turn is trading every project's prompt
 *     cache for a freshness nobody asked for.
 *
 * @module AiAssistant/authoring/projectDocsTool
 */

import { DOC_ARCHITECTURE, DOCS_DIR } from '../../ProjectDocs/docsText';
import type { DiscoveredDoc, ProjectDocsContent } from '../../ProjectDocs/docsText';
import type { AiToolCall, AiToolDefinition } from '../client/types';
import type { AuthoringContextBuilder } from './ContextBuilder';

export const GET_PROJECT_DOC = 'get_project_doc';

/** The seed doc's argument value. Kept verbatim: it is in the cached prefix. */
const ARCHITECTURE_ARG = 'ARCHITECTURE.md';

/** `docs/uk-vat.md` → `uk-vat.md`. The argument the agent types. */
function toArg(path: string): string {
  return path.startsWith(`${DOCS_DIR}/`) ? path.slice(DOCS_DIR.length + 1) : path;
}

/** The pull-injectable docs, in a stable order: the seed doc, then the user's. */
function pullable(docs: ProjectDocsContent): Array<{ arg: string; title: string; when: string[] }> {
  const list: Array<{ arg: string; title: string; when: string[] }> = [];
  if (docs.architecture?.trim()) {
    list.push({ arg: ARCHITECTURE_ARG, title: 'Architecture', when: [] });
  }
  for (const doc of docs.extra ?? []) {
    if (doc.inject !== 'pull' || !doc.body.trim()) continue;
    list.push({ arg: toArg(doc.path), title: doc.title, when: doc.when });
  }
  return list;
}

/**
 * The tool definition, or nothing when this project has no pull-injectable doc.
 * Offering a tool that can only answer "there is no such file" spends prefix
 * bytes and invites a wasted turn.
 */
export function projectDocTools(docs: ProjectDocsContent): AiToolDefinition[] {
  const available = pullable(docs);
  if (available.length === 0) return [];

  const onlyArchitecture = available.length === 1 && available[0].arg === ARCHITECTURE_ARG;

  // The pre-BLD-007 text, reproduced exactly for the pre-BLD-007 situation.
  // Every project that has never written front matter keeps its cached prefix.
  const description = onlyArchitecture
    ? `This project's ${DOC_ARCHITECTURE} — page map, data model, backend contracts, and the reasoning ` +
      'behind them. Call it when the task depends on why the project is shaped the way it is, or on what ' +
      'an external service guarantees. It is not sent by default; one call is enough.'
    : [
        "This project's own written documents, fetched on demand. They are not sent by default; call this " +
          'when the task depends on what one of them says. One call per document is enough.',
        ...available.map((d) => `- ${d.arg} — ${d.title}${d.when.length ? ` (relevant to: ${d.when.join(', ')})` : ''}`)
      ].join('\n');

  const pathDescription = onlyArchitecture
    ? `The document to read. Only "${ARCHITECTURE_ARG}" is available to this loop.`
    : 'The document to read, as listed above.';

  return [
    {
      name: GET_PROJECT_DOC,
      description,
      parameters: {
        type: 'object',
        properties: {
          path: {
            type: 'string',
            enum: available.map((d) => d.arg),
            description: pathDescription
          }
        },
        required: ['path']
      }
    }
  ];
}

/** Feed label for the activity list. */
export function projectDocToolLabel(call?: AiToolCall): string {
  const asked = typeof call?.arguments?.path === 'string' ? call.arguments.path : undefined;
  return `Read project doc ${asked ? normalizeArg(asked) : DOC_ARCHITECTURE}`;
}

/** `./docs/UK-vat.md`, `docs/uk-vat.md`, `uk-vat.md` → `uk-vat.md`. */
function normalizeArg(requested: string): string {
  return requested.replace(/^\.?\/?(docs\/)?/i, '');
}

/**
 * Dispatch `get_project_doc`, or return `undefined` when the call is for some
 * other tool — so the session can chain this ahead of `dispatchReadTool`
 * without either module knowing about the other's vocabulary.
 *
 * An unrecognised path answers with **the list this project actually has**.
 * The previous behaviour — a scolding string naming one file — was the right
 * answer when there was one file and is a dead end now.
 *
 * ⚠️ The doc set is read from `context.docs` and is deliberately NOT a separate
 * parameter. BLD-007 first took it as a third argument defaulting to `{}`, which
 * gave "what docs exist" two sources that could disagree: every pre-BLD-007
 * caller kept compiling, silently resolving against an empty set, and answered
 * *"this project has no fetchable documents"* for a project holding an
 * ARCHITECTURE.md. Two AIX-009 specs caught it only because `test:ci` finally
 * ran. The context is built once per session with the same snapshot
 * `projectDocTools` was handed, so reading it here keeps the set the dispatcher
 * resolves against identical to the set the tool definition advertised — which
 * was the property the third argument existed to guarantee.
 */
export function dispatchProjectDocTool(call: AiToolCall, context: AuthoringContextBuilder): string | undefined {
  if (call.name !== GET_PROJECT_DOC) return undefined;

  const docs = context.docs;

  const requested = typeof call.arguments.path === 'string' ? call.arguments.path : ARCHITECTURE_ARG;
  const asked = normalizeArg(requested).toLowerCase();

  if (asked === ARCHITECTURE_ARG.toLowerCase() && docs.architecture?.trim()) {
    return context.projectArchitecture();
  }

  const match = (docs.extra ?? []).find(
    (doc: DiscoveredDoc) => doc.inject === 'pull' && toArg(doc.path).toLowerCase() === asked
  );
  if (match) return context.projectExtraDoc(match);

  // Pre-BLD-007 projects reach here only for a genuinely wrong path, and the
  // architecture case is still named first because it is still the common one.
  const available = pullable(docs).map((d) => `"${d.arg}"`);
  return available.length > 0
    ? `get_project_doc has no "${requested}" in this project. Available: ${available.join(', ')}. ` +
        'Documents injected on every turn are already in the reference material above.'
    : `This project has no fetchable documents. Anything it has written is already in the reference material above.`;
}
