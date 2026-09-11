import { EmbeddedTemplateProvider } from '../../models/template/EmbeddedTemplateProvider';
import { PlatformTemplateProvider } from '../../models/template/PlatformTemplateProvider';
import { TemplateRegistry } from './template/template-registry';

/**
 * The template a new project is made from when the caller does not name one.
 *
 * Kept beside the registry rather than inside `LocalProjectsModel` so a spec can
 * assert the two agree: a default URL that no registered provider claims would
 * break project creation entirely, and nothing else in the app would notice.
 */
export const DEFAULT_PROJECT_TEMPLATE = 'embedded://hello-world';

/**
 * The order matters: the first provider that claims a URL installs it.
 *
 * 🔴 There were three more providers here until FB-005 T1 — `Http`, `NoodlDocs` and an
 * unregistered `LocalTemplateProvider`. All three existed to fetch a **zip** from an
 * arbitrary origin, which is a transport this product no longer wants (R-templates ruled
 * curated-first on 2026-08-22, and the shipped curation transport is jsonb over the
 * community API, not zips). None of them had ever run: `templateRegistry.list()` had zero
 * callers, and `newProject`'s one caller passed an empty template URL, so the branch that
 * reached them never executed.
 */
/**
 * FB-005 T3 — the community shelf joins the embedded one.
 *
 * ⚠️ **The order is not load-bearing for `install` and IS for `list`.** No two providers claim
 * each other's scheme (`embedded://` against `community://`), so which one installs a given URL
 * is decided by the URL. What the order decides is the order of the picker's rows, and the
 * embedded template is first deliberately: it is the one that is there with no network, and a
 * shelf whose first card cannot be drawn offline reads as a broken shelf rather than a quiet one.
 *
 * 🔴 **A provider that throws from `list` does not empty the picker** — `TemplateRegistry.list`
 * logs it and carries on with the rest. That is what makes registering a *network* provider safe
 * here, and it is why `PlatformTemplateProvider.list` throws rather than returning `[]`.
 */
const templateRegistry = new TemplateRegistry([new EmbeddedTemplateProvider(), new PlatformTemplateProvider()]);

export { templateRegistry };
