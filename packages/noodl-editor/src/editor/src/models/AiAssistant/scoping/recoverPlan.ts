/**
 * AIB-003 slice 3 — reading the plan back off disk.
 *
 * `pendingPlan.ts` has always carried this note:
 *
 * > the plan is *also* written into `docs/decisions/000-initial-scope.md` at
 * > creation, so it is durable and readable without this seam. This is the fast
 * > path, not the only path.
 *
 * The slow path was never built. So `takePendingScopePlan` — destructive by
 * design, and correctly so — made the first consumption final, and the consumer
 * was a component that unmounted on a tab click. Close the launcher, or quit and
 * reopen the project, and a plan the user had already agreed was simply gone,
 * while sitting in a file on their disk the whole time.
 *
 * This module is the slow path. Pure parsing here; the disk read is one
 * injected function, so nothing in this file needs a filesystem or a
 * `ProjectModel`.
 *
 * ## Why "was it already applied?" is answered from the graph
 *
 * The record is written once, at creation, and never updated — deliberately: it
 * is a decision document, not a status file, and rewriting it after every build
 * would make it a worse record. So whether the plan still has anything to offer
 * is asked of the project instead: a `create` operation whose component now
 * exists has plainly been built. That reads the actual state of the world rather
 * than a flag someone has to remember to set.
 *
 * @module AiAssistant/scoping/recoverPlan
 */

import type { AuthoringPlan, PlanOperation } from '../authoring/plan';
import { DOC_INITIAL_SCOPE, PLAN_FENCE_TAG } from './scope';
import type { ScopeTranscriptEntry } from './scope';

/** A ```json nodegx-plan fenced block and its body. */
const PLAN_FENCE = new RegExp('```json\\s+' + PLAN_FENCE_TAG + '\\s*\\n([\\s\\S]*?)\\n```');

const VALID_KINDS = new Set(['create', 'update', 'doc']);

/**
 * The plan recorded in a scope document, or `undefined` if it has none, the
 * block is malformed, or its shape is not a plan.
 *
 * Never throws. This runs against a file the user is invited to edit, and a
 * hand-mangled block must degrade to "no plan offered", not to a broken panel.
 */
export function parseRecordedPlan(markdown: string): AuthoringPlan | undefined {
  const match = PLAN_FENCE.exec(markdown);
  if (!match) return undefined;

  let parsed: unknown;
  try {
    parsed = JSON.parse(match[1]);
  } catch {
    return undefined;
  }

  const plan = (parsed as { plan?: unknown })?.plan as AuthoringPlan | undefined;
  if (!plan || typeof plan !== 'object') return undefined;
  if (typeof plan.request !== 'string' || !Array.isArray(plan.operations)) return undefined;

  const operations = plan.operations.filter(
    (op): op is PlanOperation =>
      !!op &&
      typeof op === 'object' &&
      typeof op.id === 'string' &&
      typeof op.target === 'string' &&
      typeof op.intent === 'string' &&
      VALID_KINDS.has(op.kind as string)
  );
  if (operations.length !== plan.operations.length || operations.length === 0) return undefined;

  return { request: plan.request, operations };
}

/**
 * The conversation, recovered from the rendered record.
 *
 * Parsed from the markdown rather than duplicated into the JSON block on
 * purpose: the transcript is the largest part of the file and copying it would
 * double a document a person is meant to read. Both ends of this are ours —
 * `renderScopeRecord` writes the shape and this reads it — and a round-trip test
 * is what keeps them honest.
 */
export function parseRecordedTranscript(markdown: string): ScopeTranscriptEntry[] {
  const section = markdown.split(/^## Transcript$/m)[1];
  if (!section) return [];

  const entries: ScopeTranscriptEntry[] = [];
  // `**You:**` / `**Assistant:**`, then a blockquote until the next speaker.
  const speaker = /^\*\*(You|Assistant):\*\*$/;
  let role: ScopeTranscriptEntry['role'] | undefined;
  let lines: string[] = [];

  const flush = () => {
    if (!role) return;
    const text = lines.join('\n').trim();
    if (text) entries.push({ role, text });
    lines = [];
  };

  for (const line of section.split('\n')) {
    const match = speaker.exec(line.trim());
    if (match) {
      flush();
      role = match[1] === 'You' ? 'user' : 'assistant';
      continue;
    }
    // Only quoted lines are content; `>` alone is a blank line inside a turn.
    if (role && line.startsWith('>')) lines.push(line.replace(/^>\s?/, ''));
  }
  flush();
  return entries;
}

export interface RecoveredScopePlan {
  plan: AuthoringPlan;
  transcript: ScopeTranscriptEntry[];
  recordPath: string;
}

export interface RecoverScopePlanOptions {
  /** Read a project-relative doc; `undefined` when the file is not there. */
  readDoc: (relPath: string) => Promise<string | undefined> | string | undefined;
  /** Does a component with this legacy name exist in the project today? */
  componentExists: (legacyName: string) => boolean;
  /** `pathToLegacyName`, injected so this module imports no authoring machinery. */
  toLegacyName: (target: string) => string;
}

/**
 * The recorded plan, if the project has one and it still has work left in it.
 *
 * Returns `undefined` when there is no record, no plan in it, or every `create`
 * the plan proposed already exists — the last of which is the interesting case:
 * it means the plan was built, and re-offering it would invite a user to
 * rebuild their own app.
 */
export async function recoverScopePlan(
  options: RecoverScopePlanOptions
): Promise<RecoveredScopePlan | undefined> {
  let markdown: string | undefined;
  try {
    markdown = await options.readDoc(DOC_INITIAL_SCOPE);
  } catch {
    // A doc that cannot be read is a doc that offers no plan. This runs on
    // panel mount and must never be the reason a panel fails to render.
    return undefined;
  }
  if (!markdown) return undefined;

  const plan = parseRecordedPlan(markdown);
  if (!plan) return undefined;

  const creates = plan.operations.filter((op) => op.kind === 'create');
  const alreadyBuilt =
    creates.length > 0 && creates.every((op) => options.componentExists(options.toLegacyName(op.target)));
  if (alreadyBuilt) return undefined;

  return { plan, transcript: parseRecordedTranscript(markdown), recordPath: DOC_INITIAL_SCOPE };
}
