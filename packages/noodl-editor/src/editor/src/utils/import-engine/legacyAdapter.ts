/**
 * LIB-004: Import Engine v2 — strangler adapter.
 *
 * A thin, drop-in replacement for the retired `utils/projectimporter.js`
 * singleton. It preserves the legacy method surface the five call sites and the
 * shared `ImportPopup` still speak — `listComponentsAndDependencies`,
 * `checkForCollisions`, `hasCollisions`, `import`, `filterImports` — but routes
 * the two heavy operations through the typed engine:
 *
 *   listComponentsAndDependencies → analyze()   (format-aware source inventory)
 *   import                        → apply()      (undo-grouped model changes)
 *
 * Collision detection and the pure array filters are ported faithfully (they are
 * glue over the live `ProjectModel`, and the shape the popups consume). LIB-005
 * replaces the popups and calls analyze/plan/apply directly, at which point this
 * adapter can go too.
 *
 * @module noodl-editor/utils/import-engine/legacyAdapter
 */

import { ProjectModel } from '@noodl-models/projectmodel';

import FileSystem from '../filesystem';
import { analyze } from './analyze';
import { apply } from './apply';
import type { ImportPlan, ImportResult, ItemPolicy, PlannedComponent, PlannedItem, SourceInventory } from './types';

// ─── Legacy data shapes (the ImportPopup contract) ───────────────────────────

interface LegacyNamed {
  name: string;
  /** The shared ImportPopup annotates each row with a checkbox state in place. */
  import?: boolean;
}
interface LegacyVariant {
  name: string;
  typename: string;
  fileDependencies?: string[];
  styleDependencies?: { colors: string[]; text: string[] };
  import?: boolean;
}
interface LegacyStyles {
  colors: LegacyNamed[];
  text: (LegacyNamed & { fileDependencies?: string[] })[];
}
export interface LegacyComponentImport {
  name: string;
  dependencies: string[];
  fileDependencies: string[];
  variantDependencies: { typename: string; name: string }[];
  styleDependencies: { colors: string[]; text: string[] };
  /** ImportPopup checkbox state (see LegacyNamed.import). */
  import?: boolean;
}
export interface LegacyImports {
  components: LegacyComponentImport[];
  resources: LegacyNamed[];
  modules: LegacyNamed[];
  styles: LegacyStyles;
  variants: LegacyVariant[];
}

/**
 * The `checkForCollisions` callback payload: the colliding subset, `undefined`
 * (nothing collides), or a `{ result: 'failure' }` when no project is loaded.
 * Callers distinguish the failure by presence of `message`.
 */
export type CollisionResult = (LegacyCollisions & { result?: undefined; message?: undefined }) | { result: 'failure'; message: string };

/** The overwrite-collision subset, same shape the ImportPopup 'overwrite' variant reads. */
export interface LegacyCollisions {
  resources: LegacyNamed[];
  components: LegacyNamed[];
  styles: { colors: LegacyNamed[]; text: LegacyNamed[] };
  variants: LegacyVariant[];
  modules: LegacyNamed[];
}

type ImportCallback = (result: { result: string; message?: string }) => void;

interface ImportOptions {
  importIntoProject?: ProjectModel;
}

// ─── Inventory → legacy imports ──────────────────────────────────────────────

/** Reduce a {@link SourceInventory} to the exact legacy `imports` shape the popups consume. */
function toLegacyImports(inv: SourceInventory): LegacyImports {
  return {
    components: inv.components.map((c) => ({
      name: c.name,
      dependencies: c.dependencies,
      fileDependencies: c.fileDependencies,
      variantDependencies: c.variantDependencies,
      styleDependencies: c.styleDependencies
    })),
    resources: inv.resources.map((r) => ({ name: r.name })),
    modules: inv.modules.map((m) => ({ name: m.name })),
    styles: {
      colors: inv.styles.colors.map((c) => ({ name: c.name })),
      text: inv.styles.text.map((t) => (t.fileDependencies ? { name: t.name, fileDependencies: t.fileDependencies } : { name: t.name }))
    },
    variants: inv.variants.map((v) => ({
      name: v.name,
      typename: v.typename,
      fileDependencies: v.fileDependencies,
      styleDependencies: v.styleDependencies
    }))
  };
}

// ─── Legacy imports (already-selected) → ImportPlan ──────────────────────────

const ADD: ItemPolicy = { action: 'add' };

/**
 * Build an {@link ImportPlan} from an already-selected legacy `imports` object.
 * The selection/closure was resolved upstream (the popup + `filterImports`), so
 * every item is a straight `add`; `apply` re-checks the live target and reuses
 * ids on overwrite exactly as the legacy engine did — so no per-item `overwrite`
 * policy is needed here.
 */
function planFromImports(sourceDir: string, imports: Partial<LegacyImports>): ImportPlan {
  const comp = (c: { name: string }): PlannedComponent => ({
    name: c.name,
    reason: 'requested',
    requiredBy: [],
    collides: false,
    policy: ADD
  });
  const item = (name: string, typename?: string): PlannedItem => ({
    name,
    typename,
    reason: 'requested',
    requiredBy: [],
    collides: false,
    policy: ADD
  });
  return {
    sourceDir,
    components: (imports.components ?? []).map(comp),
    resources: (imports.resources ?? []).map((r) => item(r.name)),
    modules: (imports.modules ?? []).map((m) => item(m.name)),
    variants: (imports.variants ?? []).map((v) => item(v.name, v.typename)),
    styles: {
      colors: (imports.styles?.colors ?? []).map((c) => item(c.name)),
      text: (imports.styles?.text ?? []).map((t) => item(t.name))
    },
    renames: {},
    hasCollisions: false
  };
}

function toLegacyResult(res: ImportResult): { result: string; message?: string } {
  return res.result === 'success' ? { result: 'success' } : { result: 'failure', message: res.message };
}

// ─── The adapter ─────────────────────────────────────────────────────────────

export class LegacyImportAdapter {
  static instance = new LegacyImportAdapter();

  /** analyze(dir) reduced to the legacy `imports` shape. `undefined` on failure. */
  listComponentsAndDependencies(direntry: string, callback: (imports?: LegacyImports) => void): void {
    analyze(direntry).then(
      (inv) => callback(toLegacyImports(inv)),
      () => callback(undefined)
    );
  }

  /** True if the collision object holds anything to overwrite. */
  hasCollisions(c: Partial<LegacyCollisions>): boolean {
    return (
      (c.resources !== undefined && c.resources.length > 0) ||
      (c.components !== undefined && c.components.length > 0) ||
      (c.variants !== undefined && c.variants.length > 0) ||
      (c.modules !== undefined && c.modules.length > 0) ||
      (c.styles !== undefined && c.styles.colors !== undefined && c.styles.colors.length > 0) ||
      (c.styles !== undefined && c.styles.text !== undefined && c.styles.text.length > 0)
    );
  }

  /**
   * Detect collisions of `imports` against the live `ProjectModel.instance`.
   * Returns the colliding subset (the ImportPopup 'overwrite' contract), or
   * `undefined` when nothing collides, or a `{ result: 'failure' }` when no
   * project is loaded (callers duck-type `.message`).
   */
  checkForCollisions(imports: Partial<LegacyImports>, callback: (collisions?: CollisionResult) => void): void {
    const project = ProjectModel.instance;
    if (!project) {
      callback({ result: 'failure', message: 'No project loaded, cannot import.' });
      return;
    }

    const collisions: LegacyCollisions = {
      resources: [],
      components: [],
      styles: { text: [], colors: [] },
      variants: [],
      modules: []
    };

    for (const c of imports.components ?? []) {
      if (project.getComponentWithName(c.name)) collisions.components.push({ name: c.name });
    }

    const styles = project.getMetaData('styles') as { colors?: Record<string, unknown>; text?: Record<string, unknown> } | undefined;
    if (styles !== undefined) {
      if (styles.colors !== undefined && imports.styles?.colors !== undefined) {
        for (const c of imports.styles.colors) if (styles.colors[c.name] !== undefined) collisions.styles.colors.push(c);
      }
      if (styles.text !== undefined && imports.styles?.text !== undefined) {
        for (const t of imports.styles.text) if (styles.text[t.name] !== undefined) collisions.styles.text.push(t);
      }
    }

    for (const v of imports.variants ?? []) {
      if (project.findVariant(v.name, { localName: v.typename }) !== undefined) collisions.variants.push(v);
    }

    const noResourcesOrModules =
      (imports.resources === undefined || imports.resources.length === 0) &&
      (imports.modules === undefined || imports.modules.length === 0);
    if (noResourcesOrModules) {
      callback(this.hasCollisions(collisions) ? collisions : undefined);
      return;
    }

    project.listFilesInProjectDirectory((projectFiles: { fullPath: string }[]) => {
      const filePathMap: Record<string, boolean> = {};
      const rootLen = (project._retainedProjectDirectory as string).length + 1;
      for (const e of projectFiles) filePathMap[e.fullPath.substring(rootLen)] = true;

      for (const f of imports.resources ?? []) if (filePathMap[f.name]) collisions.resources.push(f);

      let modules: { name: string }[] = [];
      try {
        const found = FileSystem.instance.readDirectorySync(project._retainedProjectDirectory + '/noodl_modules');
        modules = found
          .filter((m: { fullPath: string }) => FileSystem.instance.fileExistsSync(m.fullPath + '/manifest.json'))
          .map((m: { name: string }) => ({ name: m.name }));
      } catch {
        // No noodl_modules directory — no module collisions.
      }
      if (modules.length > 0) {
        for (const m of imports.modules ?? []) {
          if (modules.find((_m) => _m.name === m.name) !== undefined) collisions.modules.push(m);
        }
      }

      callback(this.hasCollisions(collisions) ? collisions : undefined);
    });
  }

  /** Run the import through the engine's `apply` stage. */
  import(direntry: string, imports: Partial<LegacyImports>, callback: ImportCallback, options?: ImportOptions): void {
    const target = options?.importIntoProject ?? ProjectModel.instance;
    if (!target) {
      callback({ result: 'failure', message: 'No project loaded, cannot import.' });
      return;
    }
    const plan = planFromImports(direntry, imports);
    apply(plan, target).then(
      (res) => callback(toLegacyResult(res)),
      (err) => callback({ result: 'failure', message: err instanceof Error ? err.message : String(err) })
    );
  }

  /** Remove unselected items from an `imports` object in place (unchanged legacy semantics). */
  filterImports(imports: Partial<LegacyImports>, filter: { remove?: Partial<LegacyCollisions> }): void {
    const remove = filter.remove;
    if (!remove) return;

    if (remove.components?.length && imports.components)
      imports.components = imports.components.filter((c) => !remove.components!.find((_c) => _c.name == c.name));

    if (remove.resources?.length && imports.resources)
      imports.resources = imports.resources.filter((c) => !remove.resources!.find((_c) => _c.name == c.name));

    if (remove.modules?.length && imports.modules)
      imports.modules = imports.modules.filter((c) => !remove.modules!.find((_c) => _c.name == c.name));

    if (remove.variants?.length && imports.variants)
      imports.variants = imports.variants.filter(
        (c) => !remove.variants!.find((_c) => _c.name == c.name && _c.typename === c.typename)
      );

    if (remove.styles?.colors?.length && imports.styles?.colors)
      imports.styles.colors = imports.styles.colors.filter((c) => !remove.styles!.colors!.find((_c) => _c.name == c.name));

    if (remove.styles?.text?.length && imports.styles?.text)
      imports.styles.text = imports.styles.text.filter((c) => !remove.styles!.text!.find((_c) => _c.name == c.name));
  }
}

/** Default export mirrors the legacy `module.exports = ProjectImporter` singleton-carrier. */
export default LegacyImportAdapter;
