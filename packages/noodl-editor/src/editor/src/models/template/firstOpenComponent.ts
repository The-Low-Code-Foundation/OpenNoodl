/**
 * SBR-002 — the first-open hint, as one pure rule.
 *
 * A template may name the component the editor should land on the first time a
 * project opens (`ProjectTemplate.initialOpenComponent`). Install writes it
 * into project metadata under `INITIAL_OPEN_COMPONENT_METADATA_KEY`;
 * `getDefaultComponent` (`projectmodel.utils.ts`) resolves it through this
 * function ahead of its `/Main`-first chain.
 *
 * 🔴 Why the rule is read inside `getDefaultComponent` and nowhere earlier:
 * `useSwitchToDefaultComponent` (`UseSetupNodeGraph.ts`) calls that function
 * unconditionally on every open and its switch wins over anything layered
 * before it — a previous "restore my place" attempt did exactly that layering,
 * lost every time, and was deleted after driving (`launcherHandoff.ts` records
 * the post-mortem). Riding the winning switch is the only placement that works.
 *
 * ⚠️ This module is import-free on purpose: `projectmodel.utils` value-imports
 * `ProjectModel`, whose module-scope import chain cannot load in the plain-Node
 * jest runner — so the rule lives where both the editor and the runner can
 * reach it, and the caller stays a two-line delegation.
 */

/** The project-metadata key install writes and the editor reads. */
export const INITIAL_OPEN_COMPONENT_METADATA_KEY = 'initialOpenComponent';

/** The two reads the rule needs — `ProjectModel` satisfies this structurally. */
interface FirstOpenSource<T> {
  getMetaData(key: string): unknown;
  getComponentWithName(name: string): T | undefined;
}

/**
 * The component the project's metadata asks to open first, or `undefined` when
 * there is no hint, the hint is not a string, or it names no component that
 * exists — every miss falls through to the caller's default chain.
 */
export function resolveFirstOpenComponent<T>(instance: FirstOpenSource<T>): T | undefined {
  const hint = instance.getMetaData(INITIAL_OPEN_COMPONENT_METADATA_KEY);
  if (typeof hint !== 'string') return undefined;
  return instance.getComponentWithName(hint) || undefined;
}
