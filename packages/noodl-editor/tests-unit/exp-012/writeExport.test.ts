/**
 * EXP-012 — the disk half of the editor's code export, graded against a real temp directory.
 *
 * Two of these rows exist because of failures already recorded elsewhere in P18: the asset
 * copy channel that a runner once dropped (§19.6), and the project-directory target that the
 * loader would read straight back (P82, `readBundleDirectory` has no skip list).
 */

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import { checkTarget, writeExport } from '../../src/editor/src/utils/codeExport/writeExport';

function tmp(prefix: string): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

/** A binary that is not valid UTF-8, so a string round-trip would corrupt it. */
const FONT_BYTES = Buffer.from([0x00, 0x01, 0x00, 0x00, 0xff, 0xfe, 0x80, 0x81, 0x00]);

describe('checkTarget', () => {
  let projectDir: string;
  beforeEach(() => {
    projectDir = tmp('exp012-project-');
  });

  it('refuses the project directory itself', () => {
    const verdict = checkTarget(projectDir, projectDir, fs);
    expect(verdict.ok).toBe(false);
  });

  it('refuses a folder inside the project, even one that does not exist yet', () => {
    const verdict = checkTarget(projectDir, path.join(projectDir, 'export', 'react'), fs);
    expect(verdict.ok).toBe(false);
    if (verdict.ok === false) expect(verdict.reason).toMatch(/inside the project/);
  });

  it('accepts a sibling folder that does not exist yet, with nothing in it', () => {
    const verdict = checkTarget(projectDir, path.join(path.dirname(projectDir), 'exp012-fresh-' + Date.now()), fs);
    expect(verdict).toEqual({ ok: true, existing: 0 });
  });

  it('accepts a folder whose name merely starts with the project name (a prefix is not a parent)', () => {
    const verdict = checkTarget(projectDir, projectDir + '-export', fs);
    expect(verdict.ok).toBe(true);
  });

  it('counts what is already in an existing folder so the caller can ask before overwriting', () => {
    const outDir = tmp('exp012-out-');
    fs.writeFileSync(path.join(outDir, 'README.md'), 'old');
    fs.mkdirSync(path.join(outDir, 'src'));
    expect(checkTarget(projectDir, outDir, fs)).toEqual({ ok: true, existing: 2 });
  });

  it('refuses a path that is a file', () => {
    const file = path.join(tmp('exp012-file-'), 'notes.txt');
    fs.writeFileSync(file, 'x');
    expect(checkTarget(projectDir, file, fs).ok).toBe(false);
  });
});

describe('writeExport', () => {
  it('writes every generated file and copies every asset byte-for-byte', () => {
    const projectDir = tmp('exp012-project-');
    const outDir = tmp('exp012-out-');
    fs.mkdirSync(path.join(projectDir, 'noodl_modules', 'inter'), { recursive: true });
    fs.writeFileSync(path.join(projectDir, 'noodl_modules', 'inter', 'Inter-Bold.ttf'), FONT_BYTES);

    const result = writeExport(
      projectDir,
      outDir,
      {
        files: {
          'package.json': '{ "name": "exported" }\n',
          'src/App.tsx': 'export default function App() { return null; }\n',
          'EXPORT-REPORT.md': '# Export report\n'
        },
        copies: [{ from: 'noodl_modules/inter/Inter-Bold.ttf', to: 'public/noodl_modules/inter/Inter-Bold.ttf' }]
      },
      fs
    );

    expect(result).toEqual({ files: 3, copies: 1 });
    expect(fs.readFileSync(path.join(outDir, 'src', 'App.tsx'), 'utf8')).toContain('function App');
    expect(fs.readFileSync(path.join(outDir, 'EXPORT-REPORT.md'), 'utf8')).toBe('# Export report\n');
    // The copy channel: the bytes, not a string of them.
    const copied = fs.readFileSync(path.join(outDir, 'public', 'noodl_modules', 'inter', 'Inter-Bold.ttf'));
    expect(Buffer.compare(copied, FONT_BYTES)).toBe(0);
  });

  it('overwrites a file with the same name and leaves an unrelated file alone', () => {
    const projectDir = tmp('exp012-project-');
    const outDir = tmp('exp012-out-');
    fs.writeFileSync(path.join(outDir, 'package.json'), 'stale');
    fs.writeFileSync(path.join(outDir, 'notes.txt'), 'mine');

    writeExport(projectDir, outDir, { files: { 'package.json': 'fresh' }, copies: [] }, fs);

    expect(fs.readFileSync(path.join(outDir, 'package.json'), 'utf8')).toBe('fresh');
    expect(fs.readFileSync(path.join(outDir, 'notes.txt'), 'utf8')).toBe('mine');
  });

  it('throws when an asset to copy is missing from the project, rather than reporting success', () => {
    const projectDir = tmp('exp012-project-');
    const outDir = tmp('exp012-out-');
    expect(() =>
      writeExport(
        projectDir,
        outDir,
        { files: { 'a.txt': 'a' }, copies: [{ from: 'noodl_modules/gone.woff2', to: 'public/gone.woff2' }] },
        fs
      )
    ).toThrow();
  });
});
