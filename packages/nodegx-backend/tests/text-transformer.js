/**
 * jest's twin of esbuild's `text` loader (BAK-005).
 *
 * `scripts/build.js` inlines the admin dashboard's `.html`/`.css` into the
 * bundle as strings. Tests import the same files through the same `require`,
 * so jest needs the same rule — otherwise the dashboard would only be testable
 * against a built artefact, which is precisely the "a green build proves
 * nothing" trap this repo has paid for before.
 */
'use strict';

module.exports = {
  process(sourceText) {
    return { code: `module.exports = ${JSON.stringify(sourceText)};` };
  },
  // ts-jest caches on this; without it an edited .html would serve stale.
  getCacheKey(sourceText) {
    return require('crypto').createHash('sha1').update(sourceText).digest('hex');
  }
};
