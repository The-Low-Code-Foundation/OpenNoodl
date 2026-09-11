/**
 * EXP-017 AC3, AC5, AC6 — reading which build of the NodeGX viewer a deploy would publish.
 *
 * ## 🔴 The arm that matters is the loser, not the winner
 *
 * The easy half of this reading is that a 14 MB bundle ending in a base64 source map is a
 * development build. The half that decides whether the rule is worth having is the mutant AC5
 * names: **the same development bundle with the map stripped off**. `node --check` passes on it,
 * it is 5 MB smaller, it has no `sourceMappingURL` anywhere — and it is still the unminified
 * development build, every identifier and every comment of the viewer's source readable in it.
 * A classifier built around "does it have a map" passes that file as production, which is why
 * {@link classifyViewerBuild} is a conjunction and why the row below exists before the obvious ones.
 *
 * ## ⚠️ And the false positive, which is a real file and not a hypothetical
 *
 * The **production** bundle contains the string `sourceMappingURL=data:` exactly once — at byte
 * 51,291, inside css-loader's runtime, which builds such a URL at run time out of a `/*#` prefix
 * and a `btoa` call. A `grep -c` classifier reads that as a map and refuses every clean production
 * deploy there is. The fixture below reproduces that line verbatim.
 */
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import { readViewerBuild, formatBytes } from '../src/viewerBuild';

/**
 * The real bundle, addressed the way `helpers.ts` addresses the rest of the deployed runtime.
 *
 * ⚠️ Spelled out rather than imported from `../src/deploy`, which exports the same constant: that
 * module's first import is `./headless`, which pulls the editor's entire model graph and its node
 * register into this spec for the sake of one string. `deploy.test.ts` keeps the same distance for
 * the same reason. The two spellings are one `path.join` apart and `VIEWER_BUNDLE` is asserted
 * against the engine's own copy by `exp017-deploy-refusal.test.ts`, which runs the built bundle.
 */
const VIEWER_BUNDLE = path.resolve(__dirname, '../../noodl-editor/src/external/deploy/noodl.deploy.js');

let scratch: string;

beforeAll(() => {
  scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'exp017-'));
});
afterAll(() => {
  fs.rmSync(scratch, { recursive: true, force: true });
});

/**
 * The css-loader line the production bundle really carries, reproduced so the false positive is a
 * fixture rather than a memory. Note the `/*#` — the real map webpack welds on is a `//#`.
 */
const CSS_LOADER_RUNTIME =
  'var r=n.sourceMap;r&&"undefined"!=typeof btoa&&(i+="\\n/*# sourceMappingURL=data:application/json;base64,".concat(btoa(unescape(encodeURIComponent(JSON.stringify(r)))),"*/"));';

/** One very long line, the way a minified bundle actually looks. */
function minifiedBody(bytes: number): string {
  return `!function(){"use strict";${'var a'.repeat(Math.max(1, Math.floor(bytes / 5)))}}();`;
}

/** Many short lines, the way an unminified webpack `mode: "development"` bundle actually looks. */
function unminifiedBody(lines: number): string {
  return Array.from({ length: lines }, (_, i) => `/******/ \tvar __webpack_module_${i}__ = {};`).join('\n');
}

function write(name: string, body: string, options: { license?: boolean } = {}): string {
  const file = path.join(scratch, name);
  fs.writeFileSync(file, body);
  if (options.license) fs.writeFileSync(`${file}.LICENSE.txt`, '/*! react v18 | MIT */\n');
  return file;
}

/** A trailing inline source map of roughly the requested size. */
function weldedMap(bytes: number): string {
  return `\n//# sourceMappingURL=data:application/json;charset=utf-8;base64,${'A'.repeat(bytes)}`;
}

describe('EXP-017 AC5 — the mutants that must not pass as production', () => {
  it('a development bundle with the source map STRIPPED is still a development bundle', () => {
    // 🔴 The armed loser. It is map-free, it parses, it is smaller than the one it came from, and
    // every reading except the one below says nothing is wrong with it.
    const stripped = write('stripped.js', unminifiedBody(40_000));
    const reading = readViewerBuild(stripped);

    expect(reading.sourceMapBytes).toBe(0);
    expect(reading.kind).toBe('development');
    expect(reading.reasons.join(' ')).toContain('not minified');
  });

  it('a minified bundle that DOES carry a welded map is a development bundle too', () => {
    // The other half of the conjunction, so neither reading is load-bearing alone.
    const file = write('minified-with-map.js', `${minifiedBody(200_000)}${weldedMap(50_000)}`);
    const reading = readViewerBuild(file);

    expect(reading.sourceMapBytes).toBeGreaterThan(49_000);
    expect(reading.kind).toBe('development');
  });

  it('a .LICENSE.txt left over beside a development bundle does not vote it production', () => {
    // Not hypothetical: this checkout had exactly that state — a production run's sibling still on
    // disk beside a bundle a later `npm run dev:debug` had overwritten. A reading that can be stale
    // corroborates; it does not decide.
    const file = write('dev-with-stale-license.js', `${unminifiedBody(40_000)}${weldedMap(10_000)}`, {
      license: true
    });
    const reading = readViewerBuild(file);

    expect(reading.licenseSibling).toBe(true);
    expect(reading.kind).toBe('development');
  });
});

describe('EXP-017 AC3 — the reading is taken from the artefact', () => {
  it('a minified, map-free bundle is production, and the css-loader line does not fool it', () => {
    const file = write('production.js', `${minifiedBody(1_000_000)}${CSS_LOADER_RUNTIME}`, { license: true });
    const reading = readViewerBuild(file);

    // The string IS in the file. What is not in the file is a `//#` comment at the end of it.
    expect(fs.readFileSync(file, 'utf8')).toContain('sourceMappingURL=data:');
    expect(reading.sourceMapBytes).toBe(0);
    expect(reading.kind).toBe('production');
    expect(reading.lines).toBe(1);
  });

  it('a welded map is measured, not just detected', () => {
    const file = write('development.js', `${unminifiedBody(20_000)}${weldedMap(400_000)}`);
    const reading = readViewerBuild(file);

    // AC2 turns on this number: the refusal has to be able to say how much source is about to be
    // published, because "it is bigger" is an argument somebody overrides.
    expect(reading.sourceMapBytes).toBeGreaterThan(400_000);
    expect(reading.sourceMapBytes / reading.bytes).toBeGreaterThan(0.3);
    expect(reading.kind).toBe('development');
  });

  it('nothing in the reading comes from the path, the folder or the mtime', () => {
    // Same bytes, two names, one of them saying "production" out loud. A classifier that read the
    // path would answer differently; a fresh clone that has never run `npm run dev` is the case
    // this protects, and it has no history at all to read.
    const body = `${unminifiedBody(30_000)}${weldedMap(5_000)}`;
    const honest = readViewerBuild(write('noodl.deploy.js', body));
    const lying = readViewerBuild(write('production-release-final.js', body));

    expect(lying.kind).toBe('development');
    expect(lying.kind).toBe(honest.kind);
    expect(lying.sourceMapBytes).toBe(honest.sourceMapBytes);
  });

  it('counts lines the way an editor does, trailing newline or not', () => {
    expect(readViewerBuild(write('one-line.js', 'a'.repeat(5000))).lines).toBe(1);
    expect(readViewerBuild(write('one-line-nl.js', `${'a'.repeat(5000)}\n`)).lines).toBe(1);
    expect(readViewerBuild(write('three-lines.js', 'a\nb\nc')).lines).toBe(3);
  });
});

describe('EXP-017 AC6 — the build in this checkout, measured', () => {
  /**
   * 🔴 The budget is measured on the **real** viewer bundle, never on a fixture. A budget taken on
   * a synthetic file bounds the synthetic file; the number this task exists to keep down is the one
   * in `packages/noodl-editor/src/external/deploy/`.
   *
   * Measured 2026-09-11 on the production build: **1,565,992 B** over 2 lines (a license banner and
   * the program), no inline map. The
   * development build of the same file is **14,953,525 B** over 110,716 lines, 9,877,712 B of it a
   * welded source map. The budget sits between them with room, because what it is protecting
   * against is a re-inflation of that order and not a 5% drift.
   */
  const PRODUCTION_BUDGET_BYTES = 4 * 1024 * 1024;

  it('is read, and a production one is inside its budget', () => {
    if (!fs.existsSync(VIEWER_BUNDLE)) {
      throw new Error(
        `Missing ${VIEWER_BUNDLE}. It is a build artifact, not committed. Build it:\n` +
          '  npm run build:editor:_viewer'
      );
    }

    const reading = readViewerBuild(VIEWER_BUNDLE);

    // 🔴 Both arms assert. A checkout where `npm run dev` has run holds the development build, and
    // that is a normal state for a working tree rather than a regression — so this row must not go
    // red for it. What it must not do instead is grade nothing: in that arm it asserts the thing
    // the whole task turns on, which is that the development build IS detected.
    if (reading.kind === 'development') {
      // 🔴 Not a bare `return`. A development bundle is a normal state for a working tree — this
      // row must not go red for somebody who ran `npm run dev` — but an arm that asserts nothing
      // grades nothing, so this one asserts the reading the whole task turns on: the build IS
      // detected, and by the property the refusal names. Measured on this checkout's own dev
      // build: 14,963,112 B over 110,763 lines, 9,883,464 B of welded map — 66% of the file.
      expect(reading.bytes / reading.lines).toBeLessThan(1000);
      if (reading.sourceMapBytes > 0) expect(reading.sourceMapBytes / reading.bytes).toBeGreaterThan(0.5);
      return;
    }

    expect(reading.sourceMapBytes).toBe(0);
    expect(reading.lines).toBeLessThan(100);
    // Named rather than compared, so a failure reads "16.20 MB is not under 4.00 MB" and not
    // "expected 16984123 to be less than 4194304" — the second sends the reader to a calculator.
    expect(`${formatBytes(reading.bytes)}, budget ${formatBytes(PRODUCTION_BUDGET_BYTES)}`).toBe(
      `${formatBytes(Math.min(reading.bytes, PRODUCTION_BUDGET_BYTES - 1))}, budget ${formatBytes(
        PRODUCTION_BUDGET_BYTES
      )}`
    );
  });
});
