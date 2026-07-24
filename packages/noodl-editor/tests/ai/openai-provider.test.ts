/**
 * AIX-001: OpenAI / OpenAI-compatible adapter, against recorded HTTP fixtures.
 */

import {
  OpenAiProvider,
  toChatCompletionsUrl,
  toModelsUrl,
  toOpenAiMessages
} from '../../src/editor/src/models/AiAssistant/client/providers/openai';
import { AiClientError, AiToolCall } from '../../src/editor/src/models/AiAssistant/client/types';

import { expectAiClientError, jsonResponse, recordingFetch, streamingResponse, textResponse } from './helpers';

function sse(...payloads: unknown[]): string[] {
  return payloads.map((payload) => `data: ${JSON.stringify(payload)}\n\n`);
}

describe('OpenAI URL handling', () => {
  it('appends the chat path to a base URL', () => {
    expect(toChatCompletionsUrl('https://api.openai.com/v1')).toBe('https://api.openai.com/v1/chat/completions');
    expect(toChatCompletionsUrl('https://api.openai.com/v1/')).toBe('https://api.openai.com/v1/chat/completions');
  });

  it('accepts a full chat-completions URL unchanged', () => {
    // The pre-AIX-001 "enterprise" setting stored the full URL; users should
    // not have to re-enter it.
    const full = 'https://gw.example.com/openai/v1/chat/completions';
    expect(toChatCompletionsUrl(full)).toBe(full);
  });

  it('derives the models URL from either form', () => {
    expect(toModelsUrl('https://gw.example.com/v1')).toBe('https://gw.example.com/v1/models');
    expect(toModelsUrl('https://gw.example.com/v1/chat/completions')).toBe('https://gw.example.com/v1/models');
  });
});

describe('toOpenAiMessages', () => {
  it('serialises assistant tool calls with stringified arguments', () => {
    const [message] = toOpenAiMessages([
      { role: 'assistant', content: '', toolCalls: [{ id: 'call_1', name: 'go', arguments: { a: 1 } }] }
    ]);
    expect(message.tool_calls[0].function.arguments).toBe('{"a":1}');
  });

  it('maps tool results onto tool_call_id', () => {
    const [message] = toOpenAiMessages([{ role: 'tool', toolCallId: 'call_1', name: 'go', content: 'done' }]);
    expect(message).toEqual({ role: 'tool', tool_call_id: 'call_1', content: 'done' });
  });
});

describe('OpenAiProvider.chatStream', () => {
  it('streams text deltas and records usage', async () => {
    const { fetchImpl, requests } = recordingFetch([
      streamingResponse([
        ...sse(
          { model: 'gpt-4.1', choices: [{ delta: { content: 'Hel' } }] },
          { model: 'gpt-4.1', choices: [{ delta: { content: 'lo' } }] },
          { model: 'gpt-4.1', choices: [{ delta: {}, finish_reason: 'stop' }] },
          { model: 'gpt-4.1', choices: [], usage: { prompt_tokens: 100, completion_tokens: 20 } }
        ),
        'data: [DONE]\n\n'
      ])
    ]);

    const provider = new OpenAiProvider({ apiKey: 'sk-test', fetchImpl });
    const deltas: string[] = [];
    const response = await provider.chatStream(
      { model: 'gpt-4.1', messages: [{ role: 'user', content: 'Hi' }] },
      { onText: (_full, delta) => deltas.push(delta) }
    );

    expect(deltas).toEqual(['Hel', 'lo']);
    expect(response.text).toBe('Hello');
    expect(response.stopReason).toBe('stop');
    expect(response.usage.promptTokens).toBe(100);
    // 100 in @ $2/Mtok + 20 out @ $8/Mtok
    expect(response.usage.costUsd).toBeCloseTo(0.00036, 8);
    expect(requests[0].url).toBe('https://api.openai.com/v1/chat/completions');
    expect(requests[0].body.stream_options).toEqual({ include_usage: true });
  });

  it('does not send OpenAI-only extras to a custom compatible endpoint', async () => {
    // Gateways reject unknown fields, so stream_options must not leak there.
    const { fetchImpl, requests } = recordingFetch([streamingResponse(['data: [DONE]\n\n'])]);
    const provider = new OpenAiProvider({
      providerId: 'openai-compatible',
      baseUrl: 'https://gw.example.com/v1',
      fetchImpl
    });

    await provider.chatStream({ model: 'local-model', messages: [{ role: 'user', content: 'Hi' }] }, {});

    expect(requests[0].url).toBe('https://gw.example.com/v1/chat/completions');
    expect(requests[0].body.stream_options).toBeUndefined();
  });

  it('assembles tool calls from indexed fragments', async () => {
    const { fetchImpl } = recordingFetch([
      streamingResponse([
        ...sse(
          {
            choices: [
              { delta: { tool_calls: [{ index: 0, id: 'call_1', function: { name: 'go', arguments: '{"a"' } }] } }
            ]
          },
          { choices: [{ delta: { tool_calls: [{ index: 0, function: { arguments: ':1}' } }] } }] },
          { choices: [{ delta: {}, finish_reason: 'tool_calls' }] }
        ),
        'data: [DONE]\n\n'
      ])
    ]);

    const provider = new OpenAiProvider({ apiKey: 'sk-test', fetchImpl });
    const emitted: AiToolCall[] = [];
    const response = await provider.chatStream(
      {
        model: 'gpt-4.1',
        messages: [{ role: 'user', content: 'Go' }],
        tools: [{ name: 'go', description: 'go', parameters: { type: 'object' } }]
      },
      { onToolCall: (call) => emitted.push(call) }
    );

    expect(response.toolCalls).toEqual([{ id: 'call_1', name: 'go', arguments: { a: 1 } }]);
    expect(emitted.length).toBe(1);
    expect(response.stopReason).toBe('tool_calls');
  });

  it('surfaces a mid-stream error delivered under HTTP 200', async () => {
    const { fetchImpl } = recordingFetch([
      streamingResponse([...sse({ choices: [{ delta: { content: 'partial' } }] }, { error: { message: 'overloaded' } })])
    ]);

    const provider = new OpenAiProvider({ apiKey: 'sk-test', fetchImpl });

    const caught = await expectAiClientError(() =>
      provider.chatStream({ model: 'gpt-4.1', messages: [{ role: 'user', content: 'Hi' }] }, {})
    );

    expect(caught instanceof AiClientError).toBe(true);
    expect(caught.message).toContain('overloaded');
  });

  it('skips an unparsable chunk rather than failing the whole stream', async () => {
    const { fetchImpl } = recordingFetch([
      streamingResponse([
        'data: not-json\n\n',
        ...sse({ choices: [{ delta: { content: 'ok' } }, ] }),
        'data: [DONE]\n\n'
      ])
    ]);

    const provider = new OpenAiProvider({ apiKey: 'sk-test', fetchImpl });
    const response = await provider.chatStream(
      { model: 'gpt-4.1', messages: [{ role: 'user', content: 'Hi' }] },
      {}
    );

    expect(response.text).toBe('ok');
  });

  it('reports an aborted stop reason when cancelled', async () => {
    const abortController = new AbortController();
    const { fetchImpl } = recordingFetch([
      streamingResponse([...sse({ choices: [{ delta: { content: 'partial' } }] })])
    ]);

    const provider = new OpenAiProvider({ apiKey: 'sk-test', fetchImpl });
    const response = await provider.chatStream(
      { model: 'gpt-4.1', messages: [{ role: 'user', content: 'Hi' }], abortController },
      { onText: () => abortController.abort() }
    );

    expect(response.text).toBe('partial');
    expect(response.stopReason).toBe('aborted');
  });

  it('turns a 401 into an actionable error', async () => {
    const { fetchImpl } = recordingFetch([
      textResponse(JSON.stringify({ error: { message: 'Incorrect API key' } }), 401)
    ]);

    const provider = new OpenAiProvider({ apiKey: 'bad', fetchImpl });

    const caught = await expectAiClientError(() =>
      provider.chatStream({ model: 'gpt-4.1', messages: [{ role: 'user', content: 'Hi' }] }, {})
    );

    expect(caught instanceof AiClientError).toBe(true);
    expect(caught.status).toBe(401);
  });

  it('refuses to run a custom provider with no endpoint', async () => {
    const provider = new OpenAiProvider({ providerId: 'openai-compatible' });

    const caught = await expectAiClientError(() =>
      provider.chat({ model: 'x', messages: [{ role: 'user', content: 'Hi' }] })
    );

    expect(caught instanceof AiClientError).toBe(true);
    expect(caught.message).toContain('No endpoint configured');
  });
});

describe('OpenAiProvider.verify', () => {
  it('returns the model ids the endpoint reports', async () => {
    const { fetchImpl, requests } = recordingFetch([jsonResponse({ data: [{ id: 'gpt-4.1' }, { id: 'gpt-4o' }] })]);
    const provider = new OpenAiProvider({ apiKey: 'sk-test', fetchImpl });

    const result = await provider.verify();

    expect(result.ok).toBe(true);
    expect(result.models).toEqual(['gpt-4.1', 'gpt-4o']);
    expect(requests[0].url).toBe('https://api.openai.com/v1/models');
  });

  it('fails without a key instead of making a doomed request', async () => {
    const { fetchImpl, requests } = recordingFetch([]);
    const result = await new OpenAiProvider({ fetchImpl }).verify();

    expect(result.ok).toBe(false);
    expect(requests.length).toBe(0);
  });
});
