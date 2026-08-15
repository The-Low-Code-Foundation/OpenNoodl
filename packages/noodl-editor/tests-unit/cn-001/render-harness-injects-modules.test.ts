/**
 * CN-001 — the render harness must emit a project's module script tags.
 *
 * ## What broke, and why a normal test would not have caught it
 *
 * `scripts/devtools/render-from-disk.js` is the server half of `render_report`,
 * the MCP tool that exists so an agent can *look* rather than assume. It built
 * its own `<head>` as a template literal with two hardcoded module stylesheets
 * and never called the injector, so a project using a custom node — a
 * `noodl_modules` kit — rendered **without that node**. Measured on the drive
 * fixture before the fix: 2 text elements instead of 4, zero findings, zero
 * console errors, and the summary line *"Rendered clean"*. An agent authoring
 * correctly would have got a green report on a page missing its work.
 *
 * That is the second of the two ways an instrument lies — not a check that
 * rejects a correct answer, but **a probe that silently exonerates** — and it is
 * the reason these assertions are shaped the way they are.
 *
 * ## Why this asserts on the TAG and never on "the render is non-blank"
 *
 * A blank has too many causes. `the-render-harnesss-blank-rule-is-two-numbers`
 * records that the blank rule is already subtle, and a test whose failure mode
 * is "the page looked empty" tells the next reader nothing about which of a
 * dozen things went wrong. The emitted tag is the single fact this task is
 * about: it is present or it is not, and no browser is needed to see it. That
 * also keeps this in the plain-Node suite (`npm run test:main`) rather than the
 * Electron one.
 *
 * ## The controls
 *
 * Three assertions here exist only so the other assertions can fail:
 *
 *  - the **no-modules project** — the same assertion run where the tag must be
 *    absent, so a grep that always passed would be caught;
 *  - the **cloud-only kit** — declares no browser runtime, so the `runtimes`
 *    filter must drop it. If the injector ever stops filtering, this fails
 *    rather than quietly widening what reaches a browser;
 *  - the **ordering** assertion — a module `<script>` emitted before the
 *    `Noodl.defineModule` shim, or after the viewer bundle has already read
 *    `__noodl_modules`, is indistinguishable at render time from not being
 *    emitted at all. A test that only checked "the tag is somewhere in the
 *    HTML" would go green on a page that still renders nothing.
 */
import { execFileSync } from 'child_process';
import * as path from 'path';

const REPO = path.resolve(__dirname, '../../../..');
const RENDER_FROM_DISK = path.join(REPO, 'scripts/devtools/render-from-disk.js');
const KIT_PROJECT = path.join(__dirname, 'fixtures/kit-project');
const NO_MODULES_PROJECT = path.join(__dirname, 'fixtures/no-modules-project');

/**
 * `--print-html` exists for this: the page without a port, a browser, or a
 * built viewer bundle. Added by CN-001 alongside the long-standing
 * `--print-project`, which serves the same purpose for the export contract.
 */
function renderedHtml(projectDir: string): string {
  return execFileSync(process.execPath, [RENDER_FROM_DISK, projectDir, '--print-html'], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe']
  });
}

describe('CN-001: render-from-disk injects noodl_modules', () => {
  let html: string;

  beforeAll(() => {
    html = renderedHtml(KIT_PROJECT);
  });

  it("emits the kit's index.js as a script tag", () => {
    expect(html).toContain('<script type="text/javascript" src="/noodl_modules/demo-kit/index.js"></script>');
  });

  it("emits a stylesheet-only module's <link> and no script tag for it", () => {
    expect(html).toContain('<link href="/noodl_modules/demo-iconset/styles.css" rel="stylesheet">');
    expect(html).not.toContain('/noodl_modules/demo-iconset/index.js');
  });

  it('drops a module that declares no browser runtime', () => {
    // The positive control for the `runtimes` filter — see the header.
    expect(html).not.toContain('/noodl_modules/cloud-only-kit/');
  });

  it('emits the module script after the defineModule shim and before the viewer bundle', () => {
    const shim = html.indexOf('window.Noodl={defineModule:');
    const kit = html.indexOf('/noodl_modules/demo-kit/index.js');
    const viewer = html.indexOf('src="/noodl.viewer.js"');

    expect(shim).toBeGreaterThan(-1);
    expect(kit).toBeGreaterThan(-1);
    expect(viewer).toBeGreaterThan(-1);

    // A kit's index.js calls `Noodl.defineModule`, which must already exist;
    // `renderDeployed` then reads `__noodl_modules`, so the kit must have run
    // first. Both halves, or the tag is decorative.
    expect(kit).toBeGreaterThan(shim);
    expect(kit).toBeLessThan(viewer);
  });

  it('emits no module tags for a project with no noodl_modules', () => {
    // The instrument, run against an input where the answer must be "no" —
    // without this, an assertion that always passed would look identical.
    expect(renderedHtml(NO_MODULES_PROJECT)).not.toContain('/noodl_modules/');
  });
});
