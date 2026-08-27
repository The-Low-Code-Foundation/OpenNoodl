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

/** What the real runtime module announces for one node, through `sendDynamicPorts`. */
function runtimePortsFor(modulePath: string, node: TemplateNode): GeneratedPort[] {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const nodeModule = require(modulePath);
  const announced: GeneratedPort[] = [];

  const runtimeNode = {
    id: node.id,
    parameters: node.parameters,
    component: { name: '/#__cloud__/spec' },
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
    const modules: Record<string, string> = {
      NewDbModelProperties: `${RUNTIME}/data/newdbmodelpropertiesnode`,
      SetDbModelProperties: `${RUNTIME}/data/setdbmodelpropertiesnode`
    };

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

  it('🔴 the runtime`s editor-side builder can declare NO `prop-` port here, and that is the whole reason this file exists', () => {
    // The measurement behind `cloudDynamicPorts.ts`'s docblock: `recordFieldPorts`
    // builds `prop-*` from the introspected columns of the selected class, and a
    // freshly installed site has none — the graph that would write them is the
    // graph whose ports are missing. So this is not a schema the editor is
    // failing to read; there is no schema, and there cannot be one yet.
    for (const typename of ['NewDbModelProperties', 'SetDbModelProperties']) {
      const path =
        typename === 'NewDbModelProperties'
          ? `${RUNTIME}/data/newdbmodelpropertiesnode`
          : `${RUNTIME}/data/setdbmodelpropertiesnode`;
      for (const { node } of cloudNodesOfType(typename)) {
        expect(signature(runtimePortsFor(path, node)).filter((e) => e.startsWith('prop-'))).toEqual([]);
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
