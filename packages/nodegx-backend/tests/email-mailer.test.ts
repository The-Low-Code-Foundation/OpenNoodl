/**
 * Mailer (BAK-002) — the loud-failure doctrine applied to email: unconfigured
 * never queues/drops silently, and a failed send gets exactly one documented
 * retry. Uses `setTransportForTesting` (a deliberate test seam) rather than
 * real SMTP/network.
 */
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import { EmailConfigState } from '../src/email/EmailConfigState';
import { Mailer } from '../src/email/Mailer';

describe('Mailer', () => {
  let dataDir: string;
  let config: EmailConfigState;

  beforeEach(() => {
    dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nodegx-mailer-test-'));
    config = new EmailConfigState(dataDir);
  });

  afterEach(() => {
    fs.rmSync(dataDir, { recursive: true, force: true });
  });

  function configure() {
    config.config.enabled = true;
    config.config.smtp.host = 'smtp.example.com';
    config.config.smtp.port = 587;
    config.config.fromAddress = 'noreply@example.com';
    config.config.fromName = 'Example App';
  }

  it('fails loudly with an actionable message when unconfigured — no transport is even built', () => {
    const mailer = new Mailer(config);
    let called = false;
    mailer.setTransportForTesting({
      sendMail: async () => {
        called = true;
      }
    });
    return mailer.send({ to: 'a@b.com', subject: 'Hi', text: 'Hello' }).then((result) => {
      expect(result.success).toBe(false);
      expect(result.error).toMatch(/not configured/i);
      expect(called).toBe(false);
    });
  });

  it('sends successfully on the first attempt when configured', async () => {
    configure();
    const sent: Record<string, unknown>[] = [];
    const mailer = new Mailer(config);
    mailer.setTransportForTesting({
      sendMail: async (opts) => {
        sent.push(opts);
      }
    });
    const result = await mailer.send({ to: 'a@b.com', subject: 'Hi', text: 'Hello' });
    expect(result).toEqual({ success: true });
    expect(sent).toHaveLength(1);
    expect(sent[0]).toMatchObject({ to: 'a@b.com', subject: 'Hi', text: 'Hello', from: '"Example App" <noreply@example.com>' });
  });

  it('retries exactly once on failure, and succeeds if the retry works', async () => {
    configure();
    let attempts = 0;
    const mailer = new Mailer(config);
    mailer.setTransportForTesting({
      sendMail: async () => {
        attempts += 1;
        if (attempts === 1) throw new Error('transient SMTP hiccup');
      }
    });
    const result = await mailer.send({ to: 'a@b.com', subject: 'Hi', text: 'Hello' });
    expect(attempts).toBe(2);
    expect(result.success).toBe(true);
    expect(result.retried).toBe(true);
  });

  it('gives up after the one retry and reports the failure honestly', async () => {
    configure();
    let attempts = 0;
    const mailer = new Mailer(config);
    mailer.setTransportForTesting({
      sendMail: async () => {
        attempts += 1;
        throw new Error('SMTP auth failed');
      }
    });
    const result = await mailer.send({ to: 'a@b.com', subject: 'Hi', text: 'Hello' });
    expect(attempts).toBe(2); // exactly one retry, not an unbounded/queued loop
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/SMTP auth failed/);
  });

  it('never rejects — always resolves, even on total failure', async () => {
    configure();
    const mailer = new Mailer(config);
    mailer.setTransportForTesting({
      sendMail: async () => {
        throw new Error('boom');
      }
    });
    await expect(mailer.send({ to: 'a@b.com', subject: 'Hi', text: 'Hello' })).resolves.toMatchObject({ success: false });
  });
});
