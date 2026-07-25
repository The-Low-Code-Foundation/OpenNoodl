/**
 * EmailConfigState (BAK-002) — persistence, validation, the isConfigured()
 * loud-failure gate, and the baseUrl fallback.
 */
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import { EmailConfigState, EmailConfigStartupError, validateEmailConfig, defaultEmailConfig } from '../src/email/EmailConfigState';
import { SecretsStore } from '../src/config/SecretsStore';

describe('EmailConfigState', () => {
  let dataDir: string;

  beforeEach(() => {
    dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nodegx-email-config-test-'));
  });

  afterEach(() => {
    fs.rmSync(dataDir, { recursive: true, force: true });
  });

  it('defaults to unconfigured/disabled with no email.json present', () => {
    const state = new EmailConfigState(dataDir);
    expect(state.config).toEqual(defaultEmailConfig());
    expect(state.isConfigured()).toBe(false);
    expect(state.notConfiguredReason()).toMatch(/SMTP host\/port/);
  });

  it('save() persists to <dataDir>/email.json and a fresh instance reads it back', () => {
    const state = new EmailConfigState(dataDir);
    state.config.enabled = true;
    state.config.smtp.host = 'smtp.example.com';
    state.config.smtp.port = 587;
    state.config.fromAddress = 'noreply@example.com';
    state.save();

    const reloaded = new EmailConfigState(dataDir);
    expect(reloaded.config.smtp.host).toBe('smtp.example.com');
    expect(reloaded.config.fromAddress).toBe('noreply@example.com');
    expect(reloaded.isConfigured()).toBe(true);
  });

  it('rejects a malformed committed email.json loudly rather than silently resetting', () => {
    fs.mkdirSync(dataDir, { recursive: true });
    fs.writeFileSync(path.join(dataDir, 'email.json'), JSON.stringify({ smtp: { port: 'not-a-number' } }));
    expect(() => new EmailConfigState(dataDir)).toThrow(EmailConfigStartupError);
  });

  it('validateEmailConfig flags an unknown template id', () => {
    const errors = validateEmailConfig({ templates: { bogus: { subject: 'x' } } });
    expect(errors.some((e) => e.includes('bogus'))).toBe(true);
  });

  it('isConfigured() requires enabled + host + port + fromAddress all together', () => {
    const state = new EmailConfigState(dataDir);
    state.config.smtp.host = 'smtp.example.com';
    state.config.smtp.port = 587;
    expect(state.isConfigured()).toBe(false); // enabled still false, no fromAddress
    state.config.fromAddress = 'noreply@example.com';
    expect(state.isConfigured()).toBe(false); // enabled still false
    state.config.enabled = true;
    expect(state.isConfigured()).toBe(true);
  });

  it('setSmtpPassword writes into secrets.json under the email namespace, not email.json', () => {
    const state = new EmailConfigState(dataDir);
    state.setSmtpPassword('hunter2');
    state.save();
    expect(state.getSmtpPassword()).toBe('hunter2');
    expect(new SecretsStore(dataDir).get('email', 'smtpPassword')).toBe('hunter2');
    // email.json itself never holds the plaintext secret.
    const emailJsonText = fs.readFileSync(path.join(dataDir, 'email.json'), 'utf-8');
    expect(emailJsonText).not.toContain('hunter2');
  });

  it('a fresh instance picks up an smtpPassword written by a previous instance', () => {
    const first = new EmailConfigState(dataDir);
    first.setSmtpPassword('hunter2');
    const second = new EmailConfigState(dataDir);
    expect(second.getSmtpPassword()).toBe('hunter2');
  });

  it('effectiveBaseUrl uses the configured baseUrl when set, and reports the fallback otherwise', () => {
    const state = new EmailConfigState(dataDir);
    expect(state.effectiveBaseUrl('http://127.0.0.1:1234')).toEqual({ url: 'http://127.0.0.1:1234', usedFallback: true });
    state.config.baseUrl = 'https://api.example.com/';
    expect(state.effectiveBaseUrl('http://127.0.0.1:1234')).toEqual({ url: 'https://api.example.com', usedFallback: false });
  });

  it('effectiveTemplate merges a per-backend override over the shipped default', () => {
    const state = new EmailConfigState(dataDir);
    state.config.templates.passwordReset = { subject: 'Custom subject only' };
    const effective = state.effectiveTemplate('passwordReset');
    expect(effective.subject).toBe('Custom subject only');
    expect(effective.text).toContain('{{resetUrl}}'); // falls back to the default body
  });
});
