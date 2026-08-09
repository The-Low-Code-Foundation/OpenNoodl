/**
 * LAS-009 — design / plan / act: which model does which job.
 *
 * Claude Code lets a user spend a strong model where it earns its price and a
 * cheap one everywhere else. This is that control for NodeGX's own AI: three
 * roles, each optionally naming a provider and a model, each falling back to
 * the single global pair when it names nothing.
 *
 * Two things about the shape here are deliberate.
 *
 * **The resolver is pure.** It takes a narrow reader rather than importing
 * `AiConfigStore`, because the store reaches `AiCredentials` and therefore
 * `electron-store` — logic this branchy should be testable without Electron,
 * and `bindRoleConfig()` at the bottom is the only place the two meet.
 *
 * **A role resolves once per session, not once per request.** A session that
 * changes model mid-flight is unreadable in a transcript, so sessions resolve
 * in their constructor and carry the answer, exactly as they already do with
 * `effort`. Changing the setting affects the next session, not the one running.
 *
 * ⚠️ Defaults ship unset, and that is a finding, not an oversight. The intuitive
 * mapping — strong model designs, cheap model acts — ran *backwards* in phase
 * 55's measured replays: planning is the step a mid-tier model did well, and
 * acting (interfaces, parameter encoding, wiring) is where strength was needed.
 * Any recommended preset comes from LAS-011's matrix, never from intuition.
 *
 * @module AiAssistant/client/roles
 */

import { AiProviderId, AiRole } from '@noodl-models/AiAssistant/client/types';

/**
 * The three jobs a build is made of. `design` decides what the app is,
 * `plan` decides how it decomposes, `act` writes the graph.
 *
 * Declared in `types.ts` so an `AiChatRequest` can carry one without the two
 * modules importing each other; re-exported here because this is where roles
 * live as far as every other consumer is concerned.
 */
export type { AiRole };

export const AI_ROLES: readonly AiRole[] = ['design', 'plan', 'act'] as const;

export const AI_ROLE_LABELS: Record<AiRole, string> = {
  design: 'Design',
  plan: 'Plan',
  act: 'Act'
};

/** One line each, for the settings panel's help text. */
export const AI_ROLE_DESCRIPTIONS: Record<AiRole, string> = {
  design: 'Scoping conversations — deciding what the app is before anything is built.',
  plan: 'Turning a request into a component tree, before any node exists.',
  act: 'Writing the graph: components, interfaces, parameters and connections.'
};

/**
 * What a role's settings say. Both fields are optional and unset means
 * "inherit the global pair" — which is what every role ships as.
 */
export interface AiRoleSelection {
  provider?: AiProviderId;
  model?: string;
}

/**
 * The resolved target, in the form it rides on a request. `undefined` means
 * "do not override" for both fields, so an unset role produces a request byte-
 * identical to the one it sent before this feature existed.
 */
export interface ResolvedRole {
  role: AiRole;
  /** Absent ⇒ send to the active provider, via `getProvider()`'s bare path. */
  provider?: AiProviderId;
  /** Absent ⇒ let `withConfiguredModel` fill the provider's configured model. */
  model?: string;
  /** True when the role asked for a provider we could not honour. */
  fellBack: boolean;
}

/**
 * The slice of settings role resolution needs. Narrow on purpose: it is the
 * seam that keeps the resolver pure, and it is what specs fake.
 */
export interface AiRoleConfigReader {
  getRole(role: AiRole): AiRoleSelection;
  getActiveProvider(): AiProviderId | null;
  getModel(provider?: AiProviderId): string;
  isConfigured(provider?: AiProviderId): boolean;
}

export type RoleWarn = (message: string) => void;

/**
 * Resolve one role against the current settings.
 *
 * The interesting case is a role naming a provider that is not the active one.
 * If it is configured, both the provider *and* a model travel — the model is
 * read from the target provider, never from the active one, because filling it
 * from the active provider is how a Claude model id ends up being sent to
 * Ollama. If it is not configured, the whole selection is dropped rather than
 * half of it: a `gpt-5` id forwarded to Anthropic is a worse failure than the
 * one being avoided, and it fails somewhere far less obvious.
 */
export function resolveRole(
  role: AiRole,
  config: AiRoleConfigReader,
  warn: RoleWarn = (message) => console.warn(message)
): ResolvedRole {
  const active = config.getActiveProvider();
  // AI is off. Nothing is going to run, so a misconfigured role is not news.
  if (!active) return { role, fellBack: false };

  const selection = config.getRole(role);
  const wantsProvider = selection.provider && selection.provider !== active ? selection.provider : undefined;

  if (!wantsProvider) {
    // Either nothing was asked for, or only a model was — in both cases the
    // request goes to the active provider and no override travels.
    return { role, model: selection.model || undefined, fellBack: false };
  }

  if (!config.isConfigured(wantsProvider)) {
    warn(
      `[ai] The ${role} role is set to ${wantsProvider}, which is not configured — ` +
        `falling back to ${active} for ${role}. Add credentials for ${wantsProvider} in Editor Settings, ` +
        `or clear the ${role} role.`
    );
    return { role, fellBack: true };
  }

  return {
    role,
    provider: wantsProvider,
    // Read from the provider that will serve the request, not the active one.
    model: selection.model || config.getModel(wantsProvider) || undefined,
    fellBack: false
  };
}

/**
 * What a session spreads onto each of its requests. Empty when the session
 * opted out of roles entirely (`'global'`), which is exactly the pre-LAS-009
 * request.
 */
export interface AiRoleRequestFields {
  role?: AiRole;
  provider?: AiProviderId;
  model?: string;
}

/**
 * The fields a resolved role contributes to every request the session sends.
 * Spread onto the request literal; an unset role contributes only `role`,
 * which is a log tag and changes nothing about where the request goes.
 */
export function roleRequestFields(resolved: ResolvedRole): AiRoleRequestFields {
  return {
    role: resolved.role,
    ...(resolved.provider ? { provider: resolved.provider } : {}),
    ...(resolved.model ? { model: resolved.model } : {})
  };
}

/**
 * Which session runs under which role — the decision, in one table rather than
 * scattered across seven constructors. Paths are relative to `AiAssistant/`.
 *
 * A session appears here or in {@link AI_GLOBAL_SESSIONS}; `roleModels.test.ts`
 * fails when one appears in neither, so an eighth session added later cannot
 * quietly inherit the global pair with nothing recording that it did.
 */
export const AI_ROLE_SESSIONS: Record<AiRole, readonly string[]> = {
  /**
   * ⚠️ BLD-008's interview is `design`, and it is worth saying why, because the
   * drafting turn beside it (`review/ReviewDocSession.ts`) is deliberately
   * global and the two run in the same pass.
   *
   * The interview decides **what to ask a person about their own product** and
   * writes the guess they will correct. That is the same act `ScopingSession`
   * performs before a project exists, and it sets the ceiling on all three
   * documents: a question that misses costs a document that is wrong, and no
   * amount of drafting effort recovers it. The drafting turns that follow are
   * transcription of answers already given — prose about work already done,
   * which is the line `ReviewDocSession`'s entry draws.
   *
   * One turn per pass, so the expensive role is affordable here.
   */
  design: ['scoping/ScopingSession.ts', 'review/InterviewSession.ts'],
  plan: ['authoring/PlanningSession.ts'],
  act: ['authoring/AuthoringSession.ts']
};

/**
 * The sessions deliberately left on the global pair, each with the reason it
 * is not one of the three. Read these as decisions — they are the half of the
 * table that is easy to leave unwritten and then argue about later.
 */
export const AI_GLOBAL_SESSIONS: Readonly<Record<string, string>> = {
  'authoring/DocSession.ts':
    'Writes ARCHITECTURE.md after a run rather than deciding or building anything, so it is none of the three. It follows the global pair.',
  'explain/ExplainSession.ts':
    'Answers questions about an existing graph. Read-only and conversational: no design decision, no plan, no write.',
  'review/ReviewDocSession.ts':
    'Reviews a written doc against the graph. Like explain, it produces prose about work already done rather than doing any.',
  'context/ai-api.ts':
    'The legacy copilot surface, whose callers already pass an explicit model of their own; a role override here would silently outrank the caller.'
};

/**
 * Bind the resolver to the real settings store. Kept as a factory taking the
 * store so the import stays at the call site — the editor passes
 * `AiConfigStore`, and nothing in this module needs Electron to exist.
 */
export function bindRoleConfig(store: {
  getRole(role: AiRole): AiRoleSelection;
  getActiveProvider(): AiProviderId | null;
  getModel(provider?: AiProviderId): string;
  isConfigured(provider?: AiProviderId): boolean;
}): AiRoleConfigReader {
  return {
    getRole: (role) => store.getRole(role),
    getActiveProvider: () => store.getActiveProvider(),
    getModel: (provider) => store.getModel(provider),
    isConfigured: (provider) => store.isConfigured(provider)
  };
}
