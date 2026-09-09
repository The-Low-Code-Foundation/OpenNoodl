/**
 * HLS-002 — `nodegx export`, driven as a process.
 *
 * ## Why every row here is a subprocess
 *
 * `runCli` returns a number and writes through injected writers, so almost everything below could
 * be asserted in-process, faster. It is not, and the reason is HLS-001: three defects in this
 * package survived 86 suites, 439 editor suites, three clean `tsc`s and a green `test:ci`, and
 * what found them was *running the thing* — `import '@nodegx/export'` from an install threw before
 * a line of export code ran. A binary has that exposure and one more, because **nothing in this
 * repo has ever run a `nodegx-export` module as a subprocess**: the editor consumes `src/` through
 * three aliases, and every suite in this package runs under CJS inside jest. An exit code that is
 * only ever read as a return value is not an exit code, and a stream that is only ever read as a
 * string is not stdout.
 *
 * ⚠️ These rows drive `src/cli/main.ts` under `ts-node`, which grades the source in a fresh
 * checkout with nothing built. The *packed* binary — the shebang, the mode bit, the ESM bundle,
 * the catalog that has to travel with it — is graded by `hls002-pack-and-run.test.ts`, which is
 * the row register C44 asks for. Neither replaces the other: this one runs everywhere and sees
 * the behaviour, that one runs the artefact and sees the packaging.
 *
 * ## The exit codes are the deliverable, not a detail
 *
 * In a terminal a wrong exit code is cosmetic — the person reads the sentence. In CI nobody
 * reads the sentence, and the number is the only thing a pipeline can branch on. So each row
 * below provokes **one real cause** and asserts its code; `EXIT` is never inspected as a table of
 * constants, and no two causes are allowed to share a value.
 */
import { spawnSync } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import { EXIT } from '../src/cli/exitCodes';
import { EXPORTER_VERSION } from '../src/parse/parseProject';

const PKG = path.join(__dirname, '..');
const CLI = path.join(PKG, 'src', 'cli', 'main.ts');
const TS_NODE = path.join(PKG, '..', '..', 'node_modules', '.bin', 'ts-node');
const TSCONFIG = path.join(PKG, 'tsconfig.json');
const FIXTURES = path.join(__dirname, 'fixtures');

/** A project with nothing left out, and one with plenty. Both predate this task. */
const CLEAN = path.join(FIXTURES, 'reading-shelf');
const WITH_REFUSALS = path.join(FIXTURES, 'puppy-test-3');
/** The only fixture with `copies`, which is the channel that has been dropped twice. */
const WITH_ASSETS = path.join(FIXTURES, 'kits');

interface Run {
  status: number;
  stdout: string;
  stderr: string;
}

function nodegx(...args: string[]): Run {
  const result = spawnSync(TS_NODE, ['-P', TSCONFIG, CLI, ...args], { cwd: PKG, encoding: 'utf8' });
  if (result.error) throw result.error;
  return { status: result.status ?? -1, stdout: result.stdout, stderr: result.stderr };
}

let tmp: string;
beforeEach(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'hls002-'));
});
afterEach(() => {
  fs.rmSync(tmp, { recursive: true, force: true });
});

/** Every path under `dir`, with its size — the shape of a tree, comparable across two of them. */
function tree(dir: string): Record<string, number> {
  const out: Record<string, number> = {};
  const walk = (current: string) => {
    for (const entry of fs.readdirSync(current)) {
      const full = path.join(current, entry);
      const stat = fs.statSync(full);
      if (stat.isDirectory()) walk(full);
      else out[path.relative(dir, full).split(path.sep).join('/')] = stat.size;
    }
  };
  walk(dir);
  return out;
}

describe('the exit codes, each from its own cause', () => {
  test('the table has no two causes sharing a number', () => {
    // Arming the rows below: they assert `EXIT.x`, and if two of those were the same value the
    // assertions would still pass while telling a pipeline nothing.
    const values = Object.values(EXIT);
    expect(new Set(values).size).toBe(values.length);
  });

  test(`${EXIT.ok} — the export ran`, () => {
    const out = path.join(tmp, 'app');
    const result = nodegx('export', CLEAN, out);
    expect(result.status).toBe(EXIT.ok);
    expect(result.stdout).toMatch(/^\d+ files.* written to /);
    expect(fs.existsSync(path.join(out, 'EXPORT-REPORT.md'))).toBe(true);
  });

  test(`${EXIT.usage} — a command this binary does not have`, () => {
    const result = nodegx('deploy', CLEAN, path.join(tmp, 'app'));
    expect(result.status).toBe(EXIT.usage);
    expect(result.stderr).toContain('There is no `nodegx deploy` command.');
    // 🔴 Nothing was read and nothing was written: a usage error must not have started an export.
    expect(fs.readdirSync(tmp)).toEqual([]);
  });

  test(`${EXIT.project} — there is no folder there`, () => {
    const result = nodegx('export', path.join(tmp, 'nowhere'), path.join(tmp, 'app'));
    expect(result.status).toBe(EXIT.project);
    expect(result.stderr).toContain('There is no folder at');
  });

  test(`${EXIT.project} — a legacy project is told what to do, not shown an ENOENT`, () => {
    // The failure this replaces is `parseProject` throwing
    // `ENOENT: no such file or directory, open '…/nodegx.project.json'` — a file the author has
    // never heard of, named as though they deleted it.
    const legacy = path.join(tmp, 'legacy');
    fs.mkdirSync(legacy);
    fs.writeFileSync(path.join(legacy, 'project.json'), '{}');
    const result = nodegx('export', legacy, path.join(tmp, 'app'));

    expect(result.status).toBe(EXIT.project);
    expect(result.stderr).toContain('legacy project.json');
    expect(result.stderr).toContain('accept the migration it offers');
    expect(result.stderr).not.toContain('ENOENT');
  });

  test(`${EXIT.project} — a folder that is not a project at all`, () => {
    const notAProject = path.join(tmp, 'notes');
    fs.mkdirSync(notAProject);
    fs.writeFileSync(path.join(notAProject, 'README.md'), '#');
    const result = nodegx('export', notAProject, path.join(tmp, 'app'));

    expect(result.status).toBe(EXIT.project);
    expect(result.stderr).toContain('is not a NodeGX project');
  });

  test(`${EXIT.project} — a project file that will not parse, and nothing written`, () => {
    // The one cause of this code that reaches `parseProject` and comes back as a throw.
    const broken = path.join(tmp, 'broken');
    fs.mkdirSync(broken);
    fs.writeFileSync(path.join(broken, 'nodegx.project.json'), '{ "name": ');
    const out = path.join(tmp, 'app');
    const result = nodegx('export', broken, out);

    expect(result.status).toBe(EXIT.project);
    expect(result.stderr).toContain('nothing has been written');
    expect(fs.existsSync(out)).toBe(false);
  });

  test(`${EXIT.target} — a folder inside the project, which the editor would read straight back`, () => {
    const result = nodegx('export', CLEAN, path.join(CLEAN, 'export'));
    expect(result.status).toBe(EXIT.target);
    expect(result.stderr).toContain('inside the project');
    // The refusal has to happen before anything is created, or it has already done the harm.
    expect(fs.existsSync(path.join(CLEAN, 'export'))).toBe(false);
  });

  test(`${EXIT.target} — a folder that already holds something, with nobody to ask`, () => {
    const out = path.join(tmp, 'app');
    fs.mkdirSync(out);
    fs.writeFileSync(path.join(out, 'someone-elses-work.txt'), 'do not overwrite me');

    const result = nodegx('export', CLEAN, out);
    expect(result.status).toBe(EXIT.target);
    expect(result.stderr).toContain('--force');
    // 🔴 The consequence: the folder is exactly as it was.
    expect(fs.readdirSync(out)).toEqual(['someone-elses-work.txt']);
  });

  test(`${EXIT.ok} — …and --force is the answer to that refusal, not a second refusal`, () => {
    // The control for the row above. Without it, "refused" would pass on a binary that refuses a
    // non-empty folder unconditionally, which is a different and worse product.
    const out = path.join(tmp, 'app');
    fs.mkdirSync(out);
    fs.writeFileSync(path.join(out, 'someone-elses-work.txt'), 'left alone');

    const result = nodegx('export', CLEAN, out, '--force');
    expect(result.status).toBe(EXIT.ok);
    expect(fs.existsSync(path.join(out, 'EXPORT-REPORT.md'))).toBe(true);
    // Nothing else in the folder is touched — the sentence the editor's modal makes, kept.
    expect(fs.readFileSync(path.join(out, 'someone-elses-work.txt'), 'utf8')).toBe('left alone');
  });

  test(`${EXIT.refusals} — --dry-run on a project with something it cannot translate`, () => {
    const result = nodegx('export', '--dry-run', WITH_REFUSALS);
    expect(result.status).toBe(EXIT.refusals);
    expect(result.stdout).toContain('## What will not translate');
  });

  test(`${EXIT.ok} — …and --dry-run on a project with nothing left out`, () => {
    // The other half of the pair. A gate that exits 4 for every project is a gate nobody keeps.
    const result = nodegx('export', '--dry-run', CLEAN);
    expect(result.status).toBe(EXIT.ok);
    expect(result.stdout).toContain('Every node and every wire in this project has a translation');
  });

  test(`${EXIT.write} — a write that fails part-way says the folder is now half an app`, () => {
    // A real cause, provoked rather than mocked: `src` is where the export writes its components,
    // and here it is a file, so the first `mkdirSync` under it throws ENOTDIR.
    const out = path.join(tmp, 'app');
    fs.mkdirSync(out);
    fs.writeFileSync(path.join(out, 'src'), 'not a directory');

    const result = nodegx('export', CLEAN, out, '--force');
    expect(result.status).toBe(EXIT.write);
    expect(result.stderr).toContain('will not build');
  });
});

describe('--dry-run writes nothing at all', () => {
  /**
   * 🔴 AC2 is asserted over the **parent** of the output path, not over the absence of the output
   * directory. `expect(existsSync(out)).toBe(false)` passes on a runner that created the folder
   * and removed it again, and it says nothing about a `mkdirSync` two levels up. A directory's
   * mtime moves when a child is created, so the parent's mtime is the cheapest true witness that
   * no entry was ever made.
   */
  test('the output path\'s parent is untouched — mtime and contents both', () => {
    const parent = path.join(tmp, 'workspace');
    fs.mkdirSync(parent);
    fs.writeFileSync(path.join(parent, 'unrelated.txt'), 'x');
    const before = fs.statSync(parent).mtimeMs;
    const contentsBefore = tree(parent);

    const result = nodegx('export', '--dry-run', CLEAN);
    expect(result.stdout).toContain('**Nothing has been written yet.**');

    expect(fs.statSync(parent).mtimeMs).toBe(before);
    expect(tree(parent)).toEqual(contentsBefore);
  });

  test('🔴 the same measurement, armed: a real export into that parent does move it', () => {
    // Without this row the assertion above would pass just as happily on a filesystem whose
    // directory mtimes never move, which is exactly the reading that would make the gate useless
    // and unnoticeable.
    const parent = path.join(tmp, 'workspace');
    fs.mkdirSync(parent);
    fs.writeFileSync(path.join(parent, 'unrelated.txt'), 'x');
    const before = fs.statSync(parent).mtimeMs;
    const contentsBefore = tree(parent);

    const result = nodegx('export', CLEAN, path.join(parent, 'app'));
    expect(result.status).toBe(EXIT.ok);

    expect(fs.statSync(parent).mtimeMs).not.toBe(before);
    expect(tree(parent)).not.toEqual(contentsBefore);
  });
});

describe('what the command says about what it read', () => {
  /**
   * 🔴 The trap this closes: the exporter reads the project from **disk**, and the editor flushes
   * its debounced autosave first because it is the thing holding the unsaved edits. A CLI has no
   * autosave to flush and **no way to detect an editor that does** — there is no lock file, and
   * opening a project writes no marker that says "held". So it states what it read and when that
   * was last written, every run, in both modes. A warning conditional on something this process
   * cannot observe is a warning that never fires.
   */
  test('every run says which folder it read and when that folder was last saved', () => {
    for (const args of [['export', '--dry-run', CLEAN], ['export', CLEAN, path.join(tmp, 'app')]]) {
      const result = nodegx(...args);
      expect(result.stderr).toContain(`Reading ${CLEAN} as it is on disk — last saved `);
      expect(result.stderr).toMatch(/last saved \d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\./);
      expect(result.stderr).toContain('save it first: this reads files, not the editor');
    }
  });

  test('the stamp is the project\'s own newest file, not the time of the run', () => {
    // A stamp that always read "now" would be true of every run and informative about none.
    const copy = path.join(tmp, 'project');
    fs.cpSync(CLEAN, copy, { recursive: true });
    const backThen = new Date('2024-03-04T05:06:07');
    for (const file of Object.keys(tree(copy))) {
      fs.utimesSync(path.join(copy, file), backThen, backThen);
    }

    const result = nodegx('export', '--dry-run', copy);
    expect(result.stderr).toContain('last saved 2024-03-04 05:06:07.');
  });

  test('the summary goes to stdout and everything else to stderr, so a redirect is a clean report', () => {
    const result = nodegx('export', '--dry-run', CLEAN);
    expect(result.stdout.startsWith('# Before you export')).toBe(true);
    // ⚠️ Probed on the provenance sentence, not on the word "Reading" — the fixture is called
    // "Reading Shelf" and the summary's own title contains it. A substring is not a word.
    expect(result.stdout).not.toContain('as it is on disk');
    expect(result.stderr).toContain('as it is on disk');
  });
});

describe('the front matter', () => {
  test('--help names every exit code the binary can return', () => {
    const result = nodegx('--help');
    expect(result.status).toBe(EXIT.ok);
    for (const code of Object.values(EXIT)) {
      expect(result.stdout).toMatch(new RegExp(`^\\s{2}${code}\\s{2}`, 'm'));
    }
  });

  test('--version is the version the package publishes, not a second one', () => {
    // 🔴 Two version strings that can disagree is a lie waiting to happen: the manifest's is what
    // a consumer installs, and `EXPORTER_VERSION` is what the export writes into the app it
    // generates and what this binary prints.
    const manifest = JSON.parse(fs.readFileSync(path.join(PKG, 'package.json'), 'utf8'));
    expect(EXPORTER_VERSION).toBe(manifest.version);
    expect(nodegx('--version').stdout.trim()).toBe(manifest.version);
  });
});
