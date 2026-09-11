/**
 * UNI-010 — `derive_starter` on a real temp disk.
 *
 * The pure subtraction is graded in the editor's own suite
 * (`tests-unit/uni-010/lessonstarter.test.ts`), as a control pair: solution arm
 * asserts the step holds, starter arm asserts it does not. What is left for this
 * side is everything that only exists once a filesystem is involved, and the two
 * that matter most are:
 *
 * 1. 🔴 **What the derivation does NOT model must survive the copy.** It knows
 *    about `nodes.json`, `connections.json` and project `metadata`. A project
 *    directory holds styles, routes, settings and assets, none of which any
 *    lesson step asks a learner to build — so a starter rebuilt from the model
 *    instead of copied would silently ship without them, and the lesson would
 *    still run. That is the invisible version of this bug, which is why it has a
 *    spec rather than a comment.
 * 2. 🔴 **The two tools compose, and F2′ is checked twice on independent paths.**
 *    `derive_starter` guarantees no graded step survives; `create_lesson` then
 *    checks it again through the scorecard. If the guarantee made the check
 *    vacuous this would be theatre — so the last block asserts the *gate* passes
 *    F2′ on a derived starter and fails it on the solution used as its own
 *    starter, which is the pair the guarantee is supposed to separate.
 */

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import { writeDerivedStarter } from '../src/lessons/starterWriter';
import { scoreLesson } from '../src/lessons/bundleWriter';
import { MANIFEST_FILE, SOLUTION_DIR } from '../src/editor-deps';
import type { LessonManifest, WholeSolutionResult } from '../src/editor-deps';
import { ToolError } from '../src/errors';

// ─── Fixtures ───────────────────────────────────────────────────────────────

function tmp(name: string): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), `uni010-starter-${name}-`));
}

interface StoredNode {
  id: string;
  type: string;
  label?: string;
  parent?: string;
  children?: string[];
  parameters?: Record<string, unknown>;
}

const SOLUTION_NODES: StoredNode[] = [
  { id: 'page-1', type: 'Page', children: ['text-1'] },
  { id: 'text-1', type: 'Text', label: 'Greeting', parameters: { text: 'Hello' }, parent: 'page-1' }
];

/**
 * A v2 project, plus two files the derivation has never heard of.
 *
 * ⚠️ The component's `path` is its legacy name and deliberately not its
 * directory, matching every other fixture in this package — a project shape where
 * the two agree is one the editor never writes.
 */
function writeSolution(dir: string, nodes: StoredNode[] = SOLUTION_NODES): string {
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
  fs.writeFileSync(
    path.join(dir, 'nodegx.project.json'),
    JSON.stringify({ name: 'Lesson project', version: 3, rootNodeId: 'page-1', metadata: { styles: { theme: 'dark' } } })
  );

  // The two the derivation does not model, and must not lose.
  fs.writeFileSync(path.join(dir, 'styles.json'), JSON.stringify({ tokens: { brand: '#ff0000' } }));
  fs.mkdirSync(path.join(dir, 'assets'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'assets', 'logo.svg'), '<svg/>');

  return dir;
}

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

function readJson<T>(...parts: string[]): T {
  return JSON.parse(fs.readFileSync(path.join(...parts), 'utf8')) as T;
}

// ─── What is written ────────────────────────────────────────────────────────

describe('derive_starter writes a project', () => {
  it('subtracts the step and keeps everything the derivation does not model', () => {
    const solutionDir = writeSolution(tmp('solution'));
    const starterDir = path.join(tmp('out'), 'starter');

    const result = writeDerivedStarter(LESSON, { solutionDir, starterDir });
    expect(result.written).toBe(true);

    // The subtraction happened.
    const nodes = readJson<{ nodes: StoredNode[] }>(starterDir, 'components', '__page__', 'Home', 'nodes.json');
    expect(nodes.nodes.map((n) => n.id)).toEqual(['page-1']);
    expect(nodes.nodes[0].children).toEqual([]);

    // 🔴 And everything else came through. A starter rebuilt from
    // `LessonProjectSource` would pass the assertion above and fail all of these.
    expect(readJson<{ tokens: unknown }>(starterDir, 'styles.json')).toEqual({ tokens: { brand: '#ff0000' } });
    expect(fs.readFileSync(path.join(starterDir, 'assets', 'logo.svg'), 'utf8')).toBe('<svg/>');
    expect(fs.existsSync(path.join(starterDir, 'components', '__page__', 'Home', 'component.json'))).toBe(true);

    // 🔴 Including the keys of `nodegx.project.json` that are not `metadata`.
    // Writing that file from the model rather than editing it would drop the
    // project's own name and version.
    const project = readJson<Record<string, unknown>>(starterDir, 'nodegx.project.json');
    expect(project.name).toBe('Lesson project');
    expect(project.version).toBe(3);
    expect(project.rootNodeId).toBe('page-1');
    expect(project.metadata).toEqual({ styles: { theme: 'dark' } });
  });

  it('does not touch the solution directory', () => {
    const solutionDir = writeSolution(tmp('solution'));
    const before = readJson<{ nodes: StoredNode[] }>(solutionDir, 'components', '__page__', 'Home', 'nodes.json');

    writeDerivedStarter(LESSON, { solutionDir, starterDir: path.join(tmp('out'), 'starter') });

    const after = readJson<{ nodes: StoredNode[] }>(solutionDir, 'components', '__page__', 'Home', 'nodes.json');
    expect(after).toEqual(before);
    expect(after.nodes).toHaveLength(2);
  });

  it('drops a manifest and a nested solution rather than copying a bundle into a starter', () => {
    const solutionDir = writeSolution(tmp('solution'));
    fs.writeFileSync(path.join(solutionDir, MANIFEST_FILE), JSON.stringify(LESSON));
    fs.mkdirSync(path.join(solutionDir, SOLUTION_DIR), { recursive: true });
    fs.writeFileSync(path.join(solutionDir, SOLUTION_DIR, 'marker'), 'x');

    const starterDir = path.join(tmp('out'), 'starter');
    const result = writeDerivedStarter(LESSON, { solutionDir, starterDir });

    expect(result.written).toBe(true);
    // Reported, not silent: a caller who pointed at a bundle by accident needs
    // to know the copy was not faithful.
    expect(result.droppedFromCopy.sort()).toEqual([MANIFEST_FILE, SOLUTION_DIR].sort());
    expect(fs.existsSync(path.join(starterDir, MANIFEST_FILE))).toBe(false);
    expect(fs.existsSync(path.join(starterDir, SOLUTION_DIR))).toBe(false);
  });
});

// ─── A refusal writes nothing ───────────────────────────────────────────────

describe('a refusal', () => {
  it('leaves no starter on disk when a step would survive the subtraction', () => {
    const solutionDir = writeSolution(tmp('solution'));
    const starterDir = path.join(tmp('out'), 'starter');

    const unretractable: LessonManifest = {
      format: 'noodl-lesson@1',
      title: 'A lesson that cannot be subtracted',
      steps: [
        {
          title: 'Make this the start page',
          body: 'Set it as the visual root.',
          completeWhen: [{ node: '/#__page__/Home:%Page', isVisualRoot: true }]
        }
      ]
    };

    const result = writeDerivedStarter(unretractable, { solutionDir, starterDir });

    expect(result.written).toBe(false);
    // The refusal names the reason, not merely the fact — otherwise it is
    // indistinguishable from the mechanism being absent.
    expect(result.refusal).toContain('cannot render at all');
    expect(result.stillSatisfied).toHaveLength(1);
    // 🔴 Score-then-write: nothing reached disk at all.
    expect(fs.existsSync(starterDir)).toBe(false);
  });
});

// ─── The path guards ────────────────────────────────────────────────────────

describe('the path guards', () => {
  it('refuses to write the starter over the solution', () => {
    const solutionDir = writeSolution(tmp('solution'));
    expect(() => writeDerivedStarter(LESSON, { solutionDir, starterDir: solutionDir })).toThrow(ToolError);
    try {
      writeDerivedStarter(LESSON, { solutionDir, starterDir: solutionDir });
    } catch (e) {
      expect((e as ToolError).message).toContain('destroy the answer');
    }
  });

  it('refuses either directory nested inside the other', () => {
    const solutionDir = writeSolution(tmp('solution'));
    expect(() =>
      writeDerivedStarter(LESSON, { solutionDir, starterDir: path.join(solutionDir, 'starter') })
    ).toThrow(/inside solution_dir/);

    const outer = tmp('outer');
    const inner = writeSolution(path.join(outer, 'solution'));
    expect(() => writeDerivedStarter(LESSON, { solutionDir: inner, starterDir: outer })).toThrow(
      /inside starter_dir/
    );
  });

  it('refuses a directory that already holds something', () => {
    const solutionDir = writeSolution(tmp('solution'));
    const starterDir = tmp('occupied');
    fs.writeFileSync(path.join(starterDir, 'notes.txt'), 'mine');

    expect(() => writeDerivedStarter(LESSON, { solutionDir, starterDir })).toThrow(/not empty/);
    expect(fs.readFileSync(path.join(starterDir, 'notes.txt'), 'utf8')).toBe('mine');
  });

  it('refuses a solution directory that is not a project', () => {
    const solutionDir = tmp('empty');
    expect(() => writeDerivedStarter(LESSON, { solutionDir, starterDir: path.join(tmp('out'), 's') })).toThrow(
      /_registry\.json/
    );
  });
});

// ─── The two tools compose, and F2′ still means something ───────────────────

describe('the derived starter against the real gate', () => {
  const rendered: WholeSolutionResult = {
    valid: true,
    rendered: true,
    drawnElementCount: 2,
    findings: [],
    renderDefects: []
  };

  it('passes F2 and F2′ through create_lesson\'s own scorecard', async () => {
    const solutionDir = writeSolution(tmp('solution'));
    const starterDir = path.join(tmp('out'), 'starter');
    expect(writeDerivedStarter(LESSON, { solutionDir, starterDir }).written).toBe(true);

    const scored = await scoreLesson(LESSON, {
      starterDir,
      solutionDir,
      grade: async () => rendered
    });

    expect(scored.scorecard.classes.F2).toBe('pass');
    expect(scored.installable).toBe(true);
  });

  it('and the gate still fails F2′ when the starter IS the solution', async () => {
    // 🔴 The other arm, and the reason the arm above is worth running. If
    // `derive_starter`'s guarantee had quietly made F2′ unable to fail, the test
    // above would pass over a dead check. This is the same lesson used as its own
    // starter — the defect the derivation exists to make structurally hard — and
    // the gate must still catch it on its own, independent code path.
    const solutionDir = writeSolution(tmp('solution'));

    const scored = await scoreLesson(LESSON, {
      starterDir: solutionDir,
      solutionDir,
      grade: async () => rendered
    });

    expect(scored.scorecard.classes.F2).toBe('fail');
    expect(scored.scorecard.findings.map((f) => f.code)).toContain('already-satisfied-in-starter');
    expect(scored.installable).toBe(false);
  });
});

// ─── P79 L1 + D4: the component the learner creates, and the registry that counted the solution ──

describe('a component every node of which was subtracted (P79 L1) and the registry counts (P79 D4)', () => {
  /**
   * Lesson 8's shape: Home, plus a `/Snack` component the learner creates and
   * nothing else refers to. The registry carries the solution's counts and the
   * fields the editor writes around them.
   */
  function writeSnacksSolution(dir: string): string {
    const homeDir = path.join(dir, 'components', '__page__', 'Home');
    const snackDir = path.join(dir, 'components', 'Snack');
    fs.mkdirSync(homeDir, { recursive: true });
    fs.mkdirSync(snackDir, { recursive: true });

    fs.writeFileSync(
      path.join(dir, 'components', '_registry.json'),
      JSON.stringify({
        $schema: 'https://opennoodl.dev/schemas/registry-v2.json',
        version: 1,
        lastUpdated: '2026-09-06T08:00:00.000Z',
        components: {
          '__page__/Home': {
            path: '__page__/Home',
            type: 'page',
            nodeCount: 2,
            connectionCount: 0,
            created: '2026-08-28T20:36:41.603Z'
          },
          Snack: { path: 'Snack', type: 'visual', nodeCount: 1, connectionCount: 0, created: '2026-09-06T08:00:00.000Z' }
        },
        stats: { totalComponents: 2, totalNodes: 3, totalConnections: 0 }
      })
    );
    fs.writeFileSync(
      path.join(homeDir, 'component.json'),
      JSON.stringify({ id: 'home', name: 'Home', path: '/#__page__/Home', type: 'visual' })
    );
    fs.writeFileSync(path.join(homeDir, 'nodes.json'), JSON.stringify({ componentId: 'home', nodes: SOLUTION_NODES }));
    fs.writeFileSync(path.join(homeDir, 'connections.json'), JSON.stringify({ componentId: 'home', connections: [] }));

    fs.writeFileSync(
      path.join(snackDir, 'component.json'),
      JSON.stringify({ id: 'snack', name: 'Snack', path: '/Snack', type: 'visual' })
    );
    fs.writeFileSync(
      path.join(snackDir, 'nodes.json'),
      JSON.stringify({ componentId: 'snack', nodes: [{ id: 'row-1', type: 'Group', label: 'Snack row' }] })
    );
    fs.writeFileSync(path.join(snackDir, 'connections.json'), JSON.stringify({ componentId: 'snack', connections: [] }));

    fs.writeFileSync(
      path.join(dir, 'nodegx.project.json'),
      JSON.stringify({ name: 'Snacks', version: 3, rootNodeId: 'page-1', metadata: {} })
    );
    return dir;
  }

  const SNACKS: LessonManifest = {
    format: 'noodl-lesson@1',
    title: 'Snacks',
    steps: [
      {
        title: 'Add a Text node',
        body: 'Add it.',
        completeWhen: [{ node: '/#__page__/Home:%Page:#Greeting', hasType: 'Text' }]
      },
      {
        title: 'Design one snack',
        body: 'Make a component called Snack with a Group in it.',
        completeWhen: [{ node: '/Snack:#Snack row', hasType: 'Group' }]
      }
    ]
  };

  interface Registry {
    $schema?: string;
    version?: number;
    lastUpdated?: string;
    components: Record<string, { path?: string; type?: string; nodeCount?: number; connectionCount?: number; created?: string }>;
    stats?: { totalComponents: number; totalNodes: number; totalConnections: number };
  }

  it('leaves neither the directory nor the registry entry of the dropped component in the starter', () => {
    const solutionDir = writeSnacksSolution(tmp('snacks'));
    const starterDir = path.join(tmp('out'), 'starter');

    const result = writeDerivedStarter(SNACKS, { solutionDir, starterDir });
    expect(result.written).toBe(true);
    expect(result.removedComponents).toEqual(['Snack']);

    // 🔴 The row: an empty `components/Snack` used to come across with the copy.
    expect(fs.existsSync(path.join(starterDir, 'components', 'Snack'))).toBe(false);
    const registry = readJson<Registry>(starterDir, 'components', '_registry.json');
    expect(Object.keys(registry.components)).toEqual(['__page__/Home']);

    // The solution still has it — derived FROM, never written TO.
    expect(fs.existsSync(path.join(solutionDir, 'components', 'Snack', 'nodes.json'))).toBe(true);
    expect(Object.keys(readJson<Registry>(solutionDir, 'components', '_registry.json').components).sort()).toEqual(
      ['Snack', '__page__/Home']
    );
  });

  it('counts the starter in _registry.json, not the solution, and leaves every other key as it was', () => {
    const solutionDir = writeSnacksSolution(tmp('snacks'));
    const starterDir = path.join(tmp('out'), 'starter');
    writeDerivedStarter(SNACKS, { solutionDir, starterDir });

    const registry = readJson<Registry>(starterDir, 'components', '_registry.json');
    const home = registry.components['__page__/Home'];

    // Home lost its Text: two nodes in the solution, one in the starter. The
    // verbatim copy said 2 — every shipped starter did, until this was written.
    expect(home.nodeCount).toBe(1);
    expect(home.connectionCount).toBe(0);
    expect(registry.stats).toEqual({ totalComponents: 1, totalNodes: 1, totalConnections: 0 });

    // Read-modify-write: nothing the writer does not re-derive is touched.
    expect(home.path).toBe('__page__/Home');
    expect(home.type).toBe('page');
    expect(home.created).toBe('2026-08-28T20:36:41.603Z');
    expect(registry.$schema).toBe('https://opennoodl.dev/schemas/registry-v2.json');
    expect(registry.version).toBe(1);
    expect(registry.lastUpdated).toBe('2026-09-06T08:00:00.000Z');

    // And the control on the numbers: the solution's registry still counts the solution.
    const solutionRegistry = readJson<Registry>(solutionDir, 'components', '_registry.json');
    expect(solutionRegistry.components['__page__/Home'].nodeCount).toBe(2);
    expect(solutionRegistry.stats?.totalNodes).toBe(3);
  });

  it('keeps a component, empty, when the page still places it — and says so', () => {
    const solutionDir = writeSnacksSolution(tmp('snacks'));
    // Home now carries an instance of /Snack that no step grades.
    const homeNodes = path.join(solutionDir, 'components', '__page__', 'Home', 'nodes.json');
    fs.writeFileSync(
      homeNodes,
      JSON.stringify({
        componentId: 'home',
        nodes: [
          { id: 'page-1', type: 'Page', children: ['text-1', 'inst-1'] },
          { id: 'text-1', type: 'Text', label: 'Greeting', parameters: { text: 'Hello' }, parent: 'page-1' },
          { id: 'inst-1', type: '/Snack', label: 'One snack', parent: 'page-1' }
        ]
      })
    );
    const registryFile = path.join(solutionDir, 'components', '_registry.json');
    const reg = JSON.parse(fs.readFileSync(registryFile, 'utf8')) as Registry;
    reg.components['__page__/Home'].nodeCount = 3;
    fs.writeFileSync(registryFile, JSON.stringify(reg));

    const starterDir = path.join(tmp('out'), 'starter');
    const result = writeDerivedStarter(SNACKS, { solutionDir, starterDir });
    expect(result.written).toBe(true);
    expect(result.removedComponents).toEqual([]);

    expect(readJson<{ nodes: unknown[] }>(starterDir, 'components', 'Snack', 'nodes.json').nodes).toEqual([]);
    const registry = readJson<Registry>(starterDir, 'components', '_registry.json');
    expect(registry.components.Snack.nodeCount).toBe(0);
    expect(registry.components['__page__/Home'].nodeCount).toBe(2);
    expect(registry.stats).toEqual({ totalComponents: 2, totalNodes: 2, totalConnections: 0 });
    expect(result.retractions.some((r) => r.detail.includes('is an instance of it'))).toBe(true);
  });
});
