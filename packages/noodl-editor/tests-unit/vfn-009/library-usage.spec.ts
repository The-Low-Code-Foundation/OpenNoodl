/**
 * VFN-009 — the project usage scan, and the four store operations it makes usable.
 *
 * The engine was complete and had **zero callers outside its own tests**. The one thing the store
 * deliberately cannot do is find the nodes — `remove` takes `referencingNodeIds` as an argument and
 * says why: *"The store cannot find these itself — it has no project."* Supplying that list is this
 * task's real work, and it is the same list the propagation warning needs.
 *
 * 🔴 **Almost every criterion in this task is an absence** — rename breaks nothing, an edit rewrites
 * no generated code, detaching changes no output — and a suite of absences is indistinguishable
 * from an instrument that measured nothing. Every `describe` below that asserts an absence carries
 * a **negative control** in the same block: the same instrument, run over the input the absence is
 * absent from, going red.
 */

import { InMemoryShelf, MyBlocksStore } from '../../src/editor/src/views/BlocklyEditor/myblocks/store';
import {
  LOGIC_BUILDER_NODE_TYPE,
  definitionUsage,
  definitionUsageMap,
  distinctSites,
  parseWorkspaceParameter,
  referencingNodeIds,
  scanNodeUsage,
  type ProjectScan
} from '../../src/editor/src/views/BlocklyEditor/myblocks/usage';
import { detachDefinition, expandWorkspace } from '../../src/editor/src/views/BlocklyEditor/myblocks/expand';
import { MyBlocksInUseError } from '../../src/editor/src/views/BlocklyEditor/myblocks/store';
import { MyBlocksCycleError } from '../../src/editor/src/views/BlocklyEditor/myblocks/cycles';
import { definitionChangeFor } from '../../src/editor/src/views/BlocklyEditor/myblocks/definitionChange';
import type { BlocklyWorkspaceJson } from '../../src/editor/src/views/BlocklyEditor/myblocks/format';
import { arithmetic, callStatement, callValue, getInput, number, sendSignal, setOutput, workspace } from '../lgc-007/fixtures';

function freshStore() {
  return new MyBlocksStore({ project: new InMemoryShelf('project'), user: new InMemoryShelf('user') });
}

/** `price * rate` with both sockets filled — a value definition with no parameters. */
function discountBody(): BlocklyWorkspaceJson {
  return workspace(arithmetic('MULTIPLY', getInput('price'), number(0.9)));
}

/** A node as the scan sees it: the `workspace` parameter is a JSON **string**, as on disk. */
function node(id: string, label: string, body?: BlocklyWorkspaceJson) {
  return {
    id,
    typename: LOGIC_BUILDER_NODE_TYPE,
    label,
    workspace: body ? JSON.stringify(body) : undefined
  };
}

function scan(...components: ProjectScan['components']): ProjectScan {
  return { components };
}

describe('VFN-009 — finding the call sites', () => {
  it('finds a definition used by a node, and names where it is', () => {
    const store = freshStore();
    const discount = store.save({ name: 'Discount', body: discountBody(), scope: 'project' });

    const project = scan({
      id: 'c1',
      name: 'Checkout',
      path: '/Pages/Checkout',
      nodes: [node('n1', 'Order total', workspace(setOutput('total', callValue(discount.id))))]
    });

    const usage = definitionUsage(discount.id, project, store);

    expect(usage.total).toBe(1);
    expect(usage.nodes).toHaveLength(1);
    expect(usage.nodes[0]).toEqual({
      nodeId: 'n1',
      nodeName: 'Order total',
      componentId: 'c1',
      componentName: 'Checkout',
      componentPath: '/Pages/Checkout'
    });
    expect(usage.componentCount).toBe(1);
  });

  it('counts a definition and a node in the same number, from the same authority', () => {
    // 🔴 The definition half comes from `store.referencesTo`, which is the SAME call `remove` makes
    // when it refuses. A warning that said "5 places" over a refusal naming 4 would be worse than
    // either number alone.
    const store = freshStore();
    const discount = store.save({ name: 'Discount', body: discountBody(), scope: 'project' });
    store.save({ name: 'Tax', body: workspace(arithmetic('ADD', callValue(discount.id), number(1))), scope: 'project' });

    const project = scan({
      id: 'c1',
      name: 'Checkout',
      path: '/Pages/Checkout',
      nodes: [node('n1', 'Order total', workspace(setOutput('total', callValue(discount.id))))]
    });

    const usage = definitionUsage(discount.id, project, store);
    expect(usage.nodes).toHaveLength(1);
    expect(usage.definitions).toHaveLength(1);
    expect(usage.definitions[0].name).toBe('Tax');
    expect(usage.total).toBe(2);
  });

  it('counts components, not nodes, when it says "across n components"', () => {
    const store = freshStore();
    const discount = store.save({ name: 'Discount', body: discountBody(), scope: 'project' });
    const call = () => workspace(setOutput('total', callValue(discount.id)));

    const project = scan(
      { id: 'c1', name: 'Checkout', path: '/Pages/Checkout', nodes: [node('n1', 'A', call()), node('n2', 'B', call())] },
      { id: 'c2', name: 'Cart', path: '/Pages/Cart', nodes: [node('n3', 'C', call())] }
    );

    const usage = definitionUsage(discount.id, project, store);
    expect(usage.nodes).toHaveLength(3);
    expect(usage.componentCount).toBe(2);
  });

  it('counts one node once however many times it calls the same block', () => {
    // The list a refusal is built from. "Used by 3 nodes" about one node three times is the kind of
    // wrongness that makes a builder distrust the whole warning.
    //
    // ⚠️ The dedupe happens **upstream**, in `collectReferences`, which returns each id once per
    // workspace — so this asserts the property rather than the mechanism, and would still hold if
    // the scan ever walked a node twice.
    const store = freshStore();
    const discount = store.save({ name: 'Discount', body: discountBody(), scope: 'project' });

    const twice = workspace(setOutput('a', callValue(discount.id), setOutput('b', callValue(discount.id))));
    const project = scan({ id: 'c1', name: 'Checkout', nodes: [node('n1', 'Order total', twice)] });

    const usage = definitionUsage(discount.id, project, store);
    expect(usage.nodes).toHaveLength(1);
    expect(referencingNodeIds(usage)).toEqual(['n1']);
  });

  it('and `distinctSites` holds that property on its own, over a list that does repeat', () => {
    // 🔴 The test above passes because of a dedupe one layer down, so it does not exercise this
    // one at all. Handed a list with a repeat in it — which is what any future incremental or
    // merged scan would produce — the collapse still has to happen, and here it is measured.
    const site = { nodeId: 'n1', nodeName: 'Order total', componentId: 'c1', componentName: 'Checkout' };
    const repeated = { definitionId: 'd', nodes: [site, site, site], definitions: [], componentCount: 1, total: 3 };

    expect(distinctSites(repeated)).toHaveLength(1);
    expect(referencingNodeIds(repeated)).toEqual(['n1']);
    // …and it does not collapse two genuinely different nodes.
    const two = { ...repeated, nodes: [site, { ...site, nodeId: 'n2', nodeName: 'Shipping' }] };
    expect(referencingNodeIds(two)).toEqual(['n1', 'n2']);
  });

  it('ignores nodes that are not Visual Functions, and workspaces it cannot read', () => {
    const store = freshStore();
    const discount = store.save({ name: 'Discount', body: discountBody(), scope: 'project' });
    const good = workspace(setOutput('total', callValue(discount.id)));

    const project = scan({
      id: 'c1',
      name: 'Checkout',
      nodes: [
        node('n1', 'Order total', good),
        // A `workspace` parameter on a node that is not a Visual Function is not this feature's.
        { id: 'n2', typename: 'Group', label: 'Layout', workspace: JSON.stringify(good) },
        // 🔴 One unreadable node must not cost the whole scan. A count that silently dropped to
        // zero is exactly the input that makes a delete refusal stop refusing.
        { id: 'n3', typename: LOGIC_BUILDER_NODE_TYPE, label: 'Broken', workspace: '{not json' },
        { id: 'n4', typename: LOGIC_BUILDER_NODE_TYPE, label: 'Empty', workspace: '' }
      ]
    });

    expect(referencingNodeIds(definitionUsage(discount.id, project, store))).toEqual(['n1']);
  });

  it('🔴 NEGATIVE CONTROL — the same walk over a project that does use it finds it', () => {
    // The four assertions above are all absences. This is the same `scanNodeUsage`, over the same
    // shapes, returning something: the instrument can find a call site when there is one.
    const store = freshStore();
    const discount = store.save({ name: 'Discount', body: discountBody(), scope: 'project' });

    const empty = scan({ id: 'c1', name: 'Checkout', nodes: [node('n1', 'Order total', workspace(number(1)))] });
    expect(scanNodeUsage(empty).size).toBe(0);

    const used = scan({
      id: 'c1',
      name: 'Checkout',
      nodes: [node('n1', 'Order total', workspace(setOutput('total', callValue(discount.id))))]
    });
    expect(scanNodeUsage(used).get(discount.id)).toHaveLength(1);
  });

  it('parses a workspace parameter in every spelling it arrives in, and refuses the rest', () => {
    expect(parseWorkspaceParameter(JSON.stringify(discountBody()))).toBeTruthy();
    expect(parseWorkspaceParameter(discountBody())).toBeTruthy();
    expect(parseWorkspaceParameter('')).toBeNull();
    expect(parseWorkspaceParameter('   ')).toBeNull();
    expect(parseWorkspaceParameter(undefined)).toBeNull();
    expect(parseWorkspaceParameter('[]')).toBeNull();
    expect(parseWorkspaceParameter('{oops')).toBeNull();
  });

  it('walks the whole shelf in one pass', () => {
    const store = freshStore();
    const a = store.save({ name: 'A', body: discountBody(), scope: 'project' });
    const b = store.save({ name: 'B', body: discountBody(), scope: 'user' });

    const project = scan({
      id: 'c1',
      name: 'Checkout',
      nodes: [node('n1', 'One', workspace(setOutput('t', callValue(a.id))))]
    });

    const map = definitionUsageMap([a.id, b.id], project, store);
    expect(map.get(a.id).total).toBe(1);
    // Criterion 1: every definition on **either** shelf appears, including one nothing uses.
    expect(map.get(b.id).total).toBe(0);
  });
});

describe('VFN-009 criterion 4 — rename does not break a single call site', () => {
  it('leaves every call site pointing at the same block', () => {
    const store = freshStore();
    const discount = store.save({ name: 'Discount', body: discountBody(), scope: 'project' });
    const project = scan({
      id: 'c1',
      name: 'Checkout',
      nodes: [node('n1', 'Order total', workspace(setOutput('total', callValue(discount.id))))]
    });

    const before = referencingNodeIds(definitionUsage(discount.id, project, store));
    store.rename(discount.id, 'Loyalty discount');
    const after = referencingNodeIds(definitionUsage(discount.id, project, store));

    expect(after).toEqual(before);
    expect(store.get(discount.id).name).toBe('Loyalty discount');
    // And the program still expands, which is the consequence rather than the mechanism.
    const body = parseWorkspaceParameter(project.components[0].nodes[0].workspace);
    expect(() => expandWorkspace(body, store)).not.toThrow();
  });

  it('🔴 NEGATIVE CONTROL — a rename that changed identity WOULD break it', () => {
    // Rename is safe by construction, not by care: a call block stores the id. To prove the
    // instrument can see a break at all, the same call site is pointed at a name instead of an id.
    const store = freshStore();
    const discount = store.save({ name: 'Discount', body: discountBody(), scope: 'project' });

    const byName = workspace(setOutput('total', callValue('Discount')));
    expect(() => expandWorkspace(byName, store)).toThrow(/not in this project/);

    const byId = workspace(setOutput('total', callValue(discount.id)));
    expect(() => expandWorkspace(byId, store)).not.toThrow();
  });
});

describe('VFN-009 criterion 5 — delete is refused, and detach is the way through', () => {
  function used() {
    const store = freshStore();
    const discount = store.save({ name: 'Discount', body: discountBody(), scope: 'project' });
    const tax = store.save({
      name: 'Tax',
      body: workspace(arithmetic('ADD', callValue(discount.id), number(1))),
      scope: 'project'
    });
    const program = workspace(setOutput('total', callValue(discount.id)));
    const project = scan({
      id: 'c1',
      name: 'Checkout',
      path: '/Pages/Checkout',
      nodes: [node('n1', 'Order total', program)]
    });
    return { store, discount, tax, program, project };
  }

  it('refuses, naming every definition and every node', () => {
    const { store, discount, project } = used();
    const usage = definitionUsage(discount.id, project, store);

    let thrown: MyBlocksInUseError | undefined;
    try {
      store.remove(discount.id, { referencingNodeIds: referencingNodeIds(usage) });
    } catch (error) {
      thrown = error as MyBlocksInUseError;
    }

    expect(thrown).toBeTruthy();
    expect(thrown.name).toBe('MyBlocksInUseError');
    expect(thrown.nodeIds).toEqual(['n1']);
    expect(thrown.definitionIds).toHaveLength(1);
    // Still there. A refusal that removed it anyway would be the defect wearing a message.
    expect(store.get(discount.id)).toBeTruthy();
  });

  it('🔴 NEGATIVE CONTROL — without the node list the same call does NOT refuse', () => {
    // This is the whole of the task's "real work" in one assertion. The store cannot find nodes;
    // handed nothing, it deletes a definition a node is still calling — silently, which §4 calls
    // the worst available outcome. The refusal above is therefore a property of the list, not of
    // the store, and forgetting to pass it is a live way to reintroduce the defect.
    //
    // Only the *node* edge is present here, so nothing else can be doing the refusing: the store
    // sees a definition that no other definition calls, and a node it cannot see.
    const store = freshStore();
    const discount = store.save({ name: 'Discount', body: discountBody(), scope: 'project' });
    const program = workspace(setOutput('total', callValue(discount.id)));
    const project = scan({ id: 'c1', name: 'Checkout', nodes: [node('n1', 'Order total', program)] });

    // Handed the list, it refuses…
    expect(() =>
      store.remove(discount.id, { referencingNodeIds: referencingNodeIds(definitionUsage(discount.id, project, store)) })
    ).toThrow(MyBlocksInUseError);

    // …handed nothing, it deletes a definition a node is still calling. Silently, which §4 calls
    // the worst available outcome — and the program it leaves behind no longer expands at all.
    expect(() => store.remove(discount.id, { referencingNodeIds: [] })).not.toThrow();
    expect(store.get(discount.id)).toBeUndefined();
    expect(() => expandWorkspace(program, store)).toThrow(/not in this project/);
  });

  it('detaching leaves every referencing program generating identical output', () => {
    // 🔴 The **output**, not the fact that a function ran. `expandWorkspace` is what the generator
    // consumes, so two expansions being equal is exactly "these generate the same JavaScript".
    const { store, discount, tax, program } = used();

    const nodeBefore = expandWorkspace(program, store).workspace;
    const taxBefore = expandWorkspace(store.get(tax.id).body, store).workspace;

    const detachedProgram = detachDefinition(program, discount.id, store);
    const detachedTax = detachDefinition(store.get(tax.id).body, discount.id, store);

    store.save({ id: tax.id, name: 'Tax', body: detachedTax, scope: 'project' });
    store.remove(discount.id, { force: true });

    expect(expandWorkspace(detachedProgram, store).workspace).toEqual(nodeBefore);
    expect(expandWorkspace(store.get(tax.id).body, store).workspace).toEqual(taxBefore);
    expect(store.get(discount.id)).toBeUndefined();
  });

  it('🔴 NEGATIVE CONTROL — deleting WITHOUT detaching does not leave them generating', () => {
    // The absence above ("identical output") means nothing unless the same comparison can fail.
    // Here the definition is force-removed with the bodies left alone, and the program that still
    // calls it stops expanding at all.
    const { store, discount, program } = used();
    store.remove(discount.id, { force: true });

    expect(() => expandWorkspace(program, store)).toThrow(/not in this project/);
  });
});

describe('VFN-009 criterion 7 — a cycle is still refused at save time, with the loop named', () => {
  it('refuses the write and names both blocks', () => {
    const store = freshStore();
    const a = store.save({ name: 'Discount', body: discountBody(), scope: 'project' });
    const b = store.save({ name: 'Tax', body: workspace(arithmetic('ADD', callValue(a.id), number(1))), scope: 'project' });

    // Editing `Discount` from the settings section to call `Tax` closes the loop.
    let thrown: MyBlocksCycleError | undefined;
    try {
      store.save({ id: a.id, name: 'Discount', body: workspace(callValue(b.id)), scope: 'project' });
    } catch (error) {
      thrown = error as MyBlocksCycleError;
    }

    expect(thrown).toBeTruthy();
    expect(thrown.name).toBe('MyBlocksCycleError');
    expect(thrown.message).toContain('Discount');
    expect(thrown.message).toContain('Tax');
    expect(thrown.message).toContain('→');
    // 🔴 And the shelf is exactly as it was. A refused save that half-wrote would be the refusal
    // publishing its silence, which this feature has now shipped twice.
    expect(store.get(a.id).body).toEqual(discountBody());
  });

  it('🔴 NEGATIVE CONTROL — the same edit without the loop is written', () => {
    const store = freshStore();
    const a = store.save({ name: 'Discount', body: discountBody(), scope: 'project' });
    const c = store.save({ name: 'Rounding', body: workspace(number(2)), scope: 'project' });

    const edited = workspace(callValue(c.id));
    expect(() => store.save({ id: a.id, name: 'Discount', body: edited, scope: 'project' })).not.toThrow();
    expect(store.get(a.id).body).toEqual(edited);
  });
});

describe('VFN-009 criterion 2 — an edit is written back to the same id', () => {
  it('every call site picks the new body up on its next expansion', () => {
    const store = freshStore();
    const discount = store.save({ name: 'Discount', body: discountBody(), scope: 'project' });
    const program = workspace(setOutput('total', callValue(discount.id)));

    const before = expandWorkspace(program, store).workspace;

    store.save({
      id: discount.id,
      name: 'Discount',
      body: workspace(arithmetic('MULTIPLY', getInput('price'), number(0.5))),
      scope: 'project'
    });

    const after = expandWorkspace(program, store).workspace;
    expect(after).not.toEqual(before);
    // The consequence, named: the number the program multiplies by is the edited one.
    expect(JSON.stringify(after)).toContain('0.5');
    // Same id, so the call block did not have to move.
    expect(store.list()).toHaveLength(1);
    expect(store.get(discount.id).id).toBe(discount.id);
  });

  it('🔴 NEGATIVE CONTROL — writing the edit under a FRESH id changes nothing at the call site', () => {
    // The failure mode a "save" that minted a new id would produce: the shelf grows, the edit is
    // real, and the program a builder was looking at generates exactly what it did before.
    const store = freshStore();
    const discount = store.save({ name: 'Discount', body: discountBody(), scope: 'project' });
    const program = workspace(setOutput('total', callValue(discount.id)));
    const before = expandWorkspace(program, store).workspace;

    store.save({ name: 'Discount', body: workspace(number(0.5)), scope: 'project' });

    expect(store.list()).toHaveLength(2);
    expect(expandWorkspace(program, store).workspace).toEqual(before);
  });
});

describe('VFN-009 criterion 6 — a shape change is visible before the edit is committed', () => {
  it('the change from value to statement is what the inliner will refuse', () => {
    const store = freshStore();
    const discount = store.save({ name: 'Discount', body: discountBody(), scope: 'project' });
    expect(store.get(discount.id).shape).toBe('value');

    const program = workspace(setOutput('total', callValue(discount.id)));
    expect(() => expandWorkspace(program, store)).not.toThrow();

    // A `send signal` makes it a statement — `inferSignature`'s own rule, applied on save.
    store.save({ id: discount.id, name: 'Discount', body: workspace(sendSignal('done')), scope: 'project' });
    expect(store.get(discount.id).shape).toBe('statement');

    // 🔴 The refusal the warning is reporting is real and names the block.
    expect(() => expandWorkspace(program, store)).toThrow(/is now a statement block/);
  });

  it('🔴 NEGATIVE CONTROL — an edit that keeps the shape refuses nothing', () => {
    const store = freshStore();
    const discount = store.save({ name: 'Discount', body: discountBody(), scope: 'project' });
    const program = workspace(setOutput('total', callValue(discount.id)));

    store.save({
      id: discount.id,
      name: 'Discount',
      body: workspace(arithmetic('ADD', getInput('price'), number(1))),
      scope: 'project'
    });

    expect(store.get(discount.id).shape).toBe('value');
    expect(() => expandWorkspace(program, store)).not.toThrow();
  });
});

describe('VFN-009 criterion 6 — the change is measured against the version being replaced', () => {
  it('the comparison is taken BEFORE the write, which is the only moment it exists', () => {
    // The controller's own order, reproduced here because `saveDefinitionBlocks` reaches
    // `ProjectModel` and cannot be run in this runner.
    const store = freshStore();
    const discount = store.save({ name: 'Discount', body: discountBody(), scope: 'project' });
    const newBody = workspace(sendSignal('done'));

    const before = store.get(discount.id);
    const change = definitionChangeFor(before, newBody);
    store.save({ id: discount.id, name: 'Discount', body: newBody, scope: 'project' });

    expect(change.shapeChanged).toBe(true);
    expect(change.shapeBefore).toBe('value');
    expect(change.shapeAfter).toBe('statement');
  });

  it('🔴 NEGATIVE CONTROL — taken AFTER the write, the same comparison reports nothing', () => {
    // The mistake this order exists to avoid, and it fails **silently**: the definition on the
    // shelf is now the edited one, so comparing it against the body that produced it is comparing
    // a thing to itself. Every shape change would go unreported and every call site would discover
    // the refusal on somebody else's next generate.
    const store = freshStore();
    const discount = store.save({ name: 'Discount', body: discountBody(), scope: 'project' });
    const newBody = workspace(sendSignal('done'));

    store.save({ id: discount.id, name: 'Discount', body: newBody, scope: 'project' });
    const tooLate = definitionChangeFor(store.get(discount.id), newBody);

    expect(tooLate.shapeChanged).toBe(false);
    expect(tooLate.changed).toBe(false);
  });
});

describe('VFN-009 — a statement call site is found the same way', () => {
  it('finds a statement-shaped call', () => {
    const store = freshStore();
    const log = store.save({ name: 'Announce', body: workspace(sendSignal('done')), scope: 'user' });

    const project = scan({
      id: 'c1',
      name: 'Checkout',
      nodes: [node('n1', 'Order total', workspace(callStatement(log.id)))]
    });

    expect(referencingNodeIds(definitionUsage(log.id, project, store))).toEqual(['n1']);
  });
});
