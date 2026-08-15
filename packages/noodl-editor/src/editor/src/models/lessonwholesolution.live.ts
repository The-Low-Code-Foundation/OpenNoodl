/**
 * UNI-007 — engine 2's editor adapter, live wiring.
 *
 * ⚠️ **The only file of the pair that reaches Electron or the editor
 * singletons, and it is kept that way on purpose.** Every rule worth grading —
 * the drawn-element aggregation, the two-independent-reads cross-check, the
 * unavailable/failed distinction — lives in `lessonwholesolution.ts`, which
 * `tests-unit/` (a plain-Node runner) can import. This file is two probes and
 * an `invoke`. If a decision starts creeping in here, it belongs next door.
 *
 * The same split, for the same reason, as `renderCapture.ts` /
 * `renderCaptureModel.ts` — which is also where the render half of this comes
 * from: BLD-014 already built "render the running app at real viewports and
 * measure it" *inside* the editor, with no Chrome to find and no `scripts/`
 * directory to ship. Engine 2 needed exactly that and would otherwise have had
 * to invent it.
 *
 * @module noodl-editor/models/lessonwholesolution.live
 */

import { ipcRenderer } from 'electron';

import { DEFAULT_VIEWPORTS, measureExpression, placeholderStringsFromCatalog, summarise } from '@nodegx/render-measure';

import { defaultCatalog } from '../validation/catalog';
import { formatDiagnosticLine, SemanticValidator } from '../validation';
import type { Diagnostic, ValidationReport } from '../validation';
import { fromLegacyProject } from '../validation/normalize';
import type { LegacyProjectLike } from '../validation/normalize';
import { appViewerUrl } from '../views/SandboxSurface/renderCaptureModel';
import { createEditorWholeSolutionGrader } from './lessonwholesolution';
import type { RenderProbeResult, ValidityProbeResult } from './lessonwholesolution';
import type { WholeSolutionGrader } from './lessongrading';

/**
 * Problems in the editor's own words — `formatDiagnosticLine`, the same printer
 * the Problems panel and the MCP adapter use, so a finding reads identically
 * wherever a learner meets it.
 *
 * `info` diagnostics are observations rather than problems and are left out:
 * they would inflate the evidence bundle's `findingCount` without naming
 * anything to fix.
 */
export function validityFindingLines(report: ValidationReport): string[] {
  return (report?.diagnostics ?? [])
    .filter((d: Diagnostic) => d && d.severity !== 'info')
    .map((d: Diagnostic) => formatDiagnosticLine(d));
}

/**
 * Validate the **live** project.
 *
 * 🔴 Not a re-read from disk, and not `strict`. The learner is graded on what is
 * in front of them, including edits they have not saved; and strict mode exists
 * so a typo'd node type hard-fails *an agent authoring a fresh graph*, which a
 * learner dragging nodes out of the picker is not. Warnings are reported, never
 * fatal — the same judgement the sidecar adapter records.
 */
function probeValidity(): ValidityProbeResult {
  /* eslint-disable-next-line @typescript-eslint/no-var-requires */
  const { ProjectModel } = require('./projectmodel');
  const project = ProjectModel.instance;
  if (!project) throw new Error('no project is open');

  const json = project.toJSON() as unknown as LegacyProjectLike;
  const report = new SemanticValidator().validate(fromLegacyProject(json), {});

  return { valid: (report?.summary?.errors ?? 0) === 0, lines: validityFindingLines(report) };
}

/**
 * Render the running app at real viewports and measure it.
 *
 * 🔴 **`screenshot: 'none'`.** A screenshot of a learner's project is project
 * content, and D10 rules that org-minor accounts' project content never leaves
 * the machine. Engine 2 needs two numbers and a list of findings; it has no use
 * for the picture, and taking one would put the most sensitive artifact in the
 * pipeline for no gain.
 *
 * ⚠️ Both `DEFAULT_VIEWPORTS`, not one — the harness raises `blank-render` if
 * *any* viewport is blank, and the aggregation in `lessondrawncount.ts` is a
 * minimum for the same reason. Grading on desktop alone would pass a page that
 * draws nothing on a phone.
 */
async function probeRender(): Promise<RenderProbeResult> {
  const expression = measureExpression(placeholderStringsFromCatalog(defaultCatalog()));

  let reply: { viewports?: Record<string, never>; error?: string };
  try {
    reply = await ipcRenderer.invoke('render-capture', {
      url: appViewerUrl(),
      viewports: DEFAULT_VIEWPORTS,
      expression,
      screenshot: 'none'
    });
  } catch (e) {
    return { viewports: {}, findings: [], lines: [], error: e instanceof Error ? e.message : String(e) };
  }

  if (reply?.error) return { viewports: {}, findings: [], lines: [], error: reply.error };

  const viewports = reply?.viewports ?? {};

  /*
   * ⚠️ Guarded, because `summarise` reads `v.requested.width`, `v.text.elements`
   * and `v.images.total` on any viewport that did not set `error`. A capture
   * that came back half-measured would throw here and take the *count* down with
   * it — and the count is the half that enforces the empty-page rule. Findings
   * are the nice-to-have; losing them costs a sentence, losing the count costs
   * the check.
   */
  let findings: { code?: string; severity?: string; viewport?: string; message?: string }[] = [];
  try {
    findings = summarise(viewports as never).findings;
  } catch {
    findings = [];
  }

  return {
    viewports,
    findings,
    lines: findings
      .filter((f) => f && f.severity !== 'info')
      .map((f) => `[${f.severity}] ${f.viewport}: ${f.code} — ${f.message}`)
  };
}

/** Engine 2, wired to this editor process. */
export function liveWholeSolutionGrader(): WholeSolutionGrader {
  return createEditorWholeSolutionGrader({ probeValidity, probeRender });
}
