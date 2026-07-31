/**
 * `@noodl/backend-contract/translators` — the subpath entry point.
 *
 * A real file at the package root rather than an `exports` map, because both
 * consumers resolve modules the Node 10 way (`moduleResolution: "node"` in
 * `noodl-runtime/tsconfig.json` and in the root config the editor builds
 * against). Node 10 resolution ignores `exports` entirely, so a map here would
 * typecheck under one toolchain and fail under both of the ones that matter.
 * One re-export file works everywhere and needs no build step, which is the
 * same reason `main` points at TypeScript source.
 */
export * from './src/translators';
