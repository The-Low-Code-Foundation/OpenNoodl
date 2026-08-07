/**
 * NDA-012 (Visual), check `D1` — the three bare-string contracts of remediation stream D.
 *
 * `D1` asks whether a port whose contract is carried in a *string* validates that string. Three
 * of the category's four `D1` cells are here; the fourth (`Repeater`'s `templateScript`) is in
 * `nda-012-visual-deployed-diagnosis.test.ts`, because its remedy is a raise rather than a
 * parse and it belongs beside the other two raises on that node.
 *
 * ⚠️ **Two of the three cells recorded the wrong consequence, and both were re-derived here
 * before anything was changed.**
 *
 * - `Columns` was filed as "`'1 a 1'` yields a `NaN` column". It does not, and has not since
 *   NDA-006's autofold pass added a `Number.isFinite` filter to `parseLayout` — the entry is
 *   **dropped**, so three authored columns render as two with nothing said. The defect outlived
 *   the fix that changed its symptom, which is why the cell reads wrong today.
 * - `Page Router` was filed as "decoded twice and by two different rules". The sharp end is
 *   that the second decode **throws**: `decodeURIComponent` raises `URIError` on the output
 *   `decodeURI` produces for an encoded `%`, so a page parameter containing a percent sign took
 *   the router's whole match down.
 *
 * That is the `DV-ii` rule applied twice: **grep the mechanism, do not trust the recorded
 * consequence.**
 */

/* eslint-env jest */

import { parseLayout, readLayoutToken } from '../../src/components/visual/Columns/Columns';
import { describeLayoutString } from '../../src/nodes/visual/columns';
import { toUrlPathSegment } from '../../src/nodes/navigation/page';

describe('D1-a — Columns reports the entries its layout string loses', () => {
  // The mechanism, pinned first: this is what the cell should have said.
  it('drops an unreadable entry rather than rendering NaN — the cell recorded the pre-NDA-006 symptom', () => {
    expect(parseLayout('1 a 1')).toEqual([1, 1]);
    expect(parseLayout('1 a 1')).not.toContain(NaN);
  });

  it('says how many columns were authored and how many render', () => {
    const problem = describeLayoutString('1 a 1');
    expect(problem).toContain('"a"');
    expect(problem).toContain('3 columns were authored and 2 are rendered');
  });

  it('names every unreadable entry, not just the first', () => {
    const problem = describeLayoutString('1 a b 2');
    expect(problem).toContain('"a"');
    expect(problem).toContain('"b"');
    expect(problem).toContain('4 columns were authored and 2 are rendered');
  });

  it('reports the whole-string case separately, because the fallback is different', () => {
    expect(describeLayoutString('a b c')).toContain('none of its 3 entries');
    expect(parseLayout('a b c')).toEqual([1]);
  });

  // The control. A layout string that loses nothing must produce no diagnosis at all — without
  // this row the validator could report unconditionally and every row above would still pass.
  it('says nothing about a layout string that loses nothing', () => {
    expect(describeLayoutString('1 2 1')).toBeUndefined();
    expect(describeLayoutString('1 2.5 1')).toBeUndefined();
  });

  // A double space is not a mistake — `parseLayout` has always dropped the empty entry, and
  // reporting it would train authors to ignore the message.
  it('treats a double space as whitespace rather than a lost column', () => {
    expect(describeLayoutString('1  2')).toBeUndefined();
    expect(parseLayout('1  2')).toEqual([1, 2]);
  });

  it('accepts fractional proportions instead of truncating them', () => {
    // `parseInt` read '2.5' as 2, so a 1 : 2.5 : 1 layout silently rendered as 1 : 2 : 1.
    expect(parseLayout('1 2.5 1')).toEqual([1, 2.5, 1]);
  });

  // `parseFloat` reads a *prefix*, so it would turn '1abc' into 1 — the same silent coercion one
  // layer down, and it would disagree with the validator about whether anything was lost.
  it('does not read a number out of the front of a word', () => {
    expect(readLayoutToken('1abc')).toBeUndefined();
    expect(describeLayoutString('1 1abc')).toContain('"1abc"');
  });

  it('rejects zero and negative proportions, which cannot size a column', () => {
    expect(readLayoutToken('0')).toBeUndefined();
    expect(readLayoutToken('-2')).toBeUndefined();
  });
});

describe('D1-b — Page proposes a URL path that is a URL', () => {
  // The reported case, verbatim from the worksheet.
  it('sanitises the delimiters out of a derived default', () => {
    expect(toUrlPathSegment('Order #1 & Co')).toBe('order-1-co');
  });

  it('leaves an already-clean title alone apart from case and spaces', () => {
    expect(toUrlPathSegment('My Page')).toBe('my-page');
    expect(toUrlPathSegment('Products')).toBe('products');
  });

  it('removes every character that would end the path or start a query', () => {
    // `#` starts the fragment — and the hash router puts the entire route after one already —
    // while `?` and `&` delimit the query. These are the ones that silently truncate a route.
    for (const delimiter of ['#', '?', '&', '/', ' ', '%', ':', '@', '+', '=']) {
      expect(toUrlPathSegment(`a${delimiter}b`)).toBe('a-b');
    }
  });

  it('collapses runs and trims the ends rather than leaving bare separators', () => {
    expect(toUrlPathSegment('Home  Page')).toBe('home-page');
    expect(toUrlPathSegment('  Spaced  ')).toBe('spaced');
    expect(toUrlPathSegment('!!!')).toBe('');
  });

  // ⚠️ The control that changed the implementation. An allow-list of `[a-z0-9]` passes every row
  // above and turns `Über Café` into `ber-caf`, deleting most of a title that percent-encodes
  // perfectly well. Non-ASCII is kept.
  it('keeps non-ASCII letters instead of deleting them', () => {
    expect(toUrlPathSegment('Über Café')).toBe('über-café');
    expect(toUrlPathSegment('日本語')).toBe('日本語');
  });
});
