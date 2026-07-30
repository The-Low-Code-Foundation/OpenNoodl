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
