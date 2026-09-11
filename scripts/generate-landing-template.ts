/**
 * TPL-003 — prepare the landing-pages template as a project directory.
 *
 *     npm run template:landing
 *
 * The same shape as `generate-members-template.ts`, minus the policy: this
 * template ships no backend, so there is no hand-authored file to copy in and
 * nothing beside the directory. Everything in `templates/landing-pages/` is the
 * door's output plus the generated `docs/START-HERE.md`.
 *
 * AND the embedded pair — `landing-pages.content.json` + `landing-pages.docs.json`
 * beside `site-builder.content.json` — from the same build, because Richard
 * asked for it *"like the members area and site builder"*: compiled into the
 * editor, on the shelf the day 0.2.2 installs, no publish needed.
 *
 * `prepareLandingArtefact` lives in `tpl003Template.ts` rather than here so the
 * drift gate runs the same code and not a twin of it.
 */
import * as path from 'path';

import {
  buildLandingTemplateProject,
  EMBEDDED_CONTENT_FILE,
  EMBEDDED_DIR,
  EMBEDDED_DOCS_FILE,
  prepareLandingArtefact,
  TEMPLATE_ID,
  writeEmbeddedTemplate
} from '../packages/noodl-mcp/tests/tpl003Template';

const OUTPUT = path.join(__dirname, '..', 'templates', TEMPLATE_ID);

(async () => {
  const built = await buildLandingTemplateProject();
  prepareLandingArtefact(built, OUTPUT);
  // The embedded pair, from the same build: `embedded://landing-pages`.
  writeEmbeddedTemplate(built, OUTPUT, EMBEDDED_DIR);
  console.log(`wrote ${EMBEDDED_DIR}/${EMBEDDED_CONTENT_FILE} and ${EMBEDDED_DOCS_FILE}`);

  const pages = Object.keys(built.registrations).length;
  const start = Object.values(built.registrations).find((r) => r.startPage)?.startPage ?? '(none)';
  console.log(`wrote ${OUTPUT}`);
  console.log(`  ${built.order.length} components, ${pages} pages registered, start page ${start}`);

  if (built.remaps.length > 0) {
    console.log(`  ${built.remaps.length} node ids the door moved to keep them unique project-wide:`);
    for (const r of built.remaps) console.log(`    ${r.component}: ${r.from} → ${r.to}`);
  }

  // Printed rather than counted: a warning that never reaches `isError` is a
  // check that fired and was dropped by the caller.
  const byCode = new Map<string, number>();
  for (const d of built.diagnostics) {
    const key = `${d.severity} ${d.code}`;
    byCode.set(key, (byCode.get(key) ?? 0) + 1);
  }
  if (byCode.size === 0) {
    console.log('  no diagnostics raised on any write');
  } else {
    console.log(`  ${built.diagnostics.length} diagnostics the door raised and did not refuse over:`);
    for (const [key, count] of [...byCode.entries()].sort()) console.log(`    ${count.toString().padStart(3)} × ${key}`);
    if (process.env.TPL003_DIAG_DETAIL) {
      for (const d of built.diagnostics) console.log(`    DETAIL ${d.code} | ${d.component} | ${d.message}`);
    }
  }
})().catch((error) => {
  console.error(error?.message ?? error);
  process.exit(1);
});
