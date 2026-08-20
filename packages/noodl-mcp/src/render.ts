/**
 * LAS-005 — the render loop, reachable from the MCP surface.
 *
 * Doctrine §11 is "you have not finished until you have looked at it", and until
 * now an external agent had no way to. Every other tool here reasons about the
 * graph, and a graph is a claim: the phase-55 audit measured a mid-tier model
 * producing a correctly architected page that rendered four identical blocks of
 * the literal word "Text", and a strong model shipping a photograph of a
 * motorcycle for a bud vase after curl-verifying that its URL returned 200.
 * Neither is visible anywhere except in the picture.
 *
 * ## Why a child process rather than an import
 *
 * The measurement lives in `scripts/devtools/render-report.js`, in plain JS,
 * because it depends on repo layout — the sibling `render-from-disk.js`, the
 * built viewer bundle, the generated node catalog — and a bundled standalone
 * artifact could not run it whatever we did. Given that, running the CLI as a
 * child process buys three things over a dynamic `require`: esbuild has nothing
 * to resolve, a Chrome that wedges cannot take this server down with it, and
 * there is exactly one implementation shared with the CLI humans already use.
 *
 * Absence is reported as a sentence naming the fix, never as a crash — the same
 * rule the rejection diagnostics follow.
 *
 * @module noodl-mcp/render
 */

import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

import { ToolError } from './errors';

/** One thing the render found wrong, in the render's own vocabulary. */
export interface RenderFindingPayload {
  code: string;
  severity: 'error' | 'warning' | 'info';
  viewport: string;
  message: string;
  /**
   * The `DiagnosticCode` naming the same defect from the graph side, when there
   * is one. Present so LAS-007's example table can key on one string rather than
   * on two vocabularies — see the module note in `render-report.js`.
   */
  relatedDiagnostic?: string;
  /**
   * AWP-003 — for a `blank-render`, which cause the graph walk *determined*, as
   * one of `BlankCause`. A blank page used to come back with a sentence naming
   * the two causes its author knew about, and DeepSeek V4 Pro had neither; this
   * field is the machine-readable half of answering the question properly.
   */
  cause?: string;
  evidence?: unknown;
}

export interface RenderViewportPayload {
  requested: { width: number; height: number };
  layoutWidth: number;
  clientWidth: number;
  scrollWidth: number;
  pageHeight: number;
  text: { elements: number; fontWeights: Record<string, number>; distinctFontSizes: number; bodyFontFamily: string };
  placeholders: { count: number; byText: Record<string, number> };
  images: { total: number; broken: number; brokenSources: string[] };
  emptyDecoratedBoxes: { count: number };
  [key: string]: unknown;
}

export interface RenderReportPayload {
  project: string;
  projectName?: string;
  durationMs: number;
  tokens: string;
  viewports: Record<string, RenderViewportPayload>;
  findings: RenderFindingPayload[];
  summary: string;
}

export interface RenderScreenshot {
  name: string;
  mimeType: string;
  base64: string;
}

export interface RenderOptions {
  viewports?: string;
  screenshot?: 'full' | 'viewport' | 'none';
  scale?: number;
  backendPort?: number;
  timeoutMs?: number;
  /** EL-009 AC1/AC3 — measure only this page, by `urlPath` or component name. */
  page?: string;
}

/**
 * The ceiling, not the cost.
 *
 * A one-page project is two viewports, a boot and two reflow settles: **7.3s
 * measured** (2026-08-20), which is what this number was set against.
 *
 * 🔴 **UNI-010 §8.2 changed the arithmetic.** The harness now renders every
 * routed page rather than the start page alone, and each extra page costs one
 * navigation settle plus one measurement per viewport — **~4.3s measured**, from
 * an eight-page project at **40.9s** against the same project's 7.3s single-page
 * predecessor. At the old 90s that put the cliff at roughly **twenty pages**,
 * where a large but perfectly ordinary project would start being killed mid-run
 * for no reason its author could see. Raised so the ceiling stays a backstop
 * against a hang instead of a cap on project size.
 */
export const RENDER_TIMEOUT_MS = 240_000;

/**
 * Whether a tool may render *without being asked to*.
 *
 * Only `apply_plan`'s automatic summary consults this. `render_report` does not:
 * a caller who names the tool has asked, and an explicit request that silently
 * does nothing is worse than a slow one.
 *
 * It exists for the test suite, where the eight seconds a real render costs
 * would otherwise be paid by every plan spec — and for the same reason a CI job
 * or a headless container with no Chrome wants it: the write is the thing under
 * test, not the picture.
 */
export function automaticRenderDisabled(): boolean {
  return process.env.NODEGX_RENDER_DISABLED === '1';
}

/**
 * The CLI, or null with everything probed.
 *
 * The two relative candidates cover being loaded from `src/` (ts-jest, `npx
 * tsx`) and from `dist/` (the bundle) — the same shape as `resolveServiceEntry`
 * in `backend/provision.ts`, and for the same reason: there is no
 * `app.getAppPath()` here.
 *
 * ⚠️ It diverges from `resolveServiceEntry` in one deliberate way: a
 * `NODEGX_RENDER_CLI` that points at nothing is an **error**, not a fall-through
 * to auto-discovery. Setting the variable is a deliberate act, so a typo in it
 * should say so — and silently falling back is worse than useless here, because
 * in a repo checkout the fallback exists and spawns a real Chrome. The spec that
 * meant to assert "no harness at all" instead waited eight seconds for one.
 */
export function resolveRenderCli(): { entry: string | null; probed: string[]; overrideMissing?: string } {
  const probed: string[] = [];
  const push = (p: string): string | null => {
    probed.push(p);
    return fs.existsSync(p) ? p : null;
  };

  const override = process.env.NODEGX_RENDER_CLI;
  if (override) {
    const found = push(override);
    return found ? { entry: found, probed } : { entry: null, probed, overrideMissing: override };
  }
  const candidates = [
    // From src/, and from dist/ or src/tools/.
    path.resolve(__dirname, '..', '..', '..', 'scripts', 'devtools', 'measure-from-disk.js'),
    path.resolve(__dirname, '..', '..', '..', '..', 'scripts', 'devtools', 'measure-from-disk.js'),
    /**
     * UNI-012 — the packaged install.
     *
     * The sidecar runs from `<Resources>/noodl-mcp/noodl-mcp.cjs`, and the
     * harness ships **inside `app.asar`** rather than beside it. That is not
     * where the other sidecars live, and the reason is worth stating: the asar
     * already carries the 14MB viewer bundle, `ws` and `@nodegx/render-measure`,
     * so putting the harness in there costs three small files and an ordinary
     * `require`, while putting it outside would mean duplicating the viewer or
     * hand-resolving every dependency.
     *
     * 🔴 This resolves because the sidecar's own runtime is the Electron binary
     * under `ELECTRON_RUN_AS_NODE=1`, which reads and executes inside an asar.
     * Plain Node does not — see `harness-paths.js` for the four measurements.
     */
    path.resolve(__dirname, '..', 'app.asar', 'render-harness', 'measure-from-disk.js'),
    path.resolve(__dirname, '..', '..', 'app.asar', 'render-harness', 'measure-from-disk.js')
  ];
  for (const candidate of candidates) {
    const found = push(candidate);
    if (found) return { entry: found, probed };
  }
  return { entry: null, probed };
}

function spawnRender(entry: string, args: string[], timeoutMs: number): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    /**
     * 🔴 `ELECTRON_RUN_AS_NODE` is set explicitly rather than inherited.
     *
     * `process.execPath` is the Electron binary on a packaged install, and the
     * sidecar is registered with this variable set — so the child inherited it
     * and the harness ran. Relying on that is a load-bearing accident: without
     * it the same binary boots as a full Electron *app*, with a dock icon and an
     * event loop that never exits, and the render would hang rather than fail.
     * In a checkout `process.execPath` is plain `node`, which ignores it.
     */
    const child = spawn(process.execPath, [entry, ...args], {
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' }
    });
    let stdout = '';
    let stderr = '';
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill('SIGKILL');
    }, timeoutMs);

    child.stdout.on('data', (d) => (stdout += d));
    child.stderr.on('data', (d) => (stderr += d));
    child.on('error', (err) => {
      clearTimeout(timer);
      reject(err);
    });
    child.on('close', () => {
      clearTimeout(timer);
      if (timedOut) {
        reject(new Error(`The render did not finish within ${Math.round(timeoutMs / 1000)}s and was killed.`));
        return;
      }
      resolve({ stdout, stderr });
    });
  });
}

/**
 * Render a project and measure it.
 *
 * Throws a `ToolError` whose message names the fix when the environment cannot
 * do it at all (no viewer bundle, no Chrome, not a v2 project). A page with
 * defects is **not** a failure: the report is the verdict, and it comes back
 * with findings in it.
 */
export async function runRenderReport(
  projectDir: string,
  options: RenderOptions = {}
): Promise<{ report: RenderReportPayload; screenshots: RenderScreenshot[] }> {
  const { entry, probed, overrideMissing } = resolveRenderCli();
  if (overrideMissing) {
    throw new ToolError(
      'io-error',
      `NODEGX_RENDER_CLI points at "${overrideMissing}", which does not exist. Point it at the render harness ` +
        '(scripts/devtools/measure-from-disk.js), or unset it — a packaged install then uses the harness ' +
        'shipped inside the app, and a source checkout the one beside this server.',
      { probed }
    );
  }
  if (!entry) {
    /**
     * 🔴 UNI-012 rewrote this sentence, and the direction of the old one is the
     * point. It said *"render_report needs the repo checkout … or run this
     * server from a checkout"*, which was true while `scripts/` shipped with
     * nothing. A packaged install now carries the harness, so on the install
     * where this message is most likely to be read, the old text sent someone
     * to clone a repository to fix what is actually a broken installation — or,
     * more often, a missing browser it never mentioned.
     */
    throw new ToolError(
      'io-error',
      'The render harness could not be located, so the page cannot be rendered or measured. On a packaged ' +
        'install it ships inside the app and this means the installation is incomplete — reinstall NodeGX. ' +
        'From a source checkout, run this server from the checkout or set NODEGX_RENDER_CLI to ' +
        'scripts/devtools/measure-from-disk.js. If you only need the write and not the picture, ' +
        'allow_unrendered writes the bundle with the render check deliberately unanswered.',
      { probed }
    );
  }

  const screenshot = options.screenshot ?? 'full';
  const args = [projectDir, '--json', '--screenshot', screenshot];
  if (screenshot !== 'none') args.push('--inline-screenshots', '--scale', String(options.scale ?? 0.4));
  if (options.viewports) args.push('--viewports', options.viewports);
  if (options.backendPort) args.push('--backend-port', String(options.backendPort));
  if (options.page) args.push('--page', options.page);

  const { stdout, stderr } = await spawnRender(entry, args, options.timeoutMs ?? RENDER_TIMEOUT_MS);

  let parsed: (RenderReportPayload & { screenshots?: RenderScreenshot[] }) | { error: RenderCliError };
  try {
    parsed = JSON.parse(stdout);
  } catch {
    throw new ToolError('io-error', `The render harness produced no report. ${stderr.trim().slice(0, 500)}`);
  }

  if ('error' in parsed && parsed.error) {
    throw new ToolError('io-error', parsed.error.problems.join(' '), { problems: parsed.error.problems });
  }

  const { screenshots = [], ...report } = parsed as RenderReportPayload & { screenshots?: RenderScreenshot[] };
  return { report, screenshots };
}

interface RenderCliError {
  actionable: boolean;
  message: string;
  problems: string[];
}
