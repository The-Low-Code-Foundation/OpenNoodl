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

  /**
   * CN-019, AC4. A kit's `index.js` is opened in `'script'` mode for a parser
   * reason and the toolbar then announced it as a **SCRIPT** — the name of a
   * node the author does not have, over a file that has no ports and no
   * property panel.
   */
  describe('over a file', () => {
    it.each(['expression', 'function', 'script'] as const)(
      'does not call a file the node type whose mode parsed it (%s)',
      (mode) => {
        expect(modeLabel(mode, 'file')).toBe('JavaScript');
        // The control: the same mode in a popout still names the node.
        expect(modeLabel(mode, 'node')).not.toBe('JavaScript');
      }
    );

    it.each(['json', 'css', 'html', 'text'] as const)('leaves the languages alone (%s)', (mode) => {
      // These were never node names — a `.json` file and a JSON parameter are
      // both JSON — so a file must read exactly as the popout does.
      expect(modeLabel(mode, 'file')).toBe(modeLabel(mode, 'node'));
    });

    it('is a node by default, because that is what the four popout call sites are', () => {
      expect(modeLabel('script')).toBe('Script');
    });
  });
});

describe('defaultPlaceholder', () => {
  it('suggests something true of the mode', () => {
    expect(defaultPlaceholder('css')).toContain('CSS');
    expect(defaultPlaceholder('json')).toBe('{}');
    expect(defaultPlaceholder('text')).toBe('');
  });
});
