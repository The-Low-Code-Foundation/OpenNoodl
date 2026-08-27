/**
 * FB-026 — a dynamic port **replaces** a statically declared port of the same name and plug,
 * rather than being appended beside it.
 *
 * `NodeGraphNode.getPorts` concatenates three sources — the node type's own ports, the instance's
 * user-defined ports, and the ports a running node pushed over `sendDynamicPorts` — and until now
 * a name appearing in two of them appeared **twice**. Nothing collided, because every dynamic-port
 * producer in the library takes care not to: the Visual Function filters `RESERVED_INPUTS` /
 * `RESERVED_OUTPUTS` before publishing precisely so it cannot mint a second `run`
 * (`logic-builder.ts`), and the `runOnChange-…` and `pm-…` generators mint names no static port
 * can have. The collision was *avoided*, never resolved — so a node that needed a static port
 * narrowed had no way to ask for it.
 *
 * Text Input is the first node that needs it. Its `Value` ports are declared `'*'`, because that
 * is the only true answer where nothing is running to narrow them — a deployed viewer, the node
 * catalog, the docs site — and they are narrowed to `string` or `number` per instance from the
 * `Type` parameter once an editor is connected. Appending would have shown `Value` twice in the
 * property panel and left `getPort` returning whichever happened to sort first by `index`.
 *
 * **Last wins**, which is the order the sources are already concatenated in: most specific last.
 *
 * ⚠️ Keyed on name **and** plug. A port name may legitimately appear on both sides of a node, and
 * a combined `plug: 'input/output'` port is a third key matching neither — deliberately, so this
 * can only ever resolve an exact duplicate and never quietly swallow a differently-plugged port.
 *
 * This module has **no imports on purpose**: it is reached from `tests-unit/` (plain Node, no
 * renderer, no Electron, no editor singletons), which is the only place the editor can test this
 * kind of logic without starting Electron. Same reason `dynamicPortRules.ts` and
 * `connectionCoercion.ts` are shaped this way.
 *
 * @module models/nodegraphmodel/portOverrides
 */

/** The slice of a port this module reads. Structural, so nothing here imports the renderer. */
export interface OverridablePort {
  name?: string;
  plug?: string;
  [extra: string]: unknown;
}

/**
 * `base` with every entry of `incoming` either replacing the same (name, plug) or appended.
 *
 * Never mutates either argument: `getPorts` may be handed the node *type's* own port array when
 * an instance has no ports of its own, and writing through it would edit every node of that type.
 */
export function replaceOrAppendPorts<T extends OverridablePort>(base: T[], incoming: T[]): T[] {
  const merged = base.slice();

  for (const port of incoming) {
    const at = merged.findIndex((p) => p.name === port.name && p.plug === port.plug);
    if (at === -1) merged.push(port);
    else merged[at] = port;
  }

  return merged;
}
