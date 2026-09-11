/**
 * UNI-010 slice 2 — the `create_lesson` surface.
 *
 * Three things are pinned here, and each is a place the slice could have gone
 * wrong quietly:
 *
 * 1. 🔴 **The brief's examples compile.** Every condition it shows an authoring
 *    model is a typed value run through the real `compileConditions`. The
 *    vocabulary is genuinely not guessable — `hasParams` takes an array,
 *    `paramsEqual` is not `paramsEq`, and there is no `hasConnection` — and a
 *    brief that got one wrong would teach the mistake to every lesson written
 *    through it. A doc that lies has examples that lie too, so the examples are
 *    checked rather than proofread.
 * 2. 🔴 **A refusal writes nothing.** The gate runs before the copy, so there is
 *    no state where a half-verified bundle sits on disk beside an error message
 *    waiting for a model that skimmed.
 * 3. 🔴 **The producer holds itself to the installer's table.** `create_lesson`
 *    asks `decideInstall(…, 'local-ai')` rather than re-deriving what "good
 *    enough" means, so a bundle this tool writes cannot be one the editor
 *    refuses.
 *
 * No Chrome anywhere: engine 2 arrives as an injected result, which is the same
 * seam `wholeSolutionGrader.test.ts` uses and for the same reason.
 */

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import { CONDITION_EXAMPLES, EXAMPLE_MANIFEST, lessonAuthoringBrief } from '../src/lessons/authoringBrief';
import { scoreLesson, writeLessonBundle } from '../src/lessons/bundleWriter';
import { compileConditions, MANIFEST_FILE, SOLUTION_DIR } from '../src/editor-deps';
import type { LessonManifest, WholeSolutionResult } from '../src/editor-deps';
import { ToolError } from '../src/errors';

// ─── Fixtures on a real temp disk ───────────────────────────────────────────

function tmp(name: string): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), `uni010-${name}-`));
}

interface StoredNode {
  id: string;
  type: string;
  label?: string;
  parent?: string;
  children?: string[];
  parameters?: Record<string, unknown>;
}

/**
 * Write a v2 project.
 *
 * ⚠️ The component's `path` is its **legacy name** and is deliberately not its
 * directory — a fixture where the two agreed would be testing a project shape the
 * editor never produces, and the harness would pass over the one mistake it most
 * needs to catch.
 */
function writeProject(dir: string, nodes: StoredNode[]): string {
  const compDir = path.join(dir, 'components', '__page__', 'Home');
  fs.mkdirSync(compDir, { recursive: true });
  fs.writeFileSync(
    path.join(dir, 'components', '_registry.json'),
    JSON.stringify({ components: { '__page__/Home': { path: '__page__/Home' } } })
  );
  fs.writeFileSync(
    path.join(compDir, 'component.json'),
    JSON.stringify({ id: 'home', name: 'Home', path: '/#__page__/Home', type: 'visual' })
  );
  fs.writeFileSync(path.join(compDir, 'nodes.json'), JSON.stringify({ componentId: 'home', nodes }));
  fs.writeFileSync(path.join(compDir, 'connections.json'), JSON.stringify({ componentId: 'home', connections: [] }));
  fs.writeFileSync(path.join(dir, 'nodegx.project.json'), JSON.stringify({ rootNodeId: 'page-1' }));
  return dir;
}

const EMPTY_PAGE: StoredNode[] = [{ id: 'page-1', type: 'Page', children: [] }];
const PAGE_WITH_TEXT: StoredNode[] = [
  { id: 'page-1', type: 'Page', children: ['text-1'] },
  { id: 'text-1', type: 'Text', label: 'Greeting', parameters: { text: 'Hello' }, parent: 'page-1' }
];

const LESSON: LessonManifest = {
  format: 'noodl-lesson@1',
  title: 'Put some text on the page',
  steps: [
    { kind: 'popup', body: 'Welcome.' },
    {
      title: 'Add a Text node',
      body: 'Drag a **Text** node onto the page and label it `Greeting`.',
      completeWhen: [{ node: '/#__page__/Home:%Page:#Greeting', hasType: 'Text' }]
    }
  ]
};

const DREW: WholeSolutionResult = { valid: true, rendered: true, drawnElementCount: 2, findings: [] };
const DREW_NOTHING: WholeSolutionResult = { valid: true, rendered: false, drawnElementCount: 0, findings: [] };

function dirs() {
  return {
    starter: writeProject(tmp('starter'), EMPTY_PAGE),
    solution: writeProject(tmp('solution'), PAGE_WITH_TEXT),
    bundle: path.join(tmp('out'), 'lesson')
  };
}

// ─── The brief ──────────────────────────────────────────────────────────────

describe('the authoring brief', () => {
  it('🔴 shows only conditions that actually compile', () => {
    // The verbs are the part a model cannot infer. Compiling them here is what
    // stops the brief teaching `paramsEq` for a year.
    for (const example of CONDITION_EXAMPLES) {
      expect(() => compileConditions([example.def], 'the brief')).not.toThrow();
    }
  });

  it('🔴 ships a worked example that passes the gate it describes', async () => {
    // A brief whose own example the harness would refuse is worse than no
    // example: the model copies it and is told it is wrong.
    const d = dirs();
    const scored = await scoreLesson(EXAMPLE_MANIFEST, {
      starterDir: d.starter,
      solutionDir: d.solution,
      grade: async () => DREW
    });

    expect(scored.scorecard.classes).toEqual({ F1: 'pass', F2: 'pass', F3: 'pass', F4: 'pass' });
    expect(scored.installable).toBe(true);
  });

  it('names the traps a model cannot infer from the format', () => {
    const brief = lessonAuthoringBrief();
    // Each of these has cost this arc a session at least once.
    expect(brief).toMatch(/legacy name/);
    expect(brief).toMatch(/matches only at ITS level/);
    expect(brief).toMatch(/display name/);
    expect(brief).toMatch(new RegExp(SOLUTION_DIR));
    expect(brief).toMatch(/absent from the starter/i);
    expect(brief).toMatch(/bare URL is never a link/);
  });

  it('🔴 names the one-directional gradient, which is the only lever on it', () => {
    // UNI-010 criterion 3 §9/§12.3. Five steps across four lessons written
    // through this brief checked LESS than their prose asked, always leniently,
    // and the cause is structural: F2 refuses a condition that is too strong
    // and nothing anywhere refuses one that is too weak. F6 is the class that
    // would catch it and F6 is human by definition — so saying it out loud is
    // the whole of the mitigation available, and a brief that quietly dropped
    // the sentence would leave the finding with nothing acting on it.
    const brief = lessonAuthoringBrief();

    expect(brief).toMatch(/too strong/);
    expect(brief).toMatch(/too weak/);
    // The two shapes, both taken from steps that actually shipped.
    expect(brief).toMatch(/paramsEqual/);
    expect(brief).toMatch(/routerLists/);
  });

  it('does not describe F4 as the check it stopped being', () => {
    // The brief said "validates and draws nothing". Since slice 3 it also fails
    // on what the render reports about what it DID draw, and it still only
    // renders the start page. A model authoring against the older sentence
    // would think a rendered page was a scored one.
    const brief = lessonAuthoringBrief();

    expect(brief).toMatch(/start page/);
    expect(brief).not.toMatch(/F4\*\* — a solution that validates and draws nothing/);
  });
});

// ─── Scoring ────────────────────────────────────────────────────────────────

describe('scoring a lesson before it exists', () => {
  it('refuses a directory that is not a project, naming which one', async () => {
    const d = dirs();
    await expect(
      scoreLesson(LESSON, { starterDir: tmp('empty'), solutionDir: d.solution, skipRender: true })
    ).rejects.toThrow(ToolError);
  });

  it('scores every class when a solution and a render are available', async () => {
    const d = dirs();
    const scored = await scoreLesson(LESSON, {
      starterDir: d.starter,
      solutionDir: d.solution,
      grade: async () => DREW
    });
    expect(scored.scorecard.classes).toEqual({ F1: 'pass', F2: 'pass', F3: 'pass', F4: 'pass' });
  });

  it('catches a solution that draws nothing — the class predicted to dominate', async () => {
    const d = dirs();
    const scored = await scoreLesson(LESSON, {
      starterDir: d.starter,
      solutionDir: d.solution,
      grade: async () => DREW_NOTHING
    });
    expect(scored.scorecard.classes.F4).toBe('fail');
    expect(scored.installable).toBe(false);
  });
});

// ─── Writing ────────────────────────────────────────────────────────────────

describe('writing a bundle', () => {
  it('assembles starter, solution and manifest — and stamps the AI claim', async () => {
    const d = dirs();
    const result = await writeLessonBundle(LESSON, {
      bundleDir: d.bundle,
      starterDir: d.starter,
      solutionDir: d.solution,
      grade: async () => DREW
    });

    expect(result.written).toBe(true);
    expect(fs.existsSync(path.join(d.bundle, 'components', '_registry.json'))).toBe(true);
    expect(fs.existsSync(path.join(d.bundle, SOLUTION_DIR, 'components', '_registry.json'))).toBe(true);

    // 🔴 The stamp is what makes the ordinary folder-install route apply the
    // stricter gate — a claim that spends trust rather than buying it.
    const written = JSON.parse(fs.readFileSync(path.join(d.bundle, MANIFEST_FILE), 'utf8'));
    expect(written.authoredBy).toBe('ai');
    expect(written.steps).toHaveLength(2);
  });

  it('🔴 writes NOTHING when the lesson fails, so a refusal cannot be installed', async () => {
    const d = dirs();
    // The solution never grows the node the step asks for.
    const dead = writeProject(tmp('dead'), EMPTY_PAGE);

    const result = await writeLessonBundle(LESSON, {
      bundleDir: d.bundle,
      starterDir: d.starter,
      solutionDir: dead,
      grade: async () => DREW
    });

    expect(result.written).toBe(false);
    expect(fs.existsSync(d.bundle)).toBe(false);
    expect(result.report).toMatch(/F2 dead on solution:\s+FAIL/);
    // Phase 64 — a refusal is graded by what it wrote.
    expect(result.report).toMatch(/Fix the condition, or fix the solution/);
  });

  it('🔴 refuses when the render never ran, and names the escape', async () => {
    const d = dirs();
    const result = await writeLessonBundle(LESSON, {
      bundleDir: d.bundle,
      starterDir: d.starter,
      solutionDir: d.solution,
      skipRender: true
    });

    expect(result.written).toBe(false);
    expect(result.scorecard.classes.F4).toBe('not-checked');
    expect(result.refusal).toMatch(/allow_unrendered/);
  });

  it('writes with F4 deliberately unchecked when the escape is taken', async () => {
    const d = dirs();
    const result = await writeLessonBundle(LESSON, {
      bundleDir: d.bundle,
      starterDir: d.starter,
      solutionDir: d.solution,
      skipRender: true,
      allowUnrendered: true
    });

    expect(result.written).toBe(true);
    expect(result.scorecard.classes.F4).toBe('not-checked');
  });

  it('🔴 refuses to merge a bundle into a directory holding something else', async () => {
    // The caller is a model that was just handed a path. Pointed at a project or
    // a repo, the merge would scatter component files through it with no undo.
    const d = dirs();
    const occupied = tmp('occupied');
    fs.writeFileSync(path.join(occupied, 'README.md'), '# not a lesson');

    await expect(
      writeLessonBundle(LESSON, {
        bundleDir: occupied,
        starterDir: d.starter,
        solutionDir: d.solution,
        grade: async () => DREW
      })
    ).rejects.toThrow(/already contains other files/);

    expect(fs.existsSync(path.join(occupied, 'components'))).toBe(false);
  });

  it('allows re-writing over a bundle it produced, so authoring can iterate', async () => {
    const d = dirs();
    const opts = { bundleDir: d.bundle, starterDir: d.starter, solutionDir: d.solution, grade: async () => DREW };

    expect((await writeLessonBundle(LESSON, opts)).written).toBe(true);
    expect((await writeLessonBundle({ ...LESSON, title: 'Second draft' }, opts)).written).toBe(true);

    const written = JSON.parse(fs.readFileSync(path.join(d.bundle, MANIFEST_FILE), 'utf8'));
    expect(written.title).toBe('Second draft');
  });
});
