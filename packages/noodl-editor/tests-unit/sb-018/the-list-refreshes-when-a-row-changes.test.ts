/**
 * SB-018 (1) — `For Each.Changed` was dead, and "delete it" was the wrong fix.
 *
 * `/Pages/Admin` and `/Pages/PageEditor` each carried
 * `For Each.Changed -> DbCollection2.storageFetch`. `foreach.tsx` declares no
 * `Changed`, so both wires were dead, the editor warned, and the browser deploy
 * dropped them (SB-017 §11 counts them as 2 of its 23).
 *
 * SB-018 recorded the disposition as **delete them**, on the grounds that a valid
 * `NewDbModelProperties.done -> storageFetch` sits beside each and the refresh
 * still fires. 🔴 **That reading was wrong in a way only the node's own source
 * settles.** The two triggers do not cover the same events: `done` is the
 * *page's* create, and publish / unpublish / duplicate / save / remove all happen
 * inside the **row**. The author's comment on `/Admin/PageRow` said what they
 * wanted — *"`For Each` forwards an item component's Component Outputs signal as
 * an output port of its own"* — and it is true. They just used the wrong name.
 *
 * `foreach.tsx:1030-1037` republishes each **signal**-typed output port of the
 * template component as `itemOutputSignal-<name>`. So the port the wire wanted
 * exists; `Changed` never did. The fix is a rename, and deleting the wires would
 * have thrown away a refresh that was one identifier from working.
 *
 * ⚠️ **This moves the two out of SB-017 §11's census rather than fixing them
 * there**, and the difference matters: `itemOutputSignal-Changed` is a dynamic
 * port the viewer *does* announce (it needs only the template component, which is
 * always in the graph — not a class with columns, which is `prop-`'s problem). So
 * these two resolve, the census drops 21 → 19, and SB-017 §11.4's fix is still
 * about the 19 and must still not restore a `Changed`.
 */

// 🔴 This file declares `siteBuilder` at top level and has no `import`/`export`,
// which makes it a global SCRIPT to TypeScript rather than a module — and
// ts-jest typechecks all of `tests-unit/` in one program. Five spec files spell
// the same `const siteBuilder`, so whichever pair landed in one worker's program
// failed with TS2451 "Cannot redeclare block-scoped variable" and the whole
// SUITE failed to run: `test:main` reported 2 failed suites with 0 failed tests,
// which reads like a flake and is not one. `export {}` makes this a module and
// scopes the name to the file.
export {};

// eslint-disable-next-line @typescript-eslint/no-var-requires
const siteBuilder = require('../../src/editor/src/models/template/templates/site-builder.content.json');

interface TemplateNode {
  id: string;
  type: string;
  parameters: Record<string, unknown>;
  ports?: { name: string; plug: string; type: string }[];
  children?: TemplateNode[];
}

interface TemplateConnection {
  fromId: string;
  fromProperty: string;
  toId: string;
  toProperty: string;
}

interface TemplateComponent {
  name: string;
  nodes: TemplateNode[];
  connections: TemplateConnection[];
}

function flatten(roots: TemplateNode[], out: TemplateNode[] = []): TemplateNode[] {
  for (const node of roots || []) {
    out.push(node);
    flatten(node.children, out);
  }
  return out;
}

function components(): TemplateComponent[] {
  return siteBuilder.components.map((component: TSFixme) => ({
    name: component.name,
    nodes: flatten(component.graph.roots),
    connections: (component.graph.connections ?? []) as TemplateConnection[]
  }));
}

function component(name: string): TemplateComponent {
  const found = components().find((c) => c.name === name);
  if (found === undefined) throw new Error(`no component ${name} in the shipped template`);
  return found;
}

/**
 * The output ports one component publishes, read off the **shipped artefact** —
 * a `Component Outputs` node's ports are plugged `input` (into the node) and are
 * the component's outputs.
 */
function outputPortsOf(name: string): Record<string, { type: string }> {
  const ports: Record<string, { type: string }> = {};
  for (const node of component(name).nodes) {
    if (node.type !== 'Component Outputs') continue;
    for (const port of node.ports ?? []) ports[port.name] = { type: port.type };
  }
  return ports;
}

/**
 * What the **real** `For Each` module announces for one node, through
 * `sendDynamicPorts`. Same instrument and same reason as SB-017 §11's census:
 * the question is what the runtime declares, so the runtime answers it.
 *
 * ⚠️ `editorImportComplete` has to be fired — `ForEachModule.setup` hangs its
 * whole sweep off that event, and without it this function returns `[]` for
 * every input, which is the shape of the answer being looked for. The last case
 * in this file is that control.
 */
function announcedPortsFor(templateComponent: string, fire = true): string[] {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const foreach = require('../../../noodl-viewer-react/src/nodes/std-library/data/foreach');

  const announced: string[] = [];
  const node = {
    id: 'list',
    parameters: { templateType: 'explicit', template: templateComponent },
    on: () => undefined
  };

  const handlers: Record<string, TSFixme[]> = {};
  const graphModel: TSFixme = {
    components: {
      [templateComponent]: {
        outputPorts: outputPortsOf(templateComponent),
        inputPorts: {},
        on: () => undefined
      }
    },
    getNodesWithType: () => [node],
    on: (name: string, callback: TSFixme) => {
      (handlers[name] = handlers[name] || []).push(callback);
    },
    fire: (name: string) => (handlers[name] || []).forEach((callback: TSFixme) => callback()),
    getMetaData: () => undefined
  };

  foreach.default.setup(
    {
      editorConnection: {
        isRunningLocally: () => true,
        sendDynamicPorts: (_id: string, ports: { name: string }[]) => announced.push(...ports.map((p) => p.name)),
        sendWarning: () => undefined,
        clearWarning: () => undefined
      }
    },
    graphModel
  );
  if (fire) graphModel.fire('editorImportComplete');

  return announced;
}

/** The two refresh wires this task is about, from the shipped artefact. */
function refreshWiresFromRepeaters(): { component: string; port: string; template: string }[] {
  const found: { component: string; port: string; template: string }[] = [];
  for (const c of components()) {
    const byId: Record<string, TemplateNode> = {};
    c.nodes.forEach((node) => (byId[node.id] = node));
    for (const wire of c.connections) {
      const source = byId[wire.fromId];
      if (source?.type !== 'For Each') continue;
      found.push({
        component: c.name,
        port: wire.fromProperty,
        template: String(source.parameters.template)
      });
    }
  }
  return found;
}

describe('SB-018 (1): the row tells the list, and the list refreshes', () => {
  it('🔴 the real `For Each` module announces `itemOutputSignal-Changed` for both row components', () => {
    // The measurement the disposition turned on. Read from the module, with the
    // item component's ports taken from the shipped artefact rather than from a
    // fixture — so this is the graph that ships, not a plausible neighbour.
    // 🔴 Held as the EXACT set per component rather than a `toContain`, because
    // the claim is about what the module announces and a subset check would go
    // green on a row that had lost `Changed` and gained something else.
    // `/Admin/SectionRow` grew two signals with SBR-007 AC2 — the row says which
    // way it wants to move and the page editor works out where, since a row
    // knows its own `order` and nothing about its siblings'.
    const expected: Record<string, Record<string, { type: string }>> = {
      '/Admin/PageRow': { Changed: { type: 'signal' } },
      '/Admin/SectionRow': {
        Changed: { type: 'signal' },
        MoveDown: { type: 'signal' },
        MoveUp: { type: 'signal' }
      }
    };
    for (const rowComponent of ['/Admin/PageRow', '/Admin/SectionRow']) {
      expect(outputPortsOf(rowComponent)).toEqual(expected[rowComponent]);
      expect(announcedPortsFor(rowComponent)).toContain('itemOutputSignal-Changed');
    }
  });

  it('🔴 …and it announces no port called `Changed`, which is why the old wire was dead', () => {
    // The negative control, and it is the half that makes the rename a fix
    // rather than a rewording. If `Changed` also resolved, the wire was never
    // broken and this whole item is imaginary.
    for (const rowComponent of ['/Admin/PageRow', '/Admin/SectionRow']) {
      expect(announcedPortsFor(rowComponent)).not.toContain('Changed');
    }
  });

  it('the shipped template wires the announced name, and no `For Each.Changed` survives anywhere', () => {
    const wires = refreshWiresFromRepeaters();

    // 🔴 Every wire *out of* a repeater in this template, in artefact order. Two
    // are the refreshes this item is about; the other four are SBR-007 AC2's
    // reorder path, and they are here rather than excluded because that is what
    // keeps this a census — a rule that skipped what it did not recognise would
    // stop being able to say a `Changed` wire had come back.
    //
    // ⚠️ `itemActionItemId` appears TWICE, once per planner, and that is the
    // shape rather than a duplicate: the id and the signal must leave the SAME
    // node or the script runs against the previous row.
    expect(wires).toEqual([
      { component: '/Pages/PageEditor', port: 'itemOutputSignal-Changed', template: '/Admin/SectionRow' },
      { component: '/Pages/PageEditor', port: 'itemActionItemId', template: '/Admin/SectionRow' },
      { component: '/Pages/PageEditor', port: 'itemOutputSignal-MoveUp', template: '/Admin/SectionRow' },
      { component: '/Pages/PageEditor', port: 'itemActionItemId', template: '/Admin/SectionRow' },
      { component: '/Pages/PageEditor', port: 'itemOutputSignal-MoveDown', template: '/Admin/SectionRow' },
      { component: '/Pages/Admin', port: 'itemOutputSignal-Changed', template: '/Admin/PageRow' }
    ]);

    // Stated separately as an absence over the whole artefact, because the list
    // above only covers repeaters this file already knows about.
    expect(wires.filter((w) => w.port === 'Changed')).toEqual([]);
  });

  it('🔴 the wire is NOT redundant — the row is where publish, duplicate and remove happen', () => {
    // SB-018's original reading was that a valid `done` wire beside each made
    // this a second trigger for the same event. It is not: `create.done` is the
    // page's own create, and every other write in the panel happens inside the
    // row component, which cannot reach the query.
    const pageRow = component('/Admin/PageRow');
    const changedSources = pageRow.connections
      .filter((wire) => wire.toProperty === 'Changed')
      .map((wire) => pageRow.nodes.find((n) => n.id === wire.fromId)!.parameters.function)
      .sort();

    // Three cloud functions, none of which the page's `create.done` covers.
    expect(changedSources).toEqual(['duplicatePage', 'publishPage', 'publishPage']);

    const sectionRow = component('/Admin/SectionRow');
    expect(sectionRow.connections.filter((wire) => wire.toProperty === 'Changed').length).toBe(2);
  });

  it('🔴 …and the instrument is silent without `editorImportComplete`, which is what makes the above mean anything', () => {
    // The known-firing control for this file's own harness. `ForEachModule.setup`
    // registers everything inside a `graphModel.on('editorImportComplete')`
    // callback, so a harness that forgets to fire it gets `[]` — the same shape
    // as "the port does not exist", and the opposite conclusion.
    expect(announcedPortsFor('/Admin/PageRow', false)).toEqual([]);
    expect(announcedPortsFor('/Admin/PageRow', true).length).toBeGreaterThan(0);
  });
});
