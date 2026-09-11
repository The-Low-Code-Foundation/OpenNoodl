/**
 * COM-004 AC2 + AC3 — a builder sets Open Graph tags with no JavaScript, and the tags reach a
 * crawler rather than only the DOM.
 *
 * ## Why this test exists, and what COM-004 had wrong
 *
 * COM-004 opened with *"there is no node, no prefab, and no way for a builder to reach it without
 * writing JavaScript"*, measured as *"catalog types matching `seo`, or display name containing
 * `meta` — 0"*. True count, wrong noun: the authoring surface is a **port group on the `Page`
 * node**, thirteen of them, named for the page rather than for the tags. §7 of that task file
 * records the correction.
 *
 * So AC2 is really the question *"do those ports actually reach the served `<head>`?"* — and
 * nothing tested the whole chain. The pieces each had a test and the seam between them had none:
 *
 *     Page node parameters  ->  Page.tsx render  ->  Noodl.SEO.setMeta  ->  injectSeo  ->  <head>
 *     └─ catalog (catalog:check) ─┘         └─ seo-api.test.ts ─┘   └─ ssr-inject-seo.test.js ─┘
 *
 * 🔴 **AC3 is the criterion COM-004 flagged as able to fail silently**, and this is the arm that
 * grades it. `jest.config.js` sets `testEnvironment: 'node'`, so `document` is genuinely undefined
 * here — which is the SSR condition, not a simulation of it. `Page.tsx` applies its tags in the
 * **render body** on that branch precisely because `ReactDOMServer` never runs effects, and
 * `injectSeo` reads the buffer afterwards. A crawler that executes no JavaScript sees exactly what
 * this test asserts.
 *
 * ⚠️ **What this does NOT prove.** That a *deployed* project is built in an SSR/SSG mode at all —
 * that is P16 RUN-002, and on a client-only deploy the tags are still written after load and a
 * non-executing crawler still sees nothing. This grades the chain, not the deployment choice.
 */

/* eslint-env jest */

import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { SeoApi } from '../src/api/seo';

// The node modules reach `Noodl.deployed` at import time, so the global has to exist before the
// `require`s below. The SEO instance is the REAL SeoApi rather than a spy: a fake buffer would
// make this a test of the test, and the buffering behaviour is half of what carries the tags
// across the seam.
const seo = new SeoApi();
(globalThis as unknown as { Noodl: unknown }).Noodl = { deployed: true, baseUrl: '/', SEO: seo };

/* eslint-disable @typescript-eslint/no-var-requires */
const { Page } = require('../src/components/navigation/Page');
const { injectSeo } = require('../static/ssr/inject-seo');
/* eslint-enable @typescript-eslint/no-var-requires */

const TEMPLATE = '<html><head><title>Project</title></head><body></body></html>';

/**
 * The chrome `Page` needs to render at all, mirroring `nda-012-render-body-effects`'s helper.
 * None of it is what this test is about — `Layout.size` reads `style` and the node shim is reached
 * by `noodlRootRef` — but a render that throws proves nothing about meta tags.
 */
const pageProps = (metatags: Record<string, string>) => ({
  style: {},
  className: '',
  noodlNode: {
    context: { styles: { resolveColor: (c: unknown) => c } },
    getDOMElement: () => null
  },
  sizeMode: 'contentHeight',
  metatags,
  children: null
});

/** The whole chain: parameters an author typed -> the HTML a crawler is served. */
function serve(metatags: Record<string, string>): string {
  seo.reset();
  renderToStaticMarkup(React.createElement(Page, pageProps(metatags) as never));
  return injectSeo(TEMPLATE, seo);
}

describe('COM-004 AC2/AC3 — Page meta ports reach the served head', () => {
  it('runs on the server branch, which is the one a crawler is served', () => {
    expect(typeof document).toBe('undefined');
  });

  it('AC2 — og:title, og:description and og:image set as parameters land in the head', () => {
    const html = serve({
      'og:title': 'Nine Lessons',
      'og:description': 'A short course in building with nodes',
      'og:image': 'https://example.com/card.png'
    });

    expect(html).toContain('content="Nine Lessons"');
    expect(html).toContain('content="A short course in building with nodes"');
    expect(html).toContain('content="https://example.com/card.png"');
    // Open Graph is read off `property`, not `name` — a tag emitted with only `name` is ignored by
    // Facebook's scraper, which is the kind of thing that looks fine in a DOM inspector.
    expect(html).toContain('property="og:title"');
    expect(html).toContain('property="og:image"');
  });

  it('AC3 — the tags are in the served HTML with no JavaScript executed', () => {
    // `renderToStaticMarkup` produces markup with no hydration and no scripts; the assertion is
    // that the meta tags are already present in that string, before anything could run.
    const html = serve({ description: 'Indexed summary' });
    expect(html).toContain('<meta name="description" property="description" content="Indexed summary">');
    expect(html.indexOf('<meta')).toBeLessThan(html.indexOf('</head>'));
  });

  it('a tag the author left blank is not emitted at all', () => {
    // ⚠️ The counterpart that stops the assertions above passing on a template that simply prints
    // every key. An empty `og:url` must not become `<meta property="og:url" content="">`, which
    // some scrapers treat as an explicit empty canonical rather than an absent one.
    const html = serve({ 'og:title': 'Only this one' });
    expect(html).toContain('property="og:title"');
    expect(html).not.toContain('og:url');
    expect(html).not.toContain('twitter:card');
  });

  it('values are escaped, so a quote in a description cannot break out of the attribute', () => {
    const html = serve({ 'og:title': 'She said "hello" & <left>' });
    expect(html).toContain('content="She said &quot;hello&quot; &amp; &lt;left&gt;"');
    expect(html).not.toContain('content="She said "hello"');
  });

  it('the buffer does not bleed between two pages rendered by the same process', () => {
    // SSR reuses one SeoApi across requests. Without the reset in `serve`, page two would inherit
    // page one's tags — and the symptom is one page's share preview appearing on another.
    serve({ 'og:title': 'First' });
    const second = serve({ 'og:title': 'Second' });
    expect(second).toContain('content="Second"');
    expect(second).not.toContain('content="First"');
  });
});
