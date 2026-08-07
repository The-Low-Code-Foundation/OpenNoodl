/**
 * Image transforms (BAK-006) — sharp, OPTIONAL, loud-failure posture.
 *
 * `sharp` is a native module (the exact species of dependency RUN-004 exists
 * to atone for). It is declared as an `optionalDependency` in package.json:
 * `npm install` never fails because of it, but a worktree/environment/platform
 * without a working prebuild simply doesn't have it. That is fine, PROVIDED
 * this module never pretends otherwise:
 *
 *   - Uploads and originals ALWAYS work, sharp or not (nothing here gates them).
 *   - A transform request (`?thumb=`) with sharp unavailable returns an
 *     explicit 501 carrying `reason` — never a silently-skipped resize, and
 *     ABSOLUTELY NEVER a pure-JS fallback resizer quietly producing different
 *     bytes than sharp would (the spec calls this out by name as the failure
 *     mode to refuse).
 *   - The admin dashboard / MCP config surface reports `transformsAvailable`
 *     so an operator sees the gap instead of discovering it via a confusing
 *     501 in production.
 *
 * ## The esbuild trap, and how this module avoids it without touching build.js
 *
 * This package (WF-003's territory: scripts/build.js) bundles into ONE
 * CommonJS file with esbuild. A `sharp` import written as a literal
 * `require('sharp')` (or a static `import`) would make esbuild try to
 * statically resolve and inline it — sharp ships per-platform native
 * `.node` bindings behind its OWN internal dynamic requires, which a bundler
 * cannot inline correctly, so this would break the build for a dependency
 * that must stay OUT of the bundle regardless. Standard fix, applied here:
 * pass a NON-literal expression to `require()`. esbuild's bundler only
 * special-cases `require(<string literal>)`; a runtime-computed argument is
 * left as a plain CommonJS `require` call in the output, unresolved at bundle
 * time and resolved normally against `node_modules` when the bundle actually
 * runs on real Node. No `external` entry needed, so this file alone is
 * sufficient — no edit to scripts/build.js (out of this task's territory).
 * Verified by inspecting the built `dist/cli.js` (BAK-006-NOTES §sharp-build).
 *
 * @module nodegx-backend/storage/transform
 */

export type FitMode = 'cover' | 'contain';

export interface ThumbSpec {
  width: number;
  height: number;
  fit: FitMode;
}

export interface RenderedThumb {
  buffer: Buffer;
  contentType: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SharpModule = any;

let cached: { available: true; sharp: SharpModule } | { available: false; reason: string } | null = null;

/** The module name, built from a non-literal expression — see the module doc. */
const SHARP_MODULE_NAME = ['sh', 'arp'].join('');

/** Load (and cache) the sharp module, or the reason it isn't available. Never throws. */
export function loadTransformer(): { available: true; sharp: SharpModule } | { available: false; reason: string } {
  if (cached) return cached;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const sharp = require(SHARP_MODULE_NAME);
    cached = { available: true, sharp };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    cached = {
      available: false,
      reason:
        `sharp is not installed or failed to load its native binding (${message}). ` +
        'Image transforms are unavailable; uploads and original-file reads are unaffected. ' +
        'Install a platform-matching sharp prebuild to enable ?thumb=.'
    };
  }
  return cached;
}

/** Test-only: forget the cached load result so a test can simulate install/uninstall. */
export function resetTransformerCacheForTesting(): void {
  cached = null;
}

const SUPPORTED_OUTPUT: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpeg',
  'image/webp': 'webp'
};

/**
 * Render a thumbnail. Throws `TransformUnavailableError` when sharp is not
 * loaded (callers turn that into the 501) — throwing rather than returning a
 * sentinel keeps the "no fallback path exists" property structurally true:
 * there is no code path here that returns bytes without sharp.
 */
export class TransformUnavailableError extends Error {
  reason: string;
  constructor(reason: string) {
    super(reason);
    this.name = 'TransformUnavailableError';
    this.reason = reason;
  }
}

export async function renderThumbnail(source: Buffer, sourceContentType: string, spec: ThumbSpec): Promise<RenderedThumb> {
  const loaded = loadTransformer();
  if (!loaded.available) throw new TransformUnavailableError(loaded.reason);

  const outFormat = SUPPORTED_OUTPUT[sourceContentType] || 'jpeg';
  const pipeline = loaded
    .sharp(source)
    .resize(spec.width, spec.height, { fit: spec.fit === 'cover' ? 'cover' : 'contain', withoutEnlargement: true });
  const buffer: Buffer = await (outFormat === 'png' ? pipeline.png() : outFormat === 'webp' ? pipeline.webp() : pipeline.jpeg()).toBuffer();
  const contentType = outFormat === 'png' ? 'image/png' : outFormat === 'webp' ? 'image/webp' : 'image/jpeg';
  return { buffer, contentType };
}
