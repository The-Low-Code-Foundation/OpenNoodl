/**
 * `src/lib/componentObject.ts` — the Component Object family's record, emitted into the app (EXP-011 §60,
 * Tier 2.8 row 10): `Set Component Object Properties`, `Parent Component Object`, `Set Parent Component
 * Object Properties`, and the `Component Object` node once it has a writer.
 *
 * A transcription of `componentobject.ts` / `base.ts` (noodl-runtime) and `parentcomponentobject.ts` /
 * `setparentcomponentobjectproperties.ts` (noodl-viewer-react):
 *
 * - The record is `Model.get('componentState' + instanceId)` — one per component **instance**, booting empty
 *   (`{}`), create-on-read. As a hook: `useComponentObject()` is one `useState` per mount (the instance) plus a
 *   `useRef` holding the same object so a handler's `get()` is live — `model.get` is, and a Done chain that
 *   reads a key the same handler just wrote sees the new value.
 * - `set(patch)` is `base.ts`'s store loop: every key the patch carries is written (`keysToSet` is
 *   `Object.keys(inputValues)` — a key delivered as `undefined` IS written as undefined; a key never delivered
 *   is absent from the patch, which is the exporter's job at compile), and a re-render happens only when a key
 *   changed — `Model.set` notifies `change` only when `oldValue !== value` (`model.ts:347`), and a render is the
 *   only thing a notification does in the emitted app (signal outputs are refused by name).
 * - The parent pair walk to the **nearest ancestor that owns a Component Object node**
 *   (`findAncestorWithComponentObject`, componentwalk.ts). A component that owns one wraps its root in
 *   `ParentComponentObjectContext.Provider`, so React's nearest-provider rule IS that walk, shadowing included.
 * - A miss: `parentcomponentobject.ts` raises `parent-component-object/no-ancestor` once, after the deferred first
 *   resolution (`reportMiss` under `resolutionIsLoud`), and every `value-*` output reads `undefined`.
 *   `useParentComponentObject(readers)` answers `undefined` and raises once per reader site at mount — guarded
 *   by a ref so StrictMode's double mount raises once, as `lastMissCode` dedups the runtime's repeat.
 *
 * ⚠️ **Recorded divergence:** the runtime resolves the parent one update pass late and lands mirrors at frame
 * end; here the provider is there on the first render and a mirror effect lands after the first paint — the
 * same one-tick lag, on the other side of the read.
 */

/** Where the module lands in the exported app. */
export const COMPONENT_OBJECT_LIB_PATH = 'src/lib/componentObject.ts';

/**
 * The module's source.
 *
 * ⚠️ A plain string array rather than a template literal, for `dateLib.ts`'s stated reason.
 */
export function componentObjectLibSource(): string {
  return [
    '//',
    '// The Component Object family, transcribed from the interpreters it has to agree with:',
    '// noodl-runtime/src/nodes/std-library/componentutils/{componentobject,base}.ts and',
    '// noodl-viewer-react/src/nodes/std-library/componentutils/{parentcomponentobject,setparentcomponentobjectproperties}.ts.',
    '//',
    "// useComponentObject(): this component instance's record — one per mount, booting empty. `.value` is the record",
    '// as of this render (read it in JSX); `.get()` is the record right now (read it in a handler — a write earlier in',
    '// the same handler is visible, as model.get after model.set is); `.set(patch)` writes every key the patch carries',
    '// (a key the patch does not carry is left alone) and re-renders only when a key actually changed.',
    '//',
    "// ParentComponentObjectContext / useParentComponentObject(): the nearest ancestor's record — the component that",
    '// owns a Component Object wraps its root in the Provider, so the nearest Provider is the nearest owner, exactly as',
    '// the runtime walks the visual parent chain. `undefined` when no ancestor owns one; each reader raises',
    '// parent-component-object/no-ancestor once at mount, as the runtime does after its first resolution.',
    '//',
    '',
    "import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';",
    '',
    "import { raiseAppError } from './errors';",
    '',
    '/** One component instance\'s record — the family\'s shared `componentState<instanceId>` model. */',
    'export interface ComponentObject<T extends object> {',
    '  /** The record as of this render. */',
    '  readonly value: Readonly<T>;',
    '  /** The record right now — live, like `model.get`. */',
    '  get(): Readonly<T>;',
    "  /** `Set … Component Object Properties`' Do: write every key the patch carries; undefined is a value here, as it is there. */",
    '  set(patch: Partial<T>): void;',
    '}',
    '',
    '/** The site a missing ancestor is raised for — the node that asked, in the component that hosts it. */',
    'export interface ParentObjectReader {',
    '  nodeId: string;',
    '  nodeType: string;',
    '  componentName: string;',
    '}',
    '',
    "/** The message parentcomponentobject.ts raises — verbatim, so the channel reads the same in both worlds. */",
    "export const NO_ANCESTOR_MESSAGE = 'No ancestor component has a Component Object node';",
    "/** The message the parent Set raises on the same miss (setparentcomponentobjectproperties.ts) — verbatim. */",
    "export const NO_ANCESTOR_WRITE_MESSAGE = 'No ancestor component has a Component Object node — nothing was written';",
    '',
    '/**',
    " * A Component Object node's record: one useState per mount (the instance), a ref beside it for the live read.",
    ' * `set` is base.ts\'s store loop — every own key of the patch is written — and it re-renders only when a key changed,',
    " * which is when Model.set notifies (`oldValue !== value`).",
    ' */',
    'export function useComponentObject<T extends object>(): ComponentObject<T> {',
    '  const [value, setValue] = useState<T>(() => ({}) as T);',
    '  const live = useRef<T>(value);',
    '  const get = useCallback((): Readonly<T> => live.current, []);',
    '  const set = useCallback((patch: Partial<T>): void => {',
    '    const current = live.current;',
    '    let next: T | undefined;',
    '    for (const key of Object.keys(patch) as Array<keyof T>) {',
    '      if (!Object.prototype.hasOwnProperty.call(patch, key)) continue;',
    '      const incoming = patch[key] as T[keyof T];',
    '      if (key in current && current[key] === incoming) continue;',
    '      if (next === undefined) next = { ...current };',
    '      next[key] = incoming;',
    '    }',
    '    if (next === undefined) return;',
    '    live.current = next;',
    '    setValue(next);',
    '  }, []);',
    '  return useMemo(() => ({ value, get, set }), [value, get, set]);',
    '}',
    '',
    '/** The nearest ancestor that owns a Component Object — provided by the component that owns it, read from below. */',
    'export const ParentComponentObjectContext = createContext<ComponentObject<Record<string, unknown>> | undefined>(undefined);',
    '',
    '/**',
    ' * A Parent Component Object / Set Parent Component Object Properties in this component: the nearest owner\'s record,',
    " * or undefined at the root — in which case each reader site raises the runtime's miss once, at mount.",
    ' */',
    'export function useParentComponentObject<T extends object>(readers: ReadonlyArray<ParentObjectReader> = []): ComponentObject<T> | undefined {',
    '  const parent = useContext(ParentComponentObjectContext);',
    '  const raised = useRef(false);',
    '  useEffect(() => {',
    '    if (parent !== undefined || raised.current) return;',
    '    raised.current = true;',
    '    for (const reader of readers) {',
    "      raiseAppError({ code: 'parent-component-object/no-ancestor', message: NO_ANCESTOR_MESSAGE, nodeId: reader.nodeId, nodeType: reader.nodeType, componentName: reader.componentName });",
    '    }',
    '    // eslint-disable-next-line react-hooks/exhaustive-deps -- once per mount, like the deferred first resolution',
    '  }, []);',
    '  return parent as ComponentObject<T> | undefined;',
    '}',
    ''
  ].join('\n');
}
