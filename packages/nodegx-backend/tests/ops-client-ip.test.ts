/**
 * BAK-009: who the client is, behind a proxy.
 *
 * These cases are the ones that decide whether rate limits and audit origins
 * mean anything. The forged-header case in particular is not hypothetical: the
 * obvious implementation (take the leftmost `X-Forwarded-For` entry) hands an
 * attacker a fresh rate-limit bucket per request, and this service shipped that
 * implementation until now.
 */

import { clientIp, isTrustedProxy } from '../src/ops/client-ip';

function req(remoteAddress: string, headers: Record<string, unknown> = {}) {
  return { headers, socket: { remoteAddress } };
}

describe('BAK-009 client address', () => {
  describe('default trust: loopback only', () => {
    const trusted = ['loopback'];

    it('uses the socket address when there is no proxy', () => {
      expect(clientIp(req('203.0.113.9'), trusted)).toBe('203.0.113.9');
    });

    it('IGNORES a forwarded header sent by a direct (untrusted) client', () => {
      expect(clientIp(req('203.0.113.9', { 'x-forwarded-for': '1.2.3.4' }), trusted)).toBe('203.0.113.9');
    });

    it('believes the header from a loopback proxy', () => {
      expect(clientIp(req('127.0.0.1', { 'x-forwarded-for': '198.51.100.7' }), trusted)).toBe('198.51.100.7');
    });

    it('takes the RIGHTMOST untrusted hop, so a client cannot forge its own address', () => {
      // The client sent `X-Forwarded-For: 9.9.9.9`; the edge proxy appended the
      // address it actually saw. Reading left-to-right would return 9.9.9.9.
      expect(clientIp(req('127.0.0.1', { 'x-forwarded-for': '9.9.9.9, 198.51.100.7' }), trusted)).toBe('198.51.100.7');
    });

    it('normalizes IPv6-mapped IPv4 and treats ::1 as loopback', () => {
      expect(clientIp(req('::ffff:127.0.0.1', { 'x-forwarded-for': '198.51.100.7' }), trusted)).toBe('198.51.100.7');
      expect(clientIp(req('::1', { 'x-forwarded-for': '::ffff:198.51.100.7' }), trusted)).toBe('198.51.100.7');
    });

    it('falls back to the peer when the header is empty or junk', () => {
      expect(clientIp(req('127.0.0.1', { 'x-forwarded-for': '   ' }), trusted)).toBe('127.0.0.1');
      expect(clientIp(req('127.0.0.1'), trusted)).toBe('127.0.0.1');
    });

    it('reports unknown rather than guessing when there is no socket at all', () => {
      expect(clientIp({ headers: {} }, trusted)).toBe('unknown');
    });
  });

  describe('other trust settings', () => {
    it('trusts nothing when the list is empty', () => {
      expect(clientIp(req('127.0.0.1', { 'x-forwarded-for': '198.51.100.7' }), [])).toBe('127.0.0.1');
    });

    it('trusts a container-network proxy under "private"', () => {
      expect(clientIp(req('172.18.0.5', { 'x-forwarded-for': '198.51.100.7' }), ['private'])).toBe('198.51.100.7');
      // …but not under the loopback default.
      expect(clientIp(req('172.18.0.5', { 'x-forwarded-for': '198.51.100.7' }), ['loopback'])).toBe('172.18.0.5');
    });

    it('trusts a named proxy address', () => {
      expect(clientIp(req('10.0.0.8', { 'x-forwarded-for': '198.51.100.7' }), ['10.0.0.8'])).toBe('198.51.100.7');
    });

    it('walks past a chain of trusted proxies to the real client', () => {
      const headers = { 'x-forwarded-for': '198.51.100.7, 10.0.0.8, 10.0.0.9' };
      expect(clientIp(req('10.0.0.9', headers), ['private'])).toBe('198.51.100.7');
    });

    it('accepts an array-valued header (repeated header lines)', () => {
      expect(clientIp(req('127.0.0.1', { 'x-forwarded-for': ['9.9.9.9', '198.51.100.7'] }), ['loopback'])).toBe(
        '198.51.100.7'
      );
    });
  });

  describe('isTrustedProxy', () => {
    it('classifies the named sets', () => {
      expect(isTrustedProxy('127.0.0.5', ['loopback'])).toBe(true);
      expect(isTrustedProxy('192.168.1.4', ['loopback'])).toBe(false);
      expect(isTrustedProxy('192.168.1.4', ['private'])).toBe(true);
      expect(isTrustedProxy('203.0.113.1', ['private'])).toBe(false);
      expect(isTrustedProxy('203.0.113.1', ['*'])).toBe(true);
      expect(isTrustedProxy(undefined, ['*'])).toBe(false);
    });
  });
});
