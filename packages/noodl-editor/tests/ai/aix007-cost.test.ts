/**
 * AIX-007: token cost reduction — caching, effort, and honest accounting.
 *
 * Three things are worth pinning down offline, because live runs prove them
 * only for whatever prompt happened to run:
 *
 *  - the *shape* of a cached request (where breakpoints land, how many there
 *    are, and that a non-caching model gets none),
 *  - the *arithmetic* of cache pricing, which is the thing that would flatter
 *    the A/B if it were wrong,
 *  - the *ordering* invariant the caching depends on — stable content first,
 *    the varying task last.
 *
 * Whether the cache is actually hit is a live-run question, and the harness
 * asserts it there (`cacheVerified`).
 */

import { asText } from '../../src/editor/src/models/AiAssistant/client/content';
import { AUTHORING_EFFORT, AuthoringSession } from '../../src/editor/src/models/AiAssistant/authoring/AuthoringSession';
import {
  initialUserMessage,
  updateUserMessage
} from '../../src/editor/src/models/AiAssistant/authoring/prompts/authoring';
import type { AuthoringRequest } from '../../src/editor/src/models/AiAssistant/authoring/types';
import {
  CACHE_READ_MULTIPLIER,
  CACHE_WRITE_MULTIPLIER,
  calculateCostUsd,
  findModel
} from '../../src/editor/src/models/AiAssistant/client/models';
import {
  AnthropicCreateResult,
  AnthropicLike,
  AnthropicProvider,
  AnthropicRequestBlock,
  AnthropicRequestMessage,
  toAnthropicMessages
} from '../../src/editor/src/models/AiAssistant/client/providers/anthropic';
import type { AiMessage } from '../../src/editor/src/models/AiAssistant/client/types';
import { totalPromptTokens } from '../../src/editor/src/models/AiAssistant/client/types';

import { asyncIterable } from './helpers';

type CreateParams = Record<string, unknown>;

function stubClient(handler: (params: CreateParams) => AnthropicCreateResult): {
  client: AnthropicLike;
  calls: CreateParams[];
} {
  const calls: CreateParams[] = [];
  return {
    calls,
    client: {
      messages: {
        create: async (params) => {
          calls.push(params);
          return handler(params);
        }
      }
    }
  };
}

const EMPTY_REPLY = { model: 'claude-sonnet-5', stop_reason: 'end_turn', content: [], usage: {} };

/** Every content block in a built request, system first — the render order. */
function allBlocks(params: CreateParams): AnthropicRequestBlock[] {
  const blocks: AnthropicRequestBlock[] = [];
  if (Array.isArray(params.system)) blocks.push(...(params.system as AnthropicRequestBlock[]));
  for (const message of (params.messages ?? []) as AnthropicRequestMessage[]) {
    if (Array.isArray(message.content)) blocks.push(...message.content);
  }
  return blocks;
}

function breakpointCount(params: CreateParams): number {
  return allBlocks(params).filter((block) => block.cache_control).length;
}

async function buildRequest(messages: AiMessage[], model = 'claude-sonnet-5'): Promise<CreateParams> {
  const { client, calls } = stubClient(() => EMPTY_REPLY);
  await new AnthropicProvider({ apiKey: 'test', client }).chat({ model, messages });
  return calls[0];
}

const OPENING: AiMessage = {
  role: 'user',
  content: 'STABLE REFERENCE MATERIAL\nVARIABLE TASK',
  cacheBoundary: 'STABLE REFERENCE MATERIAL\n'.length
};

// ── Request shape ─────────────────────────────────────────────────────────────

describe('AIX-007 cache breakpoints', () => {
  it('caches the system prompt as a block, which covers the tool definitions too', async () => {
    const params = await buildRequest([
      { role: 'system', content: 'Contract.' },
      { role: 'user', content: 'Build it.' }
    ]);

    // Anthropic renders tools → system → messages, so one marker on the last
    // system block makes the whole fixed preamble a cacheable prefix.
    expect(params.system).toEqual([{ type: 'text', text: 'Contract.', cache_control: { type: 'ephemeral' } }]);
  });

  it('sends no cache_control at all for a model without prompt caching', async () => {
    const params = await buildRequest(
      [
        { role: 'system', content: 'Contract.' },
        OPENING
      ],
      'claude-haiku-4-5'
    );

    expect(params.system).toBe('Contract.');
    expect(breakpointCount(params)).toBe(0);
    // The boundary is a hint, not an instruction: the turn goes whole.
    expect((params.messages as AnthropicRequestMessage[])[0].content).toBe(asText(OPENING.content));
  });

  it('splits the opening turn at its boundary and caches only the stable half', async () => {
    const params = await buildRequest([{ role: 'system', content: 'Contract.' }, OPENING]);
    const opening = (params.messages as AnthropicRequestMessage[])[0];
    const blocks = opening.content as AnthropicRequestBlock[];

    expect(blocks.length).toBe(2);
    expect(blocks[0].text).toBe('STABLE REFERENCE MATERIAL\n');
    expect(blocks[0].cache_control).toEqual({ type: 'ephemeral' });
    expect(blocks[1].text).toBe('VARIABLE TASK');
    // Splitting must not change what was sent, only how it is billed.
    expect(String(blocks[0].text) + String(blocks[1].text)).toBe(asText(OPENING.content));
  });

  it('marks the newest turn, so the next request can read this one', async () => {
    const params = await buildRequest([
      { role: 'system', content: 'Contract.' },
      OPENING,
      { role: 'assistant', content: '', toolCalls: [{ id: 'a', name: 'get_node_types', arguments: {} }] },
      { role: 'tool', toolCallId: 'a', name: 'get_node_types', content: 'docs' }
    ]);

    const messages = params.messages as AnthropicRequestMessage[];
    const last = messages[messages.length - 1].content as AnthropicRequestBlock[];
    expect(last[last.length - 1].cache_control).toEqual({ type: 'ephemeral' });
  });

  it('promotes a string turn to a block so it can carry the marker', async () => {
    const params = await buildRequest([
      { role: 'system', content: 'Contract.' },
      { role: 'user', content: 'Just a plain turn.' }
    ]);

    const content = (params.messages as AnthropicRequestMessage[])[0].content;
    expect(content).toEqual([{ type: 'text', text: 'Just a plain turn.', cache_control: { type: 'ephemeral' } }]);
  });

  it('ignores a boundary that is not actually a split', () => {
    // At either end there is no shared prefix to cache — only a write to pay for.
    for (const cacheBoundary of [0, 'Hello'.length]) {
      const out = toAnthropicMessages([{ role: 'user', content: 'Hello', cacheBoundary }], {
        cacheBoundaries: true
      });
      expect(out.breakpoints).toBe(0);
      expect(out.messages[0].content).toBe('Hello');
    }
  });

  it('stops splitting once the boundary budget is spent, keeping the earliest', () => {
    const turns: AiMessage[] = [0, 1, 2].map((i) => ({
      role: 'user',
      content: `STABLE ${i}\nVARIABLE ${i}`,
      cacheBoundary: `STABLE ${i}\n`.length
    }));

    const out = toAnthropicMessages(turns, { cacheBoundaries: true, maxBoundaries: 2 });
    expect(out.breakpoints).toBe(2);
    // The earliest boundaries cover the longest prefixes, so they are the ones
    // worth keeping; the last turn falls back to unsplit content.
    expect(Array.isArray(out.messages[0].content)).toBe(true);
    expect(Array.isArray(out.messages[1].content)).toBe(true);
    expect(out.messages[2].content).toBe(asText(turns[2].content));
  });

  it('never exceeds the four-breakpoint cap, which the API rejects outright', async () => {
    const messages: AiMessage[] = [{ role: 'system', content: 'Contract.' }];
    // Four boundary-carrying turns is more than the budget allows; the last-turn
    // marker is the one that gets dropped, not the request.
    for (let i = 0; i < 4; i++) {
      messages.push({ role: 'user', content: `STABLE ${i}\nVARIABLE ${i}`, cacheBoundary: `STABLE ${i}\n`.length });
      messages.push({ role: 'assistant', content: `ok ${i}` });
    }

    const params = await buildRequest(messages);
    expect(breakpointCount(params)).toBeLessThanOrEqual(4);
  });

  it('spends three breakpoints on a typical authoring turn', async () => {
    const params = await buildRequest([{ role: 'system', content: 'Contract.' }, OPENING]);
    // system, end of the reference blocks, end of the newest turn.
    expect(breakpointCount(params)).toBe(3);
  });
});

// ── Effort ────────────────────────────────────────────────────────────────────

describe('AIX-007 effort', () => {
  it('sends the requested reasoning depth', async () => {
    const { client, calls } = stubClient(() => EMPTY_REPLY);
    await new AnthropicProvider({ apiKey: 'test', client }).chat({
      model: 'claude-sonnet-5',
      messages: [{ role: 'user', content: 'Hi' }],
      effort: 'low'
    });

    expect(calls[0].output_config).toEqual({ effort: 'low' });
  });

  it('omits it entirely when unset, rather than guessing a level', async () => {
    const params = await buildRequest([{ role: 'user', content: 'Hi' }]);
    expect(params.output_config).toBeUndefined();
  });

  it('never sends it to a model that does not accept it', async () => {
    const { client, calls } = stubClient(() => EMPTY_REPLY);
    await new AnthropicProvider({ apiKey: 'test', client }).chat({
      model: 'claude-haiku-4-5',
      messages: [{ role: 'user', content: 'Hi' }],
      effort: 'low'
    });

    expect(calls[0].output_config).toBeUndefined();
  });

  it('gives the authoring loop a deliberate level rather than the API default', () => {
    expect(['low', 'medium', 'high', 'xhigh', 'max']).toContain(AUTHORING_EFFORT);
  });
});

// ── Accounting ────────────────────────────────────────────────────────────────

describe('AIX-007 cache accounting', () => {
  it('reports cache reads and writes from a non-streamed response', async () => {
    const { client } = stubClient(() => ({
      model: 'claude-sonnet-5',
      stop_reason: 'end_turn',
      content: [{ type: 'text', text: 'ok' }],
      usage: {
        input_tokens: 100,
        output_tokens: 10,
        cache_read_input_tokens: 9_000,
        cache_creation_input_tokens: 500
      }
    }));

    const usage = (
      await new AnthropicProvider({ apiKey: 'test', client }).chat({
        model: 'claude-sonnet-5',
        messages: [{ role: 'user', content: 'Hi' }]
      })
    ).usage;

    expect(usage.promptTokens).toBe(100);
    expect(usage.cacheReadTokens).toBe(9_000);
    expect(usage.cacheWriteTokens).toBe(500);
    // Anthropic reports the uncached remainder in input_tokens, so the real
    // prompt size is the sum — reading promptTokens alone under-reports it.
    expect(totalPromptTokens(usage)).toBe(9_600);
  });

  it('reports cache reads and writes from a stream', async () => {
    const events = [
      {
        type: 'message_start',
        message: {
          model: 'claude-sonnet-5',
          usage: { input_tokens: 12, output_tokens: 0, cache_read_input_tokens: 7_000, cache_creation_input_tokens: 0 }
        }
      },
      { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: 'hi' } },
      { type: 'message_delta', delta: { stop_reason: 'end_turn' }, usage: { output_tokens: 4 } }
    ];
    const { client } = stubClient(() => asyncIterable(events));

    const usage = (
      await new AnthropicProvider({ apiKey: 'test', client }).chatStream(
        { model: 'claude-sonnet-5', messages: [{ role: 'user', content: 'Hi' }] },
        {}
      )
    ).usage;

    expect(usage.cacheReadTokens).toBe(7_000);
    expect(usage.cacheWriteTokens).toBe(0);
  });

  it('reports zeroes — not absent fields — for a provider that does not cache', async () => {
    const { client } = stubClient(() => ({ ...EMPTY_REPLY, usage: { input_tokens: 5, output_tokens: 1 } }));

    const usage = (
      await new AnthropicProvider({ apiKey: 'test', client }).chat({
        model: 'claude-sonnet-5',
        messages: [{ role: 'user', content: 'Hi' }]
      })
    ).usage;

    expect(usage.cacheReadTokens).toBe(0);
    expect(usage.cacheWriteTokens).toBe(0);
  });
});

describe('AIX-007 cache pricing', () => {
  const model = findModel('claude-sonnet-5', 'anthropic');

  it('prices a cache read at a tenth of a fresh input token', () => {
    const fresh = calculateCostUsd(model, 1_000_000, 0);
    const cached = calculateCostUsd(model, 0, 0, { cacheReadTokens: 1_000_000 });
    expect(cached).toBeCloseTo(fresh * CACHE_READ_MULTIPLIER, 9);
  });

  it('prices a cache write above a fresh input token', () => {
    const fresh = calculateCostUsd(model, 1_000_000, 0);
    const written = calculateCostUsd(model, 0, 0, { cacheWriteTokens: 1_000_000 });
    expect(written).toBeCloseTo(fresh * CACHE_WRITE_MULTIPLIER, 9);
    expect(written).toBeGreaterThan(fresh);
  });

  it('is unchanged for a request that used no cache', () => {
    // The regression that matters: adding cache pricing must not move the
    // number for the baseline it is being compared against.
    expect(calculateCostUsd(model, 1_000, 500, {})).toBe(calculateCostUsd(model, 1_000, 500));
  });

  it('would have under-reported the same run before the fix', () => {
    // 10k prefix read back at 0.1x is not free, and reporting it as free is
    // exactly the flattering error this task exists to prevent.
    const withCache = calculateCostUsd(model, 100, 50, { cacheReadTokens: 10_000, cacheWriteTokens: 2_000 });
    const ignoringCache = calculateCostUsd(model, 100, 50);
    expect(withCache).toBeGreaterThan(ignoringCache);
  });

  it('still reports null for a model with no pricing', () => {
    const unpriced = { ...model, pricing: undefined };
    expect(calculateCostUsd(unpriced, 10, 10, { cacheReadTokens: 10 })).toBeNull();
  });
});

// ── Cancellation ──────────────────────────────────────────────────────────────

describe('AIX-007 cancelled turns', () => {
  const graph = { components: [], nodeTypes: [] } as never;

  it('reports a swallowed abort as cancelled, not as a model that stopped acting', async () => {
    // The Anthropic adapter resolves (rather than throws) on abort so callers
    // keep the partial text. Without an explicit check that looks exactly like
    // "replied with prose and no tool call", which nudges and then exhausts.
    const session = AuthoringSession.create(
      graph,
      { componentPath: '/Pages/Cancelled', description: 'anything' },
      {
        chat: async () => ({
          text: 'partial…',
          toolCalls: [],
          model: 'claude-sonnet-5',
          stopReason: 'aborted' as const,
          usage: { promptTokens: 1, completionTokens: 1, cacheReadTokens: 0, cacheWriteTokens: 0, costUsd: 0 }
        })
      }
    );

    const outcome = await session.run();
    expect(outcome.status).toBe('cancelled');
    // One turn, not two: the nudge must not have fired.
    expect(outcome.metrics.turns).toBe(1);
  });
});

// ── Prompt ordering ───────────────────────────────────────────────────────────

describe('AIX-007 opening-turn ordering', () => {
  const request: AuthoringRequest = {
    componentPath: '/Pages/Home',
    description: 'A hero with a call to action.'
  };
  const PROJECT = 'PROJECT-OVERVIEW-BODY';
  const CATALOG = 'CATALOG-BODY';
  const STYLE = 'STYLE-BODY';

  it('puts every stable block before the boundary and the task after it', () => {
    const turn = initialUserMessage(request, PROJECT, CATALOG, STYLE);
    const stable = turn.content.slice(0, turn.cacheBoundary);
    const variable = turn.content.slice(turn.cacheBoundary);

    for (const body of [PROJECT, CATALOG, STYLE]) expect(stable).toContain(body);
    expect(stable).not.toContain(request.description);
    expect(variable).toContain(request.description);
    expect(variable).toContain(request.componentPath);
  });

  it('produces a byte-identical prefix for two different requests in one project', () => {
    // This is the whole mechanism: caching is a prefix match, so two components
    // authored against one project must share their prefix exactly.
    const a = initialUserMessage(request, PROJECT, CATALOG, STYLE);
    const b = initialUserMessage(
      { componentPath: '/Pages/Other', description: 'Something else entirely.' },
      PROJECT,
      CATALOG,
      STYLE
    );

    expect(a.cacheBoundary).toBe(b.cacheBoundary);
    expect(a.content.slice(0, a.cacheBoundary)).toBe(b.content.slice(0, b.cacheBoundary));
  });

  it('keeps the update mode’s current component out of the cached prefix', () => {
    const source = 'CURRENT-COMPONENT-SOURCE';
    const turn = updateUserMessage(request, source, PROJECT, CATALOG, STYLE);
    const stable = turn.content.slice(0, turn.cacheBoundary);

    expect(stable).not.toContain(source);
    expect(turn.content.slice(turn.cacheBoundary)).toContain(source);
    // …and the shared prefix is the same one create mode caches.
    expect(stable).toBe(initialUserMessage(request, PROJECT, CATALOG, STYLE).content.slice(0, turn.cacheBoundary));
  });

  it('still works when the project has no style vocabulary', () => {
    const turn = initialUserMessage(request, PROJECT, CATALOG);
    expect(turn.cacheBoundary).toBeGreaterThan(0);
    expect(turn.cacheBoundary).toBeLessThan(turn.content.length);
    expect(turn.content.slice(0, turn.cacheBoundary)).toContain(CATALOG);
  });
});
