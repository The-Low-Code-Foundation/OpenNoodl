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
 * so `prepareArtefact` (in `tpl001Template.ts`, where the drift gate can run the
 * same code rather than a twin of it) does the other half and **pins** them:
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
 * ## The policy is COPIED, never generated — and it lives outside the output
 *
 * 🔴 **`nodegx.security.json` is hand-authored** — the same split
 * `site-builder.security.json` has ("hand-edited, NOT generated"). This
 * template's whole product is its policy; a generated one would be a policy
 * nobody read.
 *
 * ⚠️ **And the hand-authored file cannot live in `templates/members-area/`**,
 * because this script clears that directory wholesale before copying the door's
 * output into it. A policy sitting there would be deleted by the next
 * regeneration — silently, and in the direction that leaves the artefact
 * looking complete. So the source of truth is
 * `templates/members-area.security.json`, beside the directory rather than in
 * it, and this script copies it in as the last step.
 *
 * That also makes the drift gate simpler than TPL-001 §"next" expected: there is
 * no file to *exclude* from byte-comparison, because a regeneration reproduces
 * the whole artefact including the policy. The two populations are the two
 * SOURCES — a generated one and a hand-edited one — and they stay separate on
 * disk rather than by a rule in a spec.
 */
import * as path from 'path';

import {
  buildMembersTemplateProject,
  POLICY_FILE,
  prepareArtefact,
  TEMPLATE_ID
} from '../packages/noodl-mcp/tests/tpl001Template';

const OUTPUT = path.join(__dirname, '..', 'templates', TEMPLATE_ID);

/** The hand-authored policy: the source of truth, beside the artefact rather than in it. */
const POLICY_SOURCE = path.join(__dirname, '..', 'templates', `${TEMPLATE_ID}.security.json`);

(async () => {
  const built = await buildMembersTemplateProject();

  // 🔴 `prepareArtefact` lives in `tpl001Template.ts` rather than here, and that
  // is the drift gate's requirement rather than tidiness: a gate that
  // regenerated the components but ran a DIFFERENT normaliser would be comparing
  // something this script does not produce. The pinning is exactly where the
  // last defect was — the component id is written in three files — so the spec
  // has to run this code and not a twin of it.
  prepareArtefact(built, OUTPUT, POLICY_SOURCE);

  const pages = Object.keys(built.registrations).length;
  const start = Object.values(built.registrations).find((r) => r.startPage)?.startPage ?? '(none)';
  console.log(`wrote ${OUTPUT}`);
  console.log(`  ${built.order.length} components, ${pages} pages registered, start page ${start}`);
  console.log(`  policy ${POLICY_SOURCE} copied in as ${POLICY_FILE}`);

  // 🔴 The door reports every node id it moved, and the first version of this
  // script threw that away. Ids are de-duplicated PROJECT-WIDE, so a second
  // component reusing `emptyState` lands as `emptyState-2` — which is exactly
  // what a caller keying a follow-up write on an id it just sent needs to know.
  if (built.remaps.length > 0) {
    console.log(`  ${built.remaps.length} node ids the door moved to keep them unique project-wide:`);
    for (const r of built.remaps) console.log(`    ${r.component}: ${r.from} → ${r.to}`);
  }

  // 🔴 Printed rather than counted. A warning that never reaches `isError` is a
  // check that fired, decided something was wrong, and was dropped by the
  // caller — and "the run was clean" said about a payload nobody read is the
  // absence of a measurement, not a measurement of absence.
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
  }
})().catch((error) => {
  console.error(error?.message ?? error);
  process.exit(1);
});
