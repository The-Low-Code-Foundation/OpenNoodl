/**
 * EmailConfigState (BAK-002) — the email subsystem's config, wired to disk
 * exactly like SecurityState (BAK-003) is: policy in a diffable, deployable,
 * MCP-editable JSON file; the one secret (the SMTP password) in the shared
 * `secrets.json` via the one `SecretsStore` convention (see `../config/SecretsStore`).
 *
 *   `<dataDir>/email.json`   — SMTP host/port/security, from-address/name,
 *                              the base-URL setting, the verification policy,
 *                              and template overrides. Diffable, deploys with
 *                              the backend, MCP-editable.
 *   `<dataDir>/secrets.json` — `email.smtpPassword`, in the `email` namespace of
 *                              the shared `SecretsStore` (whole-file read-modify-
 *                              write) so this never clobbers `adminToken` or
 *                              WF-005's `webhooks` secrets in the same file.
 *
 * `baseUrl` is the ONE canonical "deployed origin" setting for this backend —
 * defined here because email links need it first, but it is NOT an email-only
 * concept: BAK-004's OAuth redirects are specified to reuse this exact field.
 * Do not add a second base-URL setting; read `EmailConfigState.config.baseUrl`.
 *
 * @module nodegx-backend/email/EmailConfigState
 */

import * as fs from 'fs';
import * as path from 'path';

import { SecretsStore } from '../config/SecretsStore';
import { DEFAULT_TEMPLATES, EmailTemplate, TemplateId, isTemplateId } from './templates';

/** The secrets.json namespace this subsystem owns (see config/SecretsStore). */
const EMAIL_SECRETS_NAMESPACE = 'email';
const SMTP_PASSWORD_KEY = 'smtpPassword';

const EMAIL_FILE = 'email.json';

export interface EmailConfig {
  version: 1;
  /** Master switch — off by default; loud-failure applies whether this is off or the SMTP fields are incomplete. */
  enabled: boolean;
  smtp: {
    host: string;
    port: number;
    /** true = implicit TLS (typically port 465); false = plaintext/STARTTLS (typically 587/25). */
    secure: boolean;
    username: string;
  };
  fromAddress: string;
  fromName: string;
  /**
   * The backend's deployed origin, e.g. "https://api.example.com". Used to
   * build the links in reset/verify emails. Blank = falls back to
   * `http://<host>:<port>` at send time (correct for local dev only — a
   * loud warning surfaces in the test-send response when blank).
   */
  baseUrl: string;
  verification: {
    /** Send a verification email on signup. */
    sendOnSignup: boolean;
    /** Login policy toggle: block sign-in until `emailVerified` is true. */
    requireForLogin: boolean;
  };
  /** Per-backend overrides, keyed by template id. Blank fields fall back to the shipped default. */
  templates: Partial<Record<TemplateId, Partial<EmailTemplate>>>;
}

export function defaultEmailConfig(): EmailConfig {
  return {
    version: 1,
    enabled: false,
    smtp: { host: '', port: 587, secure: false, username: '' },
    fromAddress: '',
    fromName: '',
    baseUrl: '',
    verification: { sendOnSignup: false, requireForLogin: false },
    templates: {}
  };
}

/** Structural validation — refuses to start/save with a config that would silently misbehave. */
export function validateEmailConfig(candidate: unknown): string[] {
  const errors: string[] = [];
  if (!candidate || typeof candidate !== 'object') {
    return ['email config must be an object'];
  }
  const c = candidate as Partial<EmailConfig>;
  if (c.smtp !== undefined) {
    if (typeof c.smtp !== 'object' || c.smtp === null) errors.push('smtp must be an object');
    else {
      if (c.smtp.host !== undefined && typeof c.smtp.host !== 'string') errors.push('smtp.host must be a string');
      if (c.smtp.port !== undefined && (typeof c.smtp.port !== 'number' || !Number.isFinite(c.smtp.port))) {
        errors.push('smtp.port must be a number');
      }
      if (c.smtp.secure !== undefined && typeof c.smtp.secure !== 'boolean') errors.push('smtp.secure must be a boolean');
      if (c.smtp.username !== undefined && typeof c.smtp.username !== 'string') errors.push('smtp.username must be a string');
    }
  }
  if (c.enabled !== undefined && typeof c.enabled !== 'boolean') errors.push('enabled must be a boolean');
  if (c.fromAddress !== undefined && typeof c.fromAddress !== 'string') errors.push('fromAddress must be a string');
  if (c.fromName !== undefined && typeof c.fromName !== 'string') errors.push('fromName must be a string');
  if (c.baseUrl !== undefined && typeof c.baseUrl !== 'string') errors.push('baseUrl must be a string');
  if (c.verification !== undefined) {
    if (typeof c.verification !== 'object' || c.verification === null) errors.push('verification must be an object');
    else {
      if (c.verification.sendOnSignup !== undefined && typeof c.verification.sendOnSignup !== 'boolean') {
        errors.push('verification.sendOnSignup must be a boolean');
      }
      if (c.verification.requireForLogin !== undefined && typeof c.verification.requireForLogin !== 'boolean') {
        errors.push('verification.requireForLogin must be a boolean');
      }
    }
  }
  if (c.templates !== undefined) {
    if (typeof c.templates !== 'object' || c.templates === null) {
      errors.push('templates must be an object');
    } else {
      for (const [id, override] of Object.entries(c.templates)) {
        if (!isTemplateId(id)) {
          errors.push(`templates: unknown template id "${id}"`);
          continue;
        }
        if (override && typeof override !== 'object') errors.push(`templates.${id} must be an object`);
      }
    }
  }
  return errors;
}

function atomicWriteJSON(filePath: string, value: unknown): void {
  const tmp = `${filePath}.tmp-${process.pid}`;
  fs.writeFileSync(tmp, JSON.stringify(value, null, 2) + '\n');
  fs.renameSync(tmp, filePath);
}

export class EmailConfigStartupError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = 'EmailConfigStartupError';
    this.code = code;
  }
}

export class EmailConfigState {
  readonly config: EmailConfig;
  private readonly dataDir: string;
  private smtpPassword: string;

  constructor(dataDir: string) {
    this.dataDir = dataDir;
    const configPath = path.join(dataDir, EMAIL_FILE);
    if (fs.existsSync(configPath)) {
      let parsed: unknown;
      try {
        parsed = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
      } catch (e) {
        throw new EmailConfigStartupError(
          'EMAIL_CONFIG_INVALID',
          `${configPath} is not valid JSON: ${e instanceof Error ? e.message : e}`
        );
      }
      const errors = validateEmailConfig(parsed);
      if (errors.length > 0) {
        throw new EmailConfigStartupError(
          'EMAIL_CONFIG_INVALID',
          `${configPath} is invalid:\n${errors.map((e) => `  - ${e}`).join('\n')}`
        );
      }
      // Merge over the default so a config written by an older version (fewer
      // fields) still has every key the current code expects.
      const base = defaultEmailConfig();
      const p = parsed as Partial<EmailConfig>;
      this.config = {
        ...base,
        ...p,
        smtp: { ...base.smtp, ...(p.smtp || {}) },
        verification: { ...base.verification, ...(p.verification || {}) },
        templates: { ...(p.templates || {}) }
      };
    } else {
      this.config = defaultEmailConfig();
    }

    this.smtpPassword = new SecretsStore(dataDir).get(EMAIL_SECRETS_NAMESPACE, SMTP_PASSWORD_KEY) || '';
  }

  save(): void {
    fs.mkdirSync(this.dataDir, { recursive: true });
    atomicWriteJSON(path.join(this.dataDir, EMAIL_FILE), this.config);
  }

  /** The plaintext SMTP password. Never serialized as part of `config` / never sent to the panel/MCP verbatim. */
  getSmtpPassword(): string {
    return this.smtpPassword;
  }

  /** Read-modify-write into `secrets.json` under the `email` namespace — never touches `adminToken` or `webhooks`. */
  setSmtpPassword(password: string): void {
    this.smtpPassword = password;
    new SecretsStore(this.dataDir).set(EMAIL_SECRETS_NAMESPACE, SMTP_PASSWORD_KEY, password);
  }

  /**
   * Loud-failure gate: is there enough configuration to even attempt a send?
   * `enabled` is a deliberate second switch — an operator can have host/port
   * filled in while testing without every flow firing for real.
   */
  isConfigured(): boolean {
    return Boolean(this.config.enabled && this.config.smtp.host && this.config.smtp.port && this.config.fromAddress);
  }

  /** Why sending isn't possible right now — the message that must reach flows, the node, and the panel. */
  notConfiguredReason(): string {
    if (!this.config.smtp.host || !this.config.smtp.port) {
      return 'Email is not configured for this backend: no SMTP host/port set. Configure SMTP in the Backend Services panel (Email section) or via the backend admin API before this can send mail.';
    }
    if (!this.config.fromAddress) {
      return 'Email is not configured for this backend: no "from" address set. Set one in the Email section of the Backend Services panel.';
    }
    if (!this.config.enabled) {
      return 'Email is configured but disabled for this backend. Turn it on in the Email section of the Backend Services panel.';
    }
    return 'Email is not configured for this backend.';
  }

  /** The effective link origin for building email URLs — the configured baseUrl, or a documented local fallback. */
  effectiveBaseUrl(fallbackLocalUrl: string): { url: string; usedFallback: boolean } {
    if (this.config.baseUrl && this.config.baseUrl.trim()) {
      return { url: this.config.baseUrl.replace(/\/+$/, ''), usedFallback: false };
    }
    return { url: fallbackLocalUrl.replace(/\/+$/, ''), usedFallback: true };
  }

  /** The default template merged with any per-backend override — what actually gets sent/shown. */
  effectiveTemplate(id: TemplateId): EmailTemplate {
    const base = DEFAULT_TEMPLATES[id];
    const override = this.config.templates[id];
    if (!override) return base;
    return {
      subject: override.subject && override.subject.trim() ? override.subject : base.subject,
      text: override.text && override.text.trim() ? override.text : base.text,
      html: override.html && override.html.trim() ? override.html : base.html
    };
  }
}
