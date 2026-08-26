/**
 * Site Builder — a content-managed website, as a project you can start from.
 *
 * Nineteen components: a public site that renders records, an admin panel that
 * writes them, and seven cloud functions that hold the publication boundary. It
 * is phase 76's product, and every graph in it was authored through the MCP door
 * and measured — structurally by three mutation-graded suites, and in a real
 * headless browser against a real backend with row-level enforcement on
 * (`packages/nodegx-backend/tests/sb008-public-site-drive.test.ts`).
 *
 * ──────────────────────────────────────────────────────────────────────────────
 * 🔴 **`site-builder.content.json` IS GENERATED. DO NOT EDIT IT BY HAND.**
 *
 *     npm run template:site-builder
 *
 * The graphs live in `packages/noodl-mcp/tests/sb00{4,5,6}Components.ts` — the
 * same arguments the suites send through the real door — plus the `App` shell in
 * `sb007Template.ts`. The script authors all of them into an empty project and
 * reads the result back with the editor's own `ProjectImporter`.
 *
 * Editing the JSON directly makes it a twin: it would keep working, the suites
 * would keep passing, and neither would be about the other. `sb007Template.test.ts`
 * regenerates and asserts byte equality, so a hand edit reddens rather than ships.
 *
 * ──────────────────────────────────────────────────────────────────────────────
 * ## Two things this template does not claim
 *
 * 🔴 **It is not pre-rendered.** SSG skips dynamic `{param}` routes, and the
 * public site is a catch-all at `{slug}` — so it would pre-render the four
 * literal `admin/` paths and none of the site. On the one template whose product
 * is SEO, that is the claim it must not make; the records-driven title goes
 * through `Noodl.SEO.setTitle` at run time instead (SB-006 F16 — a `Page` node's
 * `title` port is dead after export).
 *
 * 🔴 **It ships no backend policy.** The publication boundary — public read of
 * `Page` and `Section`, `role:admin` write, `ContactMessage` create `nobody` —
 * is `security.json` in a backend's data directory, and a template is a project
 * directory. A new project from this template has the graphs that assume that
 * policy and no policy. Filed as SB-015; SB-004 §4 carries the document.
 *
 * @module noodl-editor/models/template/templates
 */

import { ProjectContent, ProjectTemplate } from '../ProjectTemplate';

import siteBuilderContent from './site-builder.content.json';

/**
 * ⚠️ The cast is over one field the interface does not declare and the editor
 * does read: `graph.visualRoots`, which is canvas state carried through the v2
 * round trip (`reconstructLegacyComponent` restores it, and `editor-deps.ts`
 * records that it is a fixed point through that pipeline). `ComponentGraph`
 * predates it. Widening the interface for a JSON blob would be the larger change
 * and would not make anything safer — the file is generated and gate-checked.
 */
const content = siteBuilderContent as unknown as ProjectContent;

export const siteBuilderTemplate: ProjectTemplate = {
  id: 'site-builder',
  name: 'Site Builder',
  description:
    'A content-managed website: pages and sections stored as records, an admin panel to write them, and a public site that only shows what has been published.',
  // 🔴 The platform's vocabulary, not a prose title — see `ProjectTemplate.category`.
  // `site` is in `0020`'s `project_template_category_known` CHECK, and
  // `EMBEDDED_TEMPLATE_CATEGORIES` in `tests-unit/fb-005/template-shelf.test.ts`
  // is the copy on this side that enforces it.
  category: 'site',
  version: '1.0.0',
  thumbnail: undefined,

  content
};
