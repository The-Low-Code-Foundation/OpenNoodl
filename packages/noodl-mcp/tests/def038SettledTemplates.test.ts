/**
 * DEF-038 — **every shipped template artefact means the same thing on disk as it
 * does once the editor has loaded it**, and the population is DERIVED.
 *
 * ──────────────────────────────────────────────────────────────────────────────
 * ## Why this file exists rather than another `it` beside one generator
 *
 * DEF-007 §3.2 settled the site builder and gated it in `sb007Template.test.ts`
 * — a gate that regenerates *that* generator and compares bytes. TPL-001 is a
 * second artefact that gate never looks at, and it disagreed in **57 stored
 * parameters** for the whole time the row read green (measured 2026-09-03 at
 * HEAD, before the fix; the control read 0 with 97 family nodes beside it).
 *
 * 🔴 **That is the decaying-hand-list shape DEF-007 AC4 exists to prevent** — a
 * fix applied to the generator somebody was looking at, and a gate scoped to it.
 * So this gate does not name its artefacts. It **finds** them, and refuses to
 * pass on an empty population: a sweep that reached nothing reports the answer
 * you wanted.
 *
 * ## What "settled" means here
 *
 * `applyPatches` runs NDA-017's migration on every editor open. On a graph
 * authored *after* NDA-017 §2 — which every generated template is — an absent
 * `runOnChange-*` key already means *ticked*, and the migration reads that same
 * absence as evidence of a pre-§2 author and writes `false`. Loading such an
 * artefact therefore rewrites parameters nobody wrote and silences deliberate
 * load-time fetches. The argument, and why the pin writes `true` rather than the
 * migration's `false`, is in `pinRunOnValueChangeDefaults` and is not restated.
 *
 * A settled artefact makes that load-time pass a **no-op**, which is what these
 * assertions read: *the migration would write nothing*.
 *
 * ## Bounds, stated so this is not over-read
 *
 * ⚠️ **`hello-world.template.ts` is out of the population by construction** — it
 * is a `.ts` module, not a discoverable artefact, and it contains none of the
 * fifteen families (measured: zero occurrences of any family type). A third
 * template written as a `.ts` module would escape this sweep the same way, and
 * that is the known hole rather than a claimed absence.
 *
 * ⚠️ This grades the artefacts **as committed**. It is not a check on the
 * generators; `tpl001Template.test.ts` and `sb007Template.test.ts` own that, by
 * regenerating and comparing bytes. Both halves are needed: this one fails if a
 * committed artefact drifts, those fail if a generator stops producing it.
 *
 * @module noodl-mcp/tests/def038SettledTemplates.test
 */
import * as fs from 'fs';
import * as path from 'path';

import { planRunOnValueChangeMigration } from '../../noodl-editor/src/editor/src/models/ProjectPatches/runOnValueChangeMigration';

import { readAsLegacyProject } from './templateArtefact';

const REPO = path.resolve(__dirname, '../../..');

/** Where a shipped artefact can live, and what shape it takes there. */
const TEMPLATE_DIRECTORIES = path.join(REPO, 'templates');
const EMBEDDED_CONTENT = path.join(
  REPO,
  'packages/noodl-editor/src/editor/src/models/template/templates'
);

type Artefact = { name: string; project: { components?: unknown[] } };

/**
 * Find every shipped template artefact. **Derived, never listed** — see the
 * header. Two shapes, because the two generators ship differently: a v2 project
 * directory (TPL-001) and an embedded legacy `content.json` (the site builder).
 */
function shippedArtefacts(): Artefact[] {
  const found: Artefact[] = [];

  if (fs.existsSync(TEMPLATE_DIRECTORIES)) {
    for (const entry of fs.readdirSync(TEMPLATE_DIRECTORIES, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const dir = path.join(TEMPLATE_DIRECTORIES, entry.name);
      if (!fs.existsSync(path.join(dir, 'nodegx.project.json'))) continue;
      found.push({ name: `templates/${entry.name}`, project: readAsLegacyProject(dir) as never });
    }
  }

  if (fs.existsSync(EMBEDDED_CONTENT)) {
    for (const file of fs.readdirSync(EMBEDDED_CONTENT)) {
      if (!file.endsWith('.content.json')) continue;
      found.push({
        name: file,
        project: JSON.parse(fs.readFileSync(path.join(EMBEDDED_CONTENT, file), 'utf-8'))
      });
    }
  }

  return found.sort((a, b) => a.name.localeCompare(b.name));
}

describe('DEF-038 — every shipped template artefact is settled against NDA-017', () => {
  const artefacts = shippedArtefacts();

  it('🔴 control: the sweep found the artefacts that exist, and both shapes are in it', () => {
    // An empty population would make every assertion below pass by reaching
    // nothing. The floor is 2 and the two shapes are named, so a generator whose
    // output stops being discoverable reddens here rather than going quiet.
    expect(artefacts.length).toBeGreaterThanOrEqual(2);
    expect(artefacts.map((a) => a.name)).toEqual(
      expect.arrayContaining(['site-builder.content.json', 'templates/members-area'])
    );
  });

  it.each(artefacts.map((a) => [a.name, a] as const))(
    '%s — an editor load would rewrite nothing',
    (_name, artefact) => {
      const plan = planRunOnValueChangeMigration(artefact.project as never);

      // 🔴 The presence control, on the SAME reading. A zero `writes` beside a
      // zero `familyNodes` is a broken instrument, not a settled artefact —
      // exactly how the site-builder figure would have been misread.
      expect(plan.familyNodes).toBeGreaterThan(0);
      expect(plan.writes).toEqual([]);
    }
  );

  it.each(artefacts.map((a) => [a.name, a] as const))(
    '%s — control: the check is live, and unsettling one parameter reddens it',
    (_name, artefact) => {
      // Mutate a copy: take back the settling on exactly one governed checkbox
      // and the planner must see work to do again. Without this, a spec that
      // asserted `[]` would pass just as well against a planner that had stopped
      // finding anything at all.
      const copy = JSON.parse(JSON.stringify(artefact.project)) as {
        components?: { graph?: { roots?: unknown[] } }[];
      };

      let unsettled: string | undefined;
      const walk = (nodes: unknown[]): void => {
        for (const raw of nodes) {
          const node = raw as { parameters?: Record<string, unknown>; children?: unknown[] };
          for (const key of Object.keys(node.parameters ?? {})) {
            if (unsettled || !key.startsWith('runOnChange-')) continue;
            if ((node.parameters as Record<string, unknown>)[key] !== true) continue;
            delete (node.parameters as Record<string, unknown>)[key];
            unsettled = key;
          }
          if (Array.isArray(node.children)) walk(node.children);
        }
      };
      for (const component of copy.components ?? []) {
        if (unsettled) break;
        if (Array.isArray(component?.graph?.roots)) walk(component.graph.roots);
      }

      // Every settled artefact carries at least one pinned `true`, or there was
      // nothing to settle and the arm above proved nothing about this artefact.
      expect(unsettled).toBeDefined();
      expect(planRunOnValueChangeMigration(copy as never).writes.length).toBeGreaterThan(0);
    }
  );
});
