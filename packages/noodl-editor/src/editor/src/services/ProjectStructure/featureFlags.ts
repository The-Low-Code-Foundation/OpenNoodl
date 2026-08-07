/**
 * SUB-001 — v2 project-format feature flag.
 *
 * Gates the v2 read/write integration. **Default ON**: new projects are created
 * in the decomposed format and any v2 directory opens natively. The flag now
 * exists as a kill switch rather than an opt-in.
 *
 * Turning it off does not convert anything back — a project's format is what is
 * on disk. It only makes the editor refuse to read v2 directories and keeps the
 * legacy single-file save path for projects that are already legacy. Legacy
 * projects are unaffected either way: `ProjectModel.toDirectory` picks the save
 * path from the *detected* format, so a `project.json` project keeps writing
 * `project.json` until it is explicitly migrated.
 *
 * Resolution order (first that applies wins):
 *   1. Env kill switch  `NODEGX_DISABLE_V2=1` forces OFF (build/main-process).
 *   2. localStorage override  `nodegx.formatV2` = 'true' | 'false' (quick dev toggle).
 *   3. EditorSettings  `formatV2.enabled` — an explicit `false` forces OFF.
 *   4. Otherwise ON.
 *
 * @module noodl-editor/services/ProjectStructure/featureFlags
 */

import { EditorSettings } from '@noodl-utils/editorsettings';

export const FORMAT_V2_SETTING_KEY = 'formatV2.enabled';
const LOCALSTORAGE_OVERRIDE_KEY = 'nodegx.formatV2';

/** Whether the v2 decomposed project format is enabled for read/write. */
export function isV2FormatEnabled(): boolean {
  // 1. Env kill switch.
  try {
    if (typeof process !== 'undefined' && process.env && process.env.NODEGX_DISABLE_V2 === '1') {
      return false;
    }
  } catch {
    /* process not available in this context */
  }

  // 2. localStorage override.
  try {
    if (typeof localStorage !== 'undefined') {
      const override = localStorage[LOCALSTORAGE_OVERRIDE_KEY];
      if (override === 'true') return true;
      if (override === 'false') return false;
    }
  } catch {
    /* localStorage not available */
  }

  // 3. EditorSettings — only an explicit `false` disables. An unset setting
  //    (the case for every existing install) means ON.
  try {
    return EditorSettings.instance.get(FORMAT_V2_SETTING_KEY) !== false;
  } catch {
    return true;
  }
}
