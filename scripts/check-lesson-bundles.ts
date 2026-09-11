#!/usr/bin/env ts-node
/**
 * FIX-027 — npm run lessons:check
 *
 * A gate over the lesson bundles that actually ship, under
 * `project-examples/lessons/<slug>/`. Each bundle is checked three ways:
 *
 *   1. `lesson.json` parses and verifies against the node catalog
 *      (`verifyLessonManifest` — the F1 "unreachable condition" class).
 *   2. The **starter** project (the bundle root) loads and the SUB-006 semantic
 *      validator reports nothing.
 *   3. The **solution/** project does the same.
 *
 * WHY THIS EXISTS
 * ---------------
 * Bug 18 of the 0.2.0 pass: a shipped lesson (`state-on-a-page`) reached a
 * learner carrying 26 diagnostics — 20 warnings and 6 errors — that the learner
 * had no way to fix, because they were in the lesson's own graph rather than in
 * anything the lesson asked them to build. Nothing in `scripts/` or
 * `.github/` looked at `project-examples/` at all; the only thing referencing it
 * was the comment-legibility scanner. The defect was found by a person opening
 * the lesson.
 *
 * This is the fourth time in this repo that a checker existed and had never been
 * pointed at the corpus that ships. The rule it keeps re-teaching: a suite green
 * on fixtures says nothing about the artefacts on disk.
 *
 * 🔴 WARNINGS FAIL THIS GATE, AND THAT IS DELIBERATE
 * ---------------------------------------------------
 * `library:check` — the sibling gate this is modelled on — fails only on
 * *errors*, and its own module comment records what that cost: `unknownNodeType`
 * is `severity: warning` unless `--strict`, so the gate reported **58/58 clean**
 * while nine shipped prefab nodes had no type at all. That is not a hypothetical
 * here: an unknown node type in a lesson graph is exactly a bug-18 diagnostic,
 * and it arrives as a warning. Gating on errors alone would have left a hole
 * shaped precisely like the defect this gate was written for.
 *
 * The leniency `library:check` needs does not apply to this corpus either. Its
 * content was seeded wholesale from the live docs-site library and is somebody
 * else's to repair; a lesson bundle is authored in this repo, deliberately, and
 * the learner opens it in the editor — where a warning draws a ⚠ badge on the
 * canvas they are being taught to read. A lesson whose own graph is flagged is
 * teaching the wrong thing whatever the severity says.
 *
 * Measured 2026-08-21: `log-a-thing` reports **0 diagnostics** in both its
 * starter and its solution, and **0 manifest findings**. The strict bar is the
 * bar the corpus already meets, not an aspiration.
 *
 * ⚠️ The one exception is `deprecated-node-type`, the only warning-severity
 * manifest finding. A deprecated type still resolves and the lesson still runs,
 * so it is reported and counted but does not fail. Every other manifest finding
 * class is already `error`.
 *
 * 🔴 `knownCollections` IS DELIBERATELY NOT SUPPLIED — DO NOT "FIX" THAT
 * ----------------------------------------------------------------------
 * `verifyLessonManifest` can also check that every collection a condition names
 * is one the starter or solution actually creates. It only does so when the
 * caller supplies the population, and this caller does not. That is correct, and
 * it is not an oversight to tidy up:
 *
 *   - Omitted and supplied-empty are different answers. Omitted skips the check;
 *     an explicit `[]` is read as evidence that the bundle creates no collections
 *     at all, and would fire `unreachable-collection` against every correct data
 *     lesson — including `log-a-thing`, whose whole subject is a `LogEntries`
 *     collection the learner makes by hand. `asked − answered = absent`;
 *     `everything − answered` is a lie.
 *   - Reading a bundle's collections properly is TUT-002 AC3, which is open and
 *     has a trap of its own recorded against it (`BackendManager.getRecordCount`
 *     ends `return result.count || 0`, so an unreadable table reads as zero rows).
 *     Supplying a half-derived list from here would ratify that conflation in a
 *     second place.
 *
 * When AC3 lands and can hand over a real collection list, this is the caller to
 * wire it into.
 *
 * ✅ GRADED BY `--self-test`, WHICH IS WHY THE STRICT BAR CAN BE TRUSTED
 * ----------------------------------------------------------------------
 * A gate reporting "0 problems" over a corpus of one is indistinguishable from a
 * gate that is not looking, and this repo has shipped that exact artefact more
 * than once. `--self-test` copies the real bundle to a temp directory, breaks it
 * six ways, and requires each break to be caught — so the clean result above is
 * a measurement rather than a hope. It mutates a COPY: the shipped corpus is
 * never written to.
 *
 * The mutations derive from the bundle that actually ships rather than from a
 * hand-written fixture, deliberately. A synthetic lesson can be missing a field
 * the code under test reads, and then a spec fails — or passes — for a reason
 * that has nothing to do with the property being graded.
 *
 * Usage:
 *   npm run lessons:check
 *   npm run lessons:check:self-test
 *   ts-node -P ./scripts/tsconfig.json ./scripts/check-lesson-bundles.ts [--json]
 *   ts-node -P ./scripts/tsconfig.json ./scripts/check-lesson-bundles.ts --self-test
 *
 * Exit codes: 0 = clean, 1 = a bundle has findings, 2 = usage/IO error.
 */
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import { SemanticValidator } from '../packages/noodl-editor/src/editor/src/validation';
import { loadProject } from '../packages/noodl-editor/src/editor/src/validation/loadV2Project';
import { projectLessonVocabulary, verifyLessonManifest } from '../packages/noodl-editor/src/editor/src/models/lessonverify';
import type { LessonFinding } from '../packages/noodl-editor/src/editor/src/models/lessonverify';

const REPO_ROOT = path.resolve(__dirname, '..');
const LESSONS_DIR = path.join(REPO_ROOT, 'project-examples', 'lessons');

const json = process.argv.includes('--json');

/** The only warning-severity manifest finding; see the module note. */
const NON_FATAL_MANIFEST_CODES = new Set(['deprecated-node-type']);

interface ProjectReading {
  /** `starter` or `solution` — the label used in output. */
  which: string;
  components: number;
  nodes: number;
  problems: string[];
}

interface BundleReading {
  slug: string;
  problems: string[];
  /** Reported, never gated. */
  notes: string[];
  projects: ProjectReading[];
  manifestFindings: number;
}

function describe(finding: LessonFinding): string {
  const suggestion = finding.suggestion ? ` (did you mean "${finding.suggestion}"?)` : '';
  return `lesson.json — ${finding.where}: ${finding.message}${suggestion}`;
}

/**
 * Validate one project directory. Returns its problems plus the cardinality it
 * covered — a checker that reports "no problems" over an empty read is the
 * failure mode this whole file exists to avoid, so the counts are printed
 * whether or not anything was found.
 */
function readProject(validator: SemanticValidator, dir: string, which: string): ProjectReading {
  const reading: ProjectReading = { which, components: 0, nodes: 0, problems: [] };

  let project: ReturnType<typeof loadProject>;
  try {
    project = loadProject(dir);
  } catch (err) {
    reading.problems.push(`${which} — will not load: ${(err as Error).message}`);
    return reading;
  }

  const components = (project as { components?: unknown[] }).components ?? [];
  reading.components = components.length;
  for (const component of components as Array<{ nodes?: unknown[] }>) {
    reading.nodes += (component.nodes ?? []).length;
  }

  // 🔴 A lesson project with no components loaded is not a clean project, it is
  // an unread one, and it would otherwise score identically to a perfect bundle.
  if (reading.components === 0) {
    reading.problems.push(`${which} — loaded, but contains no components. A lesson project cannot be empty.`);
    return reading;
  }

  const report = validator.validate(project, {});
  for (const diagnostic of report.diagnostics) {
    reading.problems.push(`${which} — ${diagnostic.severity} ${diagnostic.code}: ${diagnostic.message}`);
  }
  return reading;
}

function checkBundle(validator: SemanticValidator, slug: string, dir: string): BundleReading {
  const bundle: BundleReading = { slug, problems: [], notes: [], projects: [], manifestFindings: 0 };

  // ── 1. the manifest ──────────────────────────────────────────────────────
  let manifest: unknown;
  try {
    manifest = JSON.parse(fs.readFileSync(path.join(dir, 'lesson.json'), 'utf8'));
  } catch (err) {
    bundle.problems.push(`lesson.json — will not parse: ${(err as Error).message}`);
    return bundle;
  }

  // `knownCollections` is deliberately omitted — see the module note.
  const report = verifyLessonManifest(manifest as never, { vocabulary: projectLessonVocabulary() });
  bundle.manifestFindings = report.findings.length;
  for (const finding of report.findings) {
    if (NON_FATAL_MANIFEST_CODES.has(finding.code)) bundle.notes.push(describe(finding));
    else bundle.problems.push(describe(finding));
  }

  // ── 2. the starter, at the bundle root ───────────────────────────────────
  const starter = readProject(validator, dir, 'starter');
  bundle.projects.push(starter);
  bundle.problems.push(...starter.problems);

  // ── 3. the solution ──────────────────────────────────────────────────────
  const solutionDir = path.join(dir, 'solution');
  if (!fs.existsSync(path.join(solutionDir, 'nodegx.project.json'))) {
    // Not a nicety: the solution is what the bundle harness replays conditions
    // against, so a bundle without one cannot be graded by anything at all.
    bundle.problems.push('solution/ — missing. A bundle without a solution project cannot be verified.');
    return bundle;
  }
  const solution = readProject(validator, solutionDir, 'solution');
  bundle.projects.push(solution);
  bundle.problems.push(...solution.problems);

  return bundle;
}

function main(lessonsDir: string = LESSONS_DIR): number {
  if (!fs.existsSync(lessonsDir)) {
    console.error(`lessons:check — ${path.relative(REPO_ROOT, lessonsDir)} does not exist.`);
    return 2;
  }

  const slugs = fs
    .readdirSync(lessonsDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .filter((slug) => fs.existsSync(path.join(lessonsDir, slug, 'lesson.json')))
    .sort();

  // 🔴 An empty corpus exits 2, never 0. A gate that goes green when it found
  // nothing to check is indistinguishable from one that checked everything and
  // approved it — and this corpus has moved directory once already.
  if (slugs.length === 0) {
    console.error(
      `lessons:check — no lesson bundles found under ${path.relative(REPO_ROOT, lessonsDir)}. ` +
        `Expected at least one <slug>/lesson.json. If the bundles moved, this gate must move with them.`
    );
    return 2;
  }

  const validator = new SemanticValidator();
  const bundles = slugs.map((slug) => checkBundle(validator, slug, path.join(lessonsDir, slug)));

  if (json) {
    console.log(JSON.stringify({ bundles }, null, 2));
    return bundles.some((b) => b.problems.length) ? 1 : 0;
  }

  let components = 0;
  let nodes = 0;
  for (const bundle of bundles) {
    for (const project of bundle.projects) {
      components += project.components;
      nodes += project.nodes;
    }
  }

  for (const bundle of bundles) {
    const scope = bundle.projects.map((p) => `${p.which} ${p.components}c/${p.nodes}n`).join(', ');
    if (bundle.problems.length === 0) {
      console.log(`✔ ${bundle.slug} — clean (${scope || 'no project read'})`);
    } else {
      console.log(`✘ ${bundle.slug} — ${bundle.problems.length} problem(s) (${scope || 'no project read'})`);
      for (const problem of bundle.problems) console.log(`    ${problem}`);
    }
    for (const note of bundle.notes) console.log(`    note: ${note}`);
  }

  const failed = bundles.filter((b) => b.problems.length).length;
  console.log(
    `\n${bundles.length} lesson bundle(s), ${bundles.length * 2} project(s) expected, ` +
      `${components} component(s) and ${nodes} node(s) validated.`
  );

  if (failed) {
    console.error(
      `\nlessons:check FAILED — ${failed} of ${bundles.length} bundle(s) have problems.\n` +
        `These are diagnostics in the lesson's OWN graph: a learner opening this lesson sees them ` +
        `on the canvas and has no way to fix them, because the lesson never asked them to build it.`
    );
    return 1;
  }

  console.log('lessons:check — every shipped lesson bundle is clean.');
  return 0;
}


// ─── the self-test ──────────────────────────────────────────────────────────

interface Mutation {
  name: string;
  /** Applied to a throwaway copy of the corpus. */
  apply: (corpus: string, slug: string) => void;
  /** A substring the failure MUST contain — the arm this mutation is aimed at. */
  expect: string;
}

function editJson(file: string, edit: (value: unknown) => void): void {
  const value = JSON.parse(fs.readFileSync(file, 'utf8'));
  edit(value);
  fs.writeFileSync(file, JSON.stringify(value, null, 2));
}

/**
 * One mutation per arm this gate has. Each must be caught; a mutation that
 * still passes is a hole, and the arm it names is the arm that is not working.
 *
 * 🔴 `unknown-node-type` is here because it is the class that defeated the
 * sibling gate — it arrives as a `warning`, and any version of this file that
 * gates on errors alone goes green on it.
 */
const MUTATIONS: Mutation[] = [
  {
    name: 'unknown node type in the solution graph (WARNING severity — the library gate\'s blind spot)',
    apply: (corpus, slug) =>
      editJson(path.join(corpus, slug, 'solution', 'components', 'Pages', 'Home', 'nodes.json'), (doc: unknown) => {
        const nodes = (doc as { nodes: Array<{ type: string }> }).nodes;
        nodes[nodes.length - 1].type = 'NoSuchNodeType';
      }),
    expect: 'solution — warning unknown-node-type'
  },
  {
    name: 'dangling connection in the solution graph',
    apply: (corpus, slug) =>
      editJson(path.join(corpus, slug, 'solution', 'components', 'Pages', 'Home', 'connections.json'), (doc: unknown) => {
        (doc as { connections: Array<{ toId: string }> }).connections[0].toId = 'no_such_node';
      }),
    expect: 'solution — error dangling-connection'
  },
  {
    name: 'unknown node type in the STARTER graph',
    apply: (corpus, slug) =>
      editJson(path.join(corpus, slug, 'components', 'Pages', 'Home', 'nodes.json'), (doc: unknown) => {
        const nodes = (doc as { nodes: Array<{ type: string }> }).nodes;
        nodes[nodes.length - 1].type = 'NoSuchNodeType';
      }),
    expect: 'starter — warning unknown-node-type'
  },
  {
    name: 'lesson.json condition naming a type the catalog does not have',
    apply: (corpus, slug) =>
      editJson(path.join(corpus, slug, 'lesson.json'), (doc: unknown) => {
        const steps = (doc as { steps: Array<{ completeWhen?: Array<{ hasType?: string }> }> }).steps;
        for (const step of steps) {
          for (const condition of step.completeWhen ?? []) {
            if (condition.hasType) condition.hasType = 'NoSuchNodeType';
          }
        }
      }),
    expect: 'lesson.json — Step'
  },
  {
    name: 'lesson.json that does not parse',
    apply: (corpus, slug) => fs.writeFileSync(path.join(corpus, slug, 'lesson.json'), '{ not json'),
    expect: 'lesson.json — will not parse'
  },
  {
    name: 'bundle with no solution/ project',
    apply: (corpus, slug) => fs.rmSync(path.join(corpus, slug, 'solution'), { recursive: true, force: true }),
    expect: 'solution/ — missing'
  }
];

/**
 * Run `main` over a corpus with output suppressed, returning its exit code AND
 * what it said.
 *
 * 🔴 The text matters. A mutation whose harness THREW would exit non-zero too,
 * and would read as "caught" against an exit-code-only assertion — a reading
 * that fits without excluding anything. Each mutation below therefore names the
 * message it expects, so the arm is graded rather than the exit status.
 */
function quietly(dir: string): { code: number; output: string } {
  const log = console.log;
  const err = console.error;
  let output = '';
  const capture =
    (...args: unknown[]): void => {
      output += args.map(String).join(' ') + '\n';
    };
  console.log = capture;
  console.error = capture;
  try {
    return { code: main(dir), output };
  } finally {
    console.log = log;
    console.error = err;
  }
}

function selfTest(): number {
  const slug = 'log-a-thing';
  const source = path.join(LESSONS_DIR, slug);
  if (!fs.existsSync(source)) {
    console.error(`lessons:check --self-test — ${slug} is not in the corpus; nothing to derive mutations from.`);
    return 2;
  }

  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'lessons-selftest-'));
  const failures: string[] = [];
  try {
    // The control comes FIRST. A control that is already red makes every
    // mutation below look caught while proving nothing about any of them.
    const control = path.join(root, 'control');
    fs.mkdirSync(control, { recursive: true });
    fs.cpSync(source, path.join(control, slug), { recursive: true });
    const controlRun = quietly(control);
    if (controlRun.code !== 0) {
      console.error(`✘ CONTROL — an unmutated copy of ${slug} exits ${controlRun.code}, not 0. The rest is meaningless.`);
      console.error(controlRun.output);
      return 1;
    }
    console.log(`✔ control — unmutated ${slug} passes`);

    MUTATIONS.forEach((mutation, index) => {
      const corpus = path.join(root, `mutation-${index}`);
      fs.mkdirSync(corpus, { recursive: true });
      fs.cpSync(source, path.join(corpus, slug), { recursive: true });
      mutation.apply(corpus, slug);
      const run = quietly(corpus);
      if (run.code === 0) {
        failures.push(mutation.name);
        console.log(`✘ NOT CAUGHT — ${mutation.name}`);
      } else if (!run.output.includes(mutation.expect)) {
        // Non-zero for the WRONG reason is not a catch. This is the arm that
        // separates "the gate found it" from "the harness fell over".
        failures.push(mutation.name);
        console.log(`✘ WRONG REASON — ${mutation.name}`);
        console.log(`    expected the report to contain: ${mutation.expect}`);
        console.log(`    got: ${run.output.trim().split('\n').join(' | ')}`);
      } else {
        console.log(`✔ caught (exit ${run.code}) — ${mutation.name}`);
      }
    });

    // The empty corpus is checked separately: it is the one case whose correct
    // answer is 2 rather than 1, and a gate that returns 0 here would approve a
    // corpus it never found.
    const empty = path.join(root, 'empty');
    fs.mkdirSync(empty, { recursive: true });
    const emptyRun = quietly(empty);
    if (emptyRun.code === 2 && emptyRun.output.includes('no lesson bundles found')) {
      console.log('✔ caught (exit 2) — an empty corpus refuses rather than passing');
    } else {
      failures.push('an empty corpus refuses rather than passing');
      console.log(`✘ NOT CAUGHT — an empty corpus exits ${emptyRun.code}, expected 2`);
    }
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }

  if (failures.length) {
    console.error(`\nlessons:check --self-test FAILED — ${failures.length} mutation(s) went unnoticed.`);
    return 1;
  }
  console.log(`\nlessons:check --self-test — control green, all ${MUTATIONS.length + 1} mutations caught.`);
  return 0;
}

process.exit(process.argv.includes('--self-test') ? selfTest() : main());
