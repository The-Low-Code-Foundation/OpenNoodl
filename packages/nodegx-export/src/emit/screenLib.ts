/**
 * `src/lib/screen.ts` — `Screen Resolution` as a hook, emitted into the app (EXP-011 §59, Tier 2.8 row 9).
 *
 * A transcription of `noodl-viewer-react/src/nodes/std-library/screenresolution.ts`: `initialize`
 * reads `window.innerWidth` / `innerHeight` once at node creation and subscribes ONE `resize`
 * listener per node instance, removed on delete (NDA-012 check H1 — the leak that kept every
 * instance ever created subscribed for the life of the page); `_viewportSizeChanged` re-reads both
 * and flags every output dirty; `aspectRatio` is `width / height` computed in the getter.
 *
 * As a hook: a lazy `useState(() => readViewport())` is the `initialize` read (once per mount, the
 * way `Now`'s and the id nodes' rows boot), the effect's listener is the node's, its cleanup is the
 * delete listener, and every resize replaces the pair — a re-render, which is what
 * `flagAllOutputsDirty` is for the nodes downstream. `aspectRatio` is computed from the stored
 * pair exactly as the getter computes it, so a zero-height viewport answers `Infinity` here as it
 * does there.
 *
 * ⚠️ **Recorded divergence: the runtime's SSR guard is not transcribed.** `initialize` returns
 * early where `typeof window === 'undefined'` and leaves the outputs unset until the browser runs
 * (`ssr.compat: 'client-only'`). The exported app is a Vite SPA with no server render, so there is
 * nothing for the guard to guard, and the three outputs are typed `number` rather than
 * `number | undefined` — a sink never has to guard a viewport that is always there.
 */

/** Where the module lands in the exported app. */
export const SCREEN_LIB_PATH = 'src/lib/screen.ts';

/**
 * The module's source.
 *
 * ⚠️ A plain string array rather than a template literal, for `dateLib.ts`'s stated reason.
 */
export function screenLibSource(): string {
  return [
    '//',
    '// Screen Resolution, transcribed from the interpreter it has to agree with:',
    '// noodl-viewer-react/src/nodes/std-library/screenresolution.ts.',
    '//',
    '// useScreenResolution(): the viewport in CSS pixels — width, height, and width divided by height — read',
    '// once at mount and again on every resize, one listener per hook, removed on unmount. Anything wider',
    '// than it is tall has an aspect ratio greater than one.',
    '//',
    '',
    "import { useEffect, useState } from 'react';",
    '',
    '/** The three outputs of a Screen Resolution node. */',
    'export interface ScreenResolution {',
    '  /** Width of the browser viewport, in pixels. */',
    '  width: number;',
    '  /** Height of the browser viewport, in pixels. */',
    '  height: number;',
    '  /** Width divided by Height, so anything wider than it is tall is greater than one. */',
    '  aspectRatio: number;',
    '}',
    '',
    "/** `_viewportSizeChanged`: both numbers from the window, and the getter's ratio over them. */",
    'function readViewport(): ScreenResolution {',
    '  const width = window.innerWidth;',
    '  const height = window.innerHeight;',
    '  return { width, height, aspectRatio: width / height };',
    '}',
    '',
    '/**',
    " * A Screen Resolution node. The lazy initializer is the node's `initialize` read — once per mount;",
    " * the listener is the node's own, and the cleanup is its delete listener.",
    ' */',
    'export function useScreenResolution(): ScreenResolution {',
    '  const [viewport, setViewport] = useState<ScreenResolution>(() => readViewport());',
    '  useEffect(() => {',
    '    const onResize = () => {',
    '      setViewport(readViewport());',
    '    };',
    "    window.addEventListener('resize', onResize);",
    '    return () => {',
    "      window.removeEventListener('resize', onResize);",
    '    };',
    '  }, []);',
    '  return viewport;',
    '}',
    ''
  ].join('\n');
}
