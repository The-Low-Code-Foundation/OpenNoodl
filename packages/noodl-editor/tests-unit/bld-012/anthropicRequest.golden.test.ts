/**
 * BLD-012 — the cache boundary lands where it always did.
 *
 * ⚠️ This is the spec the task warned about. Redefining `cacheBoundary` against
 * block content is the one change here that fails *silently*: get it wrong and
 * prompt caching stops working with no error, no log line and no visible
 * symptom — just a bill. So the pre-BLD-012 request is recorded below byte for
 * byte, captured from the adapter before the type was widened, and a text-only
 * turn must still reproduce it exactly.
 *
 * The golden covers all three breakpoints the adapter budgets for (AIX-007):
 * the opening turn's split, the end of system, and the newest turn. Do not
 * "tidy" it — every byte is the assertion.
 */

import type { AnthropicRequestBlock } from '@noodl-models/AiAssistant/client/providers/anthropic';
import { AnthropicProvider, toAnthropicMessages } from '@noodl-models/AiAssistant/client/providers/anthropic';
import type { AiContentBlock, AiMessage } from '@noodl-models/AiAssistant/client/types';

const STABLE = '--- PROJECT OVERVIEW ---\nA storefront.\n--- END PROJECT OVERVIEW ---\n\n';
const VARIABLE = '--- TASK ---\nBuild a product card.\n--- END TASK ---';

const TEXT_ONLY: AiMessage[] = [
  { role: 'system', content: 'You are an authoring agent.' },
  { role: 'user', content: STABLE + VARIABLE, cacheBoundary: STABLE.length },
  {
    role: 'assistant',
    content: 'Reading the catalog.',
    toolCalls: [{ id: 'call_1', name: 'get_project_doc', arguments: { path: 'ARCHITECTURE.md' } }]
  },
  { role: 'tool', content: '# Architecture', toolCallId: 'call_1', name: 'get_project_doc' },
  { role: 'user', content: 'Make the title bigger.' }
];

/** The request as it shipped before BLD-012, recorded from the adapter itself. */
const GOLDEN = {
  model: 'claude-sonnet-5',
  max_tokens: 4096,
  messages: [
    {
      role: 'user',
      content: [
        {
          type: 'text',
          text: '--- PROJECT OVERVIEW ---\nA storefront.\n--- END PROJECT OVERVIEW ---\n\n',
          cache_control: { type: 'ephemeral' }
        },
        { type: 'text', text: '--- TASK ---\nBuild a product card.\n--- END TASK ---' }
      ]
    },
    {
      role: 'assistant',
      content: [
        { type: 'text', text: 'Reading the catalog.' },
        { type: 'tool_use', id: 'call_1', name: 'get_project_doc', input: { path: 'ARCHITECTURE.md' } }
      ]
    },
    { role: 'user', content: [{ type: 'tool_result', tool_use_id: 'call_1', content: '# Architecture' }] },
    {
      role: 'user',
      content: [{ type: 'text', text: 'Make the title bigger.', cache_control: { type: 'ephemeral' } }]
    }
  ],
  system: [{ type: 'text', text: 'You are an authoring agent.', cache_control: { type: 'ephemeral' } }],
  /**
   * ⚠️ Changed by **BLD-004**, deliberately, and this spec is how it was noticed
   * — which is the point of a golden that pins the whole request rather than the
   * fields one task happened to care about.
   *
   * `'omitted'` was not protecting the XML-parsed text (thinking has never been
   * part of a `text` block on any setting); it made the thinking blocks arrive
   * empty, so the reasoning channel had nothing to carry. `'summarized'` is
   * billed identically — `display` controls visibility only.
   *
   * Everything else on this object is still the pre-BLD-012 shape, which is what
   * this file is for.
   */
  thinking: { type: 'adaptive', display: 'summarized' },
  output_config: { effort: 'medium' }
};

/** Capture the params the adapter hands the SDK, without a network call. */
async function captureRequest(messages: AiMessage[], model = 'claude-sonnet-5'): Promise<Record<string, unknown>> {
  let captured: Record<string, unknown> = {};
  const provider = new AnthropicProvider({
    apiKey: 'test-key',
    client: {
      messages: {
        create: async (params: Record<string, unknown>) => {
          captured = params;
          return { model, stop_reason: 'end_turn', content: [], usage: {} };
        }
      }
    }
  });
  await provider.chat({ messages, model, maxTokens: 4096, effort: 'medium' });
  return captured;
}

const PNG_1PX =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

function imageBlock(overrides: Partial<AiContentBlock> = {}): AiContentBlock {
  return {
    type: 'image',
    data: PNG_1PX,
    mediaType: 'image/png',
    text: 'A one-pixel transparent PNG.',
    ...overrides
  } as AiContentBlock;
}

describe('BLD-012 — a text-only turn is byte-identical to before the widening', () => {
  it('reproduces the recorded pre-BLD-012 request exactly', async () => {
    const captured = await captureRequest(TEXT_ONLY);
    expect(JSON.stringify(captured)).toBe(JSON.stringify(GOLDEN));
  });

  it('still spends exactly one mapper breakpoint on the opening turn', () => {
    const { breakpoints } = toAnthropicMessages(TEXT_ONLY, { cacheBoundaries: true, maxBoundaries: 2 });
    expect(breakpoints).toBe(1);
  });
});

describe('BLD-012 — the block form puts the breakpoint in the same place', () => {
  /**
   * The equivalence that matters: the same opening turn expressed as two text
   * blocks with `cache: true` on the stable one must produce the same two
   * Anthropic blocks, with `cache_control` on the same one, as the character
   * offset did. If this drifts, caching silently stops matching the prefix.
   */
  it('marks the same block the offset split would have marked', () => {
    const asOffset = toAnthropicMessages([{ role: 'user', content: STABLE + VARIABLE, cacheBoundary: STABLE.length }], {
      cacheBoundaries: true
    });
    const asBlocks = toAnthropicMessages(
      [
        {
          role: 'user',
          content: [
            { type: 'text', text: STABLE, cache: true },
            { type: 'text', text: VARIABLE }
          ]
        }
      ],
      { cacheBoundaries: true }
    );

    expect(JSON.stringify(asBlocks.messages)).toBe(JSON.stringify(asOffset.messages));
    expect(asBlocks.breakpoints).toBe(asOffset.breakpoints);
  });

  it('spends from the same budget, so the four-marker cap still holds', () => {
    const messages: AiMessage[] = [
      { role: 'user', content: [{ type: 'text', text: 'a', cache: true }, { type: 'text', text: 'b' }] },
      { role: 'assistant', content: 'ok' },
      { role: 'user', content: [{ type: 'text', text: 'c', cache: true }, { type: 'text', text: 'd' }] },
      { role: 'assistant', content: 'ok' },
      { role: 'user', content: [{ type: 'text', text: 'e', cache: true }, { type: 'text', text: 'f' }] }
    ];
    const { breakpoints } = toAnthropicMessages(messages, { cacheBoundaries: true, maxBoundaries: 2 });
    expect(breakpoints).toBe(2);
  });

  it('leaves an unmarked block turn without a breakpoint', () => {
    const { messages, breakpoints } = toAnthropicMessages(
      [{ role: 'user', content: [{ type: 'text', text: 'no marker here' }] }],
      { cacheBoundaries: true }
    );
    expect(breakpoints).toBe(0);
    expect(JSON.stringify(messages[0].content)).not.toContain('cache_control');
  });

  it('honours the last marked block when more than one is marked', () => {
    const { messages } = toAnthropicMessages(
      [
        {
          role: 'user',
          content: [
            { type: 'text', text: 'first', cache: true },
            { type: 'text', text: 'second', cache: true },
            { type: 'text', text: 'tail' }
          ]
        }
      ],
      { cacheBoundaries: true }
    );
    const blocks = messages[0].content as AnthropicRequestBlock[];
    expect(blocks[0].cache_control).toBeUndefined();
    expect(blocks[1].cache_control).toEqual({ type: 'ephemeral' });
    expect(blocks[2].cache_control).toBeUndefined();
  });

  it('keeps the marker on its own block when an image precedes it', () => {
    // Positional safety: an image ahead of the boundary must not shift it. This
    // is the case a block *index* would have got wrong, and the reason the
    // marker rides on the block. (Degradation itself is asserted in
    // providers.test.ts, which goes through the vision gate; the mapper here is
    // deliberately below it.)
    const content: AiContentBlock[] = [
      imageBlock(),
      { type: 'text', text: 'reference material', cache: true },
      { type: 'text', text: 'the task' }
    ];
    const { messages } = toAnthropicMessages([{ role: 'user', content }], { cacheBoundaries: true });
    const blocks = messages[0].content as { type: string; cache_control?: unknown }[];
    expect(blocks.length).toBe(3);
    expect(blocks[1].cache_control).toEqual({ type: 'ephemeral' });
  });
});

describe('BLD-012 — a boundary paired with blocks is rejected, not ignored', () => {
  it('throws rather than silently losing the breakpoint', () => {
    expect(() =>
      toAnthropicMessages(
        [{ role: 'user', content: [{ type: 'text', text: 'blocks' }], cacheBoundary: 3 }],
        { cacheBoundaries: true }
      )
    ).toThrow(/character offset/);
  });
});

export { captureRequest, imageBlock, PNG_1PX };
