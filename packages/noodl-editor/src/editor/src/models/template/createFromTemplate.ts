/**
 * FB-005 T1 — everything a new project directory needs before a `ProjectModel` is
 * loaded out of it, in one place a plain-Node spec can run.
 *
 * ## Why this is a module and not four lines inside `newProject`
 *
 * It was four lines inside `newProject`, twice — once for the template branch and
 * once for the default branch — and the two copies had drifted: only one of them
 * went through `templateRegistry`, and that one had never executed. `newProject`
 * itself cannot be graded by a spec, because it reaches `electron-store`,
 * `@noodl/git` and a `LocalProjectsModel.instance` that writes into the user's real
 * launcher list on `_addProject`. So the decisions moved here, where fakes can drive
 * them, and `newProject` keeps only the `ProjectModel` plumbing that genuinely needs
 * a renderer.
 *
 * 🔴 The outcome uses a **string** discriminant. This repo's `tsconfig.json` sets no
 * `strict`, so `strictNullChecks` is off and a boolean discriminant does not narrow a
 * union — a caller reading `.reason` off a `{ ok: false }` arm would not be checked.
 */

import { DEFAULT_PROJECT_TEMPLATE } from '@noodl-utils/forge';

export type CreateFromTemplateOutcome =
  | { status: 'created'; templateUrl: string }
  | { status: 'refused'; templateUrl: string; reason: string };

/**
 * The steps, as the caller supplies them. Injected rather than imported so a spec can
 * observe the order they run in — which is load-bearing, see `installStarterAssets`.
 */
export interface CreateFromTemplateDeps {
  makeDirectory(directory: string): Promise<void>;
  installTemplate(templateUrl: string, destination: string): Promise<void>;
  installStarterAssets(destination: string): Promise<unknown>;
  writeAgentConfig(destination: string, projectName: string): Promise<void>;
}

/**
 * Which template a new project is made from.
 *
 * The create wizard passes the literal `''` for "no template chosen", and every other
 * caller may pass nothing at all. Both mean the same thing and both land on the
 * default — there has never been a project created from no template, only projects
 * created from the default one without saying so.
 */
export function resolveTemplateUrl(requested?: string): string {
  return requested || DEFAULT_PROJECT_TEMPLATE;
}

/**
 * Prepare `destination` so that a project can be loaded out of it.
 *
 * Never throws: a failure at any step is an outcome, because the one caller is a
 * callback-style method nobody awaits. A rejection there became an unhandled promise
 * rejection, the launcher's "Creating new project" activity toast was never hidden,
 * and the user sat in front of a spinner that had already given up.
 *
 * ⚠️ A refusal leaves the directory behind. Deleting a directory the caller chose is
 * the more destructive of the two mistakes, and `newProject`'s one caller passes a
 * `makeUniquePath`, so what is left behind is empty and unnamed by anything else.
 */
export async function createProjectFromTemplate(
  options: { templateUrl?: string; destination: string; projectName: string },
  deps: CreateFromTemplateDeps
): Promise<CreateFromTemplateOutcome> {
  const templateUrl = resolveTemplateUrl(options.templateUrl);

  try {
    await deps.makeDirectory(options.destination);
    await deps.installTemplate(templateUrl, options.destination);

    // POL-006. **After** the template, so a template that ships its own font or icon set
    // keeps it — `installStarterAssets` never overwrites — and before the project is
    // loaded, so the module scanner sees them on its first scan rather than one nobody
    // triggers.
    await deps.installStarterAssets(options.destination);
  } catch (error) {
    return {
      status: 'refused',
      templateUrl,
      reason: error instanceof Error ? error.message : String(error)
    };
  }

  // 🔴 Deliberately outside the guard above, and deliberately not fatal. The agent
  // configuration is `.mcp.json` and a `CLAUDE.md`; a project that has neither is still
  // a project, and `backfillProjectAgentConfig` writes them into a project the user
  // merely opens. Losing a template that installed correctly over a file the app will
  // write again on the next open is the wrong trade — but it was the behaviour, because
  // `newProject` awaited this step inside the same unguarded run as the template.
  try {
    await deps.writeAgentConfig(options.destination, options.projectName);
  } catch (error) {
    console.warn('Could not write the new project’s agent configuration', error);
  }

  return { status: 'created', templateUrl };
}
