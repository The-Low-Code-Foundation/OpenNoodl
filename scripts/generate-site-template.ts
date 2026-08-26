/**
 * SB-007 — regenerate the Site Builder embedded template from the components the
 * MCP door writes.
 *
 * ## Why the template is generated rather than authored
 *
 * The template's product is nineteen components: SB-006's five browser
 * components, SB-005's six, SB-004's seven cloud ones, and the `App` shell that
 * holds the router. All eighteen of the first three are `sb00{4,5,6}Components.ts`
 * in `packages/noodl-mcp/tests` — the arguments three mutation-graded suites and
 * one browser drive already send through the real door.
 *
 * Hand-writing the same graphs into an editor-side `.template.ts` would make a
 * twin of all four, and `measure-the-artefact-before-believing-the-task-file` is
 * about exactly that: a twin agrees with the artefact until the first edit that
 * reaches one of them. Here the shipped template would keep working while the
 * specs kept passing, and neither would be about the other.
 *
 * So: this script authors them through the door, reads the result back with the
 * **editor's own** `ProjectImporter`, and writes one JSON file.
 * `sb007Template.test.ts` performs the same generation and asserts the committed
 * file is byte-identical to it, so an edit to any component set that is not
 * followed by a regeneration reddens rather than ships.
 *
 * ## Running it
 *
 *     npm run template:site-builder
 *
 * Regeneration is deterministic: the door's id remapping, its auto-placement and
 * its page registration are all functions of the authoring order, and the three
 * per-write fields that are not (`created`, `modifiedBy`, a component `id`) are
 * dropped by `toTemplateContent`. Two consecutive runs produce the same md5.
 *
 * ⚠️ **The npm script runs `ts-node -T`, and the reason is not style.** Reaching
 * `sb007Template.ts` pulls in the editor's `ProjectImporter` and, through the MCP
 * server, most of the editor's validation tree; type-checking that program takes
 * ts-node past 2 GB and it dies on a native stack trace with no TypeScript error
 * to read. The types are not going unchecked — `sb007Template.ts` is in
 * `typecheck:mcp` and `sb007Template.test.ts` imports the same two functions this
 * file does. What is unchecked is the seventy lines below, because `scripts/` is
 * in no `tsc` program in this repo.
 */
import { writeFileSync } from 'fs';
import { join } from 'path';

import { buildSiteTemplateProject, toTemplateContent } from '../packages/noodl-mcp/tests/sb007Template';

const OUTPUT = join(
  __dirname,
  '..',
  'packages',
  'noodl-editor',
  'src',
  'editor',
  'src',
  'models',
  'template',
  'templates',
  'site-builder.content.json'
);

async function main(): Promise<void> {
  const built = await buildSiteTemplateProject();
  const content = toTemplateContent(built.project);

  const pages = Object.keys(built.registrations);
  if (pages.length === 0) {
    // 🔴 The failure this script exists to make impossible. `pageRegistration.ts`
    // treats a project with no router as legitimate, so every page write returns
    // a green result with no `registeredPages` key — six pages, six successes,
    // and an app that opens on nothing. Refusing here means the artefact cannot
    // be written in that state.
    throw new Error('no page was registered in any router — the App component did not land before the pages');
  }

  writeFileSync(OUTPUT, JSON.stringify(content, null, 2) + '\n');

  const components = (content.components as unknown[]).length;
  console.log(`wrote ${OUTPUT}`);
  console.log(`  ${components} components, ${pages.length} pages registered in the "${built.registrations[pages[0]].router}" router`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
