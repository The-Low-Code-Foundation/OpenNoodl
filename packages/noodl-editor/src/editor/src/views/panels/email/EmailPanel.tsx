/**
 * EmailPanel (BAK-002)
 *
 * The editor face of the email subsystem: SMTP config + "Send test email"
 * (loud success/failure), the verification policy toggles, and per-template
 * overrides — the same config the MCP email tools and (later) BAK-005's
 * served dashboard edit against a running nodegx-backend's /admin/email/*
 * surface, proxied through the `backend:*Email*` IPC BackendManager exposes.
 *
 * Rendered as a full-screen portal overlay from LocalBackendCard, mirroring
 * PermissionsPanel/Data Browser/Schema (the one-panel constraint: a section
 * here, not a new top-level panel).
 *
 * @module panels/email/EmailPanel
 */

import React, { useCallback, useEffect, useState } from 'react';

import { Icon, IconName, IconSize } from '@noodl-core-ui/components/common/Icon';
import { IconButton } from '@noodl-core-ui/components/inputs/IconButton';
import { PrimaryButton, PrimaryButtonSize, PrimaryButtonVariant } from '@noodl-core-ui/components/inputs/PrimaryButton';
import { HStack, VStack } from '@noodl-core-ui/components/layout/Stack';
import { Text, TextType } from '@noodl-core-ui/components/typography/Text';

import css from './EmailPanel.module.scss';

const { ipcRenderer } = window.require('electron');

type TemplateId = 'passwordReset' | 'verifyEmail';
const TEMPLATE_LABELS: Record<TemplateId, string> = {
  passwordReset: 'Password Reset',
  verifyEmail: 'Verify Email'
};

interface EmailConfig {
  enabled: boolean;
  smtp: { host: string; port: number; secure: boolean; username: string };
  fromAddress: string;
  fromName: string;
  baseUrl: string;
  verification: { sendOnSignup: boolean; requireForLogin: boolean };
  templates: Partial<Record<TemplateId, { subject?: string; text?: string; html?: string }>>;
}

interface TemplateEntry {
  id: TemplateId;
  default: { subject: string; text: string; html: string };
  override: { subject?: string; text?: string; html?: string } | null;
  effective: { subject: string; text: string; html: string };
  isOverridden: boolean;
}

export interface EmailPanelProps {
  backendId: string;
  backendName: string;
  onClose: () => void;
}

export function EmailPanel({ backendId, backendName, onClose }: EmailPanelProps) {
  const [config, setConfig] = useState<EmailConfig | null>(null);
  const [hasSmtpPassword, setHasSmtpPassword] = useState(false);
  const [configured, setConfigured] = useState(false);
  const [smtpPasswordInput, setSmtpPasswordInput] = useState('');
  const [templates, setTemplates] = useState<TemplateEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [testTo, setTestTo] = useState('');
  const [isTesting, setIsTesting] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<TemplateId | null>(null);
  const [templateDraft, setTemplateDraft] = useState<{ subject: string; text: string; html: string }>({
    subject: '',
    text: '',
    html: ''
  });

  const load = useCallback(async () => {
    setError(null);
    try {
      const cfg = await ipcRenderer.invoke('backend:getEmailConfig', backendId);
      setConfig(cfg.config);
      setHasSmtpPassword(cfg.hasSmtpPassword);
      setConfigured(cfg.configured);
      const tpl = await ipcRenderer.invoke('backend:getEmailTemplates', backendId);
      setTemplates(tpl.templates || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, [backendId]);

  useEffect(() => {
    load();
  }, [load]);

  const flash = useCallback((message: string) => {
    setNotice(message);
    setError(null);
    setTimeout(() => setNotice(null), 4000);
  }, []);

  const reportError = useCallback((err: unknown) => {
    setError(err instanceof Error ? err.message : String(err));
  }, []);

  const saveConfig = useCallback(
    async (patch: Partial<EmailConfig>) => {
      if (!config) return;
      try {
        const body: Record<string, unknown> = { config: { ...config, ...patch } };
        if (smtpPasswordInput) body.smtpPassword = smtpPasswordInput;
        const res = await ipcRenderer.invoke('backend:setEmailConfig', backendId, body);
        setConfig(res.config);
        setConfigured(res.configured);
        setHasSmtpPassword(res.hasSmtpPassword);
        if (smtpPasswordInput) setSmtpPasswordInput('');
        flash('Email config saved.');
      } catch (err) {
        reportError(err);
      }
    },
    [backendId, config, smtpPasswordInput, flash, reportError]
  );

  const sendTest = useCallback(async () => {
    if (!testTo.trim()) return;
    setIsTesting(true);
    setError(null);
    try {
      const res = await ipcRenderer.invoke('backend:sendTestEmail', backendId, testTo.trim());
      flash(
        res.baseUrlWarning
          ? `Test email sent — but no baseUrl is set, so reset/verify links will use a localhost fallback.`
          : 'Test email sent successfully.'
      );
    } catch (err) {
      // Admin-authenticated surface: loud failure, verbatim reason.
      reportError(err);
    } finally {
      setIsTesting(false);
    }
  }, [backendId, testTo, flash, reportError]);

  const startEditTemplate = useCallback((entry: TemplateEntry) => {
    setEditingTemplate(entry.id);
    setTemplateDraft({
      subject: entry.override?.subject || '',
      text: entry.override?.text || '',
      html: entry.override?.html || ''
    });
  }, []);

  const saveTemplate = useCallback(async () => {
    if (!editingTemplate) return;
    try {
      await ipcRenderer.invoke('backend:setEmailTemplate', backendId, editingTemplate, templateDraft);
      setEditingTemplate(null);
      await load();
      flash(`${TEMPLATE_LABELS[editingTemplate]} template saved.`);
    } catch (err) {
      reportError(err);
    }
  }, [backendId, editingTemplate, templateDraft, load, flash, reportError]);

  const resetTemplate = useCallback(
    async (id: TemplateId) => {
      try {
        await ipcRenderer.invoke('backend:resetEmailTemplate', backendId, id);
        await load();
        flash(`${TEMPLATE_LABELS[id]} reverted to the default.`);
      } catch (err) {
        reportError(err);
      }
    },
    [backendId, load, flash, reportError]
  );

  if (!config) {
    return (
      <div className={css.Root}>
        <div className={css.Header}>
          <Text textType={TextType.DefaultContrast}>Email</Text>
          <IconButton icon={IconName.Close} onClick={onClose} />
        </div>
        <div className={css.Body}>
          {error && (
            <div className={css.ErrorBanner}>
              <Text textType={TextType.Default}>{error}</Text>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={css.Root} data-test={`email-panel-${backendId}`}>
      <div className={css.Header}>
        <HStack hasSpacing>
          <div className={css.HeaderIcon}>
            <Icon icon={IconName.Setting} size={IconSize.Small} />
          </div>
          <VStack>
            <Text textType={TextType.DefaultContrast}>Email</Text>
            <Text textType={TextType.Shy} style={{ fontSize: '11px' }}>
              {backendName}
            </Text>
          </VStack>
        </HStack>
        <IconButton icon={IconName.Close} onClick={onClose} />
      </div>

      <div className={css.Body}>
        {error && (
          <div className={css.ErrorBanner}>
            <Text textType={TextType.Default}>{error}</Text>
          </div>
        )}
        {notice && (
          <div className={css.NoticeBanner}>
            <Text textType={TextType.Default}>{notice}</Text>
          </div>
        )}

        {/* Status */}
        <div className={css.Section}>
          <div className={css.SpreadRow}>
            <VStack>
              <Text textType={TextType.DefaultContrast}>{configured ? 'Email is configured' : 'Email is not configured'}</Text>
              <Text textType={TextType.Shy} style={{ fontSize: '11px' }}>
                {configured
                  ? 'Password reset, email verification, and the Send Email node can all send mail.'
                  : 'Password reset / verification flows and the Send Email node fail loudly until SMTP is set up below.'}
              </Text>
            </VStack>
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={config.enabled}
                onChange={(e) => saveConfig({ enabled: e.target.checked })}
              />
              <Text textType={TextType.Shy} style={{ fontSize: '11px' }}>
                Enabled
              </Text>
            </label>
          </div>
        </div>

        {/* SMTP config */}
        <div className={css.Section}>
          <Text textType={TextType.DefaultContrast} style={{ marginBottom: '4px' }}>
            SMTP
          </Text>
          <Text textType={TextType.Shy} style={{ fontSize: '11px' }}>
            Point this at your provider's SMTP endpoint (Mailgun, SES, Postmark, your own postfix, …).
            Deliverability (SPF/DKIM) is your provider's job, same as with Pocketbase.
          </Text>
          <div className={css.FieldGrid}>
            <label className={css.Field}>
              <Text textType={TextType.Shy} style={{ fontSize: '10px' }}>
                Host
              </Text>
              <input
                className={css.Input}
                defaultValue={config.smtp.host}
                placeholder="smtp.example.com"
                onBlur={(e) => saveConfig({ smtp: { ...config.smtp, host: e.target.value } })}
              />
            </label>
            <label className={css.Field}>
              <Text textType={TextType.Shy} style={{ fontSize: '10px' }}>
                Port
              </Text>
              <input
                className={css.Input}
                type="number"
                defaultValue={config.smtp.port}
                onBlur={(e) => saveConfig({ smtp: { ...config.smtp, port: parseInt(e.target.value, 10) || 587 } })}
              />
            </label>
            <label className={css.Field}>
              <Text textType={TextType.Shy} style={{ fontSize: '10px' }}>
                Username
              </Text>
              <input
                className={css.Input}
                defaultValue={config.smtp.username}
                onBlur={(e) => saveConfig({ smtp: { ...config.smtp, username: e.target.value } })}
              />
            </label>
            <label className={css.Field}>
              <Text textType={TextType.Shy} style={{ fontSize: '10px' }}>
                Password {hasSmtpPassword && '(set — leave blank to keep)'}
              </Text>
              <input
                className={css.Input}
                type="password"
                value={smtpPasswordInput}
                placeholder={hasSmtpPassword ? '••••••••' : ''}
                onChange={(e) => setSmtpPasswordInput(e.target.value)}
                onBlur={() => smtpPasswordInput && saveConfig({})}
              />
            </label>
            <label className={css.Field}>
              <Text textType={TextType.Shy} style={{ fontSize: '10px' }}>
                Security
              </Text>
              <select
                className={css.Input}
                value={config.smtp.secure ? 'tls' : 'starttls'}
                onChange={(e) => saveConfig({ smtp: { ...config.smtp, secure: e.target.value === 'tls' } })}
              >
                <option value="starttls">STARTTLS / plaintext (587, 25)</option>
                <option value="tls">Implicit TLS (465)</option>
              </select>
            </label>
            <label className={css.Field}>
              <Text textType={TextType.Shy} style={{ fontSize: '10px' }}>
                From address
              </Text>
              <input
                className={css.Input}
                defaultValue={config.fromAddress}
                placeholder="noreply@yourapp.com"
                onBlur={(e) => saveConfig({ fromAddress: e.target.value })}
              />
            </label>
            <label className={css.Field}>
              <Text textType={TextType.Shy} style={{ fontSize: '10px' }}>
                From name
              </Text>
              <input
                className={css.Input}
                defaultValue={config.fromName}
                onBlur={(e) => saveConfig({ fromName: e.target.value })}
              />
            </label>
            <label className={css.Field}>
              <Text textType={TextType.Shy} style={{ fontSize: '10px' }}>
                Base URL (links in emails; also used by magic-link OAuth)
              </Text>
              <input
                className={css.Input}
                defaultValue={config.baseUrl}
                placeholder="https://api.yourapp.com"
                onBlur={(e) => saveConfig({ baseUrl: e.target.value })}
              />
            </label>
          </div>

          <div className={css.InlineRow}>
            <input
              className={css.Input}
              placeholder="you@example.com"
              value={testTo}
              onChange={(e) => setTestTo(e.target.value)}
              style={{ maxWidth: '260px' }}
            />
            <PrimaryButton
              label={isTesting ? 'Sending…' : 'Send test email'}
              size={PrimaryButtonSize.Small}
              variant={PrimaryButtonVariant.Muted}
              onClick={sendTest}
              isDisabled={isTesting || !testTo.trim()}
            />
          </div>
        </div>

        {/* Verification policy */}
        <div className={css.Section}>
          <Text textType={TextType.DefaultContrast} style={{ marginBottom: '8px' }}>
            Email verification
          </Text>
          <VStack hasSpacing>
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={config.verification.sendOnSignup}
                onChange={(e) =>
                  saveConfig({ verification: { ...config.verification, sendOnSignup: e.target.checked } })
                }
              />
              <Text textType={TextType.Shy} style={{ fontSize: '11px' }}>
                Send a verification email on signup
              </Text>
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={config.verification.requireForLogin}
                onChange={(e) =>
                  saveConfig({ verification: { ...config.verification, requireForLogin: e.target.checked } })
                }
              />
              <Text textType={TextType.Shy} style={{ fontSize: '11px' }}>
                Block login until the user's email is verified
              </Text>
            </label>
          </VStack>
        </div>

        {/* Templates */}
        <div className={css.Section}>
          <Text textType={TextType.DefaultContrast} style={{ marginBottom: '4px' }}>
            Templates
          </Text>
          <Text textType={TextType.Shy} style={{ fontSize: '11px', marginBottom: '8px' }}>
            {'{{variable}}'} interpolation. Blank fields fall back to the shipped default.
          </Text>
          {templates.map((entry) => (
            <div key={entry.id} className={css.TemplateRow}>
              <div className={css.TemplateHeader}>
                <VStack>
                  <Text textType={TextType.DefaultContrast}>
                    {TEMPLATE_LABELS[entry.id]} {entry.isOverridden ? '(customized)' : '(default)'}
                  </Text>
                </VStack>
                <HStack hasSpacing>
                  {entry.isOverridden && (
                    <PrimaryButton
                      label="Revert"
                      size={PrimaryButtonSize.Small}
                      variant={PrimaryButtonVariant.Muted}
                      onClick={() => resetTemplate(entry.id)}
                    />
                  )}
                  <PrimaryButton
                    label={editingTemplate === entry.id ? 'Cancel' : 'Edit'}
                    size={PrimaryButtonSize.Small}
                    variant={PrimaryButtonVariant.Muted}
                    onClick={() => (editingTemplate === entry.id ? setEditingTemplate(null) : startEditTemplate(entry))}
                  />
                </HStack>
              </div>

              {editingTemplate === entry.id ? (
                <VStack hasSpacing>
                  <label className={css.Field}>
                    <Text textType={TextType.Shy} style={{ fontSize: '10px' }}>
                      Subject
                    </Text>
                    <input
                      className={css.Input}
                      value={templateDraft.subject}
                      placeholder={entry.default.subject}
                      onChange={(e) => setTemplateDraft((d) => ({ ...d, subject: e.target.value }))}
                    />
                  </label>
                  <label className={css.Field}>
                    <Text textType={TextType.Shy} style={{ fontSize: '10px' }}>
                      Text body
                    </Text>
                    <textarea
                      className={css.Textarea}
                      value={templateDraft.text}
                      placeholder={entry.default.text}
                      onChange={(e) => setTemplateDraft((d) => ({ ...d, text: e.target.value }))}
                    />
                  </label>
                  <label className={css.Field}>
                    <Text textType={TextType.Shy} style={{ fontSize: '10px' }}>
                      HTML body (optional)
                    </Text>
                    <textarea
                      className={css.Textarea}
                      value={templateDraft.html}
                      placeholder={entry.default.html}
                      onChange={(e) => setTemplateDraft((d) => ({ ...d, html: e.target.value }))}
                    />
                  </label>
                  <PrimaryButton label="Save template" size={PrimaryButtonSize.Small} onClick={saveTemplate} />
                </VStack>
              ) : (
                <Text textType={TextType.Shy} style={{ fontSize: '11px' }}>
                  {entry.effective.subject}
                </Text>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
