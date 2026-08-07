/**
 * Admin email surface (BAK-002) — the HTTP form of the email subsystem's
 * config + templates, mirroring BAK-003's admin-security.ts shape:
 *
 *   GET  /admin/email/config              full config (never the SMTP password)
 *   PUT  /admin/email/config              update config; optional `smtpPassword` field writes the secret
 *   POST /admin/email/test                send a test email NOW — throws loudly if unconfigured/failed
 *   GET  /admin/email/templates           the effective (default-merged) templates + which are overridden
 *   PUT  /admin/email/templates/:id       set an override for one template
 *   DELETE /admin/email/templates/:id     revert one template to the shipped default
 *
 * All admin-gated by the HttpServer dispatcher. The same surface backs the
 * editor's Email panel section AND the MCP tools — one model, two fronts,
 * per the AI-visibility rule (BAK-002's task doc: "templates must be
 * enumerable/editable via MCP").
 *
 * @module nodegx-backend/server/admin-email
 */

import type { EmailConfigState } from '../email/EmailConfigState';
import { validateEmailConfig } from '../email/EmailConfigState';
import type { Mailer } from '../email/Mailer';
import {
  DEFAULT_TEMPLATES,
  TEMPLATE_IDS,
  EmailTemplate,
  TemplateId,
  isTemplateId,
  mergeTemplate,
  renderTemplate
} from '../email/templates';
import type { RequestContext } from './HttpServer';
import { HttpError, readJSONBody, sendJSON } from './http-util';

/** One row of `GET /admin/email/templates`. */
export interface TemplateEntry {
  id: TemplateId;
  default: EmailTemplate;
  /** The stored override, or null when the shipped default is in force. */
  override: Partial<EmailTemplate> | null;
  /** default merged with override — what actually gets sent. */
  effective: EmailTemplate;
  isOverridden: boolean;
}

export interface TemplateListResponse {
  templates: TemplateEntry[];
}

/** `PUT`/`DELETE /admin/email/templates/:id`. */
export interface TemplateMutationResponse {
  success: boolean;
  id: TemplateId;
  effective: EmailTemplate;
  /** DELETE only: whether an override was actually in place. */
  removed?: boolean;
}

/** `GET /admin/email/templates/:id/preview`. */
export interface TemplatePreviewResponse {
  id: TemplateId;
  preview: EmailTemplate;
}

export class AdminEmailRoutes {
  private readonly emailConfig: EmailConfigState;
  private readonly mailer: Mailer;

  constructor(emailConfig: EmailConfigState, mailer: Mailer) {
    this.emailConfig = emailConfig;
    this.mailer = mailer;
  }

  // ==========================================================================
  // Config
  // ==========================================================================

  getConfig(ctx: RequestContext): void {
    sendJSON(ctx.res, 200, {
      config: this.emailConfig.config,
      hasSmtpPassword: Boolean(this.emailConfig.getSmtpPassword()),
      configured: this.emailConfig.isConfigured(),
      notConfiguredReason: this.emailConfig.isConfigured() ? null : this.emailConfig.notConfiguredReason()
    });
  }

  async putConfig(ctx: RequestContext): Promise<void> {
    const body = await readJSONBody(ctx.req);
    const { smtpPassword, config } = body as { smtpPassword?: string; config?: unknown };
    const candidate = (config !== undefined ? config : body) as Record<string, unknown>;
    // smtpPassword never lives in the validated config object — strip it before validating/merging.
    delete candidate.smtpPassword;

    const merged = {
      ...this.emailConfig.config,
      ...candidate,
      smtp: { ...this.emailConfig.config.smtp, ...((candidate.smtp as object) || {}) },
      verification: { ...this.emailConfig.config.verification, ...((candidate.verification as object) || {}) },
      templates: candidate.templates !== undefined ? candidate.templates : this.emailConfig.config.templates
    };
    const errors = validateEmailConfig(merged);
    if (errors.length > 0) {
      throw new HttpError(400, `Invalid email config:\n${errors.map((e) => `- ${e}`).join('\n')}`);
    }
    Object.assign(this.emailConfig.config, merged);
    this.emailConfig.save();

    if (typeof smtpPassword === 'string' && smtpPassword.length > 0) {
      this.emailConfig.setSmtpPassword(smtpPassword);
    }

    sendJSON(ctx.res, 200, {
      success: true,
      config: this.emailConfig.config,
      hasSmtpPassword: Boolean(this.emailConfig.getSmtpPassword()),
      configured: this.emailConfig.isConfigured()
    });
  }

  // ==========================================================================
  // Test send — ADMIN-authenticated, so this throws loudly (no enumeration
  // concern: the caller already holds the admin credential).
  // ==========================================================================

  async testSend(ctx: RequestContext): Promise<void> {
    const body = await readJSONBody(ctx.req);
    const to = String(body.to || '');
    if (!to) throw new HttpError(400, 'Provide "to" — the address to send the test email to.');

    if (!this.emailConfig.isConfigured()) {
      throw new HttpError(503, this.emailConfig.notConfiguredReason());
    }
    const { usedFallback } = this.emailConfig.effectiveBaseUrl('');
    const result = await this.mailer.send({
      to,
      subject: 'NodeGX backend: test email',
      text:
        'This is a test email from your NodeGX backend. If you received this, SMTP is configured correctly.\n' +
        (usedFallback ? '\nNote: no baseUrl is set — reset/verify links will use a localhost fallback until you set one.' : '')
    });
    if (!result.success) {
      throw new HttpError(502, result.error || 'Failed to send test email.');
    }
    sendJSON(ctx.res, 200, { success: true, retried: Boolean(result.retried), baseUrlWarning: usedFallback });
  }

  // ==========================================================================
  // Templates
  // ==========================================================================

  getTemplates(ctx: RequestContext): void {
    const templates = TEMPLATE_IDS.map((id) => {
      const override = this.emailConfig.config.templates[id];
      const effective = this.emailConfig.effectiveTemplate(id);
      return { id, default: DEFAULT_TEMPLATES[id], override: override || null, effective, isOverridden: Boolean(override) };
    });
    sendJSON(ctx.res, 200, { templates } satisfies TemplateListResponse);
  }

  async putTemplate(ctx: RequestContext): Promise<void> {
    const id = ctx.params.id;
    if (!isTemplateId(id)) {
      throw new HttpError(404, `No such template: ${id}. Known: ${TEMPLATE_IDS.join(', ')}`);
    }
    const body = await readJSONBody(ctx.req);
    const override: Partial<EmailTemplate> = {};
    if (typeof body.subject === 'string') override.subject = body.subject;
    if (typeof body.text === 'string') override.text = body.text;
    if (typeof body.html === 'string') override.html = body.html;

    this.emailConfig.config.templates[id] = override;
    this.emailConfig.save();
    sendJSON(ctx.res, 200, {
      success: true,
      id,
      effective: mergeTemplate(DEFAULT_TEMPLATES[id], override)
    } satisfies TemplateMutationResponse);
  }

  deleteTemplate(ctx: RequestContext): void {
    const id = ctx.params.id;
    if (!isTemplateId(id)) {
      throw new HttpError(404, `No such template: ${id}. Known: ${TEMPLATE_IDS.join(', ')}`);
    }
    const existed = this.emailConfig.config.templates[id] !== undefined;
    delete this.emailConfig.config.templates[id];
    this.emailConfig.save();
    sendJSON(ctx.res, 200, {
      success: true,
      id,
      removed: existed,
      effective: DEFAULT_TEMPLATES[id]
    } satisfies TemplateMutationResponse);
  }

  /** Preview a template rendered against sample variables — used by the panel, harmless without sending anything. */
  previewTemplate(ctx: RequestContext): void {
    const id = ctx.params.id;
    if (!isTemplateId(id)) {
      throw new HttpError(404, `No such template: ${id}. Known: ${TEMPLATE_IDS.join(', ')}`);
    }
    const rendered = renderTemplate(this.emailConfig.effectiveTemplate(id), {
      appName: 'Your App',
      username: 'jane.doe',
      resetUrl: 'https://example.com/apps/demo/request_password_reset?token=SAMPLE&username=jane.doe',
      verifyUrl: 'https://example.com/apps/demo/verify_email?username=jane.doe&token=SAMPLE',
      expiresIn: '1 hour'
    });
    sendJSON(ctx.res, 200, { id, preview: rendered } satisfies TemplatePreviewResponse);
  }
}
