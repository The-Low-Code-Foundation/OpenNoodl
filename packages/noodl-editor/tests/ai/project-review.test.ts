/**
 * AIX-010 — Project review & docs retrofit.
 *
 * The task's risk is output quality, not plumbing, so these specs are weighted
 * towards the things that decide quality and can still be checked offline:
 *
 *  - the page map comes from what the project **declares** (Router and Page node
 *    parameters), because the routes file the spec named is a serialisation of
 *    `metadata.routes` that no hand-built project has;
 *  - the selection rule is a total order, so the same project always produces
 *    the same reads and the user can be shown why;
 *  - **the coverage is honest**: a budget that bites is recorded as components
 *    not read, in the log, in the prompt and in the panel;
 *  - `> TODO:` labelling is enforced by an advisory pass, not hoped for;
 *  - the graph-restatement lint still catches prose written in the vocabulary a
 *    model actually uses (display names, not catalog type names);
 *  - and **criterion 7 is checked on real files** — a review whose drafts are
 *    all rejected leaves the project directory byte-for-byte identical.
 *
 * Everything is offline: the chat function is a script.
 */

import fs from 'fs';
import os from 'os';
import path from 'path';

import { docLint } from '../../src/editor/src/models/AiAssistant/authoring/docLint';
import type { AiChatRequest, AiChatResponse } from '../../src/editor/src/models/AiAssistant/client/types';
import { fromSerialisedProject } from '../../src/editor/src/models/AiAssistant/explain/graph';
import {
  assembleProjectReview,
  renderCoverageForPrompt,
  renderProjectReviewContext,
  summariseCoverage
} from '../../src/editor/src/models/AiAssistant/review/assembleProject';
import { buildPageMap, renderPageMap } from '../../src/editor/src/models/AiAssistant/review/pageMap';
import {
  countTodoMarkers,
  REVIEW_DOC_PATHS,
  reviewSystemPrompt,
  reviewUserMessage,
  TODO_MARKER
} from '../../src/editor/src/models/AiAssistant/review/prompts';
import { ProjectReviewRun } from '../../src/editor/src/models/AiAssistant/review/ProjectReviewRun';
import { ReviewDocSession } from '../../src/editor/src/models/AiAssistant/review/ReviewDocSession';
import type { ReviewDocRequest } from '../../src/editor/src/models/AiAssistant/review/ReviewDocSession';
import { inboundReferenceCounts, rankComponents } from '../../src/editor/src/models/AiAssistant/review/selection';
import { stageReviewDrafts } from '../../src/editor/src/models/AiAssistant/review/startProjectReview';
import type { ExplainGraph } from '../../src/editor/src/models/AiAssistant/explain/types';
import { DocProposalStore } from '../../src/editor/src/models/ProjectDocs/DocProposals';
import { ProjectDocsModel } from '../../src/editor/src/models/ProjectDocs/ProjectDocsModel';
import { ProjectModel } from '../../src/editor/src/models/projectmodel';

/* eslint-disable @typescript-eslint/no-var-requires */
const gitRepoUtf8 = require('../testfs/git-repo-utf8/project.json');
/* eslint-enable @typescript-eslint/no-var-requires */

function loadGraph(): ExplainGraph {
  return fromSerialisedProject(JSON.parse(JSON.stringify(gitRepoUtf8)));
}

const usage = { promptTokens: 10, completionTokens: 5, cacheReadTokens: 0, cacheWriteTokens: 0, costUsd: 0.01 };

function submitDoc(content: string, summary?: string): AiChatResponse {
  return {
    text: '',
    toolCalls: [
      {
        id: `call-${Math.random().toString(36).slice(2, 8)}`,
        name: 'submit_doc',
        arguments: { content, ...(summary ? { summary } : {}) }
      }
    ],
    usage,
    model: 'test',
    stopReason: 'tool_calls'
  };
}

function prose(text: string): AiChatResponse {
  return { text, toolCalls: [], usage, model: 'test', stopReason: 'stop' };
}

/** A chat that replays the given responses, one per turn, recording the prompts. */
function scripted(responses: AiChatResponse[]) {
  const seen: AiChatRequest[] = [];
  let index = 0;
  const chat = async (request: AiChatRequest): Promise<AiChatResponse> => {
    seen.push(request);
    const response = responses[Math.min(index, responses.length - 1)];
    index++;
    return response;
  };
  return { chat, seen };
}

/** A graph with a Router, three pages and a shared component — the shapes that matter. */
function routedGraph(): ExplainGraph {
  const node = (id: string, type: string, parameters: Record<string, unknown> = {}) => ({
    id,
    type,
    parameters,
    children: [],
    instancePorts: []
  });
  const filler = (prefix: string, count: number) =>
    Array.from({ length: count }, (_, i) => node(`${prefix}-${i}`, 'Text', { text: `t${i}` }));

  return {
    components: [
      {
        name: 'App',
        nodes: [
          node('router', 'Router', {
            name: 'Main',
            pages: { startPage: '/#__page__/Home', routes: ['/#__page__/Home', '/#__page__/Cart'] }
          }),
          ...filler('app', 3)
        ],
        connections: []
      },
      {
        name: '/#__page__/Home',
        nodes: [node('home-page', 'Page', { title: 'Home', urlPath: 'home' }), node('home-nav', '/Nav'), ...filler('home', 8)],
        connections: []
      },
      {
        name: '/#__page__/Cart',
        nodes: [node('cart-page', 'Page', { title: 'Cart', urlPath: 'cart' }), node('cart-nav', '/Nav'), ...filler('cart', 5)],
        connections: []
      },
      {
        name: '/Nav',
        nodes: [node('nav-go', 'RouterNavigate', { router: 'Main', target: '/#__page__/Home' }), ...filler('nav', 4)],
        connections: []
      },
      { name: '/Tiny', nodes: [node('tiny', 'Text', { text: 'x' })], connections: [] }
    ]
  };
}

// ── The page map ──────────────────────────────────────────────────────────────

describe('AIX-010 page map', () => {
  it('reads the page graph from Router and Page node parameters, not a routes file', () => {
    const map = buildPageMap(routedGraph());

    expect(map.routers.length).toBe(1);
    expect(map.routers[0].name).toBe('Main');
    expect(map.routers[0].host).toBe('App');
    expect(map.pages.map((p) => p.component)).toEqual(['/#__page__/Home', '/#__page__/Cart']);
    // Declared, not guessed — the distinction the drafting prompt is told about.
    expect(map.sources).toContain('router-node');
    expect(map.sources).toContain('page-node');
    expect(map.sources.indexOf('name-convention')).toBe(-1);
  });

  it('carries titles, url paths and the start page through to the rendered block', () => {
    const rendered = renderPageMap(buildPageMap(routedGraph()));
    expect(rendered).toContain('START PAGE');
    expect(rendered).toContain('title "Home"');
    expect(rendered).toContain('url /cart');
    expect(rendered).toContain('declared');
  });

  it('prefers a declared routes file where one exists', () => {
    const map = buildPageMap(routedGraph(), [{ path: '/checkout', component: '/#__page__/Checkout', title: 'Checkout' }]);
    expect(map.sources).toContain('routes-file');
    expect(map.pages.some((p) => p.component === '/#__page__/Checkout')).toBe(true);
  });

  it('marks a page found only by naming convention as inferred, and says so', () => {
    const graph: ExplainGraph = {
      components: [{ name: '/Pages/Orphan', nodes: [], connections: [] }]
    };
    const map = buildPageMap(graph);
    expect(map.sources).toEqual(['name-convention']);
    expect(renderPageMap(map)).toContain('INFERRED');
  });

  it('states plainly that a project with no routing declares none, rather than inventing pages', () => {
    const rendered = renderPageMap(buildPageMap({ components: [{ name: 'Solo', nodes: [], connections: [] }] }));
    expect(rendered).toContain('declares no routing');
    expect(rendered).toContain('Do not assert a page structure you cannot see.');
  });
});

// ── Selection ─────────────────────────────────────────────────────────────────

describe('AIX-010 component selection', () => {
  it('counts inbound references from component-instance node types, ignoring self-reference', () => {
    const counts = inboundReferenceCounts(routedGraph());
    expect(counts.get('/Nav')).toBe(2);
    expect(counts.get('App')).toBe(0);
  });

  it('ranks root first, then the start page, then pages, then by inbound references', () => {
    const graph = routedGraph();
    const ranked = rankComponents(graph, buildPageMap(graph), 'App');
    expect(ranked.map((r) => r.name)).toEqual([
      'App',
      '/#__page__/Home',
      '/#__page__/Cart',
      '/Nav',
      '/Tiny'
    ]);
    expect(ranked[0].kind).toBe('root');
    expect(ranked[1].reason).toBe('the start page');
    expect(ranked[3].reason).toBe('used by 2 other components');
  });

  it('falls back to the router host when the project records no root component', () => {
    const graph = routedGraph();
    expect(rankComponents(graph, buildPageMap(graph))[0].name).toBe('App');
  });

  it('is a total order — the same graph always produces the same reads', () => {
    const graph = routedGraph();
    const once = rankComponents(graph, buildPageMap(graph), 'App').map((r) => r.name);
    const twice = rankComponents(graph, buildPageMap(graph), 'App').map((r) => r.name);
    expect(once).toEqual(twice);
  });
});

// ── Assembly and coverage ─────────────────────────────────────────────────────

describe('AIX-010 project assembly', () => {
  it('assembles the blocks in the documented order, cheapest first', () => {
    const context = assembleProjectReview(routedGraph(), {});
    expect(context.blocks[0].heading).toBe('PROJECT OVERVIEW');
    expect(context.blocks[1].heading).toBe('PAGES AND NAVIGATION');
    expect(context.blocks[2].heading).toBe('BACKEND AND DATA MODEL');
  });

  it('hoists the node vocabulary out of the reads and documents no ports', () => {
    const context = assembleProjectReview(routedGraph(), {});
    const vocabulary = context.blocks.find((b) => b.heading === 'NODE TYPES USED IN THIS PROJECT');
    expect(vocabulary).toBeDefined();
    expect(vocabulary!.body).toContain('no port names below');
    // The reads themselves must not carry the per-component type block any more.
    const reads = context.blocks.find((b) => b.heading === 'COMPONENTS READ IN FULL');
    expect(reads!.body.indexOf('## Node types in this context')).toBe(-1);
  });

  it('records every component it did not read, with the reason', () => {
    const context = assembleProjectReview(routedGraph(), {});
    const skipped = context.coverage.notRead.find((n) => n.name === '/Tiny');
    expect(skipped).toBeDefined();
    expect(skipped!.reason).toContain('node(s)');
  });

  it('stops at the read cap and says so rather than under-reading silently', () => {
    const context = assembleProjectReview(routedGraph(), {}, { budget: { maxComponentReads: 2 } });
    expect(context.coverage.read.length).toBe(2);
    const stopped = context.coverage.notRead.filter((n) => n.reason.indexOf('read limit') !== -1);
    expect(stopped.length > 0).toBe(true);
  });

  it('stops on the character budget, logs the refusal, and never exceeds it', () => {
    const context = assembleProjectReview(routedGraph(), {}, { budget: { maxChars: 3_000 }, reserveChars: 200 });
    expect(context.coverage.charsUsed <= 3_000).toBe(true);
    expect(context.coverage.read.length < 5).toBe(true);
    expect(context.coverage.notRead.length > 0).toBe(true);
  });

  it('reports an unreadable backend schema as unavailable, never as "no collections"', () => {
    const context = assembleProjectReview(routedGraph(), {
      backend: { services: [], collections: [], schemaAvailable: false, schemaNote: 'unreachable' }
    });
    const block = context.blocks.find((b) => b.heading === 'BACKEND AND DATA MODEL')!;
    expect(block.body).toContain('could not be read');
    expect(block.body).toContain('NOT evidence');
  });

  it('names real collections and fields verbatim when the schema was read', () => {
    const context = assembleProjectReview(routedGraph(), {
      backend: {
        services: [],
        schemaAvailable: true,
        collections: [
          { name: 'Orders', fields: [{ name: 'total', type: 'Number' }, { name: 'buyer', type: 'Pointer', targetClass: 'User' }] }
        ]
      }
    });
    const block = context.blocks.find((b) => b.heading === 'BACKEND AND DATA MODEL')!;
    expect(block.body).toContain('- Orders');
    expect(block.body).toContain('buyer: Pointer → User');
    expect(block.body).toContain('do not invent fields');
  });

  it('tells the model what it was not shown, so it can hedge instead of confabulating', () => {
    const context = assembleProjectReview(routedGraph(), {}, { budget: { maxComponentReads: 1 } });
    const rendered = renderCoverageForPrompt(context.coverage);
    expect(rendered).toContain('NOT read');
    expect(rendered).toContain('write a TODO line asking the human instead of guessing');
    expect(summariseCoverage(context.coverage)).toContain('of 5 components');
  });

  it('renders the reference material as delimited blocks', () => {
    const rendered = renderProjectReviewContext(assembleProjectReview(routedGraph(), {}));
    expect(rendered).toContain('--- PROJECT OVERVIEW ---');
    expect(rendered).toContain('--- END PROJECT OVERVIEW ---');
  });

  it('runs over the real project corpus without an editor', () => {
    const context = assembleProjectReview(loadGraph(), {});
    expect(context.coverage.componentsTotal > 0).toBe(true);
    expect(context.coverage.charsUsed > 0).toBe(true);
  });
});

// ── Prompts ───────────────────────────────────────────────────────────────────

describe('AIX-010 prompts', () => {
  it('gives every document an explicit anti-goal', () => {
    expect(reviewSystemPrompt('brief')).toContain('invented product goal stated as fact');
    expect(reviewSystemPrompt('architecture')).toContain('node-by-node inventory');
    expect(reviewSystemPrompt('conventions')).toContain('Aspirational rules the project does not follow');
  });

  it('requires the TODO marker in every document, by name and by example', () => {
    for (const kind of ['brief', 'architecture', 'conventions'] as const) {
      const prompt = reviewSystemPrompt(kind);
      expect(prompt).toContain(TODO_MARKER);
      expect(prompt).toContain('MARK EVERY INFERENCE');
      expect(prompt).toContain('NEVER DESCRIBE THE GRAPH');
    }
  });

  it('frames an existing file as an edit and a missing one as a first draft', () => {
    const base = {
      kind: 'brief' as const,
      path: REVIEW_DOC_PATHS.brief,
      context: 'ctx',
      coverage: 'cov'
    };
    expect(reviewUserMessage({ ...base, current: '# Brief\n' })).toContain('proposing an EDIT');
    expect(reviewUserMessage({ ...base, template: '# Brief\n' })).toContain('DOES NOT EXIST YET');
  });

  it('tells a document what its siblings already covered, so the three do not repeat', () => {
    const rendered = reviewUserMessage({
      kind: 'conventions',
      path: REVIEW_DOC_PATHS.conventions,
      context: 'ctx',
      coverage: 'cov',
      siblings: [{ path: 'docs/BRIEF.md', summary: 'what the app is' }]
    });
    expect(rendered).toContain('ALREADY DRAFTED IN THIS REVIEW');
    expect(rendered).toContain('docs/BRIEF.md: what the app is');
  });

  it('counts TODO markers only on their own lines', () => {
    expect(countTodoMarkers(`${TODO_MARKER} one\ntext\n  ${TODO_MARKER} two\na > TODO: inline`)).toBe(2);
  });
});

// ── The graph-restatement lint, in this task's vocabulary ─────────────────────

describe('AIX-010 graph restatement', () => {
  it('still catches prose written with editor display names, not catalog type names', () => {
    // "Text Accumulator" and "Navigate" are displayNames; the catalog type names
    // are `net.noodl.TextAccumulator` and `RouterNavigate`. A lint keyed on type
    // names alone would see nothing here — the AIX-011 finding, re-pinned for
    // the prompts this task added.
    const findings = docLint(
      [
        'The Server-Sent Events node connects to the Text Accumulator.',
        'Each page is wired to the Navigate node inside the Nav component.'
      ].join('\n')
    );
    expect(findings.findings.length).toBe(2);
  });

  it('leaves honest prose about intent and contracts alone', () => {
    const findings = docLint(
      [
        '# Architecture',
        '',
        `${TODO_MARKER} confirm whether the Live page ships or is a demo.`,
        '',
        'Chat streams model tokens over SSE and appends them into one buffer, so a partial reply renders as',
        'it arrives rather than after the request completes.',
        '',
        'State is shared through a global store rather than passed down, because four sibling pages need the',
        'same conversation and none of them owns it.'
      ].join('\n')
    );
    expect(findings.findings).toEqual([]);
  });
});

// ── The drafting turn ─────────────────────────────────────────────────────────

const GOOD_DRAFT =
  '# Architecture\n\nCheckout is a page rather than a modal so the browser back button behaves.\n\n' +
  `${TODO_MARKER} confirm whether guest checkout is intended.\n`;

function request(overrides: Partial<ReviewDocRequest> = {}): ReviewDocRequest {
  return {
    kind: 'architecture',
    path: REVIEW_DOC_PATHS.architecture,
    context: '--- PROJECT OVERVIEW ---\nThe project has 2 components.\n--- END ---',
    coverage: 'You read 1 of 2 components.',
    coverageLine: 'Read 1 of 2 components in full',
    baseline: null,
    ...overrides
  };
}

describe('AIX-010 review drafting turn', () => {
  it('produces a document, counts its TODO markers, and writes nothing', async () => {
    const { chat } = scripted([submitDoc(GOOD_DRAFT, 'first draft')]);
    const outcome = await new ReviewDocSession(request(), { chat }).run();

    expect(outcome.status).toBe('authored');
    expect(outcome.content).toBe(GOOD_DRAFT);
    expect(outcome.summary).toBe('first draft');
    expect(outcome.todoCount).toBe(1);
  });

  it('treats prose without a submission as a decline — a real outcome, not a failure', async () => {
    const { chat } = scripted([prose('This project has no conventions worth writing down yet.')]);
    const outcome = await new ReviewDocSession(request({ kind: 'conventions' }), { chat }).run();
    expect(outcome.status).toBe('declined');
    expect(outcome.note).toContain('no conventions');
  });

  it('treats a byte-identical resubmission as a decline rather than an empty diff', async () => {
    const { chat } = scripted([submitDoc(GOOD_DRAFT)]);
    const outcome = await new ReviewDocSession(request({ baseline: GOOD_DRAFT }), { chat }).run();
    expect(outcome.status).toBe('declined');
  });

  it('asks once for TODO markers when a partial read produced none, and takes the rewrite', async () => {
    const certain = '# Architecture\n\nThe app is a shop for selling shoes to runners.\n';
    const { chat, seen } = scripted([submitDoc(certain), submitDoc(GOOD_DRAFT)]);
    const outcome = await new ReviewDocSession(request(), { chat }).run();

    expect(outcome.status).toBe('authored');
    expect(outcome.content).toBe(GOOD_DRAFT);
    expect(outcome.todoCount).toBe(1);
    // The advisory was sent, and it quoted the coverage.
    const advisory = seen[1].messages.find((m) => m.role === 'tool');
    expect(String(advisory!.content)).toContain('Read 1 of 2 components in full');
  });

  it('keeps the first submission when the TODO rewrite never lands — an advisory cannot fail a usable doc', async () => {
    const certain = '# Architecture\n\nThe app is a shop.\n';
    const { chat } = scripted([submitDoc(certain), prose('I stand by it.')]);
    const outcome = await new ReviewDocSession(request(), { chat }).run();

    expect(outcome.status).toBe('authored');
    expect(outcome.content).toBe(certain);
    expect(outcome.todoCount).toBe(0);
  });

  it('offers the graph-restatement advisory before the TODO one, and reports surviving findings', async () => {
    const restating = `# Architecture\n\nThe Text Accumulator connects to the Text node.\n${TODO_MARKER} check\n`;
    const { chat, seen } = scripted([submitDoc(restating), submitDoc(restating)]);
    const outcome = await new ReviewDocSession(request(), { chat }).run();

    const advisory = seen[1].messages.find((m) => m.role === 'tool');
    expect(String(advisory!.content)).toContain('describe the GRAPH');
    expect(outcome.status).toBe('authored');
    expect(outcome.lintFindings.length > 0).toBe(true);
  });

  it('refuses a submission with no content and repairs, rather than throwing', async () => {
    const empty: AiChatResponse = {
      text: '',
      toolCalls: [{ id: 'c1', name: 'submit_doc', arguments: {} }],
      usage,
      model: 'test',
      stopReason: 'tool_calls'
    };
    const { chat, seen } = scripted([empty, submitDoc(GOOD_DRAFT)]);
    const outcome = await new ReviewDocSession(request(), { chat }).run();

    expect(outcome.status).toBe('authored');
    expect(String(seen[1].messages.find((m) => m.role === 'tool')!.content)).toContain('cannot be used');
  });
});

// ── The run ───────────────────────────────────────────────────────────────────

describe('AIX-010 review run', () => {
  it('drafts all three documents in order and publishes progress', async () => {
    const { chat } = scripted([submitDoc(GOOD_DRAFT, 'a summary')]);
    const run = new ProjectReviewRun(routedGraph(), {}, { chat });

    const phases: string[] = [];
    run.onChange((state) => phases.push(state.phase));
    const state = await run.run();

    expect(state.phase).toBe('done');
    expect(state.drafts.map((d) => d.kind)).toEqual(['brief', 'architecture', 'conventions']);
    expect(state.drafts.every((d) => d.status === 'authored')).toBe(true);
    expect(state.drafts.map((d) => d.path)).toEqual([
      REVIEW_DOC_PATHS.brief,
      REVIEW_DOC_PATHS.architecture,
      REVIEW_DOC_PATHS.conventions
    ]);
    expect(phases[0]).toBe('assembling');
    expect(phases.indexOf('drafting') > 0).toBe(true);
  });

  it('publishes the coverage before any document is drafted', async () => {
    const { chat } = scripted([submitDoc(GOOD_DRAFT)]);
    const run = new ProjectReviewRun(routedGraph(), {}, { chat });

    let coverageSeenAt = -1;
    let index = 0;
    run.onChange((state) => {
      if (coverageSeenAt === -1 && state.context) coverageSeenAt = index;
      index++;
    });
    await run.run();
    expect(coverageSeenAt).toBe(1); // assembling, then drafting-with-context
  });

  it('hands each document the summaries of the ones already drafted', async () => {
    const { chat, seen } = scripted([submitDoc(GOOD_DRAFT, 'what the app is')]);
    await new ProjectReviewRun(routedGraph(), {}, { chat }).run();

    // The third document's opening turn must mention the first two.
    const openings = seen.filter((r) => r.messages.length === 2);
    expect(openings.length).toBe(3);
    expect(String(openings[2].messages[1].content)).toContain('ALREADY DRAFTED IN THIS REVIEW');
    expect(String(openings[0].messages[1].content).indexOf('ALREADY DRAFTED')).toBe(-1);
  });

  it('drafts against the existing docs, so a re-run proposes a diff rather than a replacement', async () => {
    const { chat, seen } = scripted([submitDoc(GOOD_DRAFT)]);
    await new ProjectReviewRun(
      routedGraph(),
      { docs: { architecture: '# Architecture\n\nWritten by a human.\n' } },
      { chat, kinds: ['architecture'] }
    ).run();

    expect(String(seen[0].messages[1].content)).toContain('Written by a human.');
    expect(String(seen[0].messages[1].content)).toContain('proposing an EDIT');
  });

  it('carries a decline through as a draft with no content', async () => {
    const { chat } = scripted([prose('Nothing to record.')]);
    const state = await new ProjectReviewRun(routedGraph(), {}, { chat, kinds: ['brief'] }).run();
    expect(state.drafts[0].status).toBe('declined');
    expect(state.drafts[0].content).toBe(undefined);
  });
});

// ── Criterion 7, on real files ────────────────────────────────────────────────

/** Every file under a directory, with its bytes. The comparison criterion 7 needs. */
function snapshot(dir: string): Map<string, string> {
  const out = new Map<string, string>();
  const walk = (current: string) => {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) walk(full);
      else out.set(path.relative(dir, full).split(path.sep).join('/'), fs.readFileSync(full).toString('base64'));
    }
  };
  walk(dir);
  return out;
}

/** Save through the product's own path. */
function saveProject(project: ProjectModel, dir: string): Promise<void> {
  return new Promise((resolve, reject) => {
    project.toDirectory(dir, (result: { result: string; message?: string }) => {
      if (result.result !== 'success') reject(new Error(result.message ?? 'save failed'));
      else resolve();
    });
  });
}

describe('AIX-010 criterion 7 — rejecting every draft leaves the project byte-identical', () => {
  let dir: string;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aix010-reject-'));
    DocProposalStore.instance.clear();
  });

  afterEach(() => {
    DocProposalStore.instance.clear();
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('leaves every byte on disk untouched — including a docs/ folder that already exists', async () => {
    const project = ProjectModel.fromJSON(JSON.parse(JSON.stringify(gitRepoUtf8)));
    await saveProject(project, dir);

    // A project that already has docs is the harder case: reject must not touch
    // the human's existing prose either.
    const docs = new ProjectDocsModel(dir);
    await docs.write('docs/ARCHITECTURE.md', '# Architecture\n\nWritten by a human, and not to be lost.\n', {});

    const before = snapshot(dir);
    expect(before.has('docs/ARCHITECTURE.md')).toBe(true);
    expect(before.has('project.json')).toBe(true);

    const { chat } = scripted([submitDoc(GOOD_DRAFT, 'drafted')]);
    const state = await new ProjectReviewRun(
      fromSerialisedProject(JSON.parse(JSON.stringify(gitRepoUtf8))),
      { docs: await docs.content() },
      { chat }
    ).run();
    expect(state.drafts.some((d) => d.status === 'authored')).toBe(true);

    // Drafting alone must not have written anything.
    expect([...snapshot(dir).entries()]).toEqual([...before.entries()]);

    // Staging holds the proposals in memory — still nothing on disk.
    const staged = await stageReviewDrafts(state, docs);
    expect(staged.length > 0).toBe(true);
    expect([...snapshot(dir).entries()]).toEqual([...before.entries()]);

    // Reject every one. This is the whole of "reject": the absence of an accept.
    for (const entry of staged) DocProposalStore.instance.reject(entry.proposalId);
    expect(DocProposalStore.instance.list().length).toBe(0);

    const after = snapshot(dir);
    expect([...after.entries()]).toEqual([...before.entries()]);
    expect(after.get('docs/ARCHITECTURE.md')).toBe(before.get('docs/ARCHITECTURE.md'));

    docs.dispose();
  });

  it('proposes a diff against the file as it stands, never a blind overwrite', async () => {
    const project = ProjectModel.fromJSON(JSON.parse(JSON.stringify(gitRepoUtf8)));
    await saveProject(project, dir);

    const docs = new ProjectDocsModel(dir);
    const human = '# Architecture\n\nWritten by a human.\n';
    await docs.write('docs/ARCHITECTURE.md', human, {});

    const { chat } = scripted([submitDoc(GOOD_DRAFT)]);
    const state = await new ProjectReviewRun(
      fromSerialisedProject(JSON.parse(JSON.stringify(gitRepoUtf8))),
      { docs: await docs.content() },
      { chat, kinds: ['architecture'] }
    ).run();

    const staged = await stageReviewDrafts(state, docs);
    const proposal = DocProposalStore.instance.get(staged[0].proposalId)!;
    // The baseline is read from disk at propose time, so the diff the user sees
    // is against the real current file — not against whatever the run started
    // with. That is what makes "never overwrites blind" true rather than hoped.
    expect(proposal.baseline).toBe(human);
    expect(proposal.proposed).toBe(GOOD_DRAFT);

    docs.dispose();
  });
});
