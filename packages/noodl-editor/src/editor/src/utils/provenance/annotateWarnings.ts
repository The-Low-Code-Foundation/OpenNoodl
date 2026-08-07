import { forEachRow, type Topology, type WalkResult } from './walkEngine';

/**
 * Layer 3 of the provenance walk — OBS-002's third annotation layer, filled by OBS-003's checks.
 *
 * A row that says *"it stopped here"* becomes one that says *"it stopped here, **and this is
 * why**"*. Nothing else in the walk changes: `WalkRow.warnings` was reserved when OBS-002 shipped
 * precisely so the row shape would not move under the panel later.
 *
 * Deliberately **not** inside `walkEngine.ts`, and deliberately **not** importing the editor's
 * models. `walkEngine` is import-free so it can be bundled into `nodegx-observe` unchanged; this
 * takes its diagnoses through a lookup so it stays testable under plain jest for the same reason
 * — the algorithm is the part that has to be right, and welding it to a singleton is how the
 * retired lineage panel ended up with bugs nobody could write a test for.
 *
 * The two callers supply different sources for one field, which is the right shape: the editor
 * holds a **store** of what is live now (`WarningsModel`), the MCP server holds a **log** of what
 * it has seen since it connected.
 */
export type DiagnosisLookup = (componentName: string) => ReadonlyArray<{ nodeId: string; message: string }>;

export function annotateWarnings(topology: Topology, result: WalkResult, lookup: DiagnosisLookup): void {
  // Only the components the walk actually touches. A walk is bounded by topology, and so is
  // this: a project with four hundred warned nodes costs nothing unless they are upstream.
  const componentNames = new Set<string>();
  forEachRow(result.root, (row) => {
    const info = topology.nodes[row.ref.node];
    if (info && info.component) componentNames.add(info.component);
  });
  if (!componentNames.size) return;

  const byNode = new Map<string, string[]>();
  for (const name of componentNames) {
    for (const diagnosis of lookup(name)) {
      const list = byNode.get(diagnosis.nodeId);
      if (list) list.push(diagnosis.message);
      else byNode.set(diagnosis.nodeId, [diagnosis.message]);
    }
  }
  if (!byNode.size) return;

  forEachRow(result.root, (row) => {
    const found = byNode.get(row.ref.node);
    // Assigned rather than appended. `forEachRow` visits once per *row*, and one node can
    // legitimately appear on several rows through different ports; appending would multiply the
    // same message by the fan-in and report "⚠ Items expects an array" three times.
    if (found) row.warnings = found;
  });
}
