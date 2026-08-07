/**
 * WF-005 webhook secret verification — HMAC-SHA256 (GitHub/Stripe-shaped) and
 * the token fallback: accept the right secret, reject the wrong/missing one.
 */
import * as crypto from 'crypto';

import { verifyWebhook, signWebhookHmac } from '../src/triggers/webhook';

const body = Buffer.from(JSON.stringify({ action: 'opened', number: 7 }), 'utf-8');

describe('verifyWebhook — hmac-sha256', () => {
  const secret = 'shhh';

  it('accepts a correct GitHub-style X-Hub-Signature-256 header', () => {
    const sig = signWebhookHmac(secret, body); // "sha256=<hex>"
    const res = verifyWebhook('hmac-sha256', secret, body, { 'x-hub-signature-256': sig }, {});
    expect(res.ok).toBe(true);
  });

  it('accepts a bare hex digest in X-Signature-256 (no sha256= prefix)', () => {
    const hex = crypto.createHmac('sha256', secret).update(body).digest('hex');
    expect(verifyWebhook('hmac-sha256', secret, body, { 'x-signature-256': hex }, {}).ok).toBe(true);
  });

  it('accepts a base64 digest', () => {
    const b64 = crypto.createHmac('sha256', secret).update(body).digest('base64');
    expect(verifyWebhook('hmac-sha256', secret, body, { 'x-webhook-signature': b64 }, {}).ok).toBe(true);
  });

  it('rejects a wrong signature', () => {
    const res = verifyWebhook('hmac-sha256', secret, body, { 'x-hub-signature-256': 'sha256=deadbeef' }, {});
    expect(res.ok).toBe(false);
    expect(res.reason).toMatch(/mismatch/);
  });

  it('rejects a signature computed with a different secret', () => {
    const sig = signWebhookHmac('other-secret', body);
    expect(verifyWebhook('hmac-sha256', secret, body, { 'x-hub-signature-256': sig }, {}).ok).toBe(false);
  });

  it('rejects when the signature header is missing', () => {
    const res = verifyWebhook('hmac-sha256', secret, body, {}, {});
    expect(res.ok).toBe(false);
    expect(res.reason).toMatch(/missing signature header/);
  });

  it('is sensitive to a tampered body', () => {
    const sig = signWebhookHmac(secret, body);
    const tampered = Buffer.from(JSON.stringify({ action: 'opened', number: 8 }));
    expect(verifyWebhook('hmac-sha256', secret, tampered, { 'x-hub-signature-256': sig }, {}).ok).toBe(false);
  });
});

describe('verifyWebhook — token', () => {
  const secret = 'tok_123';

  it('accepts the token from X-Webhook-Token, Bearer, or ?token=', () => {
    expect(verifyWebhook('token', secret, body, { 'x-webhook-token': secret }, {}).ok).toBe(true);
    expect(verifyWebhook('token', secret, body, { authorization: `Bearer ${secret}` }, {}).ok).toBe(true);
    expect(verifyWebhook('token', secret, body, {}, { token: secret }).ok).toBe(true);
  });

  it('rejects a wrong or missing token', () => {
    expect(verifyWebhook('token', secret, body, { 'x-webhook-token': 'nope' }, {}).ok).toBe(false);
    expect(verifyWebhook('token', secret, body, {}, {}).ok).toBe(false);
  });
});

describe('verifyWebhook — no secret configured', () => {
  it('fails closed', () => {
    expect(verifyWebhook('hmac-sha256', '', body, { 'x-hub-signature-256': 'sha256=x' }, {}).ok).toBe(false);
  });
});
