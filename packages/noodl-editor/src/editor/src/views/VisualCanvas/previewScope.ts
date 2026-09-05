/**
 * BEN-004 — What the preview surface is currently showing, as data.
 *
 * The preview panel gains a *mode*, not a sibling. R1 is the whole design:
 * "one preview surface, two modes — never a second preview panel", because two
 * live previews in two panels is the arrangement that guarantees a builder does
 * not know which of them is the app. Everything here is the state that switch
 * needs, kept out of React so the rules can be checked by a spec rather than by
 * a driver.
 *
 * That split is deliberate and it is the phase's own habit: BEN-006's value
 * rules live in `sandboxDataDraft.ts` for the same reason. A rule that only a
 * live driver can check is a rule that does not get checked, and this file
 * holds the ones that decide what a user sees — which components may be
 * mounted, what a frame width does with the junk someone types into it, and
 * what the size read-out claims.
 *
 * @module noodl-editor/views/VisualCanvas/previewScope
 */

import { CLOUD_SHEET } from '../panels/ComponentsPanelNew/types';

/**
 * The two modes of the one surface.
 *
 * `target` is a component's **legacy name** (`/Components/Card`) — the form
 * `buildBenchExport` resolves and the form a node uses to instantiate a project
 * component. Storing a display label here instead is how the bench would end up
 * unable to find what it is showing.
 */
export type PreviewScope = { mode: 'app' } | { mode: 'bench'; target: string };

export const APP_SCOPE: PreviewScope = { mode: 'app' };

/** The frame widths offered as chips. Anything else is typed into the field. */
export const BENCH_FRAME_PRESETS = [
  { name: 'Small', width: 360 },
  { name: 'Medium', width: 768 },
  { name: 'Large', width: 1280 }
] as const;

/**
 * A component in isolation has no page to inherit width from, so the bench asks
 * rather than guesses (BEN-004 §5). Medium is the default because it is the
 * width at which a component that only works at one width usually still works.
 */
export const DEFAULT_BENCH_WIDTH = 768;

/**
 * Bounds for the numeric field. The floor is below any usable component on
 * purpose — the point of the control is to find the width at which a component
 * breaks, and a control that refuses to go there cannot find it.
 */
export const MIN_BENCH_WIDTH = 80;
export const MAX_BENCH_WIDTH = 4096;

/** Same bounds as the width, and for the same reason — see above. */
export const MIN_BENCH_HEIGHT = 80;
export const MAX_BENCH_HEIGHT = 4096;

export interface BenchFrame {
  /** Resolved width in CSS px. Ignored while `stretch` is on. */
  width: number;
  /**
   * Give the component the stage's full **width** instead of a fixed frame.
   *
   * This is the control for the commonest isolation lie — "it only looked right
   * because a flex parent stretched it". ⚠️ What `stretch` does to a *rendered*
   * component has not been measured; see the phase README register (B3). What
   * it does here is exact and is all this module claims: the frame stops being
   * a fixed width and becomes the stage.
   *
   * ⚠️ **The width axis only, and that is FIX-011's ruling rather than an
   * oversight.** The height axis fills the stage *by default* ({@link height}),
   * so a second toggle would ship switched on and spend strip width saying
   * nothing — and the strip has been measured clipping at 640px (BEN-004's
   * drive). Keeping this key's stored meaning also keeps every scenario written
   * before FIX-011 applying exactly as it did.
   */
  stretch: boolean;
  /**
   * FIX-011 — explicit height in CSS px, or `null` for **fill the stage**.
   *
   * `null` is the default and it is the fix for the reported bug: there was no
   * height in this type at all, so nothing ever sized the frame box and the
   * `<webview>`'s UA default replaced-element height (150px) leaked through. A
   * bench that opens as a 150px sliver is the "couple of hundred pixels" in the
   * report.
   *
   * `null` rather than a number, deliberately, and it mirrors
   * {@link resolveBenchWidth}'s `null`: the surface writes no `height` at all
   * and lets `align-self: stretch` do it, so the frame cannot be left at a
   * height that was true one panel-resize ago. There is no `resolveBenchHeight`
   * to match `resolveBenchWidth` because it would be a pure passthrough — the
   * stored value *is* the answer.
   */
  height: number | null;
}

export const DEFAULT_BENCH_FRAME: BenchFrame = { width: DEFAULT_BENCH_WIDTH, stretch: false, height: null };

/**
 * The width the stage should give the bench webview, or `null` for "all of it".
 *
 * `null` rather than the stage's measured width, deliberately: the surface then
 * writes `100%` and never has to re-measure, so a panel resize cannot leave the
 * frame at a width that was true one layout ago.
 */
export function resolveBenchWidth(frame: BenchFrame): number | null {
  return frame.stretch ? null : frame.width;
}

/**
 * Parse whatever was typed into the width field.
 *
 * A text input hands back strings, including empty ones and `"32px"` and
 * `"abc"`. Nothing here throws and nothing here silently becomes `NaN` — a
 * `NaN` reaching a style property is the phase-55 `"NaNpx"` defect, where a
 * coercing port turned a bad value into a *deleted* one and the styling
 * vanished with no message. Junk keeps the current width instead.
 */
export function clampBenchWidth(raw: unknown, current: number): number {
  const parsed = typeof raw === 'number' ? raw : parseFloat(String(raw ?? '').trim());
  if (!Number.isFinite(parsed)) return current;
  return Math.min(MAX_BENCH_WIDTH, Math.max(MIN_BENCH_WIDTH, Math.round(parsed)));
}

/**
 * Parse whatever was typed into the height field.
 *
 * Everything {@link clampBenchWidth} does, plus the one string that *means*
 * something here: **empty is "fill the stage"**, not junk. That is how a user
 * who dragged the bottom edge — or typed a number — gets back to the default
 * without a second control to say so, which is what the 640px strip could not
 * afford. Whitespace-only counts as empty; a text input hands back `" "` when
 * someone clears a field with the space bar.
 */
export function clampBenchHeight(raw: unknown, current: number | null): number | null {
  // ⚠️ **A `string` specifically**, not anything that stringifies to empty. The
  // first cut here read `undefined` as "fill" too, and its own spec caught it:
  // an emptied *field* is someone asking for the stage, while `undefined` is
  // nobody having said anything — which is the width field's "junk keeps the
  // current value" case, not a request to unpin the height.
  if (typeof raw === 'string' && raw.trim() === '') return null;

  const parsed = typeof raw === 'number' ? raw : parseFloat(String(raw).trim());
  if (!Number.isFinite(parsed)) return current;
  return Math.min(MAX_BENCH_HEIGHT, Math.max(MIN_BENCH_HEIGHT, Math.round(parsed)));
}

/** The preset a width corresponds to, or `undefined` when it is a custom one. */
export function matchingPreset(width: number): string | undefined {
  return BENCH_FRAME_PRESETS.find((preset) => preset.width === width)?.name;
}

/**
 * The size read-out, in the format the app preview already uses
 * (`VisualCanvas`'s `.ViewportInfo`: `1280 × 800 · 100%`). Same shape, so the
 * two modes read as the same surface rather than as two products.
 *
 * ⚠️ It reports the frame that was **measured**, not the one that was asked
 * for, and the difference is the whole point of having a read-out. The stage
 * has padding; a stretched frame is narrower than the stage by it; a frame
 * wider than the stage scrolls. Printing the requested number in any of those
 * cases would be the tool built to catch a wrong width telling you a wrong
 * width. `measured` is absent only before the first layout, and then the
 * requested width is the only number there is.
 */
export function benchSizeLabel(frame: BenchFrame, measured?: { width: number; height: number }): string {
  const width = Math.floor(measured?.width ?? resolveBenchWidth(frame) ?? 0);
  const height = Math.floor(measured?.height ?? 0);
  return `${width} × ${height}${frame.stretch ? ' · stretched' : ''}`;
}

/** The subject of the surface, said in one line. Empty in app mode. */
export function benchTargetLabel(target: string): string {
  const trimmed = target.replace(/\/+$/, '');
  const cut = trimmed.lastIndexOf('/');
  return cut === -1 ? trimmed : trimmed.slice(cut + 1) || trimmed;
}

export interface BenchTarget {
  /** Legacy name — what `buildBenchExport` resolves and what the picker returns. */
  name: string;
  /** Last path segment, for the row and for the scope chip. */
  label: string;
  /** Everything before the last segment, so two `Card`s are tellable apart. */
  folder: string;
}

/**
 * Which components the bench may be pointed at, filtered by the search box.
 *
 * Cloud functions are excluded and that is a runtime boundary rather than
 * tidying: `/#__cloud__/…` runs in the cloud runtime (WFA-001), and the bench
 * is a browser viewer. Offering one would mount a component the window cannot
 * execute and then blame the component.
 *
 * Everything else is offered, *including* components with no visual root —
 * BEN-001 mounts those on purpose, and they are the ones the outputs read-out
 * (BEN-003) exists for. Refusing them here would re-impose the limit the phase
 * was written to remove.
 */
/**
 * The component list the scope menu reads when it opens — **a copy, and the copy is the point.**
 *
 * 🔴 `ProjectModel.getComponents()` returns `this.components`, the **live array**, and
 * `addComponent` does `this.components.push(...)` in place. So `setComponents(getComponents())`
 * handed React the same array reference on every open, `Object.is` bailed the state update out,
 * and the menu's `components` never changed identity after the very first open. The `useMemo`
 * that calls {@link benchTargets} is keyed on that identity, so it computed once per project and
 * never again.
 *
 * The symptom, reported by Richard 2026-09-04: create a component, open the menu, and it is not
 * there. Closing the project and reopening it fixed it — a new `ProjectModel` brings a new array,
 * which is a new identity.
 *
 * ⚠️ **It lives here rather than inline in `PreviewChrome.tsx` because nothing can grade it
 * there.** That module imports `@noodl-core-ui/.../Icon`, whose `require.context` call ts-jest
 * rejects outright (`Icon.tsx:207`, TS2339) — the module fails the suite *to run*, so the one
 * decision in `open()` was ungated by construction (phase 82 `TESTING-PASS-2026-09-04.md` §3,
 * owner `NONE`). Moved out, it is a plain function from a getter to a list and
 * `ben-004/previewScopeMenuRead.test.ts` grades both arms of it.
 *
 * A `ProjectModel` subscription (`componentAdded`/`Removed`/`Renamed`, as `useComponentsPanel.ts`
 * does) would also work, but it would keep a list current that is only ever read while the menu is
 * open — and the open *is* that moment.
 */
export function readMenuComponents(getComponents: () => Array<{ name: string }>): Array<{ name: string }> {
  return getComponents().slice();
}

export function benchTargets(components: Array<{ name: string }>, query = ''): BenchTarget[] {
  const needle = query.trim().toLowerCase();

  const targets = components
    .map((component) => String(component?.name ?? ''))
    .filter((name) => name.length > 0 && !name.startsWith(CLOUD_SHEET.pathPrefix))
    .map((name) => {
      const cut = name.lastIndexOf('/');
      return {
        name,
        label: cut === -1 ? name : name.slice(cut + 1) || name,
        folder: cut <= 0 ? '' : name.slice(0, cut).replace(/^\//, '')
      };
    })
    .filter((target) => (needle ? target.name.toLowerCase().includes(needle) : true));

  // Name-matches first, so typing "card" puts `Card` above `Cards/Header`, then
  // alphabetical — a picker whose order changes with the corpus is one nobody
  // learns the shape of.
  return targets.sort((a, b) => {
    const aHit = needle ? Number(a.label.toLowerCase().includes(needle)) : 0;
    const bHit = needle ? Number(b.label.toLowerCase().includes(needle)) : 0;
    if (aHit !== bHit) return bHit - aHit;
    return a.name.localeCompare(b.name);
  });
}

/** True when `scope` is showing the given component. Used for the picker's tick. */
export function isMounted(scope: PreviewScope, target: string): boolean {
  return scope.mode === 'bench' && scope.target === target;
}

/**
 * FIX-019 — the bench is showing one component and the node graph is showing
 * another, so the graph you can edit is not the graph you are looking at.
 *
 * The decoupling itself is deliberate and stays (`benchRequest.ts`): the canvas
 * must not be yanked back every time `VisualCanvas` remounts. What was missing
 * is that nothing *said* the two had come apart, and there was no way back.
 *
 * Kept a pure predicate, and out of React, for this module's usual reason — a
 * rule only a live driver can check is a rule that does not get checked.
 *
 * ⚠️ **An unknown canvas component is not a divergence.** `canvasComponent` is
 * `undefined` in the detached preview window, where `NodeGraphContextTmp` is
 * `null` — there is no node graph in that window at all, so there is nothing to
 * be diverged *from*, and a chip offering to navigate a canvas that is not
 * there is worse than no chip. Same answer before the first
 * `activeComponentChanged` has been seen.
 */
export function isDivergedFromCanvas(scope: PreviewScope, canvasComponent: string | undefined): boolean {
  if (scope.mode !== 'bench') return false;
  if (!canvasComponent) return false;
  return canvasComponent !== scope.target;
}
