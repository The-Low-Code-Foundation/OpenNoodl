/**
 * CN-017 AC2 — the gate that decides whether somebody else's JavaScript is
 * written into a user's project.
 *
 * 🔴 **The trap this file exists to avoid is "a behavioural guard can be
 * decoration".** A spec that only asked whether a consent dialog *can appear*
 * would pass on a build where the dialog appears and the copy happens anyway.
 * What is graded here is the decision the copy loop acts on: an unconsented
 * executable module is **refused**, and refusing it is not silent.
 *
 * ⚠️ The enforcement itself lives in `apply()`'s copy loop, which needs a
 * renderer; this module is the decision it reads. The pairing is stated in
 * `moduleGate.ts`'s own header so neither half can be mistaken for the whole.
 */

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import { installTestFileSystem } from '../cn-006/testFileSystem';

installTestFileSystem();

import {
  copyPlannedModules,
  executableModuleNames,
  moduleCopyDecision
} from '../../src/editor/src/utils/import-engine/moduleGate';
import type { ImportOrigin, KitConsent } from '../../src/editor/src/utils/import-engine/types';

const LOCAL: ImportOrigin = { kind: 'local-project' };

function consent(module: string): KitConsent {
  return {
    module,
    verification: { ok: true, outcome: 'defines-nodes', message: 'Defines 1 node: n.', nodes: ['n'] },
    consentedAt: '2026-08-18T00:00:00.000Z'
  };
}

function downloaded(consents: KitConsent[]): ImportOrigin {
  return { kind: 'downloaded', url: 'https://cdn.example.com/kit.zip', consents };
}

describe('CN-017 AC1 — a local origin is not gated', () => {
  /*
   * ✅ D6's first part, at the one line that could break it. A kit copied in from
   * a project on this machine is local code: no verification step, no consent, no
   * refusal — and the scaffold route never reaches this function at all, because
   * `createNodeKit` writes straight into the open project rather than importing.
   */
  it('copies an executable module from a local project with no consent record', () => {
    const decision = moduleCopyDecision(LOCAL, 'my-kit', true);
    expect(decision.allowed).toBe(true);
    expect(decision.reason).toBeUndefined();
  });

  it('records it as imported rather than as installed or as locally authored', () => {
    const record = moduleCopyDecision(LOCAL, 'my-kit', true).provenance!('2026-08-18T10:00:00.000Z');
    expect(record.origin).toBe('imported');
    // 🔴 There is no `verification` field on this arm of the union to misread as
    // "the local kit was checked" — the defect CN-017 names against itself.
    expect('verification' in record).toBe(false);
  });
});

describe('CN-017 AC2 — a downloaded origin copies only what was consented to', () => {
  it('refuses an executable module that is not in the consent list', () => {
    const decision = moduleCopyDecision(downloaded([]), 'stranger-kit', true);
    expect(decision.allowed).toBe(false);
    // Named, never silent: a kit that simply failed to appear, with nothing
    // saying why, is the CN-015 failure mode this phase spent a task closing.
    expect(decision.reason).toContain('stranger-kit');
    expect(decision.reason).toContain('runs JavaScript in your app');
  });

  it('copies a module the user did consent to, and records the consent with it', () => {
    const decision = moduleCopyDecision(downloaded([consent('good-kit')]), 'good-kit', true);
    expect(decision.allowed).toBe(true);

    const record = decision.provenance!('2026-08-18T10:00:00.000Z');
    expect(record.origin).toBe('installed');
    if (record.origin !== 'installed') throw new Error('unreachable');
    expect(record.url).toBe('https://cdn.example.com/kit.zip');
    expect(record.consentedAt).toBe('2026-08-18T00:00:00.000Z');
    // What the user agreed to was *this script defining these nodes*; a record
    // that kept only "yes" could not say what the yes was about.
    expect(record.verification.nodes).toEqual(['n']);
  });

  it("consenting to one module does not consent to another", () => {
    const origin = downloaded([consent('good-kit')]);
    expect(moduleCopyDecision(origin, 'good-kit', true).allowed).toBe(true);
    expect(moduleCopyDecision(origin, 'other-kit', true).allowed).toBe(false);
  });

  /*
   * ⚠️ An icon set contributes no code. Refusing it would make an install fail
   * for a reason the consent copy could not honestly state — and would train
   * people to click through the prompt that matters.
   */
  it('copies a non-executable module from a downloaded origin without consent', () => {
    const decision = moduleCopyDecision(downloaded([]), 'icons', false);
    expect(decision.allowed).toBe(true);
    expect(decision.provenance).toBeUndefined();
  });
});

describe('CN-017 — which modules count as executable, read from disk', () => {
  let dir: string;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cn017-gate-'));
  });

  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  function writeModule(name: string, manifest: Record<string, unknown>) {
    const modDir = path.join(dir, 'noodl_modules', name);
    fs.mkdirSync(modDir, { recursive: true });
    fs.writeFileSync(path.join(modDir, 'manifest.json'), JSON.stringify(manifest), 'utf8');
    if (typeof manifest.main === 'string') fs.writeFileSync(path.join(modDir, manifest.main), '', 'utf8');
  }

  it('separates code-bearing modules from an icon set', async () => {
    writeModule('a-kit', { name: 'A Kit', main: 'index.js' });
    writeModule('icons', { name: 'Icons', type: 'iconset', icons: ['a'] });

    const executable = await executableModuleNames(dir, ['a-kit', 'icons']);
    expect([...executable]).toEqual(['a-kit']);
  });

  /*
   * 🔴 The fail-closed direction, and it is a deliberate asymmetry. "We could not
   * tell what this folder is" must not render as "harmless": a planned module the
   * scan cannot describe is treated as executable, so a downloaded copy of it
   * needs consent rather than sliding through on a missing manifest.
   */
  it('treats a module the scan cannot describe as executable', async () => {
    const executable = await executableModuleNames(dir, ['not-on-disk']);
    expect(executable.has('not-on-disk')).toBe(true);
  });

  it('ignores modules the plan did not ask for', async () => {
    writeModule('wanted', { name: 'Wanted', main: 'index.js' });
    writeModule('unwanted', { name: 'Unwanted', main: 'index.js' });

    const executable = await executableModuleNames(dir, ['wanted']);
    expect([...executable]).toEqual(['wanted']);
  });
});

describe('CN-017 AC2 — the loop refuses to WRITE, not merely to approve', () => {
  let dir: string;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cn017-copy-'));
  });

  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  function writeModule(name: string, manifest: Record<string, unknown>) {
    const modDir = path.join(dir, 'noodl_modules', name);
    fs.mkdirSync(modDir, { recursive: true });
    fs.writeFileSync(path.join(modDir, 'manifest.json'), JSON.stringify(manifest), 'utf8');
    if (typeof manifest.main === 'string') fs.writeFileSync(path.join(modDir, manifest.main), '', 'utf8');
  }

  /*
   * 🔴 **The trap CN-017 names against itself: a behavioural guard can be
   * decoration.** This asserts the copy function was never CALLED for the
   * unconsented kit — a build where the dialog appears and the copy happens
   * anyway fails here, and passes any spec that only asks whether a dialog exists.
   */
  it('never asks the copy function to write an unconsented kit', async () => {
    writeModule('stranger-kit', { name: 'Stranger', main: 'index.js' });
    writeModule('icons', { name: 'Icons', type: 'iconset', icons: ['a'] });

    const asked: string[] = [];
    const outcome = await copyPlannedModules({
      sourceDir: dir,
      moduleNames: ['stranger-kit', 'icons'],
      origin: downloaded([]),
      at: '2026-08-18T10:00:00.000Z',
      copy: (name) => asked.push(name)
    });

    expect(asked).toEqual(['icons']);
    expect(outcome.copied).toEqual(['icons']);
    expect(outcome.warnings.join(' ')).toContain('stranger-kit');
    // Nothing landed that could be vouched for.
    expect(outcome.provenance).toEqual([]);
  });

  it('writes the consented kit and records where it came from', async () => {
    writeModule('good-kit', { name: 'Good', main: 'index.js' });

    const asked: string[] = [];
    const outcome = await copyPlannedModules({
      sourceDir: dir,
      moduleNames: ['good-kit'],
      origin: downloaded([consent('good-kit')]),
      at: '2026-08-18T10:00:00.000Z',
      copy: (name) => asked.push(name)
    });

    expect(asked).toEqual(['good-kit']);
    expect(outcome.warnings).toEqual([]);
    expect(outcome.provenance).toHaveLength(1);
    expect(outcome.provenance[0].origin).toBe('installed');
  });

  /*
   * ⚠️ A record describing a module whose copy threw would be a provenance file
   * vouching for a folder that is not there.
   */
  it('records nothing for a copy that threw, and names the failure', async () => {
    writeModule('good-kit', { name: 'Good', main: 'index.js' });

    const outcome = await copyPlannedModules({
      sourceDir: dir,
      moduleNames: ['good-kit'],
      origin: downloaded([consent('good-kit')]),
      at: '2026-08-18T10:00:00.000Z',
      copy: () => {
        throw new Error('disk full');
      }
    });

    expect(outcome.copied).toEqual([]);
    expect(outcome.provenance).toEqual([]);
    expect(outcome.warnings[0]).toContain('good-kit');
    expect(outcome.warnings[0]).toContain('disk full');
  });

  /*
   * ✅ AC1 through the whole loop, not just the decision: a local import writes
   * every module with nothing asked of the user.
   */
  it('writes every module from a local project without consulting a consent list', async () => {
    writeModule('a-kit', { name: 'A', main: 'index.js' });
    writeModule('b-kit', { name: 'B', main: 'index.js' });

    const asked: string[] = [];
    const outcome = await copyPlannedModules({
      sourceDir: dir,
      moduleNames: ['a-kit', 'b-kit'],
      origin: LOCAL,
      at: '2026-08-18T10:00:00.000Z',
      copy: (name) => asked.push(name)
    });

    expect(asked).toEqual(['a-kit', 'b-kit']);
    expect(outcome.warnings).toEqual([]);
    expect(outcome.provenance.map((p) => p.origin)).toEqual(['imported', 'imported']);
  });
});

describe('CN-017 — an export stages freely and records nothing', () => {
  /*
   * 🔴 Found by following the export path rather than by assuming it was the same
   * as a local import. `openExportFlow` stages into a throwaway project that is
   * then **zipped**, so a provenance record written there would travel inside a
   * stranger's download and claim these kits came from a project on their
   * computer. Provenance belongs to the project that installed a kit, never to
   * the kit.
   */
  it('copies without a gate and produces no provenance record', () => {
    const decision = moduleCopyDecision({ kind: 'export-staging' }, 'my-kit', true);
    expect(decision.allowed).toBe(true);
    expect(decision.provenance).toBeUndefined();
  });
});
