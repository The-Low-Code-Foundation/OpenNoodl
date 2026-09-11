/**
 * AIX-001: Anthropic adapter, against a stubbed SDK client.
 *
 * No live API calls: the adapter takes the SDK client as an injection seam and
 * these specs feed it recorded event sequences.
 */

import {
  AnthropicCreateResult,
  AnthropicLike,
  AnthropicProvider,
  AnthropicRequestBlock,
  AnthropicRequestMessage,
  toAnthropicMessages
} from '../../src/editor/src/models/AiAssistant/client/providers/anthropic';
import { AiClientError, AiMessage, AiToolCall } from '../../src/editor/src/models/AiAssistant/client/types';

import { asyncIterable, expectAiClientError } from './helpers';

type CreateParams = Record<string, unknown>;

function stubClient(handler: (params: CreateParams, options?: { signal?: AbortSignal }) => AnthropicCreateResult): {
  client: AnthropicLike;
  calls: CreateParams[];
} {
  const calls: CreateParams[] = [];
  const client: AnthropicLike = {
    messages: {
      create: async (params, options) => {
        calls.push(params);
        return handler(params, options);
      }
    }
  };
  return { client, calls };
}

/** Assert a built message carries block content, and narrow it for the assertions. */
function blocksOf(message: AnthropicRequestMessage): AnthropicRequestBlock[] {
  if (!Array.isArray(message.content)) {
    throw new Error(`Expected block content, got: ${JSON.stringify(message.content)}`);
  }
  return message.content;
}

/** An error shaped like the one the SDK throws for an HTTP failure. */
function sdkError(message: string, status: number): Error & { status: number } {
  return Object.assign(new Error(message), { status });
}

const TEXT_STREAM = [
  { type: 'message_start', message: { model: 'claude-opus-4-8', usage: { input_tokens: 120, output_tokens: 0 } } },
  { type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } },
  { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: 'Hello' } },
  { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: ' world' } },
  { type: 'content_block_stop', index: 0 },
  { type: 'message_delta', delta: { stop_reason: 'end_turn' }, usage: { output_tokens: 8 } },
  { type: 'message_stop' }
];

describe('toAnthropicMessages', () => {
  it('hoists system messages out of the message list', () => {
    const result = toAnthropicMessages([
      { role: 'system', content: 'You are helpful.' },
      { role: 'user', content: 'Hi' }
    ]);
    expect(result.system).toBe('You are helpful.');
    expect(result.messages).toEqual([{ role: 'user', content: 'Hi' }]);
  });

  it('joins multiple system messages', () => {
    const result = toAnthropicMessages([
      { role: 'system', content: 'A' },
      { role: 'system', content: 'B' },
      { role: 'user', content: 'Hi' }
    ]);
    expect(result.system).toBe('A\n\nB');
  });

  it('converts assistant tool calls into tool_use blocks', () => {
    const messages: AiMessage[] = [
      { role: 'user', content: 'Weather?' },
      {
        role: 'assistant',
        content: 'Checking',
        toolCalls: [{ id: 'toolu_1', name: 'get_weather', arguments: { city: 'Malmo' } }]
      }
    ];

    const blocks = blocksOf(toAnthropicMessages(messages).messages[1]);
    expect(blocks[0]).toEqual({ type: 'text', text: 'Checking' });
    expect(blocks[1]).toEqual({ type: 'tool_use', id: 'toolu_1', name: 'get_weather', input: { city: 'Malmo' } });
  });

  it('merges adjacent tool results into one user turn', () => {
    // Splitting parallel tool results across turns trains the model out of
    // making parallel calls, so they must arrive together.
    const messages: AiMessage[] = [
      { role: 'user', content: 'Go' },
      { role: 'assistant', content: '', toolCalls: [{ id: 'a', name: 't', arguments: {} }] },
      { role: 'tool', toolCallId: 'a', name: 't', content: 'result a' },
      { role: 'tool', toolCallId: 'b', name: 't', content: 'result b' }
    ];

    const out = toAnthropicMessages(messages).messages;
    expect(out.length).toBe(3);
    expect(blocksOf(out[2]).length).toBe(2);
  });

  it('prepends a user turn when the conversation opens with an assistant message', () => {
    const out = toAnthropicMessages([{ role: 'assistant', content: 'Hi' }]).messages;
    expect(out[0].role).toBe('user');
    expect(out[1].role).toBe('assistant');
  });
});

describe('AnthropicProvider.chatStream', () => {
  it('accumulates text deltas and reports usage and cost', async () => {
    const { client } = stubClient(() => asyncIterable(TEXT_STREAM));
    const provider = new AnthropicProvider({ apiKey: 'test', client });

    const deltas: string[] = [];
    const response = await provider.chatStream(
      { model: 'claude-opus-4-8', messages: [{ role: 'user', content: 'Hi' }] },
      { onText: (_full, delta) => deltas.push(delta) }
    );

    expect(deltas).toEqual(['Hello', ' world']);
    expect(response.text).toBe('Hello world');
    expect(response.stopReason).toBe('stop');
    expect(response.usage.promptTokens).toBe(120);
    expect(response.usage.completionTokens).toBe(8);
    // 120 in @ $5/Mtok + 8 out @ $25/Mtok
    expect(response.usage.costUsd).toBeCloseTo(0.0008, 6);
  });

  it('drops temperature for models that reject sampling parameters', async () => {
    const { client, calls } = stubClient(() => asyncIterable(TEXT_STREAM));
    const provider = new AnthropicProvider({ apiKey: 'test', client });

    await provider.chatStream(
      { model: 'claude-opus-4-8', messages: [{ role: 'user', content: 'Hi' }], temperature: 0 },
      {}
    );

    expect(calls[0].temperature).toBeUndefined();
    // ⚠️ BLD-004 changed `display`, deliberately. `'omitted'` was not keeping
    // reasoning out of the XML-parsed text (thinking has never been in a `text`
    // block on any setting) — it made the thinking blocks arrive **empty**, so
    // the reasoning channel would have been inert. `'summarized'` is billed
    // identically; display controls visibility only.
    expect(calls[0].thinking).toEqual({ type: 'adaptive', display: 'summarized' });
  });

  it('passes temperature through for models that accept it', async () => {
    const { client, calls } = stubClient(() => asyncIterable(TEXT_STREAM));
    const provider = new AnthropicProvider({ apiKey: 'test', client });

    await provider.chatStream(
      { model: 'claude-haiku-4-5', messages: [{ role: 'user', content: 'Hi' }], temperature: 0 },
      {}
    );

    expect(calls[0].temperature).toBe(0);
    expect(calls[0].thinking).toBeUndefined();
  });

  it('never surfaces thinking deltas as response text', async () => {
    const events = [
      { type: 'message_start', message: { model: 'claude-opus-4-8', usage: { input_tokens: 1 } } },
      { type: 'content_block_start', index: 0, content_block: { type: 'thinking' } },
      { type: 'content_block_delta', index: 0, delta: { type: 'thinking_delta', thinking: 'hmm...' } },
      { type: 'content_block_stop', index: 0 },
      { type: 'content_block_start', index: 1, content_block: { type: 'text', text: '' } },
      { type: 'content_block_delta', index: 1, delta: { type: 'text_delta', text: 'answer' } },
      { type: 'message_delta', delta: { stop_reason: 'end_turn' }, usage: { output_tokens: 2 } }
    ];
    const { client } = stubClient(() => asyncIterable(events));
    const provider = new AnthropicProvider({ apiKey: 'test', client });

    const response = await provider.chatStream(
      { model: 'claude-opus-4-8', messages: [{ role: 'user', content: 'Hi' }] },
      {}
    );

    expect(response.text).toBe('answer');
  });

  it('assembles a tool call from streamed JSON fragments', async () => {
    const events = [
      { type: 'message_start', message: { model: 'claude-opus-4-8', usage: { input_tokens: 10 } } },
      { type: 'content_block_start', index: 0, content_block: { type: 'tool_use', id: 'toolu_9', name: 'get_weather' } },
      { type: 'content_block_delta', index: 0, delta: { type: 'input_json_delta', partial_json: '{"ci' } },
      { type: 'content_block_delta', index: 0, delta: { type: 'input_json_delta', partial_json: 'ty":"Malmo"}' } },
      { type: 'content_block_stop', index: 0 },
      { type: 'message_delta', delta: { stop_reason: 'tool_use' }, usage: { output_tokens: 5 } }
    ];
    const { client } = stubClient(() => asyncIterable(events));
    const provider = new AnthropicProvider({ apiKey: 'test', client });

    const emitted: AiToolCall[] = [];
    const response = await provider.chatStream(
      {
        model: 'claude-opus-4-8',
        messages: [{ role: 'user', content: 'Weather?' }],
        tools: [{ name: 'get_weather', description: 'Weather', parameters: { type: 'object' } }]
      },
      { onToolCall: (call) => emitted.push(call) }
    );

    expect(response.stopReason).toBe('tool_calls');
    expect(response.toolCalls).toEqual([{ id: 'toolu_9', name: 'get_weather', arguments: { city: 'Malmo' } }]);
    expect(emitted.length).toBe(1);
  });

  it('reports partial text and an aborted stop reason when cancelled mid-stream', async () => {
    const abortController = new AbortController();

    async function* abortingStream() {
      yield { type: 'message_start', message: { model: 'claude-opus-4-8', usage: { input_tokens: 3 } } };
      yield { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: 'partial' } };
      abortController.abort();
      yield { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: ' more' } };
    }

    const { client } = stubClient(() => abortingStream());
    const provider = new AnthropicProvider({ apiKey: 'test', client });

    const response = await provider.chatStream(
      { model: 'claude-opus-4-8', messages: [{ role: 'user', content: 'Hi' }], abortController },
      {}
    );

    expect(response.text).toBe('partial');
    expect(response.stopReason).toBe('aborted');
  });

  it('translates an auth failure into an actionable AiClientError', async () => {
    const { client } = stubClient(() => {
      throw sdkError('unauthorized', 401);
    });
    const provider = new AnthropicProvider({ apiKey: 'bad', client });

    const caught = await expectAiClientError(() =>
      provider.chatStream({ model: 'claude-opus-4-8', messages: [{ role: 'user', content: 'Hi' }] }, {})
    );

    expect(caught instanceof AiClientError).toBe(true);
    expect(caught.status).toBe(401);
    expect(caught.provider).toBe('anthropic');
  });
});

describe('AnthropicProvider.chat', () => {
  it('reads text and tool calls out of a non-streamed message', async () => {
    const { client } = stubClient(() => ({
      model: 'claude-opus-4-8',
      stop_reason: 'tool_use',
      content: [
        { type: 'text', text: 'Let me check.' },
        { type: 'tool_use', id: 'toolu_1', name: 'get_weather', input: { city: 'Malmo' } }
      ],
      usage: { input_tokens: 50, output_tokens: 10 }
    }));
    const provider = new AnthropicProvider({ apiKey: 'test', client });

    const response = await provider.chat({
      model: 'claude-opus-4-8',
      messages: [{ role: 'user', content: 'Weather?' }]
    });

    expect(response.text).toBe('Let me check.');
    expect(response.toolCalls[0].name).toBe('get_weather');
    expect(response.stopReason).toBe('tool_calls');
  });

  it('clamps max_tokens to the model ceiling', async () => {
    const { client, calls } = stubClient(() => ({ content: [], usage: {} }));
    const provider = new AnthropicProvider({ apiKey: 'test', client });

    await provider.chat({
      model: 'claude-haiku-4-5',
      messages: [{ role: 'user', content: 'Hi' }],
      maxTokens: 999_999
    });

    expect(calls[0].max_tokens).toBe(64_000);
  });
});
