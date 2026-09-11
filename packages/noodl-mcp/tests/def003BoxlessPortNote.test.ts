/**
 * DEF-003 (b) — `notFound` with a reason, at the door.
 *
 * `get_node_type("Text", {ports: ["paddingLeft"]})` answered `notFound: ["paddingLeft"]`, which is
 * true and is a dead end: an author told a port does not exist looks for a differently-named one,
 * and on a `Text` there is none — padding, background, border and radius all belong to a wrapping
 * `Group`. Phase 76 F16 and phase 77 D7 are both authors who went round that loop, and the
 * site-builder template carries the `Group` wrapper everywhere with nothing in the product saying
 * why.
 *
 * 🔴 **The sentence is `noBoxExit`'s, imported through `editor-deps`, not a second copy.** The
 * write gate refuses `paddingLeft` on a `Text` and this tool reports it absent — two doors onto one
 * fact, and a duplicated sentence is the copy that goes stale. `threeAuthoringActs.test.ts` in
 * `noodl-editor/tests-unit/def-003` grades the rule itself, including the `Circle` control that
 * decides it is keyed on painting rather than on the parameter's name.
 */
import type { GetNodeTypeResponse, NodeTypePortsView } from '../src/tools/responses';

import { call, connect, copyFixture, TestSession } from './helpers';

jest.setTimeout(120000);

describe('a box property asked for on a node that has no box', () => {
  let session: TestSession;

  beforeAll(async () => {
    session = await connect(copyFixture());
  });
  afterAll(async () => {
    await session.close();
  });

  async function ports(typeName: string, names: string[]): Promise<NodeTypePortsView> {
    const res = await call<GetNodeTypeResponse>(session, 'get_node_type', {
      type_names: [typeName],
      ports: names
    });
    expect(res.isError).toBe(false);
    return res.data.types[0] as NodeTypePortsView;
  }

  it('still reports the miss — the answer was never wrong, only unfinished', async () => {
    const text = await ports('Text', ['paddingLeft', 'borderRadius']);
    expect(text.notFound).toEqual(['paddingLeft', 'borderRadius']);
  });

  it('now says why, and names the Group wrapper', async () => {
    const text = await ports('Text', ['paddingLeft', 'borderRadius']);
    expect(text.notFoundNotes?.paddingLeft).toContain('Wrap it in a Group');
    expect(text.notFoundNotes?.paddingLeft).toContain('"paddingLeft"');
    expect(text.notFoundNotes?.borderRadius).toContain('"borderRadius"');
  });

  it('says nothing about a plain typo in the same call', async () => {
    // A negative control inside the arm: one request, one type, two kinds of miss. If the note were
    // attached to every `notFound` this row reddens, and the field would be noise.
    const text = await ports('Text', ['paddingLeft', 'nonsenseXyz']);
    expect(text.notFound).toEqual(['paddingLeft', 'nonsenseXyz']);
    expect(Object.keys(text.notFoundNotes ?? {})).toEqual(['paddingLeft']);
  });

  it('carries no notes field at all when nothing has a reason to give', async () => {
    const group = await ports('Group', ['paddingLeft', 'borderRadius']);
    expect(group.notFound).toBeUndefined();
    expect(group.notFoundNotes).toBeUndefined();
  });
});

/**
 * DEF-003 (c) — the same tool, on the two ports it used to deny existed.
 *
 * Kept beside (b) because they are one question asked twice: what `get_node_type` says about a port
 * the caller is about to set. `def003PageTitleDrive.test.ts` is the browser half.
 */
describe('the two Page ports the catalog could not see', () => {
  let session: TestSession;

  beforeAll(async () => {
    session = await connect(copyFixture());
  });
  afterAll(async () => {
    await session.close();
  });

  it('resolves title and urlPath instead of reporting them missing', async () => {
    const res = await call<GetNodeTypeResponse>(session, 'get_node_type', {
      type_names: ['Page'],
      ports: ['title', 'urlPath']
    });
    const page = res.data.types[0] as NodeTypePortsView;
    expect(page.notFound).toBeUndefined();
    expect(page.inputs.map((p) => p.name).sort()).toEqual(['title', 'urlPath']);
  });

  it('stops attributing them to the editor connection', async () => {
    // The old sentence — "registered per instance by the editor connection" — is what a headless
    // author reads as "not available to me". It was never a statement about the parameter.
    const res = await call<GetNodeTypeResponse>(session, 'get_node_type', {
      type_names: ['Page'],
      ports: ['title']
    });
    const page = res.data.types[0] as NodeTypePortsView;
    expect(page.runtimeBehavior).toContain('settable as parameters with no editor attached');
    expect(page.runtimeBehavior).not.toContain('are registered per instance by the editor connection');
  });

  it('lists them in the cheap summary too, which is the mode the tool recommends', async () => {
    const res = await call<GetNodeTypeResponse>(session, 'get_node_type', {
      type_names: ['Page'],
      detail: 'summary'
    });
    const ports = (res.data.types[0] as { ports: string[] }).ports;
    expect(ports).toContain('in title: string');
    expect(ports).toContain('in urlPath: string');
  });
});
