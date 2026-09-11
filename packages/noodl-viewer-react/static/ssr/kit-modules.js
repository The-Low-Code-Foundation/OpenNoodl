'use strict';

/**
 * CN-013 — run a project's kits during the server render.
 *
 * ## What was broken
 *
 * `runtime-globals.js` creates `globalThis.__noodl_modules = []` and installs a working
 * `Noodl.defineModule`, and `index.js`/`ssg.js` hand that array to `renderPage`. **Nothing ever
 * called it.** In a browser a kit reaches the runtime because `@nodegx/module-inject` writes a
 * `<script>` tag per kit into the page and the browser executes it; server-side there was no
 * browser and no replacement for one, so the module list was `[]` at every render.
 *
 * 🔴 **The consequence was worse than a blank page, and it is CN-001's shape.** The kit `<script>`
 * tags *are* in `public/index.html` and `noodl_modules/` ships verbatim, so the **client** loaded
 * the kits and the **server** did not: the server rendered with every kit node missing (an
 * unregistered type is logged and skipped **with its connections**) and hydration then rendered a
 * different tree. Measured in s25 before this existed.
 *
 * ## Why this reads the HTML instead of scanning `noodl_modules/`
 *
 * 🔴 **A second manifest scanner is the regression LIB-003 exists to end**, and this file cannot
 * import the first one: an SSR deploy is a standalone folder with its own `package.json` and no
 * workspace dependency on `@nodegx/module-inject`. Reimplementing the scan here would mean two
 * readings of `runtimes`, two name fallbacks and two warning vocabularies — and the server's copy
 * would be the one nobody notices drifting, because its output is invisible.
 *
 * So this consumes **the injector's own output**: the same `index.html` the server already reads as
 * `htmlData`, carrying the same tags in the same order the browser runs them. It cannot disagree
 * with the browser about which kits load, because it is reading the browser's instructions. If the
 * injector's rules change — the `runtimes` filter, the ordering, the name marker — the server
 * follows with no edit here.
 *
 * ⚠️ **This is also why there is no `runtimes: ["ssr"]`.** SSR is not a runtime an author opts
 * into; it is the *browser* app rendered on a server. The set of kits that load here is exactly the
 * set `buildInjectionTags` emitted, which is the set whose `runtimes` contains `browser`. A kit
 * declaring only `cloud` is still absent from this page, correctly, and
 * `nodegx-kit-catalog`'s `KIT_LOADERS` stays `['browser', 'cloud']`.
 *
 * @module static/ssr/kit-modules
 */

const fs = require('fs');
const path = require('path');

/**
 * The name marker the injector writes immediately before each kit's script.
 *
 * CN-003: a kit's `index.js` calls `Noodl.defineModule({...})` with no idea what its own manifest
 * says, so the runtime names the module `undefined` and every node reports `'Unknown Module'`.
 * Scripts execute in document order, so the global set just before the kit's tag is what tells
 * `defineModule` which manifest is running — and the bootstrap's `defineModule` already adopts it.
 * Setting the same global here means that adoption is reused rather than copied.
 */
const NAME_MARKER = /window\.__noodl_module_name\s*=\s*("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')/g;

/** Any `<script src="…">`, so dependency tags and kit mains are both seen, in order. */
const SCRIPT_SRC = /<script[^>]*\ssrc=["']([^"']+)["'][^>]*>/g;

/**
 * Everything the page would execute out of `noodl_modules/`, in document order.
 *
 * Both tag shapes are matched in a single pass over the document so their **interleaving** is
 * preserved: a name marker applies to the scripts that follow it, exactly as it does in a browser.
 *
 * @param {string} html the deploy's `index.html`
 * @returns {{ src: string, moduleName: string | null }[]}
 */
function kitScriptsFromHtml(html) {
  if (!html) return [];

  /** @type {{ index: number, kind: 'name' | 'src', value: string }[]} */
  const events = [];

  NAME_MARKER.lastIndex = 0;
  for (let m = NAME_MARKER.exec(html); m; m = NAME_MARKER.exec(html)) {
    let raw = m[1];
    let value;
    try {
      // The injector emits a JSON string literal with `<` escaped as <; single quotes are
      // accepted too because a hand-edited template is a thing that happens.
      value = JSON.parse(raw[0] === "'" ? `"${raw.slice(1, -1).replace(/"/g, '\\"')}"` : raw);
    } catch {
      value = raw.slice(1, -1);
    }
    events.push({ index: m.index, kind: 'name', value });
  }

  SCRIPT_SRC.lastIndex = 0;
  for (let m = SCRIPT_SRC.exec(html); m; m = SCRIPT_SRC.exec(html)) {
    events.push({ index: m.index, kind: 'src', value: m[1] });
  }

  events.sort((a, b) => a.index - b.index);

  const out = [];
  let currentName = null;
  for (const event of events) {
    if (event.kind === 'name') {
      currentName = event.value;
      continue;
    }
    // Only module scripts. The viewer bundle, analytics and anything else the template carries are
    // not this loader's business and would be actively harmful to run twice.
    if (!/(^|\/)noodl_modules\//.test(event.value)) continue;
    out.push({ src: event.value, moduleName: currentName });
  }

  return out;
}

/**
 * Turn a page-relative `src` into a path on this machine.
 *
 * An SSR deploy is layered: the Node server sits at the root and the whole browser app is in
 * `public/`, and `noodl_modules/` is copied into **both** (the deployer runs `deployToFolder`
 * twice — `compilation.ts:236`). The root copy is tried first because that is where the server's
 * other runtime reads live (`noodl_bundles/`, per the `static/ssr` README), with `public/` as the
 * fallback so a layout that only has one copy still works.
 *
 * @param {string} src
 * @param {string} rootDir
 * @returns {string | null} an existing file, or `null`
 */
function resolveKitScript(src, rootDir) {
  // A dependency may be an absolute URL — `manifest.dependencies` accepts http(s) — and there is
  // no synchronous way to fetch one here. Reported by the caller rather than silently dropped.
  if (/^https?:\/\//i.test(src)) return null;

  const relative = src.replace(/^\.?\//, '');
  for (const candidate of [path.resolve(rootDir, relative), path.resolve(rootDir, 'public', relative)]) {
    try {
      if (fs.statSync(candidate).isFile()) return candidate;
    } catch {
      /* try the next one */
    }
  }
  return null;
}

/**
 * Load every kit the page would load, into the globals `renderPage` reads.
 *
 * 🔴 **`new Function(source)()` and not a parameter-passing wrapper, deliberately.** A kit's entry
 * script is a `<script>` tag: it runs in global scope and reaches `Noodl` as a global. Evaluating
 * it the same way means the bootstrap's own `defineModule` — including CN-003's name adoption — is
 * *reused*, not reimplemented, and a kit that assigns to a global (every UMD wrapper does) behaves
 * as it does in the browser.
 *
 * ⚠️ **A kit that throws costs its own nodes and nothing else.** One broken kit must not take down
 * the whole server render, so each script is caught individually and reported. That is the same
 * shape `registerModule` has in the browser, where a definition that throws mid-module leaves the
 * ones before it registered.
 *
 * ⚠️ **`window` exists here only as a `React` shim, for the duration of this call** — ✅ D19. Every
 * kit written to the documented pattern begins `var React = window.React;`, so before this shim
 * *all four* of s27's fixture kits threw at import and no kit node reached a server render. The
 * shim carries **`React` and nothing else**: no `document`, no DOM. Faking one would let a kit
 * register nodes that cannot render server-side anyway, trading a named failure for a silent one,
 * and a kit that needs more than `React` is a new ruling rather than a wider shim.
 *
 * 🔴 **It is removed before the render**, so `typeof window === 'undefined'` still holds everywhere
 * the runtime asks — including `viewer.jsx`'s own guards and `isSSRServer`'s client-only deferral.
 * A `window` left standing would flip those to their browser branch on the server, which is the
 * failure this shim exists to prevent, one layer down.
 *
 * @param {object} deps
 * @param {string} deps.htmlData the deploy's `index.html`, already read by the caller
 * @param {string} [deps.rootDir] deploy root; defaults to the working directory
 * @param {Function} [deps.log]
 * @param {Function} [deps.warn]
 * @returns {{ loaded: string[], failures: { module: string, src: string, message: string }[], skipped: string[] }}
 */
function loadKitModules({ htmlData, rootDir = process.cwd(), log = () => {}, warn = console.warn.bind(console) }) {
  const result = { loaded: [], failures: [], skipped: [] };

  const scripts = kitScriptsFromHtml(htmlData);
  if (scripts.length === 0) return result;

  const removeWindowShim = installWindowShim();
  try {
    loadEach(scripts, { rootDir, log, warn, result });
  } finally {
    removeWindowShim();
    delete globalThis.__noodl_module_name;
  }

  return result;
}

/**
 * ✅ **D19(a)** — `window`, carrying `React` and nothing else, for as long as kits are loading.
 *
 * Installed once around the whole loop rather than per script, because that is what a browser
 * does: a UMD dependency tag publishes onto `window` and the kit's own tag reads it back. A
 * per-script shim would break exactly the kits whose `manifest.dependencies` list something.
 *
 * ⚠️ **Refuses to touch a `window` somebody else owns.** If a host has already installed one
 * (a jsdom-based test, a future runtime), replacing it and then deleting it would leave that host
 * worse off than before this ran.
 *
 * @returns {() => void} removes the shim, restoring exactly what was there
 */
function installWindowShim() {
  if (globalThis.window) return () => {};

  const had = Object.prototype.hasOwnProperty.call(globalThis, 'window');
  const previous = globalThis.window;

  // A fresh object per load: a kit that assigns to `window` (every UMD wrapper does) writes here
  // and nowhere that outlives the load.
  globalThis.window = { React: globalThis.React };

  return () => {
    if (had) globalThis.window = previous;
    else delete globalThis.window;
  };
}

/**
 * The load loop itself, so the shim's `finally` has something to wrap.
 *
 * @param {{ src: string, moduleName: string | null }[]} scripts
 * @param {{ rootDir: string, log: Function, warn: Function, result: object }} ctx
 */
function loadEach(scripts, { rootDir, log, warn, result }) {
  for (const script of scripts) {
    const name = script.moduleName || script.src;
    const file = resolveKitScript(script.src, rootDir);

    if (!file) {
      result.skipped.push(script.src);
      warn(
        `SSR: kit script ${script.src} could not be loaded server-side` +
          (/^https?:\/\//i.test(script.src)
            ? ' (remote dependencies are fetched by the browser only, so nodes relying on it will be missing from the server render)'
            : ' (file not found under the deploy root or public/)')
      );
      continue;
    }

    let source;
    try {
      source = fs.readFileSync(file, 'utf8');
    } catch (e) {
      result.failures.push({ module: name, src: script.src, message: e && e.message ? e.message : String(e) });
      warn(`SSR: could not read kit script ${script.src}: ${e && e.message ? e.message : e}`);
      continue;
    }

    // The marker the bootstrap's `defineModule` reads. Set per script, exactly where the browser
    // sets it — a kit that defers its `defineModule` call would otherwise adopt a later kit's name.
    globalThis.__noodl_module_name = script.moduleName || undefined;

    try {
      // eslint-disable-next-line no-new-func
      new Function(`${source}\n//# sourceURL=${script.src}`)();
      result.loaded.push(name);
      log(`SSR: loaded kit script ${script.src}`);
    } catch (e) {
      const message = e && e.message ? e.message : String(e);
      result.failures.push({ module: name, src: script.src, message });
      warn(
        `SSR: kit "${name}" threw while loading server-side (${message}). Its nodes will be missing ` +
          'from the server render and will appear only after hydration, which is a hydration ' +
          'mismatch. `window` here is a shim carrying React alone (D19), so a kit that touches ' +
          '`document`, or any other browser API, at import time will do this.'
      );
    }
  }
}

module.exports = { loadKitModules, kitScriptsFromHtml, resolveKitScript, installWindowShim };
