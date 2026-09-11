/**
 * CN-003 — a kit can say its own name.
 *
 * ## The defect, and why it survived so long
 *
 * `NoodlRuntime.registerModule` names a module from the object a kit passes to
 * `Noodl.defineModule`, falling back to the literal string `'Unknown Module'`.
 * **No kit sets that name** — not this repo's reference kits, not the fixtures —
 * because a kit's `index.js` has no idea what its own `manifest.json` says. So
 * every kit node in the editor reported `module: 'Unknown Module'`, the node
 * picker's section for a project's own nodes was headed by the empty string, and
 * ✅ **D1**'s property-panel provenance ("from Cashflow Kit v1.2") had nothing to
 * read. The manifest held the answer the entire time and nobody handed it to the
 * viewer.
 *
 * Measured from the other side in CN-003 slice 3: the MCP route (which reads the
 * manifest) said `'Demo Kit'` and the editor route said `'Unknown Module'` for
 * the same kit — a disagreement `compareOverlays` was not comparing.
 *
 * ## What is graded here
 *
 * The **runtime half**: `@nodegx/module-inject` sets `window.__noodl_module_name`
 * immediately before each kit's script tag (graded in that package's suite), and
 * the bootstraps adopt it in `defineModule`. This file runs the real
 * `installRuntimeGlobals` — the SSR bootstrap, exported and therefore reachable
 * without a browser — rather than a copy of its three lines, because a test that
 * restates the code under test grades nothing.
 *
 * 🔴 **The capture has to happen in `defineModule` and not in `registerModule`.**
 * The runtime iterates `__noodl_modules` long after every script has run, when
 * the global holds the *last* kit's name. The two-kit test below is what would
 * fail if someone "simplified" it later.
 */

const { installRuntimeGlobals } = require('../static/ssr/runtime-globals');

function bootstrap() {
  // The globals installer wants a React-shaped set of deps; none of them are
  // touched by `defineModule`, so stubs are honest here.
  installRuntimeGlobals({
    React: {},
    ReactDOMServer: {},
    XMLHttpRequest: function XMLHttpRequest() {},
    fetch: () => Promise.resolve()
  });
}

afterEach(() => {
  delete globalThis.__noodl_module_name;
  delete globalThis.__noodl_modules;
  delete globalThis.Noodl;
});

describe('defineModule adopts the injected manifest name', () => {
  it('names a module that does not name itself', () => {
    bootstrap();
    globalThis.__noodl_module_name = 'Demo Kit';
    globalThis.Noodl.defineModule({ reactNodes: [{ name: 'demo.kit.Badge' }] });

    expect(globalThis.__noodl_modules[0].name).toBe('Demo Kit');
  });

  it('gives each kit its own name, not the last one loaded', () => {
    // 🔴 The reason the capture lives in `defineModule`. Both scripts have run
    // by the time anything reads this array, and the global is single-valued.
    bootstrap();
    globalThis.__noodl_module_name = 'First Kit';
    globalThis.Noodl.defineModule({ reactNodes: [{ name: 'first.Node' }] });
    globalThis.__noodl_module_name = 'Second Kit';
    globalThis.Noodl.defineModule({ reactNodes: [{ name: 'second.Node' }] });

    expect(globalThis.__noodl_modules.map((m) => m.name)).toEqual(['First Kit', 'Second Kit']);
  });

  it('never overwrites a name the module set for itself', () => {
    // A kit that names itself is being explicit; the injector's marker is a
    // fallback for the overwhelmingly common case where it did not.
    bootstrap();
    globalThis.__noodl_module_name = 'From The Manifest';
    globalThis.Noodl.defineModule({ name: 'Set By The Kit', reactNodes: [] });

    expect(globalThis.__noodl_modules[0].name).toBe('Set By The Kit');
  });

  it('leaves the module untouched when no marker was set', () => {
    // An older page — or a module loaded by something that is not the injector
    // — must behave exactly as it did before. `registerModule`'s own
    // `'Unknown Module'` fallback still applies downstream; what must not happen
    // is this layer inventing a name.
    bootstrap();
    globalThis.Noodl.defineModule({ reactNodes: [] });

    expect(globalThis.__noodl_modules[0].name).toBeUndefined();
  });
});
