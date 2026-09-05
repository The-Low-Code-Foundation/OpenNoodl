#!/usr/bin/env ts-node
/**
 * SYL-002 — npm run lessons:chain
 *
 * The spine is a chain: every lesson `needs` the one before it and they all build
 * ONE app. R1 accepted that shape, and it makes a claim nothing checked until now:
 *
 *     starter(N) must equal solution(N-1).
 *
 * If it is false, the learner finishes lesson 3 with an app that is not the app
 * lesson 4 starts from, and every completion condition after the divergence grades
 * against a project the learner never had.
 *
 * 🔴 WHY `lessons:check` CANNOT SEE THIS, AND WHY A GREEN CORPUS IS NOT EVIDENCE
 * ------------------------------------------------------------------------------
 * `derive_starter` builds a starter by subtracting a lesson's own steps from its own
 * solution. That is a WITHIN-lesson invariant and it is sound — it is why a starter
 * cannot drift from the solution it came from. It says nothing whatever about the
 * lesson before. So the two failures are indistinguishable from inside one bundle:
 *
 *                                        | lesson 3 alone | the chain
 *     starter derived from its solution  |    ✅ passes    |  ✅ passes
 *     starter equals lesson 2's app      |    not asked   |  🔴 can be false
 *
 * A per-bundle gate that passes on every bundle individually is precisely the
 * instrument that would exonerate a spine that has come apart. The chain claim is
 * not in the corpus, so a clean corpus cannot carry it.
 *
 * 🔴 WHERE THE ORDER COMES FROM, AND WHY IT IS NOT curriculum.json
 * ----------------------------------------------------------------
 * `spine.json`, beside the bundles. Three constraints meet here and only that file
 * satisfies all three:
 *
 *   - It may not be a field in `lesson.json`. UNI-022 states the boundary on
 *     purpose: *"What is NOT in a manifest is curriculum-level: order, prerequisite,
 *     and state."* `needs` is a prerequisite, so it is not the manifest's to carry.
 *   - It may not be read from `curriculum.json` alone. That file lives in the
 *     `nodegx-community` checkout, which CI does not have — a gate reading only it
 *     would report "0 pairs checked" in CI forever, which is the hole-shaped-like-
 *     the-defect this file exists to close.
 *   - It may not be a vendored copy of `curriculum.json`. That file describes all
 *     sixteen lessons including the eight with no bundle; this describes the eight
 *     bundles on disk here.
 *
 * ⚠️ `spine.json` and `curriculum.json` ARE two statements of one fact and they WILL
 * drift. That is not waved away — it is gated. Whenever the community file is
 * reachable, every slug in both is cross-checked and disagreement FAILS. This is not
 * hypothetical: the cross-check is what found, on the day it was written, that
 * `curriculum.json` had never gained `it-breaks-on-a-phone` — the lesson R2 ruled
 * into position 2 — and so claimed `poke-it` follows `your-creature-on-screen`.
 * Six lessons had shipped against an order the curriculum did not describe.
 *
 * 🔴 WHAT "EQUAL" MEANS, AND WHY IT IS NOT A BYTE COMPARE
 * -------------------------------------------------------
 * MEASURED 2026-09-05: all six adjacent pairs are byte-identical on `nodes.json` and
 * `connections.json` today, because `derive_starter` copies. So a byte compare would
 * be green right now — but it would be a trap, not a gate: the first legitimate
 * re-save that nudges a node on the canvas turns it red, and a gate that goes red for
 * a reason nobody cares about is a gate somebody switches off.
 *
 * So the comparison is over a canonical projection of the graph, and the exclusion
 * list is a DENYLIST rather than an allowlist — deliberately:
 *
 *   EXCLUDED: `x`, `y`      canvas position. Not app behaviour. Reported as a NOTE
 *                          when it differs, so the exclusion is never a blind spot.
 *             `metadata`   authoring comments.
 *             `$schema`, `version`   format bookkeeping.
 *   COMPARED: everything else — `componentId`, `visualRoots`, and per node `id`,
 *             `type`, `label`, `parent`, `children`, `parameters`, `ports`, plus
 *             every connection.
 *
 * 🔴 The denylist is the load-bearing choice. An allowlist of "the fields we know
 * about" silently stops comparing the day a node gains a field, and the divergence it
 * would have caught walks straight through. A denylist fails CLOSED: a new key is
 * compared by default, and dropping it has to be a deliberate edit to this file.
 *
 * `component.json` and `_registry.json` are not compared at all: both carry
 * `modified`/`lastUpdated` timestamps, and `_registry.json` legitimately differs
 * anyway (D4 — `derive_starter` ships one that counts the solution).
 *
 * ✅ AC3 — A PAIR THAT IS FINE FOR THE WRONG REASON IS CAUGHT
 * -----------------------------------------------------------
 * Two EMPTY projects also compare equal. So does an unbuilt lesson against another
 * unbuilt lesson. Every pair therefore reports the cardinality it actually covered,
 * and a pair whose comparison saw no nodes FAILS rather than passing — "equal" over
 * nothing is not evidence of a chain.
 *
 * ✅ AC5 — SKIPPED IS NOT PASSED
 * ------------------------------
 * A lesson with no bundle is reported as skipped and named, never counted as a pass,
 * and the denominator is printed whether or not anything was found. A chain checker
 * over a curriculum with no bundles has nothing to do and would exit 0 in silence —
 * indistinguishable from a healthy spine.
 *
 * ✅ GRADED BY `--self-test`
 * --------------------------
 * A gate reporting "every pair holds" over a corpus it is not really reading is an
 * artefact this repo has shipped before. `--self-test` copies the real corpus to a
 * temp directory, breaks the chain eight ways, and requires each break to be caught —
 * including the two inverted arms (an x/y-only move must NOT fail, and a skipped
 * lesson must NOT read as a pass). It mutates a COPY; the shipped corpus is never
 * written to.
 *
 * Usage:
 *   npm run lessons:chain
 *   npm run lessons:chain:self-test
 *   ts-node -P ./scripts/tsconfig.json ./scripts/check-lesson-chain.ts [--json]
 *
 * Exit codes: 0 = every pair holds, 1 = a pair diverged, 2 = usage/IO error.
 */
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

const REPO_ROOT = path.resolve(__dirname, '..');
const LESSONS_DIR = path.join(REPO_ROOT, 'project-examples', 'lessons');
const SPINE_FILE = path.join(LESSONS_DIR, 'spine.json');

/**
 * The community checkout, when somebody has one. Overridable so a developer whose
 * repos live elsewhere can still get the cross-check.
 *
 * ⚠️ Absent is a normal, reported outcome — CI has no community checkout — and it is
 * NOT the same as "the two files agree". The distinction is printed either way.
 */
const CURRICULUM_FILE =
  process.env.NODEGX_CURRICULUM_JSON ??
  path.resolve(REPO_ROOT, '..', 'nodegx-community', 'src', 'lib', 'curriculum.json');

/** Node fields that are editor bookkeeping rather than app meaning. See the module note. */
const NODE_FIELDS_NOT_COMPARED = new Set(['x', 'y', 'metadata']);
/** Document fields that are format bookkeeping. */
const DOC_FIELDS_NOT_COMPARED = new Set(['$schema', 'version']);
/** Excluded from equality but reported, so the exclusion is never a silent blind spot. */
const POSITION_FIELDS = new Set(['x', 'y']);

const wantJson = process.argv.includes('--json');

// ─── reading the chain ──────────────────────────────────────────────────────

interface ChainEntry {
  needs: string | null;
  standalone?: boolean;
  why?: string;
}

interface Chain {
  lessons: Record<string, ChainEntry>;
}

function readChain(spineFile: string): Chain {
  const raw = JSON.parse(fs.readFileSync(spineFile, 'utf8')) as {
    format?: string;
    lessons?: Record<string, ChainEntry>;
  };
  if (raw.format !== 'nodegx-lesson-chain@1') {
    throw new Error(`${path.relative(REPO_ROOT, spineFile)} — unexpected format tag ${JSON.stringify(raw.format)}`);
  }
  if (!raw.lessons || typeof raw.lessons !== 'object') {
    throw new Error(`${path.relative(REPO_ROOT, spineFile)} — no "lessons" object.`);
  }
  return { lessons: raw.lessons };
}

// ─── the canonical projection ───────────────────────────────────────────────

type Json = unknown;

/** Deep key-sort, so two objects that differ only in key order are equal. */
function canonicalise(value: Json): Json {
  if (Array.isArray(value)) return value.map(canonicalise);
  if (value && typeof value === 'object') {
    const out: Record<string, Json> = {};
    for (const key of Object.keys(value as Record<string, Json>).sort()) {
      out[key] = canonicalise((value as Record<string, Json>)[key]);
    }
    return out;
  }
  return value;
}

function stable(value: Json): string {
  return JSON.stringify(canonicalise(value));
}

interface CanonicalNode {
  id: string;
  /** Everything compared, key-sorted. */
  compared: Record<string, Json>;
  /** Excluded from equality, reported when it differs. */
  position: Record<string, Json>;
}

interface CanonicalComponent {
  /** Path relative to `components/`, e.g. `Pages/Home`. */
  path: string;
  /** `nodes.json` top-level fields other than `nodes` and the bookkeeping ones. */
  document: Record<string, Json>;
  nodes: CanonicalNode[];
  connections: Json[];
}

interface CanonicalProject {
  components: CanonicalComponent[];
  nodeCount: number;
}

/**
 * Read a project directory into the shape the comparison works over.
 *
 * 🔴 Node array ORDER is not compared: nodes are sorted by `id`. The tree is defined
 * by `parent`/`children`, so the order they happen to be serialised in carries no
 * meaning, and comparing it would make a re-save a divergence.
 */
function readProject(dir: string): CanonicalProject {
  const componentsDir = path.join(dir, 'components');
  const out: CanonicalProject = { components: [], nodeCount: 0 };
  if (!fs.existsSync(componentsDir)) return out;

  const walk = (current: string): void => {
    const nodesFile = path.join(current, 'nodes.json');
    if (fs.existsSync(nodesFile)) {
      const rel = path.relative(componentsDir, current).split(path.sep).join('/');
      const doc = JSON.parse(fs.readFileSync(nodesFile, 'utf8')) as Record<string, Json>;

      const document: Record<string, Json> = {};
      for (const key of Object.keys(doc).sort()) {
        if (key === 'nodes' || DOC_FIELDS_NOT_COMPARED.has(key)) continue;
        document[key] = canonicalise(doc[key]);
      }

      const nodes: CanonicalNode[] = [];
      for (const node of (doc.nodes as Record<string, Json>[]) ?? []) {
        const compared: Record<string, Json> = {};
        const position: Record<string, Json> = {};
        for (const key of Object.keys(node).sort()) {
          if (POSITION_FIELDS.has(key)) position[key] = node[key];
          if (NODE_FIELDS_NOT_COMPARED.has(key)) continue;
          compared[key] = canonicalise(node[key]);
        }
        nodes.push({ id: String(node.id ?? ''), compared, position });
      }
      nodes.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));

      let connections: Json[] = [];
      const connectionsFile = path.join(current, 'connections.json');
      if (fs.existsSync(connectionsFile)) {
        const cdoc = JSON.parse(fs.readFileSync(connectionsFile, 'utf8')) as Record<string, Json>;
        connections = ((cdoc.connections as Json[]) ?? []).map(canonicalise);
        connections.sort((a, b) => (stable(a) < stable(b) ? -1 : stable(a) > stable(b) ? 1 : 0));
      }

      out.components.push({ path: rel, document, nodes, connections });
      out.nodeCount += nodes.length;
    }
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      if (entry.isDirectory()) walk(path.join(current, entry.name));
    }
  };
  walk(componentsDir);
  out.components.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
  return out;
}

// ─── the comparison ─────────────────────────────────────────────────────────

/**
 * The first divergence between `starter(N)` and `solution(N-1)`, NAMED — which
 * component, which node, which field. Not a diff dump: a report nobody reads is a
 * report that does not change what anybody does.
 */
function firstDivergence(starter: CanonicalProject, previous: CanonicalProject): string | null {
  const starterPaths = starter.components.map((c) => c.path);
  const previousPaths = previous.components.map((c) => c.path);

  for (const p of starterPaths) {
    if (!previousPaths.includes(p)) {
      return `component "${p}" is in this lesson's starter but NOT in the previous lesson's solution — the starter adds a component the learner never built.`;
    }
  }
  for (const p of previousPaths) {
    if (!starterPaths.includes(p)) {
      return `component "${p}" is in the previous lesson's solution but MISSING from this starter — the learner's work has been dropped.`;
    }
  }

  for (const sc of starter.components) {
    const pc = previous.components.find((c) => c.path === sc.path)!;

    for (const key of new Set([...Object.keys(sc.document), ...Object.keys(pc.document)])) {
      if (stable(sc.document[key]) !== stable(pc.document[key])) {
        return `component "${sc.path}" — document field "${key}" differs: starter ${stable(sc.document[key])} vs previous solution ${stable(pc.document[key])}.`;
      }
    }

    const sIds = sc.nodes.map((n) => n.id);
    const pIds = pc.nodes.map((n) => n.id);
    for (const n of sc.nodes) {
      if (!pIds.includes(n.id)) {
        return `component "${sc.path}" — node ${n.id} (type ${String(n.compared.type)}, label ${JSON.stringify(n.compared.label)}) is in this starter but NOT in the previous lesson's solution.`;
      }
    }
    for (const n of pc.nodes) {
      if (!sIds.includes(n.id)) {
        return `component "${sc.path}" — node ${n.id} (type ${String(n.compared.type)}, label ${JSON.stringify(n.compared.label)}) was in the previous lesson's solution but is MISSING from this starter.`;
      }
    }

    for (const sn of sc.nodes) {
      const pn = pc.nodes.find((n) => n.id === sn.id)!;
      for (const key of new Set([...Object.keys(sn.compared), ...Object.keys(pn.compared)])) {
        if (stable(sn.compared[key]) !== stable(pn.compared[key])) {
          return `component "${sc.path}" — node ${sn.id} (type ${String(sn.compared.type)}, label ${JSON.stringify(sn.compared.label)}): field "${key}" differs. Starter ${stable(sn.compared[key])} vs previous solution ${stable(pn.compared[key])}.`;
        }
      }
    }

    if (stable(sc.connections) !== stable(pc.connections)) {
      const sset = new Set(sc.connections.map(stable));
      const pset = new Set(pc.connections.map(stable));
      const added = sc.connections.map(stable).filter((c) => !pset.has(c));
      const removed = pc.connections.map(stable).filter((c) => !sset.has(c));
      if (added.length) return `component "${sc.path}" — connection in this starter that the previous solution does not have: ${added[0]}.`;
      if (removed.length) return `component "${sc.path}" — connection the previous solution had, missing from this starter: ${removed[0]}.`;
      return `component "${sc.path}" — connections differ.`;
    }
  }
  return null;
}

/** Canvas moves, excluded from equality on purpose — reported so they are not invisible. */
function positionNotes(starter: CanonicalProject, previous: CanonicalProject): string[] {
  const notes: string[] = [];
  for (const sc of starter.components) {
    const pc = previous.components.find((c) => c.path === sc.path);
    if (!pc) continue;
    for (const sn of sc.nodes) {
      const pn = pc.nodes.find((n) => n.id === sn.id);
      if (!pn) continue;
      if (stable(sn.position) !== stable(pn.position)) {
        notes.push(
          `component "${sc.path}" — node ${sn.id} moved on the canvas (${stable(pn.position)} → ${stable(sn.position)}). Not a divergence; the graph is unchanged.`
        );
      }
    }
  }
  return notes;
}

// ─── the run ────────────────────────────────────────────────────────────────

interface PairResult {
  lesson: string;
  needs: string;
  problem: string | null;
  notes: string[];
  components: number;
  nodes: number;
}

interface ChainReport {
  pairs: PairResult[];
  /** In the chain, no bundle on disk. Reported, never counted as a pass. */
  skipped: { lesson: string; why: string }[];
  heads: string[];
  standalone: string[];
  crossCheck: { reachable: boolean; file: string; problems: string[]; noBundle: string[] };
  problems: string[];
}

function run(lessonsDir: string, spineFile: string, curriculumFile: string): ChainReport {
  const chain = readChain(spineFile);
  const report: ChainReport = {
    pairs: [],
    skipped: [],
    heads: [],
    standalone: [],
    crossCheck: { reachable: false, file: curriculumFile, problems: [], noBundle: [] },
    problems: []
  };

  const hasBundle = (slug: string): boolean => fs.existsSync(path.join(lessonsDir, slug, 'lesson.json'));

  // 🔴 A bundle on disk that the chain does not mention is a lesson nothing orders.
  // It fails rather than being ignored: silence here is how a lesson joins the shelf
  // outside the spine and nobody notices it was never chained.
  for (const entry of fs.readdirSync(lessonsDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    if (!hasBundle(entry.name)) continue;
    if (!(entry.name in chain.lessons)) {
      report.problems.push(
        `bundle "${entry.name}" ships but is not in ${path.basename(spineFile)}. Add it with its "needs", or mark it "standalone": true if it is deliberately outside the spine.`
      );
    }
  }

  for (const [slug, entry] of Object.entries(chain.lessons)) {
    if (!hasBundle(slug)) {
      report.skipped.push({ lesson: slug, why: 'no bundle on disk — nothing to compare' });
      continue;
    }
    if (entry.standalone) {
      report.standalone.push(slug);
      continue;
    }
    if (entry.needs === null || entry.needs === undefined) {
      report.heads.push(slug);
      continue;
    }
    if (!(entry.needs in chain.lessons)) {
      report.problems.push(`lesson "${slug}" needs "${entry.needs}", which is not in ${path.basename(spineFile)}.`);
      continue;
    }
    if (!hasBundle(entry.needs)) {
      report.skipped.push({
        lesson: slug,
        why: `needs "${entry.needs}", which has no bundle on disk — the pair cannot be compared`
      });
      continue;
    }

    const starter = readProject(path.join(lessonsDir, slug));
    const previous = readProject(path.join(lessonsDir, entry.needs, 'solution'));

    const pair: PairResult = {
      lesson: slug,
      needs: entry.needs,
      problem: firstDivergence(starter, previous),
      notes: positionNotes(starter, previous),
      components: starter.components.length,
      nodes: starter.nodeCount
    };

    // 🔴 AC3. Two EMPTY projects compare equal, and so do two unbuilt lessons. An
    // "equal" that saw no nodes is not evidence of a chain, it is evidence of an
    // unread pair — and it would otherwise score identically to a perfect join.
    if (!pair.problem && (starter.nodeCount === 0 || previous.nodeCount === 0)) {
      pair.problem =
        `the comparison saw no nodes (starter ${starter.nodeCount}, previous solution ${previous.nodeCount}). ` +
        `Two empty projects compare equal; this pair proves nothing and is not counted as a pass.`;
    }
    report.pairs.push(pair);
  }

  // ── the cross-check against the community curriculum, when it is reachable ──
  if (fs.existsSync(curriculumFile)) {
    report.crossCheck.reachable = true;
    const curriculum = JSON.parse(fs.readFileSync(curriculumFile, 'utf8')) as {
      paths: { key: string; lessons: { slug: string; needs: string | null }[] }[];
    };
    const curriculumNeeds = new Map<string, string | null>();
    for (const p of curriculum.paths ?? []) {
      for (const l of p.lessons ?? []) curriculumNeeds.set(l.slug, l.needs ?? null);
    }
    for (const [slug, entry] of Object.entries(chain.lessons)) {
      if (entry.standalone) continue;
      if (!curriculumNeeds.has(slug)) {
        report.crossCheck.problems.push(
          `"${slug}" ships here but is not in curriculum.json at all — the syllabus does not describe a lesson learners can install.`
        );
        continue;
      }
      const theirs = curriculumNeeds.get(slug) ?? null;
      const ours = entry.needs ?? null;
      if (theirs !== ours) {
        report.crossCheck.problems.push(
          `"${slug}" — this repo says it needs ${JSON.stringify(ours)}, curriculum.json says ${JSON.stringify(theirs)}. One of the two is wrong and the spine is only as good as the agreement.`
        );
      }
    }
    for (const slug of curriculumNeeds.keys()) {
      if (!fs.existsSync(path.join(lessonsDir, slug, 'lesson.json'))) report.crossCheck.noBundle.push(slug);
    }
  }

  return report;
}

function print(report: ChainReport): number {
  for (const pair of report.pairs) {
    const scope = `${pair.components}c/${pair.nodes}n`;
    if (pair.problem) {
      console.log(`✘ ${pair.lesson}  ←  ${pair.needs}  (${scope})`);
      console.log(`    ${pair.problem}`);
    } else {
      console.log(`✔ ${pair.lesson}  ←  ${pair.needs}  — starter matches the previous solution (${scope})`);
    }
    for (const note of pair.notes) console.log(`    note: ${note}`);
  }

  for (const slug of report.heads) console.log(`· ${slug} — chain head, no predecessor to compare.`);
  for (const slug of report.standalone) console.log(`· ${slug} — standalone, deliberately outside the spine.`);
  for (const s of report.skipped) console.log(`⊘ ${s.lesson} — SKIPPED: ${s.why}. Not counted as a pass.`);

  // 🔴 The denominator, printed whether or not anything was found. A chain checker
  // with nothing to do exits 0 in silence, and that is indistinguishable from a
  // healthy spine — which is the failure this line exists to make impossible.
  const failed = report.pairs.filter((p) => p.problem).length;
  console.log(
    `\n${report.pairs.length} adjacent pair(s) compared, ${failed} diverged, ` +
      `${report.skipped.length} skipped, ${report.heads.length} chain head(s), ` +
      `${report.standalone.length} standalone.`
  );

  if (report.crossCheck.reachable) {
    console.log(
      `curriculum.json cross-check: read ${report.crossCheck.file}` +
        (report.crossCheck.noBundle.length
          ? ` — ${report.crossCheck.noBundle.length} lesson(s) in the curriculum have no bundle here (${report.crossCheck.noBundle.join(', ')}).`
          : '.')
    );
    for (const problem of report.crossCheck.problems) console.log(`    ✘ ${problem}`);
  } else {
    // ⚠️ Absent is not agreement. Said out loud, every run.
    console.log(
      `curriculum.json cross-check: NOT RUN — no file at ${report.crossCheck.file}. ` +
        `The order was read from spine.json alone; whether the published syllabus agrees is UNMEASURED here. ` +
        `Set NODEGX_CURRICULUM_JSON to a nodegx-community checkout to include it.`
    );
  }

  const problems = [...report.problems, ...report.crossCheck.problems];
  for (const problem of report.problems) console.log(`✘ ${problem}`);

  if (failed || problems.length) {
    console.error(
      `\nlessons:chain FAILED — ${failed} diverged pair(s), ${problems.length} chain problem(s).\n` +
        `A spine lesson may only ADD to the one before it. If a starter no longer matches the ` +
        `previous solution, the learner opens it to find work they did missing or work they never ` +
        `did already there — and every graded condition after the divergence is grading a project ` +
        `they never had.`
    );
    return 1;
  }

  if (report.pairs.length === 0) {
    console.error(
      `\nlessons:chain FAILED — 0 pairs were compared. Nothing was checked, so nothing is known ` +
        `about the chain. A gate that goes green having found nothing to do is the artefact this ` +
        `one was written to replace.`
    );
    return 1;
  }

  console.log('lessons:chain — every adjacent pair holds: each starter is the previous lesson’s finished app.');
  return 0;
}

function main(): number {
  if (!fs.existsSync(SPINE_FILE)) {
    console.error(`lessons:chain — ${path.relative(REPO_ROOT, SPINE_FILE)} does not exist. The chain has no source.`);
    return 2;
  }
  let report: ChainReport;
  try {
    report = run(LESSONS_DIR, SPINE_FILE, CURRICULUM_FILE);
  } catch (err) {
    console.error(`lessons:chain — ${(err as Error).message}`);
    return 2;
  }
  if (wantJson) {
    console.log(JSON.stringify(report, null, 2));
    return report.pairs.some((p) => p.problem) || report.problems.length || report.crossCheck.problems.length ? 1 : 0;
  }
  return print(report);
}

// ─── the self-test ──────────────────────────────────────────────────────────

interface Mutation {
  name: string;
  apply: (corpus: string) => void;
  /**
   * Substrings the output MUST all contain.
   *
   * ⚠️ More than one where a single phrase would not actually prove the property.
   * The AC5 arm below is the case in point: *"SKIPPED"* appearing somewhere says the
   * word was printed, not that the pair stopped being counted as a pass — so it
   * asserts the denominator moved as well.
   */
  expect: string | string[];
  /** True when the mutation must still exit 0 — an inverted arm. */
  expectPass?: boolean;
  /**
   * Override the curriculum this arm is cross-checked against. Given a temp root, it
   * returns a path — which may deliberately not exist, to grade the CI shape.
   */
  curriculum?: (root: string, fixture: string) => string;
}

function editJson(file: string, edit: (value: never) => void): void {
  const value = JSON.parse(fs.readFileSync(file, 'utf8'));
  edit(value as never);
  fs.writeFileSync(file, JSON.stringify(value, null, 2));
}

function copyDir(from: string, to: string): void {
  fs.mkdirSync(to, { recursive: true });
  for (const entry of fs.readdirSync(from, { withFileTypes: true })) {
    const s = path.join(from, entry.name);
    const d = path.join(to, entry.name);
    if (entry.isDirectory()) copyDir(s, d);
    else if (entry.isFile()) fs.copyFileSync(s, d);
  }
}

const HOME = (corpus: string, slug: string, ...rest: string[]): string =>
  path.join(corpus, slug, ...rest, 'components', 'Pages', 'Home', 'nodes.json');

/**
 * 🔴 Every arm this gate has, one mutation each. A mutation that still passes is a
 * hole, and the arm it names is the arm that is not working.
 *
 * The last two are INVERTED — they must NOT fail. Without them the gate could be
 * "fixed" into something that reddens on any change at all, which grades nothing and
 * gets switched off within a week.
 */
const MUTATIONS: Mutation[] = [
  {
    name: 'AC2 — a node ADDED to a starter (work the learner never did, already there)',
    apply: (corpus) =>
      editJson(HOME(corpus, 'poke-it'), (doc: never) => {
        const d = doc as unknown as { nodes: Record<string, unknown>[] };
        d.nodes.push({ id: 'intruder-0001', type: 'Text', label: 'Intruder', parameters: {}, x: 0, y: 0 });
      }),
    expect: 'is in this starter but NOT in the previous lesson'
  },
  {
    name: 'a node REMOVED from a starter (the learner’s own work, dropped)',
    apply: (corpus) =>
      editJson(HOME(corpus, 'poke-it'), (doc: never) => {
        const d = doc as unknown as { nodes: Record<string, unknown>[] };
        d.nodes.pop();
      }),
    expect: 'is MISSING from this starter'
  },
  {
    name: 'a PARAMETER changed in a starter (same nodes, different app)',
    apply: (corpus) =>
      editJson(HOME(corpus, 'poke-it'), (doc: never) => {
        const d = doc as unknown as { nodes: { parameters?: Record<string, unknown> }[] };
        const node = d.nodes.find((n) => n.parameters && Object.keys(n.parameters).length > 0)!;
        node.parameters!.__mutant = 'changed';
      }),
    expect: 'field "parameters" differs'
  },
  {
    name: 'a node RELABELLED in a starter',
    apply: (corpus) =>
      editJson(HOME(corpus, 'poke-it'), (doc: never) => {
        const d = doc as unknown as { nodes: { label?: string }[] };
        d.nodes[d.nodes.length - 1].label = 'Renamed by the mutant';
      }),
    expect: 'field "label" differs'
  },
  {
    name: 'a CONNECTION added to a starter',
    apply: (corpus) => {
      const file = path.join(corpus, 'it-forgets-you', 'components', 'Pages', 'Home', 'connections.json');
      editJson(file, (doc: never) => {
        const d = doc as unknown as { connections: unknown[] };
        d.connections.push({ fromId: 'a', fromProperty: 'b', toId: 'c', toProperty: 'd' });
      });
    },
    expect: 'connection in this starter that the previous solution does not have'
  },
  {
    name: 'AC2 — the CHAIN ORDER repointed (a real starter, compared against the wrong lesson)',
    apply: (corpus) =>
      editJson(path.join(corpus, 'spine.json'), (doc: never) => {
        const d = doc as unknown as { lessons: Record<string, { needs: string | null }> };
        d.lessons['poke-it'].needs = 'your-creature-on-screen';
      }),
    expect: [
      // The divergence itself, NAMED — repointing `poke-it` at lesson 1 means lesson 2's
      // `Board` is suddenly work the learner never did.
      'node board-0001 (type Group, label "Board") is in this starter but NOT in the previous lesson',
      // ✅ And the cross-check catches the same lie from the other side, which is the
      // arm that would have caught the real drift this gate was written during.
      'curriculum.json says "it-breaks-on-a-phone"'
    ]
  },
  {
    name: 'AC3 — two EMPTY projects, which compare equal and must NOT read as a pass',
    apply: (corpus) => {
      editJson(HOME(corpus, 'poke-it'), (doc: never) => {
        (doc as unknown as { nodes: unknown[] }).nodes = [];
      });
      editJson(HOME(corpus, 'it-breaks-on-a-phone', 'solution'), (doc: never) => {
        (doc as unknown as { nodes: unknown[] }).nodes = [];
      });
      // App/ too, or the pair still has nodes and the arm tests nothing.
      for (const p of [
        path.join(corpus, 'poke-it', 'components', 'App', 'nodes.json'),
        path.join(corpus, 'it-breaks-on-a-phone', 'solution', 'components', 'App', 'nodes.json')
      ]) {
        editJson(p, (doc: never) => {
          (doc as unknown as { nodes: unknown[] }).nodes = [];
        });
      }
    },
    expect: 'the comparison saw no nodes'
  },
  {
    name: 'AC5 — a chained lesson whose BUNDLE IS GONE reads as SKIPPED and leaves the denominator',
    apply: (corpus) => fs.rmSync(path.join(corpus, 'it-gets-demanding'), { recursive: true, force: true }),
    // 🔴 An unbuilt lesson must NOT redden the gate — nine of the sixteen have no bundle
    // and never will until they are written. What it must not do is quietly become a pass:
    // the pair count has to DROP from 6 to 5, and the skip has to be named. Asserting the
    // word "SKIPPED" alone would pass on a gate that printed it and counted the pair anyway.
    expect: ['⊘ it-gets-demanding — SKIPPED', '5 adjacent pair(s) compared, 0 diverged, 1 skipped'],
    expectPass: true
  },
  {
    name: '🔴 INVERTED — a bundle that ships but is not in the chain must FAIL, not be ignored',
    apply: (corpus) =>
      editJson(path.join(corpus, 'spine.json'), (doc: never) => {
        delete (doc as unknown as { lessons: Record<string, unknown> }).lessons['log-a-thing'];
      }),
    expect: 'ships but is not in'
  },
  {
    name: '🔴 INVERTED — a node MOVED on the canvas must NOT fail (x/y is excluded on purpose)',
    apply: (corpus) =>
      editJson(HOME(corpus, 'poke-it'), (doc: never) => {
        const d = doc as unknown as { nodes: { x?: number; y?: number }[] };
        d.nodes[d.nodes.length - 1].x = 9999;
        d.nodes[d.nodes.length - 1].y = 9999;
      }),
    expect: 'moved on the canvas',
    expectPass: true
  },
  {
    // The real drift, reproduced: curriculum.json describing a spine that is missing a
    // lesson which ships. Six lessons had shipped against this before it was found.
    name: 'the CURRICULUM disagrees — it has never heard of a lesson that ships',
    apply: () => undefined,
    curriculum: (root, fixture) => {
      const doc = JSON.parse(fs.readFileSync(fixture, 'utf8')) as {
        paths: { lessons: { slug: string; needs: string | null }[] }[];
      };
      // Drop lesson 2 and repoint lesson 3 around it — exactly the shape found on 2026-09-05.
      doc.paths[0].lessons = doc.paths[0].lessons.filter((l) => l.slug !== 'it-breaks-on-a-phone');
      const pokeIt = doc.paths[0].lessons.find((l) => l.slug === 'poke-it')!;
      pokeIt.needs = 'your-creature-on-screen';
      const to = path.join(root, 'curriculum.stale.json');
      fs.writeFileSync(to, JSON.stringify(doc, null, 2));
      return to;
    },
    expect: [
      '"it-breaks-on-a-phone" ships here but is not in curriculum.json at all',
      '"poke-it" — this repo says it needs "it-breaks-on-a-phone", curriculum.json says "your-creature-on-screen"'
    ]
  },
  {
    // 🔴 The CI shape. Absent is not agreement, and the run must say which one it is.
    name: '🔴 INVERTED — NO curriculum reachable (CI) still checks the chain, and says the cross-check did not run',
    apply: () => undefined,
    curriculum: (root) => path.join(root, 'no-such-curriculum.json'),
    expect: [
      'curriculum.json cross-check: NOT RUN',
      'is UNMEASURED here',
      '6 adjacent pair(s) compared, 0 diverged'
    ],
    expectPass: true
  }
];

/**
 * A curriculum fixture that AGREES with the shipped chain, written from `spine.json`.
 *
 * 🔴 THE SELF-TEST MUST NOT READ THE DEVELOPER'S REAL COMMUNITY CHECKOUT. It did in
 * its first draft, and that made two arms depend on a file CI does not have: the
 * cross-check arms passed on this machine and would have gone red in CI, for a reason
 * having nothing to do with the corpus. A gate whose self-test only works where
 * somebody happens to have a sibling repo checked out is not a gate.
 *
 * Deriving it from `spine.json` rather than typing it out also keeps the agreeing case
 * genuinely agreeing as lessons are added, so the control cannot rot into a red.
 */
function writeCurriculumFixture(chainFile: string, to: string): string {
  const chain = readChain(chainFile);
  const lessons = Object.entries(chain.lessons)
    .filter(([, entry]) => !entry.standalone)
    .map(([slug, entry]) => ({ slug, needs: entry.needs ?? null }));
  fs.writeFileSync(to, JSON.stringify({ paths: [{ key: 'spine', lessons }] }, null, 2));
  return to;
}

function selfTest(): number {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'lesson-chain-selftest-'));
  let failures = 0;

  // Written from the REAL spine.json once, then reused by every arm — so an arm that
  // mutates spine.json produces a genuine disagreement against a fixed counterpart.
  const curriculum = writeCurriculumFixture(SPINE_FILE, path.join(root, 'curriculum.fixture.json'));
  const absentCurriculum = path.join(root, 'no-such-curriculum.json');

  // 🔴 The control. If the UNMUTATED copy does not pass, every "caught" below is
  // caught by the copy being broken rather than by the mutation — and the whole
  // self-test would read green while grading nothing.
  const control = path.join(root, 'control');
  copyDir(LESSONS_DIR, control);
  const controlOut = capture(() => print(run(control, path.join(control, 'spine.json'), curriculum)));
  if (controlOut.code !== 0) {
    console.log('✘ CONTROL — the unmutated corpus does not pass. Every arm below is meaningless.');
    console.log(controlOut.text.replace(/^/gm, '    '));
    return 1;
  }
  console.log('✔ CONTROL — the unmutated corpus passes, so a red below is the mutation.');

  for (const [index, mutation] of MUTATIONS.entries()) {
    const corpus = path.join(root, `m${index}`);
    copyDir(LESSONS_DIR, corpus);
    mutation.apply(corpus);
    const against = mutation.curriculum ? mutation.curriculum(corpus, curriculum) : curriculum;
    const out = capture(() => print(run(corpus, path.join(corpus, 'spine.json'), against)));

    const wanted = Array.isArray(mutation.expect) ? mutation.expect : [mutation.expect];
    const missing = wanted.filter((phrase) => !out.text.includes(phrase));
    const wantedCode = mutation.expectPass ? 0 : 1;
    const ok = missing.length === 0 && out.code === wantedCode;

    if (ok) {
      console.log(`✔ caught — ${mutation.name}`);
    } else {
      failures++;
      console.log(`✘ NOT caught — ${mutation.name}`);
      console.log(`    expected exit ${wantedCode}, got ${out.code}`);
      for (const phrase of missing) console.log(`    output never contained ${JSON.stringify(phrase)}`);
      console.log(out.text.replace(/^/gm, '    '));
    }
  }

  fs.rmSync(root, { recursive: true, force: true });
  console.log(`\n${MUTATIONS.length} mutation(s), ${failures} not caught.`);
  if (failures) {
    console.error('lessons:chain:self-test FAILED — a break this gate claims to catch went through it.');
    return 1;
  }
  const inverted = MUTATIONS.filter((m) => m.expectPass).length;
  console.log(`lessons:chain:self-test — every break was caught, and all ${inverted} inverted arm(s) behaved.`);
  return 0;
}

/** Run `fn` with stdout/stderr captured, so a mutation's output can be asserted over. */
function capture(fn: () => number): { code: number; text: string } {
  const chunks: string[] = [];
  const realLog = console.log;
  const realError = console.error;
  console.log = (...args: unknown[]) => void chunks.push(args.join(' '));
  console.error = (...args: unknown[]) => void chunks.push(args.join(' '));
  try {
    const code = fn();
    return { code, text: chunks.join('\n') };
  } finally {
    console.log = realLog;
    console.error = realError;
  }
}

process.exit(process.argv.includes('--self-test') ? selfTest() : main());
