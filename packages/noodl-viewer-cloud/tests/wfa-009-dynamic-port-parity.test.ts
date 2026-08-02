/**
 * WFA-009 — the two generators of `pm-<name>` must agree, port for port.
 *
 * `setup()` in `request.ts`/`response.ts` pushes these ports from a running
 * cloud runtime over `sendDynamicPorts`; the `namedports/list` entry in the same
 * files' `dynamicports` lets the editor mint them with nothing running. Since
 * WF-007 only the second one ever fires — but `setup()` is **not dead code**
 * (WFA-009 spec, trap 5), and if a cloud runtime with an editor connection ever
 * returns, both will write the same `NodeGraphNode.setDynamicPorts`.
 *
 * That coexistence is safe for exactly one reason: `setDynamicPorts` opens with
 * `if (portsEqual(ports, this.dynamicports)) return;`, so whichever writes
 * second is a no-op **while the two produce equal lists**. This suite is what
 * makes that a checked property rather than a hope. If someone edits one
 * generator and not the other, it fails naming both files.
 *
 * It runs the REAL `setup()` — not a copy of its logic — against a fake editor
 * connection, and the REAL editor-side evaluator, imported across the package
 * boundary because "these two files agree" is the whole assertion.
 */
import {
  generatedPortsForNode,
  type GeneratedPort
} from '../../noodl-editor/src/editor/src/models/nodelibrary/dynamicPortRules';
import { node as requestNode, setup as requestSetup } from '../src/nodes/cloud/request';
import { node as responseNode, setup as responseSetup } from '../src/nodes/cloud/response';

type Parameters = Record<string, unknown>;

/** What a running cloud runtime would push for these parameters. */
function portsFromRuntimeSetup(
  setup: (context: unknown, graphModel: unknown) => void,
  typename: string,
  parameters: Parameters
): GeneratedPort[] {
  const pushed: GeneratedPort[][] = [];
  const graphNode = {
    id: 'node-under-test',
    parameters,
    on: () => {
      /* the parameterUpdated subscription is not exercised here */
    }
  };

  const graphModel = {
    on: (event: string, callback: () => void) => {
      // Only the import-complete gate is opened; `nodeAdded.<type>` must not fire.
      if (event === 'editorImportComplete') callback();
    },
    getNodesWithType: (t: string) => (t === typename ? [graphNode] : [])
  };

  const context = {
    editorConnection: {
      isRunningLocally: () => true,
      sendDynamicPorts: (_id: string, ports: GeneratedPort[]) => pushed.push(ports)
    }
  };

  setup(context as unknown, graphModel as unknown);

  if (pushed.length === 0) throw new Error(`setup() for ${typename} pushed no ports at all`);
  return pushed[pushed.length - 1];
}

/** What the editor mints for the same parameters, from the node's own library entry. */
function portsFromLibraryRule(type: { dynamicports?: unknown[] }, parameters: Parameters): GeneratedPort[] {
  return generatedPortsForNode({
    type,
    parameters,
    getParameter: (name: string) => parameters[name]
  });
}

/**
 * Every parameter state worth disagreeing over: nothing set, one name, several,
 * the empty string an author leaves behind after deleting the last entry, the
 * double comma the JSON editor can produce, a repeated name, and — for Response
 * — each value of the `status` its rule is conditioned on.
 */
const CASES: { label: string; parameters: Parameters }[] = [
  { label: 'no params at all', parameters: {} },
  { label: 'one name', parameters: { params: 'total' } },
  { label: 'several names', parameters: { params: 'id,total,note' } },
  { label: 'an emptied list', parameters: { params: '' } },
  { label: 'a hole in the list', parameters: { params: 'a,,b' } },
  { label: 'a trailing comma', parameters: { params: 'a,b,' } },
  { label: 'the same name twice', parameters: { params: 'a,a' } },
  { label: 'a name containing a space', parameters: { params: 'order id' } }
];

describe('WFA-009: the library rule and the runtime setup() emit identical ports', () => {
  describe('noodl.cloud.response', () => {
    for (const { label, parameters } of CASES) {
      for (const status of [undefined, 'success', 'failure']) {
        it(`${label}, status=${status}`, () => {
          const params = { ...parameters, ...(status === undefined ? {} : { status }) };
          expect(portsFromLibraryRule(responseNode, params)).toEqual(
            portsFromRuntimeSetup(responseSetup, 'noodl.cloud.response', params)
          );
        });
      }
    }
  });

  describe('noodl.cloud.request', () => {
    for (const { label, parameters } of CASES) {
      it(label, () => {
        expect(portsFromLibraryRule(requestNode, parameters)).toEqual(
          portsFromRuntimeSetup(requestSetup, 'noodl.cloud.request', parameters)
        );
      });
    }
  });
});

describe('WFA-009: what the ports actually are', () => {
  it('a Response parameter name becomes an input port to supply it', () => {
    expect(portsFromLibraryRule(responseNode, { params: 'total' })).toEqual([
      { name: 'pm-total', displayName: 'total', type: '*', plug: 'input', group: 'Parameters' }
    ]);
  });

  it('a Request parameter name becomes an output port to read it', () => {
    expect(portsFromLibraryRule(requestNode, { params: 'total' })).toEqual([
      { name: 'pm-total', displayName: 'total', type: '*', plug: 'output', group: 'Parameters' }
    ]);
  });

  it('a Response answering with a failure offers no parameters to fill in', () => {
    expect(portsFromLibraryRule(responseNode, { params: 'total', status: 'failure' })).toEqual([]);
  });

  it('a Request has no such condition — its parameters are the caller’s, not the answer’s', () => {
    expect(portsFromLibraryRule(requestNode, { params: 'total', status: 'failure' })).toHaveLength(1);
  });

  it('an emptied list mints nothing, rather than a port with a blank name', () => {
    expect(portsFromLibraryRule(responseNode, { params: '' })).toEqual([]);
    expect(portsFromRuntimeSetup(responseSetup, 'noodl.cloud.response', { params: '' })).toEqual([]);
  });
});
