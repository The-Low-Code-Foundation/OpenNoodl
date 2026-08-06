/**
 * Rule: node ids are unique.
 *
 * SUB-012. Node ids are the substrate's primary key. Before this rule existed,
 * a project with two nodes sharing an id passed every gate: both validators
 * index nodes into a `Map<id, node>`, so the second occurrence *displaced* the
 * first and the duplicate was not merely unreported — it was erased from the
 * validator's own view of the project, which is why every downstream check also
 * passed. This rule therefore reads the flat node **array**, never the map.
 *
 * ── Why two severities: the scope question ───────────────────────────────────
 *
 * "Unique across the whole project" splits into two different claims, and the
 * evidence points different ways for each:
 *
 * **Within a component — `error`.** This is unambiguous corruption:
 *   - `nodes.schema.json` documents `id` as "Unique node ID within the
 *     component";
 *   - connections (`fromId`/`toId`) and the parent/child links resolve by id
 *     *within* a component, so a collision makes them genuinely ambiguous —
 *     there is no fact of the matter about which node a wire attaches to;
 *   - SUB-007's diff keys nodes by id inside a per-component `GraphSnapshot`,
 *     so a collision makes a diff quietly wrong rather than failing.
 *   A duplicate here is never intentional and cannot be authored by the editor.
 *
 * **Across components — `warning` (promoted to `error` by `strict`).** The
 * editor's own invariant *is* global uniqueness: every path that copies a
 * component (`ProjectModel` duplicate, `ComponentTemplates`, `RouterAdapter`,
 * the import engine) calls `rekeyAllIds()` precisely so ids do not collide, and
 * ids come from `guid()`. So a cross-component collision means the project was
 * assembled outside those paths and any project-wide id index will conflate the
 * two nodes.
 *
 * But it is *not* provably broken, and the corpus proves it occurs in the wild:
 * `big-merge-test-mine` — a real, working project in the SUB-006 false-positive
 * corpus — reuses 46 ids between `/Search/refined search` and
 * `/Old/Search/refined search`, the signature of a user copying a component
 * tree aside as a backup. Erroring on that would fail a known-good project,
 * which is the "cries wolf" failure SUB-006 exists to avoid. Warning is the
 * honest severity, and `strict` (greenfield / AI-authored projects, where
 * global uniqueness *should* hold) promotes it — the same shape as
 * `unknownNodeType`.
 *
 * Both locations are always named: "id X is duplicated" without locations is
 * not actionable in a 262-node project.
 *
 * @module noodl-editor/validation/rules/duplicateNodeId
 */

import { Diagnostic, DiagnosticCode } from '../diagnostics';
import { NormNode } from '../model';
import { Rule, RuleContext } from './types';

/** "Text \"First\"" / "Group" — enough to tell two colliding nodes apart. */
function describe(node: NormNode): string {
  return node.label ? `${node.type} "${node.label}"` : node.type;
}

export const duplicateNodeId: Rule = {
  code: DiagnosticCode.DuplicateNodeId,
  description: 'Node ids are unique within a component (and, under --strict, across the project).',
  defaultEnabled: true,

  run(ctx: RuleContext): Diagnostic[] {
    const out: Diagnostic[] = [];

    // Read `component.nodes` (the flat array), never `nodeById` — the whole
    // point of this rule is to see what the map would have swallowed.
    const componentsById = new Map<string, string[]>(); // id -> component names carrying it

    for (const { component } of ctx.components) {
      const byId = new Map<string, NormNode[]>();
      for (const node of component.nodes) {
        let bucket = byId.get(node.id);
        if (!bucket) {
          bucket = [];
          byId.set(node.id, bucket);
        }
        // Braces, not an implicit return: `push` returns a length, and a
        // truthy return means "stop" to some of this codebase's iterators.
        bucket.push(node);
      }

      for (const [id, nodes] of byId) {
        // `has`-then-`get` reads as safe and is not: `Map.get` is typed
        // `V | undefined` regardless, so the `.push` on it was the one
        // `strictNullChecks` error in @noodl/mcp's typecheck (AAQ-011/F13).
        let carriers = componentsById.get(id);
        if (!carriers) {
          carriers = [];
          componentsById.set(id, carriers);
        }
        carriers.push(component.name);

        if (nodes.length < 2) continue;

        const all = nodes.map(describe).join(', ');
        // One diagnostic per offending occurrence: each is a distinct node the
        // user must resolve, and each needs its own `nodeId` for navigation.
        for (const node of nodes) {
          out.push({
            code: DiagnosticCode.DuplicateNodeId,
            severity: 'error',
            message:
              `Duplicate node id "${id}" — ${nodes.length} nodes in this component share it (${all}). ` +
              'Node ids must be unique within a component: connections and parent/child links resolve by id, ' +
              'so a collision is ambiguous and hides all but one of these nodes from every id-keyed tool ' +
              '(diff, review, MCP). Give each node a distinct id.',
            location: {
              component: component.name,
              nodeId: node.id,
              nodeType: node.type,
              nodeLabel: node.label
            }
          });
        }
      }
    }

    // Cross-component reuse. One diagnostic per colliding id (not per
    // occurrence) — the finding is about the group, and a 46-way collision
    // should not become 46 near-identical lines per component.
    const severity = ctx.options.strict ? 'error' : 'warning';
    for (const [id, components] of componentsById) {
      const distinct = [...new Set(components)];
      if (distinct.length < 2) continue;
      out.push({
        code: DiagnosticCode.DuplicateNodeId,
        severity,
        message:
          `Node id "${id}" is reused across ${distinct.length} components: ${distinct.join(', ')}. ` +
          'The editor regenerates ids whenever a component is copied, so this usually means the project ' +
          'was assembled outside it. Per-component resolution still works, but any project-wide id index ' +
          'will conflate these nodes.',
        location: {
          component: distinct[0],
          nodeId: id
        }
      });
    }

    return out;
  }
};
