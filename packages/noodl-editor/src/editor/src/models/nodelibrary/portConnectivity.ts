/**
 * SPR-003 §1 (F82) — the one place that answers *"is this port on this node, and
 * may an author wire it?"*.
 *
 * ## Why this module exists
 *
 * Two lists were built from the same `model.getPorts(direction)` and disagreed
 * about it in two separate ways:
 *
 * 1. **`allowEditOnly`.** The canvas connection popup dropped a port whose
 *    declared type object carries `allowEditOnly: true` — the runtime's way of
 *    saying *"this is a setting, it may not be wired"* (`run-on-value-change.ts`
 *    says it in those words). The Ports tab never consulted it, so 139
 *    declarations across `noodl-runtime` and `noodl-viewer-react` (measured
 *    2026-08-06 with `grep -rn "allowEditOnly" packages/noodl-runtime/src
 *    packages/noodl-viewer-react/src | wc -l`) were listed as if a wire could
 *    reach them. `Treat Unchanged as` on every Variable is the one an author
 *    meets first.
 * 2. **The conditional-port filter scope.** The popup asked
 *    `applyPortConditionsFilterForNode(model, ['extended'])`; the tab asked it
 *    with no modes at all, which is a *wider* filter — it also applies
 *    `conditionalports/basic` rules.
 *
 * ## Why `['extended']` is the right scope for both, and `undefined` is not
 *
 * `NodeGraphModel.isConnectionValid` (`NodeGraphModel.ts:613`) decides whether a
 * saved connection survives with `isConditionalPortValid(node, port,
 * ['extended'])`. So `extended` is the mode that means *the port is not on the
 * node at all*; a plain `conditionalports/*` rule only suppresses the **property
 * row** — the port still exists and a wire to it stays valid. The property
 * panel's `ModelProxy.getPorts` therefore rightly passes no modes (it is
 * building property rows), and everything that describes *the node's ports*
 * — the popup, and this tab — has to pass `['extended']`.
 *
 * The practical blast radius of the change is near zero: every
 * `conditionalports/*` group declared in `noodl-runtime` and
 * `noodl-viewer-react` is named `conditionalports/extended`. `basic` exists only
 * as `nodelibraryexport.ts:146`'s fallback for a group that declares no name.
 *
 * ## Why it is import-free
 *
 * So the plain-Node `tests-unit` runner can grade it against the real port
 * declarations (`tests-unit/property-editor/portConnectivity.test.ts`) without
 * starting Electron — the same shape as `dynamicPortRules.ts` and `portTypes.ts`.
 * The one thing it cannot own is `applyPortConditionsFilterForNode` itself,
 * which needs the node library; callers make that call and hand the result to
 * {@link omitHiddenPorts}, using {@link PORT_CONDITION_FILTER_MODES} so the
 * scope is stated once.
 */

/** A port `type` when it is declared as an object rather than a bare name. */
export interface PortTypeObject {
  name?: string;
  /** Declared by the runtime to mean: this is a setting, it may not be wired. */
  allowEditOnly?: boolean;
  [key: string]: unknown;
}

export type PortTypeLike = string | PortTypeObject | null | undefined;

/**
 * The shape both `model.getPorts()` and a raw port declaration share.
 *
 * Only `name` and `type` are load-bearing for this module — the rest are here so
 * a caller that annotates its array as `PortLike[]` keeps the fields it reads off
 * each row. Without them {@link omitHiddenPorts}'s `T` has nothing to infer from
 * and falls back to its own constraint, which silently narrows every row to
 * `{ name: string }` at the call site.
 */
export interface PortLike {
  name: string;
  type?: PortTypeLike;
  group?: string;
  displayName?: string;
  plug?: string;
  /** The property-panel tab a port is filed under, when it declares one. */
  tab?: { label?: string };
  [key: string]: unknown;
}

/**
 * The modes to pass to `NodeLibrary.applyPortConditionsFilterForNode` when the
 * question is *"which ports does this node actually have"*.
 *
 * Not `undefined`: see the module docstring. Passing no modes answers the
 * property panel's narrower question — *"which property rows should I draw"*.
 */
export const PORT_CONDITION_FILTER_MODES: readonly string[] = ['extended'];

/**
 * May an author wire this port?
 *
 * ⚠️ `false` does **not** mean the port is absent. It is a real port with a real
 * value that is set in the property panel; it simply refuses connections. A list
 * that drops these rows trades a false statement for a missing one — the Ports
 * tab marks them instead.
 *
 * Was `ConnectionBar.tsx:18-20`, verbatim apart from the `null` guard:
 * `typeof null === 'object'`, so the original would have thrown on a port
 * declared `type: null`.
 */
export function isPortConnectable(port: PortLike | null | undefined): boolean {
  const type = port ? port.type : undefined;
  if (typeof type !== 'object' || type === null) return true;
  return !type.allowEditOnly;
}

/**
 * Drop the ports a conditional-port rule has switched off.
 *
 * Takes the names rather than the node so this module stays import-free; feed it
 * `NodeLibrary.instance.applyPortConditionsFilterForNode(model,
 * PORT_CONDITION_FILTER_MODES)`.
 */
export function omitHiddenPorts<T extends { name: string }>(
  ports: readonly T[],
  hiddenPortNames: readonly string[] | null | undefined
): T[] {
  if (!hiddenPortNames || hiddenPortNames.length === 0) return ports.slice();

  const hidden = new Set(hiddenPortNames);
  return ports.filter((port) => !hidden.has(port.name));
}
