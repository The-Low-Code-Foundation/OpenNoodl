/**
 * BAK-006: the signed-file-URL HMAC scheme (../src/storage/signing.ts).
 */
import { signFileAccess, verifyFileAccess } from '../src/storage/signing';

const SECRET = 'test-secret-do-not-use-in-prod';

describe('signFileAccess / verifyFileAccess', () => {
  it('a freshly signed URL verifies', () => {
    const { exp, sig } = signFileAccess(SECRET, 'abc123_photo.png', 300);
    expect(verifyFileAccess(SECRET, 'abc123_photo.png', exp, sig)).toBe(true);
  });

  it('is scoped to the exact stored name — a signature for one file does not verify another', () => {
    const { exp, sig } = signFileAccess(SECRET, 'abc123_photo.png', 300);
    expect(verifyFileAccess(SECRET, 'other_file.png', exp, sig)).toBe(false);
  });

  it('rejects a tampered signature', () => {
    const { exp, sig } = signFileAccess(SECRET, 'abc123_photo.png', 300);
    const tampered = sig.slice(0, -1) + (sig.slice(-1) === 'a' ? 'b' : 'a');
    expect(verifyFileAccess(SECRET, 'abc123_photo.png', exp, tampered)).toBe(false);
  });

  it('rejects a wrong secret (e.g. after rotation)', () => {
    const { exp, sig } = signFileAccess(SECRET, 'abc123_photo.png', 300);
    expect(verifyFileAccess('a-different-secret', 'abc123_photo.png', exp, sig)).toBe(false);
  });

  it('an expired signature is refused even though the signature itself is valid', () => {
    const fixedNow = 1_000_000_000_000;
    const { exp, sig } = signFileAccess(SECRET, 'abc123_photo.png', 60, () => fixedNow);
    // Verify one second AFTER expiry.
    const afterExpiry = () => fixedNow + 61_000;
    expect(verifyFileAccess(SECRET, 'abc123_photo.png', exp, sig, afterExpiry)).toBe(false);
    // But it verifies fine right before expiry.
    const beforeExpiry = () => fixedNow + 59_000;
    expect(verifyFileAccess(SECRET, 'abc123_photo.png', exp, sig, beforeExpiry)).toBe(true);
  });

  it('rejects a missing or non-numeric exp', () => {
    expect(verifyFileAccess(SECRET, 'x', NaN, 'deadbeef')).toBe(false);
    expect(verifyFileAccess(SECRET, 'x', 123, '')).toBe(false);
  });
});
