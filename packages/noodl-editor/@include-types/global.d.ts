/**
 * Global type declarations for noodl-editor
 * 
 * This file imports shared global types from @noodl/noodl-types.
 * Package-specific types can be added below the reference directive.
 * 
 * @see packages/noodl-types/src/global.d.ts for shared types
 */

// eslint-disable-next-line @typescript-eslint/triple-slash-reference
/// <reference path="../../noodl-types/src/global.d.ts" />

/**
 * The node library the editor boots from, installed on `window` by the bundle and
 * stubbed on `window` by the specs.
 *
 * `nodelibrary.ts` read it through `// @ts-expect-error window be scary!` and four
 * specs read it through `(window as TSFixme).NodeLibraryData` — five suppressions
 * for one property that simply had never been declared. Declaring it deletes all
 * five, and the suppression in `nodelibrary.ts` went from "needed" to "unused
 * directive" the moment this landed, which is how the app turned out to be a
 * consumer at all: the first version of this declaration was scoped to the specs,
 * on the assumption that only they touched it, and `tsc` refused that assumption.
 *
 * Deliberately loose. Several specs hand it deformed node types on purpose — a
 * library the editor cannot parse is the subject under test — so pinning the real
 * `NodeLibraryData` here would reject the fixtures that matter most.
 */
interface Window {
  /**
   * ⚠️ Genuinely absent between projects — `editor/index.ts` sets it to
   * `undefined` on `ProjectModel.instanceWillChange`, which is why `loadLibrary`
   * guards with `|| {}`. Marked optional to say so; note that `strictNullChecks`
   * is off repo-wide, so this documents the contract rather than enforcing it.
   */
  NodeLibraryData?: {
    nodetypes: Array<
      Partial<import('../src/editor/src/models/nodelibrary/NodeLibraryData').NodeLibraryDataNodeType> &
        Record<string, unknown>
    >;
    [key: string]: unknown;
  };
}
