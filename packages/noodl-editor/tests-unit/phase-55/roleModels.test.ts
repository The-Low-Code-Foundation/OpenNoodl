/**
 * LAS-009 — design / plan / act per-role model selection.
 *
 * The resolver is deliberately a pure function of a narrow reader interface
 * rather than a direct consumer of `AiConfigStore`. Two reasons, both load-
 * bearing: `AiConfigStore` reaches `AiCredentials`, which constructs an
 * `electron-store`, so importing it here would drag Electron into a plain-Node
 * runner; and role resolution is exactly the kind of branch-heavy logic that
 * should be testable without a settings file on disk.
 *
 * The last spec in this file is a tripwire, not a unit test. Phase 55's
 * recurring lesson is that registers outlive their fixes: the role table is a
 * decision about seven known call sites, and an eighth added later would
 * silently run on the global pair with nothing to say so. The tripwire reads
 * the source and fails when a session reaches `AiClient.chat*` without being
 * classified either way.
 */
import * as fs from 'fs';
import * as path from 'path';

import {
  AI_GLOBAL_SESSIONS,
  AI_ROLES,
  AI_ROLE_SESSIONS,
  resolveRole,
  type AiRole,
  type AiRoleConfigReader,
  type AiRoleSelection
} from '../../src/editor/src/models/AiAssistant/client/roles';
import type { AiProviderId } from '../../src/editor/src/models/AiAssistant/client/types';

interface FakeConfig {
  active?: AiProviderId | null;
  /** Per-provider configured-ness. Absent ⇒ not configured. */
  configured?: Partial<Record<AiProviderId, boolean>>;
  /** Per-provider stored model. */
  models?: Partial<Record<AiProviderId, string>>;
  roles?: Partial<Record<AiRole, AiRoleSelection>>;
}

function reader(config: FakeConfig): AiRoleConfigReader {
  const active = config.active === undefined ? 'anthropic' : config.active;
  return {
    getActiveProvider: () => active,
    getRole: (role) => config.roles?.[role] ?? {},
    getModel: (provider) => {
      const target = provider ?? active;
      if (!target) return '';
      return config.models?.[target] ?? `default-for-${target}`;
    },
    isConfigured: (provider) => {
      const target = provider ?? active;
      if (!target) return false;
      return config.configured?.[target] ?? false;
    }
  };
}

/** Collects the warnings a resolution emitted, so "loudly" is an assertion. */
function withWarnings(config: FakeConfig, role: AiRole) {
  const warnings: string[] = [];
  const resolved = resolveRole(role, reader(config), (message) => warnings.push(message));
  return { resolved, warnings };
}

describe('LAS-009 — resolveRole', () => {
  it('inherits everything when the role is unset — the shipped default', () => {
    const { resolved, warnings } = withWarnings({ configured: { anthropic: true } }, 'act');

    expect(resolved.provider).toBeUndefined();
    expect(resolved.model).toBeUndefined();
    expect(resolved.fellBack).toBe(false);
    // An unset role is not a fallback: nothing was asked for, so nothing failed.
    expect(warnings).toEqual([]);
  });

  it('honours a model-only override without naming a provider', () => {
    const { resolved } = withWarnings(
      { configured: { anthropic: true }, roles: { plan: { model: 'claude-haiku-4-5-20251001' } } },
      'plan'
    );

    expect(resolved.provider).toBeUndefined();
    expect(resolved.model).toBe('claude-haiku-4-5-20251001');
    expect(resolved.fellBack).toBe(false);
  });

  it('carries a cross-provider override when that provider is configured', () => {
    const { resolved, warnings } = withWarnings(
      {
        active: 'anthropic',
        configured: { anthropic: true, ollama: true },
        roles: { act: { provider: 'ollama', model: 'qwen2.5-coder' } }
      },
      'act'
    );

    expect(resolved.provider).toBe('ollama');
    expect(resolved.model).toBe('qwen2.5-coder');
    expect(warnings).toEqual([]);
  });

  it("fills the target provider's own model when the role names only a provider", () => {
    // The trap this pins: filling the model from the *active* provider would
    // send a Claude model id to Ollama. The model must come from the provider
    // that will actually serve the request.
    const { resolved } = withWarnings(
      {
        active: 'anthropic',
        configured: { anthropic: true, ollama: true },
        models: { anthropic: 'claude-opus-5', ollama: 'llama3.2' },
        roles: { design: { provider: 'ollama' } }
      },
      'design'
    );

    expect(resolved.provider).toBe('ollama');
    expect(resolved.model).toBe('llama3.2');
  });

  it('falls back to the global pair loudly when the role provider is unconfigured', () => {
    const { resolved, warnings } = withWarnings(
      {
        active: 'anthropic',
        configured: { anthropic: true, openai: false },
        roles: { act: { provider: 'openai', model: 'gpt-5' } }
      },
      'act'
    );

    expect(resolved.provider).toBeUndefined();
    // The model goes with the provider: a gpt-5 id sent to Anthropic is a
    // worse failure than the one we just avoided.
    expect(resolved.model).toBeUndefined();
    expect(resolved.fellBack).toBe(true);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain('act');
    expect(warnings[0]).toContain('openai');
  });

  it('treats a role naming the active provider as no override at all', () => {
    const { resolved, warnings } = withWarnings(
      {
        active: 'anthropic',
        configured: { anthropic: true },
        roles: { plan: { provider: 'anthropic', model: 'claude-haiku-4-5-20251001' } }
      },
      'plan'
    );

    // No provider override travels, so `getProvider()` stays on its bare path.
    expect(resolved.provider).toBeUndefined();
    expect(resolved.model).toBe('claude-haiku-4-5-20251001');
    expect(warnings).toEqual([]);
  });

  it('inherits when AI is disabled, without warning about it', () => {
    const { resolved, warnings } = withWarnings(
      { active: null, roles: { act: { provider: 'ollama', model: 'llama3.2' } } },
      'act'
    );

    expect(resolved.provider).toBeUndefined();
    expect(resolved.model).toBeUndefined();
    // Nothing runs while AI is off, so this is not a misconfiguration to shout
    // about — it is the feature being switched off.
    expect(warnings).toEqual([]);
  });

  it('always reports the role it resolved, so the usage log can be tagged', () => {
    for (const role of AI_ROLES) {
      expect(resolveRole(role, reader({ configured: { anthropic: true } })).role).toBe(role);
    }
  });
});

describe('LAS-009 — the role table is the decision, and it is complete', () => {
  const AI_DIR = path.join(__dirname, '../../src/editor/src/models/AiAssistant');

  /** Every file under AiAssistant/ that calls the client's chat entry points. */
  function chatCallSites(): string[] {
    const found: string[] = [];
    const walk = (dir: string) => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          // `client/` is the implementation, not a caller.
          if (entry.name !== 'client') walk(full);
          continue;
        }
        if (!entry.name.endsWith('.ts') && !entry.name.endsWith('.tsx')) continue;
        const source = fs.readFileSync(full, 'utf8');
        // Comments mention `AiClient.chatStream` when describing the seam, so
        // only count a real call: an identifier followed by an open paren.
        const withoutComments = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\*.*$/gm, '');
        if (/AiClient\.(chat|chatStream)\s*\(/.test(withoutComments)) {
          found.push(path.relative(AI_DIR, full));
        }
      }
    };
    walk(AI_DIR);
    return found.sort();
  }

  it('classifies every session that reaches the client — role or deliberately global', () => {
    const classified = new Set<string>([
      ...Object.values(AI_ROLE_SESSIONS).flatMap((files) => [...files]),
      ...Object.keys(AI_GLOBAL_SESSIONS)
    ]);

    const unclassified = chatCallSites().filter((file) => !classified.has(file));

    expect(unclassified).toEqual([]);
  });

  it('names no file that does not exist — a table entry outliving its file is the same defect', () => {
    const sites = new Set(chatCallSites());
    const named = [...Object.values(AI_ROLE_SESSIONS).flatMap((files) => [...files]), ...Object.keys(AI_GLOBAL_SESSIONS)];

    expect(named.filter((file) => !sites.has(file))).toEqual([]);
  });

  it('gives every globally-run session a written reason', () => {
    for (const [file, reason] of Object.entries(AI_GLOBAL_SESSIONS)) {
      expect(reason.length).toBeGreaterThan(20);
      expect(file).toMatch(/\.tsx?$/);
    }
  });

  it('maps each of the three roles to at least one session', () => {
    for (const role of AI_ROLES) {
      expect(AI_ROLE_SESSIONS[role].length).toBeGreaterThan(0);
    }
  });
});
