/**
 * AIB-009 F11 — a turn that never returns ends.
 *
 * The module under test is pure (it imports types only), which is why this is a
 * jest spec rather than one more file in the Electron suite. What it pins is the
 * distinction the register's entry is about: a stall must be *distinguishable*
 * from a cancellation, because a run that reports "cancelled" tells the user
 * they stopped something they did not stop, and marks the rest of the plan
 * skipped for a reason that never happened.
 */

import {
  AiTurnStalledError,
  withTurnDeadline,
  type DeadlineChatFn
} from '../../src/editor/src/models/AiAssistant/client/turnDeadline';
import type { AiChatRequest, AiChatResponse, AiStreamCallbacks } from '../../src/editor/src/models/AiAssistant/client/types';

const STALL_MS = 60;

function request(overrides: Partial<AiChatRequest> = {}): AiChatRequest {
  return { messages: [{ role: 'user', content: 'hello' }], ...overrides };
}

function response(): AiChatResponse {
  return {
    text: 'done',
    toolCalls: [],
    usage: { promptTokens: 1, completionTokens: 1, cacheReadTokens: 0, cacheWriteTokens: 0, costUsd: 0 },
    model: 'test',
    stopReason: 'stop'
  };
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

describe('AIB-009 F11 — the per-turn deadline', () => {
  it('ends a turn that delivers nothing, and says so', async () => {
    // The provider accepted the request and will never answer. Before this,
    // nothing in the editor ended this turn: not the turn budget (it needs a
    // reply to count), not the submission budget (same), not the run.
    const chat: DeadlineChatFn = () => new Promise<AiChatResponse>(() => undefined);
    const guarded = withTurnDeadline(chat, { stallMs: STALL_MS });

    await expect(guarded(request())).rejects.toThrow(AiTurnStalledError);
  });

  it('aborts the request it made, and leaves the caller\'s controller alone', async () => {
    // The whole point. `AuthoringSession` reads `abortController.signal.aborted`
    // to decide whether a failed turn was the user pressing Stop; if the
    // deadline aborted *that* controller, every stall would report as a
    // cancellation and the run would mark the remaining operations skipped.
    let seen: AbortController | undefined;
    const chat: DeadlineChatFn = (req) => {
      seen = req.abortController;
      return new Promise<AiChatResponse>(() => undefined);
    };
    const outer = new AbortController();
    const guarded = withTurnDeadline(chat, { stallMs: STALL_MS });

    await expect(guarded(request({ abortController: outer }))).rejects.toThrow(AiTurnStalledError);

    expect(seen).toBeDefined();
    expect(seen).not.toBe(outer);
    expect(seen!.signal.aborted).toBe(true);
    expect(outer.signal.aborted).toBe(false);
  });

  it('follows the caller\'s abort through to the provider', async () => {
    let seen: AbortController | undefined;
    const chat: DeadlineChatFn = (req) => {
      seen = req.abortController;
      return new Promise<AiChatResponse>((resolve) => {
        req.abortController?.signal.addEventListener('abort', () => resolve(response()), { once: true });
      });
    };
    const outer = new AbortController();
    const guarded = withTurnDeadline(chat, { stallMs: 10_000 });

    const inFlight = guarded(request({ abortController: outer }));
    await sleep(5);
    outer.abort();

    await expect(inFlight).resolves.toEqual(response());
    expect(seen!.signal.aborted).toBe(true);
  });

  it('lets a slow turn run as long as the stream is alive', async () => {
    // A reasoning model can spend minutes before its first token. The deadline
    // is on silence, not on duration — five windows' worth of elapsed time here,
    // and it must not fire once.
    const chat: DeadlineChatFn = async (_req, callbacks) => {
      for (let i = 0; i < 5; i++) {
        await sleep(STALL_MS / 2);
        callbacks?.onActivity?.();
      }
      return response();
    };
    const guarded = withTurnDeadline(chat, { stallMs: STALL_MS });

    await expect(guarded(request())).resolves.toEqual(response());
  });

  it('counts text and tool-call partials as life too, and passes them on', async () => {
    const seen: string[] = [];
    const callbacks: AiStreamCallbacks = {
      onText: (full) => seen.push(`text:${full}`),
      onToolCallPartial: (p) => seen.push(`partial:${p.argsText}`),
      onToolCall: (c) => seen.push(`call:${c.name}`),
      onEnd: () => seen.push('end')
    };
    const chat: DeadlineChatFn = async (_req, cbs) => {
      await sleep(STALL_MS / 2);
      cbs?.onText?.('half', 'half');
      await sleep(STALL_MS / 2);
      cbs?.onToolCallPartial?.({ index: 0, name: 'submit_component', argsText: '{"nod' });
      await sleep(STALL_MS / 2);
      cbs?.onToolCall?.({ id: 'c1', name: 'submit_component', arguments: {} });
      cbs?.onEnd?.();
      return response();
    };
    const guarded = withTurnDeadline(chat, { stallMs: STALL_MS });

    await expect(guarded(request(), callbacks)).resolves.toEqual(response());
    expect(seen).toEqual(['text:half', 'partial:{"nod', 'call:submit_component', 'end']);
  });

  it('passes a provider error through unchanged rather than calling it a stall', async () => {
    const chat: DeadlineChatFn = async () => {
      throw new Error('402 payment required');
    };
    const guarded = withTurnDeadline(chat, { stallMs: STALL_MS });

    await expect(guarded(request())).rejects.toThrow('402 payment required');
    await expect(guarded(request())).rejects.not.toBeInstanceOf(AiTurnStalledError);
  });

  it('is the same function when the deadline is disabled', () => {
    const chat: DeadlineChatFn = async () => response();
    expect(withTurnDeadline(chat, { stallMs: 0 })).toBe(chat);
  });

  it('names the silence in seconds, so the message is about the provider', async () => {
    const chat: DeadlineChatFn = () => new Promise<AiChatResponse>(() => undefined);
    const guarded = withTurnDeadline(chat, { stallMs: 1000 });

    const error = await guarded(request()).catch((e) => e);
    expect(error).toBeInstanceOf(AiTurnStalledError);
    expect((error as AiTurnStalledError).silentMs).toBeGreaterThanOrEqual(1000);
    expect(error.message).toContain('stopped responding');
    expect(error.message).toContain('1 second');
  });
});
