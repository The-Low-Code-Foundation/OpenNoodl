/**
 * BLD-004 — the two paths cannot merge.
 *
 * ## Why this file exists and the panel specs do not cover it
 *
 * This is the one part of the task where a regression corrupts **authoring
 * output**, not a panel. The authoring loop parses the assistant's visible text
 * with XML templates; reasoning that reaches that string is parsed as if the
 * model had written it, and the result is a wrong component rather than an ugly
 * strip. Nothing downstream would report it as a reasoning bug — it surfaces as
 * a validation failure three layers away, on a payload that looks like the model
 * simply produced nonsense.
 *
 * So the assertion that matters here is a *negative* one, and it is checked
 * against a stream where the reasoning is deliberately written to look like the
 * answer: identical shape, adjacent indices, interleaved deltas.
 *
 * ## And the premise that had to be corrected first
 *
 * The adapter requested `thinking: { display: 'omitted' }` under a comment
 * saying that kept reasoning out of the parsed text. It never did: `display`
 * governs the thinking *block*, and thinking has never been part of a `text`
 * block on any setting. What `'omitted'` actually does is stream thinking blocks
 * whose text is **empty** — so `onReasoning` had nothing to report, and the
 * feature was inert rather than safe. The request-shape spec below pins the
 * corrected value, because the whole channel is downstream of it.
 */

import type { AnthropicCreateResult, AnthropicLike } from '@noodl-models/AiAssistant/client/providers/anthropic';
import { AnthropicProvider } from '@noodl-models/AiAssistant/client/providers/anthropic';
import { AiTurnStalledError, withTurnDeadline } from '@noodl-models/AiAssistant/client/turnDeadline';
import type { AiChatResponse, AiStreamCallbacks } from '@noodl-models/AiAssistant/client/types';

type CreateParams = Record<string, unknown>;

/**
 * ⚠️ Under `tests-unit/`, not `tests/ai/` beside the other adapter specs — those
 * run on the editor's *other* runner, which is red on six inherited failures and
 * takes twenty minutes. A check that only ever runs there is one nobody reads
 * before committing, and this is the check that guards authoring output.
 */
async function* asyncIterable<T>(items: T[]): AsyncGenerator<T> {
  for (const item of items) yield item;
}

function stubClient(handler: (params: CreateParams) => AnthropicCreateResult): {
  client: AnthropicLike;
  calls: CreateParams[];
} {
  const calls: CreateParams[] = [];
  return {
    client: {
      messages: {
        create: async (params) => {
          calls.push(params);
          return handler(params);
        }
      }
    },
    calls
  };
}

/**
 * A turn that thinks and then answers, with the reasoning written to be as
 * confusable with the answer as the wire format allows: same event type, same
 * delta shape, interleaved, and phrased like prose.
 */
const THINKING_STREAM = [
  { type: 'message_start', message: { model: 'claude-opus-4-8', usage: { input_tokens: 100, output_tokens: 0 } } },
  { type: 'content_block_start', index: 0, content_block: { type: 'thinking' } },
  { type: 'content_block_delta', index: 0, delta: { type: 'thinking_delta', thinking: 'The user wants a ' } },
  { type: 'content_block_delta', index: 0, delta: { type: 'thinking_delta', thinking: '<Group> at the root.' } },
  { type: 'content_block_stop', index: 0 },
  { type: 'content_block_start', index: 1, content_block: { type: 'text', text: '' } },
  { type: 'content_block_delta', index: 1, delta: { type: 'text_delta', text: 'Building the ' } },
  // Interleaved on purpose: a real adaptive turn thinks again between tokens.
  { type: 'content_block_delta', index: 0, delta: { type: 'thinking_delta', thinking: ' Then the rows.' } },
  { type: 'content_block_delta', index: 1, delta: { type: 'text_delta', text: 'cart page.' } },
  { type: 'content_block_stop', index: 1 },
  { type: 'message_delta', delta: { stop_reason: 'end_turn' }, usage: { output_tokens: 20 } },
  { type: 'message_stop' }
];

/** The same turn with every thinking event removed — the before-and-after control. */
const TEXT_ONLY_STREAM = THINKING_STREAM.filter(
  (event) => event.delta?.type !== 'thinking_delta' && event.content_block?.type !== 'thinking'
);

describe('BLD-004: the reasoning channel', () => {
  it('routes reasoning to onReasoning and never into the response text', async () => {
    const { client } = stubClient(() => asyncIterable(THINKING_STREAM));
    const provider = new AnthropicProvider({ apiKey: 'test', client });

    const reasoning: string[] = [];
    const text: string[] = [];
    const response = await provider.chatStream(
      { model: 'claude-opus-4-8', messages: [{ role: 'user', content: 'Build a cart' }] },
      {
        onReasoning: (_full, delta) => reasoning.push(delta),
        onText: (_full, delta) => text.push(delta)
      }
    );

    expect(reasoning).toEqual(['The user wants a ', '<Group> at the root.', ' Then the rows.']);
    expect(text).toEqual(['Building the ', 'cart page.']);

    // The assertion the task is actually about. `response.text` is what the XML
    // templates parse — and the reasoning above contains `<Group>` precisely so
    // that a leak would be a *parseable* one rather than obvious noise.
    expect(response.text).toBe('Building the cart page.');
    expect(response.text).not.toContain('The user wants');
    expect(response.text).not.toContain('<Group>');
  });

  it('produces byte-identical authoring output with the reasoning present and absent', async () => {
    // Acceptance criterion 4, run both ways and diffed. Same fixture turn, once
    // with its thinking events and once with them stripped: if any part of the
    // reasoning reached the parsed text, these two strings differ.
    const withThinking = new AnthropicProvider({
      apiKey: 'test',
      client: stubClient(() => asyncIterable(THINKING_STREAM)).client
    });
    const without = new AnthropicProvider({
      apiKey: 'test',
      client: stubClient(() => asyncIterable(TEXT_ONLY_STREAM)).client
    });

    const request = { model: 'claude-opus-4-8', messages: [{ role: 'user' as const, content: 'Build a cart' }] };
    const a = await withThinking.chatStream(request, {});
    const b = await without.chatStream(request, {});

    expect(a.text).toBe(b.text);
    expect(a.toolCalls).toEqual(b.toolCalls);
  });

  it('leaves onReasoning uncalled on a turn that does not think', async () => {
    // Providers with no reasoning channel simply never call it, and nothing
    // synthesises one from the visible text — a "reasoning" strip fabricated
    // out of the answer would be a claim about the model's process that nobody
    // measured.
    const { client } = stubClient(() => asyncIterable(TEXT_ONLY_STREAM));
    const provider = new AnthropicProvider({ apiKey: 'test', client });

    const onReasoning = jest.fn();
    await provider.chatStream(
      { model: 'claude-opus-4-8', messages: [{ role: 'user', content: 'Hi' }] },
      { onReasoning }
    );

    expect(onReasoning).not.toHaveBeenCalled();
  });

  it('counts a reasoning delta as life on the wire', async () => {
    // The turn deadline and the panel's pulse both key on `onActivity`, and a
    // long silent reasoning phase is *exactly* the turn worth waiting for. An
    // implementation that only reported text would kill it.
    const { client } = stubClient(() => asyncIterable(THINKING_STREAM));
    const provider = new AnthropicProvider({ apiKey: 'test', client });

    const onActivity = jest.fn();
    await provider.chatStream(
      { model: 'claude-opus-4-8', messages: [{ role: 'user', content: 'Hi' }] },
      { onActivity }
    );

    expect(onActivity).toHaveBeenCalledTimes(THINKING_STREAM.length);
  });

  it('asks for the reasoning summary, because `omitted` returns empty blocks', async () => {
    // ⚠️ The whole channel is downstream of this one field. With `'omitted'`
    // the thinking blocks still arrive and their text is empty, so every
    // assertion above would pass against a stream that never carries anything —
    // a feature that is inert rather than broken, and therefore invisible.
    const { client, calls } = stubClient(() => asyncIterable(TEXT_ONLY_STREAM));
    const provider = new AnthropicProvider({ apiKey: 'test', client });

    await provider.chatStream({ model: 'claude-opus-4-8', messages: [{ role: 'user', content: 'Hi' }] }, {});

    expect(calls[0].thinking).toEqual({ type: 'adaptive', display: 'summarized' });
  });
});

describe('BLD-004: reasoning keeps the turn alive', () => {
  /**
   * `withTurnDeadline` wraps every callback the provider might call, because it
   * is the wrapper the provider actually talks to. Adding a callback to
   * `AiStreamCallbacks` and forgetting to wrap it there has two costs, and the
   * second is the one that bites: the caller's callback stops being delivered at
   * all, and the deadline stops counting the events it carries.
   *
   * The Anthropic adapter fires `onActivity` for every event including thinking
   * ones, so today the deadline is safe either way. This pins the wrapper
   * directly so that a future adapter reporting reasoning *without* `onActivity`
   * — the shape an OpenAI-compatible `reasoning_content` stream would take — does
   * not get its longest, most valuable turns killed at three minutes.
   */
  const STALL_MS = 60;

  const okResponse = (): AiChatResponse => ({
    text: 'done',
    toolCalls: [],
    usage: { promptTokens: 1, completionTokens: 1, cacheReadTokens: 0, cacheWriteTokens: 0, costUsd: 0 },
    model: 'test',
    stopReason: 'stop'
  });

  const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

  it('forwards the callback through the deadline wrapper', async () => {
    let seen: string | undefined;
    const guarded = withTurnDeadline(
      async (_request, callbacks?: AiStreamCallbacks) => {
        callbacks?.onReasoning?.('thinking about it', 'thinking about it');
        return okResponse();
      },
      { stallMs: STALL_MS }
    );

    await guarded({ messages: [{ role: 'user', content: 'hi' }] }, { onReasoning: (full) => (seen = full) });
    expect(seen).toBe('thinking about it');
  });

  it('counts a reasoning delta as life, so a long silent think is not a stall', async () => {
    // Reasoning only — no text, no tool call, no `onActivity`. Run for four
    // stall windows: without the wrapper this rejects at the first one.
    const guarded = withTurnDeadline(
      async (_request, callbacks?: AiStreamCallbacks) => {
        for (let i = 0; i < 8; i++) {
          await sleep(STALL_MS / 2);
          callbacks?.onReasoning?.(`step ${i}`, `step ${i}`);
        }
        return okResponse();
      },
      { stallMs: STALL_MS }
    );

    await expect(guarded({ messages: [{ role: 'user', content: 'hi' }] }, {})).resolves.toMatchObject({
      text: 'done'
    });
  });

  it('still ends a turn that goes silent after reasoning', async () => {
    // The other direction, and the one that keeps the first test honest: a
    // wrapper that simply never timed out would pass the test above too.
    const guarded = withTurnDeadline(
      (_request, callbacks?: AiStreamCallbacks) =>
        new Promise<AiChatResponse>(() => {
          callbacks?.onReasoning?.('one thought', 'one thought');
        }),
      { stallMs: STALL_MS }
    );

    await expect(guarded({ messages: [{ role: 'user', content: 'hi' }] }, {})).rejects.toThrow(AiTurnStalledError);
  });
});
