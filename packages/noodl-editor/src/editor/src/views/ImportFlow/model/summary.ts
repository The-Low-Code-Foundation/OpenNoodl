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

import type { ImportPlan, ImportResult, PlannedItem } from '@noodl-utils/import-engine';

import { CATEGORY_NOUN, ItemCategory, splitPath } from './items';
import { PlannedStatus } from './selection';

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
  /** Model changes — these are the ones the single undo step reverts. */
  modelLines: string[];
  /** Disk writes — reported separately because undo does not touch them. */
  diskLines: string[];
  renames: { from: string; to: string }[];
  /** Items the user chose to keep their own version of. */
  kept: string[];
  warnings: string[];
  undoNote: string;
}

export function summarizeResult(result: ImportResult, plan: ImportPlan): ResultSummary {
  const modelLines: string[] = [];
  if (result.componentsImported.length > 0)
    modelLines.push(plural(result.componentsImported.length, 'component') + ' into your project');
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

  const undoNote =
    diskLines.length > 0
      ? 'Undo removes the imported components, variants and styles in one step. Files on disk remain.'
      : 'Undo removes everything this import added, in one step.';

  return { modelLines, diskLines, renames, kept, warnings: result.warnings, undoNote };
}
