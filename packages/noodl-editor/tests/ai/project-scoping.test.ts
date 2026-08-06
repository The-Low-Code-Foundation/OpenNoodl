/**
 * AIX-012 — the scoping conversation and everything it produces.
 *
 * Everything here is offline: the chat function is a script, and the document
 * writes go to a real temp directory through AIX-009's model (the same
 * discipline as `plan-doc-writer.test.ts` — bytes on disk are the only proof
 * that a write path works).
 *
 * What is under test is the structure the spec demands rather than the prose
 * quality it hopes for, because prose quality needs a live provider:
 *
 *  - the conversation cannot build (its tool schema has no field that can carry
 *    a graph, and an authoring tool call is refused as unknown);
 *  - it is exitable at any point, with whatever was agreed and never nothing;
 *  - the plan is a function of the agreed pages, so it cannot contain a page
 *    nobody agreed to, and it survives `validatePlan` against a real project;
 *  - anything not agreed is rendered as `> TODO:`, never as a confident
 *    sentence;
 *  - what was considered and rejected reaches the scoping record;
 *  - CONVENTIONS.md written at creation is what the authoring loop's context
 *    builder hands the model — criterion 5's mechanical half.
 */

import fs from 'fs';
import os from 'os';
import path from 'path';

import { AuthoringContextBuilder } from '../../src/editor/src/models/AiAssistant/authoring/ContextBuilder';
import { validatePlan } from '../../src/editor/src/models/AiAssistant/authoring/plan';
import { fromSerialisedProject } from '../../src/editor/src/models/AiAssistant/explain/graph';
import {
  RECORD_SCOPE,
  SCOPE_RECORDED,
  SCOPE_RECORDED_ANSWER_NEEDED,
  SCOPE_RECORDED_REPLY,
  SCOPING_TOOLS,
  scopingSystemPrompt
} from '../../src/editor/src/models/AiAssistant/scoping/prompts';
import { ScopingSession } from '../../src/editor/src/models/AiAssistant/scoping/ScopingSession';
import {
  DOC_INITIAL_SCOPE,
  emptyScope,
  mergeScope,
  pageComponentPath,
  planFromScope,
  renderArchitecture,
  renderBrief,
  renderConventions,
  renderScopeRecord,
  scopeDocuments,
  scopeHasContent,
  scopeOutline,
  TODO_MARKER,
  type ProjectScope
} from '../../src/editor/src/models/AiAssistant/scoping/scope';
import { writeScopeDocs } from '../../src/editor/src/models/AiAssistant/scoping/scopeDocs';
import {
  peekPendingScopePlan,
  setPendingScopePlan,
  takePendingScopePlan
} from '../../src/editor/src/models/AiAssistant/scoping/pendingPlan';
import { ProjectDocsModel } from '../../src/editor/src/models/ProjectDocs/ProjectDocsModel';
import type {
  AiChatRequest,
  AiChatResponse,
  AiStreamCallbacks
} from '../../src/editor/src/models/AiAssistant/client/types';

/* eslint-disable @typescript-eslint/no-var-requires */
const gitRepoUtf8 = require('../testfs/git-repo-utf8/project.json');
/* eslint-enable @typescript-eslint/no-var-requires */

const usage = { promptTokens: 10, completionTokens: 5, cacheReadTokens: 0, cacheWriteTokens: 0, costUsd: 0.001 };

function prose(text: string): AiChatResponse {
  return { text, toolCalls: [], usage, model: 'test', stopReason: 'stop' };
}

function toolThen(name: string, args: Record<string, unknown>, text = ''): AiChatResponse {
  return {
    text,
    toolCalls: [{ id: `call-${Math.random().toString(36).slice(2, 8)}`, name, arguments: args }],
    usage,
    model: 'test',
    stopReason: 'tool_calls'
  };
}

/** Replays a queued script; records every request it was handed. */
function scriptedChat(responses: AiChatResponse[]) {
  const requests: AiChatRequest[] = [];
  const queue = [...responses];
  const chat = async (request: AiChatRequest): Promise<AiChatResponse> => {
    requests.push(request);
    const next = queue.shift();
    if (!next) throw new Error('The scoping script ran out of responses.');
    return next;
  };
  return { chat, requests };
}

/**
 * AAQ-004. The same script, delivered the way a provider delivers it: word by
 * word through `onText`, accumulating **within a round** — which is the whole
 * point, because a turn can be several rounds and the round-local view is what
 * used to drop the user's long answer.
 *
 * What the specs observe is the `onText` handed to `send`, never this one: the
 * session wraps the callbacks, and the wrapping is the thing under test.
 */
function streamingScriptedChat(responses: AiChatResponse[]) {
  const requests: AiChatRequest[] = [];
  const queue = [...responses];
  const chat = async (request: AiChatRequest, callbacks?: AiStreamCallbacks): Promise<AiChatResponse> => {
    requests.push(request);
    const next = queue.shift();
    if (!next) throw new Error('The scoping script ran out of responses.');
    let accumulated = '';
    for (const word of (next.text ?? '').split(' ').filter(Boolean)) {
      const delta = accumulated ? ` ${word}` : word;
      accumulated += delta;
      callbacks?.onText?.(accumulated, delta);
    }
    return next;
  };
  return { chat, requests };
}

/** The tool results a round was handed, in order. */
function toolResults(request: AiChatRequest): string[] {
  return request.messages.filter((m) => m.role === 'tool').map((m) => String(m.content));
}

const READING_LIST = {
  summary: 'A private reading list: add books, see what you are part-way through, mark them finished.',
  audience: 'One person keeping track of their own reading. No sharing, no accounts.',
  objects: [
    {
      name: 'Book',
      purpose: 'One book someone intends to read, is reading, or has finished.',
      fields: ['title (text)', 'author (text)', 'finished (yes/no)'],
      relationships: ['stands alone — no shelves in this version']
    }
  ],
  pages: [
    { name: 'Library', purpose: 'The list of every book, and where a book is marked finished.' },
    { name: 'Add a book', purpose: 'The only place a Book record is created.' }
  ],
  outOfScope: ['Sharing lists with other people', 'Ratings and reviews'],
  backend: 'The local NodeGX backend, one Book collection.',
  conventions: ['Every list page shows an explicit empty state.'],
  rejected: [
    { option: 'A separate Shelves page', reason: 'One list is enough for a first version; shelves can come later.' },
    { option: 'Importing from Goodreads', reason: 'Needs an account and an API key before anything is usable.' }
  ],
  openQuestions: ['Whether a finished book should stay in the main list or move somewhere else.'],
  agreed: true
};

function agreedScope(): ProjectScope {
  return mergeScope(
    emptyScope('a reading list app where I track books and mark them finished'),
    // AIB-007 widened `backend` to `ScopeBackend | string`; this fixture holds
    // the prose form, which is still what a pre-AIB-007 model sends and is
    // normalised on the way in.
    READING_LIST as Parameters<typeof mergeScope>[1]
  );
}

describe('AIX-012 — the scoping conversation', () => {
  it('records what the model agrees, and hands back prose to show the user', async () => {
    const { chat } = scriptedChat([
      toolThen(RECORD_SCOPE, { summary: READING_LIST.summary, pages: READING_LIST.pages }),
      prose('So: a Library page and an Add page, one Book record. Does that sound right?')
    ]);
    const session = new ScopingSession({ chat });

    const turn = await session.send('a reading list app where I track books and mark them finished');

    expect(turn.status).toBe('ok');
    expect(turn.reply).toContain('Does that sound right?');
    expect(turn.scope.summary).toBe(READING_LIST.summary);
    expect(turn.scope.pages.length).toBe(2);
    // The user's own words, unparaphrased — they are quoted into the record.
    expect(turn.scope.request).toBe('a reading list app where I track books and mark them finished');
  });

  it('cannot build: an authoring tool call is refused as unknown and nothing is produced', async () => {
    const { chat } = scriptedChat([
      toolThen('submit_component', {
        nodes: [{ id: 'a', type: 'Group' }],
        visual_roots: ['a']
      }),
      prose('Right — nothing gets built here. What is the app for?')
    ]);
    const session = new ScopingSession({ chat });

    const turn = await session.send('build me a CRM, right now');

    expect(turn.status).toBe('ok');
    expect(turn.reply).toContain('nothing gets built here');
    // The scope is the ONLY output shape, and it carries no graph.
    expect(turn.scope.pages.length).toBe(0);
    expect(Object.keys(turn.scope as unknown as Record<string, unknown>)).not.toContain('nodes');
  });

  it('offers exactly one tool, and its schema has no field that can carry a graph', () => {
    expect(SCOPING_TOOLS.length).toBe(1);
    expect(SCOPING_TOOLS[0].name).toBe(RECORD_SCOPE);

    // The structural half of "it is not allowed to build": widening this schema
    // with anything graph-shaped fails here rather than in production.
    const schema = JSON.stringify(SCOPING_TOOLS[0].parameters).toLowerCase();
    for (const forbidden of ['"nodes"', '"connections"', '"ports"', '"parameters"', '"visual_roots"']) {
      expect(schema.indexOf(forbidden)).toBe(-1);
    }
  });

  it('keeps a scope that is complete after every turn — abandoning mid-conversation loses nothing', async () => {
    const { chat } = scriptedChat([
      toolThen(RECORD_SCOPE, { summary: READING_LIST.summary }),
      prose('Who else uses this?'),
      toolThen(RECORD_SCOPE, { pages: READING_LIST.pages }),
      prose('And where does a book get added?')
    ]);
    const session = new ScopingSession({ chat });

    await session.send('a reading list app');
    const afterOne = session.scope;
    expect(afterOne.summary).toBe(READING_LIST.summary);
    expect(afterOne.pages.length).toBe(0);

    await session.send('just me');
    // Nothing about stopping here is special: the scope is a plain value, and
    // there is no "finish" call whose absence would discard it.
    expect(session.scope.summary).toBe(READING_LIST.summary);
    expect(session.scope.pages.length).toBe(2);
    expect(session.scope.agreed).toBe(false);
    expect(scopeHasContent(session.scope)).toBe(true);
  });

  it('replaces a field wholesale, so the conversation can drop a page it talked itself out of', async () => {
    const { chat } = scriptedChat([
      toolThen(RECORD_SCOPE, { pages: [...READING_LIST.pages, { name: 'Shelves', purpose: 'Group books' }] }),
      prose('Three pages then.'),
      toolThen(RECORD_SCOPE, {
        pages: READING_LIST.pages,
        rejected: [READING_LIST.rejected[0]]
      }),
      prose('Dropped Shelves — one list is enough for a first version.')
    ]);
    const session = new ScopingSession({ chat });

    await session.send('a reading list with shelves');
    expect(session.scope.pages.length).toBe(3);

    await session.send('actually shelves feel like a lot');
    expect(session.scope.pages.map((p) => p.name)).toEqual(['Library', 'Add a book']);
    expect(session.scope.rejected[0].option).toBe('A separate Shelves page');
  });

  it('surfaces a failed turn instead of silently losing it, and keeps the scope', async () => {
    const chat = async (): Promise<AiChatResponse> => {
      throw new Error('the provider is unreachable');
    };
    const session = new ScopingSession({ chat });

    const turn = await session.send('a reading list app');

    expect(turn.status).toBe('error');
    expect(turn.note).toContain('unreachable');
    expect(turn.scope.request).toBe('a reading list app');
  });

  it('AAQ-004: the long answer that streamed is the answer that is kept', async () => {
    // Richard's finding #2 — "long form answer… reduces to a one sentence
    // version". Only the last round used to reach `entries`, so a long answer
    // followed by a second round vanished in front of the user when the run
    // resolved. `record_scope` no longer produces that second round (AAQ-011
    // F3), so the multi-round shape here is the one that remains: a tool this
    // conversation does not have, answered as unknown, and the turn continues.
    const long =
      'A Library page lists every book with its author and whether it is finished, ' +
      'and an Add page is the only place a Book record is created. ' +
      'Two questions before we go further: does a finished book stay in the main list, and do you want covers?';
    const recap = 'So: Library and Add, one Book record.';
    const { chat } = streamingScriptedChat([
      toolThen('submit_component', { nodes: [] }, long),
      prose(recap)
    ]);
    const session = new ScopingSession({ chat });

    const streamedToTheUser: string[] = [];
    const turn = await session.send('a reading list app', { onText: (fullText) => streamedToTheUser.push(fullText) });

    expect(turn.status).toBe('ok');
    expect(turn.reply).toContain('do you want covers?');
    expect(turn.reply).toContain(recap);

    // The transcript is what the UI re-renders from. It must hold both rounds.
    const kept = session.transcript.filter((entry) => entry.role === 'assistant');
    expect(kept.length).toBe(1);
    expect(kept[0].text).toBe(`${long}\n\n${recap}`);

    // ...and it must equal the last thing the user was shown, so nothing
    // appears, changes or disappears when the turn resolves.
    expect(streamedToTheUser[streamedToTheUser.length - 1]).toBe(kept[0].text);
    // Monotonic: the bubble only ever grows through the turn.
    for (let i = 1; i < streamedToTheUser.length; i++) {
      expect(streamedToTheUser[i].startsWith(streamedToTheUser[i - 1])).toBe(true);
    }
  });

  it('AAQ-011 F3: a turn that answered and then recorded stops there — one prose answer, not two', async () => {
    // Richard's finding: the tool result used to say "Now answer the user in
    // prose" unconditionally, so every recording turn produced a second,
    // visibly redundant recap. The tool result IS the answer once the user has
    // already been answered: the round after the call is never asked for.
    const answer =
      'A Library page lists every book, and an Add page is the only place a Book record is created. ' +
      'Does a finished book stay in the main list?';
    const redundant = 'So: Library and Add, one Book record.';
    const { chat, requests } = streamingScriptedChat([
      toolThen(RECORD_SCOPE, { summary: READING_LIST.summary, pages: READING_LIST.pages }, answer),
      prose(redundant)
    ]);
    const session = new ScopingSession({ chat });

    const streamedToTheUser: string[] = [];
    const turn = await session.send('a reading list app', { onText: (fullText) => streamedToTheUser.push(fullText) });

    // One round only: the second scripted response is never consumed.
    expect(requests.length).toBe(1);
    expect(turn.status).toBe('ok');
    expect(turn.reply).toBe(answer);
    expect(turn.reply.indexOf(redundant)).toBe(-1);

    const kept = session.transcript.filter((entry) => entry.role === 'assistant');
    expect(kept.length).toBe(1);
    expect(kept[0].text).toBe(answer);
    expect(streamedToTheUser[streamedToTheUser.length - 1]).toBe(answer);

    // The scope is still recorded, and still current after the exchange.
    expect(turn.scope.summary).toBe(READING_LIST.summary);
    expect(session.scope.pages.length).toBe(2);
  });

  it('AAQ-011 F3: a turn whose only output is record_scope still says something', async () => {
    // The case removing the second turn could have turned into silence. The
    // model called the tool and said nothing, so there is no first answer to
    // keep — this turn is the one that still needs its prose round.
    const answer = 'Noted. Who else uses this?';
    const { chat, requests } = streamingScriptedChat([
      toolThen(RECORD_SCOPE, { summary: READING_LIST.summary }),
      prose(answer)
    ]);
    const session = new ScopingSession({ chat });

    const turn = await session.send('a reading list app');

    expect(requests.length).toBe(2);
    expect(turn.status).toBe('ok');
    expect(turn.reply).toBe(answer);
    expect(turn.scope.summary).toBe(READING_LIST.summary);

    // ...and the prose is asked for only in that case. The round that follows
    // an answered recording is never issued, so the only tool result the model
    // ever sees asking for prose is this one.
    expect(toolResults(requests[1])[0]).toBe(SCOPE_RECORDED_ANSWER_NEEDED);
  });

  it('AAQ-011 F3: an answered recording is told only that it was recorded', async () => {
    // Carried into the NEXT user turn's message list, so the nudge must not
    // survive there either — a stale "now answer in prose" is a standing
    // instruction to repeat yourself.
    const { chat, requests } = streamingScriptedChat([
      toolThen(RECORD_SCOPE, { summary: READING_LIST.summary }, 'Two pages then. Who else uses this?'),
      prose('Just you, then.')
    ]);
    const session = new ScopingSession({ chat });

    await session.send('a reading list app');
    await session.send('just me');

    expect(toolResults(requests[1])).toEqual([SCOPE_RECORDED]);
  });

  it('AAQ-011 F3: a recording turn the model never speaks in is not silence', async () => {
    // The pathological tail: record_scope with no prose, and then a round that
    // says nothing either. `reply` is what the launcher gates the bubble on —
    // empty means the user's own message appears and nothing answers it.
    const { chat } = streamingScriptedChat([toolThen(RECORD_SCOPE, { summary: READING_LIST.summary }), prose('')]);
    const session = new ScopingSession({ chat });

    const turn = await session.send('a reading list app');

    expect(turn.status).toBe('ok');
    expect(turn.reply).toBe(SCOPE_RECORDED_REPLY);
    const kept = session.transcript.filter((entry) => entry.role === 'assistant');
    expect(kept.length).toBe(1);
    expect(kept[0].text).toBe(SCOPE_RECORDED_REPLY);
    expect(turn.scope.summary).toBe(READING_LIST.summary);
  });

  it('AAQ-004: a one-round turn keeps exactly what streamed, with nothing duplicated', async () => {
    // The inverse failure the fix must not introduce: text shown once and then
    // entered twice.
    const only = 'Right — what is the app for?';
    const { chat } = streamingScriptedChat([prose(only)]);
    const session = new ScopingSession({ chat });

    const streamedToTheUser: string[] = [];
    const turn = await session.send('build me something', { onText: (fullText) => streamedToTheUser.push(fullText) });

    expect(turn.reply).toBe(only);
    expect(streamedToTheUser[streamedToTheUser.length - 1]).toBe(only);
    const kept = session.transcript.filter((entry) => entry.role === 'assistant');
    expect(kept.length).toBe(1);
    expect(kept[0].text).toBe(only);
  });

  it('AAQ-004: a turn that fails after speaking keeps what was already said', async () => {
    // The prose the user watched arrive is theirs whether or not the round
    // after it reached the provider. (The tool here is one that does not exist,
    // because since AAQ-011 F3 an answered `record_scope` ends the turn and
    // there is no round after it to fail.)
    const spoken = 'Two pages then — Library and Add.';
    const queue: AiChatResponse[] = [toolThen('submit_component', { nodes: [] }, spoken)];
    const chat = async (): Promise<AiChatResponse> => {
      const next = queue.shift();
      if (!next) throw new Error('the provider is unreachable');
      return next;
    };
    const session = new ScopingSession({ chat });

    const turn = await session.send('a reading list app');

    expect(turn.status).toBe('error');
    expect(turn.note).toContain('unreachable');
    const kept = session.transcript.filter((entry) => entry.role === 'assistant');
    expect(kept.length).toBe(1);
    expect(kept[0].text).toBe(spoken);
  });

  it('AIB-009 F11: a turn that never returns ends, and the scope so far survives it', async () => {
    // The first AI interaction anyone has with the product. Without a deadline
    // the composer stayed disabled behind `Thinking…` with no way out except
    // closing the wizard, which loses the conversation.
    const chat = () => new Promise<AiChatResponse>(() => undefined);
    const session = new ScopingSession({ chat, stallMs: 40 });

    const turn = await session.send('a reading list app');

    expect(turn.status).toBe('error');
    expect(turn.note).toContain('stopped responding');
    expect(turn.scope.request).toBe('a reading list app');
  });
});

describe('AIX-012 — the plan derived from an agreed scope', () => {
  const NEW_PROJECT = new Set(['/App', '/#__page__/Home']);

  it('produces exactly one operation per agreed page, and nothing else', () => {
    const plan = planFromScope(agreedScope(), { existingComponents: NEW_PROJECT });

    expect(plan.operations.length).toBe(2);
    expect(plan.operations.map((op) => op.target)).toEqual(['Pages/Library', 'Pages/Add a book']);
    expect(plan.operations.every((op) => op.kind === 'create')).toBe(true);
    // Docs are written at creation, from the transcript. Re-authoring them
    // through the plan would summarise a summary.
    expect(plan.operations.some((op) => op.kind === 'doc')).toBe(false);
  });

  it('AAQ-003: a plan that builds pages says how the app scrolls, defaulting to page-like', () => {
    // The default `bodyScroll` is OFF — app root `position: fixed`, `overflow:
    // clip` — and nothing in the AI path ever chose otherwise, so every page it
    // built was clipped at the viewport with no scrollbar.
    expect(planFromScope(agreedScope(), { existingComponents: NEW_PROJECT }).scroll).toBe('page');

    const dashboard = mergeScope(agreedScope(), { scroll: 'app' });
    expect(planFromScope(dashboard, { existingComponents: NEW_PROJECT }).scroll).toBe('app');

    // A model that sends nonsense does not get a shape. `mergeScope` validates
    // rather than casts, so the default stands.
    const nonsense = mergeScope(agreedScope(), { scroll: 'sideways' } as unknown as Parameters<typeof mergeScope>[1]);
    expect(nonsense.scroll).toBeUndefined();
  });

  it('AAQ-003: a scope with no pages states nothing about scrolling', () => {
    const noPages = mergeScope(emptyScope('a thing'), { pages: [] });

    expect(planFromScope(noPages, { existingComponents: NEW_PROJECT }).scroll).toBeUndefined();
  });

  it('plans an update, not a create, for a page the new project already has', () => {
    const scope = mergeScope(agreedScope(), {
      pages: [{ name: 'Home', purpose: 'The list of every book.' }]
    });
    const plan = planFromScope(scope, { existingComponents: NEW_PROJECT });

    expect(plan.operations.length).toBe(1);
    expect(plan.operations[0].kind).toBe('update');
    expect(plan.operations[0].target).toBe('#__page__/Home');
  });

  it('names the sibling pages and the conventions file in every intent', () => {
    const plan = planFromScope(agreedScope(), { existingComponents: NEW_PROJECT });
    const library = plan.operations.find((op) => op.target === 'Pages/Library')!;

    expect(library.intent).toContain('Add a book');
    expect(library.intent).toContain('docs/CONVENTIONS.md');
    expect(library.intent).toContain('Book');
  });

  it('validates against a real project graph — the plan is executable, not just well-formed', () => {
    const graph = fromSerialisedProject(JSON.parse(JSON.stringify(gitRepoUtf8)));
    const existing = new Set(graph.components.map((c) => c.name));
    const plan = planFromScope(agreedScope(), { existingComponents: existing });

    expect(validatePlan(plan, { existingComponents: existing })).toEqual([]);
  });

  it('produces no operations from a scope nobody agreed any pages in', () => {
    const plan = planFromScope(emptyScope('something vague'), { existingComponents: NEW_PROJECT });
    expect(plan.operations).toEqual([]);
    expect(plan.request).toBe('something vague');
  });

  it('strips slashes out of a page name rather than inventing a folder', () => {
    expect(pageComponentPath('Books/Detail')).toBe('Pages/Books Detail');
  });
});

describe('AIX-012 — the documents', () => {
  it('writes what was considered and rejected into the scoping record', () => {
    const record = renderScopeRecord({ scope: agreedScope(), transcript: [], at: '2026-07-27T00:00:00.000Z' });

    expect(record).toContain('## What was considered and rejected');
    expect(record).toContain('A separate Shelves page');
    expect(record).toContain('One list is enough for a first version');
    expect(record).toContain('Importing from Goodreads');
  });

  it('quotes the request verbatim and carries the whole transcript', () => {
    const record = renderScopeRecord({
      scope: agreedScope(),
      transcript: [
        { role: 'user', text: 'a reading list app where I track books and mark them finished' },
        { role: 'assistant', text: 'Who else uses it?\n\nJust you?' }
      ],
      at: '2026-07-27T00:00:00.000Z'
    });

    expect(record).toContain('> a reading list app where I track books and mark them finished');
    expect(record).toContain('## Transcript');
    expect(record).toContain('> Who else uses it?');
  });

  it('marks what was NOT agreed with > TODO: rather than inventing it', () => {
    const thin = mergeScope(emptyScope('a thing'), { pages: [{ name: 'One', purpose: 'shows stuff' }] });

    expect(renderBrief(thin)).toContain(TODO_MARKER);
    expect(renderArchitecture(thin)).toContain(TODO_MARKER);
    expect(renderConventions(thin)).toContain(TODO_MARKER);
    // …and does NOT invent an audience or an out-of-scope list.
    expect(renderBrief(thin)).not.toContain('reading');
  });

  it('renders open questions as TODOs, never as decisions', () => {
    const architecture = renderArchitecture(agreedScope());
    expect(architecture).toContain(`${TODO_MARKER} Whether a finished book should stay in the main list`);
  });

  it('seeds CONVENTIONS.md from the template and appends only what was established', () => {
    const conventions = renderConventions(agreedScope());

    // The template's own material, verbatim — this file is not invented wholesale.
    expect(conventions).toContain('# Conventions');
    expect(conventions).toContain('(example)');
    // The one rule the conversation actually agreed, attributed to it.
    expect(conventions).toContain('## Established during scoping');
    expect(conventions).toContain('Every list page shows an explicit empty state.');
  });

  it('never describes a graph — its own scaffolding has no graph vocabulary at all', () => {
    // Asserted against a scope whose prose is deliberately free of graph words,
    // so what is left is the renderer's own text. AIX-009's design line is that
    // docs record intent and reasons; the graph is inspectable and narrates
    // itself. At the moment these are written nothing has been built anyway.
    const plain = mergeScope(emptyScope('a list'), {
      summary: 'A list of things.',
      audience: 'One person.',
      pages: [{ name: 'List', purpose: 'Shows the things.' }],
      objects: [{ name: 'Thing', purpose: 'One item.', fields: ['title (text)'] }],
      backend: 'Local storage only.',
      rejected: [{ option: 'Sharing', reason: 'Not a first version.' }]
    });
    const architecture = renderArchitecture(plain).toLowerCase();

    for (const graphWord of ['group', 'connection', 'node', 'port', 'wire']) {
      expect(architecture.indexOf(graphWord)).toBe(-1);
    }
  });

  it('records the plan in the scoping document, so the handover survives the session', () => {
    const plan = planFromScope(agreedScope(), { existingComponents: new Set(['/App', '/#__page__/Home']) });
    const record = renderScopeRecord({ scope: agreedScope(), transcript: [], plan, at: 'now' });

    expect(record).toContain('## Proposed build plan');
    expect(record).toContain('create `Pages/Library`');
    expect(record).toContain('handed over unexecuted');
  });

  it('says so, in the document, when the conversation was left before agreement', () => {
    const record = renderScopeRecord({
      scope: mergeScope(emptyScope('a reading list'), { summary: 'A list of books.' }),
      transcript: [],
      abandoned: true,
      at: 'now'
    });

    expect(record).toContain('ended before a scope was agreed');
    expect(record).toContain('nothing here was inferred to fill the gaps');
  });

  it('produces the four documents at the four known paths', () => {
    const paths = scopeDocuments({ scope: agreedScope(), transcript: [] }).map((d) => d.path);
    expect(paths).toEqual(['docs/BRIEF.md', 'docs/ARCHITECTURE.md', 'docs/CONVENTIONS.md', DOC_INITIAL_SCOPE]);
  });

  it('summarises a scope for the review step without claiming more than it has', () => {
    expect(scopeOutline(emptyScope('x'))).toEqual([]);
    const outline = scopeOutline(agreedScope());
    expect(outline[0]).toBe(READING_LIST.summary);
    expect(outline.join(' ')).toContain('2 pages');
  });
});

describe('AIX-012 — writing the documents into a real project folder', () => {
  let dir: string;
  let docs: ProjectDocsModel;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aix012-scope-'));
    docs = new ProjectDocsModel(dir);
  });

  afterEach(() => {
    docs.dispose();
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('lands all four files on disk, including the nested decisions folder', async () => {
    const scope = agreedScope();
    const plan = planFromScope(scope, { existingComponents: new Set(['/App']) });

    const result = await writeScopeDocs(docs, {
      scope,
      transcript: [{ role: 'user', text: 'a reading list app' }],
      plan,
      at: '2026-07-27T00:00:00.000Z'
    });

    expect(result.failed).toEqual([]);
    expect(result.written.length).toBe(4);
    expect(fs.existsSync(path.join(dir, 'docs', 'BRIEF.md'))).toBe(true);
    expect(fs.existsSync(path.join(dir, 'docs', 'ARCHITECTURE.md'))).toBe(true);
    expect(fs.existsSync(path.join(dir, 'docs', 'CONVENTIONS.md'))).toBe(true);
    expect(fs.existsSync(path.join(dir, 'docs', 'decisions', '000-initial-scope.md'))).toBe(true);

    const record = fs.readFileSync(path.join(dir, 'docs', 'decisions', '000-initial-scope.md'), 'utf8');
    expect(record).toContain('A separate Shelves page');
  });

  it('an abandoned conversation still produces a project with a brief — never nothing', async () => {
    // The exact criterion-2 case: one turn in, no agreement, user walks away.
    const scope = mergeScope(emptyScope('a reading list app'), { summary: 'A private list of books.' });

    const result = await writeScopeDocs(docs, { scope, transcript: [], abandoned: true, at: 'now' });

    expect(result.failed).toEqual([]);
    const brief = fs.readFileSync(path.join(dir, 'docs', 'BRIEF.md'), 'utf8');
    expect(brief).toContain('A private list of books.');
    // …and the parts nobody agreed are marked, not filled in.
    expect(brief).toContain(TODO_MARKER);
  });

  it('criterion 5, mechanically: the CONVENTIONS.md just written is what the authoring loop is handed', async () => {
    const scope = agreedScope();
    await writeScopeDocs(docs, { scope, transcript: [], at: 'now' });

    // Exactly what `AuthoringSession` reads through `currentProjectDocs()`.
    const content = await docs.content();
    const graph = fromSerialisedProject(JSON.parse(JSON.stringify(gitRepoUtf8)));
    const context = new AuthoringContextBuilder(graph, {}, undefined, undefined, content);

    const handout = context.projectConventions();
    expect(handout).toBeDefined();
    expect(handout).toContain('Every list page shows an explicit empty state.');
    expect(context.projectBrief()).toContain(READING_LIST.summary);
  });

  /**
   * Phase-15 close-out — the other half of criterion 5, which the mechanical
   * assertion above cannot see: *what is in* the file that gets handed over.
   *
   * The template seeds six `(example)` rules, and the handout is the file
   * verbatim — `renderDocForPrompt` only truncates. So a project created from a
   * conversation that agreed three pages ships "(example) Do not add a Router;
   * this app is a single page" into every authoring turn, under a header saying
   * these rules must be followed and outrank the model's defaults. The examples
   * have to carry their own disclaimer, because the file is read by the model
   * and by the user and neither should be told a different thing.
   */
  it('the handed-over conventions disown their own example rules', async () => {
    await writeScopeDocs(docs, { scope: agreedScope(), transcript: [], at: 'now' });
    const content = await docs.content();
    const graph = fromSerialisedProject(JSON.parse(JSON.stringify(gitRepoUtf8)));
    const handout = new AuthoringContextBuilder(graph, {}, undefined, undefined, content).projectConventions()!;

    // The example that would actively contradict a multi-page plan.
    expect(handout).toContain('(example) Do not add a Router');
    // …and, in the same text, the statement that it is not a rule here.
    //
    // AIB-006 moved this sentence out of a leading HTML comment and into a
    // visible "How this file is used" section. It reaches the agent either way —
    // the handout has never stripped comments — but it now reaches the *human*
    // too, which it did not before: Remarkable ended the comment at its first
    // blank line, so the whole file previewed as a lone <h1>.
    expect(handout).toContain('ignore every line marked (example)');
  });
});

describe('AIX-012 — the plan handover', () => {
  afterEach(() => setPendingScopePlan(null));

  it('hands the plan to one consumer and then forgets it', () => {
    const plan = planFromScope(agreedScope(), { existingComponents: new Set(['/App']) });
    setPendingScopePlan({ projectId: 'p1', plan, recordPath: DOC_INITIAL_SCOPE });

    expect(peekPendingScopePlan('p1')?.plan.operations.length).toBe(2);
    expect(takePendingScopePlan('p1')?.plan.operations.length).toBe(2);
    // A plan that survived being consumed would reattach itself to the next
    // project someone opened.
    expect(takePendingScopePlan('p1')).toBeUndefined();
  });

  it('never offers a plan to a different project — and survives one asking (AIB-005)', () => {
    const plan = planFromScope(agreedScope(), { existingComponents: new Set(['/App']) });
    setPendingScopePlan({ projectId: 'p1', plan, recordPath: DOC_INITIAL_SCOPE });

    expect(peekPendingScopePlan('p2')).toBeUndefined();
    expect(takePendingScopePlan('p2')).toBeUndefined();

    // AIB-005 reversed the second half of this spec, deliberately. It used to
    // assert that p2's ask DESTROYED p1's plan, on AIX-012's reasoning that "a
    // stale plan that keeps offering itself is a bug that presents as a
    // feature". But the id check above is what stops a plan reaching the wrong
    // project; clearing on a mismatch protected nothing and cost everything —
    // opening any other project first silently threw away the handover for the
    // one the user had just spent ten minutes scoping, and the editor would then
    // open on an unexplained hello-world page with no announcement to make.
    expect(takePendingScopePlan('p1')?.plan.operations.length).toBe(2);
    // Still exactly one consumption, by its own project.
    expect(takePendingScopePlan('p1')).toBeUndefined();
  });
});

/**
 * Phase-15 close-out — findings from the first live scoping conversation.
 *
 * Two things only a real model produces. Both are about a document that
 * contradicts itself, which is worse than a document with a gap: a `> TODO:`
 * tells the next reader to go and find out, and a contradiction tells them
 * something false with the same confidence as everything around it.
 */
describe('AIX-012 — what the live conversation got wrong', () => {
  /**
   * The run: the model assumed "no accounts for now" on turn 1 and recorded it
   * in `outOfScope`; the user asked for email/password sign-in on turn 3; the
   * model recorded the Login page and the auth backend and left the stale
   * out-of-scope line in place. The brief then said the app has no accounts on
   * the same page as it said how people log in.
   *
   * The merge was never the problem — it replaces, and this proves it. What was
   * missing was the model knowing that a reversed decision means re-sending the
   * *shortened* list, which is now stated in the tool schema and the prompt.
   */
  it('lets a later turn shrink a list, so a reversed decision can be un-recorded', () => {
    const first = mergeScope(emptyScope('a book club app'), {
      outOfScope: ['In-app chat (WhatsApp covers it)', 'User accounts/authentication']
    });
    expect(first.outOfScope.length).toBe(2);

    const reversed = mergeScope(first, { outOfScope: ['In-app chat (WhatsApp covers it)'] });
    expect(reversed.outOfScope).toEqual(['In-app chat (WhatsApp covers it)']);
  });

  it('tells the model that a reversed decision needs the shortened list re-sent', () => {
    const prompt = scopingSystemPrompt();
    // The generic "each field replaces" line was already in the tool schema and
    // was not enough — the model reads `record_scope` as "record what is new".
    // What it needed was the consequence spelled out.
    expect(prompt).toContain('REPLACES');
    expect(prompt.toLowerCase()).toContain('re-send that whole list');
  });

  it('marks the out-of-scope field as replacing, where the model reads it', () => {
    const tool = SCOPING_TOOLS.find((t) => t.name === RECORD_SCOPE)!;
    const properties = (tool.parameters as { properties: Record<string, { description: string }> }).properties;
    expect(properties.outOfScope.description).toContain('Replaces the previous list');
  });
});
