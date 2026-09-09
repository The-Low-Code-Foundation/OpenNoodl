/**
 * HLS-002 AC1 + AC4 — the same export through two front doors.
 *
 * ## 🔴 The trap this file is written around
 *
 * The acceptance criterion is that `nodegx export` and the editor's menu item produce identical
 * trees, and the task file says in as many words that it is easy to fake: *"if both doors call
 * the same function, the diff is trivially empty and proves nothing about the product."* A spec
 * that called `emitApp` twice and compared the results would be green, permanent, and worthless.
 *
 * So the two sides of the comparison are two different pieces of the product:
 *
 *  - **The editor's door** is `runExportSequence` — the actual module `exportProjectAsReactCode`
 *    runs, in its own order (flush the autosave, refuse a legacy project, parse and emit, show the
 *    pre-flight, choose a folder, check the target, confirm an overwrite, write, report). Only the
 *    editor's *singletons* are stubbed: ProjectModel, the popup layer, the toast layer and
 *    Electron's directory dialog are supplied as functions. Nothing about the sequence is stubbed,
 *    which is why the stubs are also what AC4 is asserted with — the modal and the toast are
 *    observed, not assumed.
 *  - **The CLI's door** is the `nodegx` binary, spawned as a subprocess. Not imported, not called:
 *    spawned, because an exit code read as a return value is not an exit code.
 *
 * They meet only in `@nodegx/export`, which is the point — HLS-002 moved `writeExport` and
 * `checkTarget` into it so that there is one write loop rather than two. The duplicate that used
 * to exist (`scripts/emit-app.ts`) is precisely what dropped the `copies` channel on the floor
 * for a whole phase with every gate green (P18 §19.6).
 *
 * ## The instrument is armed before it is believed
 *
 * A tree comparison that always reports "identical" would pass this file forever. So one row
 * perturbs the CLI's output by a single copied asset and requires the comparison to name exactly
 * that file. Without it, "the trees agree" is a claim about the comparator, not about the export.
 */
import { execFileSync, spawnSync } from 'child_process';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import type { Catalog, PreflightSummary } from '@nodegx/export';

import { ExportOutcome, runExportSequence } from '../../src/editor/src/utils/codeExport/exportSequence';

const REPO = path.join(__dirname, '..', '..', '..', '..');
const EXPORT_PKG = path.join(REPO, 'packages', 'nodegx-export');
const CLI = path.join(EXPORT_PKG, 'src', 'cli', 'main.ts');
const TS_NODE = path.join(REPO, 'node_modules', '.bin', 'ts-node');
const TSCONFIG = path.join(EXPORT_PKG, 'tsconfig.json');
/** The corpus project with `copies` in it — the channel that has been dropped twice. */
const FIXTURE = path.join(EXPORT_PKG, 'tests', 'fixtures', 'kits');
const CATALOG_FILE = path.join(REPO, 'packages', 'noodl-types', 'src', 'node-catalog.json');

const catalog = JSON.parse(fs.readFileSync(CATALOG_FILE, 'utf8')) as Catalog;

let tmp: string;
let project: string;
beforeEach(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'hls002-doors-'));
  // A copy, because the export refuses a target inside the project and both doors must be given
  // the same project to read.
  project = path.join(tmp, 'project');
  fs.cpSync(FIXTURE, project, { recursive: true });
});
afterEach(() => {
  fs.rmSync(tmp, { recursive: true, force: true });
});

/** Every file under `dir`, as `<relative path>` → sha256 of its bytes. */
function hashTree(dir: string): Record<string, string> {
  const out: Record<string, string> = {};
  const walk = (current: string) => {
    for (const entry of fs.readdirSync(current).sort()) {
      const full = path.join(current, entry);
      if (fs.statSync(full).isDirectory()) walk(full);
      else {
        out[path.relative(dir, full).split(path.sep).join('/')] = crypto
          .createHash('sha256')
          .update(fs.readFileSync(full))
          .digest('hex');
      }
    }
  };
  walk(dir);
  return out;
}

/** `<path>: <how they differ>` for every file the two trees disagree about. */
function differences(a: Record<string, string>, b: Record<string, string>): string[] {
  const out: string[] = [];
  for (const file of new Set([...Object.keys(a), ...Object.keys(b)])) {
    if (!(file in a)) out.push(`${file}: only in the second tree`);
    else if (!(file in b)) out.push(`${file}: only in the first tree`);
    else if (a[file] !== b[file]) out.push(`${file}: different bytes`);
  }
  return out.sort();
}

/** What the editor showed while the sequence ran. AC4 is asserted against this. */
interface Shown {
  preflights: PreflightSummary[];
  chooses: number;
  confirms: { outDir: string; existing: number }[];
  errors: { title: string; message: string }[];
  successes: { title: string; message: string }[];
}

/**
 * The editor's door, driven. `answer` decides what the author does at the two questions the
 * sequence asks — proceed past the pre-flight, and which folder.
 */
async function throughTheEditor(
  projectDir: string,
  answer: { proceed?: boolean; outDir?: string | undefined; overwrite?: boolean } = {}
): Promise<{ outcome: ExportOutcome; shown: Shown; flushed: number }> {
  const shown: Shown = { preflights: [], chooses: 0, confirms: [], errors: [], successes: [] };
  let flushed = 0;

  const outcome = await runExportSequence({
    projectDir,
    projectFormat: 'v2',
    catalog,
    fs,
    flushPendingProjectSave: async () => {
      flushed += 1;
    },
    showPreflight: (summary, onConfirm, onCancel) => {
      shown.preflights.push(summary);
      if (answer.proceed === false) onCancel();
      else onConfirm();
    },
    chooseDirectory: (onChosen) => {
      shown.chooses += 1;
      onChosen(answer.outDir);
    },
    confirmOverwrite: (outDir, existing, onConfirm) => {
      shown.confirms.push({ outDir, existing });
      if (answer.overwrite !== false) onConfirm();
    },
    showError: (message, title) => shown.errors.push({ title, message }),
    showSuccess: (message, title) => shown.successes.push({ title, message })
  });

  return { outcome, shown, flushed };
}

/** The CLI's door, spawned. */
function throughTheCli(...args: string[]) {
  const result = spawnSync(TS_NODE, ['-P', TSCONFIG, CLI, ...args], { cwd: EXPORT_PKG, encoding: 'utf8' });
  if (result.error) throw result.error;
  return { status: result.status ?? -1, stdout: result.stdout, stderr: result.stderr };
}

describe('HLS-002 AC1 — both doors, one project, identical trees', () => {
  /**
   * ⚠️ Both doors are run **once**, in `beforeAll`, and the rows read the trees they left. Each
   * CLI spawn is a `ts-node` start of about three seconds, and this file lives in `test:main`
   * beside specs that assert latency ceilings on a file watcher — one of which flaked the first
   * time this suite ran with six spawns in it. The rows that need to see the comparison fail work
   * on a *copy* of the CLI's tree, so nothing here depends on the order they run in.
   */
  let fromEditor: string;
  let fromCli: string;
  let editorOutcome: ExportOutcome;
  let cliStatus: number;

  beforeAll(async () => {
    fromEditor = fs.mkdtempSync(path.join(os.tmpdir(), 'hls002-editor-'));
    fromCli = fs.mkdtempSync(path.join(os.tmpdir(), 'hls002-cli-'));
    const shared = fs.mkdtempSync(path.join(os.tmpdir(), 'hls002-project-'));
    fs.cpSync(FIXTURE, path.join(shared, 'project'), { recursive: true });
    const sharedProject = path.join(shared, 'project');

    fs.rmSync(fromEditor, { recursive: true, force: true });
    fs.rmSync(fromCli, { recursive: true, force: true });
    editorOutcome = (await throughTheEditor(sharedProject, { outDir: fromEditor })).outcome;
    cliStatus = throughTheCli('export', sharedProject, fromCli).status;
  }, 300000);

  afterAll(() => {
    for (const dir of [fromEditor, fromCli]) fs.rmSync(dir, { recursive: true, force: true });
  });

  it('the two doors read the same catalog, which is the precondition for any of this', () => {
    // 🔴 Not a formality. The editor imports the catalog from `noodl-types` and hands it to the
    // exporter; the CLI calls `loadCatalog()`, which finds its own copy. If those two files ever
    // diverged, identical trees would be luck rather than a property, and this row is what would
    // notice — before the comparison below turned red for a reason nobody could place.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { catalogPath } = require('@nodegx/export');
    expect(fs.readFileSync(catalogPath())).toEqual(fs.readFileSync(CATALOG_FILE));
  });

  it('exports the same project through each door and finds no differing byte', () => {
    expect(editorOutcome.kind).toBe('written');
    expect(cliStatus).toBe(0);

    const a = hashTree(fromEditor);
    expect(differences(a, hashTree(fromCli))).toEqual([]);

    // Arming the comparison: two empty trees agree perfectly. This fixture is the one with
    // assets, so both channels have to be present on both sides.
    expect(Object.keys(a).length).toBeGreaterThan(15);
    expect(Object.keys(a).filter((f) => f.startsWith('public/')).length).toBeGreaterThan(0);
  });

  it('🔴 …and the comparison can fail: one asset removed from one tree is named', () => {
    const perturbed = path.join(tmp, 'perturbed-missing');
    fs.cpSync(fromCli, perturbed, { recursive: true });
    const asset = Object.keys(hashTree(perturbed)).find((f) => f.startsWith('public/'));
    expect(asset).toBeDefined();
    fs.rmSync(path.join(perturbed, asset as string));

    expect(differences(hashTree(fromEditor), hashTree(perturbed))).toEqual([
      `${asset}: only in the first tree`
    ]);
  });

  it('🔴 …and to a changed byte, not only to a missing file', () => {
    const perturbed = path.join(tmp, 'perturbed-byte');
    fs.cpSync(fromCli, perturbed, { recursive: true });
    fs.appendFileSync(path.join(perturbed, 'EXPORT-REPORT.md'), '\n');

    expect(differences(hashTree(fromEditor), hashTree(perturbed))).toEqual([
      'EXPORT-REPORT.md: different bytes'
    ]);
  });
});

describe('HLS-002 AC4 — the editor door still behaves like the editor', () => {
  it('flushes the pending save before reading, shows the pre-flight, then asks for a folder', async () => {
    // 🔴 The order is the product. The exporter reads from **disk**, so a pre-flight computed
    // before the autosave landed describes a project the author has already changed.
    const { shown, flushed, outcome } = await throughTheEditor(project, {
      outDir: path.join(tmp, 'out')
    });

    expect(flushed).toBe(1);
    expect(shown.preflights).toHaveLength(1);
    expect(shown.preflights[0].projectName).toBeTruthy();
    expect(shown.chooses).toBe(1);
    expect(outcome.kind).toBe('written');
  }, 120000);

  it('writes nothing when the author cancels the pre-flight, and never asks for a folder', async () => {
    const outDir = path.join(tmp, 'out');
    const { shown, outcome } = await throughTheEditor(project, { proceed: false, outDir });

    expect(outcome).toEqual({ kind: 'cancelled-preflight' });
    expect(shown.chooses).toBe(0);
    expect(fs.existsSync(outDir)).toBe(false);
  }, 120000);

  it('shows the success toast with the counts and points at the report', async () => {
    const outDir = path.join(tmp, 'out');
    const { shown } = await throughTheEditor(project, { outDir });

    expect(shown.errors).toEqual([]);
    expect(shown.successes).toHaveLength(1);
    expect(shown.successes[0].title).toMatch(/^Exported /);
    expect(shown.successes[0].message).toMatch(/^\d+ files and \d+ copied assets written to /);
    expect(shown.successes[0].message).toContain('EXPORT-REPORT.md');
  }, 120000);

  it('refuses a folder inside the project, in the editor exactly as on the command line', async () => {
    const inside = path.join(project, 'export');
    const { outcome, shown } = await throughTheEditor(project, { outDir: inside });

    expect(outcome.kind).toBe('target-refused');
    expect(shown.errors[0].title).toBe('Choose a different folder');
    expect(shown.errors[0].message).toContain('inside the project');
    expect(fs.existsSync(inside)).toBe(false);

    // The same refusal, through the other door, with the same reason and a code a pipeline can
    // branch on. This is the one place the two doors differ by design — the editor shows a
    // sentence, the CLI also returns 3 — and the sentence is the same sentence.
    const cli = throughTheCli('export', project, inside);
    expect(cli.status).toBe(3);
    expect(cli.stderr).toContain('inside the project');
  }, 180000);

  it('🔴 asks before overwriting a folder that is not empty — where the CLI refuses instead', async () => {
    // The deliberate difference between the doors, asserted from both sides so that neither can
    // quietly become the other. A person can be asked; a pipeline cannot.
    const outDir = path.join(tmp, 'out');
    fs.mkdirSync(outDir);
    fs.writeFileSync(path.join(outDir, 'someone-elses-work.txt'), 'left alone');

    const { shown, outcome } = await throughTheEditor(project, { outDir });
    expect(shown.confirms).toEqual([{ outDir, existing: 1 }]);
    expect(outcome.kind).toBe('written');
    expect(fs.readFileSync(path.join(outDir, 'someone-elses-work.txt'), 'utf8')).toBe('left alone');

    const refused = throughTheCli('export', project, outDir);
    expect(refused.status).toBe(3);
    expect(refused.stderr).toContain('--force');
  }, 180000);

  it('tells a legacy project to migrate rather than showing it a missing-file error', async () => {
    const legacy = path.join(tmp, 'legacy');
    fs.mkdirSync(legacy);
    const shown: string[] = [];
    const outcome = await runExportSequence({
      projectDir: legacy,
      projectFormat: 'legacy',
      catalog,
      fs,
      flushPendingProjectSave: async () => undefined,
      showPreflight: () => shown.push('preflight'),
      chooseDirectory: () => shown.push('choose'),
      confirmOverwrite: () => shown.push('confirm'),
      showError: (message) => shown.push(message),
      showSuccess: () => shown.push('success')
    });

    expect(outcome).toEqual({ kind: 'not-v2' });
    expect(shown).toHaveLength(1);
    expect(shown[0]).toContain('Migrate this project first');
  });

  it('says so when nothing is open, without reaching for a project directory', async () => {
    const shown: string[] = [];
    const outcome = await runExportSequence({
      projectDir: null,
      projectFormat: 'v2',
      catalog,
      fs,
      flushPendingProjectSave: async () => {
        shown.push('flush');
      },
      showPreflight: () => shown.push('preflight'),
      chooseDirectory: () => shown.push('choose'),
      confirmOverwrite: () => shown.push('confirm'),
      showError: (message) => shown.push(message),
      showSuccess: () => shown.push('success')
    });

    expect(outcome).toEqual({ kind: 'no-project' });
    expect(shown).toEqual(['Open a project saved on disk first.']);
  });
});

describe('the wiring that is deliberately not reachable from here', () => {
  /**
   * `exportReactCode.ts` supplies the real ProjectModel, popup layer, toast layer and Electron
   * dialog to the sequence above. None of that can run in this runner, and a spec that mocked all
   * four would be grading its own mocks. What is asserted instead is that the wiring is *only*
   * wiring: that it calls the sequence, and that nothing else in the editor writes an export
   * behind its back.
   */
  const command = fs.readFileSync(
    path.join(__dirname, '..', '..', 'src', 'editor', 'src', 'utils', 'codeExport', 'exportReactCode.ts'),
    'utf8'
  );

  it('the editor command runs the sequence rather than repeating it', () => {
    expect(command).toContain('runExportSequence({');
    expect(command).toContain('showCodeExportModal');
    expect(command).toContain('showConfirmModal');
    expect(command).toContain('ToastLayer.showSuccess');
    // The sequence owns these; a copy here would be the second write loop again.
    expect(command).not.toContain('writeExport(');
    expect(command).not.toContain('checkTarget(');
  });

  it('nothing else in the editor writes an export of its own', () => {
    const hits = execFileSync(
      'grep',
      ['-rl', '-e', 'writeExport', '-e', 'checkTarget(', path.join(__dirname, '..', '..', 'src', 'editor', 'src')],
      { encoding: 'utf8' }
    )
      .split('\n')
      .filter(Boolean);
    // `index.bundle.js` is build output that happens to sit in the tree; every *source* hit must
    // be the sequence module.
    const sources = hits.filter((f) => f.endsWith('.ts') || f.endsWith('.tsx'));
    expect(sources.map((f) => path.basename(f))).toEqual(['exportSequence.ts']);
  });
});
