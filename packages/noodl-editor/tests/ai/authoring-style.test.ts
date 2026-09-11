/**
 * AIX-006 — the style vocabulary in the authoring loop.
 *
 * Fully offline. Three things under test: the vocabulary export/shape, the
 * candidate style lint, and the loop wiring — the vocabulary rides in the
 * opening message, and a valid-but-raw-styled candidate earns one advisory
 * style pass that never downgrades a valid authoring to a failure.
 */

import {
  AuthoringSession,
  countStyleValues,
  formatStyleFindings,
  styleLintCandidate,
  type ComponentFiles
} from '../../src/editor/src/models/AiAssistant/authoring';
import { buildCandidate } from '../../src/editor/src/models/AiAssistant/authoring/candidate';
import { fromSerialisedProject } from '../../src/editor/src/models/AiAssistant/explain/graph';
import type { AiChatRequest, AiChatResponse, AiToolCall } from '../../src/editor/src/models/AiAssistant/client/types';
import {
  buildStyleVocabulary,
  renderStyleVocabulary,
  vocabularyTokenNames
} from '../../src/editor/src/models/StyleTokensModel/StyleVocabulary';

/* eslint-disable @typescript-eslint/no-var-requires */
const gitRepoUtf8 = require('../testfs/git-repo-utf8/project.json');
/* eslint-enable @typescript-eslint/no-var-requires */

const GRAPH = fromSerialisedProject(gitRepoUtf8);

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

function call(name: string, args: Record<string, unknown>, id = `c-${Math.random().toString(36).slice(2, 8)}`): AiToolCall {
  return { id, name, arguments: args };
}

/**
 * A valid component (Component Inputs/Outputs + wire) with a styled Group.
 *
 * 🔴 The three raw colours are `backgroundColor` / `borderColor` /
 * `borderTopColor`, and the third one is load-bearing. It used to be `color`,
 * which is NOT a `Group` input port — a Group is a container, text colour
 * belongs to Text — so `unknown-parameter` blocked the authored output and the
 * loop burned its turns resubmitting a candidate it would reject again, ending
 * `exhausted`. The specs below then read `error`/`exhausted` where they expect
 * `authored`. The blocking is correct: a parameter nothing reads should not
 * ship, and `isBlockingForAuthoredOutput` says so deliberately.
 *
 * Whatever replaces it has to satisfy BOTH sides or these specs go green while
 * measuring nothing: a real `Group` port (or validation rejects) AND a member of
 * `COLOR_PROPERTIES` in `StyleAnalyzerCore.ts` (or the style lint never fires
 * and the advisory turn these specs are about never happens). Measured: the four
 * per-side `border*Color` ports satisfy both; `outlineColor`, `shadowColor` and
 * `caretColor` are in `COLOR_PROPERTIES` but are NOT Group ports, and
 * `boxShadowColor` is a Group port but is NOT in `COLOR_PROPERTIES`.
 *
 * Every `componentPath` in this file is `Pages/Styled…`, so the candidate is a
 * routed page and needs a `Page` root — `page-without-page-node` blocks authored
 * output since AAQ-011 F7. The Group is the subject of the style lint and keeps
 * its parameters exactly; it simply hangs off the page now, which is where a
 * page's content actually lives.
 */
function submitArgs(groupParams: Record<string, unknown>): Record<string, unknown> {
  return {
    nodes: [
      { id: 'page', type: 'Page', parameters: { title: 'Styled', urlPath: '/styled' } },
      { id: 'in', type: 'Component Inputs', ports: [{ name: 'Trigger', plug: 'output', type: '*' }] },
      { id: 'out', type: 'Component Outputs', ports: [{ name: 'Done', plug: 'input', type: '*' }] },
      { id: 'g', type: 'Group', parent: 'page', parameters: groupParams }
    ],
    connections: [{ fromId: 'in', fromProperty: 'Trigger', toId: 'out', toProperty: 'Done' }],
    description: 'A styled group.'
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

function filesFor(groupParams: Record<string, unknown>): ComponentFiles {
  const result = buildCandidate(
    { description: 'x', componentPath: 'Pages/Styled' },
    submitArgs(groupParams) as never
  );
  if (!result.files) throw new Error('candidate build failed: ' + result.errors.join(', '));
  return result.files;
}

describe('AIX-006 style vocabulary', () => {
  it('exports tokens by category, element variants/sizes, and presets', () => {
    const vocab = buildStyleVocabulary();
    const semantic = vocab.categories.find((c) => c.category === 'color-semantic');
    expect(semantic).toBeDefined();
    const names = vocabularyTokenNames(vocab);
    expect(names.has('--primary')).toBe(true);
    expect(names.has('--space-4')).toBe(true);

    const button = vocab.elements.find((e) => e.nodeType === 'net.noodl.controls.button');
    expect(button).toBeDefined();
    expect(button!.variants).toContain('primary');
    expect(button!.sizes).toContain('md');
    // The primary variant carries token-referenced styles the agent can copy.
    expect(JSON.stringify(button!.variantStyles.primary)).toContain('var(--primary)');

    expect(vocab.presets.map((p) => p.id)).toEqual(
      jasmine.arrayContaining(['modern', 'minimal', 'playful', 'enterprise', 'soft'])
    );
  });

  it('renders a compact prompt block that instructs var(--token) emission', () => {
    const block = renderStyleVocabulary(buildStyleVocabulary());
    expect(block).toContain('var(--name)');
    expect(block).toContain('--primary');
    expect(block).toContain('net.noodl.controls.button');
  });

  it('lints raw values on a candidate and stays silent on token references', () => {
    // Three raw overrides on one Group → a variant candidate finding, and the
    // DEF-001 moved --primary/--ring off #3b82f6, so this hex is now simply a raw value with no
    // matching token — which is all this case needs it to be: the lint is about rawness.
    const raw = styleLintCandidate(
      filesFor({ backgroundColor: '#3b82f6', color: '#ffffff', borderColor: '#3b82f6' })
    );
    expect(raw.findings.length).toBeGreaterThan(0);
    expect(raw.findings.join('\n').toLowerCase()).toContain('raw');

    const onSystem = styleLintCandidate(
      filesFor({ backgroundColor: 'var(--primary)', color: 'var(--primary-foreground)' })
    );
    expect(onSystem.findings).toEqual([]);
  });

  it('counts raw vs token-referenced style values', () => {
    const stats = countStyleValues(filesFor({ backgroundColor: '#3b82f6', color: 'var(--primary-foreground)' }));
    expect(stats.rawValues).toBe(1);
    expect(stats.tokenReferences).toBe(1);
    expect(stats.total).toBe(2);
  });

  it('formatStyleFindings phrases findings for emission', () => {
    const lines = formatStyleFindings({
      repeatedColors: [
        { value: '#3b82f6', count: 4, elements: [], matchingToken: '--primary', suggestedTokenName: '--color-3b82f6' }
      ],
      repeatedSpacing: [],
      variantCandidates: []
    });
    expect(lines[0]).toContain('var(--primary)');
  });

  it('injects the vocabulary into the opening message only when guidance is on', async () => {
    const withGuidance = scriptedChat([() => respond({ toolCalls: [call('submit_component', submitArgs({ backgroundColor: 'var(--primary)' }))] })]);
    const s1 = AuthoringSession.create(GRAPH, { description: 'a styled page', componentPath: 'Pages/StyledA' }, { chat: withGuidance.chat });
    await s1.run();
    const opening1 = withGuidance.requests[0].messages.find((m) => m.role === 'user')!.content;
    expect(opening1).toContain('--- STYLE VOCABULARY ---');
    expect(opening1).toContain('var(--');

    const noGuidance = scriptedChat([() => respond({ toolCalls: [call('submit_component', submitArgs({ backgroundColor: 'var(--primary)' }))] })]);
    const s2 = AuthoringSession.create(
      GRAPH,
      { description: 'a styled page', componentPath: 'Pages/StyledB' },
      { chat: noGuidance.chat, styleGuidance: false }
    );
    await s2.run();
    const opening2 = noGuidance.requests[0].messages.find((m) => m.role === 'user')!.content;
    expect(opening2).not.toContain('--- STYLE VOCABULARY ---');
  });

  it('offers one advisory style pass on a valid-but-raw candidate, then accepts the on-system resubmit', async () => {
    const { chat, requests } = scriptedChat([
      // Turn 1: valid, but raw colours on the Group.
      () => respond({ toolCalls: [call('submit_component', submitArgs({ backgroundColor: '#3b82f6', borderTopColor: '#ffffff', borderColor: '#3b82f6' }))] }),
      // Turn 2: the loop should have fed back a STYLE advisory — resubmit on-system.
      (request) => {
        const last = request.messages[request.messages.length - 1];
        expect(last.role).toBe('tool');
        expect(last.content).toContain('STYLE LINT');
        expect(last.content).toContain('var(--');
        return respond({ toolCalls: [call('submit_component', submitArgs({ backgroundColor: 'var(--primary)', borderTopColor: 'var(--primary-foreground)' }))] });
      }
    ]);
    const session = AuthoringSession.create(GRAPH, { description: 'a styled page', componentPath: 'Pages/StyledC' }, { chat });
    const outcome = await session.run();
    expect(outcome.status).toBe('authored');
    // Two submissions happened: the raw one and the on-system one.
    expect(outcome.rounds.length).toBe(2);
    expect(requests.length).toBe(2);
    // The accepted files are the on-system resubmit.
    const stats = countStyleValues(outcome.files!);
    expect(stats.rawValues).toBe(0);
    expect(stats.tokenReferences).toBeGreaterThan(0);
  });

  it('a style suggestion never downgrades a valid authoring: agent ignores it, still authored', async () => {
    const { chat } = scriptedChat([
      // Valid but raw.
      () => respond({ toolCalls: [call('submit_component', submitArgs({ backgroundColor: '#3b82f6', borderTopColor: '#ffffff', borderColor: '#3b82f6' }))] }),
      // Model declines to restyle — replies with prose / no tool call.
      () => respond({ text: 'The colours are intentional.' })
    ]);
    const session = AuthoringSession.create(GRAPH, { description: 'a styled page', componentPath: 'Pages/StyledD' }, { chat });
    const outcome = await session.run();
    expect(outcome.status).toBe('authored');
    // Falls back to the pre-style-pass candidate (the raw one).
    expect(outcome.files).toBeDefined();
  });

  it('AIB-009 F11: a provider that stalls during the style pass never costs the accepted candidate', async () => {
    // Same rule as the spec above, against the failure mode F11 describes: the
    // advisory turn is the one most likely to be waiting on a provider that has
    // stopped answering, because it is the extra one nobody asked for. Before
    // the deadline this hung; the first fix for the deadline then reported it as
    // an *error* and threw the accepted component away, which is worse than
    // hanging — the user paid for it and it passed the gate.
    let turns = 0;
    const chat = (): Promise<AiChatResponse> => {
      turns++;
      if (turns === 1) {
        return Promise.resolve(
          respond({
            toolCalls: [
              call('submit_component', submitArgs({ backgroundColor: '#3b82f6', borderTopColor: '#ffffff', borderColor: '#3b82f6' }))
            ]
          })
        );
      }
      return new Promise(() => undefined);
    };
    const session = AuthoringSession.create(
      GRAPH,
      { description: 'a styled page', componentPath: 'Pages/StyledStall' },
      { chat, stallMs: 40 }
    );
    const outcome = await session.run();

    expect(turns).toBe(2);
    expect(outcome.status).toBe('authored');
    expect(outcome.files).toBeDefined();
    expect(session.stagedFiles).toBeDefined();
  });

  it('with guidance off, a raw candidate is accepted immediately with no style pass', async () => {
    const { chat, requests } = scriptedChat([
      () => respond({ toolCalls: [call('submit_component', submitArgs({ backgroundColor: '#3b82f6', borderTopColor: '#ffffff', borderColor: '#3b82f6' }))] })
    ]);
    const session = AuthoringSession.create(
      GRAPH,
      { description: 'a styled page', componentPath: 'Pages/StyledE' },
      { chat, styleGuidance: false }
    );
    const outcome = await session.run();
    expect(outcome.status).toBe('authored');
    expect(requests.length).toBe(1); // no second turn — no advisory
  });
});
