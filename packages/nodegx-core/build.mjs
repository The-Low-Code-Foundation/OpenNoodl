/**
 * Builds `@nodegx/core` into the two entry points its `exports` map advertises, in both ESM and
 * CJS, plus declarations.
 *
 * `react` is external and a peer dependency: an exported project brings its own React, and bundling
 * a second copy would break hooks in ways that are miserable to diagnose.
 */
import { execFileSync } from 'node:child_process';
import esbuild from 'esbuild';

const shared = {
  bundle: true,
  platform: 'neutral',
  target: 'es2020',
  external: ['react'],
  sourcemap: true,
  logLevel: 'info'
};

for (const entry of ['index', 'react']) {
  await esbuild.build({
    ...shared,
    entryPoints: [`src/${entry}.ts`],
    format: 'esm',
    outfile: `dist/${entry}.mjs`
  });

  await esbuild.build({
    ...shared,
    entryPoints: [`src/${entry}.ts`],
    format: 'cjs',
    outfile: `dist/${entry}.cjs`
  });
}

// Declarations come from tsc rather than esbuild, which does not emit them.
execFileSync('npx', ['tsc', '--project', 'tsconfig.build.json'], { stdio: 'inherit' });
