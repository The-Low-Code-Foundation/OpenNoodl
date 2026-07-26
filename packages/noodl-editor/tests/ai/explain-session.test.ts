/**
 * AIX-004 — Explain Mode: citations, prompts and session behaviour.
 *
 * The read-only guarantee gets its own spec here. It is stated in the panel UI,
 * so it has to be true structurally rather than by convention: a session is
 * handed plain data, and there is no path from it back to a project model.
 *
 * Offline: the one spec that drives a response stubs `AiClient.chatStream`.
 */

import { AiClient } from '../../src/editor/src/models/AiAssistant/client/AiClient';
import {
  AiChatRequest,
  AiChatResponse,
  AiNotConfiguredError,
  AiStreamCallbacks
} from '../../src/editor/src/models/AiAssistant/client/types';
import { assembleContext } from '../../src/editor/src/models/AiAssistant/explain/assemble';
import {
  parseCitations,
  resolveCitations,
  stripUnresolvedCitations
} from '../../src/editor/src/models/AiAssistant/explain/citations';
import { ExplainSession } from '../../src/editor/src/models/AiAssistant/explain/ExplainSession';
import { fromSerialisedProject } from '../../src/editor/src/models/AiAssistant/explain/graph';
import { initialUserMessage, systemPrompt } from '../../src/editor/src/models/AiAssistant/explain/prompts';
import { renderContext } from '../../src/editor/src/models/AiAssistant/explain/render';

/* eslint-disable @typescript-eslint/no-var-requires */
const gitRepoUtf8 = require('../testfs/git-repo-utf8/project.json');
/* eslint-enable @typescript-eslint/no-var-requires */

const COMPONENT = '/Logic Components/Get Article From Slug';
const A_NODE = '5031604b-2051-1d79-4685-154ac00ea0cc';

function makeContext() {
  const graph = fromSerialisedProject(gitRepoUtf8);
  return assembleContext(graph, { scope: 'node', componentName: COMPONENT, nodeIds: [A_NODE] });
}

describe('AIX-004 citations', () => {
  it('parses node citations out of markdown', () => {
    const md = 'The [Contentful GraphQL](noodl-node:abc-123) node runs after [Build Query](noodl-node:def-456).';
    const citations = parseCitations(md);
    expect(citations.length).toBe(2);
    expect(citations[0].nodeId).toBe('abc-123');
    expect(citations[0].text).toBe('Contentful GraphQL');
    expect(citations[1].nodeId).toBe('def-456');
  });

  it('does not treat ordinary markdown links as citations', () => {
    const md = 'See [the docs](https://example.com/noodl-node:not-a-citation).';
    expect(parseCitations(md).length).toBe(0);
  });

  it('parses independently on repeated calls (no shared regex state)', () => {
    const md = 'One [a](noodl-node:x) two [b](noodl-node:y).';
    expect(parseCitations(md).length).toBe(2);
    expect(parseCitations(md).length).toBe(2);
  });

  it('separates citations that resolve against the context from those that do not', () => {
    const context = makeContext();
    const md = `Real: [Instance](noodl-node:${A_NODE}). Invented: [Ghost](noodl-node:does-not-exist).`;
    const { resolved, unresolved } = resolveCitations(md, context);
    expect(resolved.length).toBe(1);
    expect(resolved[0].nodeId).toBe(A_NODE);
    expect(unresolved.length).toBe(1);
  });

  it('degrades an unresolved citation to plain text rather than a dead link', () => {
    const context = makeContext();
    const md = `[Instance](noodl-node:${A_NODE}) and [Ghost](noodl-node:does-not-exist).`;
    const stripped = stripUnresolvedCitations(md, context);
    expect(stripped).toContain(`[Instance](noodl-node:${A_NODE})`);
    expect(stripped).toContain('Ghost');
    expect(stripped).not.toContain('does-not-exist');
  });
});

describe('AIX-004 prompts', () => {
  it('requires citations and names the exact syntax the panel parses', () => {
    const prompt = systemPrompt();
    expect(prompt).toContain('noodl-node:');
    expect(prompt).toContain('CITING NODES');
  });

  it('tells the model not to guess beyond the slice it was given', () => {
    expect(systemPrompt()).toContain('worse than an incomplete one');
  });

  it('frames the scope and embeds the context in the opening turn', () => {
    const context = makeContext();
    const rendered = renderContext(context);
    const message = initialUserMessage(context, rendered);
    expect(message).toContain('Explain the selected node');
    expect(message).toContain('--- CONTEXT ---');
    expect(message).toContain(rendered);
  });

  it('varies only length between detail levels, not audience', () => {
    const context = makeContext();
    const rendered = renderContext(context);
    const brief = initialUserMessage(context, rendered, { detail: 'brief' });
    const deep = initialUserMessage(context, rendered, { detail: 'deep' });
    expect(brief).toContain('two or three sentences');
    expect(deep).toContain('step by step');
    // Same framing, same context — only the length instruction differs.
    expect(brief).toContain('Explain the selected node');
    expect(deep).toContain('Explain the selected node');
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

describe('AIX-004 session', () => {
  it('assembles context at construction, before any provider is touched', () => {
    const session = ExplainSession.create(fromSerialisedProject(gitRepoUtf8), {
      scope: 'node',
      componentName: COMPONENT,
      nodeIds: [A_NODE]
    });

    expect(session.context.selectedIds).toEqual([A_NODE]);
    expect(session.renderedContext.length).toBeGreaterThan(0);
    expect(session.state.turns.length).toBe(0);
    expect(session.state.busy).toBe(false);
  });

  it('surfaces the not-configured error as a failed turn rather than throwing at the panel', async () => {
    // The editor test environment has no AI provider configured, so this is the
    // real "AI is off" path rather than a simulated one.
    expect(AiClient.isConfigured()).toBe(false);

    const session = ExplainSession.create(fromSerialisedProject(gitRepoUtf8), {
      scope: 'node',
      componentName: COMPONENT,
      nodeIds: [A_NODE]
    });

    await session.explain();

    const turns = session.state.turns;
    expect(turns.length).toBe(1);
    expect(turns[0].error).toBe(true);
    expect(turns[0].streaming).toBeFalsy();
    expect(turns[0].text).toContain('Editor Settings');
    expect(session.state.busy).toBe(false);
  });

  it('streams an answer into a turn and keeps follow-ups in the same context', async () => {
    const context = makeContext();
    const answers = [
      `This node calls Contentful. [Instance](noodl-node:${A_NODE}) runs on Do.`,
      'It runs twice because two signals reach it.'
    ];
    let call = 0;

    const sent: AiChatRequest['messages'][] = [];
    spyOn(AiClient, 'chatStream').and.callFake(async (request: AiChatRequest, callbacks?: AiStreamCallbacks) => {
      sent.push(request.messages);
      const text = answers[call++];
      callbacks?.onText?.(text, text);
      return answerWith(text);
    });

    const session = ExplainSession.create(fromSerialisedProject(gitRepoUtf8), {
      scope: 'node',
      componentName: COMPONENT,
      nodeIds: [A_NODE]
    });

    await session.explain();
    await session.ask('Why does this run twice?');

    const turns = session.state.turns;
    expect(turns.map((t) => t.role)).toEqual(['answer', 'question', 'answer']);
    expect(turns[0].text).toContain('noodl-node:');
    expect(turns[1].text).toBe('Why does this run twice?');
    expect(turns[2].text).toBe(answers[1]);
    expect(session.state.busy).toBe(false);

    // The follow-up carries the whole conversation, so the context is not resent.
    const followUpMessages = sent[1];
    expect(followUpMessages[0].role).toBe('system');
    expect(followUpMessages.filter((m) => m.content.includes('--- CONTEXT ---')).length).toBe(1);
    expect(followUpMessages[followUpMessages.length - 1].content).toContain('Why does this run twice?');

    // Sanity: the context that was sent is the one the session assembled.
    expect(sent[0][1].content).toContain(context.nodes[0].id);
  });

  it('strips citations the model invented before the panel ever renders them', async () => {
    spyOn(AiClient, 'chatStream').and.callFake(async (_request: AiChatRequest, callbacks?: AiStreamCallbacks) => {
      const text = `Good [X](noodl-node:${A_NODE}), bad [Y](noodl-node:invented-id).`;
      callbacks?.onText?.(text, text);
      return answerWith(text);
    });

    const session = ExplainSession.create(fromSerialisedProject(gitRepoUtf8), {
      scope: 'node',
      componentName: COMPONENT,
      nodeIds: [A_NODE]
    });
    await session.explain();

    const answer = session.state.turns[0].text;
    expect(answer).toContain(`noodl-node:${A_NODE}`);
    expect(answer).not.toContain('invented-id');
    expect(answer).toContain('bad Y');
  });

  it('notifies listeners as the answer streams', async () => {
    spyOn(AiClient, 'chatStream').and.callFake(async (_request: AiChatRequest, callbacks?: AiStreamCallbacks) => {
      callbacks?.onText?.('partial', 'partial');
      callbacks?.onText?.('partial answer', ' answer');
      return answerWith('partial answer');
    });

    const session = ExplainSession.create(fromSerialisedProject(gitRepoUtf8), {
      scope: 'node',
      componentName: COMPONENT,
      nodeIds: [A_NODE]
    });

    const seen: string[] = [];
    session.onChange((state) => {
      const last = state.turns[state.turns.length - 1];
      if (last?.role === 'answer') seen.push(last.text);
    });

    await session.explain();

    expect(seen).toContain('partial');
    expect(seen[seen.length - 1]).toBe('partial answer');
  });
});

describe('AIX-004 read-only guarantee', () => {
  it('is structural: a session holds plain data, not project models', () => {
    const graph = fromSerialisedProject(gitRepoUtf8);
    const session = ExplainSession.create(graph, {
      scope: 'component',
      componentName: COMPONENT
    });

    // Everything reachable from the assembled context is a plain object or a
    // primitive. A model class would bring `set`/`notifyListeners` with it, and
    // with them a route to mutating the user's project.
    const seenObjects = new Set<unknown>();
    const check = (value: unknown, path: string) => {
      if (value === null || typeof value !== 'object') return;
      if (seenObjects.has(value)) return;
      seenObjects.add(value);

      const proto = Object.getPrototypeOf(value);
      const isPlain = proto === Object.prototype || proto === Array.prototype || proto === null;
      if (!isPlain) {
        fail(`context value at ${path} is a class instance (${proto?.constructor?.name}), not plain data`);
        return;
      }
      for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
        check(child, `${path}.${key}`);
      }
    };

    check(session.context, 'context');
    expect(seenObjects.size).toBeGreaterThan(0);
  });

  it('exposes no method that could write to a project', () => {
    const session = ExplainSession.create(fromSerialisedProject(gitRepoUtf8), {
      scope: 'component',
      componentName: COMPONENT
    });

    const methods = Object.getOwnPropertyNames(Object.getPrototypeOf(session)).filter(
      (name) => name !== 'constructor'
    );
    // If a later change adds a write path, this list changes and the spec fails,
    // which is the point — the guarantee is stated to the user in the panel.
    expect(methods.sort()).toEqual(['ask', 'cancel', 'dispose', 'explain', 'onChange', 'publish', 'run', 'state']);
  });

  it('reports a not-configured provider rather than pretending AI is available', async () => {
    const caught = await AiClient.getProvider().catch((e: unknown) => e);
    expect(caught instanceof AiNotConfiguredError).toBe(true);
  });
});
