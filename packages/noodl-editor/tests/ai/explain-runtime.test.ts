/**
 * FIX-001 §1a — Explain Mode: the runtime layer.
 *
 * The report this task comes from is one sentence: *"when I said 'why is the output value null?'
 * it wasn't able to detect and explain."* It could not, by construction — the context held the
 * authored graph and an output value is not in the authored graph at all.
 *
 * What is asserted here is therefore not "the answer is good" (no spec can say that without a
 * model) but the two properties that make a good answer possible and a wrong one unlikely:
 *
 *  - The context **contains** the current values, and marks which lines are current and which are
 *    authored. A model cannot name a value it was never shown.
 *  - With nothing running, the context says *so*, in words, rather than simply omitting the
 *    section. An absent section is indistinguishable from "all the values were null", and a model
 *    given that will answer as though it had seen them — the confident wrong answer that is worse
 *    than the original complaint.
 *
 * Offline: the runtime layer is plain data here. The socket that fills it in the real editor is
 * `utils/provenance/explainRuntime`, which is the only part of this that needs a preview.
 */

import { assembleContext } from '../../src/editor/src/models/AiAssistant/explain/assemble';
import { ExplainSession } from '../../src/editor/src/models/AiAssistant/explain/ExplainSession';
import { findComponent, fromSerialisedProject } from '../../src/editor/src/models/AiAssistant/explain/graph';
import { followUpMessage, systemPrompt } from '../../src/editor/src/models/AiAssistant/explain/prompts';
import { renderContext } from '../../src/editor/src/models/AiAssistant/explain/render';
import {
  MAX_RUNTIME_VALUE_CHARS,
  portsToResolve,
  renderRuntime,
  truncateRuntimeValue,
  type RuntimePortRef,
  type RuntimeSnapshot
} from '../../src/editor/src/models/AiAssistant/explain/runtime';
import type { ExplainContext, ExplainGraph, GraphComponent } from '../../src/editor/src/models/AiAssistant/explain/types';
import { enrichedNode } from '../../src/editor/src/validation/enrichedCatalog';

import type { AiChatRequest, AiChatResponse, AiStreamCallbacks } from '../../src/editor/src/models/AiAssistant/client/types';
import { AiClient } from '../../src/editor/src/models/AiAssistant/client/AiClient';

/* eslint-disable @typescript-eslint/no-var-requires */
const gitRepoUtf8 = require('../testfs/git-repo-utf8/project.json');
/* eslint-enable @typescript-eslint/no-var-requires */

const COMPONENT = '/Logic Components/Get Article From Slug';

/**
 * The JavaScript node that builds the query. Chosen because it has all three shapes the port
 * selection has to get right at once: an authored parameter (`functionScript`), dynamic instance
 * ports the catalog cannot enumerate (`in-articleID`, `out-query`, `out-done`), and a catalog
 * signal input on a wire (`run`).
 */
const BUILD_QUERY = '0f5d4c0f-f62c-40b5-f04c-cf4fe10afc33';
/** Fed by BUILD_QUERY's `out-query`; a component instance, so it has no catalog entry. */
const GRAPHQL = '5031604b-2051-1d79-4685-154ac00ea0cc';
/** Not connected to BUILD_QUERY at all — reached only as a two-hop neighbour. */
const COLLECTION = 'd8d35d3b-7846-0b92-8c4a-fedf93f6f981';

const graph: ExplainGraph = fromSerialisedProject(gitRepoUtf8);

function fixture(nodeIds: string[] = [BUILD_QUERY]): { component: GraphComponent; context: ExplainContext } {
  const component = findComponent(graph, COMPONENT);
  if (!component) throw new Error(`fixture component ${COMPONENT} is missing`);
  return { component, context: assembleContext(graph, { scope: 'node', componentName: COMPONENT, nodeIds }) };
}

function has(refs: readonly RuntimePortRef[], node: string, port: string, direction: string): boolean {
  return refs.some((r) => r.node === node && r.port === port && r.direction === direction);
}

/**
 * A running-preview snapshot.
 *
 * `askedNodeIds` defaults to exactly the nodes that answered, which is the
 * *conservative* reading: nothing is accused of being absent unless a spec says
 * it was asked about and stayed silent. See `RuntimeSnapshot.askedNodeIds`.
 */
function running(
  values: RuntimeSnapshot['values'],
  liveNodeIds: string[],
  askedNodeIds: string[] = liveNodeIds
): RuntimeSnapshot {
  return { isPreviewRunning: true, values, liveNodeIds, askedNodeIds, diagnoses: [] };
}

/**
 * The real `[now = …]` suffixes in a rendered context.
 *
 * 🔴 Not `toContain('[now =')`. When any runtime values are present the Nodes header explains the
 * notation, and that explanation *contains the literal token* — so a plain substring assertion is
 * satisfied by the prose and reports a suffix that was never emitted. Both of this file's
 * "no suffix" specs failed on exactly that, against correct code. Matching the whole bracketed
 * form and dropping the header's `…` placeholder is what makes the probe measure the render
 * instead of its own documentation.
 */
function nowSuffixes(rendered: string): string[] {
  return (rendered.match(/\[now = [^\]]*\]/g) ?? []).filter((match) => match !== '[now = …]');
}

describe('FIX-001 ports to resolve', () => {
  it('asks for every output of the selected node, including its dynamic ones', () => {
    const { component, context } = fixture();
    const refs = portsToResolve(component, context);

    // An output carries no authored value, so the runtime is the only place it exists at all.
    // These two are dynamic ports: nothing in the catalog knows they are there.
    expect(has(refs, BUILD_QUERY, 'out-query', 'output')).toBe(true);
    expect(has(refs, BUILD_QUERY, 'out-done', 'output')).toBe(true);
  });

  it('asks about an input that is fed, and an input that was authored', () => {
    const { component, context } = fixture();
    const refs = portsToResolve(component, context);

    expect(has(refs, BUILD_QUERY, 'in-articleID', 'input')).toBe(true);
    expect(has(refs, BUILD_QUERY, 'functionScript', 'input')).toBe(true);
  });

  it('never asks about a port the catalog calls a signal', () => {
    const { component, context } = fixture();
    const refs = portsToResolve(component, context);

    // A signal carries no value — reading one reports the internal sender. Asserted as a property
    // over the whole request rather than against one hand-picked port, so a catalog change cannot
    // quietly turn this into a spec that passes by testing nothing.
    const byId = new Map(component.nodes.map((n) => [n.id, n]));
    let checked = 0;
    for (const ref of refs) {
      const node = enrichedNode(byId.get(ref.node)!.type);
      if (!node) continue;
      const port = (ref.direction === 'output' ? node.outputs : node.inputs)?.find((p) => p.name === ref.port);
      if (!port) continue;
      checked++;
      expect(port.isSignal).toBeFalsy();
    }
    // The `run` input of the selected node is on a wire and is a catalog signal; if the catalog
    // resolved nothing at all the loop above would assert nothing.
    expect(checked).toBeGreaterThan(0);
    expect(has(refs, BUILD_QUERY, 'run', 'input')).toBe(false);
  });

  it('asks only about the wired ports of a node the user did not select', () => {
    const { component, context } = fixture();
    const refs = portsToResolve(component, context);

    // The instance is upstream/downstream of the selection, so its two wired ports are in…
    expect(has(refs, GRAPHQL, 'Query', 'input')).toBe(true);
    expect(has(refs, GRAPHQL, 'queryResult', 'output')).toBe(true);
    // …and a node reached at the edge of the context contributes only what is on a wire *inside*
    // it, never its whole port surface. `collectionId` is authored on this node and is deliberately
    // absent: an authored parameter earns a live reading only on a node the user asked about.
    const collectionRefs = refs.filter((r) => r.node === COLLECTION);
    expect(collectionRefs.length).toBeGreaterThan(0);
    for (const ref of collectionRefs) {
      const onWire = context.connections.some(
        (c) =>
          (c.fromId === ref.node && c.fromProperty === ref.port) || (c.toId === ref.node && c.toProperty === ref.port)
      );
      expect(onWire).toBe(true);
    }
    expect(has(refs, COLLECTION, 'collectionId', 'input')).toBe(false);
  });

  it('puts the selected node first, so a cap cannot cut away the question', () => {
    const { component, context } = fixture();
    const refs = portsToResolve(component, context, { maxPorts: 3 });

    expect(refs.length).toBe(3);
    for (const ref of refs) expect(ref.node).toBe(BUILD_QUERY);
  });

  it('caps one node so a single wide node cannot spend the whole request', () => {
    const { component, context } = fixture();
    const refs = portsToResolve(component, context, { maxPortsPerNode: 2 });

    const perNode = new Map<string, number>();
    for (const ref of refs) perNode.set(ref.node, (perNode.get(ref.node) ?? 0) + 1);
    for (const count of perNode.values()) expect(count).toBeLessThanOrEqual(2);
  });

  it('asks for nothing at all when the selection has no resolvable ports', () => {
    // Component scope selects everything and has no `selectedIds`, so only wired ports qualify —
    // the request stays a request about data flow rather than about every port in the component.
    const component = findComponent(graph, COMPONENT)!;
    const context = assembleContext(graph, { scope: 'component', componentName: COMPONENT });
    const refs = portsToResolve(component, context);
    for (const ref of refs) {
      const onWire = context.connections.some(
        (c) =>
          (c.fromId === ref.node && c.fromProperty === ref.port) || (c.toId === ref.node && c.toProperty === ref.port)
      );
      expect(onWire).toBe(true);
    }
  });
});

describe('FIX-001 rendering the runtime layer', () => {
  it('renders exactly what it did before when there is no snapshot', () => {
    const { context } = fixture();
    const rendered = renderContext(context);

    expect(rendered).not.toContain('## Runtime');
    expect(rendered).not.toContain('[now =');
  });

  it('says a preview is not running, in words, rather than omitting the section', () => {
    // Acceptance criterion 2. An absent section reads to a model as "all values were null".
    const { context } = fixture();
    const rendered = renderContext(context, { isPreviewRunning: false, values: [], liveNodeIds: [], diagnoses: [] });

    expect(rendered).toContain('## Runtime');
    expect(rendered).toContain('No preview is running');
    expect(rendered).toContain('cannot see it');
  });

  it('distinguishes a failed read from a stopped preview', () => {
    const { context } = fixture();
    const rendered = renderContext(context, {
      isPreviewRunning: false,
      values: [],
      liveNodeIds: [],
      diagnoses: [],
      error: 'the preview did not answer in time'
    });

    // Different states, opposite instructions to the user: "start it" versus "it is not answering".
    expect(rendered).toContain('could not');
    expect(rendered).toContain('did not answer in time');
    expect(rendered).not.toContain('No preview is running');
  });

  it('names the current value of an output, which the authored graph never holds', () => {
    // Acceptance criterion 1's precondition: the value the user asked about is in the context.
    const { context } = fixture();
    const rendered = renderContext(
      context,
      running([{ node: BUILD_QUERY, port: 'out-query', direction: 'output', value: 'null' }], [BUILD_QUERY])
    );

    expect(rendered).toContain(`\`${BUILD_QUERY}\`.out-query (output) = null`);
    expect(rendered).toContain('right now');
  });

  it('writes a current input value beside the authored one, not over it', () => {
    const { context } = fixture();
    const node = context.nodes.find((n) => n.id === BUILD_QUERY)!;
    const parameter = node.parameters[0];
    expect(parameter).toBeDefined();

    const rendered = renderContext(
      context,
      running([{ node: BUILD_QUERY, port: parameter.name, direction: 'input', value: 'CHANGED-AT-RUNTIME' }], [
        BUILD_QUERY
      ])
    );

    // Exactly one, so this cannot pass on the header's explanatory token.
    expect(nowSuffixes(rendered)).toEqual(['[now = CHANGED-AT-RUNTIME]']);
    // The authored value is still there. Replacing it would destroy the only line that says what
    // the user actually typed.
    expect(rendered).toContain(parameter.value.split('\n')[0]);
  });

  it('omits the current value when it agrees with the authored one', () => {
    // A `now =` that only ever echoes the line above teaches the model to stop reading it.
    const { context } = fixture();
    const node = context.nodes.find((n) => n.id === BUILD_QUERY)!;
    const parameter = node.parameters[0];

    const rendered = renderContext(
      context,
      running([{ node: BUILD_QUERY, port: parameter.name, direction: 'input', value: parameter.value }], [BUILD_QUERY])
    );

    expect(nowSuffixes(rendered)).toEqual([]);
  });

  it('does not announce a change when both sides were merely cut at different lengths', () => {
    // The two caps differ — assembly allows 400 characters of an authored parameter at node
    // scope, the runtime layer 200 — so an identical script body fails an equality test every
    // time and would print a `[now = …]` for a change that never happened.
    const { context } = fixture();
    const node = context.nodes.find((n) => n.id === BUILD_QUERY)!;
    const parameter = node.parameters[0];
    const shorter = parameter.value.replace(/…$/, '').slice(0, 60) + '…';
    expect(shorter.length).toBeLessThan(parameter.value.length);

    const rendered = renderContext(
      context,
      running([{ node: BUILD_QUERY, port: parameter.name, direction: 'input', value: shorter, truncated: true }], [
        BUILD_QUERY
      ])
    );

    expect(nowSuffixes(rendered)).toEqual([]);
  });

  it('says which nodes are not mounted, which is often the whole answer', () => {
    const { context } = fixture();
    // Both were asked about; only one answered.
    const rendered = renderContext(context, running([], [BUILD_QUERY], [BUILD_QUERY, GRAPHQL]));

    const absentLine = rendered.split('\n').find((l) => l.includes('Not mounted')) ?? '';
    expect(absentLine).toContain(GRAPHQL);
    // The one node that did answer is not accused of being absent.
    expect(absentLine).not.toContain(BUILD_QUERY);
  });

  it('never calls a node absent when the read never asked about it', () => {
    // 🔴 Measured against the running editor, 2026-08-15. `portsToResolve` excludes signals and
    // asks only about the selected node and ports on a wire, so a signal-only neighbour has no
    // port in the request. Deriving absence from `liveNodeIds` alone therefore reported a button
    // that was being clicked — and two nodes whose `completed` had just fired seven times — as
    // "not mounted in the running app right now". The prompt tells the model that is "often the
    // entire answer", so the claim was acted on rather than ignored.
    const { context } = fixture();
    const rendered = renderContext(context, running([], [BUILD_QUERY], [BUILD_QUERY]));

    // GRAPHQL is in the context but was never asked about: unknown, not absent.
    expect(rendered).not.toContain('Not mounted');
  });

  it('makes no absence claim at all when the reader cannot say what it asked', () => {
    const { context } = fixture();
    const snapshot: RuntimeSnapshot = {
      isPreviewRunning: true,
      values: [],
      liveNodeIds: [BUILD_QUERY],
      diagnoses: []
    };

    expect(renderContext(context, snapshot)).not.toContain('Not mounted');
  });

  it('quotes an editor warning with no preview running at all', () => {
    // Acceptance criterion 3. `WarningsModel` is populated on a cold editor, so this is the one
    // part of the runtime layer that needs nothing started.
    const { context } = fixture();
    const rendered = renderContext(context, {
      isPreviewRunning: false,
      values: [],
      liveNodeIds: [],
      diagnoses: [{ nodeId: BUILD_QUERY, message: 'Items expects an array, received a number (42).' }]
    });

    expect(rendered).toContain('Warnings the editor is showing');
    expect(rendered).toContain('Items expects an array');
    expect(rendered).toContain(`\`${BUILD_QUERY}\``);
  });

  it('drops a warning about a node the model cannot see', () => {
    // Otherwise the model cites an id that is nowhere else in the context, and
    // `stripUnresolvedCitations` quietly demotes the citation to plain text.
    const { context } = fixture();
    const rendered = renderContext(context, {
      isPreviewRunning: false,
      values: [],
      liveNodeIds: [],
      diagnoses: [{ nodeId: 'not-in-this-context', message: 'invisible' }]
    });

    expect(rendered).not.toContain('invisible');
    expect(rendered).not.toContain('Warnings the editor is showing');
  });

  it('cuts a long value short and says that it did', () => {
    const long = 'x'.repeat(MAX_RUNTIME_VALUE_CHARS + 50);
    const capped = truncateRuntimeValue(long);
    expect(capped.truncated).toBe(true);
    expect(capped.value.length).toBeLessThan(long.length);

    const { context } = fixture();
    const rendered = renderRuntime(
      context,
      running([{ node: BUILD_QUERY, port: 'out-query', direction: 'output', value: capped.value, truncated: true }], [
        BUILD_QUERY
      ])
    );
    expect(rendered).toContain('(cut short)');
  });
});

describe('FIX-001 prompting', () => {
  it('tells the model that an authored value is not a current value', () => {
    const prompt = systemPrompt();
    expect(prompt).toContain('AUTHORED VALUES ARE NOT CURRENT VALUES');
    expect(prompt).toContain('[now = …]');
    expect(prompt).toContain('never infer one from the other');
  });

  it('leaves a follow-up alone when there is nothing live to report', () => {
    expect(followUpMessage('why?')).not.toContain('CURRENT VALUES');
  });

  it('marks a follow-up reading as replacing the earlier one', () => {
    // Values move. A follow-up answered from the opening turn's numbers is the failure mode that
    // looks exactly like a correct answer.
    const message = followUpMessage('why is it null now?', '## Runtime\n- `n1`.x (output) = 7');
    expect(message).toContain('RE-READ FOR THIS QUESTION');
    expect(message).toContain('replace the runtime values in any earlier message');
    expect(message).toContain('`n1`.x (output) = 7');
  });
});

/** A completed response, so a stub only has to say what the model "wrote". */
function answerWith(text: string): AiChatResponse {
  return {
    text,
    toolCalls: [],
    usage: { promptTokens: 1, completionTokens: 1, cacheReadTokens: 0, cacheWriteTokens: 0, costUsd: 0 },
    model: 'test',
    stopReason: 'stop'
  };
}

describe('FIX-001 session', () => {
  it('reads the running app once per turn, not once per session', async () => {
    const sent: AiChatRequest['messages'][] = [];
    spyOn(AiClient, 'chatStream').and.callFake(async (request: AiChatRequest, callbacks?: AiStreamCallbacks) => {
      sent.push(request.messages);
      const text = 'ok';
      callbacks?.onText?.(text, text);
      return answerWith(text);
    });

    const reads: RuntimePortRef[][] = [];
    const session = ExplainSession.create(
      graph,
      { scope: 'node', componentName: COMPONENT, nodeIds: [BUILD_QUERY] },
      {
        resolveRuntime: async (ports) => {
          reads.push(ports);
          return running(
            [{ node: BUILD_QUERY, port: 'out-query', direction: 'output', value: `read ${reads.length}` }],
            [BUILD_QUERY]
          );
        }
      }
    );

    expect(session.runtimePorts.length).toBeGreaterThan(0);

    await session.explain();
    await session.ask('and now?');

    expect(reads.length).toBe(2);
    expect(reads[0].length).toBe(session.runtimePorts.length);

    // The opening turn carries the whole context with its values folded in; the follow-up carries
    // a fresh reading and says so, rather than repeating the graph.
    const opening = String(sent[1][1].content);
    expect(opening).toContain('--- CONTEXT ---');
    expect(opening).toContain('read 1');

    const follow = String(sent[1][sent[1].length - 1].content);
    expect(follow).toContain('read 2');
    expect(follow).not.toContain('--- CONTEXT ---');
  });

  it('reports a failed read as a failed read, and still answers', async () => {
    const sent: AiChatRequest['messages'][] = [];
    spyOn(AiClient, 'chatStream').and.callFake(async (request: AiChatRequest, callbacks?: AiStreamCallbacks) => {
      sent.push(request.messages);
      callbacks?.onText?.('ok', 'ok');
      return answerWith('ok');
    });

    const session = ExplainSession.create(
      graph,
      { scope: 'node', componentName: COMPONENT, nodeIds: [BUILD_QUERY] },
      {
        resolveRuntime: async () => {
          throw new Error('socket is gone');
        }
      }
    );

    await session.explain();

    // A read that threw must not become "no preview is running": one of those is the user's to
    // fix and the other is not, and the prompt gives opposite instructions for them.
    const opening = String(sent[0][1].content);
    expect(opening).toContain('socket is gone');
    expect(opening).not.toContain('No preview is running');
    expect(session.state.turns.filter((t) => t.error).length).toBe(0);
  });

  it('behaves exactly as before for a caller with no way to reach a preview', async () => {
    const sent: AiChatRequest['messages'][] = [];
    spyOn(AiClient, 'chatStream').and.callFake(async (request: AiChatRequest, callbacks?: AiStreamCallbacks) => {
      sent.push(request.messages);
      callbacks?.onText?.('ok', 'ok');
      return answerWith('ok');
    });

    const session = ExplainSession.create(graph, { scope: 'node', componentName: COMPONENT, nodeIds: [BUILD_QUERY] });
    await session.explain();

    // The MCP assembler and the measurement harness both take this path. No section, and so no
    // instruction about a layer that was never supplied.
    expect(String(sent[0][1].content)).not.toContain('## Runtime');
  });
});
