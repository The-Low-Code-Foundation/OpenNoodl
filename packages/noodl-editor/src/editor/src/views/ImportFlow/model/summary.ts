/**
 * LIB-005: reading an `ImportPlan` and an `ImportResult` back as prose.
 *
 * Two audiences, one register. Before applying, the question is "what is about
 * to enter my project?" — answered as counts by category plus the folders that
 * gain something. After applying, the question is "what actually happened, and
 * can I take it back?" — answered with the same counts plus the honest split
 * between the model changes (one undo step) and the file writes (not undoable).
 *
 * @module noodl-editor/views/ImportFlow/model/summary
 */
// CMP-008: the VALUE import is taken from `legacy/report` directly rather than
// from the engine's barrel, and the difference is which runner can grade this
// file. The barrel re-exports `apply.ts`, which reaches `ProjectModel` and the
// undo queue, so importing `reportSummaryLine` through it dragged the whole
// renderer in and put `summarizeResult` out of reach of the plain-Node runner —
// leaving the hop from an engine warning to the result screen graded by nothing
// short of starting Electron. `legacy/report` imports only its own types.
import { reportSummaryLine } from '@noodl-utils/import-engine/legacy/report';
import type { ImportPlan, ImportReport, ImportResult, PlannedItem } from '@noodl-utils/import-engine';

import { CATEGORY_NOUN, ItemCategory, splitPath } from './items';
// `import type`: `selection.ts` has a value import of its own (`deriveInventory`),
// so a plain import here would re-open the door this file just closed.
import type { PlannedStatus } from './selection';

const isActive = (item: { policy: { action: string } }) => item.policy.action !== 'skip';

export interface CategoryCount {
  category: ItemCategory;
  /** Items that will be added under a name the target does not have. */
  added: number;
  /** Colliding items resolved as overwrite. */
  overwritten: number;
  /** Colliding items resolved as rename (components only). */
  renamed: number;
  /** Colliding items resolved as skip — "kept yours". */
  kept: number;
  /** added + overwritten + renamed — what actually lands. */
  landing: number;
}

function count(category: ItemCategory, items: { collides: boolean; policy: { action: string } }[]): CategoryCount {
  let added = 0;
  let overwritten = 0;
  let renamed = 0;
  let kept = 0;
  for (const item of items) {
    switch (item.policy.action) {
      case 'skip':
        kept += 1;
        break;
      case 'rename':
        renamed += 1;
        break;
      case 'overwrite':
        overwritten += 1;
        break;
      default:
        added += 1;
    }
  }
  return { category, added, overwritten, renamed, kept, landing: added + overwritten + renamed };
}

export interface PlanSummary {
  counts: CategoryCount[];
  /** Folders that gain at least one component, sorted; `/` for the root. */
  folders: string[];
  /** Every item in the plan that collides with the target and still needs a decision. */
  collisions: PlannedStatus[];
  totalLanding: number;
  isEmpty: boolean;
}

export function summarizePlan(plan: ImportPlan, index: Map<string, PlannedStatus>): PlanSummary {
  const counts: CategoryCount[] = [
    count('component', plan.components),
    count('resource', plan.resources),
    count('module', plan.modules),
    count('variant', plan.variants),
    count('colorStyle', plan.styles.colors),
    count('textStyle', plan.styles.text)
  ].filter((c) => c.landing + c.kept > 0);

  const folders = new Set<string>();
  for (const component of plan.components) {
    if (!isActive(component)) continue;
    const name = component.policy.action === 'rename' ? component.policy.newName : component.name;
    const { folder } = splitPath(name);
    folders.add(folder === '' ? '/' : folder);
  }

  const collisions = [...index.values()].filter((item) => item.collides || item.policy.action !== 'add');

  const totalLanding = counts.reduce((sum, c) => sum + c.landing, 0);
  return {
    counts,
    folders: [...folders].sort(),
    collisions,
    totalLanding,
    isEmpty: totalLanding === 0
  };
}

export function plural(n: number, noun: string): string {
  if (noun.endsWith('s')) return `${n} ${noun}${n === 1 ? '' : 'es'}`;
  return `${n} ${noun}${n === 1 ? '' : 's'}`;
}

/** "4 components, 2 files and 1 color style" — the headline of the review stage. */
export function describeCounts(counts: CategoryCount[]): string {
  const parts = counts.filter((c) => c.landing > 0).map((c) => plural(c.landing, CATEGORY_NOUN[c.category]));
  if (parts.length === 0) return 'Nothing';
  if (parts.length === 1) return parts[0];
  return `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`;
}

// ─── After the fact ──────────────────────────────────────────────────────────

export interface ResultSummary {
  /**
   * Model changes. NB not all of these are undoable: components and variants
   * enroll in the import's undo group, styles do not (see {@link undoNote}).
   */
  modelLines: string[];
  /** Disk writes — reported separately because undo does not touch them. */
  diskLines: string[];
  renames: { from: string; to: string }[];
  /** Items the user chose to keep their own version of. */
  kept: string[];
  warnings: string[];
  undoNote: string;
  /**
   * LIB-006. Present whenever the import produced an assessment, which is every
   * import — a clean one yields a `proceed` verdict with no findings.
   *
   * Surfaced here rather than left in the report file because a result screen
   * that says "Import complete" over a project with eight unconvertible nodes is
   * exactly the dishonesty this task exists to remove.
   */
  legacy?: {
    line: string;
    recommendation: ImportReport['verdict']['recommendation'];
    placeholders: number;
    reportFiles: string[];
  };
}

/**
 * `mode` matters here, not just in the headline verb. Export stages the selection
 * into a throwaway project and zips it, so the `ImportResult` it hands back is
 * shaped like an import's — and read literally it told the user that components
 * had gone "into your project" and that undo would take them back out. Neither is
 * true of an export: nothing in the open project changed and there is nothing to
 * undo. Found by QA-5.3.
 */
export function summarizeResult(
  result: ImportResult,
  plan: ImportPlan,
  mode: 'import' | 'export' = 'import'
): ResultSummary {
  const isExport = mode === 'export';

  const modelLines: string[] = [];
  if (result.componentsImported.length > 0)
    modelLines.push(plural(result.componentsImported.length, 'component') + (isExport ? '' : ' into your project'));
  if (result.variantsImported.length > 0) modelLines.push(plural(result.variantsImported.length, 'variant'));
  const styleCount = result.stylesImported.colors.length + result.stylesImported.text.length;
  if (styleCount > 0) modelLines.push(plural(styleCount, 'style'));

  const diskLines: string[] = [];
  if (result.filesCopied.length > 0) diskLines.push(plural(result.filesCopied.length, 'file') + ' written');
  if (result.modulesCopied.length > 0) diskLines.push(plural(result.modulesCopied.length, 'module') + ' copied');

  const renames = Object.entries(plan.renames).map(([from, to]) => ({ from, to }));

  const kept: string[] = [];
  const collectKept = (items: (PlannedItem | ImportPlan['components'][number])[], noun: string) => {
    for (const item of items) if (item.policy.action === 'skip') kept.push(`${noun} ${item.name}`);
  };
  collectKept(plan.components, 'component');
  collectKept(plan.resources, 'file');
  collectKept(plan.modules, 'module');
  collectKept(plan.variants, 'variant');
  collectKept(plan.styles.colors, 'color style');
  collectKept(plan.styles.text, 'text style');

  // What one undo actually reverts. Components and variants enroll in the
  // import's undo group; styles do NOT — they merge through `mergeMetadata`,
  // which is deliberately outside the group (apply.ts `mergeStyles`, legacy
  // parity) — and disk writes never were. This used to claim styles came back
  // too, which is a promise the engine does not keep: after an undo the source's
  // colours and text styles are still sitting on top of the user's own.
  // Verified live and pinned by tests/project/projectimportapply.js.
  const staysBehind: string[] = [];
  if (styleCount > 0) staysBehind.push('Styles');
  if (diskLines.length > 0) staysBehind.push(staysBehind.length ? 'files on disk' : 'Files on disk');

  const undoNote = isExport
    ? 'Nothing in your project changed — this was written to the archive.'
    : staysBehind.length > 0
    ? `Undo removes the imported components and variants in one step. ${staysBehind.join(' and ')} stay.`
    : 'Undo removes everything this import added, in one step.';

  // LIB-006: the assessment, if the import produced one. Export stages into a
  // throwaway project, so its report describes the staging copy rather than
  // anything the user keeps — not worth showing.
  const legacy =
    !isExport && result.legacyReport
      ? {
          line: reportSummaryLine(result.legacyReport),
          recommendation: result.legacyReport.verdict.recommendation,
          placeholders: result.legacyReport.counts.placeholder,
          reportFiles: result.reportFilesWritten ?? []
        }
      : undefined;

  return { modelLines, diskLines, renames, kept, warnings: result.warnings, undoNote, legacy };
}
