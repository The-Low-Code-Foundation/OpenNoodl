/**
 * Array- and object-typed inputs written as a literal.
 *
 * The property panel edits both in a code editor and stores what was typed as a *string*,
 * so `Node.setInputValue` is the thing that turns `{ Authorization: 'Bearer x' }` into an
 * object. That has always been true of `array` (the Options node's Items, a Repeater's
 * Items); `object` was added when AIX-005's integration pass found that object-typed ports
 * had no editor at all, and giving them one is only half a fix if the value then arrives at
 * the node as a string it ignores.
 *
 * The parenthesising in the object branch is the part worth a test: `eval('{a:1, b:2}')`
 * throws, and `eval('{a:1}')` returns 1.
 */

import type { NodeDefinitionOptions, NodeInstance } from '@noodl/types';

import type { RuntimeEditorConnection } from '../src/internal';

import { createGraph } from './helpers/node-harness';

const literalNode: NodeDefinitionOptions = {
  name: 'Literal Input Probe',
  category: 'Logic',
  displayNodeName: 'Literal input probe',
  shortDesc: 'Records what an array- and an object-typed input actually received.',

  initialize(this: NodeInstance) {
    this._internal.list = 'untouched';
    this._internal.record = 'untouched';
  },

  inputs: {
    list: {
      type: 'array',
      displayName: 'List',
      group: 'General',
      set(this: NodeInstance, value: unknown) {
        this._internal.list = value;
      }
    },
    record: {
      type: 'object',
      displayName: 'Record',
      group: 'General',
      set(this: NodeInstance, value: unknown) {
        this._internal.record = value;
      }
    },
    recordObjectForm: {
      // The same type declared the long way, which is how a module-provided node tends to
      // write it. Both spellings must coerce, or the affordance depends on how the node
      // author happened to type the word.
      type: { name: 'object' },
      displayName: 'Record (object form)',
      group: 'General',
      set(this: NodeInstance, value: unknown) {
        this._internal.recordObjectForm = value;
      }
    }
  },

  outputs: {},
  methods: {}
};

interface Warning {
  component: string;
  key: string;
  message: string;
}

function createNode() {
  const graph = createGraph({ node: literalNode });
  const warnings: Warning[] = [];
  graph.context.editorConnection = {
    isConnected: () => false,
    sendWarning: (component: string, _id: string, key: string, warning: { message: string }) =>
      warnings.push({ component, key, message: warning.message }),
    clearWarning: (_component: string, _id: string, key: string) => {
      const index = warnings.findIndex((w) => w.key === key);
      if (index !== -1) warnings.splice(index, 1);
    }
  } as unknown as RuntimeEditorConnection;
  const node = graph.make('Literal Input Probe', 'literal-1');
  node.nodeScope = { componentOwner: { name: '/Probe' } };
  return { node, warnings, internal: () => node._internal };
}

describe('a literal typed into an array- or object-typed input', () => {
  it('parses an array literal, as it always has', () => {
    const { node, internal } = createNode();
    node.setInputValue('list', "['a', 'b']");
    expect(internal().list).toEqual(['a', 'b']);
  });

  it('parses an object literal — braces and all', () => {
    const { node, internal } = createNode();
    // Several keys: the case a bare `eval` throws on.
    node.setInputValue('record', "{ Authorization: 'Bearer x', 'Content-Type': 'application/json' }");
    expect(internal().record).toEqual({ Authorization: 'Bearer x', 'Content-Type': 'application/json' });
  });

  it('does not read a single-key object literal as a labelled statement', () => {
    const { node, internal } = createNode();
    // `eval('{a:1}')` is a block containing the label `a`, and evaluates to 1.
    node.setInputValue('record', '{a: 1}');
    expect(internal().record).toEqual({ a: 1 });
  });

  it('parses JSON, which is what most people paste', () => {
    const { node, internal } = createNode();
    node.setInputValue('record', '{"view": "agenda", "count": 0}');
    expect(internal().record).toEqual({ view: 'agenda', count: 0 });
  });

  it('coerces a type declared as { name: "object" } too', () => {
    const { node, internal } = createNode();
    node.setInputValue('recordObjectForm', '{ a: 1 }');
    expect(internal().recordObjectForm).toEqual({ a: 1 });
  });

  it('leaves a value that is already an object alone', () => {
    const { node, internal } = createNode();
    const value = { already: 'parsed' };
    node.setInputValue('record', value);
    expect(internal().record).toBe(value);
  });

  it('reports an unparseable literal on the canvas instead of failing silently', () => {
    const { node, warnings, internal } = createNode();
    node.setInputValue('record', '{ not: valid,, }');

    expect(internal().record).toEqual({});
    expect(warnings.length).toBe(1);
    expect(warnings[0].component).toBe('/Probe');
    expect(warnings[0].key).toBe('invalid-object-record');
    expect(warnings[0].message).toContain('Invalid object');
  });

  it('clears the warning once the literal parses again', () => {
    const { node, warnings } = createNode();
    node.setInputValue('record', '{ not: valid,, }');
    expect(warnings.length).toBe(1);

    node.setInputValue('record', '{ ok: true }');
    expect(warnings.length).toBe(0);
  });
});
