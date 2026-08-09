/**
 * AIB-009 F11 — a per-turn deadline, so a turn that never returns ends.
 *
 * Every session in this phase bounds its work by *turns* and *submissions*, and
 * both of those need the model to reply. A provider that accepts the request and
 * then says nothing leaves the session `busy` forever: the run's Stop button
 * becomes the only exit, and stopping marks the rest of the plan `skipped`. From
 * inside the editor there was no way to tell that apart from a model that is
 * simply thinking hard.
 *
 * So the deadline here is on **silence, not duration**. A long turn is normal —
 * a reasoning model can spend minutes before its first token — and a deadline on
 * elapsed time would kill exactly the turns worth waiting for. What is never
 * normal is a stream that delivers nothing at all for minutes: every provider
 * this editor talks to emits *something* while it works (Anthropic sends `ping`
 * events, OpenAI and Ollama send chunks), which is what `onActivity` reports.
 *
 * Three properties are deliberate:
 *
 * 1. **It does not abort the caller's controller.** The request runs on an inner
 *    controller that follows the caller's, so a stall is distinguishable from a
 *    cancellation: the session's own `signal.aborted` stays false and the turn
 *    reports an *error* with a message, not a silent `cancelled`.
 * 2. **It supplies its own callbacks.** A caller that passes none (DocSession)
 *    still gets stall detection, because the wrapper is what the provider calls.
 * 3. **A throttled timer can only make it late.** The clock is read with
 *    `Date.now()` at each check rather than trusted to fire on time — Chromium
 *    throttles `setTimeout` in an occluded window, which is what made a scripted
 *    run look hung during AIB-002's live QA in the first place.
 *
 * @module AiAssistant/client/turnDeadline
 */

import type { AiChatRequest, AiChatResponse, AiStreamCallbacks } from './types';

/** The chat seam every session in this phase is built around. */
export type DeadlineChatFn = (request: AiChatRequest, callbacks?: AiStreamCallbacks) => Promise<AiChatResponse>;

/**
 * How long a turn may deliver *nothing* before it is ended.
 *
 * Three minutes is far outside normal for a streaming provider — Anthropic pings
 * while it thinks — and comfortably inside "the user has decided this is broken".
 * A local Ollama model on slow hardware is the one plausible false positive; that
 * is why every session takes an override rather than reading this directly.
 */
export const TURN_STALL_MS = 180_000;

/** Thrown by the wrapper when a turn delivers nothing for the whole window. */
export class AiTurnStalledError extends Error {
  constructor(readonly silentMs: number) {
    super(
      `The model stopped responding — nothing arrived for ${Math.round(silentMs / 1000)} seconds, ` +
        'so this turn was ended. Nothing that had already been produced is lost.'
    );
    this.name = 'AiTurnStalledError';
  }
}

export interface TurnDeadlineOptions {
  /** Silence window in milliseconds. `0` or less disables the deadline entirely. */
  stallMs?: number;
}

/**
 * Wrap a chat function so a turn that stops delivering is ended with a message.
 *
 * The returned function has the same signature and the same behaviour in every
 * case except one: when nothing arrives for `stallMs`, the underlying request is
 * aborted and the promise rejects with {@link AiTurnStalledError}.
 */
export function withTurnDeadline(chat: DeadlineChatFn, options: TurnDeadlineOptions = {}): DeadlineChatFn {
  const stallMs = options.stallMs ?? TURN_STALL_MS;
  if (!(stallMs > 0)) return chat;

  return (request, callbacks) => {
    const outer = request.abortController;
    const inner = new AbortController();
    const followOuter = () => inner.abort();
    if (outer) {
      if (outer.signal.aborted) inner.abort();
      else outer.signal.addEventListener('abort', followOuter, { once: true });
    }

    let lastActivity = Date.now();
    let timer: ReturnType<typeof setTimeout> | undefined;
    let settled = false;
    const touch = () => {
      lastActivity = Date.now();
    };

    // Every callback the provider might call is also an activity report. Wrapped
    // rather than added to, so a caller's own callbacks keep working untouched.
    const watched: AiStreamCallbacks = {
      onText: (fullText, delta) => {
        touch();
        callbacks?.onText?.(fullText, delta);
      },
      onToolCallPartial: (partial) => {
        touch();
        callbacks?.onToolCallPartial?.(partial);
      },
      onToolCall: (call) => {
        touch();
        callbacks?.onToolCall?.(call);
      },
      onActivity: () => {
        touch();
        callbacks?.onActivity?.();
      },
      onReasoning: (fullReasoning, delta) => {
        touch();
        callbacks?.onReasoning?.(fullReasoning, delta);
      },
      onEnd: () => {
        touch();
        callbacks?.onEnd?.();
      }
    };

    const cleanup = () => {
      settled = true;
      if (timer !== undefined) clearTimeout(timer);
      timer = undefined;
      outer?.signal.removeEventListener('abort', followOuter);
    };

    return new Promise<AiChatResponse>((resolve, reject) => {
      const check = () => {
        if (settled) return;
        const silent = Date.now() - lastActivity;
        if (silent >= stallMs) {
          const error = new AiTurnStalledError(silent);
          cleanup();
          // The inner controller only — the caller's is left alone so its own
          // `aborted` check still means "the user stopped this".
          inner.abort();
          reject(error);
          return;
        }
        // Woke early (or the timer was throttled and this is a fresh window):
        // re-arm for the remainder rather than trusting the fire time.
        timer = setTimeout(check, stallMs - silent);
      };
      timer = setTimeout(check, stallMs);

      chat({ ...request, abortController: inner }, watched).then(
        (response) => {
          if (settled) return;
          cleanup();
          resolve(response);
        },
        (error) => {
          if (settled) return;
          cleanup();
          reject(error);
        }
      );
    });
  };
}
