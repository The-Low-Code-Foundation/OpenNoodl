/**
 * BEN-003 — the channel the outputs read-out runs on, and the canvas that follows the bench.
 *
 * ⚠️ The **preview** canvas (`views/VisualCanvas`), not the node-graph canvas the rest of this
 * directory tests — same reason `bench-inputs.test.ts` lives here.
 *
 * What is decidable without a running editor is exactly the addressing: that arming the trace can
 * be aimed at one client, and that omitting the aim still broadcasts. Whether that has a
 * *consequence* was measured live and is written into the task file and register B17 — a spec
 * cannot see it, which is the whole reason this phase drives things.
 *
 * ⚠️ **`revealBenchTarget` is deliberately NOT covered here, and that is a finding rather than a
 * gap.** It resolves its component off `ProjectModel.instance`, a process-wide singleton this
 * suite would have to substitute — and doing so took the whole run down twice: 59 unrelated
 * failures with a fake left in place (`m.getComponents is not a function` in four later
 * directories), then a 900s **timeout** when the fake was restored to whatever the previous suite
 * had left. A spec that has to mutate that singleton is not worth the gate it breaks. The
 * behaviour is covered by the live drive instead, with numbers, in HANDOVER-SESSION-4. See
 * register B20.
 */

import {
  BENCH_COMPONENT_NAME,
  benchInterfaceFor
} from '../../src/editor/src/models/AiAssistant/authoring/componentBench';
import { ViewerConnection } from '../../src/editor/src/ViewerConnection';
import type { ProjectModel } from '@noodl-models/projectmodel';

/**
 * Typed rather than `TSFixme`: these doubles stand in for a relay request and a
 * project, and a spec whose double stops matching the shape under test should
 * fail at `typecheck:editor-tests` rather than at whatever the runtime does with
 * the wrong object.
 */
interface RelayRequest {
  cmd?: string;
  target?: string;
  /** Always a JSON string on the wire — the specs parse it back. */
  content?: string;
  [key: string]: unknown;
}

interface FakePort {
  name: string;
  plug: 'input' | 'output';
  type: string;
}

interface FakeComponent {
  name: string;
  getPorts(): FakePort[];
  graph: { forEachNode: () => void };
}

describe('BEN-003: arming the trace on one client', () => {
  /** The real method on a recorder — see `bench-inputs.test.ts` for why this is safe. */
  function capture() {
    const sent: RelayRequest[] = [];
    return {
      sent,
      clientId: 'editor-test',
      send(request: RelayRequest) {
        sent.push(request);
      },
      sendTraceEnabled: ViewerConnection.prototype.sendTraceEnabled
    };
  }

  it('aims at one client when given a target, where the relay reads it', () => {
    // Measured live before this existed: a broadcast armed BOTH viewers and the app preview
    // answered `enabled:true`. With the target, the app preview answered `enabled:false`.
    const connection = capture();
    connection.sendTraceEnabled(true, 'sandbox-abc');

    expect(connection.sent.length).toBe(1);
    expect(connection.sent[0].cmd).toBe('traceEnabled');
    expect(connection.sent[0].target).toBe('sandbox-abc');
    expect(JSON.parse(connection.sent[0].content).enabled).toBe(true);
  });

  it('still broadcasts with no target, so every existing caller is untouched', () => {
    // HUD-004's recording HUD passes nothing and must keep arming the preview it always did.
    const connection = capture();
    connection.sendTraceEnabled(true);

    expect('target' in connection.sent[0]).toBe(false);
  });

  it('keeps stamping the owner, so a disarm cannot end somebody else’s recording', () => {
    const connection = capture();
    connection.sendTraceEnabled(false, 'sandbox-abc');

    expect(JSON.parse(connection.sent[0].content).owner).toBe('editor-test');
  });
});

describe('BEN-003: the interface is re-derivable without rebuilding the export', () => {
  /**
   * The point of the split: rebuilding the export reloads the bench window and throws away the
   * state someone is inspecting, so a port added to a `Component Inputs` node must reach the
   * rail by a route that does not. Measured live — a `LiveAdded` port appeared in the rail with
   * the bench window's planted marker still intact.
   */
  function aComponent(name: string, ports: FakePort[]) {
    return {
      name,
      getPorts: () => ports,
      graph: { forEachNode: () => undefined }
    };
  }

  function aProject(components: FakeComponent[]) {
    return {
      getComponentWithName: (name: string) => components.find((c) => c.name === name)
    } as unknown as ProjectModel;
  }

  it('reads the live component, both spellings of its name', () => {
    const project = aProject([
      aComponent('/Components/Card', [{ name: 'Title', plug: 'input', type: 'string' }])
    ]);

    expect(benchInterfaceFor(project, '/Components/Card').inputs.map((p) => p.name)).toEqual(['Title']);
    expect(benchInterfaceFor(project, 'Components/Card').inputs.map((p) => p.name)).toEqual(['Title']);
  });

  it('returns undefined rather than an empty interface for a component that is not there', () => {
    // An empty interface would render as "this component declares no inputs", which is a claim
    // about a component that does not exist.
    expect(benchInterfaceFor(aProject([]), '/Components/Gone')).toBeUndefined();
  });

  it('sees a port that was added after the export was built', () => {
    const ports: FakePort[] = [{ name: 'Title', plug: 'input', type: 'string' }];
    const project = aProject([aComponent('/Components/Card', ports)]);

    expect(benchInterfaceFor(project, '/Components/Card').inputs.length).toBe(1);
    ports.push({ name: 'LiveAdded', plug: 'input', type: '*' });
    expect(benchInterfaceFor(project, '/Components/Card').inputs.map((p) => p.name)).toEqual([
      'Title',
      'LiveAdded'
    ]);
  });

  it('never mistakes the harness for the target', () => {
    // `/#bench` is spliced into the export, not the project; nothing should resolve to it here.
    expect(benchInterfaceFor(aProject([]), BENCH_COMPONENT_NAME)).toBeUndefined();
  });
});
