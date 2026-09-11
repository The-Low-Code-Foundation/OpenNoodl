/**
 * EL-009 AC1 / AC3 — the caller can name a page, and a name nothing registers
 * is REFUSED.
 *
 * ## What was missing, and why the sweep did not cover it
 *
 * UNI-010 §8.2 gave the harness a sweep: every page the router registers is
 * visited, and a defect on page four stopped being certified `Rendered clean`.
 * That closed AC2 and it left AC3 open in a way worth stating precisely,
 * because "we render every page" sounds like it subsumes "we can render one".
 *
 * It does not. A sweep has **no wrong input**. It takes no path, so there is no
 * path to get wrong, so there was nothing for the instrument to reject — and an
 * instrument that cannot reject a wrong answer has not been shown to be reading
 * anything. AC3 is the control that only exists once AC1's path argument does.
 *
 * ## The three refusals, which are deliberately not one
 *
 * A caller who types a path that does not resolve is in one of three
 * situations, and they have different fixes:
 *
 *  - **a typo** — `deeep` for `deep`. The registered paths are listed, because
 *    the fix is to read them.
 *  - **a page that exists but this harness cannot address** — a `urlPath` with a
 *    route parameter, or no `urlPath` at all. Answering "no such page" here
 *    would be a lie about a page that is right there in the router, and would
 *    send someone hunting for a spelling mistake they did not make.
 *  - **a project with no router at all** — nothing is registered, so listing the
 *    registered pages would print an empty list and read as a bug in the tool.
 *
 * ## 🔴 Why the refusal must not be an empty report
 *
 * `renderReport` throws with `actionable` set — the channel
 * `checkPrerequisites` already uses — so `--json` callers get
 * `{error: {actionable: true, …}}` and a non-zero exit. Returning a report with
 * no findings would read as **"that page has no defects"**, which is the exact
 * failure mode this whole task exists to close, reintroduced at the door.
 *
 * ⚠️ And it is refused BEFORE Chrome starts. `render.ts` records what the other
 * shape costs: a spec that meant to assert "no harness at all" instead waited
 * eight seconds for one. Measured here at ~40ms against ~8.3s for a real render,
 * which is why the timing assertion below is worth its flakiness budget.
 */
import { execFileSync } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

const REPO = path.resolve(__dirname, '..', '..', '..', '..');
const CLI = path.join(REPO, 'scripts', 'devtools', 'measure-from-disk.js');
const FIXTURE = path.join(__dirname, 'fixtures', 'kit-on-page-three');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { routedPages, resolvePageRequest } = require(path.join(REPO, 'scripts', 'devtools', 'render-report.js'));

/** The fixture's real routes — three pages, `deep` third. */
const routes = () => routedPages(FIXTURE);

describe('EL-009 AC1 — the caller can name a page', () => {
  it('🔴 accepts the shapes a person actually types', () => {
    // `quiz`, `/quiz`, `#quiz`, `/#quiz` all name the same page. The hash forms
    // matter because the runtime's default `navigationPathType` IS hash, so a
    // URL copied out of a browser address bar carries one.
    for (const typed of ['deep', '/deep', '#deep', '/#deep']) {
      const resolved = resolvePageRequest(routes(), typed);
      expect({ typed, ok: resolved.ok, component: resolved.page?.component }).toEqual({
        typed,
        ok: true,
        component: '/Pages/Deep'
      });
    }
  });

  it('🔴 accepts the component name, because that is what the report prints back', () => {
    // `pages: 3/3 measured — /Pages/Home, /Pages/Middle, /Pages/Deep` is the
    // line a reader has in front of them, and pasting one back in is the
    // obvious next move.
    expect(resolvePageRequest(routes(), '/Pages/Deep').page.component).toBe('/Pages/Deep');
  });

  it('🔴 "/" and the empty string mean the start page, not a page called ""', () => {
    for (const typed of ['/', '']) expect(resolvePageRequest(routes(), typed).page.isStart).toBe(true);
  });
});

describe('EL-009 AC3 — a path no router registers is refused, distinctly', () => {
  it('🔴 CONTROL — a typo does not resolve to the nearest page, or to any page', () => {
    const resolved = resolvePageRequest(routes(), 'deeep');
    expect(resolved.ok).toBe(false);
    // Distinct: it says no page is registered there, and lists what is — so the
    // message is actionable without a second command.
    expect(resolved.message).toContain('no page registered at that path');
    expect(resolved.message).toContain('deep (/Pages/Deep)');
  });

  it('🔴 CONTROL — a registered page this harness cannot address says SO, not "no such page"', () => {
    // The two refusals have different fixes, and collapsing them would send
    // someone looking for a spelling mistake in a path that is spelled right.
    const withParam = {
      startPage: '/Pages/Home',
      pages: [
        { component: '/Pages/Home', urlPath: 'home', isStart: true, reachable: true, url: '/' },
        {
          component: '/Pages/Item',
          urlPath: 'item/{id}',
          isStart: false,
          reachable: false,
          unreachable: 'its urlPath "item/{id}" takes a route parameter, which this harness has no value for'
        }
      ]
    };
    const resolved = resolvePageRequest(withParam, 'item/{id}');
    expect(resolved.ok).toBe(false);
    expect(resolved.message).toContain('is registered as /Pages/Item');
    expect(resolved.message).toContain('takes a route parameter');
    expect(resolved.message).not.toContain('no page registered at that path');
  });

  it('✅ CONTROL — a project with no router says that, rather than printing an empty list', () => {
    const resolved = resolvePageRequest({ startPage: undefined, pages: [] }, 'deep');
    expect(resolved.ok).toBe(false);
    expect(resolved.message).toContain('registers no pages at all');
  });

  it('✅ CONTROL — the good path still resolves, so the refusals above are not a blanket "no"', () => {
    // Without this row, every assertion in this block would still pass if
    // `resolvePageRequest` refused everything it was ever handed.
    expect(resolvePageRequest(routes(), 'deep').ok).toBe(true);
  });
});

describe('EL-009 AC3 — the refusal reaches the caller as an error, not as a clean report', () => {
  jest.setTimeout(30_000);

  /** Run the CLI and hand back what a caller actually sees. */
  function run(args: string[]): { status: number; stdout: string; stderr: string } {
    try {
      const stdout = execFileSync(process.execPath, [CLI, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
      return { status: 0, stdout, stderr: '' };
    } catch (e: any) {
      return { status: e.status ?? -1, stdout: String(e.stdout ?? ''), stderr: String(e.stderr ?? '') };
    }
  }

  it('🔴 --json returns a machine-readable error and a non-zero exit, NOT an empty findings list', () => {
    const { status, stdout } = run([FIXTURE, '--screenshot', 'none', '--page', 'deeep', '--json']);
    const parsed = JSON.parse(stdout);

    // 🔴 The whole point. A caller that only checked `findings.length === 0`
    // would read a refused render as a clean one.
    expect(parsed.findings).toBeUndefined();
    expect(parsed.summary).toBeUndefined();
    expect(parsed.error.actionable).toBe(true);
    expect(parsed.error.message).toContain('no page registered at that path');
    expect(status).not.toBe(0);
  });

  it('🔴 refuses before starting a browser — measured against a real render, not asserted', () => {
    // A wall-clock assertion is a blunt instrument, so the bar is set an order
    // of magnitude below the thing it must exclude: a real one-viewport render
    // of this fixture measures ~8.3s, a refusal ~40ms. Anything under two
    // seconds cannot have booted Chrome, loaded a 14MB viewer bundle and
    // settled two reflows.
    const started = Date.now();
    const { status } = run([FIXTURE, '--screenshot', 'none', '--page', 'deeep', '--json']);
    const elapsed = Date.now() - started;

    expect(status).not.toBe(0);
    expect({ bootedABrowser: elapsed > 2000 }).toEqual({ bootedABrowser: false });
  });
});
