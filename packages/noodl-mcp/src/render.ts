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
}

/** Two viewports, a boot and two reflow settles: ~7.5s measured. This is the ceiling, not the cost. */
export const RENDER_TIMEOUT_MS = 90_000;

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
    path.resolve(__dirname, '..', '..', '..', '..', 'scripts', 'devtools', 'measure-from-disk.js')
  ];
  for (const candidate of candidates) {
    const found = push(candidate);
    if (found) return { entry: found, probed };
  }
  return { entry: null, probed };
}

function spawnRender(entry: string, args: string[], timeoutMs: number): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [entry, ...args], { stdio: ['ignore', 'pipe', 'pipe'] });
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
        '(scripts/devtools/measure-from-disk.js) or unset it to use the checkout beside this server.',
      { probed }
    );
  }
  if (!entry) {
    throw new ToolError(
      'io-error',
      'The render harness is not present in this installation — render_report needs the repo checkout ' +
        '(scripts/devtools/measure-from-disk.js). Set NODEGX_RENDER_CLI to it, or run this server from a ' +
        'checkout.',
      { probed }
    );
  }

  const screenshot = options.screenshot ?? 'full';
  const args = [projectDir, '--json', '--screenshot', screenshot];
  if (screenshot !== 'none') args.push('--inline-screenshots', '--scale', String(options.scale ?? 0.4));
  if (options.viewports) args.push('--viewports', options.viewports);
  if (options.backendPort) args.push('--backend-port', String(options.backendPort));

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
