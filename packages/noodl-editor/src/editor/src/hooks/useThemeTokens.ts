/**
 * Theme tokens, resolved to literal colour strings, for React surfaces that
 * cannot use `var()` (UIX-012).
 *
 * Most chrome should just reference `var(--theme-color-…)` in CSS. A few
 * surfaces can't: they hand colours to a third-party component as a plain
 * object (`react-json-view`'s base16 theme in the debug inspector popup) or
 * paint them into a canvas. Those go through here — one resolution path, one
 * re-render rule — instead of each inventing its own palette.
 *
 * Resolution and the headless fallback live in `CanvasTheme`
 * (`resolveThemeTokens`), the UIX-005 token resolver; this module only adds the
 * React lifecycle. Subscriptions follow the PLAT-001 listener-context rule:
 * `on(fn, context)` / `off(context)`, detached on unmount.
 */
import { useEffect, useMemo, useState } from 'react';

import { CanvasTheme, ColorSpec, resolveThemeTokens } from '../views/nodegrapheditor/canvas/CanvasTheme';

/**
 * The current `CanvasTheme` generation, bumped on every theme change (the
 * `nodegx:themechanged` event or a `data-theme` flip). Use it as a dependency
 * for anything derived from theme colours.
 */
export function useCanvasThemeGeneration(): number {
  const [generation, setGeneration] = useState(() => CanvasTheme.instance.generation);

  useEffect(() => {
    // The listener context is this effect's own token, so a re-subscribe can
    // never detach a sibling component's listener.
    const context = {};
    CanvasTheme.instance.on(() => setGeneration(CanvasTheme.instance.generation), context);
    return () => CanvasTheme.instance.off(context);
  }, []);

  return generation;
}

/**
 * Resolve a token table to literal colours, re-resolved on every theme change.
 *
 * `specs` must be a module-level constant — it is a `useMemo` dependency, so an
 * object literal built inline would re-resolve on every render.
 */
export function useThemeTokens<K extends string>(specs: Record<K, ColorSpec>): Record<K, string> {
  const generation = useCanvasThemeGeneration();

  return useMemo(() => resolveThemeTokens(specs), [specs, generation]);
}
