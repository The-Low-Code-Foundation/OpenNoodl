/**
 * CED-001 (B1/B2) — code history must not touch `project.json`.
 *
 * Jasmine, not jest: the editor's renderer suite is a webpack+jasmine bundle (see
 * `tests/index.ts`), so these use the globals Jasmine provides.
 */

import {
  CODE_HISTORY_METADATA_PREFIX,
  stripCodeHistoryMetadata
} from '../../src/editor/src/models/CodeHistory/codeHistoryMetadata';
import { NodeGraphNode } from '../../src/editor/src/models/nodegraphmodel/NodeGraphNode';

describe('stripCodeHistoryMetadata', () => {
  it('leaves metadata without history untouched, by identity', () => {
    const metadata = { comment: 'a note', merge: { soureCodePorts: ['functionScript'] } };
    expect(stripCodeHistoryMetadata(metadata)).toBe(metadata);
  });

  it('passes undefined through', () => {
    expect(stripCodeHistoryMetadata(undefined)).toBeUndefined();
  });

  it('removes every codeHistory_ key and keeps the rest', () => {
    const stripped = stripCodeHistoryMetadata({
      comment: 'a note',
      [`${CODE_HISTORY_METADATA_PREFIX}functionScript`]: [{ code: 'x', timestamp: 't', hash: 'h' }],
      [`${CODE_HISTORY_METADATA_PREFIX}expression`]: [{ code: 'y', timestamp: 't', hash: 'h' }]
    });

    expect(stripped).toEqual({ comment: 'a note' });
  });

  it('drops the metadata object entirely when history was all it held', () => {
    // Otherwise the node would serialise `"metadata": {}` where there was no key.
    const stripped = stripCodeHistoryMetadata({
      [`${CODE_HISTORY_METADATA_PREFIX}functionScript`]: [{ code: 'x', timestamp: 't', hash: 'h' }]
    });

    expect(stripped).toBeUndefined();
  });

  it('does not mutate its argument', () => {
    const metadata = { [`${CODE_HISTORY_METADATA_PREFIX}code`]: [], comment: 'kept' };
    stripCodeHistoryMetadata(metadata);
    expect(Object.keys(metadata).length).toBe(2);
  });
});

describe('NodeGraphNode.fromJSON', () => {
  it('sheds code history carried by an existing project', () => {
    const node = NodeGraphNode.fromJSON({
      id: 'node-1',
      x: 0,
      y: 0,
      type: 'JavaScriptFunction',
      parameters: { functionScript: 'Outputs.a = 1;' },
      metadata: {
        comment: 'a note',
        [`${CODE_HISTORY_METADATA_PREFIX}functionScript`]: [
          { code: 'Outputs.a = 0;', timestamp: '2026-01-01T00:00:00.000Z', hash: 'h' }
        ]
      }
    });

    expect(node.metadata).toEqual({ comment: 'a note' });

    // ...and therefore does not write it back out again.
    const json = node.toJSON();
    const historyKeys = Object.keys(json.metadata || {}).filter((key) =>
      key.startsWith(CODE_HISTORY_METADATA_PREFIX)
    );
    expect(historyKeys).toEqual([]);
  });

  it('strips history from children too', () => {
    const node = NodeGraphNode.fromJSON({
      id: 'parent',
      x: 0,
      y: 0,
      type: 'Group',
      children: [
        {
          id: 'child',
          x: 0,
          y: 0,
          type: 'JavaScriptFunction',
          metadata: { [`${CODE_HISTORY_METADATA_PREFIX}functionScript`]: [] }
        }
      ]
    });

    expect(node.children[0].metadata).toBeUndefined();
  });
});
