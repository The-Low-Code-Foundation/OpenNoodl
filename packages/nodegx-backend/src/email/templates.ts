/**
 * The `{{variable}}` template system (BAK-002): subject + text + HTML bodies,
 * sensible shipped defaults, per-backend overrides. Deliberately small — a
 * textarea with variables is v1 (out of scope: a rich template editor UI).
 *
 * @module nodegx-backend/email/templates
 */

export interface EmailTemplate {
  subject: string;
  text: string;
  html: string;
}

/** Every template this backend ships. Also the enumerable set the MCP/panel edit. */
export type TemplateId = 'passwordReset' | 'verifyEmail';

export const TEMPLATE_IDS: TemplateId[] = ['passwordReset', 'verifyEmail'];

/**
 * Shipped defaults. `{{appName}}`, `{{resetUrl}}` / `{{verifyUrl}}`, and
 * `{{username}}` are always supplied by the caller (see render() below);
 * overrides may use any subset of them.
 */
export const DEFAULT_TEMPLATES: Record<TemplateId, EmailTemplate> = {
  passwordReset: {
    subject: 'Reset your password for {{appName}}',
    text:
      'Hi {{username}},\n\n' +
      'We received a request to reset your password for {{appName}}. Open the link below to choose a new one:\n\n' +
      '{{resetUrl}}\n\n' +
      'This link expires in {{expiresIn}} and can only be used once. ' +
      "If you didn't request this, you can safely ignore this email — your password will not change.\n",
    html:
      '<p>Hi {{username}},</p>' +
      '<p>We received a request to reset your password for <strong>{{appName}}</strong>. ' +
      'Click the link below to choose a new one:</p>' +
      '<p><a href="{{resetUrl}}">{{resetUrl}}</a></p>' +
      '<p>This link expires in {{expiresIn}} and can only be used once. ' +
      "If you didn't request this, you can safely ignore this email — your password will not change.</p>"
  },
  verifyEmail: {
    subject: 'Verify your email for {{appName}}',
    text:
      'Hi {{username}},\n\n' +
      'Please confirm your email address for {{appName}} by opening the link below:\n\n' +
      '{{verifyUrl}}\n\n' +
      "If you didn't create this account, you can ignore this email.\n",
    html:
      '<p>Hi {{username}},</p>' +
      '<p>Please confirm your email address for <strong>{{appName}}</strong> by clicking the link below:</p>' +
      '<p><a href="{{verifyUrl}}">{{verifyUrl}}</a></p>' +
      "<p>If you didn't create this account, you can ignore this email.</p>"
  }
};

/** `{{name}}` interpolation. Unknown variables render as an empty string, not the raw token. */
export function interpolate(template: string, variables: Record<string, string>): string {
  return template.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_match, key: string) =>
    Object.prototype.hasOwnProperty.call(variables, key) ? String(variables[key]) : ''
  );
}

/** Render a template (defaults merged with any per-backend override) against a variable set. */
export function renderTemplate(template: EmailTemplate, variables: Record<string, string>): EmailTemplate {
  return {
    subject: interpolate(template.subject, variables),
    text: interpolate(template.text, variables),
    html: interpolate(template.html, variables)
  };
}

/** A partial override merged over one default template — blank fields fall back to the default. */
export function mergeTemplate(base: EmailTemplate, override?: Partial<EmailTemplate>): EmailTemplate {
  if (!override) return base;
  return {
    subject: override.subject && override.subject.trim() ? override.subject : base.subject,
    text: override.text && override.text.trim() ? override.text : base.text,
    html: override.html && override.html.trim() ? override.html : base.html
  };
}

export function isTemplateId(value: unknown): value is TemplateId {
  return typeof value === 'string' && (TEMPLATE_IDS as string[]).includes(value);
}
