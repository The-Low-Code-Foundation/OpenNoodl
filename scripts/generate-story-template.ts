/**
 * TPL-006 — prepare the story engine as a project directory.
 *
 *     npm run template:story
 *
 * The same shape as `generate-pixel-template.ts`, minus the module install:
 * this template uses nothing outside the standard library, so there is no
 * `noodl_modules/` to carry and `prepareStoryArtefact` refuses to write if one
 * appears.
 *
 * `prepareStoryArtefact` lives in `tpl006Template.ts` rather than here so the drift
 * gate runs the same code and not a twin of it.
 */
import * as path from 'path';

import {
  buildStoryTemplateProject,
  prepareStoryArtefact,
  TEMPLATE_ID
} from '../packages/noodl-mcp/tests/tpl006Template';

const OUTPUT = path.join(__dirname, '..', 'templates', TEMPLATE_ID);

(async () => {
  const built = await buildStoryTemplateProject();
  prepareStoryArtefact(built, OUTPUT);

  const pages = Object.keys(built.registrations).length;
  const start = Object.values(built.registrations).find((r) => r.startPage)?.startPage ?? '(none)';
  const story = JSON.parse(built.storyJson) as Array<{ id: string; choices?: unknown[] }>;
  const endings = story.filter((p) => !Array.isArray(p.choices) || p.choices.length === 0).length;

  console.log(`wrote ${OUTPUT}`);
  console.log(`  ${built.order.length} components, ${pages} pages registered, start page ${start}`);
  console.log(`  the story: ${story.length} passages, ${endings} endings`);
  console.log('  modules: none — this template installs nothing');

  if (built.remaps.length > 0) {
    console.log(`  ${built.remaps.length} node ids the door moved to keep them unique project-wide:`);
    for (const r of built.remaps) console.log(`    ${r.component}: ${r.from} → ${r.to}`);
  }

  // Printed rather than counted: a warning that never reaches `isError` is a check
  // that fired and was dropped by the caller.
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
    if (process.env.TPL006_DIAG_DETAIL) {
      for (const d of built.diagnostics) console.log(`    DETAIL ${d.code} | ${d.component} | ${d.message}`);
    }
  }
})().catch((error) => {
  console.error(error?.message ?? error);
  process.exit(1);
});
