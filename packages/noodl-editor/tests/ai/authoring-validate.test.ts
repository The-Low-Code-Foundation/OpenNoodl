/**
 * AIX-002 — validation gate: the same policy as the MCP write-gate, over the
 * explain-side graph. Runs against the real-project corpus: the candidate is
 * validated *in the context of* the project it would join, so component
 * references resolve and cross-component mistakes surface.
 */

import { buildCandidate } from '../../src/editor/src/models/AiAssistant/authoring/candidate';
import { validateCandidateComponent } from '../../src/editor/src/models/AiAssistant/authoring/validate';
import type { AuthoringRequest, SubmitPayload } from '../../src/editor/src/models/AiAssistant/authoring/types';
import { fromSerialisedProject } from '../../src/editor/src/models/AiAssistant/explain/graph';

/* eslint-disable @typescript-eslint/no-var-requires */
const gitRepoUtf8 = require('../testfs/git-repo-utf8/project.json');
/* eslint-enable @typescript-eslint/no-var-requires */

const GRAPH = fromSerialisedProject(gitRepoUtf8);
const REQUEST: AuthoringRequest = { description: 'test', componentPath: 'Pages/Authored' };
const LEGACY = '/Pages/Authored';

function validate(payload: SubmitPayload) {
  const candidate = buildCandidate(REQUEST, payload);
  expect(candidate.errors).toEqual([]);
  return validateCandidateComponent(GRAPH, LEGACY, candidate.files!);
}

/** A minimal component with a real interface, using only dynamic-port nodes. */
function validPayload(): SubmitPayload {
  return {
    nodes: [
      {
        id: 'in',
        type: 'Component Inputs',
        ports: [{ name: 'Trigger', plug: 'output', type: '*' }]
      },
      {
        id: 'out',
        type: 'Component Outputs',
        ports: [{ name: 'Done', plug: 'input', type: '*' }]
      }
    ],
    connections: [{ fromId: 'in', fromProperty: 'Trigger', toId: 'out', toProperty: 'Done' }]
  };
}

describe('AIX-002 validation gate', () => {
  it('passes a well-formed component in strict mode', () => {
    const result = validate(validPayload());
    expect(result.structural).toBeUndefined();
    expect(result.errors).toEqual([]);
    expect(result.ok).toBe(true);
  });

  it('rejects a typo’d node type with a suggestion (strict mode)', () => {
    const payload = validPayload();
    payload.nodes.push({ id: 'g', type: 'Grouo' });
    const result = validate(payload);
    expect(result.ok).toBe(false);
    const unknown = result.errors.find((d) => d.code === 'unknown-node-type');
    expect(unknown).toBeDefined();
    expect(unknown!.suggestion).toBe('Group');
  });

  it('rejects a connection to a node that does not exist', () => {
    const payload = validPayload();
    payload.connections!.push({ fromId: 'in', fromProperty: 'Trigger', toId: 'ghost', toProperty: 'Do' });
    const result = validate(payload);
    expect(result.ok).toBe(false);
    expect(result.errors.some((d) => d.code === 'dangling-connection')).toBe(true);
  });

  it('resolves instantiations of existing project components, and rejects invented ones', () => {
    const okPayload = validPayload();
    okPayload.nodes.push({ id: 'pill', type: '/Visual Components/Pills/Pill' });
    expect(validate(okPayload).ok).toBe(true);

    const badPayload = validPayload();
    badPayload.nodes.push({ id: 'nope', type: '/Visual Components/Does Not Exist' });
    const result = validate(badPayload);
    expect(result.ok).toBe(false);
    expect(result.errors.some((d) => d.code === 'unresolved-component-ref')).toBe(true);
  });

  it('fails structurally — and skips semantic — when a file violates its schema', () => {
    const candidate = buildCandidate(REQUEST, validPayload());
    const files = candidate.files!;
    // A connection missing its endpoints is a schema violation, not a semantic one.
    (files.connections.connections as unknown[]).push({ fromId: 'in' });
    const result = validateCandidateComponent(GRAPH, LEGACY, files);
    expect(result.ok).toBe(false);
    expect(result.structural?.length).toBeGreaterThan(0);
    expect(result.structural![0].file).toBe('connections.json');
    expect(result.diagnostics).toEqual([]);
  });

  it('does not mutate the graph it validates against', () => {
    const before = GRAPH.components.length;
    validate(validPayload());
    expect(GRAPH.components.length).toBe(before);
    expect(GRAPH.components.some((c) => c.name === LEGACY)).toBe(false);
  });
});
