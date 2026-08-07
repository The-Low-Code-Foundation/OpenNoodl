/**
 * AAQ-002 — the Record family's `prop-<field>` ports, asserted on the ASSEMBLED nodes.
 *
 * ## Why this file exists, and why the existing tests could not have caught it
 *
 * Richard's finding #7 was *"'prop-age' 'prop-bio' with errors, saying those ports don't
 * exist"*. Phase 40 proposed three mechanisms for it and fixed all three — provisioning was
 * late (wrong), the schema cache was never written (right), the backend was reused and its
 * columns never reconciled (right). With every one of them fixed, a live pass on 2026-08-05
 * still found **no `prop-*` ports at all**, on a project whose cached schema was correct and
 * whose Class dropdown listed the collection.
 *
 * The cause was in the mixin assembly, not in the schema at all. `addBaseInfo` defaulted its
 * `includeInputProperties` option with `opts === undefined || opts.includeInputProperties`,
 * so the moment ERG-001 §4 added a `done` sentence to the same options object —
 * `addBaseInfo(def, { done })` — the expression went falsy and **Create Record and Update
 * Record stopped emitting property ports entirely, on every backend, in every project.**
 *
 * `schema-ports.test.js` and `record-picker-single-backend.test.ts` both drive the *pure
 * generators*, which were never broken, and both stayed green throughout. So this file
 * drives the real node modules — the objects the runtime registers, after every mixin has
 * run — through `setup()`, and asserts what actually reaches `sendDynamicPorts`. That is the
 * only altitude at which the defect is visible.
 *
 * The second half of the file is the other side of the same claim: the three nodes that must
 * **not** have property ports still do not have them. A fix that turned the flag on for
 * everybody would pass the first half alone.
 */

import type { RuntimeDiscoveredPort } from '@noodl/types';

/* eslint-disable @typescript-eslint/no-explicit-any */
type Any = any;

import CreateRecord = require('../../src/nodes/std-library/data/newdbmodelpropertiesnode');
import UpdateRecord = require('../../src/nodes/std-library/data/setdbmodelpropertiesnode');
import DeleteRecord = require('../../src/nodes/std-library/data/deletedbmodelpropertiesnode');
import AddRelation = require('../../src/nodes/std-library/data/dbmodelnode-addrelation');
import RemoveRelation = require('../../src/nodes/std-library/data/dbmodelnode-removerelation');

/**
 * The project a wizard-built app has after AAQ-002: bound to the built-in backend, with the
 * introspected schema cached in `dbCollections`.
 *
 * ⚠️ Spelled in the **backend's own shape** — `{name, columns}` — rather than the normalised
 * one, because that is what `SchemaHandler` caches (`backend:getSchema` returns `{tables}`)
 * and `collectionsFromParseClasses` is what makes the two meet. A fixture written in the
 * normalised shape would test the generator against an input the product never produces.
 */
const PUPPY_COLLECTION = {
  name: 'Puppy',
  columns: [
    { name: 'name', type: 'String' },
    { name: 'age', type: 'Number' },
    { name: 'bio', type: 'String' }
  ]
};

const PROJECT_METADATA: Record<string, unknown> = {
  cloudservices: { endpoint: 'http://localhost:8581', appId: 'backend_x', type: 'nodegx' },
  dbCollections: [PUPPY_COLLECTION]
};

/**
 * Drive one assembled node module's `setup` and return the ports it announced.
 *
 * The graph model is the smallest thing `setup` accepts, and it has to honour two contracts
 * that are easy to miss: `editorImportComplete` is what gates the whole port pass (nothing
 * happens before it fires), and `getNodesWithType` is how `setup` finds the nodes to manage.
 */
function portsFor(module: Any, parameters: Record<string, unknown>): RuntimeDiscoveredPort[] {
  const node = { id: 'n1', parameters, on: () => undefined };
  const handlers: Record<string, (() => void)[]> = {};
  let announced: RuntimeDiscoveredPort[] = [];

  const graphModel = {
    getMetaData: (key: string) => PROJECT_METADATA[key],
    getNodesWithType: (typeName: string) => (typeName === module.node.name ? [node] : []),
    on: (event: string, handler: () => void) => {
      handlers[event] = handlers[event] || [];
      handlers[event].push(handler);
    },
    off: () => undefined
  } as Any;

  const context = {
    editorConnection: {
      isRunningLocally: () => true,
      sendDynamicPorts: (_nodeId: string, ports: RuntimeDiscoveredPort[]) => {
        announced = ports;
      }
    }
  } as Any;

  module.setup(context, graphModel);
  // Nothing is announced until the import completes — the runtime's own ordering.
  (handlers['editorImportComplete'] || []).forEach((h) => h());

  return announced;
}

const namesOf = (ports: RuntimeDiscoveredPort[]) => ports.map((p) => p.name);
const ON_PUPPY = { collectionName: 'Puppy' };

describe('AAQ-002 — Create Record announces one input port per column', () => {
  const ports = portsFor(CreateRecord, ON_PUPPY);

  test('every column of the selected class is an input port', () => {
    // The regression, stated as bluntly as it deserves: this was `[]` for a year.
    expect(namesOf(ports)).toEqual(expect.arrayContaining(['prop-name', 'prop-age', 'prop-bio']));
  });

  test('the ports are inputs, in the Properties group', () => {
    const propPorts = ports.filter((p) => p.name.startsWith('prop-'));
    expect(propPorts).toHaveLength(3);
    for (const port of propPorts) {
      expect(port.plug).toBe('input');
      expect(port.group).toBe('Properties');
    }
  });

  test('the column type decides the port type', () => {
    const byName = new Map(ports.map((p) => [p.name, p]));
    expect((byName.get('prop-name')?.type as Any).name).toBe('string');
    expect((byName.get('prop-age')?.type as Any).name).toBe('number');
  });

  test('and the Class dropdown is announced alongside them', () => {
    // The Class port kept working throughout the regression, which is exactly what made it
    // look like a schema problem: the node knew the collection and offered no way to write.
    expect(namesOf(ports)).toContain('collectionName');
  });

  test('a class the project does not have gets the dropdown and no property ports', () => {
    const ports = portsFor(CreateRecord, { collectionName: 'Kitten' });
    expect(namesOf(ports)).toContain('collectionName');
    expect(namesOf(ports).filter((n) => n.startsWith('prop-'))).toEqual([]);
  });

  test('and a node with no class chosen yet has no property ports either', () => {
    expect(namesOf(portsFor(CreateRecord, {})).filter((n) => n.startsWith('prop-'))).toEqual([]);
  });
});

describe('AAQ-002 — Update Record does the same', () => {
  test('it announces one input port per column', () => {
    // Broken by the same commit and for the same reason. Asserted separately because the
    // two nodes assemble their mixins in a different order.
    expect(namesOf(portsFor(UpdateRecord, ON_PUPPY))).toEqual(
      expect.arrayContaining(['prop-name', 'prop-age', 'prop-bio'])
    );
  });
});

describe('AAQ-002 — the nodes that must NOT have property ports', () => {
  // The other half of the claim. `_hasInputProperties` is now derived from the
  // `addInputProperties` mixin, and none of these three call it — so if the derivation is
  // ever replaced by a flag again, these fail rather than quietly gaining dead ports whose
  // setters do not exist.
  test('Delete Record has none — it identifies a record, it does not write fields', () => {
    const names = namesOf(portsFor(DeleteRecord, ON_PUPPY));
    expect(names).toContain('collectionName');
    expect(names.filter((n) => n.startsWith('prop-'))).toEqual([]);
  });

  test('Add Relation has none, and does have its relation dropdown', () => {
    const names = namesOf(portsFor(AddRelation, ON_PUPPY));
    expect(names.filter((n) => n.startsWith('prop-'))).toEqual([]);
    expect(names).toContain('relationProperty');
  });

  test('Remove Relation has none, and does have its relation dropdown', () => {
    const names = namesOf(portsFor(RemoveRelation, ON_PUPPY));
    expect(names.filter((n) => n.startsWith('prop-'))).toEqual([]);
    expect(names).toContain('relationProperty');
  });
});
