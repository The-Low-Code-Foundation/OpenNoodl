/**
 * AIB-001 criterion 2 — the repair loop fixes the crash, at no cost to the user.
 *
 * Richard's session lost 44 nodes across three components because the model
 * wrote `pathParams` as a JSON array. That was the *correct* reading of what it
 * was told: the catalog types the port `stringlist`, and the comma-separated
 * wire format was written down nowhere it could see. The gate passed the
 * candidate, and `PageInputsAdapter`'s `.split(',')` threw from inside the apply
 * transaction, which rolled the whole plan back.
 *
 * The unit rules live in `tests-unit/aib-001`. What this spec asserts is the
 * property that makes them worth having: the rejection reaches the *model*, in
 * the same conversation, and the model's next submission is accepted — so the
 * failure never becomes a user's problem, let alone an hour of thrown-away
 * output.
 *
 * Fully offline: the chat function is a script.
 */

import { AuthoringSession } from '../../src/editor/src/models/AiAssistant/authoring/AuthoringSession';
import type { AuthoringRequest } from '../../src/editor/src/models/AiAssistant/authoring/types';
import { fromSerialisedProject } from '../../src/editor/src/models/AiAssistant/explain/graph';
import type { AiChatRequest, AiChatResponse, AiToolCall } from '../../src/editor/src/models/AiAssistant/client/types';

/* eslint-disable @typescript-eslint/no-var-requires */
const gitRepoUtf8 = require('../testfs/git-repo-utf8/project.json');
/* eslint-enable @typescript-eslint/no-var-requires */

const GRAPH = fromSerialisedProject(gitRepoUtf8);
const REQUEST: AuthoringRequest = {
  description: 'A page that reads an id and a slug out of its route.',
  componentPath: 'Pages/Article Detail'
};

function respond(partial: Partial<AiChatResponse> = {}): AiChatResponse {
  return {
    text: '',
    toolCalls: [],
    usage: { promptTokens: 10, completionTokens: 5, cacheReadTokens: 0, cacheWriteTokens: 0, costUsd: 0.01 },
    model: 'test',
    stopReason: partial.toolCalls?.length ? 'tool_calls' : 'stop',
    ...partial
  };
}

let callCounter = 0;
function call(name: string, args: Record<string, unknown>): AiToolCall {
  return { id: `call-${++callCounter}`, name, arguments: args };
}

/** A page whose `PageInputs` node declares its route parameters however given. */
function submitArgs(pathParams: unknown): Record<string, unknown> {
  return {
    nodes: [
      { id: 'root', type: 'Group', label: 'Article Detail' },
      { id: 'params', type: 'PageInputs', parameters: { pathParams } }
    ],
    connections: [],
    visual_roots: ['root'],
    description: 'Reads id and slug from the route.'
  };
}

function scriptedChat(script: Array<(request: AiChatRequest) => AiChatResponse>) {
  const requests: AiChatRequest[] = [];
  const chat = async (request: AiChatRequest): Promise<AiChatResponse> => {
    requests.push(request);
    const step = script[requests.length - 1] ?? script[script.length - 1];
    return step(request);
  };
  return { chat, requests };
}

describe('AIB-001 — a bad parameter value is repaired inside the session', () => {
  it('rejects the array, hands the model the wire format, and stages the fix', async () => {
    let feedback = '';
    const { chat } = scriptedChat([
      // Turn 1: the model reads the type it is about to use — as the prompt asks.
      () => respond({ toolCalls: [call('get_node_types', { typeNames: ['PageInputs', 'Group'] })] }),
      // Turn 2: it writes `stringlist` the way the words read — as an array.
      () => respond({ toolCalls: [call('submit_component', submitArgs(['id', 'slug']))] }),
      // Turn 3: the diagnostic named the port and the format. It corrects it.
      (request) => {
        feedback = String(request.messages[request.messages.length - 1].content);
        return respond({ toolCalls: [call('submit_component', submitArgs('id,slug'))] });
      }
    ]);

    const session = AuthoringSession.create(GRAPH, REQUEST, { chat });
    const outcome = await session.run();

    expect(outcome.status).toBe('authored');
    expect(outcome.rounds.map((r) => r.ok)).toEqual([false, true]);

    // What the model was actually told. Each of these is load-bearing: without
    // the port name it cannot find the value, and without the format it can only
    // guess again.
    expect(feedback).toContain('invalid-parameter-value');
    expect(feedback).toContain('pathParams');
    expect(feedback).toContain('comma-separated');
    expect(feedback).toContain('"id,slug"');

    // And the staged candidate carries the value the adapter can consume — the
    // one that used to reach `.split(',')` as an array.
    const pageInputs = outcome.files!.nodes.nodes.find((n) => n.type === 'PageInputs');
    expect(pageInputs!.parameters!.pathParams).toBe('id,slug');
  });

  it('tells the model the wire format up front, so the repair round is not needed', async () => {
    // The other half of the fix (slice 2): `get_node_types` now renders the
    // format, not just the type name. A model that reads the documentation the
    // prompt tells it to read never writes the array in the first place.
    const { chat } = scriptedChat([
      () => respond({ toolCalls: [call('get_node_types', { typeNames: ['PageInputs'] })] }),
      () => respond({ toolCalls: [call('submit_component', submitArgs('id,slug'))] })
    ]);

    const session = AuthoringSession.create(GRAPH, REQUEST, { chat });
    const outcome = await session.run();

    expect(outcome.status).toBe('authored');
    const documentation = outcome.transcript.find((m) => m.role === 'tool' && m.name === 'get_node_types');
    expect(documentation!.content).toContain('COMMA-SEPARATED STRING');
    expect(documentation!.content).toContain('"id,slug"');
    // One submission, no repair round: the whole point of telling it.
    expect(outcome.metrics.submits).toBe(1);
  });
});
