/**
 * CN-013 — the producer and the consumer of the cloud bundle's `modules`, joined up.
 *
 * ## Why this file exists at all
 *
 * `@nodegx/module-inject`'s `CloudModuleSource` (the editor-side producer, which reads
 * `noodl_modules/` off disk) and `kitModules.ts`' `CloudKitModule` (the runtime-side consumer,
 * bundled into `nodegx-backend`'s `cli.js`) are **two declarations of one shape**. The runtime
 * cannot import the producer's type: it ships inside a backend that has no dependency on the
 * editor's packages.
 *
 * 🔴 **A second consumer redeclaring a shared shape is checked by nothing.** Both sides compile,
 * both sides' own suites pass, and the first field one of them renames is discovered by a user.
 * The usual patch — asserting a hand-written sample object satisfies both — is worth very little,
 * because the sample is written by whoever last read both files and drifts with neither.
 *
 * So this suite does not compare types. It runs the **real producer over a real project directory**
 * and feeds its **whole output**, unmodified, into the **real consumer** — and asserts on what the
 * consumer then did. A renamed field on either side reddens here, whichever side moved.
 *
 * ⚠️ The population is the whole scan, not a chosen element: the fixture deliberately carries a
 * cloud kit, a browser-only kit, and a kit with a manifest that declares the cloud runtime and has
 * no entry script, so every branch of the producer is represented in the array the consumer reads.
 */

/* eslint-env jest */
/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-var-requires */

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import { loadCloudKitModules } from '../src';

const { readCloudModuleSources, moduleRunsInCloud } = require('@nodegx/module-inject');

/** A kit whose single node is pure JS — the class D18 rules in. */
const CLOUD_KIT = `
Noodl.defineModule({
  nodes: [{ name: 'agree.kit.Adder', category: 'Math', color: 'data',
    inputs: {}, outputs: {} }]
});
`;

/** A kit that never opted in. Its source must not travel; its name must. */
const BROWSER_KIT = `
Noodl.defineModule({ nodes: [{ name: 'agree.kit.Visual', category: 'Visual' }] });
`;

function writeKit(root: string, dir: string, manifest: Record<string, unknown>, source?: string) {
  const kitDir = path.join(root, 'noodl_modules', dir);
  fs.mkdirSync(kitDir, { recursive: true });
  fs.writeFileSync(path.join(kitDir, 'manifest.json'), JSON.stringify(manifest, null, 2));
  if (source !== undefined) fs.writeFileSync(path.join(kitDir, 'index.js'), source);
}

describe('the cloud bundle`s `modules`: the real producer, read by the real consumer', () => {
  let projectDir: string;

  beforeAll(() => {
    projectDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cn013-agree-'));
    writeKit(projectDir, 'cloud-kit', { name: 'Cloud Kit', main: 'index.js', runtimes: ['browser', 'cloud'] }, CLOUD_KIT);
    writeKit(projectDir, 'browser-kit', { name: 'Browser Kit', main: 'index.js', runtimes: ['browser'] }, BROWSER_KIT);
    // Declares the cloud runtime and has nothing to load. The producer must report it rather than
    // omit it, or the consumer's `unreadable` branch would be unreachable in practice.
    writeKit(projectDir, 'empty-kit', { name: 'Empty Kit', runtimes: ['cloud'] });
  });

  afterAll(() => fs.rmSync(projectDir, { recursive: true, force: true }));

  it('carries every module, and only cloud modules carry source', async () => {
    const modules = await readCloudModuleSources(projectDir);

    expect(modules.map((m: any) => m.name).sort()).toEqual(['Browser Kit', 'Cloud Kit', 'Empty Kit']);

    // The whole population, not a chosen element: every entry's `source` must agree with its own
    // `cloud` flag. A producer that started shipping browser sources would redden here.
    for (const m of modules) {
      if (!m.cloud) expect(m.source).toBeNull();
    }
    expect(modules.find((m: any) => m.name === 'Cloud Kit').source).toContain('agree.kit.Adder');
    expect(modules.find((m: any) => m.name === 'Browser Kit').source).toBeNull();
  });

  it("the predicate and the flag are the same answer, over the whole scan", () => {
    // `moduleRunsInCloud` is the exported predicate; `cloud` is what the reader stamped using it.
    // Asserting they agree on every entry is what stops one of them being changed alone.
    return readCloudModuleSources(projectDir).then((modules: any[]) => {
      for (const m of modules) expect(m.cloud).toBe(moduleRunsInCloud(m));
    });
  });

  it('🔴 the consumer registers, skips and reports exactly what the producer described', async () => {
    const modules = await readCloudModuleSources(projectDir);
    const registered: any[] = [];
    const result = loadCloudKitModules({ registerModule: (m: any) => registered.push(m) }, modules, new Set());

    // Registered: the one kit that opted in and had something to load.
    expect(result.registered).toEqual(['Cloud Kit']);
    expect(result.nodeTypes).toEqual(['agree.kit.Adder']);
    // 🔴 The name came off the manifest, through the producer, into `defineModule`'s object. This
    // is CN-003's defect in the one bootstrap that did not exist when CN-003 was fixed — without
    // the adoption every one of these nodes is stamped `Unknown Module`.
    expect(registered[0].name).toBe('Cloud Kit');

    // Reported, each with the reason that tells the author what to do about it.
    const byModule = Object.fromEntries(result.failures.map((f) => [f.module, f.reason]));
    expect(byModule).toEqual({ 'Browser Kit': 'not-cloud-enabled', 'Empty Kit': 'unreadable' });
  });

  it('a project with no `noodl_modules` produces an empty list, not a throw', async () => {
    const bare = fs.mkdtempSync(path.join(os.tmpdir(), 'cn013-bare-'));
    try {
      expect(await readCloudModuleSources(bare)).toEqual([]);
      // And the consumer treats "no modules" as the ordinary case rather than an error — most
      // projects have no kits and every one of them loads a bundle.
      expect(loadCloudKitModules({ registerModule: () => undefined }, [], new Set()).failures).toEqual([]);
    } finally {
      fs.rmSync(bare, { recursive: true, force: true });
    }
  });
});
