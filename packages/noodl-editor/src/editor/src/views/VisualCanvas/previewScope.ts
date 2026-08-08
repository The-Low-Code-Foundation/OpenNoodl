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

export interface BenchFrame {
  /** Resolved width in CSS px. Ignored while `stretch` is on. */
  width: number;
  /**
   * Give the component the whole stage instead of a fixed frame.
   *
   * This is the control for the commonest isolation lie — "it only looked right
   * because a flex parent stretched it". ⚠️ What `stretch` does to a *rendered*
   * component has not been measured; see the phase README register (B3). What
   * it does here is exact and is all this module claims: the frame stops being
   * a fixed width and becomes the stage.
   */
  stretch: boolean;
}

export const DEFAULT_BENCH_FRAME: BenchFrame = { width: DEFAULT_BENCH_WIDTH, stretch: false };

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
