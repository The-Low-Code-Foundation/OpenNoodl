/**
 * SBR-013 — the doctrine rule, on the wire and in the conventions.
 *
 * ## The trap this file is shaped around
 *
 * SBR-013 §4: *"A ruling names a place; ruling ≠ checking it — grep for every
 * seam where authoring guidance is emitted (instructions, tool descriptions,
 * briefs, lessons) before declaring the doctrine landed; an instruction added in
 * one of three surfaces is a third of a rule."*
 *
 * Measured while building it, and it is the reason the enumeration below is not
 * theatre: of the six doctrine strings that reach a model, **exactly one**
 * (`DESIGN_PLANNING`, the in-editor planner's) already stated the order. The
 * five that an EXTERNAL agent reads — which is what built phase 77's template —
 * did not. The rule was two-thirds absent while looking present from inside the
 * editor.
 *
 * ## Three seams, three assertions, and the third is the artefact
 *
 * | seam | who reads it | graded by |
 * |---|---|---|
 * | `instructions` (bound) | every session, at `initialize` | §1 here |
 * | `get_project_info` doctrine fields | an external agent before it authors | §2 here, **over the wire** |
 * | the lesson brief | a model writing a lesson's solution project | §3 here |
 * | the six prompt constants | the in-editor loop | `noodl-editor/tests-unit/sbr-013` |
 *
 * §2 goes through a real server rather than importing the constant, for the
 * reason this repo keeps relearning: a doctrine correct in its module and
 * dropped by the thing that assembles the response is invisible to a constant
 * check, and `authoringDoctrine`/`designDoctrine` are gated on `allowWrites`.
 *
 * ## Why the budget is asserted HERE as well as in `toolDisclosure.test.ts`
 *
 * The resident surface had **6 tokens of headroom** when this task opened
 * (8,274 against the 8,280 bar). An ordering change that spent them would have
 * left the next arrival with nothing and made this task the one that forced a
 * third renegotiation the gate's own header says must not happen. So the
 * instruction edit was written to be net-NEGATIVE — `get_style_vocabulary` moved
 * out of the per-component sentence and into the order, which is a move rather
 * than an addition — and it measured 8,273 / 7 free. The assertion below pins
 * the direction, not the number: this paragraph may never be the thing that
 * grows the briefing.
 */
import * as fs from 'fs';
import * as path from 'path';

import { DESIGN_DOCTRINE_MD } from '../src/editor-deps';
import { projectInstructions } from '../src/instructions';
import { lessonAuthoringBrief } from '../src/lessons/authoringBrief';
import { call, connect, copyFixture, type TestSession } from './helpers';
import type { ProjectInfoResponse } from '../src/tools/responses';

const REPO = path.resolve(__dirname, '..', '..', '..');
const PHASE_77 = path.join(REPO, 'dev-docs', 'tasks', 'phase-77-the-site-builder-rescue');

/**
 * The bound briefing at the shape a real authoring session gets: writes on,
 * backend group deferred. The other two modes differ only in two clauses and
 * share this paragraph.
 */
const INSTRUCTIONS = projectInstructions({
  projectDir: '/tmp/example-project',
  allowWrites: true,
  deferTools: true
});

describe('SBR-013 §1 — the briefing states the order', () => {
  it('puts the look and the screen list before the component tree', () => {
    expect(INSTRUCTIONS).toContain('THE ORDER, FOR ANYTHING BIGGER THAN A TWO-NODE FIX');
    expect(INSTRUCTIONS).toMatch(/LOOK FIRST/);
    expect(INSTRUCTIONS).toMatch(/SCREEN LIST/);
  });

  it('🔴 names get_style_vocabulary BEFORE create_plan, which is the whole change', () => {
    // The positional assertion, copied from `instructions.test.ts`'s
    // list_projects/create_project pair and for the same reason: the ordering IS
    // the mitigation, so the ordering is what gets asserted. Before SBR-013 this
    // was the other way round — `get_style_vocabulary` appeared only in the
    // per-component sentence, three clauses AFTER `create_plan`, which is
    // component-first doctrine stated as a workflow.
    const look = INSTRUCTIONS.indexOf('get_style_vocabulary');
    const plan = INSTRUCTIONS.indexOf('create_plan');
    const author = INSTRUCTIONS.indexOf('create_component');
    expect(look).toBeGreaterThan(-1);
    expect(look).toBeLessThan(plan);
    expect(plan).toBeLessThan(author);
  });

  it('does not name a tool the reader cannot currently see', () => {
    // ⚠️ `set_project_tokens` and `set_style_preset` are in the DEFERRED `theme`
    // group. The AWP-006 paragraph in this same string is careful never to name
    // a hidden tool without naming its `find_tools` door in the same breath, and
    // an ordering rule pointing at a tool that is absent from `tools/list` would
    // produce a call, a refusal and a turn spent. They are named in
    // `designDoctrine` instead — §2 — which is where the door is named too.
    expect(INSTRUCTIONS).not.toContain('set_project_tokens');
    expect(INSTRUCTIONS).not.toContain('set_style_preset');
  });

  it('🔴 did not grow the briefing to say it', () => {
    // See the module header: 6 tokens of headroom on the resident surface. The
    // captured fixture is the pre-SBR-013 text with the project directory
    // substituted out, so this compares like with like.
    const fixture = fs.readFileSync(
      path.join(__dirname, 'fixtures', 'boundInstructions.deferred.txt'),
      'utf8'
    );
    const rendered = INSTRUCTIONS.split('/tmp/example-project').join('<PROJECT_DIR>');
    expect(rendered).toBe(fixture);
    // And the direction, stated so a future edit to this paragraph is told the
    // price rather than the refusal. 7,120 is the length shipped by SBR-013.
    expect(rendered.length).toBeLessThanOrEqual(7130);
  });
});

describe('SBR-013 §2 — the reasons and the tool names ride free, on the wire', () => {
  let session: TestSession;

  beforeAll(async () => {
    session = await connect(copyFixture(), true);
  });

  afterAll(async () => {
    await session.close();
  });

  it('get_project_info carries both doctrines, and both state the order', async () => {
    // 🔴 Over the wire, not off the constant. These two fields are gated on
    // `allowWrites` and assembled in `read.ts`; a doctrine that is correct in
    // `prompts/design.ts` and never reaches the response is the failure mode
    // this assertion exists for.
    const { isError, data } = await call<ProjectInfoResponse>(session, 'get_project_info', {});
    expect(isError).toBe(false);

    expect(typeof data.designDoctrine).toBe('string');
    expect(typeof data.authoringDoctrine).toBe('string');

    // ⚠️ CMP-004 AC1 (phase 85) added a third step to this section — the shelf,
    // between planning the tree and authoring the first leaf — so the heading
    // names four things now. The assertion this file cares about is unchanged:
    // the look and the screen list come before the components.
    expect(data.designDoctrine).toContain('The order: the look, then the screens, then the shelf, then the components');
    expect(data.authoringDoctrine).toMatch(/The order comes first/);
  });

  it('names the write tools AND the find_tools door they sit behind', async () => {
    // The half `instructions` cannot afford. A rule that says "settle the
    // identity" and never names the tool that settles it is advice; naming a
    // deferred tool without its door is a refused call. Both are here.
    const { data } = await call<ProjectInfoResponse>(session, 'get_project_info', {});
    const doctrine = String(data.designDoctrine);

    expect(doctrine).toContain('set_style_preset');
    expect(doctrine).toContain('set_project_tokens');
    expect(doctrine).toContain('find_tools({group:"theme"})');
  });

  it('states what "settled" means in terms a person can check', () => {
    // SBR-013's own rule applied to itself: the doctrine carries a person
    // sentence, so somebody can tell whether it was followed without reading a
    // graph. A doctrine whose compliance is only visible in a diff is one
    // nobody audits.
    expect(DESIGN_DOCTRINE_MD).toMatch(/read\s+back the accent, the surface ramp and the page list/);
  });
});

describe('SBR-013 §3 — the lesson brief builds its solution in the app order', () => {
  it('sends a lesson author to the vocabulary before the first node', () => {
    const brief = lessonAuthoringBrief();
    expect(brief).toMatch(/the look, then the\s+screens, then the components/);
    expect(brief).toContain('get_style_vocabulary');
    // The pointer, so the brief states the rule without restating the doctrine —
    // one substrate, not a second dialect of it.
    expect(brief).toContain('designDoctrine');
  });
});

describe('SBR-013 §4 (AC3) — the convention exists and this phase already complies', () => {
  it('the task template requires a person sentence and a person-verifiable criterion', () => {
    const template = fs.readFileSync(path.join(REPO, 'dev-docs', 'TASK-TEMPLATE.md'), 'utf8');
    expect(template).toContain('## The person sentence — REQUIRED');
    // The second half, and the one that does the work: a task can carry a person
    // sentence and still grade itself entirely with green suites, which is what
    // phase 77 did eighteen times.
    expect(template).toMatch(/verifiable by a person, not by a test/i);
  });

  it('🔴 every phase-77 task file carries one', () => {
    const files = fs
      .readdirSync(PHASE_77)
      .filter((f) => /^SBR-\d+.*\.md$/.test(f))
      .sort();

    // ✅ Cardinality first. An empty glob would make the loop below pass by
    // saying nothing at all, which is the failure this repo files under
    // "all([]) is the answer you wanted".
    expect(files.length).toBe(17);

    const missing = files.filter(
      (f) => !/person sentence/i.test(fs.readFileSync(path.join(PHASE_77, f), 'utf8'))
    );
    expect(missing).toEqual([]);
  });
});
