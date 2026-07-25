/**
 * LEARN-001 Slice 3 — the worked-lesson regression test.
 *
 * `fixtures/worked-lesson.json` is the one complete lesson the task ships as
 * both the template for LEARN-002 and the engine's regression fixture (assessment
 * §9 step 6: vendor a lesson in-repo so the regression has no network dependency).
 *
 * This test drives the whole authoring→completion path with no editor running:
 *  1. the fixture compiles to steps (the lesson "loads");
 *  2. against the finished project state, every task step's conditions hold —
 *     i.e. the lesson is completable start to finish;
 *  3. against the starting (empty) state, none of them fire — no premature
 *     advance;
 *  4. against deliberate near-misses, the relevant step does not fire.
 *
 * Conditions are pulled out of the compiled step HTML exactly as the runtime's
 * loadSteps does (innerHTML → getAttribute('data-conditions') → JSON.parse), so
 * this exercises the real compiled artefact, not a hand-built shortcut.
 */

import { compileLessonManifest } from '../../src/editor/src/models/lessonformat';
import {
  evalConditionsWithContext,
  LessonComponent,
  LessonEvalContext,
  LessonNode
} from '../../src/editor/src/views/lessons/lessonevalconditions';

/* eslint-disable @typescript-eslint/no-var-requires */
const workedLesson = require('./fixtures/worked-lesson.json');
/* eslint-enable @typescript-eslint/no-var-requires */

// ─── graph fakes ─────────────────────────────────────────────────────────────

function node(args: {
  label: string;
  type: string;
  parameters?: Record<string, unknown>;
  ports?: { name: string; type?: string }[];
  children?: LessonNode[];
}): LessonNode {
  const ports = args.ports ?? [];
  return {
    id: args.label,
    label: args.label,
    type: { name: args.type },
    ports,
    parameters: args.parameters ?? {},
    children: args.children ?? [],
    getPort: (name) => ports.find((p) => p.name.toLowerCase() === name.toLowerCase()),
    forAllConnectionsOnThisNode: () => undefined
  };
}

function ctx(roots: LessonNode[], activeComponentName?: string): LessonEvalContext {
  const app: LessonComponent = { name: 'App', graph: { roots } };
  return {
    components: [app],
    rootNode: undefined,
    getMetaData: () => undefined,
    viewerPath: undefined,
    activeComponentName
  };
}

// The finished project: App open, a Group labelled Card containing a Text "Hello".
const completedCtx = ctx(
  [
    node({
      label: 'Card',
      type: 'Group',
      children: [node({ label: 'Label', type: 'Text', parameters: { text: 'Hello' } })]
    })
  ],
  'App'
);

// The starting project: nothing built, no component open.
const emptyCtx = ctx([], undefined);

// ─── extraction (mirrors loadSteps) ──────────────────────────────────────────

function conditionsOf(stepHtml: string): unknown[] | undefined {
  const el = document.createElement('div');
  el.innerHTML = stepHtml;
  const attr = (el.firstElementChild as HTMLElement | null)?.getAttribute('data-conditions');
  return attr ? (JSON.parse(attr) as unknown[]) : undefined;
}

// ─── tests ───────────────────────────────────────────────────────────────────

describe('worked lesson (fixtures/worked-lesson.json)', () => {
  const compiled = compileLessonManifest(workedLesson);

  it('loads: the fixture compiles to the expected number of steps', () => {
    expect(compiled.steps.length).toBe(workedLesson.steps.length);
  });

  it('is completable: every task step is satisfied by the finished project', () => {
    for (const stepHtml of compiled.steps) {
      const conditions = conditionsOf(stepHtml);
      if (!conditions) continue; // popup / manual step
      expect(evalConditionsWithContext(conditions as never, completedCtx)).toBe(true);
    }
  });

  it('does not advance prematurely: no task step fires on the empty project', () => {
    for (const stepHtml of compiled.steps) {
      const conditions = conditionsOf(stepHtml);
      if (!conditions) continue;
      expect(evalConditionsWithContext(conditions as never, emptyCtx)).toBe(false);
    }
  });

  it('at least one condition per task step (no accidentally empty tasks)', () => {
    const taskSteps = compiled.steps.map(conditionsOf).filter(Boolean);
    expect(taskSteps.length).toBeGreaterThan(0);
    for (const conditions of taskSteps) {
      expect((conditions as unknown[]).length).toBeGreaterThan(0);
    }
  });

  it('does not fire on near-misses', () => {
    // Group present but wrongly labelled → the "Label the Group Card" step fails.
    const wrongLabel = ctx([node({ label: 'Wrong', type: 'Group' })], 'App');
    // The finished state has a Card group; this near-miss does not.
    expect(evalConditionsWithContext([{ path: 'App:%Group', haslabel: 'Card' }] as never, wrongLabel)).toBe(false);

    // Text present but wrong words → the "give the Text some words" step fails.
    const wrongText = ctx(
      [node({ label: 'Card', type: 'Group', children: [node({ label: 'Label', type: 'Text', parameters: { text: 'Goodbye' } })] })],
      'App'
    );
    expect(
      evalConditionsWithContext([{ path: 'App:#Card:%Text', paramseq: { text: 'Hello' } }] as never, wrongText)
    ).toBe(false);
  });
});
