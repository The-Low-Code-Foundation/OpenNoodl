/**
 * AIX-001: Ollama adapter, against recorded NDJSON fixtures.
 *
 * The local path is a prerequisite for the classroom work in phase 17, so it
 * gets the same coverage as the hosted providers.
 */

import { OllamaProvider, toOllamaMessages } from '../../src/editor/src/models/AiAssistant/client/providers/ollama';
import { AiClientError } from '../../src/editor/src/models/AiAssistant/client/types';

import { jsonResponse, recordingFetch, streamingResponse, textResponse } from './helpers';

function ndjson(...payloads: unknown[]): string[] {
  return payloads.map((payload) => `${JSON.stringify(payload)}\n`);
}

describe('toOllamaMessages', () => {
  it('keys tool results by name, which is what Ollama matches on', () => {
    const [message] = toOllamaMessages([{ role: 'tool', toolCallId: 'ignored', name: 'go', content: 'done' }]);
    expect(message).toEqual({ role: 'tool', tool_name: 'go', content: 'done' });
  });

  it('keeps tool-call arguments as objects rather than strings', () => {
    const [message] = toOllamaMessages([
      { role: 'assistant', content: '', toolCalls: [{ id: 'x', name: 'go', arguments: { a: 1 } }] }
    ]);
    expect((message as TSFixme).tool_calls[0].function.arguments).toEqual({ a: 1 });
  });
});

describe('OllamaProvider.chatStream', () => {
  it('streams deltas and reports zero cost for a local model', async () => {
    const { fetchImpl, requests } = recordingFetch([
      streamingResponse(
        ndjson(
          { model: 'llama3.1:8b', message: { role: 'assistant', content: 'Hel' }, done: false },
          { model: 'llama3.1:8b', message: { role: 'assistant', content: 'lo' }, done: false },
          {
            model: 'llama3.1:8b',
            message: { role: 'assistant', content: '' },
            done: true,
            done_reason: 'stop',
            prompt_eval_count: 42,
            eval_count: 7
          }
        )
      )
    ]);

    const provider = new OllamaProvider({ fetchImpl });
    const deltas: string[] = [];
    const response = await provider.chatStream(
      { model: 'llama3.1:8b', messages: [{ role: 'user', content: 'Hi' }] },
      { onText: (_full, delta) => deltas.push(delta) }
    );

    expect(deltas).toEqual(['Hel', 'lo']);
    expect(response.text).toBe('Hello');
    expect(response.usage.promptTokens).toBe(42);
    expect(response.usage.completionTokens).toBe(7);
    expect(response.usage.costUsd).toBe(0);
    expect(requests[0].url).toBe('http://localhost:11434/api/chat');
  });

  it('passes temperature through as an option', async () => {
    const { fetchImpl, requests } = recordingFetch([streamingResponse(ndjson({ done: true, done_reason: 'stop' }))]);

    await new OllamaProvider({ fetchImpl }).chatStream(
      { model: 'llama3.1:8b', messages: [{ role: 'user', content: 'Hi' }], temperature: 0, maxTokens: 512 },
      {}
    );

    expect(requests[0].body.options).toEqual({ temperature: 0, num_predict: 512 });
  });

  it('emits tool calls that arrive complete in one message', async () => {
    const { fetchImpl } = recordingFetch([
      streamingResponse(
        ndjson(
          {
            message: { role: 'assistant', content: '', tool_calls: [{ function: { name: 'go', arguments: { a: 1 } } }] },
            done: false
          },
          { done: true, done_reason: 'stop', prompt_eval_count: 5, eval_count: 2 }
        )
      )
    ]);

    const provider = new OllamaProvider({ fetchImpl });
    const emitted: TSFixme[] = [];
    const response = await provider.chatStream(
      {
        model: 'llama3.1:8b',
        messages: [{ role: 'user', content: 'Go' }],
        tools: [{ name: 'go', description: 'go', parameters: { type: 'object' } }]
      },
      { onToolCall: (call) => emitted.push(call) }
    );

    expect(emitted.length).toBe(1);
    expect(response.toolCalls[0].name).toBe('go');
    expect(response.toolCalls[0].arguments).toEqual({ a: 1 });
    expect(response.stopReason).toBe('tool_calls');
  });

  it('reports an aborted stop reason when cancelled', async () => {
    const abortController = new AbortController();
    const { fetchImpl } = recordingFetch([
      streamingResponse(ndjson({ message: { content: 'partial' }, done: false }))
    ]);

    const response = await new OllamaProvider({ fetchImpl }).chatStream(
      { model: 'llama3.1:8b', messages: [{ role: 'user', content: 'Hi' }], abortController },
      { onText: () => abortController.abort() }
    );

    expect(response.text).toBe('partial');
    expect(response.stopReason).toBe('aborted');
  });

  it('tells the user to pull the model when Ollama 404s', async () => {
    const { fetchImpl } = recordingFetch([textResponse('model not found', 404)]);

    let caught: TSFixme;
    try {
      await new OllamaProvider({ fetchImpl }).chat({
        model: 'missing-model',
        messages: [{ role: 'user', content: 'Hi' }]
      });
    } catch (error) {
      caught = error;
    }

    expect(caught instanceof AiClientError).toBe(true);
    expect(String(caught.message)).toContain('ollama pull missing-model');
  });

  it('explains that Ollama is not running when the connection fails', async () => {
    const fetchImpl = (async () => {
      throw new Error('ECONNREFUSED');
    }) as unknown as typeof fetch;

    let caught: TSFixme;
    try {
      await new OllamaProvider({ fetchImpl }).chat({
        model: 'llama3.1:8b',
        messages: [{ role: 'user', content: 'Hi' }]
      });
    } catch (error) {
      caught = error;
    }

    expect(String(caught.message)).toContain('Is it running?');
  });
});

describe('OllamaProvider.verify', () => {
  it('lists the models that are pulled', async () => {
    const { fetchImpl, requests } = recordingFetch([
      jsonResponse({ models: [{ name: 'llama3.1:8b' }, { name: 'qwen2.5-coder:7b' }] })
    ]);

    const result = await new OllamaProvider({ fetchImpl }).verify();

    expect(result.ok).toBe(true);
    expect(result.models).toEqual(['llama3.1:8b', 'qwen2.5-coder:7b']);
    expect(requests[0].url).toBe('http://localhost:11434/api/tags');
  });

  it('reports reachable-but-empty rather than a bare success', async () => {
    const { fetchImpl } = recordingFetch([jsonResponse({ models: [] })]);
    const result = await new OllamaProvider({ fetchImpl }).verify();

    expect(result.ok).toBe(true);
    expect(String(result.error)).toContain('ollama pull');
  });

  it('honours a custom host', async () => {
    const { fetchImpl, requests } = recordingFetch([jsonResponse({ models: [{ name: 'x' }] })]);
    await new OllamaProvider({ baseUrl: 'http://gpu-box.local:11434/', fetchImpl }).verify();

    expect(requests[0].url).toBe('http://gpu-box.local:11434/api/tags');
  });
});
