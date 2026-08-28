/**
 * TPL-001 — prepare the members' area template as a project directory.
 *
 *     npm run template:members
 *
 * ## Why a DIRECTORY and not a content JSON
 *
 * `generate-site-template.ts` emits `site-builder.content.json`, which is
 * compiled into the editor and reached as `embedded://`. This template is
 * **curated**: `shareAsTemplate` files a submission and publishes nothing, and
 * the platform's `readBundleDirectory` *"skips nothing silently… an operator
 * points it at a directory they prepared."* So the artefact is a project
 * directory, Richard is the operator, and the published row reaches everyone
 * already on 0.2.0 without an app update.
 *
 * ## 🔴 Three fields per component would make every run differ, so they are FIXED
 *
 * `toTemplateContent` DROPS `id`, `created` and `modifiedBy`, and says why:
 * *"dropping them is what makes the artefact comparable to a fresh run at all…
 * the drift gate would have to compare SOME of the artefact, which is the check
 * that passes while the thing it guards rots."*
 *
 * A project directory cannot drop them — the v2 component schema carries them —
 * so this script does the other half of the same idea and **pins** them:
 *
 * - `id` — a UUIDv5-shaped digest of the component's own path. Deterministic,
 *   unique within the project, and stable across regenerations.
 * - `created` / `modified` — `TEMPLATE_EPOCH`, a written constant.
 * - `_registry.json`'s `lastUpdated` — the same constant.
 *
 * ⚠️ **Everything else is left exactly as the door wrote it.** The point of
 * generating through the door is that the artefact IS the door's output; a
 * normaliser that reached further would start being a second author.
 *
 * ## What this does NOT write
 *
 * 🔴 **`nodegx.security.json`.** It is hand-authored and lives beside this
 * script's output rather than in it — the same split `site-builder.security.json`
 * has ("hand-edited, NOT generated"). This template's whole product is its
 * policy; a generated one would be a policy nobody read.
 */
import { createHash } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

import { buildMembersTemplateProject, TEMPLATE_ID } from '../packages/noodl-mcp/tests/tpl001Template';

/** Written, not sampled: `new Date()` here would make every run differ. */
const TEMPLATE_EPOCH = '2026-08-28T00:00:00.000Z';

const OUTPUT = path.join(__dirname, '..', 'templates', TEMPLATE_ID);

/** A stable UUID-shaped id for a component, derived from its path alone. */
function stableId(componentPath: string): string {
  const h = createHash('sha1').update(`tpl001:${componentPath}`).digest('hex');
  // UUIDv5 layout: version nibble 5, variant nibble 8.
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-5${h.slice(13, 16)}-8${h.slice(17, 20)}-${h.slice(20, 32)}`;
}

/**
 * Pin every per-run field in one component's directory.
 *
 * 🔴 **The id is written in THREE files, not one.** `component.json` carries
 * `id`; `nodes.json` and `connections.json` each carry a `componentId` naming
 * the same component. Pinning only the first left the other two fresh per run —
 * found by regenerating twice and diffing, which is the only reason this
 * function is correct rather than merely plausible.
 */
function pinComponentDirectory(dir: string): void {
  const componentFile = path.join(dir, 'component.json');
  const doc = JSON.parse(fs.readFileSync(componentFile, 'utf-8')) as Record<string, unknown>;
  const id = stableId(String(doc.path));

  doc.id = id;
  doc.created = TEMPLATE_EPOCH;
  doc.modified = TEMPLATE_EPOCH;
  fs.writeFileSync(componentFile, `${JSON.stringify(doc, null, 2)}\n`);

  for (const name of ['nodes.json', 'connections.json']) {
    const file = path.join(dir, name);
    if (!fs.existsSync(file)) continue;
    const sidecar = JSON.parse(fs.readFileSync(file, 'utf-8')) as Record<string, unknown>;
    if ('componentId' in sidecar) sidecar.componentId = id;
    fs.writeFileSync(file, `${JSON.stringify(sidecar, null, 2)}\n`);
  }
}

function pinComponentFiles(dir: string): void {
  const stack = [dir];
  while (stack.length) {
    const current = stack.pop() as string;
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      stack.push(path.join(current, entry.name));
    }
    if (fs.existsSync(path.join(current, 'component.json'))) pinComponentDirectory(current);
  }
}

/**
 * The registry keeps its OWN `created`/`modified` per component, beside the
 * top-level `lastUpdated`. Same run-twice finding.
 */
function pinRegistry(dir: string): void {
  const file = path.join(dir, 'components', '_registry.json');
  const doc = JSON.parse(fs.readFileSync(file, 'utf-8')) as {
    lastUpdated?: string;
    components?: Record<string, Record<string, unknown>>;
  };
  doc.lastUpdated = TEMPLATE_EPOCH;
  for (const row of Object.values(doc.components ?? {})) {
    if ('created' in row) row.created = TEMPLATE_EPOCH;
    if ('modified' in row) row.modified = TEMPLATE_EPOCH;
  }
  fs.writeFileSync(file, `${JSON.stringify(doc, null, 2)}\n`);
}

function copyTree(from: string, to: string): void {
  fs.mkdirSync(to, { recursive: true });
  for (const entry of fs.readdirSync(from, { withFileTypes: true })) {
    const src = path.join(from, entry.name);
    const dst = path.join(to, entry.name);
    if (entry.isDirectory()) copyTree(src, dst);
    else fs.copyFileSync(src, dst);
  }
}

(async () => {
  const built = await buildMembersTemplateProject();

  // 🔴 The guard `generate-site-template.ts` carries, for the same reason: a
  // page written before its router exists is written, reported green, and never
  // routed — `pageRegistration.ts` states that a project with no router is not
  // an error. An artefact with an empty registration map is an app that opens
  // on nothing, and it must not be possible to ship one by accident.
  const registered = Object.keys(built.registrations);
  if (registered.length === 0) {
    throw new Error('refusing to write: no page registered into a router — the app would open on nothing');
  }

  pinComponentFiles(built.projectDir);
  pinRegistry(built.projectDir);

  // ⚠️ Replaced wholesale rather than merged: the door's output IS the artefact,
  // so a file surviving here that the door no longer writes would be a component
  // nothing generates and nothing gates. Guarded on the path so a mistyped
  // OUTPUT cannot delete something else.
  if (path.basename(OUTPUT) !== TEMPLATE_ID) throw new Error(`refusing to clear ${OUTPUT}`);
  fs.rmSync(OUTPUT, { recursive: true, force: true });
  copyTree(built.projectDir, OUTPUT);

  const pages = registered.length;
  const start = Object.values(built.registrations).find((r) => r.startPage)?.startPage ?? '(none)';
  console.log(`wrote ${OUTPUT}`);
  console.log(`  ${built.order.length} components, ${pages} pages registered, start page ${start}`);
})().catch((error) => {
  console.error(error?.message ?? error);
  process.exit(1);
});
