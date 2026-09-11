/**
 * HLS-007 — `nodegx render`, the front door onto the render harness.
 *
 * ## What this command is for
 *
 * *A pipeline renders every page of an app at three viewport widths and keeps the images, without
 * a person opening anything.* Before it, the only way to see every page of a NodeGX app was to
 * open the editor and click through the router, or to call `render_report` over MCP — and
 * `render_report` photographed **only the start page**, however many pages it measured
 * (register row C40 / issue #40). Both halves are new here: the sweep now captures every page,
 * and this command writes them.
 *
 * ## 🔴 The grading is a pure function, and the render is not
 *
 * {@link gradeRender} takes a report and the router's page list and returns an exit code and a
 * sentence. It never touches a browser, a filesystem or a clock, so every branch below is graded
 * by a spec that runs in milliseconds — including the ones a real project would take a bespoke
 * fixture and forty seconds to provoke. {@link runRender} is the part around it that cannot be.
 *
 * That split matters more here than in `nodegx export`, because the interesting failures of this
 * command are the ones where the *renderer succeeded* and the answer is still wrong: a page that
 * the router registers and the sweep never visited, a page that came back blank, a page whose
 * image was never written. All three are indistinguishable from success in the harness's own exit
 * code, which is 0 whatever it finds — deliberately, because in `render_report` a finding is the
 * product and not a crash.
 *
 * ## 🔴 What this command cannot see, which is in its `--help` for the same reason
 *
 * **An image proves pixels, not reachability.** Nothing here clicks anything, so a page whose
 * only button is behind an invisible overlay photographs perfectly.
 *
 * **It photographs ROUTES, not components.** Driving HLS-007 found `/#admin` and `/#admin-login`
 * producing byte-identical images in a real project — not a bug in the sweep (a control that
 * booted a fresh browser straight at `/#admin` produced the same bytes) but the app's own auth
 * gate sending a logged-out visitor to the login page. The picture is a true picture of that URL.
 * A reader who expects one image per *component* will misread it, so the help says which it is.
 */
import * as path from 'path';
import { spawn } from 'child_process';

import { loadCatalog } from '../catalog';
import { errorMessage } from '../errorMessage';
import { parseProject } from '../parse/parseProject';
import { EXIT, type ExitCode } from './exitCodes';
import { describeMissingHarness, resolveHarness } from './renderHarness';
import type { CliIO } from './run';

/** The `render` shape of {@link import('./args').ParsedArgs}. */
export interface RenderArgs {
  projectDir: string;
  /** `null` measures and grades without keeping anything — a CI gate that wants no artefacts. */
  outDir: string | null;
  /** Passed through verbatim; the harness owns the vocabulary and the usage error. */
  viewports: string | null;
  scale: number | null;
}

/** One page's row in the report the harness returns. Only the fields this command grades. */
interface PageRow {
  component: string;
  urlPath?: string;
  isStart?: boolean;
  measured?: boolean;
  unreachable?: string;
  viewports?: Record<string, { error?: string; screenshot?: string }>;
}

interface Finding {
  code: string;
  severity: string;
  viewport: string;
  page?: string;
  message: string;
}

export interface RenderReportShape {
  projectName?: string;
  durationMs?: number;
  pages?: PageRow[];
  findings?: Finding[];
  viewports?: Record<string, { error?: string; screenshot?: string }>;
  error?: { actionable?: boolean; message?: string; problems?: string[] };
}

export interface Grade {
  code: ExitCode;
  /** Everything printed, in order. Returned rather than written so a spec reads it as data. */
  lines: string[];
}

/**
 * Did every page the router registers render, and is there an image of each?
 *
 * @param report        what the harness said.
 * @param routes        the router's page list, read by the **exporter's** parse — a different
 *                      reader of the same files. This is the whole of AC3: a count taken from
 *                      `report.pages` would be a count of what the renderer happened to reach,
 *                      and would agree with itself whatever the sweep dropped.
 * @param viewportCount how many images each measured page owes, when images were asked for.
 * @param wantImages    whether images were asked for at all.
 */
export function gradeRender(
  report: RenderReportShape,
  routes: readonly string[],
  viewportCount: number,
  wantImages: boolean
): Grade {
  if (report.error) {
    const problems = report.error.problems ?? [report.error.message ?? 'the render failed'];
    // An actionable error is a statement about the project — a path no router registers, a folder
    // that is not a project. Anything else is the harness falling over, which is not the project's
    // fault and must not be reported as if it were.
    return {
      code: report.error.actionable ? EXIT.project : EXIT.render,
      lines: ['Cannot render:', ...problems.map((problem) => `  - ${problem}`)]
    };
  }

  const lines: string[] = [];
  const pages = report.pages ?? [];
  const byComponent = new Map(pages.map((page) => [page.component, page]));
  const failures: string[] = [];

  // 1. Every registered route has a row. A page the sweep never heard of is the silent case:
  //    `pages: 4/4 measured` reads like completeness and is a claim about the four it found.
  for (const route of routes) {
    if (!byComponent.has(route)) {
      failures.push(`${route} — the router registers it and the render report has no row for it at all`);
    }
  }

  for (const page of pages) {
    const name = page.component;
    if (!page.measured) {
      failures.push(`${name} — not rendered: ${page.unreachable ?? 'no reason given'}`);
      continue;
    }
    const viewports = page.viewports ?? {};
    const measuredNames = Object.keys(viewports);
    if (measuredNames.length === 0) {
      failures.push(`${name} — rendered no viewport at all`);
      continue;
    }
    for (const [viewport, value] of Object.entries(viewports)) {
      if (value && value.error) failures.push(`${name} at ${viewport} — ${value.error}`);
    }
    if (wantImages) {
      // 🔴 Counted PER PAGE against the viewports asked for, never as
      // `images.length === pages.length * viewports.length`. That is the same arithmetic and it
      // passes when one page contributes two images and another contributes none.
      const written = measuredNames.filter((viewport) => viewports[viewport] && viewports[viewport].screenshot);
      if (written.length !== viewportCount) {
        failures.push(
          `${name} — ${written.length} of ${viewportCount} images written` +
            (written.length === 0 ? '' : ` (${written.join(', ')} only)`)
        );
      }
    }
  }

  // 2. A page that rendered nothing. `blank-render` is the harness's own name for "no text and no
  //    images at any viewport", and it is the failure a pipeline most wants to stop on: the app
  //    built, the page is routed, and there is nothing on it.
  const startComponent = pages.find((page) => page.isStart)?.component;
  for (const finding of report.findings ?? []) {
    if (finding.code !== 'blank-render') continue;
    // A start-page finding carries no `page` — see `renderReport`, which labels only the sweep's.
    const on = finding.page ?? startComponent ?? '(the start page)';
    if (!failures.some((failure) => failure.startsWith(`${on} — rendered nothing`))) {
      failures.push(`${on} — rendered nothing at all (blank-render at ${finding.viewport})`);
    }
  }

  const measured = pages.filter((page) => page.measured);
  lines.push(
    `${report.projectName ?? 'project'} — ${measured.length} of ${pages.length} routed ` +
      `${pages.length === 1 ? 'page' : 'pages'} rendered, ${routes.length} registered by the router` +
      (report.durationMs ? `, ${Math.round(report.durationMs / 100) / 10}s` : '')
  );
  for (const page of pages) {
    const viewports = page.viewports ?? {};
    const shots = Object.values(viewports)
      .map((viewport) => viewport && viewport.screenshot)
      .filter(Boolean) as string[];
    lines.push(
      `  ${page.measured ? '✓' : '✕'} ${page.component}` +
        (page.isStart ? ' (start)' : page.urlPath ? ` /#${page.urlPath}` : '') +
        (page.measured ? ` — ${Object.keys(viewports).join(', ')}` : ` — ${page.unreachable ?? 'not rendered'}`)
    );
    for (const shot of shots) lines.push(`      ${shot}`);
  }

  if (failures.length === 0) return { code: EXIT.ok, lines };

  lines.push('');
  lines.push(`${failures.length} ${failures.length === 1 ? 'page did' : 'pages did'} not render:`);
  for (const failure of failures) lines.push(`  - ${failure}`);
  return { code: EXIT.render, lines };
}

/** The router's registered pages, deduplicated, in source order. Throws what `parseProject` throws. */
export function registeredRoutes(projectDir: string): string[] {
  const ir = parseProject(projectDir, loadCatalog());
  const seen: string[] = [];
  for (const router of ir.project.routers ?? []) {
    for (const route of router.routes) if (!seen.includes(route)) seen.push(route);
  }
  return seen;
}

/** Run the harness and resolve its parsed JSON, or reject with a sentence. */
function spawnHarness(entry: string, args: readonly string[]): Promise<RenderReportShape> {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [entry, ...args], { stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => (stdout += String(chunk)));
    child.stderr.on('data', (chunk) => (stderr += String(chunk)));
    child.on('error', (error) => reject(new Error(`The render harness would not start: ${error.message}`)));
    child.on('close', () => {
      try {
        resolve(JSON.parse(stdout) as RenderReportShape);
      } catch {
        // ⚠️ The harness's own stderr is the useful half here — a missing Chrome, a port that
        // would not bind. Swallowing it and saying "invalid JSON" would hide the actual cause
        // behind a complaint about the symptom.
        reject(new Error(`The render harness produced no report.\n${stderr.trim() || stdout.trim()}`));
      }
    });
  });
}

/** The command. */
export async function runRender(args: RenderArgs, io: CliIO): Promise<ExitCode> {
  const harness = resolveHarness();
  if (!harness.entry) {
    io.err(describeMissingHarness(harness));
    return EXIT.harness;
  }

  let routes: string[];
  try {
    routes = registeredRoutes(args.projectDir);
  } catch (error) {
    io.err(`Cannot read ${args.projectDir}: ${errorMessage(error)}\n`);
    return EXIT.project;
  }

  const outDir = args.outDir === null ? null : path.resolve(args.outDir);
  const harnessArgs = [args.projectDir, '--json'];
  if (outDir) {
    harnessArgs.push('--out-dir', outDir);
  } else {
    // 🔴 `--screenshot none` when nothing is being kept. Without it the harness pays a full-page
    // capture per page per viewport and throws every one away — on the fixture this was built
    // against that is ten PNGs, base64-encoded through a process boundary and parsed, to answer a
    // question about whether the pages rendered.
    harnessArgs.push('--screenshot', 'none');
  }
  if (args.viewports) harnessArgs.push('--viewports', args.viewports);
  if (args.scale !== null) harnessArgs.push('--scale', String(args.scale));

  let report: RenderReportShape;
  try {
    report = await spawnHarness(harness.entry, harnessArgs);
  } catch (error) {
    io.err(`${errorMessage(error)}\n`);
    return EXIT.render;
  }

  const viewportCount = Object.keys(report.viewports ?? {}).length;
  const grade = gradeRender(report, routes, viewportCount, outDir !== null);
  for (const line of grade.lines) (grade.code === EXIT.ok ? io.out : io.err)(`${line}\n`);
  return grade.code;
}
