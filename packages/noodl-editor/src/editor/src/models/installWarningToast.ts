/**
 * CMP-008: what a one-click install has to say when the engine warned.
 *
 * ## The hole this fills
 *
 * `ModuleLibraryModel._install` forks on collisions. The colliding branch opens
 * the import flow, whose `ResultStage` renders `summary.warnings` under a
 * warning treatment. The **non**-colliding branch — which is every install of a
 * part into a project that does not already have it, i.e. the common one —
 * called `applyToProject` and returned, dropping `result.warnings` on the floor;
 * `ModuleCard` then showed a green *"Prefab X cloned"*.
 *
 * So the engine's warnings had a reader on the rare path and none on the common
 * one. That is not only CMP-008's token sentence: *"Failed to copy module X"*,
 * *"Could not record where the imported modules came from"* and CN-017's refusal
 * to copy an unconsented kit all arrived here and were discarded under a green
 * tick. CN-017's own words for that state are *"a kit that is simply absent,
 * with nothing anywhere saying why"*.
 *
 * ## Why this is a module and not four lines in the installer
 *
 * `ModuleLibraryModel` reaches `ProjectModel`, the toast layer and the
 * filesystem, so nothing in it can be graded without a renderer. The decision —
 * *is there anything to say, and what does it say* — is copy plus arithmetic,
 * and it is the half that can be wrong. Keeping it import-free is what puts it
 * in reach of the plain-Node runner; the installer keeps only the call.
 */

/** The two fields `ToastLayer.showWarning(message, { title })` takes. */
export interface InstallWarningToast {
  title: string;
  message: string;
}

/**
 * The warning toast for an install that produced notes, or `undefined` when it
 * produced none — so a clean install stays a single green tick and this never
 * becomes a second toast people learn to dismiss unread.
 *
 * 🔴 **Every warning, not a filtered set.** The temptation is to show only the
 * token sentence, since that is the one CMP-008 is about; the reason not to is
 * that the others were being discarded too, and a filter here would re-create
 * the silence one class of warning at a time.
 *
 * The count is in the title because the body can be long — the token sentence
 * alone names every unresolved token — and a person deciding whether to read
 * it should not have to parse the paragraph first.
 */
export function installWarningToast(warnings: readonly string[], label: string): InstallWarningToast | undefined {
  const notes = warnings.map((w) => w.trim()).filter((w) => w.length > 0);
  if (notes.length === 0) return undefined;
  return {
    title: notes.length === 1 ? `${label} installed, with one thing to check` : `${label} installed, with ${notes.length} things to check`,
    message: notes.join(' ')
  };
}
