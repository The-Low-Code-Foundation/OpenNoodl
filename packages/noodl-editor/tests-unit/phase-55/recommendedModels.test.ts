/**
 * LAS-011 — the model recommendation, as Richard settled it on the matrix.
 *
 * The acceptance runs produced one verdict and it was about *which models to
 * recommend*, not about the gates:
 *
 *   "Sonnet is the only one that clears the bar, which confirms that we should
 *    recommend Opus for scoping larger creations and doing high level design,
 *    Sonnet for the creation work and basic designs. We can allow open weight
 *    models via API like DeepSeek v4 or the latest Qwen, the big ones, but
 *    local Ollama looks to be a waste of time."
 *
 * That is a decision the registry can carry and a test can pin, so it does.
 * The specs below are written against the *verdict*, not against the current
 * contents of the table — a future edit that quietly recommends a local model
 * for authoring, or recommends a model nobody registered, fails here.
 *
 * One spec is a tripwire rather than a unit test. Richard explicitly waived
 * testing for the OpenAI / Grok / Google peers ("we don't need to test them I
 * think it's well known"), so those entries are recommendations made on
 * reputation. This phase's whole method is that measured and assumed claims are
 * different things, so the registry must say which is which and the tripwire
 * makes sure nobody later erases the distinction by marking everything measured.
 */
import {
  AI_MODELS,
  getRecommendedModels,
  type AiModelDefinition
} from '../../src/editor/src/models/AiAssistant/client/models';
import { AI_ROLES } from '../../src/editor/src/models/AiAssistant/client/roles';
import type { AiRole } from '../../src/editor/src/models/AiAssistant/client/types';

const byId = (id: string): AiModelDefinition | undefined => AI_MODELS.find((m) => m.id === id);

describe('LAS-011 — the recommended model per role', () => {
  it('registers Claude Opus 5, the model the verdict recommends for scoping', () => {
    // The registry carried `claude-opus-4-8` and no Opus 5 when the verdict
    // landed, so "recommend Opus for scoping" was unsatisfiable as written.
    const opus = byId('claude-opus-5');
    expect(opus).toBeDefined();
    expect(opus!.provider).toBe('anthropic');
    expect(opus!.tier).toBe('frontier');
  });

  it('recommends Opus for design and plan — scoping and high-level design', () => {
    for (const role of ['design', 'plan'] as AiRole[]) {
      const top = getRecommendedModels(role)[0];
      expect(top).toBeDefined();
      expect(top.id).toBe('claude-opus-5');
    }
  });

  it('recommends Sonnet for act — the creation work', () => {
    const top = getRecommendedModels('act')[0];
    expect(top).toBeDefined();
    expect(top.id).toBe('claude-sonnet-5');
  });

  it('never recommends a local model for any role', () => {
    // "local Ollama looks to be a waste of time" — measured: the only pull on
    // the reference machine is a 3B model, and the write-mode MCP tool surface
    // alone is 27,322 prompt tokens (F37).
    for (const role of AI_ROLES) {
      for (const model of getRecommendedModels(role)) {
        expect(model.tier).not.toBe('local');
        expect(model.provider).not.toBe('ollama');
      }
    }
  });

  it('recommends at least one model for every role', () => {
    for (const role of AI_ROLES) {
      expect(getRecommendedModels(role).length).toBeGreaterThan(0);
    }
  });

  it('only recommends models that are actually registered', () => {
    const ids = new Set(AI_MODELS.map((m) => m.id));
    for (const role of AI_ROLES) {
      for (const model of getRecommendedModels(role)) {
        expect(ids.has(model.id)).toBe(true);
      }
    }
  });

  it('gives openai-compatible its own entries rather than borrowing OpenAI ids (F35)', () => {
    // Before this, `getModelsForProvider('openai-compatible')` fell through to
    // the OpenAI list, so a picker aimed at a custom gateway offered `gpt-4.1`
    // — an id that gateway does not serve.
    const compatible = AI_MODELS.filter((m) => m.provider === 'openai-compatible');
    expect(compatible.length).toBeGreaterThan(0);
    // The verdict allows open weights hosted behind an API. At least one such
    // entry must be present, or "we can allow open weight models via API" is
    // a sentence with no implementation.
    expect(compatible.some((m) => m.openWeights)).toBe(true);
  });

  it('marks every entry as measured or not, and marks nothing measured that was not', () => {
    // TRIPWIRE. Only three models were replayed cold in phase 55. Everything
    // else in the table is a reputational recommendation, including the ones
    // Richard waived testing for. If a later edit flips these to `measured`,
    // the matrix's evidence claim quietly becomes false.
    const MEASURED_IN_PHASE_55 = new Set(['claude-sonnet-5', 'claude-haiku-4-5']);
    for (const model of AI_MODELS) {
      expect(typeof model.measured).toBe('boolean');
      if (model.measured) {
        expect(MEASURED_IN_PHASE_55.has(model.id)).toBe(true);
      }
    }
  });
});
