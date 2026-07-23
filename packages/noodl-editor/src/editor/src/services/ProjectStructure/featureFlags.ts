/**
 * SUB-001 — v2 project-format feature flag.
 *
 * Gates the entire v2 read/write integration during rollout. Default OFF, so
 * behaviour is byte-for-byte identical to today until a developer opts in.
 *
 * Resolution order (first that applies wins):
 *   1. Env kill switch  `NODEGX_DISABLE_V2=1` forces OFF (build/main-process).
 *   2. localStorage override  `nodegx.formatV2` = 'true' | 'false' (quick dev toggle).
 *   3. EditorSettings  `formatV2.enabled` boolean (the UI-surfaced setting).
 *   4. Otherwise OFF.
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

  // 3. EditorSettings.
  try {
    return EditorSettings.instance.get(FORMAT_V2_SETTING_KEY) === true;
  } catch {
    return false;
  }
}
