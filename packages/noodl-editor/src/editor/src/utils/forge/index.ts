import { EmbeddedTemplateProvider } from '../../models/template/EmbeddedTemplateProvider';
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
const templateRegistry = new TemplateRegistry([new EmbeddedTemplateProvider()]);

export { templateRegistry };
