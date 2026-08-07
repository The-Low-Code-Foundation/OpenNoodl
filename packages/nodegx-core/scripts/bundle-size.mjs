/**
 * Enforces the bundle budget EXP-001 set: the companion library has to stay small enough that
 * "you own normal code now" is not undercut by a heavyweight dependency.
 *
 * It builds its own minified bundle rather than measuring `dist/`, for two reasons. The shipped
 * artefact is deliberately unminified (the consumer's bundler does that, and a readable dependency
 * suits a library whose whole point is readable output), and measuring a stale `dist/` would report
 * a number for code nobody is running.
 *
 * Both entry points are measured separately, because a project that never imports `/react` never
 * pays for it — and both are measured gzipped, because that is what crosses the wire.
 *
 * Run with `--json` for machine-readable output.
 */
import { gzipSync } from 'node:zlib';
import esbuild from 'esbuild';

/** Gzipped bytes. The 8 KB total comes from the original CODE-001 design and EXP-001's scope. */
const BUDGETS = {
  index: 6 * 1024,
  react: 2 * 1024
};

const results = [];
let failed = false;

for (const [entry, budget] of Object.entries(BUDGETS)) {
  const built = await esbuild.build({
    entryPoints: [`src/${entry}.ts`],
    bundle: true,
    minify: true,
    platform: 'neutral',
    target: 'es2020',
    external: ['react'],
    write: false,
    legalComments: 'none'
  });

  const raw = built.outputFiles[0].contents;
  const gzipped = gzipSync(raw).byteLength;
  const over = gzipped > budget;
  if (over) failed = true;

  results.push({ entry, minified: raw.byteLength, gzipped, budget, over });
}

if (process.argv.includes('--json')) {
  console.log(JSON.stringify(results, null, 2));
} else {
  for (const r of results) {
    const pct = Math.round((r.gzipped / r.budget) * 100);
    console.log(
      `${r.over ? '✗' : '✓'} ${r.entry.padEnd(6)} ${String(r.gzipped).padStart(5)} B gzipped ` +
        `(${r.minified} B minified) — budget ${r.budget} B, ${pct}% used`
    );
  }
  const total = results.reduce((sum, r) => sum + r.gzipped, 0);
  console.log(`  total  ${total} B gzipped`);
}

if (failed) {
  console.error(
    '\nBundle budget exceeded. Either the addition is worth raising the budget for — ' +
      'or it belongs in generated code rather than in the library.'
  );
  process.exit(1);
}
