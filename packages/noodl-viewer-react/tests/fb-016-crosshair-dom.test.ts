import type { ComputedReader } from '../src/box-model-overlay';
import { TransformOriginCrosshair } from '../src/transform-origin-crosshair';

/**
 * FB-016 scope 4 — the crosshair's DOM, for the claims jsdom can actually settle.
 *
 * ⚠️ **jsdom has no layout, so nothing here grades a position.** Every rect is zero and every
 * computed style is an initial value; where the arms land on screen is graded arithmetically in
 * `fb-016-transform-origin-crosshair.test.ts` and observed in a drive. What jsdom can settle is
 * structural — and both of these have bitten this repo before:
 *
 * - AC3 — nothing the overlay adds may become a hit-test target. The Inspector's whole design is
 *   capture-phase listeners on `document`, and a crosshair arm stretched across the element it
 *   describes is a particularly good way to swallow the click that selects it.
 * - the label renders a declaration the *author* wrote, and it must render it as text.
 *
 * ⚠️ `jest-environment-jsdom` is not in this package's tree, so jsdom is constructed directly and
 * its globals installed, exactly as `fb-016-overlay-dom.test.ts` already does it here.
 */
/* eslint-disable @typescript-eslint/no-var-requires */
const { JSDOM } = require('jsdom');
const dom = new JSDOM('<!doctype html><html><body></body></html>');
(globalThis as never as Record<string, unknown>).window = dom.window;
(globalThis as never as Record<string, unknown>).document = dom.window.document;
(globalThis as never as Record<string, unknown>).HTMLElement = dom.window.HTMLElement;

function stubStyle(declarations: Record<string, string>): ComputedReader {
  return { getPropertyValue: (property: string) => declarations[property] || '' };
}

describe('the crosshair’s DOM', () => {
  let host: HTMLDivElement;
  let crosshair: TransformOriginCrosshair;

  beforeEach(() => {
    host = document.createElement('div');
    document.body.appendChild(host);
    crosshair = new TransformOriginCrosshair(host);
  });

  afterEach(() => {
    crosshair.dispose();
    host.remove();
    jest.restoreAllMocks();
  });

  function root(): HTMLElement {
    return host.querySelector('[data-noodl-transform-origin]') as HTMLElement;
  }

  function label(): HTMLElement {
    return root().querySelector('[data-noodl-transform-origin-label]') as HTMLElement;
  }

  it('AC3 — nothing it draws can be pointed at', () => {
    expect(root().style.pointerEvents).toBe('none');
  });

  it('starts hidden, so an author who never opens the field never sees it', () => {
    expect(root().style.display).toBe('none');
  });

  it('stays hidden for an element that is not in the document', () => {
    const orphan = document.createElement('div');
    crosshair.update(orphan);
    expect(root().style.display).toBe('none');
  });

  it('shows itself for a connected element, and hides again on clear', () => {
    const element = document.createElement('div');
    document.body.appendChild(element);

    crosshair.update(element);
    expect(root().style.display).toBe('block');

    crosshair.clear();
    expect(root().style.display).toBe('none');
    element.remove();
  });

  it('everything it builds lives inside its own root, not loose on the page', () => {
    const element = document.createElement('div');
    document.body.appendChild(element);
    crosshair.update(element);

    // Four pieces: two arms, the ring, the label.
    expect(root().children.length).toBe(4);
    expect(host.children.length).toBe(1);
    element.remove();
  });

  it('renders a declaration the author wrote as text, never as markup', () => {
    const element = document.createElement('div');
    document.body.appendChild(element);

    // `transform-origin` reaches an element from Advanced CSS or a `cssClassName` too — strings
    // the author typed.
    //
    // ⚠️ **The hostile value has to be one that still RESOLVES, and finding that out is the point
    // of this comment.** The first version of this row used a bare `<img …>`, and the label came
    // back empty — `describeOrigin` says nothing at all when it cannot read a declaration, so the
    // markup never reached the DOM and the row passed for a reason that had nothing to do with
    // escaping. It would have gone on passing if the label used `innerHTML`. This value parses
    // (`splitOrigin` takes `10px` and `20px<img`, and `parseFloat` reads 20 out of the second),
    // so the whole string genuinely reaches the label and the escaping is what is being graded.
    const hostile = '10px 20px<img src=x onerror="window.__crosshairEscaped = false">';
    jest
      .spyOn(window, 'getComputedStyle')
      .mockImplementation(() => stubStyle({ 'transform-origin': hostile }) as unknown as CSSStyleDeclaration);

    crosshair.update(element);

    expect(label().textContent).toContain(hostile);
    expect(label().querySelector('img')).toBeNull();
    expect(label().innerHTML).toContain('&lt;img');
    element.remove();
  });

  it('control — the label really does draw the declaration, so the row above is not passing on an empty label', () => {
    const element = document.createElement('div');
    document.body.appendChild(element);
    // ⚠️ A **negative pixel** origin, and the third time jsdom's zero box has chosen a value in
    // this file. `25% 75%` of a 0×0 element resolves to (0, 0), which *is* that box's centre, so
    // the label correctly calls it the default and the control stops controlling anything. A
    // negative length is off-centre and outside the element on any box, zero-sized or not.
    jest
      .spyOn(window, 'getComputedStyle')
      .mockImplementation(() => stubStyle({ 'transform-origin': '-20px 40px' }) as unknown as CSSStyleDeclaration);

    crosshair.update(element);

    expect(label().children.length).toBeGreaterThan(1);
    expect(label().textContent).toContain('transform-origin: -20px 40px');
    element.remove();
  });

  it('hides itself entirely rather than drawing a point it could not work out', () => {
    // Discovered while writing the escaping row above: an unreadable declaration takes the early
    // return in `update`, so there is no crosshair at all rather than one parked at the element's
    // corner pretending to be the origin.
    const element = document.createElement('div');
    document.body.appendChild(element);
    jest
      .spyOn(window, 'getComputedStyle')
      .mockImplementation(() => stubStyle({ 'transform-origin': 'inherit' }) as unknown as CSSStyleDeclaration);

    crosshair.update(element);

    expect(root().style.display).toBe('none');
    element.remove();
  });

  it('a second update replaces the label’s lines rather than appending to them', () => {
    const element = document.createElement('div');
    document.body.appendChild(element);

    crosshair.update(element);
    const first = label().children.length;
    crosshair.update(element);

    expect(label().children.length).toBe(first);
    element.remove();
  });

  it('drops a line it no longer needs instead of leaving the old text behind', () => {
    const element = document.createElement('div');
    document.body.appendChild(element);

    // ⚠️ A **negative** origin, not `150%`: jsdom reports `offsetWidth` as 0, so every percentage
    // resolves to 0 and no value on that side of the element can ever read as past its edge. A
    // negative length is outside a zero-width box and a 360-wide one alike.
    const outside = jest
      .spyOn(window, 'getComputedStyle')
      .mockImplementation(() => stubStyle({ 'transform-origin': '-20px 50%' }) as unknown as CSSStyleDeclaration);
    crosshair.update(element);
    expect(label().textContent).toContain('outside the element');

    outside.mockImplementation(() => stubStyle({ 'transform-origin': '50% 50%' }) as unknown as CSSStyleDeclaration);
    crosshair.update(element);
    expect(label().textContent).not.toContain('outside the element');
    element.remove();
  });
});
