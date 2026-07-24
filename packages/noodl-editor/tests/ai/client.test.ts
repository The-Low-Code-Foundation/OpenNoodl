/**
 * AIX-001: client-level behaviour — provider selection and the
 * no-provider-configured path.
 */

import { createProvider } from '../../src/editor/src/models/AiAssistant/client/AiClient';
import { AI_PROVIDER_IDS, AiNotConfiguredError } from '../../src/editor/src/models/AiAssistant/client/types';

describe('createProvider', () => {
  it('builds an adapter for every registered provider id', () => {
    for (const id of AI_PROVIDER_IDS) {
      const provider = createProvider(id, { apiKey: 'x', baseUrl: 'https://example.com/v1' });
      expect(provider.id).toBe(id);
      expect(typeof provider.chat).toBe('function');
      expect(typeof provider.chatStream).toBe('function');
      expect(typeof provider.verify).toBe('function');
    }
  });
});

describe('graceful degradation with no provider configured', () => {
  it('fails with a typed, actionable error rather than an opaque one', async () => {
    // AiClient reads the editor settings, which are empty in the test
    // environment, so this exercises the real "AI is off" path.
    const { AiClient } = require('../../src/editor/src/models/AiAssistant/client/AiClient');

    let caught: TSFixme;
    try {
      await AiClient.getProvider();
    } catch (error) {
      caught = error;
    }

    expect(caught instanceof AiNotConfiguredError).toBe(true);
    expect(String(caught.message)).toContain('Editor Settings');
    expect(AiClient.isConfigured()).toBe(false);
    expect(AiClient.getActiveModel()).toBeNull();
    // Templates ask this before choosing the agent path; it must not throw.
    expect(AiClient.supportsAgentFlow()).toBe(false);
  });
});
