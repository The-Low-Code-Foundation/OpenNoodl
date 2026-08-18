/**
 * CN-003 slice 2b — the MCP server's project catalog overlay.
 *
 * ## What this suite is measuring
 *
 * CN-002 made the silent skip say so: on a project using kit nodes, validation
 * reported `0 error, 5 warning, 8 info` and **0 of 2 connection endpoints
 * checked**. Those numbers are the phase's cleanest before/after, and they are
 * asserted here rather than described — `tests/fixtures/kit-app` reproduces the
 * cashflow project's shape exactly (0/5/8, 0 endpoints) in six nodes.
 *
 * 🔴 **The infos going to zero is not the result.** Suppressing them would
 * produce the same number and would be a regression. So every "after" assertion
 * comes with the check that *replaced* it: `/Broken` carries a connection to a
 * port `demo.kit.Badge` does not declare, invisible to everything today, and the
 * measurement of success is that it becomes a `nonexistent-port` **error**. A
 * pass here therefore requires the checks to have run, not merely to have gone
 * quiet — the disable-the-branch control this repo has been caught without.
 *
 * ## Why the extractor is rebuilt rather than taken from `dist/`
 *
 * `dist/` is gitignored, so a suite that read `dist/kit-extract.cjs` would be
 * skipped in a fresh checkout — and, worse, would silently grade a **stale**
 * artifact in a working one, which is this repo's most expensive recurring
 * failure. {@link buildExtractor} bundles `src/kitExtract/entry.js` into a temp
 * file per run, so what is under test is always the source. ~110 ms.
 *
 * The one thing that costs is that `resolveKitExtractEntry`'s own candidate
 * order is then never exercised by the tests that use the override, so it has a
 * test of its own.
 */

import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { catalogIndex, listNodeTypes, setCatalogOverlay } from '../src/catalog';
import { clearProjectOverlay, extractProjectOverlay, installProjectOverlay, resolveKitExtractEntry } from '../src/kitOverlay';
import { ProjectStore } from '../src/project/ProjectStore';
import { validateOnDisk } from '../src/validate';
import { deriveVisualRootIdsInProject } from '../src/visualRoots';
import { buildKitExtractor, connect, copyFixture } from './helpers';
import type { ProjectInfoResponse } from '../src/tools/responses';

const FIXTURES = path.join(__dirname, 'fixtures');
const KIT_APP = path.join(FIXTURES, 'kit-app');
const KIT_HAZARDS = path.join(FIXTURES, 'kit-hazards');
const DEMO_APP = path.join(FIXTURES, 'demo-app');

let tempDir: string;

beforeAll(async () => {
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cn003-'));
  // `buildKitExtractor` moved to ./helpers when slice 3's agreement suite became
  // its second caller; the reasoning above is now in its doc comment.
  process.env.NODEGX_KIT_EXTRACT = await buildKitExtractor(tempDir);
}, 120_000);

afterAll(() => {
  delete process.env.NODEGX_KIT_EXTRACT;
  fs.rmSync(tempDir, { recursive: true, force: true });
});

afterEach(() => {
  clearProjectOverlay();
});

/** Diagnostic codes and their counts, for a whole project. */
function codes(projectDir: string): { summary: Record<string, number>; byCode: Record<string, number> } {
  const { report } = validateOnDisk(new ProjectStore(projectDir), {});
  const byCode: Record<string, number> = {};
  for (const d of report.diagnostics) byCode[d.code] = (byCode[d.code] ?? 0) + 1;
  return { summary: report.summary as unknown as Record<string, number>, byCode };
}

describe('extraction', () => {
  it('reads the project’s own kit and reports what it found', () => {
    const overlay = extractProjectOverlay(KIT_APP);

    expect(overlay.unavailable).toBeUndefined();
    expect(overlay.skipped).toBeUndefined();
    expect(overlay.failures).toEqual([]);
    expect(overlay.warnings).toEqual([]);
    // CN-012 added the two runtime fields. `Demo Kit`'s manifest declares no
    // `runtimes` at all — the ordinary case — so both read as browser, and the
    // pair being equal is what says "this kit gets what it asked for".
    expect(overlay.kits).toEqual([
      {
        kitModule: 'Demo Kit',
        dirPath: 'noodl_modules/demo-kit',
        availableIn: ['browser'],
        declaredRuntimes: ['browser']
      }
    ]);
    expect(overlay.nodes.map((n) => n.typeName)).toEqual(['demo.kit.Badge', 'demo.kit.Meter']);

    const badge = overlay.nodes.find((n) => n.typeName === 'demo.kit.Badge');
    expect(badge).toBeDefined();
    expect(badge?.providedBy).toBe('project-kit');
    expect(badge?.kitModule).toBe('Demo Kit');
    expect(badge?.isVisual).toBe(true);
    expect(badge?.availableIn).toEqual(['browser']);
    expect(badge?.inputs.map((p) => p.name)).toEqual(
      expect.arrayContaining(['label', 'progress', 'showProgress', 'background'])
    );
    expect(badge?.outputs.map((p) => p.name)).toEqual(expect.arrayContaining(['clicked']));
    expect(badge?.outputs.find((p) => p.name === 'clicked')?.isSignal).toBe(true);

    // Knowingly absent, never null-by-omission. CN-010 owns closing it, and a
    // silent `undefined` here is what would let it be forgotten.
    expect(badge?.parameterEncoding).toEqual({ known: false, reason: expect.stringContaining('CN-010') });
  });

  it('survives a throwing kit, names it, and keeps its neighbours', () => {
    const overlay = extractProjectOverlay(KIT_HAZARDS);

    expect(overlay.unavailable).toBeUndefined();
    expect(overlay.failures).toEqual([
      {
        kitModule: 'Throwing Kit',
        dirPath: 'noodl_modules/throwing-kit',
        message: 'this kit is deliberately broken'
      }
    ]);
    // 🔴 The point of the fixture: the working kit is still here. A throwing
    // neighbour costs you its own nodes and nothing else.
    expect(overlay.nodes.map((n) => n.typeName)).toContain('demo.kit.Survivor');
    // 🔴 This line has moved twice and both moves are the point, not a fixup.
    //
    // CN-012 changed it FROM `['browser', 'cloud']` TO `['browser']`: `working-kit`'s manifest
    // declared two runtimes and only one of them loaded a kit. Measured then — `CloudRunner`
    // called `registerNodes` and nothing else, and `load()` had no parameter a module could
    // arrive through, so the same cloud function answered 200 with a built-in and timed out
    // with a kit node.
    //
    // ✅ CN-013 / D18 built that missing caller, so it moves BACK — for a different reason
    // than it originally held. `kitModules.ts` registers a cloud-enabled kit's logic nodes and
    // the timing-out function now answers 200 with the kit node's own arithmetic, measured
    // through the esbuild bundle over real HTTP. Both halves of this manifest are now fact,
    // which is why `declaredRuntimes` is gone: it is present only when a kit asked for
    // something it does not get.
    //
    // ⚠️ `availableIn` is still not a copy of the manifest. `ssr` remains a value `runtimes`
    // accepts and nothing honours (`noodl-viewer-react/tests/ssr-kit-modules.test.js`), and
    // `nodegx-kit-catalog`'s own suite keeps a row on it.
    const survivor = overlay.nodes.find((n) => n.typeName === 'demo.kit.Survivor');
    expect(survivor?.availableIn).toEqual(['browser', 'cloud']);
    expect(survivor?.declaredRuntimes).toBeUndefined();
  });

  it('reports a kit that shadows a shipped type instead of letting it win', () => {
    const overlay = extractProjectOverlay(KIT_HAZARDS);

    expect(overlay.collisions).toEqual([{ typeName: 'Text', kitModule: 'Shadow Kit' }]);
    // Excluded from the merge, so `Text` still means what the catalog says.
    expect(overlay.nodes.map((n) => n.typeName)).not.toContain('Text');

    setCatalogOverlay(overlay.nodes);
    expect(catalogIndex().getNode('Text')?.displayName).toBe('Text');
    expect((catalogIndex().getNode('Text') as { providedBy?: string })?.providedBy).not.toBe('project-kit');
  });

  it('answers cheaply, and distinguishably, for a project with no modules directory', () => {
    const overlay = extractProjectOverlay(DEMO_APP);

    expect(overlay.skipped).toBe('no-modules-directory');
    expect(overlay.unavailable).toBeUndefined();
    expect(overlay.nodes).toEqual([]);
    // No child process ran, so there is no timing to report — which is itself
    // how a reader tells this apart from an extraction that returned nothing.
    expect(overlay.extractionMs).toBeUndefined();
  });
});

describe('extraction that could not run', () => {
  // 🔴 Every case here must set `unavailable`. An empty `nodes` list with no
  // reason attached is an answer about the project — "it declares no kit node
  // types" — and none of these is entitled to make it.

  it('says so when the override points at nothing', () => {
    const previous = process.env.NODEGX_KIT_EXTRACT;
    process.env.NODEGX_KIT_EXTRACT = path.join(tempDir, 'not-a-file.cjs');
    try {
      const overlay = extractProjectOverlay(KIT_APP);
      expect(overlay.nodes).toEqual([]);
      expect(overlay.unavailable?.reason).toContain('NODEGX_KIT_EXTRACT');
      expect(overlay.unavailable?.probed).toContain(process.env.NODEGX_KIT_EXTRACT);
    } finally {
      process.env.NODEGX_KIT_EXTRACT = previous;
    }
  });

  it('says so when the extractor exits non-zero', () => {
    const failing = path.join(tempDir, 'failing-extract.cjs');
    fs.writeFileSync(failing, 'process.stderr.write("kaboom\\n"); process.exit(3);\n');
    const previous = process.env.NODEGX_KIT_EXTRACT;
    process.env.NODEGX_KIT_EXTRACT = failing;
    try {
      const overlay = extractProjectOverlay(KIT_APP);
      expect(overlay.nodes).toEqual([]);
      expect(overlay.unavailable?.reason).toContain('exited 3');
      expect(overlay.unavailable?.reason).toContain('kaboom');
    } finally {
      process.env.NODEGX_KIT_EXTRACT = previous;
    }
  });

  it('says so when the extractor prints something that is not JSON', () => {
    const chatty = path.join(tempDir, 'chatty-extract.cjs');
    fs.writeFileSync(chatty, 'process.stdout.write("Debugger attached.\\n");\n');
    const previous = process.env.NODEGX_KIT_EXTRACT;
    process.env.NODEGX_KIT_EXTRACT = chatty;
    try {
      const overlay = extractProjectOverlay(KIT_APP);
      expect(overlay.nodes).toEqual([]);
      expect(overlay.unavailable?.reason).toContain('not JSON');
    } finally {
      process.env.NODEGX_KIT_EXTRACT = previous;
    }
  });

  it('probes dist/ beside the bundle and beside src/, in that order', () => {
    const previous = process.env.NODEGX_KIT_EXTRACT;
    delete process.env.NODEGX_KIT_EXTRACT;
    try {
      // The suite runs from `src/`, so the first candidate (`dist/` sitting
      // beside a bundled `noodl-mcp.cjs`) never exists and the second is the one
      // that answers. Asserted as a relative shape so it holds in a checkout
      // with or without a build present.
      const { probed } = resolveKitExtractEntry();
      expect(probed[0]).toBe(path.join(__dirname, '..', 'src', 'kitExtract', 'kit-extract.cjs'));
      expect(probed[1]).toBe(path.join(__dirname, '..', 'dist', 'kit-extract.cjs'));
    } finally {
      process.env.NODEGX_KIT_EXTRACT = previous;
    }
  });
});

describe('acceptance criterion 1 — the catalog knows this project’s types, and only this project’s', () => {
  it('does not know a kit type before the overlay is installed', () => {
    expect(catalogIndex().hasType('demo.kit.Badge')).toBe(false);
  });

  it('knows it after, with provenance on the resolved entry', () => {
    installProjectOverlay(KIT_APP);

    expect(catalogIndex().hasType('demo.kit.Badge')).toBe(true);
    // ⚠️ `hasType()` passing is not the same as the match succeeding — the
    // catalog already carries 103 types where it does not. Assert the entry.
    const entry = catalogIndex().getNode('demo.kit.Badge') as { displayName?: string; providedBy?: string } | undefined;
    expect(entry).toBeDefined();
    expect(entry?.displayName).toBe('Demo Badge');
    expect(entry?.providedBy).toBe('project-kit');
  });

  it('forgets it for a project that does not have the kit', () => {
    installProjectOverlay(KIT_APP);
    expect(catalogIndex().hasType('demo.kit.Badge')).toBe(true);

    clearProjectOverlay();
    installProjectOverlay(DEMO_APP);

    // The half that catches an overlay leaking across projects.
    expect(catalogIndex().hasType('demo.kit.Badge')).toBe(false);
    expect(catalogIndex().getNode('demo.kit.Badge')).toBeUndefined();
    // …and the shipped catalog is intact, not merely un-augmented.
    expect(catalogIndex().hasType('Group')).toBe(true);
  });

  it('lists a kit type beside the built-ins — P1: no capability difference', () => {
    const before = listNodeTypes({ query: 'demo badge' });
    expect(before).toEqual([]);

    installProjectOverlay(KIT_APP);
    const after = listNodeTypes({ query: 'demo badge' });
    expect(after.map((r) => r.typeName)).toEqual(['demo.kit.Badge']);
    expect(after[0].isVisual).toBe(true);
    expect(after[0].availableIn).toEqual(['browser']);
  });
});

describe('acceptance criterion 3 — the skipped checks run, and find something', () => {
  it('goes from 0/5/8 with nothing checked to real results', () => {
    // ── before ──────────────────────────────────────────────────────────────
    // Also the control for the validator cache: this call builds a
    // `SemanticValidator` over the built-ins, and the "after" call below has to
    // get a different one or the overlay is installed and never read.
    const before = codes(KIT_APP);
    expect(before.summary.errors).toBe(0);
    expect(before.summary.warnings).toBe(5);
    expect(before.summary.infos).toBe(8);
    expect(before.summary.endpointsChecked).toBe(0);
    expect(before.byCode['unknown-type-check-skipped']).toBe(8);
    expect(before.byCode['nonexistent-port']).toBeUndefined();

    // ── after ───────────────────────────────────────────────────────────────
    installProjectOverlay(KIT_APP);
    const after = codes(KIT_APP);

    // The number CN-002 was built to provide.
    expect(after.summary.infos).toBe(0);
    expect(after.byCode['unknown-type-check-skipped']).toBeUndefined();
    // The types are known now, so they are not "unknown" either.
    expect(after.summary.warnings).toBe(0);
    expect(after.byCode['unknown-node-type']).toBeUndefined();

    // 🔴 And the checks *ran*. All four endpoints — both ends of both
    // connections — are reached now, where none was before, and the one that
    // was always wrong is finally reported. Without these three lines the suite
    // would pass just as well on a change that deleted the diagnostics.
    expect(after.summary.endpointsChecked).toBe(4);
    expect(after.byCode['nonexistent-port']).toBe(1);
    expect(after.summary.errors).toBe(1);
  });

  it('names the port, the node and the component that were wrong', () => {
    installProjectOverlay(KIT_APP);
    const { report } = validateOnDisk(new ProjectStore(KIT_APP), {});
    const found = report.diagnostics.filter((d) => d.code === 'nonexistent-port');

    expect(found).toHaveLength(1);
    expect(found[0].severity).toBe('error');
    expect(found[0].location.component).toBe('/Broken');
    expect(found[0].location.nodeId).toBe('broken_badge');
    expect(found[0].message).toContain('progres');
  });

  it('leaves the correctly-wired component clean', () => {
    installProjectOverlay(KIT_APP);
    const { report } = validateOnDisk(new ProjectStore(KIT_APP), { component: 'App' });

    // The known-good arm. A check that only ever fires is not a check.
    expect(report.summary.errors).toBe(0);
    expect(report.summary.warnings).toBe(0);
    expect(report.summary.infos).toBe(0);
  });
});

describe('acceptance criterion 5 — visualRoots stops guessing at kit nodes', () => {
  const widgetNodes = JSON.parse(
    fs.readFileSync(path.join(KIT_APP, 'components', 'Widget', 'nodes.json'), 'utf8')
  ).nodes;

  // `() => false` is the answer for a type the catalog does not know: no project
  // component is called `demo.kit.Badge`, so the fallback has nothing to say and
  // a visual node reads as non-visual.
  it('cannot tell a kit node draws anything without the overlay', () => {
    expect(deriveVisualRootIdsInProject(widgetNodes, () => false)).toEqual([]);
  });

  it('answers from the catalog once the overlay is installed', () => {
    installProjectOverlay(KIT_APP);
    expect(deriveVisualRootIdsInProject(widgetNodes, () => false)).toEqual(['widget_badge']);
  });
});

describe('acceptance criterion 6 — extraction writes nothing', () => {
  it('leaves the project directory byte-identical', () => {
    const snapshot = (dir: string): string[] =>
      fs
        .readdirSync(dir, { recursive: true, withFileTypes: true })
        .map((e) => path.join(e.parentPath ?? (e as unknown as { path: string }).path, e.name))
        .sort();

    const before = snapshot(KIT_APP);
    extractProjectOverlay(KIT_APP);
    expect(snapshot(KIT_APP)).toEqual(before);
  });
});

describe('get_project_info reports the kits', () => {
  it('names each kit and the types it contributed', async () => {
    const session = await connect(KIT_APP, false);
    try {
      const result = await session.client.callTool({ name: 'get_project_info', arguments: {} });
      const payload = JSON.parse((result.content as Array<{ text: string }>)[0].text) as ProjectInfoResponse;

      expect(payload.kits).toBeDefined();
      expect(payload.kits?.unavailable).toBeUndefined();
      expect(payload.kits?.modules).toEqual([
        { name: 'Demo Kit', dirPath: 'noodl_modules/demo-kit', nodeTypes: ['demo.kit.Badge', 'demo.kit.Meter'] }
      ]);
      expect(payload.kits?.failures).toBeUndefined();
      expect(payload.kits?.collisions).toBeUndefined();
    } finally {
      await session.close();
    }
  });

  it('says nothing at all for a project with no kits', async () => {
    const dir = copyFixture();
    const session = await connect(dir, false);
    try {
      const result = await session.client.callTool({ name: 'get_project_info', arguments: {} });
      const payload = JSON.parse((result.content as Array<{ text: string }>)[0].text) as ProjectInfoResponse;

      // Omitted, not `{ modules: [] }`. This is the first tool an agent calls
      // and a field saying "no kits" on a project that never had any is cost
      // with no reader.
      expect(payload.kits).toBeUndefined();
      expect(fs.existsSync(path.join(dir, 'noodl_modules'))).toBe(false);
    } finally {
      await session.close();
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe('the fixture kit is a real kit', () => {
  // ⚠️ Two specs in this phase have already named controls that had never been
  // run. This one runs the extractor as a person would, from a shell, against
  // the fixture — so "the fixture works" is a measurement rather than a
  // consequence of the code under test being asked about itself.
  it('extracts from a plain command line, with a relative path', () => {
    const stdout = execFileSync(
      process.execPath,
      [process.env.NODEGX_KIT_EXTRACT as string, path.relative(process.cwd(), KIT_APP)],
      { encoding: 'utf8', cwd: process.cwd() }
    );
    const payload = JSON.parse(stdout) as { failures: unknown[]; nodetypes: Array<{ name: string }> };
    // 🔴 The relative path is the assertion. `require()` reads a
    // relative-looking path as a module id, so before slice 2b resolved the
    // argument every kit failed with "cannot find module" while extraction
    // reported success.
    expect(payload.failures).toEqual([]);
    expect(payload.nodetypes.map((n) => n.name).sort()).toEqual(['demo.kit.Badge', 'demo.kit.Meter']);
  }, 30_000);
});
