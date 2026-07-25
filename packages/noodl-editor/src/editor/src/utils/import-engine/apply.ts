/**
 * LIB-004: Import Engine v2 — apply stage (I/O shell).
 *
 * Loads the source project from `plan.sourceDir` (through the format-aware
 * loader, so v2-format sources apply the same way the editor reads them), grafts
 * the planned model changes into the target `ProjectModel` inside ONE undo group
 * via the pure {@link applyModelChanges} core, then performs the disk work
 * (resource + module copies) — which is reported separately in the result with
 * the honest note that disk writes are NOT part of the undo group.
 *
 * Viewer-watch suspension and the `viewer-refresh` / `ProjectModel.importComplete`
 * events are left to the call sites (same sequencing as today); this stage does
 * pure model + disk work and returns an {@link ImportResult}.
 *
 * @module noodl-editor/utils/import-engine/apply
 */

import { ProjectModel } from '@noodl-models/projectmodel';
import { projectFromDirectory } from '@noodl-models/projectmodel.editor';
import { UndoActionGroup, UndoQueue } from '@noodl-models/undo-queue-model';

import FileSystem from '../filesystem';
import { applyModelChanges, ImportSource, ImportTarget, PreparedComponent } from './applyModel';
import type { ImportPlan, ImportResult, ItemPolicy } from './types';

/** The subset of a project component the apply adapters touch. */
interface ProjectComponentLike {
  name: string;
  id?: string;
  rekeyAllIds(): void;
  rerouteComponentRefs(oldPathPrefix: string, newPathPrefix: string): void;
}

/** The subset of `ProjectModel` the apply adapters touch. */
interface ProjectModelLike {
  _retainedProjectDirectory: string;
  getComponentWithName(name: string): ProjectComponentLike | undefined;
  removeComponent(component: unknown, args?: unknown): void;
  addComponent(component: unknown, args?: unknown): void;
  mergeMetadata(data: unknown): void;
  findVariant(name: string, nodetype: { localName: string }): unknown;
  deleteVariant(variant: unknown, args?: unknown): void;
  addVariant(variant: unknown, args?: unknown): void;
  getMetaData(key: string): unknown;
  copyFileToProjectDirectory(file: { fullPath: string; name: string }, callback: (r: { result: string }) => void): void;
}

/** Source-project adapter: detaching a component prepares it for import in place. */
function makeSource(project: ProjectModelLike): ImportSource<ProjectComponentLike> {
  return {
    takeComponent(name) {
      const c = project.getComponentWithName(name);
      if (!c) return undefined;
      project.removeComponent(c);
      // Re-key: fresh component id + fresh node ids. The overwrite path below
      // overrides the component id again with the target's.
      delete c.id;
      c.rekeyAllIds();
      const prepared: PreparedComponent<ProjectComponentLike> = {
        model: c,
        setId(id) {
          c.id = id;
        },
        setName(newName) {
          c.name = newName;
        },
        rerouteComponentRefs(oldName, newName) {
          c.rerouteComponentRefs(oldName, newName);
        }
      };
      return prepared;
    },
    styleDef(kind, name) {
      const styles = project.getMetaData('styles') as { colors?: Record<string, unknown>; text?: Record<string, unknown> } | undefined;
      return styles?.[kind]?.[name];
    },
    takeVariant(typename, name) {
      const v = project.findVariant(name, { localName: typename });
      if (v === undefined) return undefined;
      project.deleteVariant(v);
      return v;
    }
  };
}

/** Target-project adapter: model ops enroll in the shared undo group. */
function makeTarget(project: ProjectModelLike, undo: UndoActionGroup): ImportTarget<ProjectComponentLike> {
  const args = { undo, label: 'import' };
  return {
    existingComponentId(name) {
      return project.getComponentWithName(name)?.id;
    },
    removeComponentByName(name) {
      const existing = project.getComponentWithName(name);
      if (existing) project.removeComponent(existing, args);
    },
    addComponent(model) {
      project.addComponent(model, args);
    },
    mergeStyles(styles) {
      // Metadata merge is not undoable (legacy parity).
      project.mergeMetadata({ styles });
    },
    hasVariant(typename, name) {
      return project.findVariant(name, { localName: typename }) !== undefined;
    },
    removeVariant(typename, name) {
      const v = project.findVariant(name, { localName: typename });
      if (v !== undefined) project.deleteVariant(v, args);
    },
    addVariant(variant) {
      project.addVariant(variant, args);
    }
  };
}

const active = (policy: ItemPolicy): boolean => policy.action !== 'skip';

function emptyResult(overrides: Partial<ImportResult>): ImportResult {
  return {
    result: 'success',
    componentsImported: [],
    variantsImported: [],
    stylesImported: { colors: [], text: [] },
    filesCopied: [],
    modulesCopied: [],
    warnings: [],
    ...overrides
  };
}

/** Copy one resource file from source dir into the target project directory. */
function copyResource(target: ProjectModelLike, sourceDir: string, name: string): Promise<boolean> {
  return new Promise((resolve) => {
    target.copyFileToProjectDirectory({ fullPath: sourceDir + '/' + name, name }, (r) => resolve(r.result === 'success'));
  });
}

/**
 * Apply an {@link ImportPlan} to a target project. `plan.sourceDir` is the
 * project the components come from; `targetProject` is imported into (the current
 * project, or an export staging project). Never mutates the source's model on
 * disk — only detaches in memory to graft into the target.
 */
export function apply(plan: ImportPlan, targetProject: ProjectModel): Promise<ImportResult> {
  const target = targetProject as unknown as ProjectModelLike;
  if (!target) {
    return Promise.resolve(emptyResult({ result: 'failure', message: 'No project loaded, cannot import.' }));
  }

  return new Promise((resolve) => {
    projectFromDirectory(plan.sourceDir, async (importProject?: ProjectModel) => {
      if (!importProject) {
        resolve(emptyResult({ result: 'failure', message: 'Could not open project to import' }));
        return;
      }

      try {
        const source = importProject as unknown as ProjectModelLike;

        // ── Model changes in one undo group ────────────────────────────────
        const undoGroup = new UndoActionGroup({ label: 'Import' });
        const modelResult = applyModelChanges(plan, makeSource(source), makeTarget(target, undoGroup));
        if (!undoGroup.isEmpty()) UndoQueue.instance.push(undoGroup);

        // ── Disk work (NOT undoable — reported separately) ─────────────────
        const warnings = [...modelResult.warnings];
        const filesCopied: string[] = [];
        const modulesCopied: string[] = [];

        const resources = plan.resources.filter((r) => active(r.policy));
        for (const r of resources) {
          const ok = await copyResource(target, plan.sourceDir, r.name);
          if (ok) filesCopied.push(r.name);
          else warnings.push(`Failed to copy file "${r.name}".`);
        }

        const modules = plan.modules.filter((m) => active(m.policy));
        for (const m of modules) {
          try {
            FileSystem.instance.copyRecursiveSync(
              source._retainedProjectDirectory + '/noodl_modules/' + m.name,
              target._retainedProjectDirectory + '/noodl_modules/' + m.name
            );
            modulesCopied.push(m.name);
          } catch (err) {
            warnings.push(`Failed to copy module "${m.name}": ${err instanceof Error ? err.message : String(err)}`);
          }
        }

        const filesFailed = warnings.some((w) => w.startsWith('Failed to copy file'));
        resolve(
          emptyResult({
            result: filesFailed ? 'failure' : 'success',
            message: filesFailed ? 'Not all files could be copied' : undefined,
            componentsImported: modelResult.componentsImported,
            variantsImported: modelResult.variantsImported,
            stylesImported: modelResult.stylesImported,
            filesCopied,
            modulesCopied,
            warnings
          })
        );
      } catch (err) {
        resolve(emptyResult({ result: 'failure', message: err instanceof Error ? err.message : String(err) }));
      }
    });
  });
}
