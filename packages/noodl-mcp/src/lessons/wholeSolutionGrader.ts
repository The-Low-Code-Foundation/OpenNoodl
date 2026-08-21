/**
 * UNI-007 — the implementation of the grading runner's **engine 2**.
 *
 * WHAT THIS IS
 * ------------
 * `models/lessongrading.ts` in the editor splits lesson grading into two engines
 * and keeps them structurally apart. Engine 1 — "has the learner done step 4?" —
 * is a synchronous pure evaluator over the closed 11-verb condition vocabulary,
 * and it stays in the editor: building a second per-step grader on MCP
 * primitives would fork the very contract UNI-007 exists to keep single.
 *
 * Engine 2 — "is the thing they built a working app, and does it *draw*?" —
 * cannot be answered by looking at the graph, because a graph is a claim. It is
 * declared there as a port (`WholeSolutionGrader`) with no implementation, for a
 * stated reason: answering it needs a child process, a built viewer bundle and a
 * Chrome, and the module that grades a step must not require any of them.
 *
 * This module is that implementation, and it lives here because this package
 * already holds both halves of the answer:
 *
 *   - **validity** → the editor's own `SemanticValidator`, via `validateOnDisk`
 *     (the same call behind the `validate_project` tool).
 *   - **did it draw** → `runRenderReport`, which spawns the render harness as a
 *     child process so a Chrome that wedges cannot take the caller down with it.
 *
 * 🔴 ASSERT DRAWN OUTPUT, NEVER THE ABSENCE OF ERRORS
 * ---------------------------------------------------
 * The rule this adapter exists to honour. The phase-55 audit measured a
 * correctly architected page that rendered four identical blocks of the literal
 * word "Text" and a validator that called it clean; qwen's build reported
 * *"Rendered clean"* on a page carrying one text element. So this adapter
 * **always reports `drawnElementCount`** when a render ran — including zero.
 *
 * That is not politeness. `normaliseWholeSolutionResult()` rewrites a claimed
 * render with a zero count into a failure, but it deliberately does *not* invent
 * a count an adapter never reported ("undefined means not counted, which is not
 * the same as zero"). An adapter that stays silent about the count therefore
 * **opts itself out of the check**. Reporting it is how this one stays inside it.
 *
 * The count is derived from the render report's *own* blank rule rather than a
 * paraphrase of it — see {@link countDrawnElements}.
 *
 * 🔴 NO SCREENSHOTS
 * -----------------
 * Grading renders with `screenshot: 'none'`. A screenshot of a learner's project
 * is project content, and D10 rules that org-minor accounts' project content
 * never leaves the machine. Engine 2 needs two numbers and a list of findings;
 * it has no use for the picture, and taking one would put the most sensitive
 * artifact in the pipeline for no gain.
 *
 * @module noodl-mcp/lessons/wholeSolutionGrader
 */

import {
  countDrawnElements as countDrawnFromViewports,
  formatDiagnosticLine,
  renderDefectCodes as codesOfRenderDefects,
  reportsBlankRender as findingsReportBlankRender
} from '../editor-deps';
import type { Diagnostic, ValidationReport, WholeSolutionGrader, WholeSolutionResult } from '../editor-deps';
import { ToolError } from '../errors';
import { ProjectStore } from '../project/ProjectStore';
import { runRenderReport } from '../render';
import type { RenderReportPayload } from '../render';
import { validateOnDisk } from '../validate';

/**
 * How many finding lines a result carries before it starts summarising.
 *
 * A thoroughly broken project can produce hundreds of diagnostics, and a
 * learner's card is not a validator console. The cap is on the *lines*, never on
 * the verdict: `valid` counts every diagnostic whether or not its line survives,
 * and the overflow is announced rather than dropped silently.
 */
export const MAX_FINDING_LINES = 20;

// ─── The two pure mappings ──────────────────────────────────────────────────

/**
 * How many elements the render actually drew, or `undefined` when nothing could
 * be measured at all.
 *
 * 🔴 **The rule itself is not here, and that is the point.** Engine 2 has two
 * adapters — this one, and the editor's, which drives a hidden Electron window
 * instead of the CLI — and the `min`-not-`sum` aggregation is the safety
 * property engine 2 exists for rather than a detail of either machinery. It
 * lives in `models/lessondrawncount.ts` so there is one implementation; this is
 * the payload adaptation and nothing more.
 */
export function countDrawnElements(report: RenderReportPayload): number | undefined {
  return countDrawnFromViewports(report?.viewports);
}

/** True when the harness itself concluded the page drew nothing. */
export function reportsBlankRender(report: RenderReportPayload): boolean {
  return findingsReportBlankRender(report?.findings);
}

/**
 * The codes by which the harness said the picture is broken — everything in its
 * `error` class bar `blank-render`, which `rendered` already answers.
 *
 * 🔴 Same argument as {@link countDrawnElements}: the rule is shared, this is
 * the payload adaptation. UNI-010 §8.1 is what it is for — a solution drawing
 * one real heading and three `dead-placeholder-text` rows is not an empty page,
 * so nothing in the drawn count can see it, and the sentence that *did* see it
 * was already being carried past the verdict as prose.
 */
export function renderDefectCodes(report: RenderReportPayload): string[] {
  return codesOfRenderDefects(report?.findings);
}

/**
 * The render's problems, in the render's own words.
 *
 * The line format is `measure-from-disk.js`'s human printer, so a finding reads
 * identically whether a learner's card shows it or a developer ran the CLI.
 * `info` findings are observations rather than problems and are left out — they
 * would inflate the evidence bundle's `findingCount` without naming anything to
 * fix.
 */
export function renderFindingLines(report: RenderReportPayload): string[] {
  return (report?.findings ?? [])
    .filter((f) => f && f.severity !== 'info')
    .map((f) => `[${f.severity}] ${f.viewport}: ${f.code} — ${f.message}`);
}

/**
 * The project's problems, in the editor's own words — `formatDiagnosticLine`,
 * the same renderer the validator's other consumers use.
 *
 * `info` diagnostics are dropped for the reason above.
 */
export function validityFindingLines(report: ValidationReport): string[] {
  return (report?.diagnostics ?? [])
    .filter((d: Diagnostic) => d && d.severity !== 'info')
    .map((d: Diagnostic) => formatDiagnosticLine(d));
}

/** Apply {@link MAX_FINDING_LINES}, announcing the overflow rather than hiding it. */
export function capFindingLines(lines: string[], max = MAX_FINDING_LINES): string[] {
  if (lines.length <= max) return lines;
  const kept = lines.slice(0, max);
  kept.push(`…and ${lines.length - max} more problems not listed here.`);
  return kept;
}

// ─── The adapter ────────────────────────────────────────────────────────────

export interface WholeSolutionGraderOptions {
  /**
   * Strict validation hard-fails unknown node types. **Off by default, and the
   * default is a judgement rather than an oversight.** Strict mode exists for
   * agents authoring fresh graphs — the population for whom a typo'd type must
   * hard-fail — and a learner dragging nodes out of the picker is not it. A
   * module-provided type in a lesson project should not fail the lesson.
   */
  strict?: boolean;
  /** Passed through to the harness, e.g. `"desktop,phone"`. Its own default otherwise. */
  viewports?: string;
  /** Ceiling on the render. The harness's own default otherwise. */
  timeoutMs?: number;
  /**
   * Seams. Both default to the real thing; the specs pass recorded measurements
   * so the mapping rules can be pinned without eight seconds of Chrome per
   * assertion — the same reason `renderReportModule.test.ts` reads fixtures.
   */
  probeValidity?: (projectDir: string, strict: boolean) => ValidationReport;
  probeRender?: (projectDir: string) => Promise<RenderReportPayload>;
}

function defaultProbeValidity(projectDir: string, strict: boolean): ValidationReport {
  // Throws `not-a-v2-project` / `not-found` — caught by `check()` and reported
  // as unavailable, because a project this adapter cannot read is not a project
  // the learner got wrong.
  const store = new ProjectStore(projectDir);
  return validateOnDisk(store, { strict }).report;
}

function reason(e: unknown): string {
  if (e instanceof ToolError) return e.message;
  return e instanceof Error ? e.message : String(e);
}

/**
 * Build engine 2 for a project on disk.
 *
 * The returned grader is what `gradeLesson(manifest, ctx, { wholeSolution })`
 * takes. It runs both probes on every `check()` — there is no caching, because
 * "check my work" means *now*, and a cached render is the defect this whole
 * engine exists to catch, one turn stale.
 *
 * ⚠️ **Who can construct it.** This one serves the **sidecar** path — UNI-010,
 * where the runner is already inside this process. `noodl-editor` does **not**
 * depend on `@noodl/mcp` (see the note on `ProjectStore`'s constructor), so the
 * editor's own "check my work" button cannot call this function. That is not a
 * gap to patch by adding a dependency: the editor holds its own
 * `SemanticValidator` — this package imports the editor's, not the reverse — and
 * can spawn the same render CLI. **One port, one adapter per process that owns
 * the machinery**, which is what a port is for.
 *
 * It never throws. Every failure it can meet — no viewer bundle, no Chrome, a
 * timeout, a project in the legacy format — comes back as `unavailable` with the
 * harness's own sentence naming the fix, which is this package's standing rule
 * for absence. A throw here would take engine 1's per-step verdicts down with
 * it, and those are the half that works without a Chrome.
 */
export function createWholeSolutionGrader(
  projectDir: string,
  options: WholeSolutionGraderOptions = {}
): WholeSolutionGrader {
  const probeValidity = options.probeValidity ?? defaultProbeValidity;
  const probeRender =
    options.probeRender ??
    ((dir: string) =>
      runRenderReport(dir, {
        // See the module note: no picture, on purpose.
        screenshot: 'none',
        ...(options.viewports ? { viewports: options.viewports } : {}),
        ...(options.timeoutMs ? { timeoutMs: options.timeoutMs } : {})
      }).then((r) => r.report));

  return {
    async check(): Promise<WholeSolutionResult> {
      const findings: string[] = [];
      const unavailable: string[] = [];

      // ── Is it a working app? ──────────────────────────────────────────────
      let valid = false;
      try {
        const report = probeValidity(projectDir, options.strict ?? false);
        valid = (report?.summary?.errors ?? 0) === 0;
        findings.push(...validityFindingLines(report));
      } catch (e) {
        unavailable.push(`The project could not be validated: ${reason(e)}`);
      }

      // ── Does it draw? ─────────────────────────────────────────────────────
      let rendered = false;
      let drawnElementCount: number | undefined;
      let renderDefects: string[] | undefined;
      try {
        const report = await probeRender(projectDir);
        drawnElementCount = countDrawnElements(report);
        // Reported whenever the render *ran*, empty page included — absent means
        // no render happened, never "the harness found nothing wrong".
        renderDefects = renderDefectCodes(report);
        findings.push(...renderFindingLines(report));

        if (drawnElementCount === undefined) {
          // Every viewport failed to measure. Not zero — unknown.
          unavailable.push('The render produced no measurement for any viewport, so nothing could be counted.');
        } else {
          // Two independent reads of one question, and the conservative one
          // wins if they ever disagree: the count, and the harness's own verdict.
          rendered = drawnElementCount > 0 && !reportsBlankRender(report);
        }
      } catch (e) {
        unavailable.push(`The render could not run: ${reason(e)}`);
      }

      // ⚠️ Each field reports what its own half observed, and `unavailable` names
      // whichever half could not run. It is deliberately NOT collapsed into
      // `rendered: false`: the halves fail independently — a project this
      // adapter cannot read may still render perfectly — and saying "it did not
      // render" beside a `drawnElementCount` of 98 would be a payload
      // contradicting itself. Nothing is lost by being honest here: the
      // guarantee that an unavailable check never completes a lesson is enforced
      // once, in `buildLessonEvidence()`.
      // 🔴 Counted BEFORE the cap, and the editor's adapter does the same. A
      // learner must not get a different number because they were graded in a
      // different process — the same reason the two cap at the same figure.
      // FIX-027 §18.
      const allFindings = [...unavailable, ...findings];

      return {
        valid,
        rendered,
        ...(drawnElementCount !== undefined ? { drawnElementCount } : {}),
        ...(renderDefects !== undefined ? { renderDefects } : {}),
        findings: capFindingLines(allFindings),
        findingTotal: allFindings.length,
        ...(unavailable.length > 0 ? { unavailable: unavailable.join(' ') } : {})
      };
    }
  };
}
