/**
 * UNI-007 — engine 2's **editor-side** adapter, rules half.
 *
 * WHY A SECOND ADAPTER EXISTS AT ALL
 * ----------------------------------
 * `lessongrading.ts` declares `WholeSolutionGrader` as a port with no
 * implementation, because answering *"is what they built a working app, and does
 * it draw?"* needs a validator and a browser, and the module that grades a step
 * must require neither. `noodl-mcp/lessons/wholeSolutionGrader.ts` is one
 * implementation, for the sidecar.
 *
 * It is not reachable from here. `noodl-editor` has **no `@noodl/mcp`
 * dependency** — the dependency runs the other way, `noodl-mcp` importing this
 * package's pure modules — and adding one to reach an adapter would invert it.
 * That is not a gap to patch: the editor owns its own copy of both halves of the
 * answer, so it gets its own adapter. **One port, one adapter per process that
 * owns the machinery**, which is what a port is for.
 *
 * WHAT THE EDITOR OWNS, AND WHY IT IS DIFFERENT MACHINERY
 * ------------------------------------------------------
 *   - **validity** → `SemanticValidator` over `ProjectModel.instance` — the live
 *     project, not a re-read of disk. The learner is being graded on what they
 *     have built, and what they have built is in front of them.
 *   - **did it draw** → the BLD-014 CDP capture: a hidden `BrowserWindow` over
 *     the running viewer, driven from the main process. 🔴 Deliberately **not**
 *     `scripts/devtools/measure-from-disk.js`, which the sidecar spawns — that
 *     script is absent from a packaged editor (`scripts/` is not in
 *     `build.files`) and needs a Chrome on the user's machine. An adapter that
 *     works in this checkout and is dead for every real learner is worse than
 *     none.
 *
 * 🔴 IT ALWAYS REPORTS `drawnElementCount`, INCLUDING ZERO
 * -------------------------------------------------------
 * `normaliseWholeSolutionResult()` rewrites a claimed render with a zero count
 * into a failure, but it deliberately does not invent a count an adapter never
 * reported — so **an adapter that stays silent about the count opts itself out
 * of the empty-page check entirely.** Reporting it is how this one stays inside
 * it. The rule that turns viewport measurements into that number lives in
 * `lessondrawncount.ts` and is shared with the sidecar's adapter, because two
 * copies of a safety property is one copy plus a future defect.
 *
 * ⚠️ NO IMPORT OF `electron` OR `ProjectModel` IN THIS FILE
 * --------------------------------------------------------
 * Both probes arrive injected, the same split `renderCaptureModel.ts` keeps from
 * `renderCapture.ts` and for the same reason: `tests-unit/` is a plain-Node
 * runner, and the rules — the aggregation, the two-independent-reads
 * cross-check, the unavailable/failed distinction — are the half worth grading.
 * The live wiring is `lessonwholesolution.live.ts`, which is transport only.
 *
 * @module noodl-editor/models/lessonwholesolution
 */

import { countDrawnElements, reportsBlankRender } from './lessondrawncount';
import type { MeasuredViewportLike, RenderFindingLike } from './lessondrawncount';
import type { WholeSolutionGrader, WholeSolutionResult } from './lessongrading';

/**
 * How many finding lines a result carries before it starts summarising.
 *
 * A thoroughly broken project can produce hundreds of diagnostics, and a
 * learner's card is not a validator console. The cap is on the *lines*, never on
 * the verdict: `valid` counts every diagnostic whether or not its line survives,
 * and the overflow is announced rather than dropped silently. The sidecar
 * adapter caps at the same number, deliberately — a learner should not get a
 * different-length list because they were graded in a different process.
 */
export const MAX_FINDING_LINES = 20;

/** Apply {@link MAX_FINDING_LINES}, announcing the overflow rather than hiding it. */
export function capFindingLines(lines: string[], max = MAX_FINDING_LINES): string[] {
  if (lines.length <= max) return lines;
  const kept = lines.slice(0, max);
  kept.push(`…and ${lines.length - max} more problems not listed here.`);
  return kept;
}

// ─── What the two probes hand back ──────────────────────────────────────────

/**
 * The validator's answer, structurally. `ValidationReport` itself is not
 * imported: this module only reads the error count and lines somebody else
 * rendered, and typing against the concrete report would drag the validation
 * barrel into a file that has no other use for it.
 */
export interface ValidityProbeResult {
  /** True when the project has no blocking diagnostics. */
  valid: boolean;
  /** Problems, already rendered to lines by the validator's own printer. */
  lines: string[];
}

/**
 * The render's answer, structurally — the raw per-viewport measurements and the
 * findings `summarise` derived from them.
 *
 * ⚠️ `error` here means *the capture did not happen* (no viewer, a window that
 * would not load, a deadline). A capture that happened and measured an empty
 * page is not an error; it is the finding this whole engine exists to produce.
 */
export interface RenderProbeResult {
  viewports: Record<string, MeasuredViewportLike>;
  findings: RenderFindingLike[];
  /** Lines for the learner, in the render's own words. */
  lines: string[];
  /** Why nothing could be captured, when nothing could. */
  error?: string;
}

export interface EditorWholeSolutionDeps {
  probeValidity: () => ValidityProbeResult;
  probeRender: () => Promise<RenderProbeResult>;
}

// ─── The adapter ────────────────────────────────────────────────────────────

/**
 * Build engine 2 for the editor.
 *
 * The returned grader is what `gradeLesson(manifest, ctx, { wholeSolution })`
 * takes. Both probes run on every `check()` — there is no caching, because
 * "check my work" means *now*, and a cached render is the defect this engine
 * exists to catch, one turn stale.
 *
 * **It never throws.** No viewer, a window that will not load, a project the
 * validator cannot read — all come back as `unavailable`, the standing rule for
 * absence on both sides of this port. A throw here would take engine 1's
 * per-step verdicts down with it, and those are the half that works with no
 * browser at all.
 *
 * ⚠️ **`unavailable` is not collapsed into `rendered: false`,** and the sidecar
 * adapter's first draft got this wrong in exactly the same place. The two halves
 * fail independently: a project the validator cannot *read* may still render
 * perfectly, so saying "it did not render" beside a `drawnElementCount` of 98
 * would be a payload contradicting itself. The guarantee that an unavailable
 * check never passes anyone is enforced once, on the decision that consumes
 * these fields — `buildLessonEvidence()`.
 */
export function createEditorWholeSolutionGrader(deps: EditorWholeSolutionDeps): WholeSolutionGrader {
  return {
    async check(): Promise<WholeSolutionResult> {
      const findings: string[] = [];
      const unavailable: string[] = [];

      // ── Is it a working app? ──────────────────────────────────────────────
      let valid = false;
      try {
        const result = deps.probeValidity();
        valid = result.valid;
        findings.push(...result.lines);
      } catch (e) {
        unavailable.push(`The project could not be validated: ${errorText(e)}`);
      }

      // ── Does it draw? ─────────────────────────────────────────────────────
      let rendered = false;
      let drawnElementCount: number | undefined;
      try {
        const result = await deps.probeRender();
        if (result.error) {
          unavailable.push(`The render could not run: ${result.error}`);
        } else {
          drawnElementCount = countDrawnElements(result.viewports);
          findings.push(...result.lines);

          if (drawnElementCount === undefined) {
            // Every viewport failed to measure. Not zero — unknown.
            unavailable.push('The render produced no measurement for any viewport, so nothing could be counted.');
          } else {
            // Two independent reads of one question, and the conservative one
            // wins if they disagree: the count, and the harness's own verdict.
            rendered = drawnElementCount > 0 && !reportsBlankRender(result.findings);
          }
        }
      } catch (e) {
        unavailable.push(`The render could not run: ${errorText(e)}`);
      }

      return {
        valid,
        rendered,
        ...(drawnElementCount !== undefined ? { drawnElementCount } : {}),
        findings: capFindingLines([...unavailable, ...findings]),
        ...(unavailable.length > 0 ? { unavailable: unavailable.join(' ') } : {})
      };
    }
  };
}

function errorText(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}
