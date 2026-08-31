/**
 * VIB-007 / register **V22** — the wired-but-undeclared interface port, through the real door.
 *
 * The third question in the interface family, and the one neither neighbour could ask.
 * `interfaceGate.test.ts` pins a component that declares its ports on the wrong NODE
 * (`interfaceless-instance`) and one that declares them the wrong WAY ROUND
 * (`component-port-direction`). Both read the ports a node declares — so a node that declares
 * none was silent to both, while every connection drawn out of it named a port the component
 * does not have. **15 shipped examples were in exactly that state**, through a gate running
 * them 67/67 strict.
 *
 * 🔴 **Ruled by a render, 2026-08-31** — `packages/nodegx-backend/tests/vib007-v22.look.ts`.
 * The open question was whether a `For Each` feeds item properties in by another route, since
 * all 15 hits are repeater item components. It does not: two components identical but for the
 * `ports` array, each drawn over three records, gave three records' values in the declared arm
 * and three copies of the component's own placeholder in the undeclared one, at all four
 * widths. `foreach.tsx:595` iterates the DECLARED inputs, so an undeclared port is never even
 * offered the value.
 *
 * ⚠️ **What this file adds over the unit spec.** The unit spec
 * (`noodl-editor/tests-unit/vib-007/undeclaredComponentPort.test.ts`) pins the predicate. This
 * pins that the predicate reaches the door an authoring model actually knocks on, that the
 * message it gets back names the repair, and — the half that is easy to leave out — that a
 * correct component is still ACCEPTED. A gate that rejects the correct answer is worse than no
 * gate, and this family has produced one before.
 */
import * as fs from 'fs';

import { call, connect, copyFixture, TestSession } from './helpers';
import type { CreateComponentResponse } from '../src/tools/responses';

interface Diagnostic {
  code: string;
  severity: string;
  message: string;
  suggestion: string;
  location: { component: string; nodeId: string; port: string };
}

/** The corpus shape, verbatim: `/Product Row` from `data-static-array-filter-repeater`. */
const UNDECLARED_ROW = [
  { id: 'row', type: 'Group', parameters: { flexDirection: 'row' } },
  { id: 'label_text', type: 'Text', parent: 'row' },
  { id: 'row_inputs', type: 'Component Inputs' }
];

/** The same row with the one line that makes it work. */
const DECLARED_ROW = [
  { id: 'row', type: 'Group', parameters: { flexDirection: 'row' } },
  { id: 'label_text', type: 'Text', parent: 'row' },
  { id: 'row_inputs', type: 'Component Inputs', ports: [{ name: 'label', plug: 'output', type: '*' }] }
];

const WIRE = [{ fromId: 'row_inputs', fromProperty: 'label', toId: 'label_text', toProperty: 'text' }];

describe('V22 — a Component Inputs port that is wired and never declared', () => {
  let dir: string;
  let session: TestSession;

  beforeEach(async () => {
    dir = copyFixture();
    session = await connect(dir);
  });

  afterEach(async () => {
    await session.close();
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('rejects the corpus shape, and the message names the line to add', async () => {
    const res = await call<CreateComponentResponse>(session, 'create_component', {
      path: 'Components/ProductRow',
      nodes: UNDECLARED_ROW,
      visual_roots: ['row'],
      connections: WIRE
    });

    expect(res.isError).toBe(true);

    // ⚠️ Read the STRUCTURED diagnostic, not `JSON.stringify(res.data)`. The suggestion the
    // model has to act on is itself JSON — `{ "name": …, "plug": "output" }` — so a
    // `toContain('"plug": "output"')` over the stringified envelope tests the escaping rather
    // than the message, and fails on a door that is working perfectly.
    const errors = (res.data as unknown as { error: { details: { newErrors: Diagnostic[] } } }).error.details
      .newErrors;
    expect(errors).toHaveLength(1);
    const [d] = errors;
    expect(d.code).toBe('undeclared-component-port');
    expect(d.severity).toBe('error');
    expect(d.location.port).toBe('label');
    // The repair, not just the complaint — and it is valid JSON for the array it names.
    expect(JSON.parse(d.suggestion.slice(d.suggestion.indexOf('{'), d.suggestion.lastIndexOf('}') + 1))).toEqual({
      name: 'label',
      plug: 'output',
      type: '*'
    });
    // 🔴 The repeater clause. All 15 corpus hits were repeater item components, and a message
    // that only says "an instance parameter is discarded" reads as not-my-case to an author
    // who places no instances by hand — which is every one of those 15.
    expect(d.message).toMatch(/Repeater/);
  });

  it('accepts the same component once the port is declared — the gate does not reject the correct answer', async () => {
    const res = await call<CreateComponentResponse>(session, 'create_component', {
      path: 'Components/ProductRow',
      nodes: DECLARED_ROW,
      visual_roots: ['row'],
      connections: WIRE
    });
    expect(res.isError).toBe(false);
  });

  it('is silent on an unwired Component Inputs node — a dropped node is not a defect', async () => {
    const res = await call<CreateComponentResponse>(session, 'create_component', {
      path: 'Components/Empty',
      nodes: [
        { id: 'root', type: 'Group' },
        { id: 'ins', type: 'Component Inputs' }
      ],
      visual_roots: ['root']
    });
    expect(JSON.stringify(res.data)).not.toContain('undeclared-component-port');
  });
});
