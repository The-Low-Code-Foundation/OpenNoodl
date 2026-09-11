/**
 * TPL-003 — the landing pages, compiled into the editor.
 *
 * Richard, 2026-09-05: *"I want to make it one of the packages templates like
 * the members area and site builder."* So this is the site builder's shape:
 * a `content.json` generated through the MCP door (`npm run template:landing`,
 * source of truth `packages/noodl-mcp/tests/tpl003Components.ts`), reached as
 * `embedded://landing-pages`, on the shelf the day the app installs.
 *
 * ## What is deliberately absent
 *
 * - **No `securityPolicy`** — the template has no backend, and
 *   `templateNeedsBackend` reads that from exactly this absence (plus the
 *   absence of any `/#__cloud__/` component), so the wizard attaches nothing.
 * - **No hand-written `designTokens`** — they are read out of the content's own
 *   `metadata.designTokens`, which the door wrote. A typed copy here would be a
 *   second statement of the look, and `tpl003Template.test.ts` holds the content
 *   to the preset + the template's tokens already.
 *
 * ## What is derived
 *
 * `docs` is `docs/START-HERE.md`, generated from the `EDIT —` markers in the
 * shipped graph and carried in `landing-pages.docs.json` by the same generator,
 * so the note can never list a node the template does not have.
 */
import { ProjectContent, ProjectTemplate, TemplateDoc } from '../ProjectTemplate';
import type { StyleTokensData } from '../../StyleTokensModel/TokenCategories';

import landingPagesContent from './landing-pages.content.json';
import landingPagesDocs from './landing-pages.docs.json';

const content = landingPagesContent as unknown as ProjectContent;

const designTokens = (content.metadata as { designTokens?: StyleTokensData } | undefined)?.designTokens;
if (!designTokens) {
  // The generator refuses to write a content file without it; this is the
  // reading on the other side of that refusal, at module load rather than at
  // the first install that ships a template with no look.
  throw new Error('landing-pages.content.json carries no metadata.designTokens — regenerate with `npm run template:landing`');
}

export const landingPagesTemplate: ProjectTemplate = {
  id: 'landing-pages',
  name: 'Landing Pages',
  // TPL-004: the shelf card is the one thing a person reads before choosing, so
  // it says what these pages DO. The first version described three documents.
  description:
    'Three complete landing pages with no backend — a freelancer’s, a local business’s and a product launch’s. Real pages, not flyers: a sticky nav that scrolls, services and questions that open, work you can filter with a story behind each piece, quotes that step, a price that switches monthly to yearly, and a contact form that checks itself before opening the visitor’s mail app. Keep one, delete the other two, publish.',
  // The platform's vocabulary — `site` is in `0020`'s CHECK and in
  // `EMBEDDED_TEMPLATE_CATEGORIES`. The members' area went out as `starter`;
  // this one is a website and says so.
  category: 'site',
  // TPL-004 rebuilt what the pages do; a version that never moves is a claim
  // that nothing did.
  version: '1.1.0',
  thumbnail: undefined,

  content,

  /** The editor opens on the first look, at `/`. A saved place wins on every later open. */
  initialOpenComponent: '/Pages/Freelancer',

  designTokens,

  docs: landingPagesDocs as unknown as ReadonlyArray<TemplateDoc>
};
