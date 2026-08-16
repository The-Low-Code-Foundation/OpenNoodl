/**
 * CN-004 — turn the checks back on, end to end, on a project that really has a kit.
 *
 * ## What is graded here that is graded nowhere else
 *
 * `noodl-editor/tests-unit/cn-004` grades the consequence with a hand-written
 * overlay: it can say *given* a mapped kit type, a wrong parameter is reported.
 * It cannot say that a real kit, executed by the real extractor, produces an
 * overlay those checks can use. This file runs the whole chain — kit on disk →
 * headless extraction → overlay install → the actual validation callers — for
 * two fixture projects.
 *
 * ## 🔴 The two pipelines, and why criterion 1 lands in only one of them
 *
 * `checkParameterValues` has **exactly one** production caller
 * (`authoredPreconditionDiagnostics`), which the write gate and the editor's
 * authoring loop use. `validate_project` / `validate:project` run the semantic
 * validator and never reach it, so **parameter values are checked for no node of
 * any provenance** on the project path. CN-002 found that and it is still open as
 * a scope call (phase README §5.1).
 *
 * That is not a kit-specific hole and CN-004 does not close it: the parity D4
 * demands holds in both pipelines — checked for kit and built-in alike in the
 * authoring one, checked for neither in the project one. Both are asserted below
 * so that a later reader cannot mistake the project path's silence for kit nodes
 * being verified there.
 */

import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { catalogIndex, setCatalogOverlay } from '../src/catalog';
import { clearProjectOverlay, extractProjectOverlay } from '../src/kitOverlay';
import { ProjectStore } from '../src/project/ProjectStore';
import { preconditionDiagnostics, authoredProjectViews, validateOnDisk } from '../src/validate';
import { buildKitExtractor } from './helpers';

const FIXTURES = path.join(__dirname, 'fixtures');
const KIT_APP = path.join(FIXTURES, 'kit-app');
const KIT_DYNPORTS = path.join(FIXTURES, 'kit-dynports');

let tempDir: string;

/**
 * The two kits, extracted **once each**, keyed by kit rather than by directory.
 *
 * `extractProjectOverlay` spawns a child process, and this suite's first draft
 * called it once per test. Keyed by kit because the derived fixtures
 * (`withStrayType`, the two-pipeline copy) are byte-copies of a base project
 * *with its kit* — a second extraction of the same `noodl_modules/` produces the
 * same overlay and buys nothing. Extraction itself is graded by CN-003 and,
 * once, below.
 *
 * ⚠️ **This is thrift, not a fix, and the distinction cost a measurement.** The
 * `@noodl/mcp` provisioning suites (`provision.test.ts`,
 * `projectOwnsBackend.test.ts`) start real backend processes and fail
 * intermittently under machine load. Adding this suite raised the rate, and on a
 * single before/after sample that read as *caused by* it — a reading this file
 * briefly asserted. Interleaved A/B runs on the same machine say otherwise:
 *
 * | | runs failing |
 * |---|---|
 * | without this suite | **2 of 6** |
 * | with it | 4 of 6 |
 *
 * and a 49th suite touching **no package code at all** — 1.5s of arithmetic —
 * reproduces the same failures. So the defect is in those suites' tolerance of
 * concurrent load, it predates this task, and no amount of thrift here closes
 * it. 🔴 A sequential "clean before, red after" comparison on a shared machine
 * measures the machine, not the change.
 */
const overlays = new Map<string, ReturnType<typeof extractProjectOverlay>>();

/**
 * Install the overlay for the kit `baseFixture` carries.
 *
 * `baseFixture` is the fixture the kit lives in, which for a derived directory
 * is the project it was copied from — not the copy.
 */
function useOverlay(baseFixture: string): void {
  let overlay = overlays.get(baseFixture);
  if (!overlay) {
    overlay = extractProjectOverlay(baseFixture);
    overlays.set(baseFixture, overlay);
  }
  setCatalogOverlay(overlay.nodes);
}

beforeAll(async () => {
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cn004-'));
  process.env.NODEGX_KIT_EXTRACT = await buildKitExtractor(tempDir);
}, 120_000);

afterAll(() => {
  delete process.env.NODEGX_KIT_EXTRACT;
  fs.rmSync(tempDir, { recursive: true, force: true });
});

afterEach(() => clearProjectOverlay());

/** The authoring pipeline, for one component of a project, as the write gate runs it. */
function authoringDiagnostics(projectDir: string, component: string) {
  const store = new ProjectStore(projectDir);
  const stored = store.readComponent(component);
  const name = stored.files.component.path ?? stored.key;
  const views = authoredProjectViews(store, new Map([[name, stored.files]]));
  return preconditionDiagnostics(name, stored.files, views);
}

/** The project pipeline, whole-project, as `validate_project` runs it. */
function projectReport(projectDir: string, strict: boolean) {
  return validateOnDisk(new ProjectStore(projectDir), { strict }).report;
}

describe('acceptance criterion 2 — a greenfield project using a kit passes --strict', () => {
  it('is clean under strict once the overlay is installed', () => {
    useOverlay(KIT_DYNPORTS);
    const report = projectReport(KIT_DYNPORTS, true);

    expect(report.summary.errors).toBe(0);
    expect(report.summary.warnings).toBe(0);
    expect(report.summary.infos).toBe(0);
  });

  // 🔴 The control, and the headline defect stated as a measurement: without the
  // overlay this same untouched project **cannot pass its own gate**, because
  // `--strict` promotes `unknown-node-type` to an error for types that are not
  // wrong, merely ours.
  it('and could not, before — the contradiction CN-004 names', () => {
    const report = projectReport(KIT_DYNPORTS, true);

    expect(report.summary.errors).toBe(2);
    expect(report.diagnostics.filter((d) => d.code === 'unknown-node-type')).toHaveLength(2);
  });
});

describe('acceptance criterion 3 — a type no kit declares is unchanged', () => {
  /**
   * The kit project, plus one node of a type nothing anywhere declares — wired,
   * so that the check which *does* run on the project path has an endpoint to
   * skip. An unwired stray node draws no skip diagnostic at all, and asserting
   * one would have been asserting a mechanism that cannot fire here.
   */
  function withStrayType(): string {
    const dir = path.join(tempDir, 'stray');
    fs.rmSync(dir, { recursive: true, force: true });
    fs.cpSync(KIT_DYNPORTS, dir, { recursive: true });

    const nodesPath = path.join(dir, 'components', 'App', 'nodes.json');
    const nodes = JSON.parse(fs.readFileSync(nodesPath, 'utf8'));
    nodes.nodes[0].children.push('stray');
    nodes.nodes.push({ id: 'stray', type: 'nothing.declares.This', parent: 'dyn_group', parameters: { a: 1 } });
    fs.writeFileSync(nodesPath, JSON.stringify(nodes, null, 2));

    const connPath = path.join(dir, 'components', 'App', 'connections.json');
    const conns = JSON.parse(fs.readFileSync(connPath, 'utf8'));
    conns.connections.push({ fromId: 'dyn_panel', fromProperty: 'title', toId: 'stray', toProperty: 'anything' });
    fs.writeFileSync(connPath, JSON.stringify(conns, null, 2));
    return dir;
  }

  it('still warns, and the kit types beside it do not', () => {
    const dir = withStrayType();
    useOverlay(KIT_DYNPORTS); // the copy carries the same kit
    const report = projectReport(dir, false);

    const unknown = report.diagnostics.filter((d) => d.code === 'unknown-node-type');
    expect(unknown).toHaveLength(1);
    expect(unknown[0].severity).toBe('warning');
    expect(unknown[0].location.nodeType).toBe('nothing.declares.This');
  });

  it('still errors under strict', () => {
    const dir = withStrayType();
    useOverlay(KIT_DYNPORTS); // the copy carries the same kit
    const report = projectReport(dir, true);

    const unknown = report.diagnostics.filter((d) => d.code === 'unknown-node-type');
    expect(unknown).toHaveLength(1);
    expect(unknown[0].severity).toBe('error');
    // ⚠️ The whole point of criterion 3: the overlay must buy the *kit's* types a
    // pass and nothing else's. A fix that made `--strict` lenient generally
    // would satisfy criterion 2 and quietly destroy this.
    expect(report.summary.errors).toBe(1);
  });

  it('and its downstream checks are still skipped, out loud', () => {
    const dir = withStrayType();
    useOverlay(KIT_DYNPORTS); // the copy carries the same kit
    const report = projectReport(dir, false);

    const skips = report.diagnostics.filter((d) => d.code === 'unknown-type-check-skipped');
    expect(skips.length).toBeGreaterThan(0);
    expect(skips.every((d) => d.location.nodeType === 'nothing.declares.This')).toBe(true);
  });
});

describe('acceptance criterion 1 — the authoring gate, on a real extracted kit', () => {
  it('reports a wrong parameter on a kit node', () => {
    useOverlay(KIT_APP);
    const store = new ProjectStore(KIT_APP);
    const stored = store.readComponent('App');
    // A `showProgress` typed boolean, given the string that reads as its
    // opposite. The fixture on disk is correct; the mistake is introduced here
    // so the known-good arm below stays a genuine control.
    const files = JSON.parse(JSON.stringify(stored.files));
    files.nodes.nodes.find((n: { id: string }) => n.id === 'app_badge').parameters.showProgress = 'false';

    const views = authoredProjectViews(store, new Map([['/App', files]]));
    const found = preconditionDiagnostics('/App', files, views).filter(
      (d) => d.code === 'invalid-parameter-value'
    );

    expect(found).toHaveLength(1);
    expect(found[0].severity).toBe('error');
    expect(found[0].location.nodeType).toBe('demo.kit.Badge');
    expect(found[0].location.port).toBe('showProgress');
  });

  it('says nothing about the same component unmodified', () => {
    useOverlay(KIT_APP);
    expect(authoringDiagnostics(KIT_APP, 'App')).toEqual([]);
  });

  it('and could say neither before the overlay — the check never ran', () => {
    // The control that makes the two above mean something. `info`, not silence:
    // CN-002's diagnostic is what distinguishes "checked and fine" from
    // "not checked", and it is the reading this task erases.
    const found = authoringDiagnostics(KIT_APP, 'App');
    expect(found.map((d) => d.code)).toEqual(['unknown-type-check-skipped', 'unknown-type-check-skipped']);
  });
});

describe('item 4 — a kit whose ports are runtime-determined is not accused of them', () => {
  it('extracts the two mechanisms distinctly from a real kit', () => {
    const overlay = extractProjectOverlay(KIT_DYNPORTS);
    expect(overlay.failures).toEqual([]);

    const panel = overlay.nodes.find((n) => n.typeName === 'dynports.kit.Panel');
    const feed = overlay.nodes.find((n) => n.typeName === 'dynports.kit.Feed');
    expect(panel?.dynamicPorts?.mechanisms).toEqual(['declared-port-groups']);
    expect(feed?.dynamicPorts?.mechanisms).toEqual(['runtime-discovered']);
    // 🔴 The fact that makes the carve-out load-bearing rather than tidy: the
    // exporter keeps a channel port out of the static list, so nothing but the
    // mechanism can vouch for `channelName`.
    expect(feed?.inputs.map((p) => p.name)).not.toContain('channelName');
  });

  it('leaves the correct kit project completely clean through the authoring gate', () => {
    useOverlay(KIT_DYNPORTS);
    // Both nodes set a parameter the catalog cannot see or must read a condition
    // for. Before the mapping fix this was one `unknown-parameter` warning on a
    // node that is right.
    expect(authoringDiagnostics(KIT_DYNPORTS, 'App')).toEqual([]);
    expect(catalogIndex().hasRuntimeDynamicPorts('dynports.kit.Feed')).toBe(true);
    expect(catalogIndex().hasRuntimeDynamicPorts('dynports.kit.Panel')).toBe(false);
  });
});

describe('what CN-004 does NOT close — the second pipeline', () => {
  it('checks parameter values for no node on the project path, kit or built-in', () => {
    useOverlay(KIT_APP);
    const store = new ProjectStore(KIT_APP);
    const stored = store.readComponent('App');
    const files = JSON.parse(JSON.stringify(stored.files));
    // A wrong value on the kit node AND on the built-in Group beside it.
    files.nodes.nodes.find((n: { id: string }) => n.id === 'app_badge').parameters.showProgress = 'false';
    files.nodes.nodes.find((n: { id: string }) => n.id === 'app_group').parameters = { opacity: 'lots' };

    const dir = path.join(tempDir, 'twopipes');
    fs.rmSync(dir, { recursive: true, force: true });
    fs.cpSync(KIT_APP, dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'components', 'App', 'nodes.json'), JSON.stringify(files.nodes, null, 2));

    clearProjectOverlay();
    useOverlay(KIT_APP); // the copy carries the same kit
    const report = validateOnDisk(new ProjectStore(dir), { component: 'App', strict: false }).report;

    // ⚠️ Both mistakes are real and neither is reported. The parity D4 asks for
    // holds — a kit node is treated exactly as a built-in is — and what is
    // missing is missing for everyone. Widening this is the open scope call, and
    // this assertion is what will fail, loudly and by name, on the day it is
    // taken: replace it, do not delete it.
    expect(report.diagnostics.filter((d) => d.code === 'invalid-parameter-value')).toEqual([]);

    // …while the same two files through the authoring gate report both.
    const views = authoredProjectViews(new ProjectStore(dir), new Map());
    const authored = preconditionDiagnostics('/App', files, views).filter(
      (d) => d.code === 'invalid-parameter-value'
    );
    expect(authored.map((d) => d.location.nodeType).sort()).toEqual(['Group', 'demo.kit.Badge']);
  });
});
