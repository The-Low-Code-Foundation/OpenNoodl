/**
 * AIX-010 — the recommendation banner's memory.
 *
 * Dismissal is a **preference, not a project fact**, so it lives in editor
 * settings keyed by project id and never in the project files. Someone who
 * dismisses this on their machine has not decided it for their colleagues, and a
 * `docs/`-less project cloned by a second developer should still offer them the
 * retrofit once.
 *
 * `EditorSettings` already namespaces per-project UI preferences under
 * `ProjectModel.id` (side-panel widths, the active panel, the selected
 * component), so this is one more key in that blob, written with `setMerge` the
 * same way. `ProjectModel.id` is minted by the local-projects registry, not
 * stored in the project file — which is exactly the identity a local preference
 * should hang off.
 *
 * @module AiAssistant/review/bannerDismissal
 */

import { EditorSettings } from '@noodl-utils/editorsettings';

import type { ProjectModel } from '../../projectmodel';

/** Key inside the per-project settings blob. */
export const REVIEW_BANNER_DISMISSED_KEY = 'aiDocsRetrofitBannerDismissed';

function projectKey(project: ProjectModel | undefined): string | undefined {
  const id = project?.id;
  return typeof id === 'string' && id ? id : undefined;
}

/**
 * True when this user has dismissed the retrofit banner for this project.
 *
 * A project with no id (never registered with the launcher — an import in
 * flight, a spec fixture) reports "not dismissed": showing the offer once too
 * often is a smaller failure than a preference that silently cannot be stored.
 */
export function isReviewBannerDismissed(project: ProjectModel | undefined): boolean {
  const key = projectKey(project);
  if (!key) return false;
  try {
    const settings = EditorSettings.instance.get(key);
    return Boolean(settings?.[REVIEW_BANNER_DISMISSED_KEY]);
  } catch {
    return false;
  }
}

/** Dismiss permanently, for this project, on this machine. */
export function dismissReviewBanner(project: ProjectModel | undefined): void {
  const key = projectKey(project);
  if (!key) return;
  try {
    EditorSettings.instance.setMerge(key, { [REVIEW_BANNER_DISMISSED_KEY]: true });
  } catch {
    /* a settings write that fails means the banner returns — an acceptable loss */
  }
}
