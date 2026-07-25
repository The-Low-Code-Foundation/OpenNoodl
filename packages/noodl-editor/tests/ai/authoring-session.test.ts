/**
 * AIX-002 — session loop: author → validate → repair, bounded and measured.
 *
 * Fully offline: the chat function is a script. What is under test is the loop
 * itself — diagnostics feed back and drive a repair, budgets end the loop, and
 * the context accounting proves the agent never received the whole project.
 */

import {
  AuthoringSession,
  AuthoringSetupError,
  AuthoringStateError,
  type AuthoringChatFn,
  type AuthoringSessionState
} from '../../src/editor/src/models/AiAssistant/authoring/AuthoringSession';
import type { AuthoringRequest } from '../../src/editor/src/models/AiAssistant/authoring/types';
import { fromSerialisedProject } from '../../src/editor/src/models/AiAssistant/explain/graph';
import type { AiChatRequest, AiChatResponse, AiToolCall } from '../../src/editor/src/models/AiAssistant/client/types';

/* eslint-disable @typescript-eslint/no-var-requires */
const gitRepoUtf8 = require('../testfs/git-repo-utf8/project.json');
/* eslint-enable @typescript-eslint/no-var-requires */

const GRAPH = fromSerialisedProject(gitRepoUtf8);
const REQUEST: AuthoringRequest = {
  description: 'A page with a trigger input and a done output.',
  componentPath: 'Pages/Authored'
};

function respond(partial: Partial<AiChatResponse> = {}): AiChatResponse {
  return {
    text: '',
    toolCalls: [],
    usage: { promptTokens: 10, completionTokens: 5, costUsd: 0.01 },
    model: 'test',
    stopReason: partial.toolCalls?.length ? 'tool_calls' : 'stop',
    ...partial
  };
}

function call(name: string, args: Record<string, unknown>, id = `call-${Math.random().toString(36).slice(2, 8)}`): AiToolCall {
  return { id, name, arguments: args };
}

/** The submit arguments for a component that validates cleanly. */
function goodSubmitArgs(extraNodes: Record<string, unknown>[] = []): Record<string, unknown> {
  return {
    nodes: [
      { id: 'in', type: 'Component Inputs', ports: [{ name: 'Trigger', plug: 'output', type: '*' }] },
      { id: 'out', type: 'Component Outputs', ports: [{ name: 'Done', plug: 'input', type: '*' }] },
      ...extraNodes
    ],
    connections: [{ fromId: 'in', fromProperty: 'Trigger', toId: 'out', toProperty: 'Done' }],
    description: 'Trigger in, done out.'
  };
}

/** A chat function that plays a fixed script, one response per turn. */
function scriptedChat(script: Array<(request: AiChatRequest) => AiChatResponse>) {
  const requests: AiChatRequest[] = [];
  const chat = async (request: AiChatRequest): Promise<AiChatResponse> => {
    requests.push(request);
    const step = script[requests.length - 1] ?? script[script.length - 1];
    return step(request);
  };
  return { chat, requests };
}

describe('AIX-002 authoring session', () => {
  it('refuses at creation what could never succeed', () => {
    expect(() => AuthoringSession.create(GRAPH, { ...REQUEST, componentPath: 'Pages/Article' })).toThrowError(
      AuthoringSetupError
    );
    expect(() => AuthoringSession.create(GRAPH, { ...REQUEST, description: '  ' })).toThrowError(AuthoringSetupError);
  });

  it('runs author → validate → repair: diagnostics drive a fix, the fixed submit is staged', async () => {
    const { chat, requests } = scriptedChat([
      // Turn 1: the agent reads the types it plans to use.
      () => respond({ toolCalls: [call('get_node_types', { typeNames: ['Group', 'Component Inputs'] })] }),
      // Turn 2: submits with a typo'd type.
      () => respond({ toolCalls: [call('submit_component', goodSubmitArgs([{ id: 'g', type: 'Grouo' }]))] }),
      // Turn 3: the diagnostic named the fix; the agent repairs and resubmits.
      (request) => {
        const feedback = request.messages[request.messages.length - 1];
        expect(feedback.role).toBe('tool');
        expect(feedback.content).toContain('unknown-node-type');
        expect(feedback.content).toContain('did you mean `Group`');
        return respond({ toolCalls: [call('submit_component', goodSubmitArgs([{ id: 'g', type: 'Group' }]))] });
      }
    ]);

    const session = AuthoringSession.create(GRAPH, REQUEST, { chat });
    const outcome = await session.run();

    expect(outcome.status).toBe('authored');
    expect(outcome.legacyName).toBe('/Pages/Authored');
    expect(outcome.files).toBeDefined();
    expect(outcome.files!.nodes.nodes.some((n) => n.type === 'Group')).toBe(true);
    expect(outcome.rounds.map((r) => r.ok)).toEqual([false, true]);
    expect(outcome.rounds[0].errorLines.length).toBeGreaterThan(0);
    expect(outcome.metrics.turns).toBe(3);
    expect(outcome.metrics.submits).toBe(2);
    expect(outcome.metrics.promptTokens).toBe(30);
    expect(outcome.metrics.costUsd).toBeCloseTo(0.03, 5);

    // The model was offered the tools on every turn.
    for (const request of requests) {
      expect(request.tools?.map((t) => t.name)).toContain('submit_component');
    }

    // The type documentation the agent fetched came back as a tool result.
    const typesResult = outcome.transcript.find((m) => m.role === 'tool' && m.name === 'get_node_types');
    expect(typesResult).toBeDefined();
    expect(typesResult!.content).toContain('### Group');
  });

  it('never hands out the whole project, and the accounting proves it', async () => {
    const { chat } = scriptedChat([
      () =>
        respond({
          toolCalls: [call('get_component', { name: '/App' }), call('get_component', { name: '/Pages/Article' })]
        }),
      () => respond({ toolCalls: [call('submit_component', goodSubmitArgs())] })
    ]);

    const session = AuthoringSession.create(GRAPH, REQUEST, { chat, budget: { maxComponentReads: 1 } });
    const outcome = await session.run();
    expect(outcome.status).toBe('authored');

    const log = outcome.metrics.contextLog;
    const served = log.filter((e) => e.source.startsWith('component:') && !e.refused);
    const refused = log.filter((e) => e.source.startsWith('component:') && e.refused);
    expect(served.length).toBe(1);
    expect(refused.length).toBe(1);
    // The bound that matters: far fewer full components than the project holds.
    expect(served.length).toBeLessThan(GRAPH.components.length);
    expect(outcome.metrics.totalContextChars).toBeLessThanOrEqual(session.context.budget.maxChars);
    expect(outcome.metrics.totalContextChars).toBeGreaterThan(0);

    // The refused read told the agent, not just the log.
    const refusal = outcome.transcript.find((m) => m.role === 'tool' && m.content.includes('component read limit'));
    expect(refusal).toBeDefined();
  });

  it('refuses handouts once the character budget is spent', async () => {
    const { chat } = scriptedChat([
      () => respond({ toolCalls: [call('get_node_types', { typeNames: ['Group', 'Text', 'Image', 'Button'] })] }),
      () => respond({ toolCalls: [call('submit_component', goodSubmitArgs())] })
    ]);

    const session = AuthoringSession.create(GRAPH, REQUEST, { chat, budget: { maxChars: 100 } });
    const outcome = await session.run();

    expect(outcome.metrics.totalContextChars).toBeLessThanOrEqual(100);
    expect(outcome.metrics.contextLog.some((e) => e.refused)).toBe(true);
    const refusal = outcome.transcript.find((m) => m.role === 'tool' && m.content.includes('context budget exhausted'));
    expect(refusal).toBeDefined();
  });

  it('ends exhausted when the submission budget runs out, keeping every round', async () => {
    const badArgs = goodSubmitArgs([{ id: 'g', type: 'Grouo' }]);
    const { chat } = scriptedChat([() => respond({ toolCalls: [call('submit_component', badArgs)] })]);

    const session = AuthoringSession.create(GRAPH, REQUEST, { chat, maxSubmits: 2 });
    const outcome = await session.run();

    expect(outcome.status).toBe('exhausted');
    expect(outcome.files).toBeUndefined();
    expect(outcome.rounds.length).toBe(2);
    expect(outcome.rounds.every((r) => !r.ok)).toBe(true);
  });

  it('nudges a talking model once, then gives up', async () => {
    const { chat, requests } = scriptedChat([
      () => respond({ text: 'I would build a lovely page with a Group and…' }),
      () => respond({ text: 'As I was saying…' })
    ]);

    const session = AuthoringSession.create(GRAPH, REQUEST, { chat });
    const outcome = await session.run();

    expect(outcome.status).toBe('exhausted');
    expect(requests.length).toBe(2);
    expect(outcome.transcript.some((m) => m.role === 'user' && m.content.includes('Do not describe'))).toBe(true);
  });

  it('surfaces provider failure as an error outcome, not a throw', async () => {
    const chat = async (): Promise<AiChatResponse> => {
      throw new Error('provider unreachable');
    };
    const outcome = await AuthoringSession.create(GRAPH, REQUEST, { chat }).run();
    expect(outcome.status).toBe('error');
    expect(outcome.error).toContain('provider unreachable');
  });

  it('refine continues the conversation and stages a revised full candidate', async () => {
    const { chat, requests } = scriptedChat([
      // Round 1: a clean submission.
      () => respond({ toolCalls: [call('submit_component', goodSubmitArgs())] }),
      // Round 2 opens with the user's feedback; the agent resubmits in full.
      (request) => {
        const feedback = request.messages[request.messages.length - 1];
        expect(feedback.role).toBe('user');
        expect(feedback.content).toContain('Add a Group container');
        expect(feedback.content).toContain('resubmit the FULL component');
        return respond({ toolCalls: [call('submit_component', goodSubmitArgs([{ id: 'g', type: 'Group' }]))] });
      }
    ]);

    const session = AuthoringSession.create(GRAPH, REQUEST, { chat });
    const first = await session.run();
    expect(first.status).toBe('authored');
    expect(first.files!.nodes.nodes.some((n) => n.type === 'Group')).toBe(false);

    const second = await session.refine('Add a Group container around everything.');
    expect(second.status).toBe('authored');
    expect(second.files!.nodes.nodes.some((n) => n.type === 'Group')).toBe(true);
    expect(session.stagedFiles).toBe(second.files);

    // Metrics and rounds are cumulative; the transcript is one conversation.
    expect(second.metrics.turns).toBe(2);
    expect(second.rounds.map((r) => r.ok)).toEqual([true, true]);
    expect(second.transcript.filter((m) => m.role === 'system').length).toBe(1);
    expect(requests.length).toBe(2);
  });

  it('an exhausted refinement round keeps the last good candidate staged', async () => {
    const { chat } = scriptedChat([
      () => respond({ toolCalls: [call('submit_component', goodSubmitArgs())] }),
      // Every refinement attempt submits a typo'd type, forever.
      () => respond({ toolCalls: [call('submit_component', goodSubmitArgs([{ id: 'g', type: 'Grouo' }]))] })
    ]);

    const session = AuthoringSession.create(GRAPH, REQUEST, { chat, maxSubmits: 2 });
    const first = await session.run();
    expect(first.status).toBe('authored');

    const second = await session.refine('Add a group.');
    expect(second.status).toBe('exhausted');
    expect(second.files).toBeUndefined();
    // The refinement failed, but the accepted-on-run candidate is still there to accept.
    expect(session.stagedFiles).toBe(first.files);
    expect(second.rounds.map((r) => r.ok)).toEqual([true, false, false]);

    // The published state agrees: the round is exhausted, the candidate survives.
    expect(session.state.phase).toBe('exhausted');
    expect(session.state.staged).toBeDefined();
  });

  it('refuses run/refine called out of order', async () => {
    const { chat } = scriptedChat([() => respond({ toolCalls: [call('submit_component', goodSubmitArgs())] })]);
    const session = AuthoringSession.create(GRAPH, REQUEST, { chat });

    await expectAsync(session.refine('too early')).toBeRejectedWithError(AuthoringStateError);
    await session.run();
    await expectAsync(session.run()).toBeRejectedWithError(AuthoringStateError);
    await expectAsync(session.refine('   ')).toBeRejectedWithError(AuthoringStateError);
  });

  describe('published state (the panel contract)', () => {
    /** Deep-copy each published state: activity objects mutate while streaming. */
    function record(session: AuthoringSession): AuthoringSessionState[] {
      const seen: AuthoringSessionState[] = [];
      session.onChange((state) => seen.push(JSON.parse(JSON.stringify(state))));
      return seen;
    }

    it('publishes the feed: request, prose, reads, rejected and accepted submissions', async () => {
      const { chat } = scriptedChat([
        () =>
          respond({
            text: 'Let me check the node docs first.',
            toolCalls: [call('get_node_types', { typeNames: ['Group'] })]
          }),
        () => respond({ toolCalls: [call('submit_component', goodSubmitArgs([{ id: 'g', type: 'Grouo' }]))] }),
        () => respond({ toolCalls: [call('submit_component', goodSubmitArgs([{ id: 'g', type: 'Group' }]))] })
      ]);

      const session = AuthoringSession.create(GRAPH, REQUEST, { chat });
      const seen = record(session);
      await session.run();

      const state = session.state;
      expect(state.busy).toBe(false);
      expect(state.phase).toBe('staged');
      expect(state.legacyName).toBe('/Pages/Authored');
      expect(state.staged).toEqual({ nodeCount: 3, connectionCount: 1 });

      // Empty assistant bubbles are dropped; everything else is in order.
      expect(state.activities.map((a) => a.kind)).toEqual(['user', 'assistant', 'tool', 'submit', 'submit']);
      expect(state.activities[0]).toEqual({ kind: 'user', text: REQUEST.description });
      expect(state.activities[2]).toEqual({ kind: 'tool', label: 'Read node documentation: Group' });
      expect(state.activities[3]).toEqual(jasmine.objectContaining({ kind: 'submit', ok: false }));
      expect((state.activities[3] as { errorLines: string[] }).errorLines.length).toBeGreaterThan(0);
      expect(state.activities[4]).toEqual(jasmine.objectContaining({ kind: 'submit', ok: true, errorLines: [] }));

      // The session was busy while working, and published along the way.
      expect(seen.some((s) => s.busy && s.phase === 'working')).toBe(true);
      expect(seen[seen.length - 1].phase).toBe('staged');
    });

    it('streams assistant prose into the feed as it arrives', async () => {
      const chat: AuthoringChatFn = async (_request, callbacks) => {
        callbacks?.onText?.('Building', 'Building');
        callbacks?.onText?.('Building a page', ' a page');
        return respond({ text: 'Building a page', toolCalls: [call('submit_component', goodSubmitArgs())] });
      };

      const session = AuthoringSession.create(GRAPH, REQUEST, { chat });
      const seen = record(session);
      await session.run();

      const partial = seen.find((s) =>
        s.activities.some((a) => a.kind === 'assistant' && a.streaming && a.text === 'Building')
      );
      expect(partial).toBeDefined();

      const finalProse = session.state.activities.find((a) => a.kind === 'assistant');
      expect(finalProse).toEqual(
        jasmine.objectContaining({ kind: 'assistant', text: 'Building a page', streaming: false })
      );
    });

    it('cancel aborts the round and publishes a cancelled phase, keeping any staged candidate', async () => {
      let turn = 0;
      const chat: AuthoringChatFn = (request) => {
        turn++;
        if (turn === 1) {
          return Promise.resolve(respond({ toolCalls: [call('submit_component', goodSubmitArgs())] }));
        }
        return new Promise((_, reject) => {
          request.abortController!.signal.addEventListener('abort', () => reject(new Error('aborted')));
        });
      };

      const session = AuthoringSession.create(GRAPH, REQUEST, { chat });
      const first = await session.run();
      expect(first.status).toBe('authored');

      const refining = session.refine('Add a search field.');
      session.cancel();
      const outcome = await refining;

      expect(outcome.status).toBe('cancelled');
      expect(session.state.phase).toBe('cancelled');
      expect(session.state.busy).toBe(false);
      // The candidate staged before the cancelled refinement is untouched.
      expect(session.stagedFiles).toBe(first.files);
      expect(session.state.staged).toBeDefined();
    });

    it('publishes the forming graph as submit_component arguments stream', async () => {
      const args = goodSubmitArgs();
      const json = JSON.stringify(args);
      // Three fragments: mid first node, after first node, complete.
      const cuts = [json.indexOf('"out"') - 5, json.indexOf('"connections"'), json.length];

      const chat: AuthoringChatFn = async (_request, callbacks) => {
        for (const cut of cuts) {
          callbacks?.onToolCallPartial?.({ index: 0, name: 'submit_component', argsText: json.slice(0, cut) });
        }
        return respond({ toolCalls: [call('submit_component', args)] });
      };

      const session = AuthoringSession.create(GRAPH, REQUEST, { chat });
      const seen = record(session);
      const outcome = await session.run();
      expect(outcome.status).toBe('authored');

      // The graph formed incrementally: one node, then two, before completion.
      const nodeCounts = seen
        .filter((s) => s.building && !s.building.complete)
        .map((s) => s.building!.nodes.length);
      expect(nodeCounts).toContain(1);
      expect(nodeCounts).toContain(2);

      // And the final published picture is the authoritative complete payload.
      const finalBuilding = session.state.building!;
      expect(finalBuilding.complete).toBe(true);
      expect(finalBuilding.submission).toBe(1);
      expect(finalBuilding.nodes.map((n) => n.id)).toEqual(['in', 'out']);
      expect(finalBuilding.connections.length).toBe(1);
    });

    it('publishes a complete building picture even when the provider never streams partials', async () => {
      const { chat } = scriptedChat([() => respond({ toolCalls: [call('submit_component', goodSubmitArgs())] })]);
      const session = AuthoringSession.create(GRAPH, REQUEST, { chat });
      await session.run();

      const building = session.state.building!;
      expect(building).toBeDefined();
      expect(building.complete).toBe(true);
      expect(building.submission).toBe(1);
      expect(building.nodes.length).toBe(2);
    });

    it('a repair round is a new submission — the preview rebuilds instead of morphing', async () => {
      const badArgs = goodSubmitArgs([{ id: 'g', type: 'Grouo' }]);
      const goodArgs = goodSubmitArgs([{ id: 'g', type: 'Group' }]);
      let turn = 0;
      const chat: AuthoringChatFn = async (_request, callbacks) => {
        turn++;
        const args = turn === 1 ? badArgs : goodArgs;
        const json = JSON.stringify(args);
        callbacks?.onToolCallPartial?.({ index: 0, name: 'submit_component', argsText: json.slice(0, 40) });
        callbacks?.onToolCallPartial?.({ index: 0, name: 'submit_component', argsText: json });
        return respond({ toolCalls: [call('submit_component', args)] });
      };

      const session = AuthoringSession.create(GRAPH, REQUEST, { chat });
      const seen = record(session);
      const outcome = await session.run();

      expect(outcome.status).toBe('authored');
      const submissions = new Set(seen.filter((s) => s.building).map((s) => s.building!.submission));
      expect(submissions.has(1)).toBe(true);
      expect(submissions.has(2)).toBe(true);
      expect(session.state.building!.submission).toBe(2);
      expect(session.state.building!.complete).toBe(true);
    });
  });

  it('reports unknown cost as null, never as zero', async () => {
    const { chat } = scriptedChat([
      () =>
        respond({
          toolCalls: [call('submit_component', goodSubmitArgs())],
          usage: { promptTokens: 10, completionTokens: 5, costUsd: null }
        })
    ]);
    const outcome = await AuthoringSession.create(GRAPH, REQUEST, { chat }).run();
    expect(outcome.status).toBe('authored');
    expect(outcome.metrics.costUsd).toBeNull();
  });
});
