/**
 * NDA-017 — the on-load migration that restores the pre-§2 run-on-value-change contract.
 *
 * Every claim in `runOnValueChangeMigration.ts` gets a row, plus the two the spec calls out as
 * having already cost something once: it must write `false` **explicitly** (a declared default
 * never runs its setter), and it must be idempotent so a second load changes nothing and never
 * overwrites an answer the author gave.
 *
 * ⚠️ What this file cannot reach, and no jest/jasmine row can: **the ordering**. A test sets
 * parameters on a graph that is already built, so the port always exists first; only a saved
 * project applies the parameter first. That is §3's live-QA lesson, it broke the Expression node
 * outright once, and the two mechanisms that make it safe are asserted from the other side here —
 * that the migration emits the `runOnChange-*` keys ahead of the inputs they govern (below), and
 * `NodeScope.setNodeParameters` hoisting them regardless of key order (in the runtime, not here).
 */

import { applyPatches } from '@noodl-models/ProjectPatches/applypatches';
import {
  RUN_ON_CHANGE_FAMILIES,
  RUN_ON_CHANGE_PREFIX,
  applyRunOnValueChangeMigration,
  governedInputsFor,
  planRunOnValueChangeMigration,
  MigrationConnectionLike,
  MigrationNodeLike,
  MigrationProjectLike
} from '@noodl-models/ProjectPatches/runOnValueChangeMigration';

import { defaultCatalog } from '../../src/editor/src/validation/catalog';

function project(nodes: MigrationNodeLike[], connections: MigrationConnectionLike[]): MigrationProjectLike {
  return {
    components: [
      {
        name: '/App',
        graph: { roots: nodes, connections }
      }
    ]
  };
}

function node(id: string, type: string, parameters: Record<string, unknown> = {}): MigrationNodeLike {
  return { id, type, parameters };
}

function wire(fromId: string, fromProperty: string, toId: string, toProperty: string): MigrationConnectionLike {
  return { fromId, fromProperty, toId, toProperty };
}

/** A Button (or anything) driving `toProperty` on `toId`. */
function driver(toId: string, toProperty: string): { node: MigrationNodeLike; wire: MigrationConnectionLike } {
  return { node: node('btn', 'Button'), wire: wire('btn', 'click', toId, toProperty) };
}

describe('NDA-017 migration — the rule', function () {
  it('writes false for a declared value input when the control signal is connected', function () {
    const d = driver('c1', 'eval');
    const p = project([d.node, node('c1', 'Condition', { condition: 'a > 1' })], [d.wire]);

    const plan = planRunOnValueChangeMigration(p);

    expect(plan.writes.length).toBe(1);
    expect(plan.writes[0].parameter).toBe('runOnChange-condition');
    expect(plan.writes[0].nodeType).toBe('Condition');
    expect(plan.writes[0].component).toBe('/App');
    expect(plan.signalDrivenNodes).toBe(1);
    expect(plan.familyNodes).toBe(1);
  });

  it('writes the literal false rather than relying on a default — A-D1', function () {
    const d = driver('c1', 'eval');
    const p = project([d.node, node('c1', 'Condition')], [d.wire]);

    applyRunOnValueChangeMigration(p);

    const parameters = p.components[0].graph.roots[1].parameters;
    // `false`, not absent, not `undefined`, not `null`: the runtime reads absent as *ticked*,
    // so omission would express the opposite of what the author built.
    expect(Object.prototype.hasOwnProperty.call(parameters, 'runOnChange-condition')).toBe(true);
    expect(parameters['runOnChange-condition']).toBe(false);
  });

  it('leaves a node alone when the control signal is NOT connected', function () {
    // A value wire, not a signal wire — the node's setters were live before §2 and still are.
    const p = project(
      [node('src', 'String'), node('c1', 'Condition')],
      [wire('src', 'value', 'c1', 'condition')]
    );

    const plan = planRunOnValueChangeMigration(p);

    expect(plan.writes.length).toBe(0);
    expect(plan.familyNodes).toBe(2); // String is a family too
    expect(plan.signalDrivenNodes).toBe(0);
  });

  it('ignores a control-signal wire whose source node no longer exists', function () {
    // `NodeScope.addConnection` swallows a dangling wire, so it never made the setters passive.
    const p = project([node('c1', 'Condition')], [wire('ghost', 'click', 'c1', 'eval')]);

    expect(planRunOnValueChangeMigration(p).writes.length).toBe(0);
  });

  it('migrates the sources — subscriptions with no port of their own', function () {
    const d = driver('r1', 'fetch');
    const p = project([d.node, node('r1', 'DbModel2')], [d.wire]);

    const written = planRunOnValueChangeMigration(p).writes.map((w) => w.parameter);

    // `modelId` is a value port; `record` is the record-changed subscription. The old
    // `isInputConnected('fetch')` guard silenced both.
    expect(written).toContain('runOnChange-modelId');
    expect(written).toContain('runOnChange-record');
  });

  it('reaches nodes nested in the visual tree, not just roots', function () {
    const child = node('c1', 'Condition');
    const group: MigrationNodeLike = { id: 'g', type: 'Group', parameters: {}, children: [child] };
    const p = project([node('btn', 'Button'), group], [wire('btn', 'click', 'c1', 'eval')]);

    expect(planRunOnValueChangeMigration(p).writes.length).toBe(1);
  });

  it('never touches a type outside the fifteen families', function () {
    // The deprecated twins still carry the OLD guard and were never given checkboxes.
    const p = project(
      [node('btn', 'Button'), node('m', 'Model'), node('c', 'Collection'), node('d', 'DbModel')],
      [wire('btn', 'click', 'm', 'fetch'), wire('btn', 'click', 'c', 'fetch'), wire('btn', 'click', 'd', 'fetch')]
    );

    const plan = planRunOnValueChangeMigration(p);
    expect(plan.writes.length).toBe(0);
    expect(plan.familyNodes).toBe(0);
  });
});

describe('NDA-017 migration — discovered inputs', function () {
  it('governs a Function node by the in- prefix, and never its definition port', function () {
    const d = driver('f1', 'run');
    const f = node('f1', 'JavaScriptFunction', {
      functionScript: 'Outputs.r = Inputs.amount;',
      'in-amount': 3,
      'intype-amount': 'number'
    });
    const p = project([d.node, f], [d.wire, wire('src', 'x', 'f1', 'in-other')]);
    p.components[0].graph.roots.push(node('src', 'String'));

    const written = planRunOnValueChangeMigration(p).writes.map((w) => w.parameter);

    expect(written).toContain('runOnChange-in-amount');
    expect(written).toContain('runOnChange-in-other');
    // `functionScript` keeps the old guard on purpose (§2: dropping it would run every
    // Run-driven script once at load, including the ones that POST).
    expect(written).not.toContain('runOnChange-functionScript');
    // `intype-` is a type declaration, not a value input.
    expect(written).not.toContain('runOnChange-intype-amount');
  });

  it('slices the prefix rather than splitting on the hyphen', function () {
    // The governed name is the FULL port name: `in-my-value`, not `in`.
    const d = driver('f1', 'run');
    const f = node('f1', 'JavaScriptFunction', { 'in-my-value': 1 });
    const p = project([d.node, f], [d.wire]);

    expect(planRunOnValueChangeMigration(p).writes[0].parameter).toBe('runOnChange-in-my-value');
  });

  it('governs an Expression by its free identifiers, and never the expression itself', function () {
    const d = driver('e1', 'run');
    const e = node('e1', 'Expression', { expression: 'a + b', a: 1 });
    const p = project([d.node, e, node('src', 'String')], [d.wire, wire('src', 'value', 'e1', 'b')]);

    const written = planRunOnValueChangeMigration(p).writes.map((w) => w.parameter);

    expect(written.sort()).toEqual(['runOnChange-a', 'runOnChange-b']);
    expect(written).not.toContain('runOnChange-expression');
    expect(written).not.toContain('runOnChange-run');
  });

  it('does not invent a checkbox for an expression identifier nothing feeds', function () {
    // `c` is in the text but has neither a connection nor a parameter, so no value ever
    // arrives on it and its checkbox governs nothing. Writing it would only add a port.
    const d = driver('e1', 'run');
    const e = node('e1', 'Expression', { expression: 'a + b + c', a: 1, b: 2 });
    const p = project([d.node, e], [d.wire]);

    const written = planRunOnValueChangeMigration(p).writes.map((w) => w.parameter);
    expect(written.sort()).toEqual(['runOnChange-a', 'runOnChange-b']);
  });

  it('reads an instance port bag as well as parameters and connections', function () {
    const d = driver('e1', 'run');
    const e: MigrationNodeLike = {
      id: 'e1',
      type: 'Expression',
      parameters: { expression: 'a' },
      dynamicports: [{ name: 'a' }]
    };
    const p = project([d.node, e], [d.wire]);

    expect(planRunOnValueChangeMigration(p).writes.map((w) => w.parameter)).toEqual(['runOnChange-a']);
  });

  it('never treats a checkbox as something to be governed', function () {
    const family = RUN_ON_CHANGE_FAMILIES['Expression'];
    const governed = governedInputsFor(
      { id: 'e', type: 'Expression', parameters: { 'runOnChange-a': false, a: 1 } },
      family,
      []
    );
    expect(governed).toEqual(['a']);
  });
});

describe('NDA-017 migration — idempotency and the author', function () {
  it('is a no-op on a second run', function () {
    const d = driver('c1', 'eval');
    const p = project([d.node, node('c1', 'Condition', { condition: 'x' })], [d.wire]);

    applyRunOnValueChangeMigration(p);
    const after = JSON.parse(JSON.stringify(p));
    const second = applyRunOnValueChangeMigration(p);

    expect(second.writes.length).toBe(0);
    expect(p).toEqual(after);
  });

  it('never overwrites an answer the author already gave — false', function () {
    const d = driver('c1', 'eval');
    const p = project([d.node, node('c1', 'Condition', { 'runOnChange-condition': false })], [d.wire]);

    const plan = planRunOnValueChangeMigration(p);
    expect(plan.writes.length).toBe(0);
    expect(plan.preserved).toBe(1);
  });

  it('never overwrites an answer the author already gave — true', function () {
    // The undo path that matters: the panel writes `true` explicitly when a box is re-ticked
    // (BooleanType.onChange sends Boolean(value), never undefined), so re-ticking survives
    // every future load. Were this row to go red, the migration would fight the user.
    const d = driver('c1', 'eval');
    const p = project([d.node, node('c1', 'Condition', { 'runOnChange-condition': true })], [d.wire]);

    applyRunOnValueChangeMigration(p);

    expect(p.components[0].graph.roots[1].parameters['runOnChange-condition']).toBe(true);
  });

  it('emits the checkbox keys ahead of the inputs they govern', function () {
    // Queued parameters drain in the bag's key order, so a governed value that lands before
    // its own checkbox schedules exactly the load-time run this migration exists to prevent.
    const d = driver('t1', 'set');
    const p = project([d.node, node('t1', 'net.noodl.controls.textinput', { startValue: 'hi', width: 10 })], [d.wire]);

    applyRunOnValueChangeMigration(p);

    const keys = Object.keys(p.components[0].graph.roots[1].parameters);
    expect(keys[0]).toBe('runOnChange-startValue');
    expect(keys.indexOf('runOnChange-startValue')).toBeLessThan(keys.indexOf('startValue'));
    // and nothing is lost in the rebuild
    expect(p.components[0].graph.roots[1].parameters.startValue).toBe('hi');
    expect(p.components[0].graph.roots[1].parameters.width).toBe(10);
  });

  it('survives a project with no components, no graph and no parameters', function () {
    expect(planRunOnValueChangeMigration({}).writes.length).toBe(0);
    expect(planRunOnValueChangeMigration({ components: [] }).writes.length).toBe(0);
    expect(planRunOnValueChangeMigration({ components: [{ name: '/A' }] }).writes.length).toBe(0);
    const bare = project([{ id: 'c1', type: 'Condition' }, { id: 'btn', type: 'Button' }], [
      wire('btn', 'click', 'c1', 'eval')
    ]);
    expect(planRunOnValueChangeMigration(bare).writes.length).toBe(1);
  });
});

describe('NDA-017 migration — the family table matches the shipped catalog', function () {
  const byType = new Map<string, TSFixme>();
  (defaultCatalog() as TSFixme).nodes.forEach((n: TSFixme) => byType.set(n.typeName, n));

  it('declares every family the catalog carries checkboxes for', function () {
    const fromCatalog = (defaultCatalog() as TSFixme).nodes
      .filter((n: TSFixme) => (n.inputs || []).some((p: TSFixme) => p.name.startsWith(RUN_ON_CHANGE_PREFIX)))
      .map((n: TSFixme) => n.typeName)
      .sort();

    const declared = Object.keys(RUN_ON_CHANGE_FAMILIES).sort();

    // Every catalog family is in the table. The reverse does not hold, and that is the finding
    // below: four families mint their ports at runtime and never reach the catalog, and a fifth
    // (Text Input) declares `runOnValueChange` that `createNodeFromReactComponent` drops.
    fromCatalog.forEach((typeName: string) => expect(declared).toContain(typeName));
  });

  it('matches the catalog governed-input set exactly, family by family', function () {
    Object.keys(RUN_ON_CHANGE_FAMILIES).forEach((typeName) => {
      const entry = byType.get(typeName);
      if (!entry) return; // not in the catalog at all — asserted separately below
      const fromCatalog = (entry.inputs || [])
        .filter((p: TSFixme) => p.name.startsWith(RUN_ON_CHANGE_PREFIX))
        .map((p: TSFixme) => p.name.slice(RUN_ON_CHANGE_PREFIX.length))
        .sort();
      if (fromCatalog.length === 0) return; // runtime-minted only
      expect(RUN_ON_CHANGE_FAMILIES[typeName].declared.slice().sort()).toEqual(fromCatalog);
    });
  });

  it('names a control signal that really is a signal input on the type', function () {
    Object.keys(RUN_ON_CHANGE_FAMILIES).forEach((typeName) => {
      const entry = byType.get(typeName);
      if (!entry) return;
      const port = (entry.inputs || []).find(
        (p: TSFixme) => p.name === RUN_ON_CHANGE_FAMILIES[typeName].controlSignal
      );
      // DbCollection2's `storageFetch` is registered at runtime, so it may be absent; when the
      // catalog does carry the port it must be a signal.
      if (!port) return;
      const typeName2 = typeof port.type === 'string' ? port.type : port.type && port.type.name;
      expect(typeName2).toBe('signal');
    });
  });

  it('pins Expression\'s static inputs, which the bare-identifier rule subtracts', function () {
    const entry = byType.get('Expression');
    const declared = (entry.inputs || []).map((p: TSFixme) => p.name).sort();
    // If Expression ever gains a declared input, the migration would start writing a checkbox
    // for it as if it were a free variable. This row is the tripwire.
    expect(declared).toEqual(['expression', 'run']);
    expect(RUN_ON_CHANGE_FAMILIES['Expression'].staticInputs.slice().sort()).toEqual(declared);
  });

  it('⚠️ records that Text Input has no checkbox port in the catalog', function () {
    // NOT a bug in this table. `createNodeFromReactComponent` builds its definition field by
    // field and never copies `runOnValueChange`, so `defineNode` synthesises nothing — while
    // `text-input.ts` calls `shouldRunOnValueChange('startValue')`, which therefore always
    // answers *ticked* and the box cannot be unticked in the panel. Filed, not fixed here.
    // When it IS fixed this row goes red, which is the signal to delete it.
    const entry = byType.get('net.noodl.controls.textinput');
    const boxes = (entry.inputs || []).filter((p: TSFixme) => p.name.startsWith(RUN_ON_CHANGE_PREFIX));
    expect(boxes.length).toBe(0);
  });
});

describe('NDA-017 migration — wired into the load-time patch pass', function () {
  it('runs from applyPatches, alongside the node patches', function () {
    const p = {
      name: 'nda-017',
      components: [
        {
          name: '/App',
          graph: {
            connections: [{ fromId: 'btn', fromProperty: 'click', toId: 'c1', toProperty: 'eval' }],
            roots: [
              { id: 'btn', type: 'Button', parameters: {} },
              { id: 'c1', type: 'Condition', parameters: { condition: 'a > 1' } }
            ]
          }
        }
      ]
    };

    applyPatches(p);

    expect(p.components[0].graph.roots[1].parameters['runOnChange-condition']).toBe(false);
  });
});
