/**
 * The old-space ceiling the two production webpack runs are spawned with.
 *
 * 🔴 **The 0.2.2 release failed here, on BOTH macOS legs, and nothing in the
 * failure mentioned macOS.** `webpack.renderer.production.js` died with
 * `FATAL ERROR: Reached heap limit Allocation failed - JavaScript heap out of
 * memory` and `SIGABRT` — before signing, before notarisation, before
 * electron-builder ever ran. Linux and Windows built the identical bundle and
 * passed, so the tag published a draft holding 6 of its 15 assets with no macOS
 * build in it at all, and the only signal was two red legs on a run nobody had
 * read yet.
 *
 * ✅ **The cause is the runner's RAM, not the code.** V8 derives its default
 * old-space limit from system memory. The `macos-26-arm64` runners give node
 * **2048 MB** — the crash dump's own `1993.3 (2096.8) MB` is exactly the total
 * `--max-old-space-size=2048` produces — while the 16 GB Linux and Windows
 * runners give ~4 GB. The renderer bundle grew past 2 GB during 0.2.x, so the
 * two smallest runners started failing and the two largest did not. Nothing was
 * wrong with the mac toolchain: that morning's nightly built both mac legs
 * green, on the same runner image, from `main` — which is 1823 commits behind
 * and therefore a smaller bundle.
 *
 * ✅ **4096 is the smallest ceiling with EVIDENCE of sufficiency rather than a
 * guess.** It is what the Linux and Windows legs already had when they built
 * this exact bundle successfully (measured: a 16 GB machine defaults to 4144 MB
 * of heap). A larger number would be one nothing has ever built with.
 *
 * ⚠️ **This is a module, not a constant inside `build.ts`, for two reasons.**
 * `build.ts` is a top-level IIFE that starts a real build on import, so nothing
 * in it can be graded; and a workflow-level `env:` would have fixed CI while
 * leaving every macOS developer running `npm run build:editor` into the same
 * crash. Both webpack runs are spawned from one place, so one seam covers the
 * release, the nightly and the laptop.
 */
export const WEBPACK_HEAP_MB = 4096;

/**
 * `env` with an old-space ceiling added to `NODE_OPTIONS`.
 *
 * ⚠️ **Appends, never replaces.** `NODE_OPTIONS` may already carry flags the
 * caller depends on, and clobbering it would trade this crash for a quieter
 * one.
 *
 * ⚠️ **An existing `--max-old-space-size` is left alone.** Someone who set one
 * chose it — on a memory-constrained machine it may be holding the build
 * *below* a limit deliberately — and a build script silently overriding a
 * deliberate ceiling is the kind of thing only discovered on the machine where
 * it mattered.
 */
export function withHeapCeiling(env: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  const existing = env.NODE_OPTIONS ?? '';
  if (existing.includes('--max-old-space-size')) return env;
  const nodeOptions = `${existing} --max-old-space-size=${WEBPACK_HEAP_MB}`.trim();
  return Object.assign({}, env, { NODE_OPTIONS: nodeOptions });
}
