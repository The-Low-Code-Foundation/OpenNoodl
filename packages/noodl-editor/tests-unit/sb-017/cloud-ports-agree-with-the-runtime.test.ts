/**
 * SB-017 — the editor's derived cloud ports are the runtime's own.
 *
 * `models/nodelibrary/cloudDynamicPorts.ts` replaces the cloud-runtime client
 * WF-007 deleted: it works out, in the editor, which dynamic ports a cloud
 * node has. That is a **second implementation of something the runtime already
 * owns**, and this task file's own §4 is about what happens when a stand-in
 * ships without a test that it agrees with the thing it stands in for — the
 * 29-spec backend suite was green on a bundle the product never builds.
 *
 * So this does not assert against a hand-written expectation. It **runs the
 * real runtime node modules** — `dbcollectionnode2`, `simplejavascript`,
 * `newdbmodelpropertiesnode`, `setdbmodelpropertiesnode`, `dbmodelnode2` — with
 * a fake editor connection that captures `sendDynamicPorts`, over the **nodes
 * of the shipped Site Builder template**, and compares what they announce with
 * what the editor derives. Reachable from here and nowhere else in this package:
 * `tests-unit/` is plain Node, and these modules cannot be bundled into the
 * renderer (SB-017 §8 — the editor does not depend on `@noodl/runtime`).
 *
 * ## The scope of the comparison, and why it is not the whole list
 *
 * The runtime announces far more than these families — the Backend picker, the
 * Class dropdown, `intype-`/`outtype-`, `runOnChange-*`, `storageLimit` and the
 * rest. Those are property-panel controls; a wire never goes to one, and the
 * editor's static library entry already carries the ones that are not computed.
 * What this compares is the ports whose **absence drops a wire**: `in-`, `out-`,
 * `prop-`, `acl-`, `qp-` and `storageFetch`. The first case is the control that
 * the comparison is not vacuous — over this corpus the runtime really does
 * announce ports in that scope, on all three families.
 *
 * ## 🔴 One deliberate disagreement, asserted rather than excluded
 *
 * `prop-*` is the one family where the editor derives **more** than the runtime's
 * editor-side builder does, and the last two cases are that difference stated as
 * a measurement rather than left to the docblock: the runtime's builder produces
 * **zero** `prop-` ports for this project because it reads introspected columns
 * and there are none, while the *running* node registers `prop-<anything>` on
 * demand from the wire.
 */

import {
  accessControlPortsForNode,
  cloudDynamicPortsForNode,
  recordPortsForNode,
  scriptPortsForNode,
  type ConnectionLike,
  type GeneratedPort
} from '@noodl-models/nodelibrary/cloudDynamicPorts';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const siteBuilder = require('../../src/editor/src/models/template/templates/site-builder.content.json');

/** The port prefixes a missing declaration would cost a wire. See the docblock. */
const WIRED_FAMILIES = ['in-', 'out-', 'prop-', 'acl-', 'qp-'];

function inScope(name: string): boolean {
  return name === 'storageFetch' || WIRED_FAMILIES.some((prefix) => name.startsWith(prefix));
}

/**
 * `name:plug:type`, sorted — the identity a wire is resolved by.
 *
 * 🔴 The type is in here because a mutant proved it had to be. With `name:plug`
 * alone, deleting the parser's `Outputs.Done()` rule **survived**: the general
 * `Outputs.x` rule still finds the name, so only its type changes — `signal`
 * becomes `'*'` — and a port whose type is wrong is not a port a signal wire
 * survives (`evaluateConnectionHealth` raises `con-type-mismatch`, and
 * `exportComponent` drops on *any* warning). Types are compared by name because
 * this family spells the same type both as `'boolean'` and as `{name:'boolean'}`.
 */
function typeName(type: unknown): string {
  if (typeof type === 'string') return type;
  if (type && typeof type === 'object') return String((type as { name?: unknown }).name);
  return String(type);
}

function signature(ports: { name: string; plug?: string; type?: unknown }[]): string[] {
  return ports
    .filter((p) => inScope(p.name))
    .map((p) => `${p.name}:${p.plug}:${typeName(p.type)}`)
    .filter((entry, index, all) => all.indexOf(entry) === index)
    .sort();
}

/** Every node in a component graph — `children` is a tree. */
function flatten(roots: TSFixme[], out: TSFixme[] = []): TSFixme[] {
  for (const node of roots || []) {
    out.push(node);
    flatten(node.children, out);
  }
  return out;
}

interface TemplateNode {
  id: string;
  type: string;
  parameters: Record<string, unknown>;
}

/** The cloud components' nodes of one type, with the wires of their own component. */
function cloudNodesOfType(typename: string): { node: TemplateNode; connections: ConnectionLike[] }[] {
  const found: { node: TemplateNode; connections: ConnectionLike[] }[] = [];
  for (const component of siteBuilder.components) {
    if (!component.name.startsWith('/#__cloud__/')) continue;
    for (const node of flatten(component.graph.roots)) {
      if (node.type !== typename) continue;
      found.push({
        node: { id: node.id, type: node.type, parameters: node.parameters || {} },
        connections: component.graph.connections
      });
    }
  }
  return found;
}

/**
 * A graph model with just the surface these `setup()` functions touch.
 *
 * `getMetaData` answers `undefined` for every key, which is this project's real
 * state: a freshly installed template has no `backendServices`, no
 * `dbCollections` and no `cloudservices` — see the module docblock of
 * `cloudDynamicPorts.ts` on why a live backend does not change that.
 */
function graphModelFor(nodes: TSFixme[]) {
  const handlers: Record<string, TSFixme[]> = {};
  return {
    getNodesWithType: () => nodes,
    on: (name: string, callback: TSFixme) => {
      (handlers[name] = handlers[name] || []).push(callback);
    },
    fire: (name: string) => (handlers[name] || []).forEach((callback: TSFixme) => callback()),
    getMetaData: () => undefined
  };
}

/**
 * A wire as the **runtime's** `ComponentModel.connections` holds it.
 *
 * 🔴 The two halves of this file speak different field names for the same wire, and the
 * template file is in the editor's. `utils/exporter/util.ts` `exportConnection` renames
 * all four on the way to any runtime — the live viewer's deltas go through it too — so a
 * runtime module reading `fromId` finds `undefined` on every wire and derives nothing,
 * silently. SBR-008 §6.6 is that mistake made once already: a census filtered on the
 * editor's names against the viewer's objects reported **0** wires on a graph with 19,
 * and read as confirmation of the defect it was measuring.
 */
function asRuntimeConnections(connections: readonly ConnectionLike[]) {
  return connections.map((c) => ({
    sourceId: c.fromId,
    sourcePort: c.fromProperty,
    targetId: c.toId,
    targetPort: c.toProperty
  }));
}

/** What the real runtime module announces for one node, through `sendDynamicPorts`. */
function runtimePortsFor(
  modulePath: string,
  node: TemplateNode,
  connections: readonly ConnectionLike[] = []
): GeneratedPort[] {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const nodeModule = require(modulePath);
  const announced: GeneratedPort[] = [];

  const wires = asRuntimeConnections(connections);
  const runtimeNode = {
    id: node.id,
    parameters: node.parameters,
    component: {
      name: '/#__cloud__/spec',
      // The accessors the Record family's wire-derived `prop-*` reads (SBR-008 §2).
      // `componentmodel.ts` filters and returns a fresh array; so does this.
      getConnectionsTo: (id: string) => wires.filter((c) => c.targetId === id),
      getConnectionsFrom: (id: string) => wires.filter((c) => c.sourceId === id),
      on: () => undefined
    },
    outputPorts: {} as Record<string, unknown>,
    on: () => undefined
  };

  const context = {
    editorConnection: {
      isRunningLocally: () => true,
      sendDynamicPorts: (_id: string, ports: GeneratedPort[]) => announced.push(...ports),
      sendWarning: () => undefined,
      clearWarning: () => undefined
    }
  };

  const graphModel = graphModelFor([runtimeNode]);
  nodeModule.setup(context, graphModel);
  // The Record and Query families both hang their initial sweep off this event
  // rather than running it in `setup` — without firing it, nothing is announced
  // and every comparison below would pass on two empty lists.
  graphModel.fire('editorImportComplete');

  return announced;
}

const RUNTIME = '../../../noodl-runtime/src/nodes/std-library';

/** The two node types with `prop-*` INPUTS, and the runtime module that builds them. */
const RECORD_WRITE_MODULES: Record<string, string> = {
  NewDbModelProperties: `${RUNTIME}/data/newdbmodelpropertiesnode`,
  SetDbModelProperties: `${RUNTIME}/data/setdbmodelpropertiesnode`
};

const propOnly = (entry: string) => entry.startsWith('prop-');

describe('SB-017: the editor derives the ports the runtime declares', () => {
  it('the runtime really announces ports in this scope — the comparison is not vacuous', () => {
    const scripts = cloudNodesOfType('JavaScriptFunction');
    const queries = cloudNodesOfType('DbCollection2');
    const writes = cloudNodesOfType('NewDbModelProperties');

    expect(scripts.length).toBeGreaterThan(0);
    expect(queries.length).toBeGreaterThan(0);
    expect(writes.length).toBeGreaterThan(0);

    // One per family, so a family that stopped announcing anything is a red here
    // rather than a silently-agreeing pair of empty lists below.
    expect(signature(runtimePortsFor(`${RUNTIME}/simplejavascript`, scripts[0].node)).length).toBeGreaterThan(0);
    expect(signature(runtimePortsFor(`${RUNTIME}/data/dbcollectionnode2`, queries[0].node)).length).toBeGreaterThan(0);
    expect(signature(runtimePortsFor(`${RUNTIME}/data/newdbmodelpropertiesnode`, writes[0].node)).length).toBeGreaterThan(
      0
    );
  });

  it('agrees on every Function node in the template — proplists and parsed script', () => {
    const nodes = cloudNodesOfType('JavaScriptFunction');

    for (const { node } of nodes) {
      expect(signature(scriptPortsForNode(node))).toEqual(
        signature(runtimePortsFor(`${RUNTIME}/simplejavascript`, node))
      );
    }
  });

  it('agrees on every Query Records node — `qp-*` and the dynamic `Do`', () => {
    const nodes = cloudNodesOfType('DbCollection2');

    for (const { node, connections } of nodes) {
      expect(signature(cloudDynamicPortsForNode(node, node.type, connections))).toEqual(
        signature(runtimePortsFor(`${RUNTIME}/data/dbcollectionnode2`, node))
      );
    }
  });

  it('agrees on every access-control rule the template writes', () => {
    const modules = RECORD_WRITE_MODULES;

    let compared = 0;
    for (const typename of Object.keys(modules)) {
      for (const { node } of cloudNodesOfType(typename)) {
        const mine = signature(accessControlPortsForNode(node));
        const theirs = signature(runtimePortsFor(modules[typename], node)).filter((entry) =>
          entry.startsWith('acl-')
        );
        expect(mine).toEqual(theirs);
        if (mine.length > 0) compared++;
      }
    }
    // Two of the template's rules are `everyone` and the rest are `role`, which
    // are the two branches that decide between `-role` and `-userid`. A run that
    // compared no rule at all would otherwise pass.
    expect(compared).toBeGreaterThan(0);
  });

  it('🔴 with no wires AND no parameters the schema half declares no `prop-` port — the circularity SBR-008 is about', () => {
    // The measurement `cloudDynamicPorts.ts`'s docblock stands on, kept because it is
    // still true and is still the reason any of this exists: `recordFieldPorts` builds
    // `prop-*` from the introspected columns of the selected class, and a freshly
    // installed site has none — the graph that would write them is the graph whose ports
    // are missing.
    //
    // 🔴 Both inputs have to be emptied, not just the wires. The derivation reads saved
    // `prop-*` PARAMETERS as well as wires (both copies do), so a node stripped of its
    // wires alone still announces `prop-published` and `prop-publishedAt` off its own
    // parameters. Written first as "no wires" and it went red saying exactly that — which
    // is the case doing its job: what isolates the schema half is emptying every input
    // the other producer has, and there were two.
    let checked = 0;
    for (const typename of Object.keys(RECORD_WRITE_MODULES)) {
      for (const { node } of cloudNodesOfType(typename)) {
        const bare = { ...node, parameters: { collectionName: node.parameters.collectionName } };
        expect(signature(runtimePortsFor(RECORD_WRITE_MODULES[typename], bare)).filter(propOnly)).toEqual([]);
        checked++;
      }
    }
    expect(checked).toBeGreaterThan(0);
  });

  it('🟢 …and given the node`s own wires the runtime declares exactly what the editor derives', () => {
    // SBR-008 AC4 — the two copies of the derivation rule, graded against each other.
    // `record-ports.ts` `recordWiredFieldNames` (runtime) against
    // `cloudDynamicPorts.ts` `recordFieldNames` (editor), over the shipped template.
    let compared = 0;

    for (const typename of Object.keys(RECORD_WRITE_MODULES)) {
      for (const { node, connections } of cloudNodesOfType(typename)) {
        const mine = signature(recordPortsForNode(node, node.type, connections)).filter(propOnly);
        const theirs = signature(runtimePortsFor(RECORD_WRITE_MODULES[typename], node, connections)).filter(propOnly);

        expect(theirs).toEqual(mine);
        if (mine.length > 0) compared++;
      }
    }

    // Without this the case passes on two empty lists — which is precisely the state it
    // replaced, so it is the one assertion here that cannot be omitted.
    expect(compared).toBeGreaterThan(0);
  });

  it('🔴 the comparison discriminates — a mutant on EITHER copy reddens it', () => {
    // A pair proves what you varied, so vary each side once and require the agreement to
    // break both times. Without this the case above passes whenever both copies are
    // wrong in the same way, which is the failure mode a second copy has.
    const withWires = cloudNodesOfType('NewDbModelProperties')
      .concat(cloudNodesOfType('SetDbModelProperties'))
      .find(({ node, connections }) => recordPortsForNode(node, node.type, connections).some((p) => propOnly(p.name)));

    expect(withWires).toBeDefined();
    const { node, connections } = withWires;
    const module = RECORD_WRITE_MODULES[node.type];

    const agreed = signature(runtimePortsFor(module, node, connections)).filter(propOnly);
    expect(agreed.length).toBeGreaterThan(0);

    // 🔴 The wire is CHOSEN, not `connections[0]`. Dropping an arbitrary wire changes
    // nothing here — most are not `prop-` wires at all, and a field that is also a saved
    // parameter survives losing its wire. Written that way first and both mutants stayed
    // green: a mutant that kills nothing is a finding about the mutant.
    const wireOnly = agreed
      .map((entry) => entry.slice('prop-'.length, entry.indexOf(':')))
      .find((field) => !Object.keys(node.parameters).includes(`prop-${field}`));

    expect(wireOnly).toBeDefined();
    const without = connections.filter((c) => c.toProperty !== `prop-${wireOnly}` || c.toId !== node.id);
    expect(without.length).toBeLessThan(connections.length);

    // Mutant 1 — on the EDITOR copy's input.
    expect(signature(recordPortsForNode(node, node.type, without)).filter(propOnly)).not.toEqual(agreed);

    // Mutant 2 — on the RUNTIME copy's input, same wire.
    expect(signature(runtimePortsFor(module, node, without)).filter(propOnly)).not.toEqual(agreed);
  });

  it('🔴 two producers, one port — the wire half never doubles a column`s port', () => {
    // The trap SBR-008 §4 names: where two builders can mint the same name, assert the
    // cardinality at the seam rather than trusting the dedupe downstream of it. Run
    // against the RAW announced list, before `signature()` dedupes, or it cannot fail.
    for (const typename of Object.keys(RECORD_WRITE_MODULES)) {
      for (const { node, connections } of cloudNodesOfType(typename)) {
        const names = runtimePortsFor(RECORD_WRITE_MODULES[typename], node, connections)
          .map((p) => `${p.plug}:${p.name}`)
          .filter((entry) => entry.includes(':prop-'));

        expect(names).toEqual(Array.from(new Set(names)));
      }
    }
  });

  it('🔴 …while the running node registers `prop-<anything>` from the wire', () => {
    // The claim the `prop-` derivation stands on, graded against the runtime's
    // own method rather than quoted from its source: `NodeScope.createConnection`
    // calls `registerInputIfNeeded` on the wire's own port before connecting it
    // (`nodescope.ts:149-150`), and this is what that call reaches.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const definition = require(`${RUNTIME}/data/newdbmodelpropertiesnode`);

    const registered: string[] = [];
    const instance = {
      hasInput: () => false,
      registerInput: (name: string) => registered.push(name),
      _setInputValue: () => undefined,
      _internal: { inputValues: {} }
    };

    definition.node.methods.registerInputIfNeeded.call(instance, 'prop-somethingNothingDeclared');
    expect(registered).toContain('prop-somethingNothingDeclared');

    // The known-firing half: a name outside every on-demand family is NOT
    // registered, so the assertion above is about the prefix and not about this
    // method accepting anything at all.
    registered.length = 0;
    definition.node.methods.registerInputIfNeeded.call(instance, 'no-such-port-on-any-node');
    expect(registered).toEqual([]);
  });
});
