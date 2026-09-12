/**
 * TPL-005 — prepare the pixel game as a project directory.
 *
 *     npm run template:pixel
 *
 * The same shape as `generate-landing-template.ts`, minus the embedded pair:
 * Richard asked for *"the zip directly"* and a demo page, and neither needs a
 * `content.json` compiled into the editor. Everything in `templates/pixel-game/`
 * is the door's output plus the generated `docs/START-HERE.md` and the two
 * library modules the game's nodes come from.
 *
 * `preparePixelArtefact` lives in `tpl005Template.ts` rather than here so the
 * drift gate runs the same code and not a twin of it.
 */
import * as path from 'path';

import { buildPixelTemplateProject, preparePixelArtefact, TEMPLATE_ID } from '../packages/noodl-mcp/tests/tpl005Template';

const OUTPUT = path.join(__dirname, '..', 'templates', TEMPLATE_ID);

(async () => {
  const built = await buildPixelTemplateProject();
  preparePixelArtefact(built, OUTPUT);

  const pages = Object.keys(built.registrations).length;
  const start = Object.values(built.registrations).find((r) => r.startPage)?.startPage ?? '(none)';
  console.log(`wrote ${OUTPUT}`);
  console.log(`  ${built.order.length} components, ${pages} page registered, start page ${start}`);
  console.log(`  modules installed before authoring: ${built.modules.join(', ') || '(none)'}`);

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
    if (process.env.TPL005_DIAG_DETAIL) {
      for (const d of built.diagnostics) console.log(`    DETAIL ${d.code} | ${d.component} | ${d.message}`);
    }
  }
})().catch((error) => {
  console.error(error?.message ?? error);
  process.exit(1);
});
