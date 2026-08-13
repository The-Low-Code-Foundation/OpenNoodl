/**
 * The Ports tab's live-value read-out — what a `portValues` reply is allowed to
 * put on a row.
 *
 * Every fixture here is the shape `NodeContext.getPortValues` actually returns
 * (`{ node, port, direction, exists, value }`, the value already rendered by
 * `previewValue`), not the shape a port "ought" to have. The two differ on the
 * point this module exists for: an input the runtime has never been given reads
 * back as the literal string `'undefined'` while the node is happily running on
 * its own default.
 *
 * What a spec cannot decide — that the values follow a running app, that the
 * poll stops when the panel closes — is a live check against a preview.
 */

import {
  foldPortValues,
  isValuePort,
  portValueKey,
  portValuesStatus,
  samePortValues,
  type PortValueReply
} from '../../src/editor/src/views/panels/propertyeditor/components/PortsTab/portValues';

function reply(over: Partial<PortValueReply>): PortValueReply {
  return { node: 'node-a', port: 'text', direction: 'output', exists: true, value: '"hi"', ...over };
}

describe('Ports tab live values: which ports are asked about', () => {
  it('asks about a value port', () => {
    expect(isValuePort({ name: 'text', isSignal: false })).toBe(true);
  });

  it('does not ask about a signal — it carries no value to read', () => {
    expect(isValuePort({ name: 'send', isSignal: true })).toBe(false);
  });

  it('does not ask about a port with no name, which is not addressable', () => {
    expect(isValuePort({ name: '', isSignal: false })).toBe(false);
    expect(isValuePort({ isSignal: false })).toBe(false);
  });
});

describe('Ports tab live values: the key', () => {
  it('includes the direction, because one node may have the same name on both sides', () => {
    expect(portValueKey('n1', 'value', 'input')).not.toEqual(portValueKey('n1', 'value', 'output'));
  });
});

describe('Ports tab live values: what the header is allowed to claim', () => {
  it('says nothing is running when there is no preview, whatever it last held', () => {
    expect(portValuesStatus({ isPreviewRunning: false, hasAnswered: true, nodeIsLive: true })).toEqual('no-preview');
  });

  /**
   * ⚠️ The round trip has not come back yet. Collapsing this into `absent` put
   * "this node is not on screen" on the panel for a beat on every selection.
   */
  it('does not call a node absent before the first reply has arrived', () => {
    expect(portValuesStatus({ isPreviewRunning: true, hasAnswered: false, nodeIsLive: false })).toEqual('waiting');
  });

  it('calls the node absent once the runtime has answered and does not hold it', () => {
    expect(portValuesStatus({ isPreviewRunning: true, hasAnswered: true, nodeIsLive: false })).toEqual('absent');
  });

  it('calls the values live once the runtime has answered about the node', () => {
    expect(portValuesStatus({ isPreviewRunning: true, hasAnswered: true, nodeIsLive: true })).toEqual('live');
  });
});

describe('Ports tab live values: folding a reply', () => {
  it('keeps a value under the key its row looks up', () => {
    const { values } = foldPortValues([reply({ port: 'text', value: '"Hello"' })], 'node-a');
    expect(values[portValueKey('node-a', 'text', 'output')]).toEqual('"Hello"');
  });

  it('reports the node as live as soon as one port answered', () => {
    expect(foldPortValues([reply({})], 'node-a').nodeIsLive).toBe(true);
  });

  it('reports the node as not live when nothing exists — it is not on screen', () => {
    const folded = foldPortValues([reply({ exists: false, value: undefined })], 'node-a');
    expect(folded.nodeIsLive).toBe(false);
    expect(folded.values).toEqual({});
  });

  it('ignores an entry about another node, because the relay broadcasts every reply', () => {
    const folded = foldPortValues([reply({ node: 'node-b' })], 'node-a');
    expect(folded.nodeIsLive).toBe(false);
    expect(folded.values).toEqual({});
  });

  /**
   * ⚠️ The one rule that would otherwise print a falsehood. `getInputValue`
   * returns what has been *set*; a node's own default never passes through it.
   */
  it('drops an unset input rather than claiming it is undefined', () => {
    const folded = foldPortValues([reply({ port: 'width', direction: 'input', value: 'undefined' })], 'node-a');
    expect(folded.values).toEqual({});
    // Still live: the port answered, so the runtime holds the node.
    expect(folded.nodeIsLive).toBe(true);
  });

  it('keeps an output that is currently undefined — that is the node’s real answer', () => {
    const folded = foldPortValues([reply({ port: 'result', direction: 'output', value: 'undefined' })], 'node-a');
    expect(folded.values[portValueKey('node-a', 'result', 'output')]).toEqual('undefined');
  });

  it('keeps a falsy input value — 0 and "" are values, not absences', () => {
    const folded = foldPortValues(
      [
        reply({ port: 'count', direction: 'input', value: '0' }),
        reply({ port: 'label', direction: 'input', value: '""' })
      ],
      'node-a'
    );
    expect(folded.values[portValueKey('node-a', 'count', 'input')]).toEqual('0');
    expect(folded.values[portValueKey('node-a', 'label', 'input')]).toEqual('""');
  });

  it('keeps the runtime’s guard string, which is a fact about the port', () => {
    const folded = foldPortValues([reply({ port: 'items', value: '<unreadable>' })], 'node-a');
    expect(folded.values[portValueKey('node-a', 'items', 'output')]).toEqual('<unreadable>');
  });

  /** The poll answers every second; only a *change* may cost a render. */
  it('recognises an unchanged fold, so an idle poll does not re-render the rows', () => {
    const replies = [reply({ port: 'text', value: '"Hello"' })];
    expect(samePortValues(foldPortValues(replies, 'node-a'), foldPortValues(replies, 'node-a'))).toBe(true);
  });

  it('recognises a changed value', () => {
    const before = foldPortValues([reply({ port: 'text', value: '"Hello"' })], 'node-a');
    const after = foldPortValues([reply({ port: 'text', value: '"Goodbye"' })], 'node-a');
    expect(samePortValues(before, after)).toBe(false);
  });

  it('recognises a node that has gone off screen even when it held no values', () => {
    const live = foldPortValues([reply({ port: 'width', direction: 'input', value: 'undefined' })], 'node-a');
    const gone = foldPortValues([reply({ port: 'width', direction: 'input', exists: false })], 'node-a');
    expect(live.values).toEqual(gone.values);
    expect(samePortValues(live, gone)).toBe(false);
  });

  it('replaces rather than merges, so a value cannot outlive the reply that carried it', () => {
    const first = foldPortValues([reply({ port: 'text', value: '"one"' })], 'node-a');
    const second = foldPortValues([reply({ port: 'other', value: '"two"' })], 'node-a');
    expect(Object.keys(first.values)).toEqual([portValueKey('node-a', 'text', 'output')]);
    expect(Object.keys(second.values)).toEqual([portValueKey('node-a', 'other', 'output')]);
  });
});
