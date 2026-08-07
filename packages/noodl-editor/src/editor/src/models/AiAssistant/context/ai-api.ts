/**
 * Thin bridge from the copilot templates to the provider-agnostic AI client.
 *
 * Before AIX-001 this file *was* the client: a hardcoded OpenAI SSE call. It
 * now only translates the template-facing argument shape into an
 * `AiChatRequest`; everything provider-specific lives in the adapters.
 *
 * @module AiAssistant/context/ai-api
 */

import { AiClient } from '@noodl-models/AiAssistant/client/AiClient';
import { AiMessage } from '@noodl-models/AiAssistant/client/types';
import { AiCopilotChatMessage, AiCopilotChatStreamArgs } from '@noodl-models/AiAssistant/interfaces';

function toAiMessages(messages: AiCopilotChatMessage[]): AiMessage[] {
  return messages.map((message) => ({
    // Templates type `role` as a loose string; anything unexpected is safest
    // treated as user content rather than rejected mid-generation.
    role:
      message.role === 'system' || message.role === 'assistant' || message.role === 'user'
        ? message.role
        : 'user',
    content: message.content
  }));
}

export namespace Ai {
  export async function chatStream({
    messages,
    provider,
    abortController,
    onStream,
    onEnd
  }: AiCopilotChatStreamArgs): Promise<string> {
    const response = await AiClient.chatStream(
      {
        messages: toAiMessages(messages),
        model: provider?.model,
        temperature: provider?.temperature,
        maxTokens: provider?.max_tokens,
        abortController
      },
      {
        onText: (fullText, delta) => onStream && onStream(fullText, delta),
        onEnd: () => onEnd && onEnd()
      }
    );

    return response.text;
  }

  /** Single-shot completion, for callers that do not render progressively. */
  export async function chat({
    messages,
    provider,
    abortController
  }: Omit<AiCopilotChatStreamArgs, 'onStream' | 'onEnd'>): Promise<string> {
    const response = await AiClient.chat({
      messages: toAiMessages(messages),
      model: provider?.model,
      temperature: provider?.temperature,
      maxTokens: provider?.max_tokens,
      abortController
    });

    return response.text;
  }
}
