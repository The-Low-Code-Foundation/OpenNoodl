/**
 * AuthConfigState (BAK-004) — auth.json plus the client secrets beside it.
 *
 * Wired to disk exactly like EmailConfigState (BAK-002) and SecurityState
 * (BAK-003): diffable policy in a JSON file that deploys with the backend, and
 * the actual secrets in the shared `secrets.json` through the one SecretsStore
 * convention. This subsystem owns the `auth` namespace there and touches no
 * other, so it can never clobber `adminToken`, `webhooks`, `email` or `files`.
 *
 *   `<dataDir>/auth.json`    — providers, magic-link policy, redirect
 *                              allow-list, linking toggle.
 *   `<dataDir>/secrets.json` — `auth.<providerId>.clientSecret`.
 *
 * A client secret is never returned by any read path. `GET /admin/auth` reports
 * `hasClientSecret: true|false` — enough for an operator (or an agent) to see
 * that setup is incomplete, and nothing more. That mirrors how BAK-003 handles
 * API keys and BAK-002 the SMTP password.
 *
 * @module nodegx-backend/auth/AuthConfigState
 */

import * as fs from 'fs';
import * as path from 'path';

import { SecretsStore } from '../config/SecretsStore';
import { AuthConfig, AuthProvider, defaultAuthConfig, validateAuthConfig } from './model';

/** The secrets.json namespace this subsystem owns (see config/SecretsStore). */
export const AUTH_SECRETS_NAMESPACE = 'auth';

const AUTH_FILE = 'auth.json';

function clientSecretKey(providerId: string): string {
  return `${providerId}.clientSecret`;
}

function atomicWriteJSON(filePath: string, value: unknown): void {
  const tmp = `${filePath}.tmp-${process.pid}`;
  fs.writeFileSync(tmp, JSON.stringify(value, null, 2) + '\n');
  fs.renameSync(tmp, filePath);
}

export class AuthConfigStartupError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = 'AuthConfigStartupError';
    this.code = code;
  }
}

export class AuthConfigState {
  readonly config: AuthConfig;
  private readonly dataDir: string;
  private readonly secrets: SecretsStore;

  constructor(dataDir: string) {
    this.dataDir = dataDir;
    this.secrets = new SecretsStore(dataDir);
    const configPath = path.join(dataDir, AUTH_FILE);

    if (!fs.existsSync(configPath)) {
      this.config = defaultAuthConfig();
      return;
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    } catch (e) {
      throw new AuthConfigStartupError(
        'AUTH_CONFIG_INVALID',
        `${configPath} is not valid JSON: ${e instanceof Error ? e.message : e}`
      );
    }
    const errors = validateAuthConfig(parsed);
    if (errors.length > 0) {
      throw new AuthConfigStartupError(
        'AUTH_CONFIG_INVALID',
        `${configPath} is invalid:\n${errors.map((e) => `  - ${e}`).join('\n')}`
      );
    }

    // Merge over the default so a file written by an older version still has
    // every key the current code reads.
    const base = defaultAuthConfig();
    const p = parsed as Partial<AuthConfig>;
    this.config = {
      ...base,
      ...p,
      providers: Array.isArray(p.providers) ? p.providers.map((provider) => ({ ...provider })) : [],
      magicLink: { ...base.magicLink, ...(p.magicLink || {}) },
      redirectAllowList: Array.isArray(p.redirectAllowList) ? [...p.redirectAllowList] : [],
      linking: { ...base.linking, ...(p.linking || {}) }
    };
  }

  save(): void {
    fs.mkdirSync(this.dataDir, { recursive: true });
    atomicWriteJSON(path.join(this.dataDir, AUTH_FILE), this.config);
  }

  /** The provider with this id, or null. Does NOT filter on `enabled` — callers decide. */
  provider(id: string): AuthProvider | null {
    return this.config.providers.find((p) => p.id === id) || null;
  }

  /** Enabled providers that are actually usable — the list a sign-in page should render. */
  usableProviders(): AuthProvider[] {
    return this.config.providers.filter((p) => p.enabled && this.notConfiguredReason(p) === null);
  }

  /**
   * Why this provider cannot be used right now, or null when it can.
   *
   * Loud-failure doctrine (RUN-004): a half-configured provider must never
   * silently produce a redirect that dead-ends at the provider's own error page,
   * where the operator sees the PROVIDER's message about our misconfiguration
   * rather than ours. Every branch here names the exact missing field.
   */
  notConfiguredReason(provider: AuthProvider): string | null {
    if (!provider.clientId) {
      return `Provider "${provider.id}" has no client id. Set it in the Backend Services panel (Auth section) or via PUT /admin/auth/providers/${provider.id}.`;
    }
    if (!this.getClientSecret(provider.id)) {
      return `Provider "${provider.id}" has no client secret. Set it in the Backend Services panel (Auth section) or via PUT /admin/auth/providers/${provider.id}; it is stored in secrets.json and never returned by any read.`;
    }
    if (provider.kind === 'oidc' && !provider.issuer) {
      return `Provider "${provider.id}" is an OIDC provider with no issuer URL, so its discovery document cannot be found.`;
    }
    return null;
  }

  /** The plaintext client secret for a provider, or '' when unset. Never serialized. */
  getClientSecret(providerId: string): string {
    return this.secrets.get(AUTH_SECRETS_NAMESPACE, clientSecretKey(providerId)) || '';
  }

  /** Read-modify-write into secrets.json under the `auth` namespace only. */
  setClientSecret(providerId: string, secret: string): void {
    this.secrets.set(AUTH_SECRETS_NAMESPACE, clientSecretKey(providerId), secret);
  }

  deleteClientSecret(providerId: string): void {
    this.secrets.delete(AUTH_SECRETS_NAMESPACE, clientSecretKey(providerId));
  }

  /**
   * Insert or update a provider, then persist. Returns the stored provider.
   * The caller is responsible for having validated the candidate.
   */
  upsertProvider(provider: AuthProvider): AuthProvider {
    const index = this.config.providers.findIndex((p) => p.id === provider.id);
    if (index === -1) this.config.providers.push(provider);
    else this.config.providers[index] = provider;
    this.save();
    return provider;
  }

  /** Remove a provider and its secret. Returns false when there was nothing to remove. */
  deleteProvider(id: string): boolean {
    const index = this.config.providers.findIndex((p) => p.id === id);
    if (index === -1) return false;
    this.config.providers.splice(index, 1);
    this.deleteClientSecret(id);
    this.save();
    return true;
  }

  /**
   * The config as it goes over the wire: secrets replaced by a boolean. This is
   * the ONLY shape the admin API, the dashboard, the panel and MCP ever see.
   */
  redacted(): AuthConfig & { providers: (AuthProvider & { hasClientSecret: boolean; ready: boolean; notReadyReason: string | null })[] } {
    return {
      ...this.config,
      providers: this.config.providers.map((p) => {
        const reason = this.notConfiguredReason(p);
        return {
          ...p,
          hasClientSecret: Boolean(this.getClientSecret(p.id)),
          ready: reason === null,
          notReadyReason: reason
        };
      })
    };
  }
}
