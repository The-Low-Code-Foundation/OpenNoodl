/**
 * Every style the vocabulary teaches must name a port that exists.
 *
 * `get_style_vocabulary` is the one document an authoring model is given about
 * how this design system is expressed, and `variantStyles`/`sizeStyles` are its
 * worked examples — the model inlines them close to character-for-character.
 * So a property in there that is not a port is not a small documentation slip:
 * it is styling the model will confidently emit and the runtime will silently
 * drop, with a clean validation report at the end of it.
 *
 * This has now happened twice. `boxShadow` and the `padding` shorthand were
 * removed in f62877b9 after an authored page came out with no cards; the same
 * pass left `fontWeight` in place, and it was the biggest one — nine weight
 * tokens, four Inter faces and a `fontWeight` on every variant, against a
 * runtime that had no such port, so every word of an authored page rendered at
 * 400. Both were found by looking at a screenshot, months apart.
 *
 * A hand-maintained list of special cases in `toPortParameters` cannot stop the
 * third one. This can: it is the catalog, not a reviewer, deciding what the
 * vocabulary is allowed to say.
 */

import { buildStyleVocabulary } from '../../src/editor/src/models/StyleTokensModel/StyleVocabulary';
import { loadDefaultCatalog } from '../../src/editor/src/validation/catalog';

const catalog = loadDefaultCatalog();
const vocab = buildStyleVocabulary();

/** Every (nodeType, styleName) pair the vocabulary hands a model. */
function taughtStyles(): Array<{ nodeType: string; group: string; name: string; property: string; value: string }> {
  const out = [];
  for (const element of vocab.elements) {
    for (const [variant, styles] of Object.entries(element.variantStyles)) {
      for (const [property, value] of Object.entries(styles)) {
        out.push({ nodeType: element.nodeType, group: 'variant', name: variant, property, value });
      }
    }
    for (const [size, styles] of Object.entries(element.sizeStyles)) {
      for (const [property, value] of Object.entries(styles)) {
        out.push({ nodeType: element.nodeType, group: 'size', name: size, property, value });
      }
    }
  }
  return out;
}

describe('the style vocabulary against the catalog', () => {
  const styles = taughtStyles();

  it('has something to check', () => {
    expect(vocab.elements.length).toBeGreaterThan(0);
    expect(styles.length).toBeGreaterThan(20);
  });

  /**
   * Styles the vocabulary teaches that no port can carry — filed, not fixed.
   *
   * All of them are `Text` being asked to behave like a box. `Text` in this
   * runtime deliberately is not one: it has no background, no padding and no
   * border, and a boxed piece of text is a `Text` inside a `Group`. So the
   * `code` and `blockquote` variants describe something the node cannot be,
   * and `fontStyle` (italic) is a typography axis with no port at all — the
   * same shape of hole `fontWeight` was.
   *
   * Whether the repair is to give `Text` those ports or to change what the
   * variants claim is a design-system decision, not a test's. What this list
   * does is stop a *new* one appearing unnoticed, which is how all three
   * previous instances got in.
   */
  const KNOWN_ORPHANS = [
    'Text.backgroundColor',
    'Text.borderLeftColor',
    'Text.borderLeftStyle',
    'Text.borderLeftWidth',
    'Text.borderRadius',
    'Text.fontStyle',
    'Text.paddingBottom',
    'Text.paddingLeft',
    'Text.paddingRight',
    'Text.paddingTop',
    'net.noodl.controls.button.textDecoration'
  ];

  it('names only ports the node types actually declare', () => {
    const orphans = styles
      .filter(({ nodeType }) => catalog.hasType(nodeType))
      .filter(({ nodeType, property }) => !catalog.hasPort(nodeType, 'input', property))
      .map(({ nodeType, property }) => `${nodeType}.${property}`);

    expect([...new Set(orphans)].sort()).toEqual(KNOWN_ORPHANS);
  });

  it('keeps the known-orphan list honest — every entry is still orphaned', () => {
    // A list like this rots into a lie the moment a port is added. When one is,
    // this fails and the entry comes out.
    const stillMissing = KNOWN_ORPHANS.filter((entry) => {
      const property = entry.slice(entry.lastIndexOf('.') + 1);
      const nodeType = entry.slice(0, entry.lastIndexOf('.'));
      return !catalog.hasPort(nodeType, 'input', property);
    });
    expect(stillMissing).toEqual(KNOWN_ORPHANS);
  });

  it('speaks about node types the catalog knows', () => {
    const unknown = vocab.elements.map((e) => e.nodeType).filter((t) => !catalog.hasType(t));
    expect(unknown).toEqual([]);
  });

  it('still teaches a weight, now that a port can carry one', () => {
    // The regression that started this: dropping `fontWeight` from the
    // vocabulary would also have made the check above pass.
    const weights = styles.filter((s) => s.property === 'fontWeight');
    expect(weights.length).toBeGreaterThan(0);
    for (const w of weights) expect(w.value).toMatch(/^var\(--font-/);
  });
});
