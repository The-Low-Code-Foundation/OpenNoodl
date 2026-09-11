/**
 * AIX-001: model registry invariants.
 *
 * The registry is the mitigation for the failure that killed the previous AI
 * subsystem — model ids going stale in a dozen places. These specs guard the
 * properties the rest of the code relies on.
 */

import {
  AI_MODELS,
  calculateCostUsd,
  findModel,
  getDefaultModel,
  getModelsForProvider,
  resolveModel,
  unknownModel
} from '../../src/editor/src/models/AiAssistant/client/models';
import { AI_PROVIDER_IDS } from '../../src/editor/src/models/AiAssistant/client/types';

describe('AI model registry', () => {
  it('has no duplicate model ids', () => {
    const ids = AI_MODELS.map((x) => x.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('has exactly one default per provider that owns models', () => {
    const providers = new Set(AI_MODELS.map((x) => x.provider));
    for (const provider of providers) {
      const defaults = AI_MODELS.filter((x) => x.provider === provider && x.isDefault);
      expect(defaults.length).toBe(1);
    }
  });

  it('gives every registered provider a resolvable default model', () => {
    for (const provider of AI_PROVIDER_IDS) {
      const model = getDefaultModel(provider);
      expect(model.id).toBeTruthy();
      expect(model.maxOutputTokens).toBeGreaterThan(0);
      expect(model.contextWindow).toBeGreaterThan(0);
    }
  });

  it('offers openai-compatible its own gateway models FIRST, then the OpenAI catalogue', () => {
    // ⚠️ This asserted plain equality with the OpenAI catalogue until LAS-011 / F35,
    // which deliberately ended that: falling through meant a DeepInfra or vLLM user
    // was offered `gpt-4.1`, an id their gateway does not serve. The OpenAI ids still
    // FOLLOW, because Azure and similar shims genuinely do serve them — so the
    // contract is "own entries first, catalogue after", not "no catalogue".
    const compatible = getModelsForProvider('openai-compatible').map((x) => x.id);
    const openai = getModelsForProvider('openai').map((x) => x.id);
    const own = AI_MODELS.filter((x) => x.provider === 'openai-compatible').map((x) => x.id);

    expect(own.length).toBeGreaterThan(0);
    expect(compatible).toEqual([...own, ...openai]);
    // The half that matters to a gateway user: what they are given by default is
    // one of the gateway's own ids, never an OpenAI one.
    expect(own).toContain(getDefaultModel('openai-compatible').id);
  });

  it('marks local models as not agent-capable', () => {
    for (const model of getModelsForProvider('ollama')) {
      expect(model.capabilities.agentFlow).toBe(false);
      expect(model.tier).toBe('local');
    }
  });

  it('marks the current Claude frontier models as rejecting sampling parameters', () => {
    // These 400 on `temperature`; the adapter drops it based on this flag.
    for (const id of ['claude-opus-4-8', 'claude-sonnet-5']) {
      const model = findModel(id, 'anthropic');
      expect(model).toBeDefined();
      expect(model.capabilities.sampling).toBe(false);
    }
  });
});

describe('resolveModel', () => {
  it('returns the registered definition when the id is known', () => {
    expect(resolveModel('claude-opus-4-8', 'anthropic').displayName).toBe('Claude Opus 4.8');
  });

  it('falls back to a usable definition for an unregistered id', () => {
    // A model released after this build must still work; it just has no price.
    const model = resolveModel('claude-something-new', 'anthropic');
    expect(model.id).toBe('claude-something-new');
    expect(model.pricing).toBeUndefined();
    expect(model.maxOutputTokens).toBeGreaterThan(0);
  });

  it('assumes an unknown Anthropic model rejects sampling parameters', () => {
    expect(unknownModel('claude-future', 'anthropic').capabilities.sampling).toBe(false);
    expect(unknownModel('some-gateway-model', 'openai-compatible').capabilities.sampling).toBe(true);
  });

  it('treats unknown local models as free rather than unpriced', () => {
    expect(unknownModel('mistral:latest', 'ollama').pricing).toEqual({ inputPerMTok: 0, outputPerMTok: 0 });
  });
});

describe('calculateCostUsd', () => {
  it('prices a request from the per-million-token rates', () => {
    const model = findModel('claude-opus-4-8', 'anthropic');
    // 1M in at $5 + 1M out at $25
    expect(calculateCostUsd(model, 1_000_000, 1_000_000)).toBe(30);
  });

  it('keeps sub-cent precision instead of rounding a real cost to zero', () => {
    const model = findModel('claude-opus-4-8', 'anthropic');
    const cost = calculateCostUsd(model, 1_000, 500);
    expect(cost).toBeGreaterThan(0);
    expect(cost).toBe(0.0175);
  });

  it('reports null — not zero — when the model has no pricing', () => {
    expect(calculateCostUsd(unknownModel('mystery', 'openai-compatible'), 1000, 1000)).toBeNull();
  });

  it('reports zero for local models', () => {
    expect(calculateCostUsd(findModel('llama3.1:8b', 'ollama'), 1000, 1000)).toBe(0);
  });
});
