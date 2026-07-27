/**
 * AIX-009 — project context documents.
 *
 * Four things are worth pinning down offline, because a live provider run
 * proves them only for whatever prompt happened to run:
 *
 *  - the *text transforms* — capping at a heading boundary, and the truncation
 *    being stated in the injected bytes rather than dropped silently,
 *  - the *containment* rules on doc paths, which are the whole of what keeps a
 *    write tool inside `docs/`,
 *  - the *charging* — `project-conventions` and `project-brief` appear in the
 *    context log with real character counts (acceptance criterion 3),
 *  - the *ordering* the AIX-007 cache depends on: doc blocks land in the
 *    cache-stable half, ahead of `cacheBoundary` (criterion 4's offline half —
 *    whether the cache is actually hit is a live question the harness asserts).
 *
 * Plus the model's disk behaviour, including the one thing criterion 7 is
 * about: an external edit does not get clobbered.
 */

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import {
  AUTHORING_TOOLS,
  AuthoringSession,
  dispatchProjectDocTool,
  GET_PROJECT_DOC,
  initialUserMessage,
  projectDocTools,
  systemPrompt,
  updateUserMessage
} from '../../src/editor/src/models/AiAssistant/authoring';
import { AuthoringContextBuilder } from '../../src/editor/src/models/AiAssistant/authoring/ContextBuilder';
import type { AiChatRequest, AiChatResponse } from '../../src/editor/src/models/AiAssistant/client/types';
import { fromSerialisedProject } from '../../src/editor/src/models/AiAssistant/explain/graph';
import {
  assertInsideDocs,
  DOC_CAPS,
  DocPathError,
  KNOWN_DOCS,
  normalizeDocPath,
  renderDocForPrompt,
  truncateDoc
} from '../../src/editor/src/models/ProjectDocs/docsText';
import {
  currentProjectDocs,
  setProjectDocsProvider
} from '../../src/editor/src/models/ProjectDocs/currentDocs';
import { DocsConflictError, ProjectDocsModel } from '../../src/editor/src/models/ProjectDocs/ProjectDocsModel';
import { DocProposalStore, proposeDocChange } from '../../src/editor/src/models/ProjectDocs/DocProposals';
import { UndoQueue } from '../../src/editor/src/models/undo-queue-model';

/* eslint-disable @typescript-eslint/no-var-requires */
const gitRepoUtf8 = require('../testfs/git-repo-utf8/project.json');
/* eslint-enable @typescript-eslint/no-var-requires */

const GRAPH = fromSerialisedProject(gitRepoUtf8);
const REQUEST = { description: 'A card list.', componentPath: 'Pages/Cards' };

const CONVENTIONS = '# Conventions\n\n- Every page root is a Group named `Page Root`.\n';
const BRIEF = '# Brief\n\nA reading list for one household.\n';
const ARCHITECTURE = '# Architecture\n\n## Data model\n\nOne Books collection.\n';

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

/** Capture the first request the session sends, then stop the loop. */
function capturingChat(): { chat: (request: AiChatRequest) => Promise<AiChatResponse>; requests: AiChatRequest[] } {
  const requests: AiChatRequest[] = [];
  return {
    requests,
    chat: async (request) => {
      requests.push(request);
      return respond({ text: 'I will stop here.' });
    }
  };
}

// ── The text transforms ───────────────────────────────────────────────────────

describe('AIX-009 doc text', () => {
  it('leaves a doc inside its cap byte-identical', () => {
    const result = truncateDoc(CONVENTIONS, 4_000);
    expect(result.truncated).toBe(false);
    expect(result.text).toBe(CONVENTIONS);
  });

  it('cuts an oversized doc at a heading boundary, not mid-sentence', () => {
    const doc = ['# Conventions', '', 'A'.repeat(300), '', '## Naming', '', 'B'.repeat(300)].join('\n');
    const result = truncateDoc(doc, 340);
    expect(result.truncated).toBe(true);
    // The cut landed on the '## Naming' heading, so no half-rule survives.
    expect(result.text.endsWith('A'.repeat(300))).toBe(true);
    expect(result.text).not.toContain('## Naming');
  });

  it('falls back to a blank line, then to the cap, when no heading fits', () => {
    const noHeadings = ['A'.repeat(100), '', 'B'.repeat(500)].join('\n');
    const atBlank = truncateDoc(noHeadings, 300);
    expect(atBlank.truncated).toBe(true);
    expect(atBlank.text).toBe('A'.repeat(100));

    const unbroken = 'C'.repeat(500);
    const hard = truncateDoc(unbroken, 300);
    expect(hard.text.length).toBe(300);
  });

  it('states the truncation inside the injected text, and names the file', () => {
    const conventions = KNOWN_DOCS.find((d) => d.kind === 'conventions')!;
    const huge = ['# Conventions', '', 'X'.repeat(DOC_CAPS.conventions + 500)].join('\n');
    const rendered = renderDocForPrompt(conventions, huge);
    // Silently dropping half a rulebook is the failure this format exists to
    // avoid — the model must be told, and told what file to ask about.
    expect(rendered).toContain('[TRUNCATED');
    expect(rendered).toContain('docs/CONVENTIONS.md');
    expect(rendered).toContain('truncated');
  });
});

describe('AIX-009 doc path containment', () => {
  it('accepts the four known shapes and normalises them', () => {
    expect(assertInsideDocs('docs/BRIEF.md')).toBe('docs/BRIEF.md');
    expect(assertInsideDocs('BRIEF.md')).toBe('docs/BRIEF.md');
    expect(assertInsideDocs('./docs/BRIEF.md')).toBe('docs/BRIEF.md');
    expect(assertInsideDocs('docs\\decisions\\a.md')).toBe('docs/decisions/a.md');
    expect(normalizeDocPath('decisions/a.md')).toBe('docs/decisions/a.md');
  });

  it('refuses anything that escapes docs/, rather than rewriting it', () => {
    for (const bad of ['../project.json', 'docs/../project.json', '/etc/passwd.md', 'docs/../../x.md']) {
      expect(() => assertInsideDocs(bad)).toThrowError(DocPathError);
    }
  });

  it('refuses a non-markdown target', () => {
    expect(() => assertInsideDocs('docs/config.json')).toThrowError(DocPathError);
  });
});

// ── Charging (criterion 3) ────────────────────────────────────────────────────

describe('AIX-009 context charging', () => {
  it('charges conventions and brief with real character counts', () => {
    const context = new AuthoringContextBuilder(GRAPH, {}, undefined, undefined, {
      conventions: CONVENTIONS,
      brief: BRIEF
    });
    const conventions = context.projectConventions();
    const brief = context.projectBrief();

    expect(conventions).toBe(CONVENTIONS);
    expect(brief).toBe(BRIEF);
    const log = context.log;
    expect(log.find((e) => e.source === 'project-conventions')?.chars).toBe(CONVENTIONS.length);
    expect(log.find((e) => e.source === 'project-brief')?.chars).toBe(BRIEF.length);
  });

  it('returns nothing at all for a project with no docs, so no empty block is emitted', () => {
    const context = new AuthoringContextBuilder(GRAPH, {}, undefined, undefined, {});
    expect(context.projectConventions()).toBeUndefined();
    expect(context.projectBrief()).toBeUndefined();
    expect(context.log.length).toBe(0);
  });

  it('treats a whitespace-only doc as absent', () => {
    const context = new AuthoringContextBuilder(GRAPH, {}, undefined, undefined, { conventions: '   \n\n' });
    expect(context.projectConventions()).toBeUndefined();
  });

  it('caps an oversized CONVENTIONS.md and charges the capped length', () => {
    const huge = ['# Conventions', '', 'X'.repeat(DOC_CAPS.conventions + 5_000)].join('\n');
    const context = new AuthoringContextBuilder(GRAPH, {}, undefined, undefined, { conventions: huge });
    const injected = context.projectConventions()!;
    expect(injected.length).toBeLessThan(huge.length);
    expect(injected).toContain('[TRUNCATED');
    expect(context.log.find((e) => e.source === 'project-conventions')?.chars).toBe(injected.length);
  });

  it('charges the pull-only architecture read under its own source', () => {
    const context = new AuthoringContextBuilder(GRAPH, {}, undefined, undefined, { architecture: ARCHITECTURE });
    expect(context.projectArchitecture()).toBe(ARCHITECTURE);
    expect(context.log.find((e) => e.source === 'project-doc:ARCHITECTURE.md')?.chars).toBe(ARCHITECTURE.length);
  });

  it('answers the pull tool honestly when there is no architecture doc', () => {
    const context = new AuthoringContextBuilder(GRAPH, {}, undefined, undefined, {});
    expect(context.projectArchitecture()).toContain('no docs/ARCHITECTURE.md');
  });
});

// ── Ordering (criterion 4, offline half) ──────────────────────────────────────

describe('AIX-009 prompt ordering', () => {
  const docs = { conventions: CONVENTIONS, brief: BRIEF };

  it('puts both doc blocks in the cache-stable half, ahead of the task', () => {
    const turn = initialUserMessage(REQUEST, 'overview', 'catalog', undefined, docs);
    const stable = turn.content.slice(0, turn.cacheBoundary);
    const variable = turn.content.slice(turn.cacheBoundary);

    expect(stable).toContain('--- PROJECT CONVENTIONS ---');
    expect(stable).toContain('--- PROJECT BRIEF ---');
    expect(stable).toContain('Page Root');
    // The task — the part that varies per request — stays last.
    expect(variable).toContain('--- YOUR TASK ---');
    expect(variable).not.toContain('PROJECT CONVENTIONS');
  });

  it('does the same in update mode, where the component source is the varying part', () => {
    const turn = updateUserMessage(REQUEST, '{"nodes":[]}', 'overview', 'catalog', undefined, docs);
    const stable = turn.content.slice(0, turn.cacheBoundary);
    expect(stable).toContain('--- PROJECT CONVENTIONS ---');
    expect(stable).not.toContain('--- CURRENT COMPONENT ---');
    expect(turn.content.slice(turn.cacheBoundary)).toContain('--- CURRENT COMPONENT ---');
  });

  it('leaves the turn free of doc markers when the project has no docs', () => {
    const without = initialUserMessage(REQUEST, 'overview', 'catalog');
    expect(without.content).not.toContain('PROJECT CONVENTIONS');
    expect(without.content).not.toContain('PROJECT BRIEF');
    // …and byte-identical to passing an empty docs object, so the pre-AIX-009
    // cache prefix of an undocumented project is untouched.
    expect(initialUserMessage(REQUEST, 'overview', 'catalog', undefined, {}).content).toBe(without.content);
  });

  it('appends docs after the existing blocks, so a project gaining docs keeps its prefix head', () => {
    const before = initialUserMessage(REQUEST, 'overview', 'catalog', 'STYLE');
    const after = initialUserMessage(REQUEST, 'overview', 'catalog', 'STYLE', docs);
    const sharedHead = before.content.slice(0, before.cacheBoundary - 2);
    expect(after.content.startsWith(sharedHead)).toBe(true);
  });

  it('tells the system prompt that project rules outrank its defaults, and must be reported when unmet', () => {
    const prompt = systemPrompt('create');
    expect(prompt).toContain('PROJECT CONVENTIONS');
    expect(prompt).toContain('OUTRANK');
    expect(prompt).toContain('REPORTED');
    // The section is unconditional and phrased conditionally, so the system
    // prompt is byte-identical across projects — it is the first cached block.
    expect(systemPrompt('create')).toBe(prompt);
  });
});

// ── The pull-only tool ────────────────────────────────────────────────────────

describe('AIX-009 get_project_doc', () => {
  it('is not offered when the project has no ARCHITECTURE.md', () => {
    expect(projectDocTools({})).toEqual([]);
    expect(projectDocTools({ conventions: CONVENTIONS })).toEqual([]);
    expect(projectDocTools({ architecture: '   ' })).toEqual([]);
  });

  it('is offered, once, when there is one', () => {
    const tools = projectDocTools({ architecture: ARCHITECTURE });
    expect(tools.length).toBe(1);
    expect(tools[0].name).toBe(GET_PROJECT_DOC);
  });

  it('dispatches only its own calls, so the read dispatcher still owns the rest', () => {
    const context = new AuthoringContextBuilder(GRAPH, {}, undefined, undefined, { architecture: ARCHITECTURE });
    expect(dispatchProjectDocTool({ id: '1', name: 'get_node_types', arguments: {} }, context)).toBeUndefined();
    expect(
      dispatchProjectDocTool({ id: '2', name: GET_PROJECT_DOC, arguments: { path: 'ARCHITECTURE.md' } }, context)
    ).toBe(ARCHITECTURE);
    expect(
      dispatchProjectDocTool({ id: '3', name: GET_PROJECT_DOC, arguments: { path: 'docs/ARCHITECTURE.md' } }, context)
    ).toBe(ARCHITECTURE);
  });

  it('refuses a doc it does not serve rather than guessing', () => {
    const context = new AuthoringContextBuilder(GRAPH, {}, undefined, undefined, { architecture: ARCHITECTURE });
    const result = dispatchProjectDocTool(
      { id: '4', name: GET_PROJECT_DOC, arguments: { path: 'docs/SECRETS.md' } },
      context
    );
    expect(result).toContain('can only read');
  });
});

// ── Session wiring ────────────────────────────────────────────────────────────

describe('AIX-009 session wiring', () => {
  afterEach(() => setProjectDocsProvider(null));

  it('sends the project tool list unchanged when the project has no docs', async () => {
    const { chat, requests } = capturingChat();
    const session = AuthoringSession.create(GRAPH, REQUEST, { chat, projectDocs: {} });
    await session.run();
    expect(requests[0].tools).toBe(AUTHORING_TOOLS);
  });

  it('appends get_project_doc when the project has an architecture doc', async () => {
    const { chat, requests } = capturingChat();
    const session = AuthoringSession.create(GRAPH, REQUEST, {
      chat,
      projectDocs: { architecture: ARCHITECTURE }
    });
    await session.run();
    expect(requests[0].tools!.map((t) => t.name)).toContain(GET_PROJECT_DOC);
    expect(requests[0].tools!.length).toBe(AUTHORING_TOOLS.length + 1);
  });

  it('injects the conventions into the opening turn and logs the charge', async () => {
    const { chat, requests } = capturingChat();
    const session = AuthoringSession.create(GRAPH, REQUEST, {
      chat,
      projectDocs: { conventions: CONVENTIONS, brief: BRIEF }
    });
    const outcome = await session.run();

    const opening = requests[0].messages.find((m) => m.role === 'user')!;
    expect(opening.content).toContain('Page Root');
    expect(opening.content.slice(0, opening.cacheBoundary)).toContain('--- PROJECT CONVENTIONS ---');
    expect(outcome.metrics.contextLog.map((e) => e.source)).toEqual(
      jasmine.arrayContaining(['project-conventions', 'project-brief'])
    );
  });

  it('falls back to the installed provider, so no panel wiring is required', async () => {
    setProjectDocsProvider(() => ({ conventions: CONVENTIONS }));
    expect(currentProjectDocs().conventions).toBe(CONVENTIONS);

    const { chat, requests } = capturingChat();
    await AuthoringSession.create(GRAPH, REQUEST, { chat }).run();
    expect(requests[0].messages.find((m) => m.role === 'user')!.content).toContain('Page Root');
  });

  it('survives a provider that throws — a broken docs read must not stop a build', async () => {
    setProjectDocsProvider(() => {
      throw new Error('disk on fire');
    });
    expect(currentProjectDocs()).toEqual({});
  });
});

// ── The model on disk (criterion 7) ───────────────────────────────────────────

describe('AIX-009 ProjectDocsModel', () => {
  let dir: string;
  let docs: ProjectDocsModel;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aix009-docs-'));
    docs = new ProjectDocsModel(dir);
  });

  afterEach(() => {
    docs.dispose();
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('reports no docs until CONVENTIONS.md exists', async () => {
    expect(docs.hasDocs()).toBe(false);
    await docs.write('docs/BRIEF.md', BRIEF, {});
    expect(docs.hasDocs()).toBe(false);
    await docs.write('docs/CONVENTIONS.md', CONVENTIONS, {});
    expect(docs.hasDocs()).toBe(true);
  });

  it('seeds three files and never overwrites on a second call', async () => {
    const created = await docs.seed();
    expect(created.sort()).toEqual(['docs/ARCHITECTURE.md', 'docs/BRIEF.md', 'docs/CONVENTIONS.md']);
    await docs.write('docs/BRIEF.md', 'MINE', {});
    expect(await docs.seed()).toEqual([]);
    expect(await docs.read('docs/BRIEF.md')).toBe('MINE');
  });

  it('lists known files that are missing as well as extra markdown', async () => {
    await docs.write('docs/CONVENTIONS.md', CONVENTIONS, {});
    await docs.write('docs/decisions/0001-why.md', '# Why\n', {});
    fs.writeFileSync(path.join(dir, 'docs', 'notes.txt'), 'ignored');

    const list = await docs.list();
    const byPath = new Map(list.map((e) => [e.path, e]));
    expect(byPath.get('docs/CONVENTIONS.md')!.exists).toBe(true);
    expect(byPath.get('docs/BRIEF.md')!.exists).toBe(false);
    expect(byPath.get('docs/decisions/0001-why.md')!.exists).toBe(true);
    expect(byPath.has('docs/notes.txt')).toBe(false);
    // Known docs lead the list, so the panel does not sort them into the tail.
    expect(list[0].path).toBe('docs/CONVENTIONS.md');
  });

  it('refuses a write whose baseline no longer matches disk — criterion 7', async () => {
    await docs.write('docs/BRIEF.md', BRIEF, {});
    const seen = await docs.read('docs/BRIEF.md');

    // The user edits the file in VS Code while the panel holds `seen`.
    fs.writeFileSync(path.join(dir, 'docs', 'BRIEF.md'), 'EXTERNAL EDIT', 'utf8');

    let threw: unknown;
    try {
      await docs.write('docs/BRIEF.md', 'PANEL BUFFER', { baseline: seen });
    } catch (error) {
      threw = error;
    }
    expect(threw instanceof DocsConflictError).toBe(true);
    // The external edit is intact — this is the whole criterion.
    expect(fs.readFileSync(path.join(dir, 'docs', 'BRIEF.md'), 'utf8')).toBe('EXTERNAL EDIT');
  });

  it('accepts a write whose baseline still matches, including creating a new file', async () => {
    await docs.write('docs/BRIEF.md', 'v1', { baseline: null });
    await docs.write('docs/BRIEF.md', 'v2', { baseline: 'v1' });
    expect(await docs.read('docs/BRIEF.md')).toBe('v2');
  });

  it('notices an external edit on refresh and says which file changed', async () => {
    await docs.write('docs/BRIEF.md', BRIEF, {});
    await docs.read('docs/BRIEF.md');

    const events: string[][] = [];
    docs.on('docsChanged', (payload: { paths: string[] }) => events.push(payload.paths));

    expect(await docs.refresh()).toEqual([]);
    fs.writeFileSync(path.join(dir, 'docs', 'BRIEF.md'), 'EXTERNAL', 'utf8');
    expect(await docs.refresh()).toEqual(['docs/BRIEF.md']);
    expect(events).toEqual([['docs/BRIEF.md']]);
    expect(docs.cached('docs/BRIEF.md')).toBe('EXTERNAL');
  });

  it('leaves no temp files behind, and refuses paths outside docs/', async () => {
    await docs.write('docs/BRIEF.md', BRIEF, {});
    expect(fs.readdirSync(path.join(dir, 'docs'))).toEqual(['BRIEF.md']);
    await expectAsync(docs.write('../escape.md', 'x', {})).toBeRejected();
    expect(fs.existsSync(path.join(dir, '..', 'escape.md'))).toBe(false);
  });

  it('reads the three injectable bodies as absent fields when the files are absent', async () => {
    expect(await docs.content()).toEqual({});
    await docs.write('docs/CONVENTIONS.md', CONVENTIONS, {});
    expect(await docs.content()).toEqual({ conventions: CONVENTIONS });
  });
});

// ── Reviewed doc writes (criterion 6) ─────────────────────────────────────────

describe('AIX-009 doc proposals', () => {
  let dir: string;
  let docs: ProjectDocsModel;

  beforeEach(async () => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aix009-proposals-'));
    docs = new ProjectDocsModel(dir);
    DocProposalStore.instance.clear();
    UndoQueue.instance.clear();
    await docs.write('docs/ARCHITECTURE.md', ARCHITECTURE, {});
  });

  afterEach(() => {
    DocProposalStore.instance.clear();
    UndoQueue.instance.clear();
    docs.dispose();
    fs.rmSync(dir, { recursive: true, force: true });
  });

  const read = () => fs.readFileSync(path.join(dir, 'docs', 'ARCHITECTURE.md'), 'utf8');

  it('proposing touches nothing on disk', async () => {
    await proposeDocChange(docs, {
      path: 'docs/ARCHITECTURE.md',
      proposed: '# Architecture\n\nRewritten.\n',
      source: 'test'
    });
    expect(read()).toBe(ARCHITECTURE);
    expect(DocProposalStore.instance.list().length).toBe(1);
  });

  it('rejecting leaves the file byte-identical', async () => {
    const before = read();
    const proposal = await proposeDocChange(docs, {
      path: 'docs/ARCHITECTURE.md',
      proposed: 'Rewritten.',
      source: 'test'
    });
    DocProposalStore.instance.reject(proposal.id);
    expect(read()).toBe(before);
    expect(DocProposalStore.instance.list()).toEqual([]);
  });

  it('accepting applies it and is one undo step', async () => {
    const proposal = await proposeDocChange(docs, {
      path: 'docs/ARCHITECTURE.md',
      proposed: '# Architecture\n\nRewritten.\n',
      source: 'test'
    });
    await DocProposalStore.instance.accept(proposal.id, docs);
    expect(read()).toContain('Rewritten');
    expect(DocProposalStore.instance.list()).toEqual([]);

    const undone = UndoQueue.instance.undo();
    expect(undone).toBeDefined();
    // The undo action writes asynchronously; give it the microtask + IO turn.
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(read()).toBe(ARCHITECTURE);
  });

  it('refuses to apply over an external edit, and keeps the proposal pending', async () => {
    const proposal = await proposeDocChange(docs, {
      path: 'docs/ARCHITECTURE.md',
      proposed: 'Rewritten.',
      source: 'test'
    });
    fs.writeFileSync(path.join(dir, 'docs', 'ARCHITECTURE.md'), 'EXTERNAL', 'utf8');

    let threw: unknown;
    try {
      await DocProposalStore.instance.accept(proposal.id, docs);
    } catch (error) {
      threw = error;
    }
    expect(threw instanceof DocsConflictError).toBe(true);
    expect(read()).toBe('EXTERNAL');
    expect(DocProposalStore.instance.list().length).toBe(1);
  });

  it('keeps one pending proposal per file, so no stack of stale diffs accrues', async () => {
    await proposeDocChange(docs, { path: 'docs/ARCHITECTURE.md', proposed: 'v1', source: 'test' });
    await proposeDocChange(docs, { path: 'docs/ARCHITECTURE.md', proposed: 'v2', source: 'test' });
    expect(DocProposalStore.instance.list().length).toBe(1);
    expect(DocProposalStore.instance.list()[0].proposed).toBe('v2');
  });
});
