/**
 * NDA-012 (Visual), check `A3` — the two components that moved state from a render body.
 *
 * `A3` asks whether repeated or coalesced work is safe. Both of these went one worse than unsafe
 * coalescing: they performed a side effect *during* render, so a render React discards or
 * double-invokes moved state that only a committed render should have moved.
 *
 * - **`Radio Button`** — `props.checkedChanged(…)` was called from the render body
 *   (`RadioButton.tsx:48`), and on the node side that reaches `flagOutputDirty('checked')` and
 *   `_updateVisualState()` (`radiobutton.ts:39-46`). A discarded render therefore moved graph
 *   state and repainted visual states for a checked-ness the committed tree never had.
 * - **`Page`** — `Noodl.SEO.setMeta` was called for every one of the fourteen meta tags from the
 *   render body (`Page.tsx:163-166`), which in a browser mutates `document.head`.
 *
 * ⚠️ **The two fixes are not the same, and the asymmetry is the finding.** SSR renders with
 * `ReactDOMServer.renderToString` (`static/ssr/server-core.js:105`) and **effects never run**, and
 * `injectSeo` builds the served `<head>` out of the buffer `setMeta` fills — so moving `Page`'s
 * call into an effect outright would have silently emptied every server-rendered page's meta tags,
 * with `ssr-inject-seo.test.js` still green because it tests the string transform and not the
 * producer. `Page` therefore keeps the render-body call **on the server only** and does its
 * browser DOM write after commit. `Radio Button` has no such server-side consumer and moves
 * wholesale.
 */

/* eslint-env jest */

import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

// The node modules reach `Noodl.deployed` at import time, so it has to exist before the
// `require`s below — and `Noodl.SEO` is what `Page` writes into.
const seoWrites: Array<[string, string | undefined]> = [];
(globalThis as unknown as { Noodl: unknown }).Noodl = {
  deployed: true,
  baseUrl: '/',
  SEO: {
    setMeta: (key: string, value: string | undefined) => seoWrites.push([key, value])
  }
};

/* eslint-disable @typescript-eslint/no-var-requires */
const { RadioButton } = require('../../src/components/controls/RadioButton');
const { Page, META_TAGS } = require('../../src/components/navigation/Page');
const RadioButtonContext = require('../../src/contexts/radiobuttoncontext').default;
/* eslint-enable @typescript-eslint/no-var-requires */

/**
 * The props both components reach for that have nothing to do with what is being measured.
 *
 * `noodlNode` is read for `noodlRootRef` and for `context.styles.resolveColor`; the style bags are
 * read unconditionally. Kept minimal on purpose — a fuller fake would start to hide the thing
 * under test.
 */
function baseProps(overrides: Record<string, unknown> = {}) {
  return {
    style: {},
    className: '',
    noodlNode: {
      context: { styles: { resolveColor: (c: unknown) => c } },
      getDOMElement: () => null
    },
    ...overrides
  };
}

describe('RB-1 — Radio Button does not move graph state from its render body', () => {
  /** The node-side callback, recording every checked-ness handed to it. */
  function checkedRecorder() {
    const seen: boolean[] = [];
    return { seen, checkedChanged: (checked: boolean) => seen.push(checked) };
  }

  const radioProps = (value: string, extra: Record<string, unknown> = {}) =>
    baseProps({
      id: 'input-1',
      enabled: true,
      value,
      useLabel: false,
      useIcon: false,
      label: '',
      labelSpacing: '0px',
      labeltextStyle: {},
      fillSpacing: '2px',
      styles: { radio: { width: '16px', height: '16px' }, fill: {}, label: {} },
      ...extra
    });

  it('a render that is never committed does not report a checked-ness', () => {
    const { seen, checkedChanged } = checkedRecorder();

    // `renderToStaticMarkup` renders and commits nothing and runs no effects — the closest
    // available stand-in for a render React throws away. Before the fix this recorded `false`,
    // which on the node side is a `flagOutputDirty` plus a visual-state repaint.
    renderToStaticMarkup(
      React.createElement(
        RadioButtonContext.Provider,
        { value: { name: 'g', selected: 'b', checkedChanged: () => undefined } },
        React.createElement(RadioButton, radioProps('a', { checkedChanged }) as never)
      )
    );

    expect(seen).toHaveLength(0);
  });

  it('the control: the rendered input still carries the right checked attribute', () => {
    // The half that must keep working, and the reason the expression stays in the render body
    // even though the *call* leaves it: the DOM is a render output, not a side effect.
    const checkedHtml = renderToStaticMarkup(
      React.createElement(
        RadioButtonContext.Provider,
        { value: { name: 'g', selected: 'a', checkedChanged: () => undefined } },
        React.createElement(RadioButton, radioProps('a') as never)
      )
    );
    const uncheckedHtml = renderToStaticMarkup(
      React.createElement(
        RadioButtonContext.Provider,
        { value: { name: 'g', selected: 'b', checkedChanged: () => undefined } },
        React.createElement(RadioButton, radioProps('a') as never)
      )
    );

    expect(checkedHtml).toContain('checked=""');
    expect(uncheckedHtml).not.toContain('checked=""');
  });

  it('the control: a Radio Button outside a group still renders, unchecked', () => {
    // F1's situation — no provider, so `useContext` gives undefined. It must not throw, and it
    // must not report anything either.
    const { seen, checkedChanged } = checkedRecorder();

    const html = renderToStaticMarkup(
      React.createElement(RadioButton, radioProps('a', { checkedChanged }) as never)
    );

    expect(html).toContain('type="radio"');
    expect(html).not.toContain('checked=""');
    expect(seen).toHaveLength(0);
  });
});

describe('PG-1 — Page keeps its server-side meta tags and stops writing them mid-render', () => {
  const pageProps = (metatags?: Record<string, string>) =>
    baseProps({
      metatags,
      children: null,
      sizeMode: 'contentHeight'
    });

  it('a server render still buffers every meta tag', () => {
    // ⚠️ This is the row that stops the obvious fix. `injectSeo` builds the served `<head>` from
    // this buffer, and effects do not run under `renderToString` — so if the render-body call
    // disappears entirely, every SSR and SSG page loses its meta tags and no existing test
    // notices.
    seoWrites.length = 0;

    renderToStaticMarkup(React.createElement(Page, pageProps({ description: 'A page about Ada' }) as never));

    const keys = seoWrites.map(([key]) => key);
    expect(keys).toEqual(META_TAGS.map((tag: { key: string }) => tag.key));
    expect(seoWrites).toContainEqual(['description', 'A page about Ada']);
  });

  it('an unset tag is still buffered as undefined, which is how it gets removed', () => {
    // `SeoApi.setMeta(key, undefined)` removes the tag, and `injectSeo` skips undefined entries.
    // Passing them through is deliberate: it is how a tag cleared from the graph stops being
    // served. Pinned because "skip the undefined ones" is the tidy-looking change that breaks it.
    seoWrites.length = 0;

    renderToStaticMarkup(React.createElement(Page, pageProps({}) as never));

    expect(seoWrites.every(([, value]) => value === undefined)).toBe(true);
    expect(seoWrites).toHaveLength(META_TAGS.length);
  });

  it('the browser path writes after commit, not during render', () => {
    // In a browser the document exists, so the render body must stay quiet and the effect must do
    // the work. `renderToStaticMarkup` runs no effects, so with a document present nothing should
    // be buffered at all — which is exactly the discarded-render case the check is about.
    const priorDocument = (globalThis as Record<string, unknown>).document;
    (globalThis as Record<string, unknown>).document = { head: {}, createElement: () => ({}) };
    seoWrites.length = 0;

    try {
      renderToStaticMarkup(React.createElement(Page, pageProps({ description: 'Discarded' }) as never));

      expect(seoWrites).toHaveLength(0);
    } finally {
      (globalThis as Record<string, unknown>).document = priorDocument;
    }
  });
});
