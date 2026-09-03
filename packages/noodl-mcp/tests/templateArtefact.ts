/**
 * Reading and settling a **shipped template artefact**, with no MCP door attached.
 *
 * ──────────────────────────────────────────────────────────────────────────────
 * ## Why this is its own module
 *
 * Both functions lived in `sb007Template.ts`, which imports `SB004/005/006_COMPONENTS`
 * and `createServer` at module scope — the whole site-builder authoring surface.
 * Anything wanting only *"read this directory"* therefore loaded, and could be
 * broken by, files it never used: DEF-038's gate went `Tests: 0 total` on a
 * half-saved edit to `sb006Components.ts` in a lane that had nothing to do with it.
 *
 * 🔴 **`Tests: 0 total` is the dangerous half.** It reads like a deleted spec, not
 * like a broken import — the same reading a suite gives when a module touches a
 * global too late. A gate over the committed artefacts must not be able to fail
 * that way because of an unrelated generator's source.
 *
 * Nothing here touches `ProjectModel`, `NodeLibrary` or Electron: `ProjectImporter`
 * is pure, which is what lets a plain node process call the same class the editor
 * calls when it opens a v2 project.
 *
 * @module noodl-mcp/tests/templateArtefact
 */
import * as fs from 'fs';
import * as path from 'path';

import { ProjectImporter } from '../../noodl-editor/src/editor/src/io/ProjectImporter';
import { planRunOnValueChangeMigration } from '../../noodl-editor/src/editor/src/models/ProjectPatches/runOnValueChangeMigration';
import type { LegacyProject } from '../../noodl-editor/src/editor/src/io/ProjectExporter';

/**
 * The v2 directory as one legacy project, through **the editor's own reader**.
 *
 * `ProjectImporter` is pure — types and `ProjectExporter`'s types, nothing else,
 * no `ProjectModel`, no `NodeLibrary`, no Electron — which is what lets a plain
 * node process call the same class the editor calls when it opens a v2 project.
 *
 * ⚠️ It emits no component-level `ports` array, and that is correct rather than
 * a gap: v2 projects do not carry one either, and the editor derives a
 * component's interface from its `Component Inputs`/`Outputs` nodes when the
 * NodeLibrary loads. `authored-bundle.ts` derives ports by hand because the
 * *runtime* export shape does need them; a `project.json` does not.
 */
export function readAsLegacyProject(projectDir: string): LegacyProject {
  const read = <T>(...parts: string[]): T => JSON.parse(fs.readFileSync(path.join(projectDir, ...parts), 'utf-8')) as T;

  const registry = read<{ components: Record<string, { path: string }> }>('components', '_registry.json');
  const components: Record<string, { component: unknown; nodes: unknown; connections: unknown }> = {};

  for (const [key, row] of Object.entries(registry.components)) {
    components[key] = {
      component: read('components', row.path, 'component.json'),
      nodes: read('components', row.path, 'nodes.json'),
      connections: read('components', row.path, 'connections.json')
    };
  }

  const result = new ProjectImporter().import({
    project: read('nodegx.project.json'),
    registry: registry as never,
    components: components as never
  });

  if (result.warnings.length > 0) {
    throw new Error(`the importer could not reconstruct the project:\n  ${result.warnings.join('\n  ')}`);
  }

  return result.project;
}

/**
 * DEF-038 — the same settling as {@link toTemplateContent}, for a generator that
 * ships a **v2 directory** rather than an embedded `content.json`.
 *
 * 🔴 **Why this exists at all.** `pinRunOnValueChangeDefaults` takes the legacy
 * `{components:[{graph:{roots,connections}}]}` shape, and `toTemplateContent`
 * hands it exactly that — so the site-builder's artefact settles and TPL-001's
 * did not. Measured 2026-09-03 at HEAD, both arms through this same planner:
 *
 * | artefact | `writes` | `familyNodes` |
 * | --- | --- | --- |
 * | `templates/members-area` (TPL-001) | **57** | 107 |
 * | `site-builder.content.json` (control) | **0** | 97 |
 *
 * ✅ **Both arms have a non-zero `familyNodes`**, which is what makes the 0 an
 * absence and the 57 a presence rather than two readings of a broken instrument.
 *
 * The argument for the value — `true`, not the migration's `false` — is written
 * once, in `pinRunOnValueChangeDefaults`, and is not restated here. What this
 * adds is only the round trip: the plan is computed through the editor's own
 * reader, and the parameters land in the `nodes.json` files the plan named.
 *
 * 🔴 **The write is by node id, and the cardinality is asserted.** Ids in a v2
 * directory are component-scoped by schema, not project-unique, so a plan entry
 * that matched two files — or none — would silently settle the wrong node or
 * none at all. Both throw. (Measured on the shipped artefact: 551 nodes, 551
 * distinct ids — true today, and not a property this function may assume.)
 *
 * ⚠️ **Key order matters and is preserved**: the governed checkbox is written
 * *before* the value it governs, because queued inputs drain in the bag's key
 * order. Same rule as `writeGovernedCheckboxes`, same reason.
 *
 * @param projectDir a v2 project directory, modified in place
 * @returns the plan that was applied, for a caller that wants to report it
 */
export function pinRunOnValueChangeDefaultsInDirectory(projectDir: string): {
  writes: number;
  familyNodes: number;
} {
  const plan = planRunOnValueChangeMigration(readAsLegacyProject(projectDir) as never);
  if (plan.writes.length === 0) return { writes: 0, familyNodes: plan.familyNodes };

  type StoredNode = { id?: string; parameters?: Record<string, unknown> };
  const registry = JSON.parse(
    fs.readFileSync(path.join(projectDir, 'components', '_registry.json'), 'utf-8')
  ) as { components: Record<string, { path: string }> };

  // nodeId -> every file it was found in. A list rather than a single entry, so
  // a collision is a throw and not a last-writer-wins.
  const locations = new Map<string, { file: string; node: StoredNode }[]>();
  const docs = new Map<string, { nodes: StoredNode[] }>();

  for (const row of Object.values(registry.components)) {
    const file = path.join(projectDir, 'components', row.path, 'nodes.json');
    if (!fs.existsSync(file)) continue;
    const doc = JSON.parse(fs.readFileSync(file, 'utf-8')) as { nodes?: StoredNode[] };
    docs.set(file, doc as { nodes: StoredNode[] });
    for (const node of doc.nodes ?? []) {
      if (typeof node.id !== 'string') continue;
      const found = locations.get(node.id);
      if (found) found.push({ file, node });
      else locations.set(node.id, [{ file, node }]);
    }
  }

  const touched = new Set<string>();
  const writesByNode = new Map<string, string[]>();
  for (const write of plan.writes) {
    const list = writesByNode.get(write.nodeId);
    if (list) list.push(write.parameter);
    else writesByNode.set(write.nodeId, [write.parameter]);
  }

  for (const [nodeId, parameters] of writesByNode) {
    const found = locations.get(nodeId) ?? [];
    if (found.length !== 1) {
      throw new Error(
        `refusing to settle: node ${nodeId} was found in ${found.length} of the artefact's ` +
          `nodes.json files, and a parameter has to land in exactly one`
      );
    }
    const { file, node } = found[0];
    const existing = node.parameters ?? {};
    const rebuilt: Record<string, unknown> = {};
    for (const parameter of parameters) rebuilt[parameter] = true;
    for (const name of Object.keys(existing)) {
      if (!Object.prototype.hasOwnProperty.call(rebuilt, name)) rebuilt[name] = existing[name];
    }
    node.parameters = rebuilt;
    touched.add(file);
  }

  for (const file of touched) {
    fs.writeFileSync(file, `${JSON.stringify(docs.get(file), null, 2)}\n`);
  }

  return { writes: plan.writes.length, familyNodes: plan.familyNodes };
}
