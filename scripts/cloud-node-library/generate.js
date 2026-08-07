#!/usr/bin/env node
/**
 * Cloud node-library generator (WFA-001).
 *
 * Bundles extractor-entry.js with esbuild, runs it headlessly in a child Node
 * process, and writes:
 *
 *   packages/noodl-editor/src/editor/src/models/nodelibrary/cloud-node-library.json
 *
 * Modes:
 *   node scripts/cloud-node-library/generate.js           regenerate
 *   node scripts/cloud-node-library/generate.js --check   fail if stale
 *
 * Output is deterministic; the generator runs the extraction twice and asserts
 * byte-identical results before writing anything — same contract as
 * `catalog:generate`, and for the same reason: a committed artifact that can
 * silently disagree with the registry it claims to describe is worse than none.
 */
const { spawnSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const esbuild = require('esbuild');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const OUT_JSON = path.join(
  REPO_ROOT,
  'packages/noodl-editor/src/editor/src/models/nodelibrary/cloud-node-library.json'
);

async function bundleExtractor(workDir) {
  const outfile = path.join(workDir, 'extractor.bundle.js');
  await esbuild.build({
    entryPoints: [path.join(__dirname, 'extractor-entry.js')],
    bundle: true,
    platform: 'node',
    format: 'cjs',
    outfile,
    alias: { '@noodl/runtime': path.join(REPO_ROOT, 'packages/noodl-runtime') },
    loader: {
      '.css': 'empty',
      '.svg': 'empty',
      '.png': 'empty',
      '.jpg': 'empty',
      '.gif': 'empty',
      '.woff': 'empty',
      '.woff2': 'empty'
    },
    logLevel: 'warning'
  });
  return outfile;
}

function runExtractor(bundlePath, workDir, label) {
  const outPath = path.join(workDir, `cloud-node-library-${label}.json`);
  const result = spawnSync(process.execPath, [bundlePath], {
    env: { ...process.env, CLOUD_NODE_LIBRARY_OUT: outPath },
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024
  });
  if (result.status !== 0) {
    process.stderr.write(result.stdout || '');
    process.stderr.write(result.stderr || '');
    throw new Error(`Extractor run "${label}" failed with exit code ${result.status}`);
  }
  return fs.readFileSync(outPath, 'utf8');
}

async function main() {
  const checkMode = process.argv.includes('--check');

  const workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cloud-node-library-'));
  try {
    const bundlePath = await bundleExtractor(workDir);

    const first = runExtractor(bundlePath, workDir, 'run1');
    const second = runExtractor(bundlePath, workDir, 'run2');
    if (first !== second) {
      throw new Error('Non-deterministic output: two extractor runs differed. Fix the generator before publishing.');
    }

    const library = JSON.parse(first);
    const cloudOnly = library.nodetypes.filter((n) => n.name.startsWith('noodl.cloud.'));
    console.log(
      `Cloud node library: ${library.nodetypes.length} node types ` +
        `(${cloudOnly.length} cloud-specific: ${cloudOnly.map((n) => n.name).join(', ')}).`
    );

    if (checkMode) {
      const committed = fs.existsSync(OUT_JSON) ? fs.readFileSync(OUT_JSON, 'utf8') : null;
      if (committed !== first) {
        console.error(
          `Stale cloud node library: ${path.relative(REPO_ROOT, OUT_JSON)} does not match the cloud registry.\n` +
            'Run "npm run cloud-library:generate" and commit the result.'
        );
        process.exit(1);
      }
      console.log('Committed cloud node library is up to date.');
    } else {
      fs.writeFileSync(OUT_JSON, first);
      console.log(`Wrote ${path.relative(REPO_ROOT, OUT_JSON)}.`);
    }
  } finally {
    fs.rmSync(workDir, { recursive: true, force: true });
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
