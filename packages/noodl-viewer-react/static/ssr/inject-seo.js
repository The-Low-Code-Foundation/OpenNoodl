'use strict';

/**
 * SSR head injection — writes the runtime's buffered SEO state into the served
 * HTML. Extracted from the SSR server template (index.js) so the logic is unit
 * testable; the server `require`s it and webpack copies the whole static/ssr
 * directory into the deploy runtime, so the sibling module travels with it.
 *
 * CommonJS on purpose: it is consumed both by the esbuild-bundled server and by
 * Jest (tests/ssr-inject-seo.test.js) with no transform step.
 */

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Writes the runtime's buffered SEO state into the served HTML head.
 *
 * `seo` is the `Noodl.SEO` instance (SeoApi): `seo.title` is a string and
 * `seo.meta` a `{ key: value }` map, both populated during render by
 * Noodl.SEO.setTitle / setMeta. The existing <title> (the project default from
 * the deploy template) is replaced rather than duplicated; meta tags are
 * appended before </head>. No-ops safely if SEO was never touched.
 *
 * @param {string} html   The rendered HTML document.
 * @param {{ title?: string, meta?: Record<string, string> }} [seo]
 * @returns {string}
 */
function injectSeo(html, seo) {
  if (!seo) return html;

  let metaTags = '';
  const meta = seo.meta || {};
  for (const key of Object.keys(meta)) {
    const value = meta[key];
    if (value === undefined || value === null || value === '') continue;
    metaTags += `<meta name="${escapeHtml(key)}" property="${escapeHtml(key)}" content="${escapeHtml(value)}">`;
  }

  const title = seo.title;
  if (title) {
    const titleTag = `<title>${escapeHtml(title)}</title>`;
    if (/<title>[\s\S]*?<\/title>/.test(html)) {
      html = html.replace(/<title>[\s\S]*?<\/title>/, titleTag);
    } else {
      metaTags = titleTag + metaTags;
    }
  }

  return metaTags ? html.replace('</head>', `${metaTags}</head>`) : html;
}

module.exports = { injectSeo, escapeHtml };
