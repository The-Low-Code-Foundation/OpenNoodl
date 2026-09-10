/**
 * Phase 85 — CMP-001 AC1 and CMP-004 AC1, graded on the tool response.
 *
 * ## Why both ACs say "measured on the tool response, not the source"
 *
 * Both defects are shaped the same way: the fact was TRUE somewhere in the tree
 * and never reached the model. CMP-004's shelf is 42 installable entries and
 * three registered tools that no authoring text mentioned. CMP-001's enum input
 * is a real port in `states.ts` that the catalog described in one direction. A
 * constant check would have passed on both before the work, because in both
 * cases the source was already right and the SURFACE was not.
 *
 * ## 🔴 What session 2 measured that the task files got wrong
 *
 * CMP-001 §4 says the catalog "documents only the output". It does not: the
 * `runtimeBehavior` prose has always carried one clause naming the enum input,
 * and `runtimeBehavior` travels with the DEFAULT summary response, so it did
 * reach every reader. Measured on the live server before any edit.
 *
 * The defect that survives that correction is narrower and worse than the one
 * filed. Four surfaces answered "output", one clause answered "input", and the
 * sentence immediately AFTER that clause told an authoring tool what to do —
 * *"wire signals to `to-S`"* — naming only the other form. So the reader who
 * scanned the `ports` list saw `out currentState: string`; the reader who spent
 * a targeted `ports: ["currentState"]` query — the cheapest and most specific
 * question you can ask about this exact port — got a description that said
 * output and stopped; and the reader who read the prose to the end was told to
 * use signals. Hence the assertions below check the port DESCRIPTION and the
 * closing instruction, not merely that the string "currentState" appears
 * somewhere in the response.
 *
 * ⚠️ There was a second error in the same note, unfiled: it promised a
 * "reached/left" pair of signal outputs. There is no `left-<state>` port and
 * never has been (`states.ts` mints `to-`, `at-` and `reached-` only).
 */
import * as fs from 'fs';
import * as path from 'path';

import { DECOMPOSITION_PLANNING, DESIGN_DOCTRINE_MD } from '../src/editor-deps';
import { projectInstructions } from '../src/instructions';
import { call, connect, copyFixture, reveal, type TestSession } from './helpers';
import type { ListLibraryResponse } from '../src/tools/libraryTools';
import type { ProjectInfoResponse } from '../src/tools/responses';

interface NodeTypeSummary {
  typeName: string;
  ports?: string[];
  runtimeBehavior?: string;
  hasDynamicPorts?: boolean;
  dynamicPorts?: { description?: string };
  inputs?: { name: string; description?: string }[];
  outputs?: { name: string; description?: string }[];
}

interface GetNodeTypeResult {
  types: NodeTypeSummary[];
}

let session: TestSession;

beforeAll(async () => {
  session = await connect(copyFixture(), true);
});

afterAll(async () => {
  await session.close();
});

describe('CMP-001 AC1 — States.currentState is documented in BOTH directions', () => {
  it('🔴 the targeted port query names the enum input, not just the string output', async () => {
    // The narrowest question about this port, and before the fix the one whose
    // answer was most complete-looking and least true: `ports: [...]` returns
    // the authored per-port prose and nothing else about direction.
    const { isError, data } = await call<GetNodeTypeResult>(session, 'get_node_type', {
      type_names: ['States'],
      ports: ['currentState']
    });
    expect(isError).toBe(false);

    const states = data.types.find((t) => t.typeName === 'States');
    expect(states).toBeDefined();

    const described = [...(states!.inputs ?? []), ...(states!.outputs ?? [])].find(
      (p) => p.name === 'currentState'
    );
    expect(described).toBeDefined();
    const prose = String(described!.description);

    // Both directions, named as such.
    expect(prose).toMatch(/OUTPUT/);
    expect(prose).toMatch(/INPUT/);
    expect(prose).toMatch(/enum/i);
    // And the consequence, which is the reason the direction matters at all:
    // the one-wire variant selector this omission made undiscoverable.
    expect(prose).toContain('Component Inputs');
  });

  it('the default summary response says the enum input exists and how to choose between the two forms', async () => {
    const { isError, data } = await call<GetNodeTypeResult>(session, 'get_node_type', {
      type_names: ['States']
    });
    expect(isError).toBe(false);

    const behavior = String(data.types.find((t) => t.typeName === 'States')!.runtimeBehavior);
    expect(behavior).toMatch(/enum input named `currentState`/);

    // 🔴 The half that was actively wrong rather than merely absent. The old
    // closing sentence told an authoring tool to "wire signals to `to-S`" and
    // named no alternative, one sentence after mentioning the enum input.
    expect(behavior).not.toMatch(/wire signals to `to-S`, and read/);
    expect(behavior).toMatch(/wire a signal to `to-S` when an event causes the change/);
    expect(behavior).toMatch(/wire a VALUE to `currentState`/);
  });

  it('the dynamicPorts note names the enum input — and no longer promises a port that does not exist', async () => {
    const { data } = await call<GetNodeTypeResult>(session, 'get_node_type', {
      type_names: ['States'],
      detail: 'full'
    });
    const states = data.types.find((t) => t.typeName === 'States')!;
    const note = String(states.dynamicPorts?.description);

    expect(note).toMatch(/enum INPUT named `currentState`/);
    // `states.ts` mints `to-<state>`, `at-<state>` and `reached-<state>`. The
    // old note advertised a "left" output; nothing has ever generated one, so a
    // model looking for it spent a turn and found nothing.
    expect(note).not.toMatch(/reached\/left/);
    expect(note).toMatch(/`at-<state>`/);
  });

  it('🔴 the variant selector is a stated pattern — on the surface that actually carries patterns', () => {
    // ⚠️ MEASURED, and it cost this test a rewrite: `get_node_type` emits
    // NEITHER `patterns` NOR `antiPatterns` at ANY detail level. `catalog.ts`'s
    // `getNodeTypeDetail` copies summary, description, whenToUse,
    // runtimeBehavior, relatedNodes and dynamicPorts out of the enrichment and
    // stops. The two fields reach exactly one reader: the EDITOR's node-docs
    // panel (`noodl-editor/src/editor/src/utils/nodeDocs.ts:161`, "Watch out
    // for"), which is a person, not an agent.
    //
    // That is not this AC's to fix — AC1 is satisfied by the three fields the
    // wire DOES carry, asserted above — but it is why this assertion reads the
    // corpus rather than the response, and why it must not be quietly "fixed"
    // by pointing it at a tool call that would pass for the wrong reason. The
    // gap is filed in the phase README §7.
    const enriched = JSON.parse(
      fs.readFileSync(
        path.resolve(__dirname, '..', '..', 'noodl-types', 'src', 'node-catalog-enriched.json'),
        'utf8'
      )
    ) as { nodes: { typeName: string; enrichment?: { patterns?: string[]; antiPatterns?: string[] } }[] };
    const states = enriched.nodes.find((n) => n.typeName === 'States');
    expect(states).toBeDefined();

    const patterns = (states!.enrichment?.patterns ?? []).join('\n');
    const antiPatterns = (states!.enrichment?.antiPatterns ?? []).join('\n');

    expect(patterns).toMatch(/`Component Inputs\.<enum>` → `States\.currentState`/);
    // Citations, so the pattern can be checked against a real graph rather than
    // believed. All four are `Component Inputs.<enum> → States.currentState`
    // wires in `library/prefabs`.
    expect(patterns).toContain('toast');
    expect(patterns).toContain('xano');

    // The shape a model produced BECAUSE the input was undocumented, named as
    // the anti-pattern it is.
    expect(antiPatterns).toMatch(/One signal input per state plus a Condition or Switch chain/);
  });
});

describe('CMP-004 AC1 — the shelf is in THE ORDER', () => {
  it('🔴 get_project_info states the shelf step, over the wire', async () => {
    // Over the wire and not off the constant, for the SBR-013 reason: both
    // doctrine fields are gated on `allowWrites` and assembled in `read.ts`, so
    // a doctrine correct in `prompts/design.ts` and dropped by the assembler is
    // invisible to a constant check.
    const { isError, data } = await call<ProjectInfoResponse>(session, 'get_project_info', {});
    expect(isError).toBe(false);

    const doctrine = String(data.designDoctrine);
    expect(doctrine).toContain('**The shelf.**');
    expect(doctrine).toContain('list_library');
    expect(doctrine).toContain('get_library_entry({slug})');
    expect(doctrine).toContain('install_prefab({slug})');
  });

  it('puts the shelf AFTER the screens and BEFORE authoring, which is the whole point', async () => {
    // The positional assertion. A shelf mentioned somewhere is advice; a shelf
    // named in the slot between "plan the components" and "author them" is the
    // step CMP-004 AC1 asks for. Checking before the tree exists cannot tell you
    // whether an entry matches it; checking after the leaves are written is a
    // rewrite nobody does.
    const { data } = await call<ProjectInfoResponse>(session, 'get_project_info', {});
    const doctrine = String(data.designDoctrine);

    const screens = doctrine.indexOf('**The screens.**');
    const shelf = doctrine.indexOf('**The shelf.**');
    const author = doctrine.indexOf('Only then author them.');

    expect(screens).toBeGreaterThan(-1);
    expect(shelf).toBeGreaterThan(screens);
    expect(author).toBeGreaterThan(shelf);
  });

  it('names the never-overwrites guarantee, because that is what makes checking cheap', async () => {
    // A model that thinks installing might clobber its own work will not
    // install. `install_prefab` skips anything the project already has and
    // reports it; saying so is the difference between a step and a risk.
    const { data } = await call<ProjectInfoResponse>(session, 'get_project_info', {});
    expect(String(data.designDoctrine)).toMatch(/NEVER overwrites/);
  });

  it('🔴 did not grow the resident briefing to say it', () => {
    // CMP-004 AC1's constraint, and the reason this text lives in a result
    // field: the budgeted `instructions` string had 6 tokens of headroom
    // (`toolDisclosure.test.ts`). The shelf step must not have been paid for out
    // of it. Same direction assertion SBR-013 left behind, same bar.
    const instructions = projectInstructions({
      projectDir: '/tmp/example-project',
      allowWrites: true,
      deferTools: true
    });
    const rendered = instructions.split('/tmp/example-project').join('<PROJECT_DIR>');
    expect(rendered.length).toBeLessThanOrEqual(7130);
    expect(rendered).not.toContain('list_library');
  });

  it('the doctrine says WHY, which is the half the budgeted surface can never afford', () => {
    expect(DESIGN_DOCTRINE_MD).toMatch(/Why the shelf is a step and not a footnote/);
  });
});

describe('CMP-004 AC2 — the doctrine tells an agent to ASK the shelf, not browse it', () => {
  it('🔴 names the query and shows it being asked in the words of a part, over the wire', async () => {
    const { data } = await call<ProjectInfoResponse>(session, 'get_project_info', {});
    const doctrine = String(data.designDoctrine);

    // A step that says "call list_library and read the index" is a browse over 72 rows. AC2's
    // whole point is that an agent about to build a date formatter asks for one BY NAME.
    expect(doctrine).toContain('list_library({query: "date formatter"})');
    expect(doctrine).toMatch(/ASK IT FOR EACH PART YOU WERE ABOUT TO BUILD/);
  });

  it('🔴 warns off the tags, and says WHY rather than just saying so', async () => {
    const { data } = await call<ProjectInfoResponse>(session, 'get_project_info', {});
    const doctrine = String(data.designDoctrine);

    // A bare "do not use the tags" is a rule to be overridden by the next plausible thought. The
    // measurement travels with it: `Utilities` vs `Utility` is the reason, and it is checkable.
    expect(doctrine).toMatch(/Do not decide from the tags/i);
    expect(doctrine).toContain('`Utilities`');
    expect(doctrine).toContain('`Utility`');
  });

  /**
   * CMP-004 AC3. A field nobody is told to read is a field nobody reads — `size` exists to be
   * traded on, so the step that sends an agent to the shelf has to say what the numbers mean.
   */
  it('🔴 tells an agent what a row\'s size is FOR, and that nothing is labelled a part', async () => {
    const { data } = await call<ProjectInfoResponse>(session, 'get_project_info', {});
    const doctrine = String(data.designDoctrine);
    expect(doctrine).toContain('`size`');
    // Not the field name alone: the trade it stands for, in the two shapes it separates.
    expect(doctrine).toMatch(/part you wire into a graph/i);
    expect(doctrine).toMatch(/most of a screen/i);
    // And the reason there is no label, which is the same reason the tags are not to be trusted.
    expect(doctrine).toMatch(/cannot be typed wrong the way the tags were/i);
  });

  it('still puts the query step BEFORE authoring — advice after the leaves are written is a rewrite', async () => {
    const { data } = await call<ProjectInfoResponse>(session, 'get_project_info', {});
    const doctrine = String(data.designDoctrine);
    expect(doctrine.indexOf('query: "date formatter"')).toBeGreaterThan(doctrine.indexOf('**The screens.**'));
    expect(doctrine.indexOf('query: "date formatter"')).toBeLessThan(doctrine.indexOf('Only then author them.'));
  });
});

describe('CMP-004 AC2 — the query answers over the wire, not only in the index module', () => {
  // `list_library` lives in the deferred `explore` group — AWP-006's budget put it there — so it
  // has to be revealed before it can be called, exactly as a model would have to.
  beforeAll(async () => {
    await reveal(session, 'explore');
  });

  it("answers the AC's own worked example with the entry that formats dates", async () => {
    const { isError, data } = await call<ListLibraryResponse>(session, 'list_library', {
      query: 'is there a date formatter'
    });
    expect(isError).toBe(false);
    const slugs = data.entries.map((e) => e.slug);
    // 🔴 Session 4 asserted `intl-format` first, and it was the honest answer then. Session 5
    // put a real date formatter on the shelf (AC3), so the answer moved — both rows still come
    // back, and each description names the other. See `cmp004LibraryQuery.test.ts`.
    expect(slugs[0]).toBe('format-date');
    expect(slugs).toContain('intl-format');
    // Each row says why it is in the answer, so a model can judge the second-best rather than
    // trusting the first.
    expect(data.entries[0].matchedTerms).toEqual(expect.arrayContaining(['date', 'formatter']));
  });

  /**
   * CMP-004 AC3 — the row carries how big the entry is, over the wire and not only in the index
   * module. `size` is what an agent trades on: a 1-component/4-node row is a part you wire in, a
   * 25-component/155-node row is most of a screen. There is deliberately no `part` label — see
   * the header of `libraryShelf.ts` for the measurement that ruled one out.
   */
  it('🔴 every row says how much of your project it becomes', async () => {
    const { isError, data } = await call<ListLibraryResponse>(session, 'list_library', {});
    expect(isError).toBe(false);
    for (const row of data.entries) {
      expect(typeof row.size.components).toBe('number');
      expect(typeof row.size.nodes).toBe('number');
    }
    const bySlug = new Map(data.entries.map((e) => [e.slug, e.size]));
    // The two ends of the shelf, named rather than derived, so this reddens if either moves.
    expect(bySlug.get('format-date')).toEqual({ components: 1, nodes: 4 });
    expect(bySlug.get('stripe')!.nodes).toBeGreaterThan(100);
    // A code module ships node types, not a graph — zero is the honest answer, not a gap.
    expect(bySlug.get('lucide-icons')).toEqual({ components: 0, nodes: 0 });
    // And the note tells a model what the numbers are FOR, or they are two integers nobody reads.
    expect(data.note).toMatch(/size is what installing costs you/);
  });

  it('🔴 an empty answer is an ANSWER, and says what to do with it', async () => {
    const { data } = await call<ListLibraryResponse>(session, 'list_library', { query: 'xylophone tuning' });
    expect(data.entries).toEqual([]);
    // The sentence that turns "nothing here" into step 4 rather than into a silent from-scratch
    // build. Without it an empty list reads as "the shelf has no opinion".
    expect(data.note).toContain('export_to_library');
    expect(data.note).toMatch(/build the part/i);
  });

  it('says how many of how many, so a short answer is not mistaken for a small shelf', async () => {
    const { data } = await call<ListLibraryResponse>(session, 'list_library', { query: 'date' });
    expect(data.note).toMatch(/\d+ of \d+ entries match/);
    const { data: all } = await call<ListLibraryResponse>(session, 'list_library', {});
    expect(all.entries.length).toBeGreaterThan(data.entries.length);
  });

  it('the plain index is unchanged — a query is an addition, not a new default', async () => {
    const { data } = await call<ListLibraryResponse>(session, 'list_library', {});
    expect(data.entries.length).toBeGreaterThan(60);
    expect(data.entries.every((e) => e.matchedTerms === undefined)).toBe(true);
    expect(data.note).toMatch(/^\d+ entries\./);
  });
});

describe('CMP-004 AC4 — the return path is in THE ORDER too', () => {
  // 🔴 The round trip itself is graded in `cmp004RoundTrip.test.ts`, over two
  // real projects. What is asserted HERE is the half CMP-004 was originally
  // filed about: the shelf was real, it worked, and NOTHING TOLD AN AGENT IT
  // WAS THERE. A two-way path nobody is told about is the same defect a second
  // time — the tool exists, the loop still does not compound — so the sentence
  // that names it is graded on the same surface, over the wire, as AC1's.
  it('🔴 get_project_info names the tool that puts a part BACK, over the wire', async () => {
    const { isError, data } = await call<ProjectInfoResponse>(session, 'get_project_info', {});
    expect(isError).toBe(false);
    const doctrine = String(data.designDoctrine);
    expect(doctrine).toContain('export_to_library({component, slug,');
    expect(doctrine).toMatch(/when you have built something good, put it back/);
  });

  it('puts it AFTER authoring — it is what you do with a part, not a step before one exists', async () => {
    const { data } = await call<ProjectInfoResponse>(session, 'get_project_info', {});
    const doctrine = String(data.designDoctrine);
    const shelf = doctrine.indexOf('**The shelf.**');
    const author = doctrine.indexOf('Only then author them.');
    const back = doctrine.indexOf('export_to_library');
    expect(back).toBeGreaterThan(author);
    expect(author).toBeGreaterThan(shelf);
  });

  it('🔴 states the token rule, which is the one thing an exporter gets wrong', async () => {
    // A part exported with project A's colours baked in looks wrong in every
    // project that installs it, and the author cannot see that from project A.
    // The doctrine says tokens travel by NAME because that is the property that
    // makes an installed part wear the HOST project's look.
    const { data } = await call<ProjectInfoResponse>(session, 'get_project_info', {});
    expect(String(data.designDoctrine)).toMatch(/Design tokens travel by NAME/);
  });

  it('and did not grow the resident briefing to say it either', () => {
    const rendered = projectInstructions({
      projectDir: '/tmp/example-project',
      allowWrites: true,
      deferTools: true
    })
      .split('/tmp/example-project')
      .join('<PROJECT_DIR>');
    expect(rendered.length).toBeLessThanOrEqual(7130);
    expect(rendered).not.toContain('export_to_library');
  });

  it('says why a shelf that is only read is worth less than one that is written to', () => {
    expect(DESIGN_DOCTRINE_MD).toMatch(/why step 4 is what makes step 3 worth anything/);
  });
});

describe('CMP-003 AC1 — the doctrine stops forbidding the named utility', () => {
  it('🔴 the exclusion list no longer opens with "a single node", over the wire', async () => {
    // The measured harm: `/Global logical components/` + `/#Global logic
    // components/` in LearnBook v5.1 are 37 components instantiated 107 times,
    // and `Is Trainer check` (9 uses) and `Generate Google icon object` (9 uses)
    // are ONE working node each. The rule as shipped told a model not to build
    // the most reused shape in the app it was imitating.
    const { data } = await call<ProjectInfoResponse>(session, 'get_project_info', {});
    const doctrine = String(data.authoringDoctrine);

    expect(doctrine).toMatch(/\*\*When not to\.\*\*/);
    expect(doctrine).not.toMatch(/When not to\.\*\* A single node/);
    expect(doctrine).toMatch(/A named utility is a component however small it is/);
    // The replacement test, stated so it can be applied: a name, not a node count.
    expect(doctrine).toMatch(/Size is not the test/i);
  });

  it('the citations travel with the rule, so it can be checked instead of believed', async () => {
    const { data } = await call<ProjectInfoResponse>(session, 'get_project_info', {});
    const doctrine = String(data.authoringDoctrine);
    expect(doctrine).toContain('Format full name');
    expect(doctrine).toContain('107 times');
  });

  it('🔴 the PLANNER copy was corrected too, not just the markdown one', () => {
    // `prompts/decomposition.ts` ships the same doctrine three times — as
    // project-facing markdown, as the planner's prompt and as the authoring
    // prompt — and its own header warns that a copy which drifts from the
    // doctrine it enforces silently WINS, because a project's written rule
    // outranks the prompt. Correcting one of the two that carried the wrong
    // sentence would have left the editor's planner still refusing to plan the
    // component the MCP now asks for.
    expect(DECOMPOSITION_PLANNING).toContain('WHEN NOT TO FACTOR');
    expect(DECOMPOSITION_PLANNING).not.toMatch(/Do not plan a component for: a single node/);
    expect(DECOMPOSITION_PLANNING).toMatch(/SIZE IS NOT THE TEST/);
    expect(DECOMPOSITION_PLANNING).toMatch(/A named utility, HOWEVER SMALL/);
  });
});
