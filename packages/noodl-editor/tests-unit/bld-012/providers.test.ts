/**
 * BLD-012 — an image reaches each provider in that provider's own shape, and
 * degrades to its declared text twin wherever it cannot.
 *
 * The acceptance criterion these specs exist for is the negative one: **no path
 * drops an image silently.** Each adapter is checked twice — once against a
 * model the registry flags for vision, once against one it does not — and in
 * the second case the twin must be present in the request. An assertion that
 * the image is *absent* would pass just as well if the adapter had thrown the
 * reference away, so every degrade check asserts the substituted text too.
 */

import { AnthropicProvider } from '@noodl-models/AiAssistant/client/providers/anthropic';
import { OllamaProvider, toOllamaMessages } from '@noodl-models/AiAssistant/client/providers/ollama';
import { OpenAiProvider, toOpenAiMessages } from '@noodl-models/AiAssistant/client/providers/openai';
import { asText, degradedImageText } from '@noodl-models/AiAssistant/client/content';
import type { AiContentBlock, AiImageBlock, AiMessage } from '@noodl-models/AiAssistant/client/types';

const PNG_1PX =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

const TWIN = 'A checkout page mock: two columns, order summary on the right.';

const IMAGE: AiImageBlock = { type: 'image', data: PNG_1PX, mediaType: 'image/png', text: TWIN };

const TURN: AiMessage[] = [
  { role: 'user', content: [{ type: 'text', text: 'Build this.' }, IMAGE] as AiContentBlock[] }
];

/** Capture Anthropic request params without a network call. */
async function anthropicRequest(model: string): Promise<string> {
  let captured: Record<string, unknown> = {};
  const provider = new AnthropicProvider({
    apiKey: 'k',
    client: {
      messages: {
        create: async (params: Record<string, unknown>) => {
          captured = params;
          return { model, stop_reason: 'end_turn', content: [], usage: {} };
        }
      }
    }
  });
  await provider.chat({ messages: TURN, model });
  return JSON.stringify(captured);
}

/** Capture an HTTP-shaped provider's request body without a network call. */
function captureFetch(): { body: () => unknown; fetchImpl: typeof fetch } {
  let sent: unknown;
  const fetchImpl = (async (_url: string, init: { body: string }) => {
    sent = JSON.parse(init.body);
    return {
      ok: true,
      json: async () => ({
        model: 'm',
        choices: [{ message: { content: 'ok' }, finish_reason: 'stop' }],
        message: { content: 'ok' },
        done: true,
        done_reason: 'stop'
      })
    };
  }) as unknown as typeof fetch;
  return { body: () => sent, fetchImpl };
}

describe('BLD-012 — Anthropic', () => {
  it('sends a real image block to a vision model', async () => {
    const json = await anthropicRequest('claude-sonnet-5');
    expect(json).toContain('"type":"image"');
    expect(json).toContain('"media_type":"image/png"');
    expect(json).toContain(`"data":"${PNG_1PX}"`);
    expect(json).toContain('"source":{"type":"base64"');
  });

  it('degrades to the declared twin on a model with no vision flag', async () => {
    // An unregistered id resolves through `unknownModel`, which sets no vision.
    const json = await anthropicRequest('some-unreleased-model');
    expect(json).not.toContain('"type":"image"');
    expect(json).not.toContain(PNG_1PX);
    // The twin, and the declaration that it is a substitution, both present.
    expect(json).toContain(TWIN);
    expect(json).toContain('image omitted');
  });
});

describe('BLD-012 — OpenAI', () => {
  it('sends an image_url content part to a vision model', async () => {
    const { body, fetchImpl } = captureFetch();
    const provider = new OpenAiProvider({ apiKey: 'k', fetchImpl });
    await provider.chat({ messages: TURN, model: 'gpt-4o' });
    const json = JSON.stringify(body());
    expect(json).toContain('"type":"image_url"');
    expect(json).toContain(`data:image/png;base64,${PNG_1PX}`);
  });

  it('degrades on an openai-compatible gateway, which has no vision by default', async () => {
    const { body, fetchImpl } = captureFetch();
    const provider = new OpenAiProvider({
      apiKey: 'k',
      fetchImpl,
      baseUrl: 'https://gateway.example/v1',
      providerId: 'openai-compatible'
    });
    await provider.chat({ messages: TURN, model: 'some-hosted-open-weights-model' });
    const json = JSON.stringify(body());
    expect(json).not.toContain('image_url');
    expect(json).not.toContain(PNG_1PX);
    expect(json).toContain(TWIN);
    expect(json).toContain('image omitted');
  });
});

describe('BLD-012 — Ollama', () => {
  it('degrades by default: no seeded local model is flagged for vision', async () => {
    const { body, fetchImpl } = captureFetch();
    const provider = new OllamaProvider({ fetchImpl });
    await provider.chat({ messages: TURN, model: 'qwen2.5-coder:7b' });
    const json = JSON.stringify(body());
    expect(json).not.toContain('"images"');
    expect(json).not.toContain(PNG_1PX);
    expect(json).toContain(TWIN);
    expect(json).toContain('image omitted');
  });

  it('uses the native sibling images array when a model IS flagged for vision', () => {
    // Below the vision gate on purpose: this asserts the wire shape the mapper
    // produces, which is what a registered vision model would get.
    const [message] = toOllamaMessages(TURN);
    expect(message.images).toEqual([PNG_1PX]);
    // Bare base64, not a data URL — Ollama's native /api/chat wants the former.
    expect(message.images?.[0].startsWith('data:')).toBe(false);
    expect(message.content).toBe('Build this.');
  });
});

describe('BLD-012 — the twin is declared, not just substituted', () => {
  it('states that the image was omitted and that the text is a description', () => {
    const rendered = degradedImageText(IMAGE);
    expect(rendered).toContain('image omitted');
    expect(rendered).toContain('cannot receive images');
    expect(rendered).toContain('not the image itself');
    expect(rendered).toContain(TWIN);
    expect(rendered).toContain('[end of image description]');
  });

  it('flattens mixed content without losing either half', () => {
    expect(asText(TURN[0].content)).toBe(`Build this.\n\n${degradedImageText(IMAGE)}`);
  });
});

describe('BLD-012 — every adapter keeps the twin, so no path drops an image', () => {
  /**
   * The grep the acceptance criterion asks for, expressed as a test rather than
   * a habit: run one image turn through all three text-only paths and require
   * the twin in every serialized request. A future adapter that quietly skips
   * an unrecognised block fails here.
   */
  it('carries the twin through Anthropic, OpenAI and Ollama alike', async () => {
    const anthropic = await anthropicRequest('some-unreleased-model');

    const openai = captureFetch();
    await new OpenAiProvider({ apiKey: 'k', fetchImpl: openai.fetchImpl }).chat({
      messages: TURN,
      model: 'unregistered-openai-id'
    });

    const ollama = captureFetch();
    await new OllamaProvider({ fetchImpl: ollama.fetchImpl }).chat({
      messages: TURN,
      model: 'llama3.1:8b'
    });

    for (const request of [anthropic, JSON.stringify(openai.body()), JSON.stringify(ollama.body())]) {
      expect(request).toContain(TWIN);
      expect(request).not.toContain(PNG_1PX);
    }
  });
});

describe('BLD-012 — the mappers reject a boundary paired with blocks', () => {
  const bad: AiMessage[] = [{ role: 'user', content: [{ type: 'text', text: 'x' }], cacheBoundary: 1 }];

  it('throws in the OpenAI mapper', () => {
    expect(() => toOpenAiMessages(bad)).toThrow(/character offset/);
  });

  it('throws in the Ollama mapper', () => {
    expect(() => toOllamaMessages(bad)).toThrow(/character offset/);
  });
});
