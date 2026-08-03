/**
 * AIX-012 — the scoping conversation.
 *
 * Every other session in this phase is a bounded request/submission pair. This
 * one is a dialogue: `send()` per user message, prose back, and a
 * `ProjectScope` that is always current because the model is told to record
 * after every exchange.
 *
 * Three properties are structural rather than promised:
 *
 * 1. **It cannot build.** This module imports the AI client, its own prompts
 *    and `scope.ts`. It does not import `AuthoringSession`, `PlanRun`,
 *    `staging`, `planStaging`, `candidate` or `ProjectModel` — there is no
 *    call path from here to a component write, and the one tool it offers has
 *    no field that can carry a graph. A model that calls `submit_component`
 *    anyway is told the tool does not exist and the turn continues.
 * 2. **It is exitable at any point.** `scope` is a plain value that is complete
 *    after every turn. Abandoning is the absence of a further `send()` — there
 *    is no "finish" call that the output depends on, so there is no state in
 *    which stopping loses what was agreed.
 * 3. **It writes nothing.** No filesystem, no `ProjectModel`. The documents are
 *    rendered by `scope.ts` and written by the caller, after the project
 *    exists.
 *
 * @module AiAssistant/scoping/ScopingSession
 */

import { AiClient } from '../client';
import type { AiChatRequest, AiChatResponse, AiEffort, AiMessage, AiStreamCallbacks } from '../client/types';
import { RECORD_SCOPE, SCOPING_TOOLS, scopingOpeningMessage, scopingSystemPrompt, unknownToolMessage } from './prompts';
import type { ProjectScope, ScopeBackendInput, ScopeTranscriptEntry } from './scope';
import { emptyScope, mergeScope } from './scope';

/**
 * What `toScopePatch` produces. AIB-007 widened `backend` to the union
 * `mergeScope` accepts, so that a model answering the pre-AIB-007 schema is
 * normalised rather than dropped.
 */
export type ScopePatch = Partial<Omit<ProjectScope, 'backend'>> & { backend?: ScopeBackendInput };

/** Same injection seam as every other session here: specs bind a script. */
export type ScopingChatFn = (request: AiChatRequest, callbacks?: AiStreamCallbacks) => Promise<AiChatResponse>;

/**
 * Scoping is cheap talk, not code generation, so it runs at low effort — the
 * conversation's quality comes from the prompt's shape, not from thinking
 * budget, and a user waiting on a reply notices every second.
 */
export const SCOPING_EFFORT: AiEffort = 'low';

/** Tool-call round trips inside ONE user turn before we stop and answer. */
const MAX_TOOL_ROUNDS = 4;

export interface ScopingOptions {
  chat?: ScopingChatFn;
  effort?: AiEffort;
  maxToolRounds?: number;
}

export type ScopingTurnStatus = 'ok' | 'cancelled' | 'error';

export interface ScopingTurn {
  status: ScopingTurnStatus;
  /** What to show the user. Empty only when the turn failed. */
  reply: string;
  /** The scope as it stands after this turn — always complete, never partial. */
  scope: ProjectScope;
  /** The model's error message, when status is not 'ok'. */
  note?: string;
  costUsd: number | null;
}

export class ScopingSession {
  private readonly chat: ScopingChatFn;
  private readonly effort: AiEffort;
  private readonly maxToolRounds: number;
  private readonly messages: AiMessage[] = [{ role: 'system', content: scopingSystemPrompt() }];
  private readonly entries: ScopeTranscriptEntry[] = [];
  private current: ProjectScope = emptyScope();
  private cost: number | null = 0;
  private abortController: AbortController | undefined;

  constructor(options: ScopingOptions = {}) {
    this.chat = options.chat ?? ((request, callbacks) => AiClient.chatStream(request, callbacks ?? {}));
    this.effort = options.effort ?? SCOPING_EFFORT;
    this.maxToolRounds = options.maxToolRounds ?? MAX_TOOL_ROUNDS;
  }

  /**
   * Everything agreed so far. Safe to read at any moment, including mid-turn:
   * this is what a user who closes the window gets.
   */
  get scope(): ProjectScope {
    return this.current;
  }

  /** The conversation as it will be written into the scoping record. */
  get transcript(): readonly ScopeTranscriptEntry[] {
    return this.entries;
  }

  /** Total spend on this conversation, or null when a model priced nothing. */
  get costUsd(): number | null {
    return this.cost;
  }

  get hasStarted(): boolean {
    return this.entries.length > 0;
  }

  /** Abort an in-flight turn. The scope recorded up to this point stands. */
  cancel(): void {
    this.abortController?.abort();
  }

  /**
   * One user turn. The first call carries the user's description of the app and
   * becomes `scope.request` verbatim — it is quoted into the scoping record, so
   * it is never paraphrased on the way in.
   */
  async send(text: string, callbacks: AiStreamCallbacks = {}): Promise<ScopingTurn> {
    const message = text.trim();
    if (!message) {
      return { status: 'error', reply: '', scope: this.current, note: 'Nothing was said.', costUsd: this.cost };
    }

    const opening = !this.hasStarted;
    if (opening) this.current = { ...this.current, request: message };

    this.entries.push({ role: 'user', text: message });
    this.messages.push({ role: 'user', content: opening ? scopingOpeningMessage(message) : message });

    const abortController = new AbortController();
    this.abortController = abortController;

    try {
      let rounds = 0;
      let lastProse = '';

      while (rounds <= this.maxToolRounds) {
        rounds++;
        let response: AiChatResponse;
        try {
          response = await this.chat(
            {
              messages: [...this.messages],
              tools: SCOPING_TOOLS,
              toolChoice: 'auto',
              effort: this.effort,
              abortController
            },
            callbacks
          );
        } catch (error) {
          if (abortController.signal.aborted) {
            return { status: 'cancelled', reply: lastProse, scope: this.current, costUsd: this.cost };
          }
          return {
            status: 'error',
            reply: '',
            scope: this.current,
            note: error instanceof Error ? error.message : String(error),
            costUsd: this.cost
          };
        }

        this.cost = this.cost === null || response.usage.costUsd === null ? null : this.cost + response.usage.costUsd;
        this.messages.push({
          role: 'assistant',
          content: response.text ?? '',
          ...(response.toolCalls.length > 0 ? { toolCalls: response.toolCalls } : {})
        });
        if (response.text?.trim()) lastProse = response.text.trim();

        if (response.stopReason === 'aborted') {
          if (lastProse) this.entries.push({ role: 'assistant', text: lastProse });
          return { status: 'cancelled', reply: lastProse, scope: this.current, costUsd: this.cost };
        }

        if (response.toolCalls.length === 0) break;

        for (const call of response.toolCalls) {
          if (call.name !== RECORD_SCOPE) {
            // Includes every authoring tool. There is nothing to build against
            // and no code path to build with; the turn simply continues.
            this.messages.push({
              role: 'tool',
              toolCallId: call.id,
              name: call.name,
              content: unknownToolMessage(call.name)
            });
            continue;
          }
          this.current = mergeScope(this.current, toScopePatch(call.arguments));
          this.messages.push({
            role: 'tool',
            toolCallId: call.id,
            name: call.name,
            content: 'Recorded. Now answer the user in prose.'
          });
        }
      }

      if (lastProse) this.entries.push({ role: 'assistant', text: lastProse });
      return { status: 'ok', reply: lastProse, scope: this.current, costUsd: this.cost };
    } finally {
      if (this.abortController === abortController) this.abortController = undefined;
    }
  }
}

/**
 * Narrow a `record_scope` call to the fields `mergeScope` understands.
 * Deliberately silent about anything else in `arguments`: a model that invents
 * an extra key has not built anything, and failing the turn over it would cost
 * the user their conversation to teach the model nothing.
 */
export function toScopePatch(args: Record<string, unknown>): ScopePatch {
  const patch: ScopePatch = {};
  if (typeof args.summary === 'string') patch.summary = args.summary;
  if (typeof args.audience === 'string') patch.audience = args.audience;
  // AIB-007: the schema asks for an object now, but a model that answers the
  // *old* schema — or answers this one carelessly — sends a string. Both are
  // passed through to `normalizeScopeBackend`, which is the one place that
  // decides what an un-classifiable answer means, and which never reads prose as
  // permission to create a backend.
  if (typeof args.backend === 'string' || (args.backend && typeof args.backend === 'object')) {
    patch.backend = args.backend as ScopeBackendInput;
  }
  if (typeof args.agreed === 'boolean') patch.agreed = args.agreed;

  const strings = (value: unknown): string[] | undefined =>
    Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : undefined;

  const outOfScope = strings(args.outOfScope);
  if (outOfScope) patch.outOfScope = outOfScope;
  const conventions = strings(args.conventions);
  if (conventions) patch.conventions = conventions;
  const openQuestions = strings(args.openQuestions);
  if (openQuestions) patch.openQuestions = openQuestions;

  if (Array.isArray(args.objects)) {
    patch.objects = args.objects
      .filter((o): o is Record<string, unknown> => Boolean(o) && typeof o === 'object')
      .map((o) => ({
        name: String(o.name ?? '').trim(),
        ...(typeof o.purpose === 'string' ? { purpose: o.purpose } : {}),
        ...(strings(o.fields) ? { fields: strings(o.fields) } : {}),
        ...(strings(o.relationships) ? { relationships: strings(o.relationships) } : {})
      }));
  }

  if (Array.isArray(args.pages)) {
    patch.pages = args.pages
      .filter((p): p is Record<string, unknown> => Boolean(p) && typeof p === 'object')
      .map((p) => ({ name: String(p.name ?? '').trim(), purpose: String(p.purpose ?? '').trim() }));
  }

  if (Array.isArray(args.rejected)) {
    patch.rejected = args.rejected
      .filter((r): r is Record<string, unknown> => Boolean(r) && typeof r === 'object')
      .map((r) => ({ option: String(r.option ?? '').trim(), reason: String(r.reason ?? '').trim() }));
  }

  return patch;
}
