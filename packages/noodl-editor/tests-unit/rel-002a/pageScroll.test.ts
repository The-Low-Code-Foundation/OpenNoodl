/**
 * REL-002a — a page in an app that cannot scroll.
 *
 * 🔴 **The three-state option is the whole rule**, so most of these arms are silences. The row this
 * comes from blamed `sizeMode`, `scrollEnabled` and `clip`; six rendered arms, one parameter apart,
 * showed none of them changes the answer and the project setting is the only thing that does (see
 * the module header). What is left to grade here is therefore not a layout predicate — it is
 * whether "the caller cannot say", "the project has not decided" and "the project decided" stay
 * three different answers, because collapsing any two of them is how this rule would start
 * reporting a deliberate fixed-viewport app, or stop reporting anything at all.
 *
 * The corpus is why `null` is the finding and `false` is not: **187 projects, 143 with a Page — 76
 * set `bodyScroll: true`, 67 leave it unset, and zero set it false.**
 */
import { checkPageScroll } from '../../src/editor/src/validation/pageScroll';

type Node = { id: string; type: string; label?: string; parameters?: Record<string, unknown> };

const page = (): Node[] => [
  { id: 'page', type: 'Page', label: 'Setup', parameters: { title: 'Setup', urlPath: 'setup' } },
  { id: 'ground', type: 'Group', parameters: { flexDirection: 'column' } },
  { id: 'field', type: 'net.noodl.controls.textinput', parameters: {} }
];

const run = (nodes: Node[], bodyScroll?: boolean | null) =>
  checkPageScroll(nodes, { component: '/Pages/Setup', bodyScroll });

describe('the three states stay three answers', () => {
  it('reports a page when the project has NOT decided (null)', () => {
    const d = run(page(), null);
    expect(d).toHaveLength(1);
    expect(d[0].code).toBe('page-cannot-scroll');
    expect(d[0].severity).toBe('warning');
    expect(d[0].location.nodeId).toBe('page');
    expect(d[0].location.component).toBe('/Pages/Setup');
  });

  it('is silent when the project chose to scroll', () => {
    expect(run(page(), true)).toEqual([]);
  });

  it('is silent when the project deliberately chose a fixed viewport', () => {
    // Zero corpus projects do this, but it is a real choice and a rule that reported it would be
    // telling an author their own decision is a defect.
    expect(run(page(), false)).toEqual([]);
  });

  it('is silent when the caller cannot read project settings (undefined)', () => {
    // 🔴 Not the same as `null`. `undefined` is "do not check" — the convention `backend`,
    // `urlPaths` and `security` all follow. A caller that guesses here reports every project whose
    // root it cannot see.
    expect(run(page(), undefined)).toEqual([]);
    expect(run(page())).toEqual([]);
  });
});

describe('what counts as a page', () => {
  it('says nothing about a component with no Page node, however tall', () => {
    // A row component, a cloud function, a plain group: the setting is still unset and still
    // wrong, but the author is not standing on a page and cannot act on it here. One sentence per
    // page, not one per component, is what keeps this from being noise.
    const rowComponent: Node[] = [
      { id: 'row', type: 'Group', parameters: { flexDirection: 'row' } },
      { id: 'name', type: 'Text', parameters: { text: 'Ada' } }
    ];
    expect(checkPageScroll(rowComponent, { component: '/Members/MemberRow', bodyScroll: null })).toEqual([]);
  });

  it('reports once, not once per node, on a page carrying many nodes', () => {
    const many: Node[] = [
      { id: 'page', type: 'Page', parameters: { urlPath: 'long' } },
      ...Array.from({ length: 30 }, (_, i) => ({ id: 'row' + i, type: 'Text', parameters: { text: 'x' } }))
    ];
    expect(run(many, null)).toHaveLength(1);
  });

  it('reports the FIRST Page node when a component somehow carries two', () => {
    const two: Node[] = [
      { id: 'pageA', type: 'Page', parameters: { urlPath: 'a' } },
      { id: 'pageB', type: 'Page', parameters: { urlPath: 'b' } }
    ];
    const d = run(two, null);
    expect(d).toHaveLength(1);
    expect(d[0].location.nodeId).toBe('pageA');
  });
});

describe('the message and the exit', () => {
  it('names the mechanism rather than guessing at this page height', () => {
    // It cannot know the page IS too tall — that depends on the viewport, the data and the fonts.
    // It knows the app has no way to scroll if it ever is, which is true whatever the page holds.
    const [d] = run(page(), null);
    expect(d.message).toContain('bodyScroll');
    expect(d.message).toContain('overflow: clip');
    expect(d.message).not.toMatch(/\d+px/);
  });

  it('warns the author OFF the fix that does not work', () => {
    // 🔴 Measured: `scrollEnabled: true` on the page's root Group leaves the last row of a 20-row
    // page exactly as unreachable as leaving it off. An author sent to that port would spend the
    // change and get nothing, and would then believe the setting is not the problem.
    const [d] = run(page(), null);
    expect(d.suggestion).toContain('scrollEnabled');
    expect(d.suggestion).toContain('NOT the same fix');
    expect(d.suggestion).toContain('bodyScroll: true');
  });
});
