/**
 * CN-013 — what happens to a kit under SSR/SSG, measured rather than inferred.
 *
 * ## The inference this replaces
 *
 * CN-013's own spec says the SSR path *"is module-aware by construction"*: `runtime-globals.js`
 * sets `globalThis.Noodl` and `globalThis.__noodl_modules`, and `index.js` passes them into the
 * server render, so a kit node *"plausibly does"* render. The globals are indeed set. **Nothing
 * ever puts anything in them.**
 *
 * In a browser a kit reaches the runtime because `@nodegx/module-inject` writes a `<script>` tag
 * per kit into the page and the browser executes it. Server-side there is no browser: the SSR
 * template requires exactly two things — `./runtime-globals` and `./noodl.deploy` — and **no kit's
 * `index.js` is `require`d, read, or evaluated anywhere in `static/ssr/`**. `defineModule` is
 * therefore never called, `__noodl_modules` is still `[]` when `renderPage` reads it, and the
 * runtime is handed an empty module list.
 *
 * 🔴 **The consequence is worse than a blank, and it is the shape CN-001 found in the render
 * harness.** The kit's `<script>` tags *are* in `public/index.html` — the deploy's HtmlProcessor
 * injects them and `noodl_modules/` ships verbatim — so the **client** loads the kit and the
 * **server** does not. The server renders the page with the kit's nodes missing (an unregistered
 * type is logged and skipped *with its connections*), and hydration then renders a different tree.
 *
 * ## What this file measures, and what it does not
 *
 * ✅ Measured here: the receiving mechanism works and the caller is absent — the bootstrap's
 * `defineModule` accepts a kit correctly when something calls it, and `__noodl_modules` is empty
 * when nothing does.
 *
 * ⚠️ **NOT measured here: a rendered SSR page.** Establishing the visible consequence needs a real
 * `ssr` deploy of a project with a kit, served and fetched — see `notes/cn-013-ssr.md` for the
 * drive that closes CN-013 AC1's second half. The rows below are deliberately about the seam, and
 * saying so is the point: a suite that quietly implied it had rendered a page would be the same
 * error this task exists to correct.
 *
 * 🔴 **The absence row has a known-firing signal beside it.** "`__noodl_modules` is empty" on its
 * own is also what a broken bootstrap produces, and the two have opposite fixes. The control
 * evaluates a kit's source the way a script tag would, in the same globals, and observes the list
 * become 1 — so the empty reading is attributable to *nothing calling it*, not to *it not working*.
 */

const fs = require('fs');
const path = require('path');

const { installRuntimeGlobals } = require('../static/ssr/runtime-globals');

/** The SSR directory as it is deployed — every file that runs server-side. */
const SSR_DIR = path.join(__dirname, '..', 'static', 'ssr');

function bootstrap() {
  installRuntimeGlobals({
    React: {},
    ReactDOMServer: {},
    XMLHttpRequest: function XMLHttpRequest() {},
    fetch: () => Promise.resolve()
  });
}

/** A kit's entry script, in the shape a real one is written in. */
const KIT_SOURCE = `
(function () {
  function defineNodes(N) { N.defineModule({ nodes: [{ name: 'ssr.kit.Probe', category: 'Math' }] }); }
  if (typeof Noodl !== 'undefined') defineNodes(Noodl);
  else if (typeof window !== 'undefined' && window.Noodl) defineNodes(window.Noodl);
})();
`;

afterEach(() => {
  delete globalThis.__noodl_module_name;
  delete globalThis.__noodl_modules;
  delete globalThis.Noodl;
});

describe('a kit under SSR: the globals are set and nothing fills them', () => {
  it('leaves __noodl_modules empty after the whole server-side bootstrap', () => {
    bootstrap();
    // This is the value `index.js:68` and `ssg.js:68` hand to `renderPage` as `noodlModules`.
    expect(globalThis.__noodl_modules).toEqual([]);
  });

  it('🔴 the control — the same globals accept a kit the moment anything runs its script', () => {
    // Known-firing signal beside the absence above. `new Function('Noodl', src)` is what a
    // `<script>` tag does for the browser, reduced to its essentials.
    bootstrap();
    globalThis.__noodl_module_name = 'SSR Probe Kit';
    // eslint-disable-next-line no-new-func
    new Function('Noodl', KIT_SOURCE)(globalThis.Noodl);

    expect(globalThis.__noodl_modules).toHaveLength(1);
    expect(globalThis.__noodl_modules[0].name).toBe('SSR Probe Kit');
    expect(globalThis.__noodl_modules[0].nodes[0].name).toBe('ssr.kit.Probe');
  });

  it('🔴 no file that runs server-side loads a kit, which is why the list stays empty', () => {
    // The mechanism behind the two rows above, stated where it can go stale loudly. If someone
    // adds an SSR kit loader, this row goes red and the file's whole premise gets re-read — which
    // is exactly what should happen.
    const serverSide = fs
      .readdirSync(SSR_DIR)
      .filter((f) => f.endsWith('.js'))
      .map((f) => ({ file: f, text: fs.readFileSync(path.join(SSR_DIR, f), 'utf8') }));

    // Sanity: the scan found the templates, so an empty result below means "nothing loads kits"
    // rather than "nothing was read".
    expect(serverSide.map((s) => s.file)).toEqual(expect.arrayContaining(['index.js', 'ssg.js', 'runtime-globals.js']));

    // A loader would have to name the DIRECTORY the kits live in.
    //
    // ⚠️ The first version of this row asserted on the bare substring `noodl_modules` and went red
    // on three files — because `__noodl_modules`, the global holding the list, contains it. A
    // predicate is a hypothesis, and that one said "loads a kit" while meaning "mentions the
    // word". The global is stripped first so what is left is the directory reference a real
    // loader would need.
    const withoutTheGlobal = serverSide.map((s) => ({ file: s.file, text: s.text.split('__noodl_modules').join('') }));

    // The strip works: the global's own home no longer matches, and it is the file most likely to.
    expect(withoutTheGlobal.find((s) => s.file === 'runtime-globals.js').text).not.toContain('noodl_modules');

    const mentionsKitDir = withoutTheGlobal.filter((s) => s.text.includes('noodl_modules'));
    expect(mentionsKitDir.map((s) => s.file)).toEqual([]);
  });
});
