/**
 * FH-019 — the names the code editor completes, read off a project.
 *
 * `collectProjectNames` is pure over the `forEachComponent`/`forEachNode`/
 * `getPorts` walk, which is why it lives here rather than in the jasmine suite:
 * it needs no renderer, no editor singleton and no real `ProjectModel` — only
 * something with that shape.
 *
 * The two halves it has to get right are the two places a variable name can
 * live. A `Set Variable` node declares one through a port typed
 * `identifierOf: 'VariableName'`; a Function node declares one by writing
 * `Noodl.Variables.total` in code that no port describes. A completion list
 * built from only the first is the one the property panel's picker already
 * offers, and would have missed every variable a project touches only from
 * script.
 */
import { collectProjectNames } from '@noodl-models/CodeAuthoringContext/collect';

interface FakePort {
  name: string;
  type: unknown;
}

interface FakeNode {
  parameters: Record<string, unknown>;
  ports: FakePort[];
}

/** The three calls `collectProjectNames` makes, and nothing else. */
function projectOf(...nodes: FakeNode[]) {
  return {
    forEachComponent(callback: (component: unknown) => void) {
      callback({
        forEachNode(nodeCallback: (node: unknown) => void) {
          for (const node of nodes) {
            nodeCallback({ parameters: node.parameters, getPorts: () => node.ports });
          }
        }
      });
    }
  } as never;
}

const variableNamePort: FakePort = {
  name: 'name',
  type: { name: 'string', identifierOf: 'VariableName' }
};

describe('collectProjectNames', () => {
  it('returns empty lists when no project is open', () => {
    expect(collectProjectNames(undefined)).toEqual({ variables: [], objects: [], arrays: [] });
  });

  it('reads a variable name off an identifier-typed port', () => {
    const project = projectOf({ parameters: { name: 'cartTotal' }, ports: [variableNamePort] });
    expect(collectProjectNames(project).variables).toEqual(['cartTotal']);
  });

  it('sorts an id into the family its port declares', () => {
    const project = projectOf(
      { parameters: { name: 'cartTotal' }, ports: [variableNamePort] },
      { parameters: { id: 'session' }, ports: [{ name: 'id', type: { name: 'string', identifierOf: 'ModelName' } }] },
      {
        parameters: { id: 'todos' },
        ports: [{ name: 'id', type: { name: 'string', identifierOf: 'CollectionName' } }]
      }
    );

    expect(collectProjectNames(project)).toEqual({
      variables: ['cartTotal'],
      objects: ['session'],
      arrays: ['todos']
    });
  });

  it('ignores a plain string port, and an identifier family it does not complete', () => {
    const project = projectOf({
      parameters: { label: 'cartTotal', channel: 'updates' },
      ports: [
        { name: 'label', type: 'string' },
        { name: 'channel', type: { name: 'string', identifierOf: 'EventChannelName' } }
      ]
    });

    expect(collectProjectNames(project)).toEqual({ variables: [], objects: [], arrays: [] });
  });

  it('ignores a port whose parameter has never been set', () => {
    const project = projectOf({ parameters: {}, ports: [variableNamePort] });
    expect(collectProjectNames(project).variables).toEqual([]);
  });

  it('finds a variable that exists only in a Function node’s code', () => {
    const project = projectOf({
      parameters: { functionScript: 'Outputs.total = Noodl.Variables.cartTotal * 2;' },
      ports: []
    });

    expect(collectProjectNames(project).variables).toEqual(['cartTotal']);
  });

  it('finds the bare form an Expression uses', () => {
    const project = projectOf({ parameters: { expression: 'Variables.vatRate * 100' }, ports: [] });
    expect(collectProjectNames(project).variables).toEqual(['vatRate']);
  });

  it('finds the bracket form', () => {
    const project = projectOf({
      parameters: { functionScript: 'Noodl.Variables["user name"];' },
      ports: []
    });

    expect(collectProjectNames(project).variables).toEqual(['user name']);
  });

  it('finds objects and arrays in code too', () => {
    const project = projectOf({
      parameters: { functionScript: 'Noodl.Objects.session.set({});\nNoodl.Arrays.todos.add(1);' },
      ports: []
    });

    expect(collectProjectNames(project)).toEqual({ variables: [], objects: ['session'], arrays: ['todos'] });
  });

  it('reports a name declared twice only once', () => {
    const project = projectOf(
      { parameters: { name: 'cartTotal' }, ports: [variableNamePort] },
      { parameters: { name: 'cartTotal' }, ports: [variableNamePort] },
      { parameters: { functionScript: 'Noodl.Variables.cartTotal;' }, ports: [] }
    );

    expect(collectProjectNames(project).variables).toEqual(['cartTotal']);
  });

  it('does not scan a parameter too short to contain a reference', () => {
    // A guard against walking every label and colour in the project, not a
    // guess about what code looks like.
    const project = projectOf({ parameters: { label: 'Variables.', color: '#fff' }, ports: [] });
    expect(collectProjectNames(project).variables).toEqual([]);
  });

  it('survives a node with no parameters object at all', () => {
    const project = projectOf({ parameters: undefined as never, ports: [] });
    expect(() => collectProjectNames(project)).not.toThrow();
  });
});
