/**
 * CN-013 — a kit runs during the server render.
 *
 * ## 🔴 This file's premise was INVERTED, and the history is the point
 *
 * Written earlier the same session, this suite recorded a defect: *"the globals are set and nothing
 * fills them."* `runtime-globals.js` created `globalThis.__noodl_modules = []` and installed a
 * working `defineModule`, `index.js`/`ssg.js` handed that array to `renderPage`, and **no file in
 * `static/ssr/` ever evaluated a kit** — so the server rendered every page with its kit nodes
 * missing while the browser hydrated with them present. One of its rows asserted, over the whole
 * directory, that nothing there so much as named `noodl_modules`.
 *
 * `kit-modules.js` is the fix, and that row is now **replaced, not deleted** (CN-002's rule): the
 * absence assertion becomes a presence assertion about the same fact, and the rows below grade the
 * loader instead of the hole. ⚠️ **Its title moved with it** — a row named for what it used to
 * assert is how a suite comes to assert the opposite of what it says.
 *
 * ## What the loader is, in one line
 *
 * It reads the **injector's own `<script>` tags** out of the deploy's `index.html` — the same
 * document the server already reads as `htmlData` — and evaluates them in document order. It does
 * not scan `noodl_modules/`. A second manifest scanner is the regression LIB-003 exists to end, and
 * this file cannot import the first one (an SSR deploy is a standalone folder). Consuming the
 * injector's output means the server cannot disagree with the browser about which kits load.
 *
 * ⚠️ **So the interesting failure is not "does it read a manifest right" — it is "does it run the
 * same scripts the browser would, in the same order, under the same names".** The fixture below is
 * therefore built by `@nodegx/module-inject` itself rather than hand-written: a hand-written page
 * would grade this suite's idea of the injector, which is exactly the drift being guarded against.
 */

const fs = require('fs');
const os = require('os');
const path = require('path');

const { buildInjectionTags, injectIntoTemplate } = require('@nodegx/module-inject');

const { installRuntimeGlobals } = require('../static/ssr/runtime-globals');
const { loadKitModules, kitScriptsFromHtml } = require('../static/ssr/kit-modules');

const SSR_DIR = path.join(__dirname, '..', 'static', 'ssr');

function bootstrap() {
  installRuntimeGlobals({
    React: {},
    ReactDOMServer: {},
    XMLHttpRequest: function XMLHttpRequest() {},
    fetch: () => Promise.resolve()
  });
}

/** A kit in the shape a real one is written in — guarded on `typeof Noodl`, `window` fallback. */
const kitSource = (typeName) => `
(function () {
  function defineNodes(N) { N.defineModule({ nodes: [{ name: '${typeName}', category: 'Math' }] }); }
  if (typeof Noodl !== 'undefined') defineNodes(Noodl);
  else if (typeof window !== 'undefined' && window.Noodl) defineNodes(window.Noodl);
})();
`;

/**
 * A deploy root, laid out the way the deployer really lays one out.
 *
 * `noodl_modules/` at the root **and** in `public/` is not this fixture being thorough — it is what
 * `compilation.ts:236` does, running `deployToFolder` twice for an SSR build. The loader resolves
 * the root copy first, and the row below pins that it can still find a `public/`-only one.
 */
function makeDeploy(kits) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cn013-ssr-'));
  const modules = kits.map((k) => ({
    dependencies: [],
    runtimes: k.runtimes || ['browser'],
    index: `noodl_modules/${k.dir}/index.js`,
    name: k.name
  }));

  for (const k of kits) {
    for (const base of [root, path.join(root, 'public')]) {
      const dir = path.join(base, 'noodl_modules', k.dir);
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, 'index.js'), k.source);
    }
  }

  // 🔴 The real injector, on the real template placeholders. The whole loader is a consumer of
  // this output, so generating it here is what makes the suite grade the pair rather than a guess.
  const html = injectIntoTemplate(
    '<html><head><%modules_dependencies%></head><body><%modules_main%><script src="/noodl.deploy.js"></script></body></html>',
    buildInjectionTags(modules, '/')
  );
  fs.mkdirSync(path.join(root, 'public'), { recursive: true });
  fs.writeFileSync(path.join(root, 'public', 'index.html'), html);

  return { root, html };
}

afterEach(() => {
  delete globalThis.__noodl_module_name;
  delete globalThis.__noodl_modules;
  delete globalThis.Noodl;
});

describe('kitScriptsFromHtml — reading the injector back', () => {
  it('finds each kit script under the name marker that precedes it', () => {
    const { html } = makeDeploy([
      { dir: 'alpha-kit', name: 'Alpha Kit', source: kitSource('alpha.Node') },
      { dir: 'beta-kit', name: 'Beta Kit', source: kitSource('beta.Node') }
    ]);

    expect(kitScriptsFromHtml(html)).toEqual([
      { src: '/noodl_modules/alpha-kit/index.js', moduleName: 'Alpha Kit' },
      { src: '/noodl_modules/beta-kit/index.js', moduleName: 'Beta Kit' }
    ]);
  });

  it('🔴 ignores every script that is not a kit, including the viewer bundle', () => {
    // Without this the loader would re-execute `noodl.deploy.js` on the server — which is not a
    // subtle failure, but it is one a looser regex would produce and nothing else here would catch.
    const { html } = makeDeploy([{ dir: 'alpha-kit', name: 'Alpha Kit', source: kitSource('alpha.Node') }]);
    expect(html).toContain('noodl.deploy.js');
    expect(kitScriptsFromHtml(html).map((s) => s.src)).toEqual(['/noodl_modules/alpha-kit/index.js']);
  });

  it('says nothing about a page with no kits', () => {
    expect(kitScriptsFromHtml('<html><body><script src="/noodl.deploy.js"></script></body></html>')).toEqual([]);
    expect(kitScriptsFromHtml('')).toEqual([]);
  });
});

describe('loadKitModules — the kits reach the server render', () => {
  it('🔴 fills __noodl_modules, which is the value renderPage is handed', () => {
    // The defect this whole task is about: `index.js:68` and `ssg.js:68` pass
    // `globalThis.__noodl_modules` to `renderPage`, and before the loader it was always `[]`.
    const { root, html } = makeDeploy([{ dir: 'alpha-kit', name: 'Alpha Kit', source: kitSource('alpha.Node') }]);
    bootstrap();
    expect(globalThis.__noodl_modules).toEqual([]);

    const result = loadKitModules({ htmlData: html, rootDir: root, warn: () => {} });

    expect(result.loaded).toEqual(['Alpha Kit']);
    expect(result.failures).toEqual([]);
    expect(globalThis.__noodl_modules).toHaveLength(1);
    expect(globalThis.__noodl_modules[0].nodes[0].name).toBe('alpha.Node');
  });

  it('🔴 names each module from ITS OWN marker, not the last one on the page', () => {
    // CN-003's adoption, and the row that fails if the marker is set once per page instead of once
    // per script. Two kits, so "the name was adopted" cannot be satisfied by a single global.
    const { root, html } = makeDeploy([
      { dir: 'alpha-kit', name: 'Alpha Kit', source: kitSource('alpha.Node') },
      { dir: 'beta-kit', name: 'Beta Kit', source: kitSource('beta.Node') }
    ]);
    bootstrap();
    loadKitModules({ htmlData: html, rootDir: root, warn: () => {} });

    expect(globalThis.__noodl_modules.map((m) => m.name)).toEqual(['Alpha Kit', 'Beta Kit']);
  });

  it('🔴 loads exactly what the BROWSER would, so the two cannot disagree', () => {
    // The correctness property the whole design rests on. A cloud-only kit is absent from the page
    // because `buildInjectionTags` filtered it out — so it must be absent here too, without this
    // file knowing anything about `runtimes`. ⚠️ This is also why there is no `runtimes: ["ssr"]`:
    // SSR is the browser app rendered on a server, not a runtime an author opts into.
    const { root, html } = makeDeploy([
      { dir: 'alpha-kit', name: 'Alpha Kit', source: kitSource('alpha.Node') },
      { dir: 'cloud-kit', name: 'Cloud Kit', runtimes: ['cloud'], source: kitSource('cloud.Node') }
    ]);
    bootstrap();
    const result = loadKitModules({ htmlData: html, rootDir: root, warn: () => {} });

    expect(result.loaded).toEqual(['Alpha Kit']);
    expect(globalThis.__noodl_modules.map((m) => m.name)).toEqual(['Alpha Kit']);
    // The control: it is absent from the page, which is WHY it is absent here. Asserting only the
    // second would not distinguish "correctly skipped" from "the loader dropped it".
    expect(html).not.toContain('cloud-kit');
  });

  it('costs a throwing kit its own nodes and nothing else', () => {
    const { root, html } = makeDeploy([
      { dir: 'broken-kit', name: 'Broken Kit', source: `throw new Error('kaboom');` },
      { dir: 'alpha-kit', name: 'Alpha Kit', source: kitSource('alpha.Node') }
    ]);
    bootstrap();
    const warnings = [];
    const result = loadKitModules({ htmlData: html, rootDir: root, warn: (m) => warnings.push(m) });

    expect(result.failures).toHaveLength(1);
    expect(result.failures[0].module).toBe('Broken Kit');
    expect(result.failures[0].message).toContain('kaboom');
    // The one that matters: the healthy kit after it still loaded.
    expect(result.loaded).toEqual(['Alpha Kit']);
    // Loud, never silent — and the warning says what the author will actually observe.
    expect(warnings.join('\n')).toContain('hydration mismatch');
  });

  it('names a kit that touches the DOM at import time rather than faking one for it', () => {
    // ⚠️ **This row's premise moved with ✅ D19 and its title moved with it** — the same rule the
    // header states about the absence assertion. It used to read *"touches `window`"*, and until
    // s29 `window` itself was what a kit tripped over. `window` is now shimmed with `React` on it,
    // so the thing still deliberately absent is the DOM: faking one would let a kit register nodes
    // that cannot render server-side anyway, trading a named failure for a silent one.
    const { root, html } = makeDeploy([
      { dir: 'dommy-kit', name: 'Dommy Kit', source: `document.createElement('div');` }
    ]);
    bootstrap();
    const result = loadKitModules({ htmlData: html, rootDir: root, warn: () => {} });

    expect(result.loaded).toEqual([]);
    expect(result.failures[0].module).toBe('Dommy Kit');
    expect(globalThis.__noodl_modules).toEqual([]);
  });

  describe('✅ D19 — `window` is a React shim for exactly as long as kits are loading', () => {
    /**
     * 🔴 **The kit written the way this repository documents it.** Every kit in s27's fixture — and
     * the scaffold's own output, and the worked example on the docs page — opened
     * `var React = window.React;`. Under SSR there was no `window`, so all four threw at import and
     * **no kit node reached a server render**: the client hydrated with them present and the server
     * had rendered without them. That is the hydration mismatch D19 exists to end.
     *
     * ⚠️ Asserted on the React the kit actually captured, not on "it did not throw". A shim
     * carrying a *different* React would load the kit and then break hooks, which is the failure
     * this would otherwise wave through.
     */
    const legacyKit = (typeName) => `
      var React = window.React;
      Noodl.defineModule({ name: undefined, nodes: [{ name: '${typeName}', category: 'Math', capturedReact: React }] });
    `;

    it('🔴 loads a kit written to the documented `window.React` pattern, with the REAL React', () => {
      const { root, html } = makeDeploy([
        { dir: 'legacy-kit', name: 'Legacy Kit', source: legacyKit('legacy.Node') }
      ]);
      bootstrap();
      const result = loadKitModules({ htmlData: html, rootDir: root, warn: () => {} });

      expect(result.failures).toEqual([]);
      expect(result.loaded).toEqual(['Legacy Kit']);
      // Identity, not truthiness: two Reacts on one page is the defect the global exists to avoid.
      expect(globalThis.__noodl_modules[0].nodes[0].capturedReact).toBe(globalThis.React);
    });

    it('🔴 carries React and NOTHING else — a kit reaching further is still named', () => {
      // The control on the row above. If the shim grew a `document`, this kit would load and
      // register a node that cannot render server-side: a named failure traded for a silent one.
      const { root, html } = makeDeploy([
        { dir: 'greedy-kit', name: 'Greedy Kit', source: `window.document.createElement('div');` }
      ]);
      bootstrap();
      const result = loadKitModules({ htmlData: html, rootDir: root, warn: () => {} });

      expect(result.loaded).toEqual([]);
      expect(result.failures[0].module).toBe('Greedy Kit');
    });

    it('🔴 removes the shim before the render — `window` is undefined on the way out', () => {
      /*
       * ⚠️ The failure this pins is one layer down from the shim. `viewer.jsx` guards on
       * `typeof window !== 'undefined'` and so does the runtime's client-only deferral; a `window`
       * left standing would flip both to their BROWSER branch on the server, which is a worse
       * version of the bug the shim fixes.
       */
      const { root, html } = makeDeploy([
        { dir: 'alpha-kit', name: 'Alpha Kit', source: kitSource('alpha.Node') }
      ]);
      bootstrap();
      expect(typeof globalThis.window).toBe('undefined');
      loadKitModules({ htmlData: html, rootDir: root, warn: () => {} });
      expect(typeof globalThis.window).toBe('undefined');
    });

    it('removes it even when a kit throws', () => {
      const { root, html } = makeDeploy([
        { dir: 'broken-kit', name: 'Broken Kit', source: `throw new Error('kaboom');` }
      ]);
      bootstrap();
      loadKitModules({ htmlData: html, rootDir: root, warn: () => {} });
      expect(typeof globalThis.window).toBe('undefined');
    });

    it('is one object shared by every script, the way a browser shares one', () => {
      // A kit's `manifest.dependencies` are separate `<script>` tags, and a UMD dependency
      // publishes onto `window` for the kit that follows to read back. A per-script shim would
      // break exactly the kits that declare dependencies.
      const { root, html } = makeDeploy([
        { dir: 'dep-kit', name: 'Dep Kit', source: `window.__depMarker = 'published';` },
        {
          dir: 'reader-kit',
          name: 'Reader Kit',
          source: `Noodl.defineModule({ nodes: [{ name: 'reader.Node', category: 'Math', saw: window.__depMarker }] });`
        }
      ]);
      bootstrap();
      const result = loadKitModules({ htmlData: html, rootDir: root, warn: () => {} });

      expect(result.failures).toEqual([]);
      const reader = globalThis.__noodl_modules.find((m) => m.nodes[0].name === 'reader.Node');
      expect(reader.nodes[0].saw).toBe('published');
    });

    it('refuses to touch a `window` somebody else owns — during the load, not just after it', () => {
      /*
       * ⚠️ A jsdom-based host, or a future runtime, may have installed a real one, and a kit run
       * under it should see THAT window.
       *
       * 🔴 **Asserted from inside a kit, because the after-the-fact check cannot see this.** A
       * shim that clobbers the host window and then restores it on the way out leaves
       * `globalThis.window === sentinel` at the end and passes an identity check — the mutant that
       * deletes this guard survived exactly that test. What the host loses is the load itself: its
       * `document`, and anything it published for kits to read.
       */
      const sentinel = { React: { notOurs: true }, document: {}, __hostMarker: 'host' };
      globalThis.window = sentinel;
      try {
        const { root, html } = makeDeploy([
          {
            dir: 'host-kit',
            name: 'Host Kit',
            source: `Noodl.defineModule({ nodes: [{ name: 'host.Node', category: 'Math', saw: window.__hostMarker, sawDocument: typeof window.document }] });`
          }
        ]);
        bootstrap();
        const result = loadKitModules({ htmlData: html, rootDir: root, warn: () => {} });

        expect(result.failures).toEqual([]);
        expect(globalThis.__noodl_modules[0].nodes[0].saw).toBe('host');
        expect(globalThis.__noodl_modules[0].nodes[0].sawDocument).toBe('object');
        expect(globalThis.window).toBe(sentinel);
      } finally {
        delete globalThis.window;
      }
    });
  });

  it('finds a kit that exists only under public/, and reports one that exists nowhere', () => {
    const { root, html } = makeDeploy([{ dir: 'alpha-kit', name: 'Alpha Kit', source: kitSource('alpha.Node') }]);
    // Remove the root copy, keeping only the browser layer.
    fs.rmSync(path.join(root, 'noodl_modules'), { recursive: true, force: true });
    bootstrap();
    expect(loadKitModules({ htmlData: html, rootDir: root, warn: () => {} }).loaded).toEqual(['Alpha Kit']);

    // ...and now neither copy exists: skipped with a reason, never silently.
    fs.rmSync(path.join(root, 'public', 'noodl_modules'), { recursive: true, force: true });
    delete globalThis.__noodl_modules;
    bootstrap();
    const warnings = [];
    const gone = loadKitModules({ htmlData: html, rootDir: root, warn: (m) => warnings.push(m) });
    expect(gone.loaded).toEqual([]);
    expect(gone.skipped).toEqual(['/noodl_modules/alpha-kit/index.js']);
    expect(warnings.join('\n')).toContain('file not found');
  });
});

describe('the SSR entries call it', () => {
  /**
   * 🔴 **REPLACES the row that asserted the opposite.** It used to read *"no file that runs
   * server-side loads a kit, which is why the list stays empty"* and scanned the directory to prove
   * nothing there named `noodl_modules`. That was true, and it was the defect. The same scan now
   * grades the fix.
   *
   * ⚠️ It is a source-level row on purpose: `index.js` and `ssg.js` are **templates** carrying
   * `{{#export#}}`, so they cannot be required. Without it, every row above would keep passing on a
   * loader that no entry point calls — which is precisely the state this task found.
   */
  it('🔴 both the SSR server and the SSG build load kits before rendering', () => {
    for (const entry of ['index.js', 'ssg.js']) {
      const text = fs.readFileSync(path.join(SSR_DIR, entry), 'utf8');
      expect(text).toContain("require('./kit-modules')");
      expect(text).toContain('loadKitModules(');
    }
  });

  it('🔴 the control — the loader is reached BEFORE the module list is handed to renderPage', () => {
    // Order is the whole feature here, unlike in the cloud runner where the equivalent claim turned
    // out to be false. `renderPage` reads `globalThis.__noodl_modules` at call time, so a load that
    // happened after the first render would leave that page — and only that page — kitless.
    for (const entry of ['index.js', 'ssg.js']) {
      const text = fs.readFileSync(path.join(SSR_DIR, entry), 'utf8');
      expect(text.indexOf('loadKitModules(')).toBeLessThan(text.indexOf('renderPage('));
    }
  });
});
