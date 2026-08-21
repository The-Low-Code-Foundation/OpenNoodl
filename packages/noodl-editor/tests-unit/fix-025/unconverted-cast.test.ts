/**
 * FIX-025 — a wire the editor permits but the runtime does not convert is reported.
 *
 * Richard: *"I set a value input as type 'number', then connected a string connector to that
 * input, and the visual function node didn't throw an error... when the connector is deffo a
 * wrong type it should say so."*
 */
import { portTypeName, unconvertedCast } from '../../src/editor/src/models/nodegraphmodel/connectionCoercion';

describe('unconvertedCast', () => {
  it('🔴 reports the reported case: string into a number port', () => {
    const found = unconvertedCast('string', 'number');
    expect(found).not.toBeNull();
    expect(found?.consequence).toMatch(/not converted to a number/);
  });

  it('🔴 reports string into boolean, and names the "false" trap', () => {
    expect(unconvertedCast('string', 'boolean')?.consequence).toMatch(/“false”/);
  });

  it('says nothing about casts the runtime actually performs', () => {
    // Both directions are converted — JSON.stringify out, parse in. See PORT-TYPE-CONTRACT.md.
    expect(unconvertedCast('string', 'object')).toBeNull();
    expect(unconvertedCast('object', 'string')).toBeNull();
    expect(unconvertedCast('array', 'string')).toBeNull();
  });

  it('🔴 says nothing about number/boolean into string — JS renders both, so nothing surprising happens', () => {
    expect(unconvertedCast('number', 'string')).toBeNull();
    expect(unconvertedCast('boolean', 'string')).toBeNull();
  });

  it('says nothing when either end is unknown, or the types match', () => {
    expect(unconvertedCast('*', 'number')).toBeNull();
    expect(unconvertedCast('string', '*')).toBeNull();
    expect(unconvertedCast('number', 'number')).toBeNull();
    expect(unconvertedCast(null, 'number')).toBeNull();
    expect(unconvertedCast('string', undefined)).toBeNull();
  });

  it('accepts both port-type shapes the graph uses', () => {
    expect(portTypeName({ name: 'Number' })).toBe('number');
    expect(portTypeName('String')).toBe('string');
    expect(unconvertedCast({ name: 'string' }, { name: 'number' })).not.toBeNull();
  });

  it('⚠️ a genuinely refused pair is NOT this warning — the existing error owns it', () => {
    // `image -> number` is not in the typecasts table at all, so `canCastPortTypes` refuses it
    // and `con-type-mismatch` fires. This must stay quiet or the same wire gets two messages.
    expect(unconvertedCast('image', 'number')).toBeNull();
  });
});
