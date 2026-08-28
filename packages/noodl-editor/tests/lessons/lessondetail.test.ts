/**
 * SYL-001 — the step's hand-holding half.
 *
 * ## What these specs are guarding
 *
 * Two things, and the second is the one that is easy to skip.
 *
 * 1. That `detail` **renders**. The format already contains a field that does not
 *    (`suggestedNodes` → `data-suggested-nodes` → `LessonModel.getCurrentSuggestedNodes`, which
 *    has no callers), and a dead field is indistinguishable from a live one if you only assert
 *    that the type accepts the key. So every claim below is made against **compiled output**.
 *
 * 2. That a step **without** `detail` did not move. A change to `compileStep` touches every
 *    lesson ever authored; "the new field renders" is perfectly compatible with "and every other
 *    step's HTML changed too". The byte-identical control is the only thing that excludes it, and
 *    it is written first for that reason.
 */

import { compileLessonManifest, compileStep } from '../../src/editor/src/models/lessonformat';
import { urlsInStep, verifyLessonManifest } from '../../src/editor/src/models/lessonverify';

const DETAIL = 'The node picker is the **+** in the top left.';

describe('SYL-001 — a step with no detail is unchanged', () => {
  /**
   * 🔴 THE CONTROL, AND IT IS FIRST ON PURPOSE. These are the exact strings `compileStep`
   * produced before the field existed. If a later change to the disclosure leaks into steps that
   * do not use it, this is what says so — and it says so in terms of the whole corpus, not of one
   * fixture.
   */
  it('a card step compiles byte-identically to the pre-SYL-001 shape', () => {
    const html = compileStep({ title: 'Add a Group', body: 'Drag a **Group** onto the page.' }, 0);
    expect(html).toBe(
      '<div><div data-template="item"><header>&nbsp;</header><h3>Add a Group</h3></div>' +
        '<div data-template="popup"><p>Drag a <strong>Group</strong> onto the page.</p></div></div>'
    );
    expect(html).not.toContain('<details');
  });

  it('a popup step compiles byte-identically to the pre-SYL-001 shape', () => {
    expect(compileStep({ kind: 'popup', body: 'Welcome.' }, 0)).toBe(
      '<div data-template="popup"><p>Welcome.</p></div>'
    );
  });

  it('a step with an empty-string detail emits no disclosure at all', () => {
    // An empty detail is an author who deleted the text but left the key. It must be treated as
    // absent, not as an empty disclosure the learner can open onto nothing.
    const html = compileStep({ title: 'Add a Group', body: 'Drag it.', detail: '' }, 0);
    expect(html).not.toContain('<details');
    expect(html).toBe(compileStep({ title: 'Add a Group', body: 'Drag it.' }, 0));
  });
});

describe('SYL-001 — a step with detail renders a disclosure', () => {
  it('emits an open <details> after the body, inside the popup', () => {
    const html = compileStep({ title: 'Add a Group', body: 'Drag it.', detail: DETAIL }, 0);

    expect(html).toContain('<details class="lesson-detail" open>');
    expect(html).toContain('<summary>Show me how</summary>');
    // Rendered as Markdown on the same path as the body — not pasted in raw.
    expect(html).toContain('<p>The node picker is the <strong>+</strong> in the top left.</p>');
    // After the body, so the instruction is read first.
    expect(html.indexOf('<p>Drag it.</p>')).toBeLessThan(html.indexOf('<details'));
    // Inside the popup, not loose in the wrapper or on the timeline card.
    expect(html).toMatch(/<div data-template="popup">.*<details[\s\S]*<\/details><\/div>/);
  });

  it('renders on a popup step too', () => {
    const html = compileStep({ kind: 'popup', body: 'Welcome.', detail: DETAIL }, 0);
    expect(html).toContain('<details class="lesson-detail" open>');
  });

  it('a detail-only step still gets a popup to put it in', () => {
    // Malformed authoring, but it must not silently drop the only prose the step has.
    const html = compileStep({ title: 'Add a Group', detail: DETAIL }, 0);
    expect(html).toContain('data-template="popup"');
    expect(html).toContain('<details');
  });

  /**
   * 🔴 Escaping is asserted against output, not inferred from the fact that `renderDetail` calls
   * `renderMarkdown`. The call site can be re-plumbed; this cannot pass if it is.
   */
  it('escapes HTML in the detail exactly as it does in the body', () => {
    const evil = '<script>alert(1)</script>';
    const viaDetail = compileStep({ title: 't', detail: evil }, 0);
    const viaBody = compileStep({ title: 't', body: evil }, 0);

    expect(viaDetail).not.toContain('<script>');
    expect(viaDetail).toContain('&lt;script&gt;');
    // Same treatment, not merely "some treatment".
    expect(viaDetail).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(viaBody).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
  });

  it('carries the authored detail through stepSources, exactly', () => {
    const compiled = compileLessonManifest({
      steps: [{ title: 'Add a Group', body: 'Drag it.', detail: DETAIL }]
    });
    expect(compiled.stepSources?.[0]).toEqual({ title: 'Add a Group', body: 'Drag it.', detail: DETAIL });
  });
});

/**
 * 🔴 THE PAIR. A refused URL scheme is handled in two places on purpose: the verifier TELLS the
 * author, and the renderer DROPS it. `urlsInStep` walked `['title', 'body']` only, so before this
 * task a `javascript:` href in a detail was silently neutralised and never reported — the author
 * left with a link that stopped working and no finding explaining it.
 *
 * Proving one half proves half. Both are asserted here, in one place, so neither can be removed
 * on the grounds that "the other one covers it".
 */
describe('SYL-001 — an unsafe URL in a detail is both reported and dropped', () => {
  const step = { title: 'Add a Group', body: 'Drag it.', detail: '[click me](javascript:alert)' };

  it('urlsInStep finds it, attributed to the detail field', () => {
    const found = urlsInStep(step);
    const fromDetail = found.filter((f) => f.field === 'detail');

    expect(fromDetail.length).toBe(1);
    expect(fromDetail[0]).toEqual({ field: 'detail', url: 'javascript:alert', kind: 'link' });
  });

  it('verifyLessonManifest reports it as an error, naming the detail field', () => {
    const report = verifyLessonManifest({ title: 'x', steps: [step] });
    const unsafe = report.findings.filter((f) => f.code === 'unsafe-url');

    expect(unsafe.length).toBe(1);
    expect(unsafe[0].severity).toBe('error');
    expect(unsafe[0].value).toBe('javascript:alert');
    // The author has to be told WHICH field, or they are hunting through a step for a link the
    // finding declined to point at.
    expect(unsafe[0].where).toContain('detail');
    expect(report.ok).toBe(false);
  });

  it('and the compiler drops the href while keeping the words', () => {
    const html = compileStep(step, 0);
    expect(html).not.toContain('javascript:');
    expect(html).toContain('click me');
  });

  it('a SAFE url in a detail is neither reported nor stripped — the negative control', () => {
    // Without this row, the two specs above are also satisfied by a verifier that flags every
    // link and a compiler that strips every href.
    const safe = { title: 'Add a Group', detail: '[the docs](https://example.com/x)' };
    const report = verifyLessonManifest({ title: 'x', steps: [safe] });
    expect(report.findings.filter((f) => f.code === 'unsafe-url').length).toBe(0);
    expect(compileStep(safe, 0)).toContain('<a href="https://example.com/x">the docs</a>');
  });
});
