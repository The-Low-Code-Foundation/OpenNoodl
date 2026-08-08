/**
 * BEN-003 — the channel the outputs read-out runs on, and the canvas that follows the bench.
 *
 * ⚠️ The **preview** canvas (`views/VisualCanvas`), not the node-graph canvas the rest of this
 * directory tests — same reason `bench-inputs.test.ts` lives here.
 *
 * What is decidable without a running editor is exactly the addressing: that arming the trace
 * can be aimed at one client, that omitting the aim still broadcasts, and that asking the bench
 * to mount a component also points the graph at it. Whether any of that has a *consequence* was
 * measured live and is written into the task file and register B17 — a spec cannot see it, which
 * is the whole reason this phase drives things.
 */

import {
  BENCH_COMPONENT_NAME,
  benchInterfaceFor
} from '../../src/editor/src/models/AiAssistant/authoring/componentBench';
import { ViewerConnection } from '../../src/editor/src/ViewerConnection';
import { EventDispatcher } from '../../src/editor/src/../../shared/utils/EventDispatcher';
import { revealBenchTarget } from '../../src/editor/src/views/VisualCanvas/benchRequest';
import { ProjectModel } from '../../src/editor/src/models/projectmodel';

describe('BEN-003: arming the trace on one client', () => {
  /** The real method on a recorder — see `bench-inputs.test.ts` for why this is safe. */
  function capture() {
    const sent: TSFixme[] = [];
    return {
      sent,
      clientId: 'editor-test',
      send(request: TSFixme) {
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

describe('BEN-003: the node canvas follows the bench', () => {
  let events: TSFixme[];
  const group = {};

  beforeEach(() => {
    events = [];
    EventDispatcher.instance.on(
      'ComponentPanel.SwitchToComponent',
      (args: TSFixme) => events.push(args),
      group
    );
  });

  afterEach(() => {
    EventDispatcher.instance.off(group);
    ProjectModel.instance = undefined;
  });

  function aProjectWith(names: string[]) {
    return {
      getComponentWithName: (name: string) => (names.includes(name) ? { name } : undefined)
    } as TSFixme;
  }

  it('asks the graph editor to open the component being benched', () => {
    ProjectModel.instance = aProjectWith(['/Components/Card']);
    revealBenchTarget('/Components/Card');

    expect(events.length).toBe(1);
    expect(events[0].component.name).toBe('/Components/Card');
    // Pushed, so the canvas's back navigation returns where the user was.
    expect(events[0].pushHistory).toBe(true);
  });

  it('says nothing when the target does not resolve', () => {
    // The bench surface is about to say "… is not a component in this project" itself; two
    // messages for one mistake is worse than one, and a stray navigation would be worse still.
    ProjectModel.instance = aProjectWith(['/Components/Card']);
    revealBenchTarget('/Components/Gone');

    expect(events.length).toBe(0);
  });

  it('does nothing at all with no project open', () => {
    ProjectModel.instance = undefined;
    revealBenchTarget('/Components/Card');

    expect(events.length).toBe(0);
  });
});

describe('BEN-003: the interface is re-derivable without rebuilding the export', () => {
  /**
   * The point of the split: rebuilding the export reloads the bench window and throws away the
   * state someone is inspecting, so a port added to a `Component Inputs` node must reach the
   * rail by a route that does not. Measured live — a `LiveAdded` port appeared in the rail with
   * the bench window's planted marker still intact.
   */
  function aComponent(name: string, ports: TSFixme[]) {
    return {
      name,
      getPorts: () => ports,
      graph: { forEachNode: () => undefined }
    };
  }

  function aProject(components: TSFixme[]) {
    return {
      getComponentWithName: (name: string) => components.find((c) => c.name === name)
    } as TSFixme;
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
    const ports: TSFixme[] = [{ name: 'Title', plug: 'input', type: 'string' }];
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
