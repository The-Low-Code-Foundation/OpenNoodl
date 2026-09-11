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

import * as fs from 'fs';
import * as path from 'path';

import { buildEffectiveTokens, readStoredTokens } from '../../src/editor/src/models/StyleTokensModel/ProjectTokenCss';
import {
  buildStyleVocabulary,
  renderStyleVocabulary
} from '../../src/editor/src/models/StyleTokensModel/StyleVocabulary';
import { loadDefaultCatalog } from '../../src/editor/src/validation/catalog';
import {
  conditionForInput,
  conditionIsUnsatisfied,
  resolveAgainstDefaults
} from '../../src/editor/src/validation/portConditions';

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
   * Styles the vocabulary teaches that no port can carry.
   *
   * Empty, and meant to stay that way. The eleven that were here when this gate
   * was written were resolved two ways: `fontStyle` became a port, because it
   * was a typography axis with no way to express it — the same hole `fontWeight`
   * was — and the rest were `Text` being asked to behave like a box, which it
   * deliberately is not. `code`'s tint and `blockquote`'s rule now belong to a
   * wrapping `Group`, and the variants describe only what a `Text` can be.
   */
  const KNOWN_ORPHANS: string[] = [];

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

/**
 * DSG-005 — the same gate, over the compositions.
 *
 * A composition is a longer, more confident version of a variant: a whole
 * parameter set the model is told to copy verbatim onto a node. Everything the
 * suite above exists to prevent applies to it more strongly, and two failure
 * modes are new — a `var(--token)` naming a token that does not exist (which is
 * how `--border-control` reached a shipped recipe and the doctrine), and a
 * `recipe` id pointing at a file that has been renamed or removed.
 */
describe('DSG-005 — the style vocabulary compositions', () => {
  const compositions = vocab.compositions;
  const tokenNames = new Set(Array.from(buildEffectiveTokens(readStoredTokens(null)).values()).map((t) => t.name));
  const EXAMPLES_DIR = path.resolve(__dirname, '../../../../docs/node-catalog/examples');

  it('supplies the named parameter sets the doctrine tells the model to fix', () => {
    // Doctrine §6, verbatim: "a card, a shell, a sectionHead, one primaryButton,
    // one outlineButton, and a type ramp". Before this task the instruction was
    // given and nothing supplied the sets.
    const ids = compositions.map((c) => c.id);
    for (const required of ['card', 'shell', 'sectionHead', 'primaryButton', 'outlineButton']) {
      expect(ids).toContain(required);
    }
    // The type ramp: display down to secondary text, per §3.
    const ramp = compositions.filter((c) => c.group === 'type').map((c) => c.id);
    expect(ramp).toEqual(
      expect.arrayContaining(['displayHeadline', 'sectionHeading', 'cardTitle', 'eyebrow', 'lead', 'body', 'meta'])
    );
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('names only ports the node types actually declare', () => {
    // The F22 gate. A parameter with no port is dropped at apply with a warning
    // that never blocks — so this is the only thing standing between a
    // confident-looking composition and styling that silently evaporates.
    const orphans: string[] = [];
    const unknownTypes: string[] = [];
    for (const c of compositions) {
      if (!catalog.hasType(c.nodeType)) unknownTypes.push(`${c.id}: ${c.nodeType}`);
      for (const property of Object.keys(c.parameters)) {
        if (!catalog.hasPort(c.nodeType, 'input', property)) orphans.push(`${c.id}: ${c.nodeType}.${property}`);
      }
    }
    expect(unknownTypes).toEqual([]);
    expect(orphans).toEqual([]);
  });

  it('never emits a variant or size parameter', () => {
    // Both are `allowConnectionsOnly`: setting either as a parameter is
    // discarded AND rejected. Copying the concrete parameters is the only route.
    const offenders = compositions.filter((c) => 'variant' in c.parameters || 'size' in c.parameters).map((c) => c.id);
    expect(offenders).toEqual([]);
  });

  it('references only tokens that exist, and never a raw hex or a "Npx" string', () => {
    // `--border-control` is named in the design doctrine §4 and used in
    // `ui-split-hero`, and is in neither DefaultTokens.ts nor any preset. An
    // undefined custom property makes the CSS declaration invalid, so the
    // control's border falls back to currentColor — the exact defect §4 exists
    // to prevent. This check is what stops the vocabulary repeating it.
    const problems: string[] = [];
    for (const c of compositions) {
      for (const [property, value] of Object.entries(c.parameters)) {
        if (typeof value !== 'string') continue;
        for (const match of value.matchAll(/var\((--[A-Za-z0-9-]+)\)/g)) {
          if (!tokenNames.has(match[1])) problems.push(`${c.id}.${property}: unknown token ${match[1]}`);
        }
        if (/^#[0-9a-fA-F]{3,8}$/.test(value) || /^rgba?\(/.test(value)) {
          problems.push(`${c.id}.${property}: raw colour ${value}`);
        }
        // AIB-001: `defineRegularInputProp` reads `value.value`, so a dimension
        // written as a string is dropped without a word.
        if (/^-?\d+(\.\d+)?(px|%|rem|em)$/.test(value)) {
          problems.push(`${c.id}.${property}: dimension as a string, must be { value, unit }`);
        }
      }
    }
    expect(problems).toEqual([]);
  });

  it('points at recipe ids that still exist, and inlines no graph', () => {
    // §2.2: a pointer, not a copy. A second copy of a recipe here would drift,
    // and drift in the corpus an agent imitates is phase 55's F23 again.
    const onDisk = new Set(
      fs
        .readdirSync(EXAMPLES_DIR)
        .filter((f) => f.endsWith('.json'))
        .map((f) => f.slice(0, -'.json'.length))
    );
    const missing = compositions.map((c) => c.recipe).filter((id) => !onDisk.has(id));
    expect(missing).toEqual([]);

    for (const c of compositions) {
      // A composition is a flat parameter bag for ONE node. Anything with
      // children or connections in it is an inlined graph.
      const serialized = JSON.stringify(c);
      expect(serialized).not.toContain('"children"');
      expect(serialized).not.toContain('"connections"');
    }
  });

  it('sets no parameter its own other parameters switch off — DEF-006 (a), AC2', () => {
    // The whole population, not the ones a template happens to use. A
    // composition is applied *verbatim* to a bare node of its `nodeType`, which
    // is exactly what `get_style_vocabulary` instructs, so the parameter bag it
    // ships IS the bag the condition gets answered against — with the node
    // type's port defaults under it, the way the runtime reads them.
    //
    // What this caught: `primaryButton` set `borderStyle: 'none'` and then
    // `borderWidth: 0`, and `borderWidth` is declared
    // `borderStyle = solid OR dashed OR dotted`. Applying the composition as
    // instructed produced one `inactive-conditional-parameter` per button —
    // twelve on a single generation run — so an agent obeying the design system
    // could only ignore a real diagnostic or diverge from the system. The
    // first is how a real diagnostic stops being read.
    //
    // 20 compositions, 33 conditional parameters between them, and this is the
    // number that must stay zero as compositions are added. `raised` and
    // `ruled` arrived the day before this gate did and are clean.
    const inert: string[] = [];
    for (const c of compositions) {
      const groups = catalog.declaredPortGroups(c.nodeType);
      const resolved = resolveAgainstDefaults(c.parameters, catalog.inputDefaults(c.nodeType));
      for (const property of Object.keys(c.parameters)) {
        const condition = conditionForInput(groups, property);
        if (condition && conditionIsUnsatisfied(condition, resolved)) {
          inert.push(`${c.id}: ${c.nodeType}.${property} is off under "${condition}"`);
        }
      }
    }
    expect(inert).toEqual([]);
  });

  it('has conditional parameters for that gate to be about at all', () => {
    // The check above passes just as cleanly over a composition set with no
    // conditional ports in it, and over one whose node types the catalog cannot
    // resolve. Both would be a gate measuring nothing. This is the denominator.
    let conditional = 0;
    for (const c of compositions) {
      const groups = catalog.declaredPortGroups(c.nodeType);
      for (const property of Object.keys(c.parameters)) {
        if (conditionForInput(groups, property)) conditional++;
      }
    }
    expect(conditional).toBeGreaterThan(20);
  });

  /**
   * FLD-005 (#35) — a `width` with no `sizeMode` is a Group that fills its parent.
   *
   * `Group`'s `sizeMode` defaults to `explicit` and both dimension ports default to `100%`, so
   * `layout.ts` stamps `height: 100%; flex-grow: 100` on any Group that does not say otherwise.
   * Thirteen compositions set `width` and left `sizeMode` alone, and an author copying one of them
   * verbatim into a column got a box sized by its share of the parent rather than by its content —
   * measured in `noodl-mcp/tests/fld005ColumnMultipliesOut.test.ts`: five rows of one to five lines
   * all render at exactly one fifth of a definite-height parent, and a `card` (which ships
   * `clip: true`) loses six of its ten lines off the bottom with zero validation errors.
   *
   * 🔴 There is deliberately NO exemption list. A composition that genuinely wants to fill its
   * parent says so with `sizeMode: 'explicit'` — which is what `imageGround` and `cardImage` do,
   * and both pass this check by setting the port rather than by being excused from it. If a
   * fourteenth composition ever needs to leave `sizeMode` alone, the reason belongs in this spec,
   * beside the name, where the next person reads it.
   */
  it('every composition that sets a width also sets a sizeMode', () => {
    const unsized = compositions.filter((c) => c.parameters.width !== undefined && c.parameters.sizeMode === undefined);
    expect(unsized.map((c) => c.id)).toEqual([]);
  });

  it('has width-setting compositions for that gate to be about at all', () => {
    // The denominator, for the same reason the conditional-port count above exists: the check
    // passes just as cleanly over a composition set in which nothing sets `width`.
    const widthSetters = compositions.filter((c) => c.parameters.width !== undefined);
    expect(widthSetters.length).toBeGreaterThanOrEqual(13);
    // And the `sizeMode` values must be ones the port actually defines, or the check above is
    // satisfied by a typo.
    const declared = new Set(['explicit', 'contentHeight', 'contentWidth', 'contentSize']);
    for (const c of widthSetters) expect(declared.has(String(c.parameters.sizeMode))).toBe(true);
  });

  it('renders every composition into the prompt block, terse and by name', () => {
    const block = renderStyleVocabulary(vocab);
    expect(block).toContain('COMPOSITIONS');
    for (const c of compositions) {
      expect(block).toContain(`- ${c.id} (${c.nodeType}) [${c.recipe}]`);
    }
    // The budget: one line per composition plus one header per group. Not a
    // document — the descriptions stay in detail:"full".
    const compositionLines = block.split('\n').filter((l) => l.startsWith('- ') && / \[ui-/.test(l));
    expect(compositionLines.length).toBe(compositions.length);
    for (const c of compositions) expect(block).not.toContain(c.description);
  });
});
