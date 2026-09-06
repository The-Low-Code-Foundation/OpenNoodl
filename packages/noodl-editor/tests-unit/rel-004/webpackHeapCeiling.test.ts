/**
 * REL-004 — the 0.2.2 release's two macOS legs died in
 * `webpack.renderer.production.js` with
 * `FATAL ERROR: Reached heap limit Allocation failed - JavaScript heap out of memory`.
 *
 * 🔴 **What makes this worth a gate rather than a one-line fix.** The failure is
 * invisible on the two platforms most people build on: Linux and Windows runners
 * have 16 GB and get a ~4 GB default heap, the macOS runners have far less and
 * get 2048 MB, and the renderer bundle grew past 2 GB during 0.2.x. So the
 * regression arrived with no code change at all, announced itself only on a tag
 * push, and the recovery costs a re-cut of the release. A refactor that drops
 * the ceiling would restore exactly that, and every local build would stay green
 * while it did.
 *
 * ⚠️ **§3 is the control the string assertions cannot be trusted without.**
 * `--max-old-space=4096` (a real and easy typo) satisfies every assertion about
 * the composed string and changes nothing about the heap, because node ignores a
 * flag it does not know. So the composed value is handed to a REAL node process
 * and the resulting heap limit is read back — the consequence, not the mechanism.
 */
import { execFileSync } from 'child_process';
import { readFileSync } from 'fs';
import { join } from 'path';

import { withHeapCeiling, WEBPACK_HEAP_MB } from '../../scripts/webpackHeapCeiling';

/** Heap limit, in MB, of a node process started with `nodeOptions`. */
function heapLimitMb(nodeOptions: string | undefined): number {
  const env: NodeJS.ProcessEnv = { PATH: process.env.PATH };
  if (nodeOptions !== undefined) env.NODE_OPTIONS = nodeOptions;
  const out = execFileSync(
    process.execPath,
    ['-e', "process.stdout.write(String(require('v8').getHeapStatistics().heap_size_limit))"],
    { env, encoding: 'utf8' }
  );
  return Math.round(Number(out) / 1024 / 1024);
}

/**
 * `build.ts` with comments removed. The prose in these files quotes the flag it
 * is about, so an un-stripped read would let a deleted CALL keep passing on the
 * strength of the paragraph explaining why it used to be there.
 */
function buildScriptSource(): string {
  const raw = readFileSync(join(__dirname, '../../scripts/build.ts'), 'utf8');
  return raw.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
}

describe('REL-004 the production webpack runs get an explicit heap ceiling', () => {
  describe('§1 composing NODE_OPTIONS', () => {
    it('adds the ceiling when NODE_OPTIONS is absent', () => {
      expect(withHeapCeiling({}).NODE_OPTIONS).toBe(`--max-old-space-size=${WEBPACK_HEAP_MB}`);
    });

    it('adds the ceiling when NODE_OPTIONS is empty', () => {
      expect(withHeapCeiling({ NODE_OPTIONS: '' }).NODE_OPTIONS).toBe(`--max-old-space-size=${WEBPACK_HEAP_MB}`);
    });

    it('APPENDS to existing options rather than replacing them', () => {
      const out = withHeapCeiling({ NODE_OPTIONS: '--require ./x.js' }).NODE_OPTIONS as string;
      expect(out).toContain('--require ./x.js');
      expect(out).toContain(`--max-old-space-size=${WEBPACK_HEAP_MB}`);
    });

    it('leaves a ceiling the caller already chose ALONE', () => {
      const chosen = { NODE_OPTIONS: '--max-old-space-size=1024' };
      expect(withHeapCeiling(chosen).NODE_OPTIONS).toBe('--max-old-space-size=1024');
    });

    it('does not mutate the environment it was given', () => {
      const original: NodeJS.ProcessEnv = { NODE_OPTIONS: '--require ./x.js' };
      withHeapCeiling(original);
      expect(original.NODE_OPTIONS).toBe('--require ./x.js');
    });

    it('carries the rest of the environment through', () => {
      expect(withHeapCeiling({ TARGET_PLATFORM: 'darwin-arm64' }).TARGET_PLATFORM).toBe('darwin-arm64');
    });
  });

  describe('§2 the ceiling is applied where the build actually spawns webpack', () => {
    it('both production webpack runs are spawned through it', () => {
      const src = buildScriptSource();
      const renderer = src.slice(src.indexOf('webpack.renderer.production.js'));
      expect(renderer.slice(0, 200)).toContain('withHeapCeiling(process.env)');

      const main = src.slice(src.indexOf('webpack.main.production.js'));
      expect(main.slice(0, 200)).toContain('withHeapCeiling(process.env)');
    });

    it('neither production webpack run is handed a bare process.env', () => {
      const src = buildScriptSource();
      const spawns = src.match(/execSync\([\s\S]*?\}\);/g) ?? [];
      const webpackSpawns = spawns.filter((s) => s.includes('webpack --config'));
      expect(webpackSpawns).toHaveLength(2);
      for (const spawn of webpackSpawns) {
        expect(spawn).toContain('withHeapCeiling(process.env)');
        expect(spawn).not.toMatch(/env:\s*process\.env/);
      }
    });
  });

  describe('§3 the consequence — a real node process gets a bigger heap', () => {
    it('the composed value is a flag node HONOURS, not merely a string', () => {
      // The mac runner's reading, reproduced: a 2048 ceiling is what the crash
      // dump's `(2096.8) MB` total corresponds to. Asserting it here is what
      // makes the comparison below a measurement rather than an assumption.
      const constrained = heapLimitMb('--max-old-space-size=2048');
      expect(constrained).toBeGreaterThan(2000);
      expect(constrained).toBeLessThan(2200);

      const raised = heapLimitMb(withHeapCeiling({}).NODE_OPTIONS);
      expect(raised).toBeGreaterThan(constrained);
      expect(raised).toBeGreaterThanOrEqual(WEBPACK_HEAP_MB);
    });

    it('a caller who asked for a small heap still GETS a small heap', () => {
      const chosen = withHeapCeiling({ NODE_OPTIONS: '--max-old-space-size=512' });
      expect(heapLimitMb(chosen.NODE_OPTIONS)).toBeLessThan(700);
    });
  });
});
