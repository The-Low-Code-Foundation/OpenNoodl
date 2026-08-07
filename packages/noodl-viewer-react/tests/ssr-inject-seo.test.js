/**
 * Unit tests for the SSR head-injection helper (RUN-002 slice 1).
 *
 * injectSeo is the consumer that turns the runtime's buffered Noodl.SEO state
 * into the served HTML `<head>`. It only produces real output once the producer
 * side works (the Viewer constructor no longer clobbers SEO mid-render — see
 * noodl-js-api.js), but the string transform itself is validated here.
 */
const { injectSeo, escapeHtml } = require('../static/ssr/inject-seo');

const HTML = '<html><head><title>Default</title></head><body><div id="root"></div></body></html>';

describe('injectSeo', () => {
  it('replaces the existing <title> with the buffered SEO title', () => {
    const out = injectSeo(HTML, { title: 'My Page', meta: {} });
    expect(out).toContain('<title>My Page</title>');
    expect(out).not.toContain('<title>Default</title>');
    // exactly one title tag
    expect(out.match(/<title>/g)).toHaveLength(1);
  });

  it('appends set meta tags before </head>', () => {
    const out = injectSeo(HTML, { meta: { description: 'Hello', 'og:title': 'OG' } });
    expect(out).toContain('<meta name="description" property="description" content="Hello">');
    expect(out).toContain('<meta name="og:title" property="og:title" content="OG">');
    expect(out.indexOf('<meta name="description"')).toBeLessThan(out.indexOf('</head>'));
  });

  it('skips meta entries that are undefined, null or empty', () => {
    // Page.tsx calls setMeta for every META_TAG key, passing undefined when the
    // input is unset — those must not become empty <meta> tags.
    const out = injectSeo(HTML, {
      meta: { description: 'keep', robots: undefined, 'og:url': null, 'og:type': '' }
    });
    expect(out).toContain('content="keep"');
    expect(out).not.toContain('name="robots"');
    expect(out).not.toContain('name="og:url"');
    expect(out).not.toContain('name="og:type"');
  });

  it('escapes HTML-significant characters in title and meta (XSS-safe)', () => {
    const out = injectSeo(HTML, {
      title: '</title><script>alert(1)</script>',
      meta: { description: '"><img src=x onerror=alert(1)>' }
    });
    expect(out).not.toContain('<script>alert(1)</script>');
    expect(out).toContain('&lt;script&gt;');
    expect(out).toContain('&quot;&gt;&lt;img');
  });

  it('is a no-op when SEO was never touched (empty title and meta)', () => {
    expect(injectSeo(HTML, { title: '', meta: {} })).toBe(HTML);
  });

  it('is a no-op when seo is missing', () => {
    expect(injectSeo(HTML, undefined)).toBe(HTML);
    expect(injectSeo(HTML, null)).toBe(HTML);
  });

  it('injects a <title> even when the template has none', () => {
    const noTitle = '<html><head><meta charset="utf-8"></head><body></body></html>';
    const out = injectSeo(noTitle, { title: 'Fresh', meta: {} });
    expect(out).toContain('<title>Fresh</title>');
    expect(out.indexOf('<title>')).toBeLessThan(out.indexOf('</head>'));
  });

  it('does not duplicate the title when both title and meta are set', () => {
    const out = injectSeo(HTML, { title: 'Once', meta: { description: 'd' } });
    expect(out.match(/<title>/g)).toHaveLength(1);
    expect(out).toContain('<title>Once</title>');
    expect(out).toContain('content="d"');
  });
});

describe('escapeHtml', () => {
  it('escapes &, <, > and "', () => {
    expect(escapeHtml('a & b < c > d "e"')).toBe('a &amp; b &lt; c &gt; d &quot;e&quot;');
  });

  it('coerces non-strings', () => {
    expect(escapeHtml(42)).toBe('42');
  });
});
