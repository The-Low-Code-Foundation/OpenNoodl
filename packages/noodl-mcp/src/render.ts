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
export interface ResolvedRenderCli {
  entry: string | null;
  /**
   * The runtime to spawn the harness with. `process.execPath` — unless the
   * harness was found inside an `app.asar` this process cannot read, in which
   * case it is the app's own Electron binary (see `viaElectron`).
   */
  exec: string;
  probed: string[];
  overrideMissing?: string;
  /**
   * P79 L3 — set when this sidecar is plain Node on a packaged install. The
   * harness ships inside `app.asar`, which only Electron's `fs` can read, and
   * BST-004's registration prefers `node <path>` whenever the machine has Node —
   * so on exactly the install most people have, `render_report` and every F4
   * refused with "could not be located" while the file was there. The harness
   * is run with the app binary under `ELECTRON_RUN_AS_NODE=1` instead.
   */
  viaElectron?: string;
  /** The asar held the harness but no app binary could be found beside it. */
  electronMissing?: true;
}

/**
 * Does this asar archive list `relative` (posix, no leading slash)?
 *
 * Plain Node's `fs` cannot see inside an asar, and `existsSync` answers false
 * for a file that is there. The archive header is a length-prefixed JSON
 * directory, so the question can be answered without Electron and without
 * the `asar` package: 16 bytes of pickle framing, then the header string.
 */
export function asarLists(archive: string, relative: string): boolean {
  let fd: number | undefined;
  try {
    fd = fs.openSync(archive, 'r');
    const framing = Buffer.alloc(16);
    fs.readSync(fd, framing, 0, 16, 0);
    const headerLength = framing.readUInt32LE(12);
    if (!(headerLength > 0 && headerLength < 64 * 1024 * 1024)) return false;
    const header = Buffer.alloc(headerLength);
    fs.readSync(fd, header, 0, headerLength, 16);
    let node = JSON.parse(header.toString('utf8')) as { files?: Record<string, unknown> } | undefined;
    for (const part of relative.split('/').filter(Boolean)) {
      const next = node?.files?.[part] as { files?: Record<string, unknown> } | undefined;
      if (!next) return false;
      node = next;
    }
    return node !== undefined && node.files === undefined;
  } catch {
    return false;
  } finally {
    if (fd !== undefined) fs.closeSync(fd);
  }
}

/** `<archive>.asar/<inner>` split at the archive, or `null` when the path names no asar. */
function splitAsarPath(candidate: string): { archive: string; inner: string } | null {
  const marker = `.asar${path.sep}`;
  const idx = candidate.indexOf(marker);
  if (idx === -1) return null;
  return {
    archive: candidate.slice(0, idx + 5),
    inner: candidate.slice(idx + marker.length).split(path.sep).join('/')
  };
}

/**
 * The app's own Electron binary, for a sidecar started with plain Node on a
 * packaged install — `<app>/Contents/MacOS/<name>` on macOS, `<app>/<name>.exe`
 * on Windows, `<app>/<name>` on Linux, all relative to `<Resources>/noodl-mcp`.
 */
export function findAppElectronBinary(fromDir: string): string | null {
  const isExecutableFile = (p: string): boolean => {
    try {
      const st = fs.statSync(p);
      if (!st.isFile()) return false;
      if (process.platform === 'win32') return true;
      fs.accessSync(p, fs.constants.X_OK);
      return true;
    } catch {
      return false;
    }
  };

  const macOS = path.resolve(fromDir, '..', '..', 'MacOS');
  try {
    const found = fs
      .readdirSync(macOS)
      .map((name) => path.join(macOS, name))
      .find(isExecutableFile);
    if (found) return found;
  } catch {
    /* not a macOS bundle */
  }

  const appRoot = path.resolve(fromDir, '..', '..');
  try {
    const found = fs
      .readdirSync(appRoot)
      .filter((name) => {
        const lower = name.toLowerCase();
        if (lower.startsWith('uninstall')) return false;
        return process.platform === 'win32' ? lower.endsWith('.exe') : !lower.includes('.') && lower.includes('nodegx');
      })
      .map((name) => path.join(appRoot, name))
      .find(isExecutableFile);
    if (found) return found;
  } catch {
    /* not an app root */
  }
  return null;
}

export function resolveRenderCli(fromDir: string = __dirname): ResolvedRenderCli {
  const probed: string[] = [];
  const exec = process.execPath;
  const push = (p: string): string | null => {
    probed.push(p);
    return fs.existsSync(p) ? p : null;
  };

  const override = process.env.NODEGX_RENDER_CLI;
  if (override) {
    const found = push(override);
    return found ? { entry: found, exec, probed } : { entry: null, exec, probed, overrideMissing: override };
  }
  const candidates = [
    // From src/, and from dist/ or src/tools/.
    path.resolve(fromDir, '..', '..', '..', 'scripts', 'devtools', 'measure-from-disk.js'),
    path.resolve(fromDir, '..', '..', '..', '..', 'scripts', 'devtools', 'measure-from-disk.js'),
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
    path.resolve(fromDir, '..', 'app.asar', 'render-harness', 'measure-from-disk.js'),
    path.resolve(fromDir, '..', '..', 'app.asar', 'render-harness', 'measure-from-disk.js')
  ];
  for (const candidate of candidates) {
    const found = push(candidate);
    if (found) return { entry: found, exec, probed };
  }

  // P79 L3 — plain Node cannot see into an asar, so `existsSync` above answered
  // false for a harness that is there. Read the archive's own directory instead,
  // and run the harness with the app binary, which can.
  if (!process.versions.electron) {
    for (const candidate of candidates) {
      const asar = splitAsarPath(candidate);
      if (!asar || !fs.existsSync(asar.archive) || !asarLists(asar.archive, asar.inner)) continue;
      const electron = findAppElectronBinary(fromDir);
      if (!electron) return { entry: null, exec, probed, electronMissing: true };
      return { entry: candidate, exec: electron, probed, viaElectron: electron };
    }
  }
  return { entry: null, exec, probed };
}

function spawnRender(
  exec: string,
  entry: string,
  args: string[],
  timeoutMs: number
): Promise<{ stdout: string; stderr: string }> {
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
     *
     * `exec` is `process.execPath` except on the P79 L3 path, where a plain-Node
     * sidecar runs a harness that lives inside `app.asar` with the app's own
     * Electron binary — the variable is what makes that binary a Node.
     */
    const child = spawn(exec, [entry, ...args], {
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
  const { entry, exec, probed, overrideMissing, electronMissing } = resolveRenderCli();
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
      electronMissing
        ? 'The render harness is inside this install\'s app.asar, which this sidecar (started with plain node) ' +
          'cannot read, and no app binary was found beside it to run it with. Register the server with the ' +
          'app\'s own binary and ELECTRON_RUN_AS_NODE=1 (the Electron form in Settings → Connect), or set ' +
          'NODEGX_RENDER_CLI to an unpacked measure-from-disk.js.'
        : 'The render harness could not be located, so the page cannot be rendered or measured. On a packaged ' +
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

  const { stdout, stderr } = await spawnRender(exec, entry, args, options.timeoutMs ?? RENDER_TIMEOUT_MS);

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
