/**
 * NDA-005 — a port's `description` reaches the reader it was written for.
 *
 * **L-rows.** The task's premise was that 2,508 ports need a `description` written. What reading
 * the code says is that `description` was **declared on both port types and copied nowhere**:
 * `nodedefinition.ts` built its metadata from `tooltip` and never looked at `description`, and
 * the catalog derived its own `description` field by flattening that tooltip. So the field an
 * author would naturally reach for was inert — and three descriptions NDA-003 had already
 * written, on the Variables nodes, about the very contract that task established, reached no
 * consumer at all.
 *
 * These rows pin the plumbing rather than any particular sentence, because the sentences are the
 * cheap half and a silently-dropped field is what made the expensive half worthless.
 */

/* eslint-env jest */

import type { NodeDefinitionOptions } from '@noodl/types';

import NodeDefinition = require('../../src/nodedefinition');

/** Compile one definition and hand back the metadata `getNodeMetadata` would serve. */
function metadataFor(definition: NodeDefinitionOptions) {
  return NodeDefinition.defineNode(definition).metadata;
}

const DESCRIBED: NodeDefinitionOptions = {
  name: 'corpus.Described',
  category: 'Corpus',
  inputs: {
    offset: {
      type: 'number',
      displayName: 'Offset',
      description: 'Number of items to skip before the first result',
      set: function () {
        /* nothing to do — this row is about the metadata, not the behaviour */
      }
    },
    tipOnly: {
      type: 'string',
      displayName: 'Tip Only',
      tooltip: '<h3>Tip Only</h3><p>Documented the old way</p>',
      set: function () {
        /* as above */
      }
    }
  },
  outputs: {
    total: {
      type: 'number',
      displayName: 'Total',
      description: 'How many results the query matched, ignoring Offset and Limit',
      getter: function () {
        return 0;
      }
    },
    undescribed: {
      type: 'number',
      displayName: 'Undescribed',
      getter: function () {
        return 0;
      }
    }
  }
} as NodeDefinitionOptions;

describe('NDA-005: a port description survives compilation', () => {
  test('L1: an input description reaches the compiled metadata', () => {
    const metadata = metadataFor(DESCRIBED);

    expect(metadata.inputs.offset.description).toBe('Number of items to skip before the first result');
  });

  /**
   * The half that had no other route at all. An output port carries **no `tooltip`** — the field
   * does not exist on `OutputPortDefinition` — so before this, an output could not be documented
   * by any means. Half of the library's ports are outputs.
   */
  test('L2: an output description reaches the compiled metadata', () => {
    const metadata = metadataFor(DESCRIBED);

    expect(metadata.outputs.total.description).toBe(
      'How many results the query matched, ignoring Offset and Limit'
    );
  });

  /**
   * `tooltip` and `description` are two documents for two readers and neither is derived from the
   * other. This row is what fails if a later tidy-up decides one field is enough.
   */
  test('L3: tooltip and description are carried independently', () => {
    const metadata = metadataFor(DESCRIBED);

    expect(metadata.inputs.tipOnly.tooltip).toContain('Documented the old way');
    expect(metadata.inputs.tipOnly.description).toBeUndefined();
    expect(metadata.inputs.offset.tooltip).toBeUndefined();
  });

  test('L4 (control): a port with neither carries neither, rather than an empty string', () => {
    const metadata = metadataFor(DESCRIBED);

    expect(metadata.outputs.undescribed.description).toBeUndefined();
  });

  /**
   * The three NDA-003 wrote. This row is not a duplicate of L1: L1 proves the mechanism, and this
   * proves that the descriptions already in the tree — written months before anything read them —
   * are now reaching a reader. Delete it and nothing tells you whether the field is *used*.
   */
  test('L5: the Variables descriptions NDA-003 wrote now reach the metadata', () => {
    const { createDefinition } = require('../../src/nodes/std-library/variables/variablebase').default;
    const definition = createDefinition({
      name: 'corpus.StringVariable',
      displayNodeName: 'String',
      type: { name: 'string' },
      startValue: '',
      emptyOptions: [
        { label: 'null', value: 'null', coerce: null },
        { label: 'Empty string', value: 'empty', coerce: '' }
      ]
    });

    const metadata = metadataFor(definition);

    expect(metadata.inputs.value.description).toContain('abstains');
    expect(metadata.inputs.treatEmptyAs.description).toContain('Back-compat');
    expect(metadata.outputs.savedValue.description).toContain('Can be `null`');
  });
});

/**
 * NDA-005 C1 for the Record family — NDA-012 (Data).
 *
 * **Why a ratchet rather than a spot-check.** The six nodes below get most of their ports from
 * `dbmodelcrudbase`'s five mixins, so a sentence written once covers up to five nodes and a
 * *mixin* that stops carrying `description` silently un-documents all of them at once. C1 is
 * measured out of the node catalog, which is regenerated on someone else's schedule, so nothing
 * else in this repository would notice.
 *
 * ⚠️ **The denominator is static ports only, and that is the honest number rather than the
 * flattering one** (NDA-005 §2). Every one of these nodes also carries dynamic ports —
 * `backendId`, `collectionName`, `relationProperty`, `prop-<field>`, `acl-<id>-<field>`,
 * `visualFilter`, … — pushed through `sendSchemaPorts`, and the wire format they travel on has
 * **no `description` field at all**. They cannot be documented from here and are not counted
 * here; §2(c) owns that gap. A node whose ports are all dynamic would read `0/0` and must be
 * reported as `n/a`, never as 100%.
 */
describe('NDA-005 C1: every static port of the Record family is described', () => {
  /** The family, by the type name the catalog keys on. */
  const RECORD_FAMILY: { typeName: string; module: string; staticPorts: number }[] = [
    { typeName: 'AddDbModelRelation', module: '../../src/nodes/std-library/data/dbmodelnode-addrelation', staticPorts: 9 },
    {
      typeName: 'RemoveDbModelRelation',
      module: '../../src/nodes/std-library/data/dbmodelnode-removerelation',
      staticPorts: 9
    },
    {
      typeName: 'NewDbModelProperties',
      module: '../../src/nodes/std-library/data/newdbmodelpropertiesnode',
      staticPorts: 7
    },
    {
      typeName: 'SetDbModelProperties',
      module: '../../src/nodes/std-library/data/setdbmodelpropertiesnode',
      staticPorts: 11
    },
    {
      typeName: 'DeleteDbModelProperties',
      module: '../../src/nodes/std-library/data/deletedbmodelpropertiesnode',
      staticPorts: 8
    },
    // 9 + the four `runOnChange-…` checkboxes NDA-017 §2 added (`items`, `enabled`, plus the
    // two non-port sources `records` and `filterSettings`). Their descriptions come from
    // `runOnChangeInput`, so the coverage half of this row is satisfied by construction — the
    // count is the half that had to be re-derived, and it is the half this row exists for.
    { typeName: 'FilterDBModels', module: '../../src/nodes/std-library/data/filterdbmodelsnode', staticPorts: 13 }
  ];

  /** Every static port of one node, as `plug.name`, with whatever description it carries. */
  function describedPorts(module: string): { name: string; description?: string }[] {
    // Both shapes appear in this directory: five nodes are `{node, setup}` modules and one is
    // the definition itself. `defineNode` wants the definition.
    const loaded = require(module);
    const definition = (loaded.node || loaded) as NodeDefinitionOptions;
    const metadata = metadataFor(definition);

    return [
      ...Object.keys(metadata.inputs).map((name) => ({ name: `in.${name}`, description: metadata.inputs[name].description })),
      ...Object.keys(metadata.outputs).map((name) => ({
        name: `out.${name}`,
        description: metadata.outputs[name].description
      }))
    ];
  }

  test.each(RECORD_FAMILY)('$typeName: all $staticPorts static ports carry a description', ({ module, staticPorts }) => {
    const ports = describedPorts(module);

    // The count is pinned as well as the coverage: a mixin that stops contributing a port would
    // otherwise raise coverage by shrinking the denominator, which is exactly the failure §2
    // names.
    expect(ports).toHaveLength(staticPorts);

    const undocumented = ports.filter((port) => !port.description).map((port) => port.name);
    expect(undocumented).toEqual([]);
  });

  /**
   * The whole point of documenting on the mixin. `idSource` is contributed by
   * `dbmodelcrudbase.addModelId` and reaches four of the six nodes; before this pass it was the
   * family's *only* covered port, and it was covered by the flattened-tooltip fallback rather
   * than by a sentence anyone wrote for the catalog (§0).
   */
  test('C1: a description written once on a mixin reaches every node that applies it', () => {
    for (const typeName of ['AddDbModelRelation', 'SetDbModelProperties', 'DeleteDbModelProperties']) {
      const entry = RECORD_FAMILY.find((row) => row.typeName === typeName);
      const ports = describedPorts(entry.module);

      const idSource = ports.find((port) => port.name === 'in.idSource');
      expect(idSource.description).toContain('Repeater');
    }
  });

  /**
   * ⚠️ The measurement §2 exists to stop being reported as coverage. Nothing asserts a sentence
   * here, because there is nowhere to put one: this row fails the day `RuntimeDiscoveredPort`
   * grows a `description` the port builders can fill in, which is the signal to come back.
   */
  test('C1: the dynamic ports of this family have no description channel to fill', () => {
    const { recordRelationPorts } = require('../../src/nodes/std-library/data/record-ports');

    const ports = recordRelationPorts({
      selectedCollection: { name: 'nda012d_Owner', fields: [{ name: 'friends', type: 'relation' }] },
      collections: [],
      parameters: {}
    });

    expect(ports).toHaveLength(1);
    expect(ports[0].name).toBe('relationProperty');
    expect(ports[0].description).toBeUndefined();
  });
});
