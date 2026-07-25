/**
 * `client-only` node deferral on the SSR server (RUN-002, node server-compat slice).
 *
 * A node definition may declare `ssr: { compat: 'client-only' }`, meaning its logic
 * cannot run without a browser. On the SSR server (a context whose platform sets
 * `isSSRServer`), such a node must be created *inert*: ports exist so connections
 * stay valid, but initialize never runs, setters are no-ops, outputs read
 * undefined, and authored lifecycle hooks are suppressed. Everywhere else —
 * browser, cloud runtime, editor — the node behaves exactly as authored.
 */

import type { NodeDefinitionOptions, NodeInstance } from '@noodl/types';

import NodeContext = require('../src/nodecontext');
import NodeDefinition = require('../src/nodedefinition');

/**
 * Simulates a node whose load path needs the browser: every authored code path
 * throws (as e.g. reading `window` would server-side), so any assertion below
 * passing means that path genuinely did not run.
 */
const clientOnlyNode: NodeDefinitionOptions = {
  name: 'RUN002 ClientOnly',
  category: 'Logic',
  ssr: { compat: 'client-only', note: 'Touches window on every code path.' },

  initialize(this: NodeInstance) {
    this._internal.width = (globalThis as { window?: { innerWidth: number } }).window!.innerWidth;
  },

  inputs: {
    scale: {
      type: 'number',
      default: 1,
      set(this: NodeInstance) {
        throw new Error('setter ran');
      }
    },
    measure: {
      valueChangedToTrue(this: NodeInstance) {
        throw new Error('signal handler ran');
      }
    }
  },

  outputs: {
    width: {
      type: 'number',
      get(this: NodeInstance): number {
        throw new Error('output getter ran');
      }
    },
    done: {
      type: 'signal'
    }
  },

  nodeScopeDidInitialize(this: NodeInstance) {
    throw new Error('nodeScopeDidInitialize ran');
  }
};

function createContext(opts?: { ssrServer?: boolean }) {
  const context = new NodeContext(
    opts?.ssrServer ? { platform: { isSSRServer: () => true } } : undefined
  );
  context.nodeRegister.register(NodeDefinition.defineNode({ ...clientOnlyNode }));
  return context;
}

describe('client-only node deferral on the SSR server', () => {
  let warnSpy: jest.SpyInstance;

  beforeEach(() => {
    warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    warnSpy.mockRestore();
  });

  it('keeps the ssr classification on the compiled metadata', () => {
    const context = createContext();
    const metadata = context.nodeRegister.getNodeMetadata('RUN002 ClientOnly');

    expect(metadata.ssr).toEqual({ compat: 'client-only', note: 'Touches window on every code path.' });
  });

  it('creates the node inert on the SSR server instead of running browser code', () => {
    const context = createContext({ ssrServer: true });

    // initialize would have thrown; creation succeeding is the deferral working.
    const node = context.nodeRegister.createNode('RUN002 ClientOnly', 'n1');

    expect(node._ssrDeferred).toBe(true);
    // Input defaults still apply, so connected nodes reading them see sane values.
    expect(node.getInputValue('scale')).toBe(1);
    // Setters and signal handlers are no-ops, not the authored (throwing) code.
    node.setInputValue('scale', 2);
    node.setInputValue('measure', true);
    // Outputs exist and read undefined rather than running the authored getter.
    expect(node.getOutput('width').value).toBeUndefined();
    // Authored lifecycle is suppressed.
    node.nodeScopeDidInitialize?.();
  });

  it('accepts connection-targeted dynamic inputs without running author registration code', () => {
    const context = createContext({ ssrServer: true });
    const node = context.nodeRegister.createNode('RUN002 ClientOnly', 'n1');

    node.registerInputIfNeeded('some-dynamic-port');
    expect(node.hasInput('some-dynamic-port')).toBe(true);
    node.setInputValue('some-dynamic-port', 'value');
  });

  it('warns once per type so the server log names what was deferred', () => {
    const context = createContext({ ssrServer: true });
    context.nodeRegister.createNode('RUN002 ClientOnly', 'n1');
    context.nodeRegister.createNode('RUN002 ClientOnly', 'n2');

    const deferralWarnings = warnSpy.mock.calls.filter((args) => String(args[0]).includes('client-only'));
    expect(deferralWarnings).toHaveLength(1);
    expect(String(deferralWarnings[0][0])).toContain('RUN002 ClientOnly');
  });

  it('runs the node exactly as authored when the context is not the SSR server', () => {
    const context = createContext();

    // No isSSRServer flag (browser, cloud runtime, editor): authored code runs —
    // and this definition's initialize throws, proving deferral did not engage.
    expect(() => context.nodeRegister.createNode('RUN002 ClientOnly', 'n1')).toThrow();
  });

  it('treats safe and partial classifications as normal everywhere', () => {
    const context = new NodeContext({ platform: { isSSRServer: () => true } });
    let initialized = false;
    context.nodeRegister.register(
      NodeDefinition.defineNode({
        name: 'RUN002 Partial',
        category: 'Logic',
        ssr: { compat: 'partial', note: 'Some behavior completes client-side.' },
        initialize() {
          initialized = true;
        },
        outputs: {
          value: {
            type: 'number',
            get: () => 42
          }
        }
      })
    );

    const node = context.nodeRegister.createNode('RUN002 Partial', 'n1');
    expect(initialized).toBe(true);
    expect(node._ssrDeferred).toBeUndefined();
    expect(node.getOutput('value').value).toBe(42);
  });
});
