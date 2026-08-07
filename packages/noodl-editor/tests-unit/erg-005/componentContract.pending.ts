/**
 * ERG-005 §1 — the component interface a reader outside the editor can see.
 *
 * ⚠️ **Why this is in `tests-unit/` and not the jasmine suite.** The only
 * existing coverage of `componentPorts()` is `tests/ai/explain-context.test.ts`,
 * which is the webpack+jasmine bundle: it needs a real Electron renderer, shares
 * the default Electron `userData` with a running dev editor, and cannot be run
 * at all while another session holds the app. `explain/graph.ts` was written
 * structurally typed and import-light on purpose, so it runs here in plain Node
 * — which means this contract is now checkable on every `test:main` run rather
 * than only when someone can spare the editor.
 *
 * The cases are chosen so each one *fails* without the change it covers:
 * the fallback returns bare names, the contract path returns types, and the
 * plug mapping is the one that silently inverts an interface if it is wrong.
 */

import { componentPorts, formatComponentPort } from '../../src/editor/src/models/AiAssistant/explain/graph';
import type { GraphComponent, GraphNode } from '../../src/editor/src/models/AiAssistant/explain/types';

function node(id: string, type: string, instancePorts: string[]): GraphNode {
  return { id, type, parameters: {}, children: [], instancePorts };
}

/** A component with the two port nodes and no serialised contract — a pre-§1 project. */
function legacyComponent(): GraphComponent {
  return {
    name: '/Card',
    nodes: [
      node('a', 'Component Inputs', ['Slug', 'Do']),
      node('b', 'Component Outputs', ['article', 'Failure']),
      node('c', 'Text', [])
    ],
    connections: []
  };
}

describe('componentPorts — a project saved before the contract existed', () => {
  it('recovers the names from the port nodes, sorted', () => {
    const { inputPorts, outputPorts } = componentPorts(legacyComponent());
    expect(inputPorts.map((p) => p.name)).toEqual(['Do', 'Slug']);
    expect(outputPorts.map((p) => p.name)).toEqual(['Failure', 'article']);
  });

  it('states no type at all rather than guessing "*"', () => {
    // The Port Editor's own declarations are all `{"name":"*"}`, so a `*` here
    // would be a fabricated fact, not a derived one. Absent means "not stated".
    for (const port of componentPorts(legacyComponent()).inputPorts) {
      expect(port.type).toBeUndefined();
      expect(port.description).toBeUndefined();
    }
  });
});

describe('componentPorts — the derived contract', () => {
  const withContract: GraphComponent = {
    ...legacyComponent(),
    ports: [
      { name: 'Slug', plug: 'input', type: { name: 'string' }, description: 'Which article to load' },
      { name: 'Do', plug: 'input', type: 'signal' },
      { name: 'article', plug: 'output', type: { name: 'object' } }
    ]
  };

  it('carries the derived type and the authored prose', () => {
    const { inputPorts, outputPorts } = componentPorts(withContract);
    expect(inputPorts).toEqual([
      { name: 'Do', type: 'signal' },
      { name: 'Slug', type: 'string', description: 'Which article to load' }
    ]);
    expect(outputPorts).toEqual([{ name: 'article', type: 'object' }]);
  });

  it('reads a type written either as a bare name or as the library\'s object', () => {
    const { inputPorts } = componentPorts(withContract);
    expect(inputPorts.find((p) => p.name === 'Do')!.type).toBe('signal');
    expect(inputPorts.find((p) => p.name === 'Slug')!.type).toBe('string');
  });

  /**
   * ⚠️ The mapping that inverts an interface if it is wrong. `plug` is the
   * direction **on the instance**, so an instance input is a Component *Input* —
   * even though `ComponentModel.getPorts()` builds it from a map it calls
   * `outputsMap`. Getting this backwards produces a plausible, fully populated,
   * completely reversed interface.
   */
  it('maps plug to the direction a parent sees, not the direction inside', () => {
    const { inputPorts, outputPorts } = componentPorts(withContract);
    expect(inputPorts.map((p) => p.name)).toEqual(['Do', 'Slug']);
    expect(outputPorts.map((p) => p.name)).toEqual(['article']);
  });

  it('puts an input/output port on both sides', () => {
    const both: GraphComponent = {
      ...legacyComponent(),
      ports: [{ name: 'Value', plug: 'input/output', type: 'string' }]
    };
    const { inputPorts, outputPorts } = componentPorts(both);
    expect(inputPorts.map((p) => p.name)).toEqual(['Value']);
    expect(outputPorts.map((p) => p.name)).toEqual(['Value']);
  });

  it('falls back to the port nodes when the contract is present but empty', () => {
    // A component whose ports are all unresolved serialises `ports: []`, and an
    // empty contract must not read as "this component has no interface".
    const empty: GraphComponent = { ...legacyComponent(), ports: [] };
    expect(componentPorts(empty).inputPorts.map((p) => p.name)).toEqual(['Do', 'Slug']);
  });

  it('drops a malformed entry rather than emitting a nameless port', () => {
    const messy: GraphComponent = {
      ...legacyComponent(),
      ports: [{ name: 'Slug', plug: 'input', type: 'string' }, { plug: 'input' } as never, null as never]
    };
    expect(componentPorts(messy).inputPorts).toEqual([{ name: 'Slug', type: 'string' }]);
  });
});

describe('formatComponentPort', () => {
  it('renders name, type and prose when all three are known', () => {
    expect(formatComponentPort({ name: 'Slug', type: 'string', description: 'Which article' })).toBe(
      'Slug: string — Which article'
    );
  });

  it('omits the prose when there is none', () => {
    expect(formatComponentPort({ name: 'Slug', type: 'string' })).toBe('Slug: string');
  });

  it('prints an untyped port bare rather than as "*"', () => {
    expect(formatComponentPort({ name: 'Slug' })).toBe('Slug');
  });
});
