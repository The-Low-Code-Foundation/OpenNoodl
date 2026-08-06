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
import { withTurnDeadline } from '../client/turnDeadline';
import type { AiChatRequest, AiChatResponse, AiEffort, AiMessage, AiStreamCallbacks } from '../client/types';
import {
  RECORD_SCOPE,
  SCOPE_RECORDED,
  SCOPE_RECORDED_ANSWER_NEEDED,
  SCOPE_RECORDED_REPLY,
  SCOPING_TOOLS,
  scopingOpeningMessage,
  scopingSystemPrompt,
  unknownToolMessage
} from './prompts';
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

/**
 * AAQ-004. What separates two prose rounds of one user turn when they are shown
 * as a single reply. A blank line, because they are separate model turns that
 * happen to belong to the same answer — never a joiner that implies a sentence
 * continues across the seam.
 *
 * Since AAQ-011 F3 a `record_scope` call no longer produces a second round, so
 * the shapes that still reach this are a tool this conversation does not have
 * (the model is told so and answers) and a recording turn that said nothing.
 */
const TURN_SEPARATOR = '\n\n';

/**
 * Shift a round's streamed text by everything already said this turn.
 *
 * `onText` hands back the accumulated text of the round in flight, which is the
 * right contract for a single round and the wrong one for a turn made of
 * several: the second round starts at an empty string and the bubble drops the
 * long answer the user is reading. The delta is passed through untouched — only
 * the accumulated view moves.
 */
function withProsePrefix(callbacks: AiStreamCallbacks, before: () => string): AiStreamCallbacks {
  const { onText } = callbacks;
  if (!onText) return callbacks;
  return {
    ...callbacks,
    onText: (fullText, delta) => {
      const prefix = before();
      onText(prefix ? prefix + TURN_SEPARATOR + fullText : fullText, delta);
    }
  };
}

export interface ScopingOptions {
  chat?: ScopingChatFn;
  effort?: AiEffort;
  maxToolRounds?: number;
  /**
   * AIB-009 F11: how long one turn may deliver nothing before it is ended.
   * Defaults to {@link TURN_STALL_MS}; `0` disables it. This is the first AI
   * interaction anyone has with the product, so a silent hang here is the most
   * expensive one there is.
   */
  stallMs?: number;
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
    this.chat = withTurnDeadline(
      options.chat ?? ((request, callbacks) => AiClient.chatStream(request, callbacks ?? {})),
      { stallMs: options.stallMs }
    );
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
      /**
       * AAQ-004 mechanism A. This used to be `lastProse` — one string, each
       * round overwriting the one before, and only the survivor entered into
       * the transcript. The characteristic shape of a scoping turn is: a long,
       * useful answer with follow-up questions; a `record_scope` call; then the
       * short recap the tool result asks for. Keeping only the last round meant
       * the long answer **streamed to the user and then visibly vanished** when
       * the run resolved and the UI re-rendered from `entries`.
       *
       * Every non-empty prose round is kept, in order. Joined with a blank line
       * because these are separate model turns, not fragments of one.
       */
      const prose: string[] = [];
      const proseSoFar = () => prose.join(TURN_SEPARATOR);
      /** AAQ-011 F3: whether `record_scope` ran at all in this turn. */
      let recorded = false;
      /**
       * Enter what was said into the transcript and answer it. Every exit from
       * this turn goes through here — including the failure ones, because prose
       * the user watched arrive is theirs whether or not the round after it
       * reached the provider.
       *
       * `fallback` is AAQ-011 F3's floor: a turn that recorded a scope and never
       * spoke would otherwise return an empty reply, which the launcher renders
       * as nothing at all under the user's own message. Only the successful exit
       * asks for it — a cancelled or failed turn has its own message, and
       * inventing prose there would claim the turn worked.
       */
      const keep = (fallback = false) => {
        const text = proseSoFar() || (fallback ? SCOPE_RECORDED_REPLY : '');
        if (text) this.entries.push({ role: 'assistant', text });
        return text;
      };

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
            // `onText` reports the accumulated text of the round in flight, so
            // a second round would restart the bubble at the recap and drop the
            // long answer from under the user mid-turn — the same collapse as
            // above, one layer up. Prefixing with the rounds already spoken
            // keeps the streamed text monotonic and byte-equal to what the
            // transcript ends up holding.
            withProsePrefix(callbacks, proseSoFar)
          );
        } catch (error) {
          if (abortController.signal.aborted) {
            return { status: 'cancelled', reply: keep(), scope: this.current, costUsd: this.cost };
          }
          const note = error instanceof Error ? error.message : String(error);
          keep();
          return { status: 'error', reply: '', scope: this.current, note, costUsd: this.cost };
        }

        this.cost = this.cost === null || response.usage.costUsd === null ? null : this.cost + response.usage.costUsd;
        this.messages.push({
          role: 'assistant',
          content: response.text ?? '',
          ...(response.toolCalls.length > 0 ? { toolCalls: response.toolCalls } : {})
        });
        if (response.text?.trim()) prose.push(response.text.trim());

        if (response.stopReason === 'aborted') {
          return { status: 'cancelled', reply: keep(), scope: this.current, costUsd: this.cost };
        }

        if (response.toolCalls.length === 0) break;

        /**
         * AAQ-011 F3. The tool result used to ask for prose unconditionally, so
         * a turn that had already given its long answer produced a second,
         * shorter one saying the same thing — the redundant reply Richard
         * reported. Recording is not a question, so once the user has been
         * answered the tool result IS the end of the turn.
         *
         * Two things keep this from becoming silence, and they are the whole of
         * the condition. `answered` — a turn whose *only* output is the call has
         * said nothing yet, so that one still gets its round (and a tool result
         * that says so). `onlyRecording` — an unknown tool in the same response
         * is a model that tried to do something else, and `unknownToolMessage`
         * is an instruction it has not had a chance to act on; that round is
         * owed regardless of how much prose came with it.
         */
        const onlyRecording = response.toolCalls.every((call) => call.name === RECORD_SCOPE);
        const answered = Boolean(proseSoFar());
        const done = onlyRecording && answered;

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
          recorded = true;
          this.current = mergeScope(this.current, toScopePatch(call.arguments));
          this.messages.push({
            role: 'tool',
            toolCallId: call.id,
            name: call.name,
            // This message outlives its round — it stays in `messages` for every
            // later turn — so the nudge must not be written when it is not owed.
            content: done ? SCOPE_RECORDED : SCOPE_RECORDED_ANSWER_NEEDED
          });
        }

        if (done) break;
      }

      return { status: 'ok', reply: keep(recorded), scope: this.current, costUsd: this.cost };
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
