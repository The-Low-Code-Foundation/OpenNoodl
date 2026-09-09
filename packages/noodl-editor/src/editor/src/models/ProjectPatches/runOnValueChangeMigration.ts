/**
 * NDA-017's load-time migration — the editor's name for it.
 *
 * 🔴 **The migration itself now lives in `@nodegx/project-contract/run-on-value-change-migration`**
 * (HLS-003). It moved for the same reason the token vocabulary did in HLS-001: it is not the
 * editor's private business. It is the answer to *"what does a project on disk mean?"*, and
 * `@nodegx/export` has to give the same answer — while being a package anyone can install, which
 * it cannot be if it reaches into the editor's source tree by relative path.
 *
 * ⚠️ **Do not copy it back.** The whole defect class this module documents is a hand-maintained
 * answer that decayed because two readers each kept their own. One copy, imported by everyone:
 * the editor (through this file), the merge driver, template generation, and the exporter.
 *
 * Change the migration in that file, not here. This file exists so that every existing import
 * keeps working.
 */
export {
  RUN_ON_CHANGE_PREFIX,
  RUN_ON_CHANGE_FAMILIES,
  runOnChangePortName,
  governedInputsFor,
  planRunOnValueChangeMigration,
  applyRunOnValueChangeMigration,
  pinRunOnValueChangeDefaults,
  describeRunOnValueChangeMigration
} from '@nodegx/project-contract/run-on-value-change-migration';

export type {
  RunOnChangeFamily,
  MigrationNodeLike,
  MigrationConnectionLike,
  MigrationComponentLike,
  MigrationProjectLike,
  RunOnChangeWrite,
  RunOnValueChangeMigrationPlan
} from '@nodegx/project-contract/run-on-value-change-migration';
