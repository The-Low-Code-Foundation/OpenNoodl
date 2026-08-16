/**
 * UNI-011 AC2 — the impure half: reading the running editor for a question.
 *
 * The split is ALPHA-007's and it is copied deliberately, for the reason its `collect.ts` gives:
 * *"everything that touches a model, a store, Node or Electron lives here, and nothing else does
 * … which is what lets the redaction be **demonstrated** against a hostile fixture rather than
 * argued about."* [`nodeexcerpt.ts`](./nodeexcerpt.ts) and [`nodequestion.ts`](./nodequestion.ts)
 * take plain data and are graded in `tests-unit/`; this file is the only part that cannot be.
 *
 * Every read is defensive, for a reason narrower than ALPHA-007's but just as real: this runs
 * from a context menu on a canvas, and a node whose type has not resolved is the *ordinary* case
 * — it is a large share of the reason someone is asking a question about it in the first place.
 *
 * @module models/community/nodequestioncontext
 */

import os from 'os';

import { platform } from '@noodl/platform';

import { NodeLibrary } from '../nodelibrary';
import { ExcerptConnectionInput, ExcerptNodeInput, LibraryPorts } from './nodeexcerpt';
import { QuestionEnvironment } from './nodequestion';

function safe<T>(read: () => T, fallback: T): T {
  try {
    const value = read();
    return value === undefined || value === null ? fallback : value;
  } catch (_error) {
    return fallback;
  }
}

/**
 * The library table: resolved type name → the ports **the library declares** for it.
 *
 * 🔴 `type.ports` only. Instance ports (`node.ports`) and dynamic ports (`node.dynamicports`) are
 * per-instance and user-authored — [`NodeGraphNode.getPorts()`](../nodegraphmodel/NodeGraphNode.ts)
 * concatenates all three, and this reads the first of them on purpose. A table built from
 * `node.getPorts()` would be an allow-list containing the very names it exists to exclude.
 *
 * Returns `null` when the library has nothing to say — which the excerpt treats as *hide
 * everything*, not as *allow everything*.
 */
export function libraryPorts(): LibraryPorts | null {
  return safe(() => {
    const types = NodeLibrary.instance.getNodeTypes() || [];
    const table = new Map<string, ReadonlySet<string>>();
    for (const type of types) {
      if (!type || !type.name) continue;
      const names = new Set<string>();
      for (const port of type.ports || []) {
        if (port && port.name) names.add(port.name);
      }
      table.set(type.name, names);
    }
    return table.size ? table : null;
  }, null);
}

/** Version and OS, the two AC2 names. `process` values verbatim — they are what a reader can act on. */
export function questionEnvironment(): QuestionEnvironment {
  return {
    appVersion: safe(() => platform.getVersion(), '0.0.0'),
    // `process.env.devMode` is set by `main.js` from `--dev`; ALPHA-003 corrected an earlier
    // claim that `Config.devMode` was the signal, and `collect.ts` carries the same note.
    packaged: safe(() => !process.env.devMode, true),
    platform: safe(() => process.platform, 'unknown'),
    arch: safe(() => process.arch, 'unknown'),
    release: safe(() => os.release(), undefined)
  };
}

/** Duck-typed to what this file needs, so the editor's model types do not leak into the pure half. */
interface GraphLike {
  connections?: { fromId: string; fromProperty: string; toId: string; toProperty: string }[];
  forEachNode?(callback: (node: { id: string; typename?: string }) => boolean | void): boolean;
}

/**
 * The graph, flattened to the two lists the excerpt takes.
 *
 * ⚠️ The callback has a **block body returning nothing**, and that is not a style choice:
 * `forEachNode` stops on a truthy return. An arrow with an expression body returns the value of
 * the expression, so `(node) => nodes.push(...)` halts the walk at the first node — `push`
 * returns the new length, which is 1.
 */
export function graphInputs(graph: GraphLike | null | undefined): {
  nodes: ExcerptNodeInput[];
  connections: ExcerptConnectionInput[];
} {
  const nodes: ExcerptNodeInput[] = [];
  if (graph && typeof graph.forEachNode === 'function') {
    safe(
      () =>
        graph.forEachNode((node) => {
          if (node && node.id) nodes.push({ id: node.id, typename: node.typename });
        }),
      false
    );
  }

  const connections = safe(
    () =>
      (graph?.connections || []).map((connection) => ({
        fromId: connection.fromId,
        fromProperty: connection.fromProperty,
        toId: connection.toId,
        toProperty: connection.toProperty
      })),
    [] as ExcerptConnectionInput[]
  );

  return { nodes, connections };
}
