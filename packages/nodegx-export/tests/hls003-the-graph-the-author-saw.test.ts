/**
 * HLS-003 — **the graph the CLI exports is the graph the author saw.**
 *
 * ## The seam, and why the exporter was on the wrong side of it
 *
 * `applyPatches(content)` runs immediately before `ProjectModel.fromJSON`, and `fromJSON` does not
 * apply patches. So the canvas is built from a **migrated** graph while every reader that goes to
 * the files sees them as written. NDA-017's migration is not a normalisation: for a node whose
 * control signal is wired it writes `runOnChange-<input>: false`, and the runtime reads an absent
 * key as *ticked*. Absence therefore means opposite things to the two readers, and there is no
 * version marker in the format to tell them apart.
 *
 * 🔴 **This was never CLI-specific.** `exportSequence.ts` calls `parseProject(projectDir, …)` —
 * the editor's own File → Export React reads the files from disk, not the model the canvas was
 * built from. HLS-002 proved the two doors identical byte for byte, which is exactly consistent
 * with both of them having been wrong in the same way.
 *
 * ## What the disagreement costs, measured rather than assumed
 *
 * It does not ship a subtly different app. **It refuses work the exporter could have done.** On
 * the `cheer` fixture with `runOnChange-condition` absent, two `Condition` nodes report *"Run On
 * Value Change is ticked"* — the case the analyser has no rule for — and the export falls from
 * *translated with nothing left over (9)* to *(7)*: two whole pages and four cascade nodes
 * refused, over a parameter the author never chose and cannot see.
 *
 * ## The three arms below, and which one is the mutant
 *
 * Every arm is the same fixture, differing only in what its `runOnChange-condition` keys say:
 *
 * | arm | the files say | what it stands for |
 * |---|---|---|
 * | `absent` | no key | a project the editor has not opened-and-saved — a prefab, a generated template, anything an agent authored |
 * | `false` | the migration's own value | the same project after an editor has loaded and saved it |
 * | `true` | the author re-ticked the box | 🔴 **the mutant** |
 *
 * ⚠️ **`true` is a faithful mutant of the settle pass, not merely a different project.** Reading an
 * absent key literally *is* reading it as ticked — that is what `runOnValueChange()` does — so the
 * `true` arm is byte-for-byte what this exporter produced before the settle existed. It doubles as
 * the presence control (AC3) and as the mutant (AC4), and it grades one more thing neither would
 * alone: that the settle **fills absence and never overwrites an answer**, because if it clobbered
 * the author's `true` this arm would collapse into the other two.
 *
 * 🔴 **A zero in the corpus sweep means "this project does not exercise the seam", never "the seam
 * is closed."** A project with no node of the fifteen families with its control signal wired reads
 * zero however open the seam is — which is why every reading below carries `familyNodes` beside
 * it, and why the sweep refuses to pass on a corpus it never reached.
 *
 * @module nodegx-export/tests/hls003
 */
/* eslint-env jest */

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import { planRunOnValueChangeMigration } from '@nodegx/project-contract/run-on-value-change-migration';
import { Catalog, loadCatalog } from '../src/catalog';
import { emitApp } from '../src/emit/emitApp';
import { REPORT_PATH } from '../src/emit/report';
import { parseProject } from '../src/parse/parseProject';

const FIXTURE_DIR = path.join(__dirname, 'fixtures');
let catalog: Catalog;
beforeAll(() => {
  catalog = loadCatalog();
});

const irOf = (dir: string) => parseProject(dir, catalog);
const appOf = (dir: string) => emitApp(irOf(dir), catalog);

/** Every v2 project in the fixture corpus — the artefacts other tasks put there. */
function fixtureProjects(): string[] {
  return fs
    .readdirSync(FIXTURE_DIR, { withFileTypes: true })
    .filter((e) => e.isDirectory() && fs.existsSync(path.join(FIXTURE_DIR, e.name, 'nodegx.project.json')))
    .map((e) => e.name)
    .sort();
}

/**
 * The migration's reading of a v2 project, over the raw files.
 *
 * The flat `nodes` array is handed over as `roots`: the migration recurses into `children` only
 * when the child is an object, and in v2 files `children` holds id strings while every node is
 * already in the flat array. One visit per node, no unflattening, no second opinion about the
 * tree — the same reasoning `settleComponent` is built on, exercised here through a different
 * caller so a change to one does not silently agree with itself.
 */
function readingOf(projectDir: string): { writes: number; familyNodes: number; signalDrivenNodes: number } {
  const projectFile = JSON.parse(fs.readFileSync(path.join(projectDir, 'nodegx.project.json'), 'utf8'));
  const componentsDir = path.join(projectDir, projectFile.structure?.componentsDir ?? 'components');
  const components: unknown[] = [];

  const walk = (dir: string) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(p);
      else if (entry.name === 'nodes.json') {
        const nodes = JSON.parse(fs.readFileSync(p, 'utf8')).nodes ?? [];
        const connPath = path.join(dir, 'connections.json');
        const connections = fs.existsSync(connPath) ? JSON.parse(fs.readFileSync(connPath, 'utf8')).connections ?? [] : [];
        components.push({ name: path.relative(componentsDir, dir), graph: { roots: nodes, connections } });
      }
    }
  };
  if (fs.existsSync(componentsDir)) walk(componentsDir);

  const plan = planRunOnValueChangeMigration({ components } as never);
  return { writes: plan.writes.length, familyNodes: plan.familyNodes, signalDrivenNodes: plan.signalDrivenNodes };
}

/** Copy `cheer` and rewrite every `runOnChange-condition` key to the arm's answer. */
function armOf(answer: 'absent' | boolean): string {
  const dest = fs.mkdtempSync(path.join(os.tmpdir(), 'hls003-'));
  fs.cpSync(path.join(FIXTURE_DIR, 'cheer'), dest, { recursive: true });

  let touched = 0;
  const walk = (dir: string) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(p);
      else if (entry.name === 'nodes.json') {
        const file = JSON.parse(fs.readFileSync(p, 'utf8'));
        let changed = false;
        for (const node of file.nodes ?? []) {
          if (!node.parameters || !('runOnChange-condition' in node.parameters)) continue;
          if (answer === 'absent') delete node.parameters['runOnChange-condition'];
          else node.parameters['runOnChange-condition'] = answer;
          changed = true;
          touched++;
        }
        if (changed) fs.writeFileSync(p, JSON.stringify(file, null, 2));
      }
    }
  };
  walk(path.join(dest, 'components'));

  // 🔴 The arms are only comparable if each one actually said something. A fixture that stopped
  // carrying the parameter would make all three identical and every assertion below vacuous.
  if (touched !== 2) throw new Error(`cheer no longer carries two runOnChange-condition keys (found ${touched})`);
  return dest;
}

describe('HLS-003 — the export reads the graph the author saw', () => {
  describe('the corpus, and what a zero in it means', () => {
    it('🔴 control: the sweep reached the corpus, and the instrument is live in it', () => {
      const projects = fixtureProjects();
      // Not an incidental assertion. Every "no disagreement" reading below is worth nothing if the
      // sweep enumerated nothing, and a familyNodes total of zero would mean the migration's node
      // table never matched anything — a broken instrument reporting the answer you wanted.
      expect(projects.length).toBeGreaterThan(40);
      const totalFamily = projects.reduce((sum, p) => sum + readingOf(path.join(FIXTURE_DIR, p)).familyNodes, 0);
      expect(totalFamily).toBeGreaterThan(0);
    });

    it('🔴 AC3 presence control: at least one real project exercises the seam, with a non-zero reading', () => {
      const readings = fixtureProjects().map((p) => ({ project: p, ...readingOf(path.join(FIXTURE_DIR, p)) }));
      const exercising = readings.filter((r) => r.writes > 0);

      // Without this, every zero below is `all([])` — the answer you wanted rather than the one
      // the corpus gave. Measured 2026-09-09: page-desk (2) and variable-dial (1).
      expect(exercising.length).toBeGreaterThan(0);
      for (const r of exercising) expect(r.familyNodes).toBeGreaterThan(0);
    });

    it('AC2: every project that exercises the seam is settled, and the export says which', () => {
      for (const name of fixtureProjects()) {
        const dir = path.join(FIXTURE_DIR, name);
        const reading = readingOf(dir);
        const settled = irOf(dir).project.settledRunOnValueChange;

        // The exporter's settle and an independent read of the same files agree on the count. Two
        // callers of one migration, not one caller agreeing with itself.
        expect({ project: name, settled: settled.length }).toEqual({ project: name, settled: reading.writes });

        // 🔴 Stated as the report states it: a zero is "this project does not exercise the seam".
        if (reading.writes === 0) continue;
        for (const write of settled) {
          expect(write.parameter).toBe(`runOnChange-${write.input}`);
          expect(write.component.length).toBeGreaterThan(0);
        }
      }
    });
  });

  describe('the three arms', () => {
    it('AC1: a project the editor never saved exports as if it had been — byte for byte', () => {
      const absent = appOf(armOf('absent'));
      const settled = appOf(armOf(false));

      // The whole claim, in one assertion: reading a file that omits the key produces exactly the
      // **code** that reading the migrated file produces. Not "similar", and not "the report
      // explains the difference" — the same bytes, in every generated file.
      const codeOnly = (app: typeof absent) => {
        const { [REPORT_PATH]: _report, ...code } = app.files;
        return code;
      };
      expect(codeOnly(absent)).toEqual(codeOnly(settled));

      // 🔴 And the report is the one file that is *required* to differ. An export that read the
      // files one way and said nothing about it would be the silent half of this defect wearing
      // the fix's clothes — so the identity above is only correct beside this inequality.
      expect(absent.files[REPORT_PATH]).not.toEqual(settled.files[REPORT_PATH]);
    });

    it('🔴 AC4 mutant: without the settle the difference reappears, and pages stop being translated', () => {
      const absent = appOf(armOf('absent'));
      const mutant = appOf(armOf(true));

      // The mutant is the pre-HLS-003 exporter: an absent key read literally is a ticked box.
      expect(mutant.files).not.toEqual(absent.files);

      // And it reappears as refusals, which is the shape that costs an author real work.
      const refusalsOf = (app: typeof absent) =>
        app.report.components.flatMap((c) => (c.refusals ?? []).map((r) => `${c.path}:${r.nodeId}`)).sort();
      const gained = refusalsOf(mutant).filter((r) => !refusalsOf(absent).includes(r));
      expect(gained.length).toBeGreaterThan(0);
    });

    it('🔴 the settle fills an absence and never overwrites the author', () => {
      // If it clobbered a stated value this would collapse into the `absent` arm. A migration that
      // is louder than the author is a worse defect than the one it repairs — the same rule the
      // migration itself states as "already present is never touched, whatever its value".
      const mutantIr = irOf(armOf(true));
      expect(mutantIr.project.settledRunOnValueChange).toEqual([]);

      const settledIr = irOf(armOf(false));
      expect(settledIr.project.settledRunOnValueChange).toEqual([]);

      const absentIr = irOf(armOf('absent'));
      expect(absentIr.project.settledRunOnValueChange.map((w) => w.parameter)).toEqual([
        'runOnChange-condition',
        'runOnChange-condition'
      ]);
    });

    it('the export says where it did not read the files literally', () => {
      const absent = appOf(armOf('absent'));
      const report = absent.files[REPORT_PATH];

      expect(report).toContain('Where this export did not read your files literally');
      // 🔴 The sentence has to survive being read by someone who does not know what a patch pass
      // is, and has to say the export followed the canvas rather than that something went wrong.
      expect(report).toContain('This export followed the canvas');
      expect(report).toContain('Nothing was written back to your project');

      // And it is provenance, not a task: the settle must not manufacture a next step.
      expect(report).not.toMatch(/\d\.\s+\*\*Settle the/);

      // A project that does not exercise the seam says nothing at all.
      expect(appOf(armOf(false)).files[REPORT_PATH]).not.toContain(
        'Where this export did not read your files literally'
      );
    });
  });
});
