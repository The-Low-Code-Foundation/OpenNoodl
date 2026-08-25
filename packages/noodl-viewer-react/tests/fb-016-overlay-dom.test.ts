/**
 * FB-016 — the overlay's DOM, for the two claims jsdom can actually settle.
 *
 * ⚠️ **jsdom has no layout, so nothing here grades a position.** Every rect is zero and every
 * computed style is an initial value; the geometry is graded in `fb-016-box-model-overlay.test.ts`
 * by feeding numbers in, and *where the divs land on screen* is a drive. What jsdom can settle is
 * structural, and both of these have bitten this repo before:
 *
 * - AC3 — the overlay must not be in the pointer's way. The Inspector's whole design is
 *   capture-phase listeners on `document` that block propagation, and an overlay div that took
 *   pointer events would eat the inspect click on the element it is describing.
 * - the chip renders author-written strings, and it must render them as **text**.
 *
 * ⚠️ `jest-environment-jsdom` is not in this package's tree, so there is no
 * `@jest-environment jsdom` docblock to reach for — jsdom is constructed directly and its globals
 * installed, exactly as `tests/corpus/nda-012-radio-button-group.test.tsx` already does it here.
 */
/* eslint-disable @typescript-eslint/no-var-requires */
const { JSDOM } = require('jsdom');
const dom = new JSDOM('<!doctype html><html><body></body></html>');
(globalThis as never as Record<string, unknown>).window = dom.window;
(globalThis as never as Record<string, unknown>).document = dom.window.document;
(globalThis as never as Record<string, unknown>).HTMLElement = dom.window.HTMLElement;

import { BoxModelOverlay, ComputedReader } from '../src/box-model-overlay';

function stubStyle(declarations: Record<string, string>): ComputedReader {
  return { getPropertyValue: (property: string) => declarations[property] || '' };
}

describe('the overlay’s DOM', () => {
  let host: HTMLDivElement;
  let overlay: BoxModelOverlay;

  beforeEach(() => {
    host = document.createElement('div');
    document.body.appendChild(host);
    overlay = new BoxModelOverlay(host);
  });

  afterEach(() => {
    overlay.dispose();
    host.remove();
    jest.restoreAllMocks();
  });

  function root(): HTMLElement {
    return host.querySelector('[data-noodl-box-overlay]') as HTMLElement;
  }

  it('AC3 — nothing it draws can be pointed at', () => {
    expect(root().style.pointerEvents).toBe('none');
  });

  it('starts hidden, and stays hidden for an element that is not in the document', () => {
    expect(root().style.display).toBe('none');

    overlay.update(document.createElement('div'));
    expect(root().style.display).toBe('none');

    overlay.update(null);
    expect(root().style.display).toBe('none');
  });

  it('shows itself for a connected element, and hides again on clear', () => {
    const element = document.createElement('div');
    document.body.appendChild(element);

    overlay.update(element);
    expect(root().style.display).toBe('block');

    overlay.clear();
    expect(root().style.display).toBe('none');

    element.remove();
  });

  it('everything it builds lives inside its own root, not loose on the page', () => {
    const element = document.createElement('div');
    document.body.appendChild(element);
    overlay.update(element);

    expect(document.body.querySelectorAll('[data-noodl-box-overlay]')).toHaveLength(1);
    expect(root().parentElement).toBe(host);
    element.remove();
  });

  it('renders a fact the author wrote as text, never as markup', () => {
    const element = document.createElement('div');
    document.body.appendChild(element);

    // A fact line carries values that reached the element from Advanced CSS or a `cssClassName` —
    // strings the *author* typed. This one is not a value CSS would ever produce; it is here to
    // prove the chip cannot be talked into parsing one.
    const hostile = '<img src=x onerror="window.__overlayEscaped = false">';
    jest.spyOn(window, 'getComputedStyle').mockImplementation(
      () => stubStyle({ position: 'relative', transform: hostile }) as unknown as CSSStyleDeclaration
    );

    overlay.update(element);

    const chip = root().querySelector('[data-noodl-box-overlay-chip]') as HTMLElement;
    expect(chip.textContent).toContain(hostile);
    expect(chip.querySelector('img')).toBeNull();
    expect(chip.innerHTML).toContain('&lt;img');
    element.remove();
  });

  it('control — the chip really does draw the facts, so the row above is not passing on an empty chip', () => {
    const element = document.createElement('div');
    document.body.appendChild(element);
    jest.spyOn(window, 'getComputedStyle').mockImplementation(
      () => stubStyle({ position: 'absolute' }) as unknown as CSSStyleDeclaration
    );

    overlay.update(element);
    const chip = root().querySelector('[data-noodl-box-overlay-chip]') as HTMLElement;

    expect(chip.children.length).toBeGreaterThan(1);
    expect(chip.textContent).toContain('position: absolute — placed on its parent, not in its flow');
    element.remove();
  });

  it('a second update replaces the chip’s lines rather than appending to them', () => {
    const element = document.createElement('div');
    document.body.appendChild(element);

    overlay.update(element);
    const first = (root().querySelector('[data-noodl-box-overlay-chip]') as HTMLElement).children.length;
    overlay.update(element);
    const second = (root().querySelector('[data-noodl-box-overlay-chip]') as HTMLElement).children.length;

    expect(second).toBe(first);
    element.remove();
  });
});
