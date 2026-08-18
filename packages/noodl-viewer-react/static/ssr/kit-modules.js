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
 * ⚠️ **`window` does not exist here**, and that is not worked around. A kit guarding on
 * `typeof window !== 'undefined'` takes its `Noodl` branch and loads; a kit that touches `window`
 * or `document` at import time throws and is named. Faking a DOM would let a kit register nodes
 * that cannot render server-side anyway, trading a named failure for a silent one.
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
          'mismatch. A kit that touches `window` or `document` at import time will do this.'
      );
    }
  }

  delete globalThis.__noodl_module_name;
  return result;
}

module.exports = { loadKitModules, kitScriptsFromHtml, resolveKitScript };
