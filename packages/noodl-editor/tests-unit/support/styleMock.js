/**
 * CSS-module stand-in for the plain-Node runner (LGC-008).
 *
 * A `.module.scss` import is a build-time artefact; webpack turns it into a map of class names.
 * Under jest there is no such loader, so `import css from './X.module.scss'` would try to parse
 * SCSS as JavaScript and fail the whole suite to run.
 *
 * This answers every lookup with the key itself, which is what `identity-obj-proxy` does — and
 * it is written by hand rather than installed because installing anything in this repo's
 * worktrees mutates a shared `node_modules`. Class names are therefore readable in assertions
 * (`css['BlocklyContainer'] === 'BlocklyContainer'`), which is deliberate: a spec that asserts
 * on a class name is asserting on the name the stylesheet uses.
 */
module.exports = new Proxy(
  {},
  {
    get: (_target, key) => (key === '__esModule' ? false : key)
  }
);
