/**
 * P79 D1 — a condition whose UNIT a learner can never type.
 *
 * F2 replays each condition against the solution, and the solution is written
 * by the authoring tool as `{ value: 560, unit: "px" }`. The learner types `560`
 * into **Max Width** and the panel commits the port's `defaultUnit` — `%` for
 * `Group.maxWidth` — unless they change the dropdown. Every class passed, the
 * bundle shipped, and the step would refuse correct work. Caught by hand in
 * lesson 2; the verifier now warns, naming the step, unless the body says the
 * unit — which lesson 2's does, and that arm is the control.
 */
import { verifyLessonBundle } from '../../src/editor/src/models/lessonbundleverify';
import { buildLessonEvalContext } from '../../src/editor/src/models/lessonprojectcontext';
import type { LessonProjectSource } from '../../src/editor/src/models/lessonprojectcontext';
import type { LessonManifest } from '../../src/editor/src/models/lessonformat';

const HOME = '/#__page__/Home';

function solution(maxWidth: unknown): LessonProjectSource {
  return {
    components: [
      {
        registryPath: '__page__/Home',
        component: { id: 'home', name: 'Home', path: HOME, type: 'visual' },
        nodes: {
          componentId: 'home',
          visualRoots: ['page-1'],
          nodes: [
            { id: 'page-1', type: 'Page', children: ['board'] },
            { id: 'board', type: 'Group', label: 'Board', parent: 'page-1', parameters: { maxWidth, paddingLeft: 16 } }
          ]
        },
        connections: { componentId: 'home', connections: [] }
      }
    ]
  };
}

function manifest(body: string, paramsEqual: Record<string, unknown>): LessonManifest {
  return {
    format: 'noodl-lesson@1',
    title: 'Boxes',
    steps: [{ title: 'Give the row its own box', body, completeWhen: [{ node: `${HOME}:%Page:#Board`, paramsEqual }] }]
  };
}

async function unitWarnings(body: string, value: unknown) {
  const source = solution(value);
  const card = await verifyLessonBundle(manifest(body, { maxWidth: value }), {
    solution: buildLessonEvalContext(source)
  });
  return { card, unit: card.findings.filter((f) => f.code === 'unit-unsaid') };
}

describe('P79 D1 — a unit the prose never says', () => {
  const PX = { value: 560, unit: 'px' };

  it('🔴 warns when a paramsEqual grades a non-default unit and the body does not name it', async () => {
    const { card, unit } = await unitWarnings('Set **Max Width** to `560`.', PX);
    // The replay is green — that is the whole point: nothing else can see this.
    expect(card.classes.F2).toBe('pass');
    expect(unit).toHaveLength(1);
    expect(unit[0].severity).toBe('warning');
    expect(unit[0].step).toBe(0);
    expect(unit[0].message).toContain('Max Width');
    expect(unit[0].message).toContain('560px');
    expect(unit[0].message).toContain('default unit "%"');
    expect(unit[0].message).toContain('560%');
    // A warning, not a refusal: lesson 2 does this on purpose.
    expect(card.ok).toBe(true);
  });

  it('is silent when the body names the unit — lesson 2, verbatim', async () => {
    const { unit } = await unitWarnings('**Max Width** to `560`, with its unit set to **px**', PX);
    expect(unit).toEqual([]);
  });

  it('only reads the body: a unit named in detail alone still warns', async () => {
    const source = solution(PX);
    const m = manifest('Set **Max Width** to `560`.', { maxWidth: PX });
    m.steps[0].detail = 'The unit dropdown should say px.';
    const card = await verifyLessonBundle(m, { solution: buildLessonEvalContext(source) });
    expect(card.findings.filter((f) => f.code === 'unit-unsaid')).toHaveLength(1);
  });

  it('is silent when the graded unit IS the default, and for a port with a single unit', async () => {
    const pct = await unitWarnings('Set **Max Width** to `50`.', { value: 50, unit: '%' });
    expect(pct.unit).toEqual([]);

    // paddingLeft declares units: ["px"] — there is no dropdown to get wrong.
    const source = solution(PX);
    const card = await verifyLessonBundle(
      manifest('Set **Pad Left** to `16`.', { paddingLeft: { value: 16, unit: 'px' } }),
      { solution: buildLessonEvalContext(source) }
    );
    expect(card.findings.filter((f) => f.code === 'unit-unsaid')).toEqual([]);
  });

  it('does not match the unit inside another word', async () => {
    // "pixel" contains "px"? No — but "vw" inside "view" would. Use vw to prove the word boundary.
    const { unit } = await unitWarnings('Set **Max Width** so it fills the view.', { value: 80, unit: 'vw' });
    expect(unit).toHaveLength(1);
  });
});
