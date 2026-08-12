/**
 * LGC-001 — the content half of "three ways to compute, and the picker says which".
 *
 * The task's failure was recorded on video: a test user typed the arithmetic
 * words he knew into the node picker and got nothing, then said he wanted to
 * build his functions visually while the node that does exactly that sat in his
 * picker under a name that told him nothing.
 *
 * Everything the fix needs lives in this package — the three node definitions
 * and the curated picker index — so it can be graded here, in a plain-Node
 * runner, rather than only by opening the editor and typing. What *cannot* be
 * graded here is the picker's ranking arithmetic, which is editor code; that
 * has its own spec in `noodl-editor/tests/nodepicker/NodePickerSearch.test.ts`.
 *
 * Three things are pinned:
 *
 *  1. every intercept term reaches all three nodes (§1);
 *  2. `Logic Builder`'s **type id is frozen** while its label changed (§3) —
 *     the id is in every saved project and is what the docs-site path is slugged
 *     from, so the freeze is the criterion, not a nicety;
 *  3. the Logic category lists the three in the order the picker must answer in
 *     (§4), because a tag match is ranked by that order and by nothing else.
 */

/* eslint-env jest */

import ExpressionModule = require('../src/nodes/std-library/expression');
import LogicBuilderModule = require('../src/nodes/std-library/logic-builder');
import SimpleJavascriptModule = require('../src/nodes/std-library/simplejavascript');

import generateNodeLibrary = require('../src/nodelibraryexport');
import { ARITHMETIC_SEARCH_TAGS } from '../src/nodes/std-library/logic-search-tags';

/** The three definitions, keyed by the type id the rest of the product uses. */
const TRIAD = {
  Expression: ExpressionModule.node,
  'Logic Builder': LogicBuilderModule.node,
  JavaScriptFunction: SimpleJavascriptModule.node
};

/**
 * The picker's own matcher, restated: a term matches a tag when the tag
 * *contains* it (`NodePicker.search.ts`, `matchNode`). Restated rather than
 * imported because that file is in another package and reaches editor code; the
 * one line it shares with this suite is asserted against the real definitions
 * below, and the editor's own spec grades the real function.
 */
function tagsAnswering(node: { searchTags?: string[] }, term: string): string[] {
  const lower = term.toLowerCase();
  return (node.searchTags || []).filter((tag) => String(tag).toLowerCase().includes(lower));
}

/** Every type name the picker offers, in the curated index's order. */
function pickerItems(): string[] {
  const library = generateNodeLibrary({ _constructors: {} }) as {
    nodeIndex: { coreNodes: Array<{ name: string; subCategories: Array<{ items: string[] }> }> };
  };

  const items: string[] = [];
  library.nodeIndex.coreNodes.forEach((category) => {
    category.subCategories.forEach((sub) => sub.items.forEach((item) => items.push(item)));
  });
  return items;
}

function categoryNamed(name: string) {
  const library = generateNodeLibrary({ _constructors: {} }) as {
    nodeIndex: { coreNodes: Array<{ name: string; subCategories: Array<{ name: string; items: string[] }> }> };
  };
  return library.nodeIndex.coreNodes.find((category) => category.name === name);
}

describe('LGC-001 §1 — the arithmetic vocabulary reaches all three ways to compute', () => {
  /**
   * The words from the acceptance criteria, written out here rather than read
   * from `ARITHMETIC_SEARCH_TAGS`. Reading the list would make this row assert
   * that the list matches itself; the criteria are the independent statement.
   */
  const TERMS = [
    'add',
    'subtract',
    'multiply',
    'divide',
    'round',
    'ceil',
    'floor',
    'sum',
    'average',
    'percent',
    '%',
    'math',
    'calculate',
    'formula',
    'equation'
  ];

  for (const term of TERMS) {
    it(`"${term}" is answered by Expression, Visual Function and Function`, () => {
      const unanswered = Object.entries(TRIAD)
        .filter(([, node]) => tagsAnswering(node, term).length === 0)
        .map(([typeName]) => typeName);

      expect(unanswered).toEqual([]);
    });
  }

  /**
   * The control, and it is the point of the row above being a loop rather than
   * one `toEqual` on the whole tag list. "Every term is answered" passes just as
   * happily if the tag list is a bag of every word in the language, which would
   * put all three nodes under every search in the editor. A term that must
   * **not** match is what makes the loop above discriminating.
   */
  it('does not answer words the triad has nothing to do with', () => {
    for (const term of ['router', 'password', 'shadow', 'websocket']) {
      for (const [typeName, node] of Object.entries(TRIAD)) {
        expect([typeName, term, tagsAnswering(node, term)]).toEqual([typeName, term, []]);
      }
    }
  });

  it('shares one list rather than three copies, so a node cannot drift out of the answer set', () => {
    for (const [typeName, node] of Object.entries(TRIAD)) {
      const missing = ARITHMETIC_SEARCH_TAGS.filter((tag) => !(node.searchTags || []).includes(tag));
      expect([typeName, missing]).toEqual([typeName, []]);
    }
  });

  it('keeps each node\'s pre-existing tags — the vocabulary is added, not swapped in', () => {
    expect(TRIAD.Expression.searchTags).toContain('javascript');
    expect(TRIAD.JavaScriptFunction.searchTags).toContain('javascript');
    expect(TRIAD['Logic Builder'].searchTags).toEqual(
      expect.arrayContaining(['blockly', 'visual', 'logic', 'blocks', 'nocode'])
    );
  });
});

describe('LGC-001 §3 — the label changed and the type id did not', () => {
  /**
   * ⚠️ The criterion, stated as its own row because everything else in this file
   * would still pass if the id moved. `name` is the string in every saved
   * `project.json`, in `node-catalog.json`, in `node-catalog-enriched.json`, in
   * `docs/node-catalog/enrichment/logic-builder.json`, in the example
   * `code-logic-builder-greeting.json`, and it is what `generate-node-docs.js`
   * slugs into `docs-site/docs/nodes/custom-code/logic-builder.md`. A rename is
   * a migration and phase 59 does not do one.
   */
  it('freezes `name: "Logic Builder"`', () => {
    expect(TRIAD['Logic Builder'].name).toBe('Logic Builder');
  });

  it('labels it "Visual Function"', () => {
    expect(TRIAD['Logic Builder'].displayNodeName).toBe('Visual Function');
  });

  it('leaves the JavaScript Function node alone — Richard ruled out renaming it', () => {
    expect(TRIAD.JavaScriptFunction.name).toBe('JavaScriptFunction');
    expect(TRIAD.JavaScriptFunction.displayNodeName).toBe('Function');
  });

  it('offers the node under its frozen id, so the picker still reaches it', () => {
    expect(pickerItems()).toContain('Logic Builder');
  });

  /**
   * `searching "function" returns both` is an acceptance criterion, and after
   * the rename it is satisfied by the *label* rather than by a tag: the picker
   * matches on `displayNodeName`, "Visual Function" contains "function" at
   * offset 7, and "Function" contains it at offset 0. A name match ranks by that
   * offset, so the Function node still leads its own name.
   */
  it('makes "function" a name match on both, with the Function node leading', () => {
    const offset = (label: string) => label.toLowerCase().indexOf('function');

    expect(offset(TRIAD.JavaScriptFunction.displayNodeName)).toBe(0);
    expect(offset(TRIAD['Logic Builder'].displayNodeName)).toBeGreaterThan(0);
  });
});

describe('LGC-001 §4 — the rail category is a choice, not an implementation word', () => {
  it('reads "Logic", and "Custom Code" is gone from the index', () => {
    expect(categoryNamed('Logic')).toBeDefined();
    expect(categoryNamed('Custom Code')).toBeUndefined();
  });

  /**
   * ⚠️ Load-bearing, not cosmetic. The picker ranks a tag match by the node's
   * position in this list (`NodePicker.search.ts`, `withLibraryOrder`), so this
   * order *is* the answer order for every arithmetic term: the cheapest correct
   * answer for `price * quantity` first, and the node that is the wrong tool for
   * a one-liner last.
   */
  it('lists Expression → Visual Function → Function, which is the answer order', () => {
    const items = categoryNamed('Logic').subCategories[0].items;
    const triadOrder = items.filter((name) => name in TRIAD);

    expect(triadOrder).toEqual(['Expression', 'Logic Builder', 'JavaScriptFunction']);
  });

  /**
   * Recorded, not celebrated. The spec wanted the category to hold *the three*;
   * it still holds two more, and moving them is a taxonomy change rather than a
   * display string, so LGC-001 left them. This row exists so that whoever
   * resolves the Register's open question sees a red spec rather than having to
   * remember the question existed.
   */
  it('still holds Script and CSS Definition — the open half of §4', () => {
    expect(categoryNamed('Logic').subCategories[0].items).toEqual([
      'Expression',
      'Logic Builder',
      'JavaScriptFunction',
      'Javascript2',
      'CSS Definition'
    ]);
  });
});
