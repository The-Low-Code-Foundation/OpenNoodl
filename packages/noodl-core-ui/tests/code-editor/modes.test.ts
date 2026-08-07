/**
 * What each editor mode is called, what it suggests when empty, and whether
 * anything checks it.
 *
 * `isValidatedType` moved here from `jsValidator.ts` when FH-017 slice 2 deleted
 * that module; these cases came with it. The claim they protect is CED-001's:
 * an editor holding CSS must not title itself EXPRESSION, and must not offer a
 * verdict — "✓ Valid" over text nobody checked is the same lie as the "✗ Error"
 * those modes used to get.
 */
import { defaultPlaceholder, isValidatedType, modeLabel } from '@noodl-core-ui/components/code-editor/utils/modes';

describe('isValidatedType', () => {
  it.each(['expression', 'function', 'script', 'json'] as const)('%s has a linter behind it', (mode) => {
    expect(isValidatedType(mode)).toBe(true);
  });

  it.each(['css', 'html', 'text'] as const)('%s is just text being held', (mode) => {
    expect(isValidatedType(mode)).toBe(false);
  });
});

describe('modeLabel', () => {
  it('names each mode as itself', () => {
    expect(modeLabel('expression')).toBe('Expression');
    expect(modeLabel('css')).toBe('CSS');
    expect(modeLabel('json')).toBe('JSON');
  });
});

describe('defaultPlaceholder', () => {
  it('suggests something true of the mode', () => {
    expect(defaultPlaceholder('css')).toContain('CSS');
    expect(defaultPlaceholder('json')).toBe('{}');
    expect(defaultPlaceholder('text')).toBe('');
  });
});
