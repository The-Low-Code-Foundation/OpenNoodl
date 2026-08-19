/**
 * NAT-007 — what a thread actually DRAWS, graded by walking its element tree.
 *
 * ## 🔴 Why this is not source analysis
 *
 * Three of this task's criteria are claims about drawing, and two of them are claims about
 * drawing *nothing*: D15 draws nothing, an unrenderable block draws a marker and not its content,
 * and an offline thread does not draw as an unanswered one. A spec that matched strings in the
 * `.tsx` cannot tell a component that drew nothing from one that was never called — which is
 * exactly the distinction. `../support/renderElements.ts` calls the component and walks what came
 * back, so both arms of every absence below come out of **one call with one field different**.
 *
 * ⚠️ What this cannot see: effects, layout, paint, legibility. A green run here does not close a
 * looking-shaped question — that is NAT-001's PAIRS table and a person opening the editor.
 *
 * @module noodl-editor/tests-unit/nat-007/thread-render
 */
import React from 'react';

import { readFileSync } from 'fs';
import { join } from 'path';

import {
  CommunityThreadView,
  type CommunityPostView,
  type CommunityThreadDetailView,
  type CommunityThreadState
} from '@noodl-core-ui/components/community';
import {
  CommunityTab,
  type CommunityMirrorView,
  type LauncherCommunityHostState
} from '@noodl-core-ui/preview/launcher/Launcher/views/Community';

import { byClass, render, stripComments, text, walk } from '../support/renderElements';

const SRC = join(__dirname, '../../src/editor/src');

const noop = () => undefined;

function post(over: Partial<CommunityPostView> = {}): CommunityPostView {
  return {
    id: 'p1',
    author: '@rosborne',
    when: '3 days ago',
    accepted: false,
    blocks: [{ kind: 'paragraph', inlines: [{ kind: 'text', text: 'The repeater draws one row.' }] }],
    attachments: [],
    ...over
  };
}

function detail(over: Partial<CommunityThreadDetailView> = {}): CommunityThreadDetailView {
  return {
    title: 'Why does my For Each render one row?',
    meta: '@rosborne · 3 days ago · answered in 41 min',
    question: post(),
    answers: [post({ id: 'p2', author: '@ada', when: '2 days ago' })],
    answersLine: '1 answer',
    ...over
  };
}

function draw(state: CommunityThreadState) {
  return render(<CommunityThreadView state={state} onBack={noop} onRetry={noop} />);
}

describe('AC2 — every post, in order, with who and when', () => {
  const tree = draw({
    state: 'ready',
    cachedSince: null,
    thread: detail({
      answers: [
        post({ id: 'p2', author: '@ada', when: '2 days ago', accepted: true }),
        post({ id: 'p3', author: '@grace', when: '1 hour ago' })
      ],
      answersLine: '2 answers'
    })
  });

  it('draws the question and every answer', () => {
    expect(byClass(tree, 'Post')).toHaveLength(3);
  });

  it('keeps them in the order they were given', () => {
    expect(byClass(tree, 'PostAuthor').map((n) => n.ownText)).toEqual(['@rosborne', '@ada', '@grace']);
    expect(byClass(tree, 'PostWhen').map((n) => n.ownText)).toEqual(['3 days ago', '2 days ago', '1 hour ago']);
  });

  it('marks the accepted answer with a WORD, not only a colour', () => {
    // 1.4.1 — an accepted answer distinguished by a green rule alone is not distinguished for
    // everybody. The rule is the second signal, not the only one.
    expect(byClass(tree, 'PostAccepted').map((n) => n.ownText)).toEqual(['Accepted answer']);
    expect(byClass(tree, 'is-accepted')).toHaveLength(1);
  });

  it('draws the whole conversation, not the opening question', () => {
    expect(text(tree)).toContain('2 answers');
    expect(byClass(tree, 'Post')).toHaveLength(3);
  });
});

describe('AC3 — a block this editor cannot draw', () => {
  const tree = draw({
    state: 'ready',
    cachedSince: null,
    thread: detail({
      question: post({
        blocks: [
          { kind: 'paragraph', inlines: [{ kind: 'text', text: 'before' }] },
          { kind: 'unsupported', label: 'table' },
          { kind: 'paragraph', inlines: [{ kind: 'text', text: 'after' }] }
        ]
      }),
      answers: []
    })
  });

  it('is skipped VISIBLY, naming the kind', () => {
    const marker = byClass(tree, 'PostUnsupported');
    expect(marker).toHaveLength(1);
    expect(marker[0].ownText).toContain('table');
  });

  it('does not swallow the blocks around it', () => {
    expect(byClass(tree, 'PostParagraph').map((n) => n.ownText)).toEqual(['before', 'after']);
  });

  it('control: a body with no unsupported block draws no marker', () => {
    // Without this, "one marker" passes for a renderer that always draws one.
    const clean = draw({ state: 'ready', cachedSince: null, thread: detail() });
    expect(byClass(clean, 'PostUnsupported')).toHaveLength(0);
    expect(byClass(clean, 'PostParagraph').length).toBeGreaterThan(0);
  });
});

describe('AC3 — every inline reaches React as text', () => {
  const tree = draw({
    state: 'ready',
    cachedSince: null,
    thread: detail({
      question: post({
        blocks: [
          {
            kind: 'paragraph',
            inlines: [
              { kind: 'text', text: 'see ' },
              { kind: 'strong', text: 'this' },
              { kind: 'code', text: '<script>' },
              { kind: 'link', text: 'the docs', href: 'https://nodegx.io/docs' }
            ]
          },
          { kind: 'codeblock', text: '<img onerror=alert(1)>' },
          { kind: 'list', ordered: false, items: [[{ kind: 'text', text: 'one' }]] },
          { kind: 'heading', level: 2, inlines: [{ kind: 'text', text: 'A heading' }] }
        ]
      }),
      answers: []
    })
  });

  it('draws every kind of block', () => {
    const types = walk(tree).map((n) => n.type);
    expect(types).toEqual(expect.arrayContaining(['p', 'code', 'a', 'pre', 'ul', 'li', 'h4']));
  });

  it('a post heading never outranks the page it is on', () => {
    // ⚠️ Level 2 in a post becomes an h4: the thread title is the h2, and an outline where a
    // stranger's post outranks the page is a real defect for anybody navigating by headings.
    expect(byClass(tree, 'PostHeading').map((n) => n.type)).toEqual(['h4']);
  });

  it('markup-looking text stays TEXT', () => {
    expect(text(tree)).toContain('<script>');
    expect(text(tree)).toContain('<img onerror=alert(1)>');
    // No node in the tree carries markup as a prop — the model has nowhere to put it.
    expect(walk(tree).some((n) => 'dangerouslySetInnerHTML' in n.props)).toBe(false);
  });

  it('a link never navigates — it hands off, or it does nothing', () => {
    const anchor = walk(tree).find((n) => n.type === 'a');
    expect(anchor?.props.href).toBe('https://nodegx.io/docs');

    // 🔴 `preventDefault` runs whether or not a handler was passed. A host that forgets
    // `onOpenLink` gets a dead link, never a navigation.
    let prevented = false;
    (anchor?.props.onClick as (e: unknown) => void)({ preventDefault: () => (prevented = true) });
    expect(prevented).toBe(true);
  });

  it('and the hand-off reaches the host when there is one', () => {
    const opened: string[] = [];
    const withHandler = render(
      <CommunityThreadView
        state={{ state: 'ready', cachedSince: null, thread: detail({ question: post({
          blocks: [{ kind: 'paragraph', inlines: [{ kind: 'link', text: 'docs', href: 'https://nodegx.io' }] }]
        }), answers: [] }) }}
        onBack={noop}
        onRetry={noop}
        onOpenLink={(href) => opened.push(href)}
      />
    );
    const anchor = walk(withHandler).find((n) => n.type === 'a');
    (anchor?.props.onClick as (e: unknown) => void)({ preventDefault: noop });
    expect(opened).toEqual(['https://nodegx.io']);
  });
});

describe('AC5 — an attached fragment, rendered', () => {
  const pulled: string[] = [];
  const tree = draw({
    state: 'ready',
    cachedSince: null,
    thread: detail({
      question: post({
        attachments: [
          {
            id: 'a1',
            heading: 'Node excerpt',
            facts: ['For Each', '0.1.7', 'darwin arm64'],
            ports: [{ name: 'Items', direction: 'input', value: '[]' }],
            withheldLine: '2 port values were not shared.',
            note: null,
            pull: { label: 'Add to my project', onPull: () => pulled.push('a1') }
          }
        ]
      }),
      answers: []
    })
  });

  it('names it, and shows the facets the platform derived', () => {
    expect(byClass(tree, 'AttachmentHeading')[0].ownText).toBe('Node excerpt');
    expect(byClass(tree, 'AttachmentFacts')[0].ownText).toBe('For Each · 0.1.7 · darwin arm64');
  });

  it('shows the ports that were shared', () => {
    expect(byClass(tree, 'AttachmentPortName')[0].ownText).toBe('Items');
    expect(byClass(tree, 'AttachmentPortValue')[0].ownText).toBe('[]');
  });

  it('makes the redaction VISIBLE', () => {
    expect(byClass(tree, 'AttachmentWithheld')[0].ownText).toBe('2 port values were not shared.');
  });

  it('offers exactly one verb, and it is a pull', () => {
    const buttons = byClass(tree, 'PullButton');
    expect(buttons).toHaveLength(1);
    expect(buttons[0].ownText).toBe('Add to my project');
    (buttons[0].props.onClick as () => void)();
    expect(pulled).toEqual(['a1']);
  });

  it('a blocked pull is DRAWN and refuses, saying why', () => {
    const blocked = draw({
      state: 'ready',
      cachedSince: null,
      thread: detail({
        question: post({
          attachments: [
            {
              id: 'a1',
              heading: 'Graph fragment',
              facts: [],
              ports: [],
              withheldLine: null,
              note: null,
              pull: {
                label: 'Add to my project',
                onPull: noop,
                blockedReason: 'Your install does not have: Acme Charts, Acme Table.'
              }
            }
          ]
        }),
        answers: []
      })
    });
    // 🔴 Drawn and disabled, never vanished: a verb that disappears leaves a reader wondering
    // whether the feature exists; a named reason tells them which kit to install.
    expect(byClass(blocked, 'PullButton')[0].props.disabled).toBe(true);
    expect(byClass(blocked, 'PullBlocked')[0].ownText).toContain('Acme Charts');
  });

  it('control: an attachment with no pull offer draws no verb', () => {
    const noPull = draw({
      state: 'ready',
      cachedSince: null,
      thread: detail({
        question: post({
          attachments: [
            { id: 'a1', heading: 'Screenshot', facts: [], ports: [], withheldLine: null, note: null, pull: null }
          ]
        }),
        answers: []
      })
    });
    expect(byClass(noPull, 'Attachment')).toHaveLength(1);
    expect(byClass(noPull, 'PullButton')).toHaveLength(0);
  });
});

describe('the six states are six SHAPES', () => {
  it('D15 draws nothing at all', () => {
    expect(draw({ state: 'hidden' })).toBeNull();
  });

  it('control: the same component with a permitted state draws a thread', () => {
    // 🔴 The load-bearing pair. `null` is also what a component that never ran produces, so the
    // assertion above means nothing without this one out of the same call shape.
    const shown = draw({ state: 'ready', cachedSince: null, thread: detail() });
    expect(shown).not.toBeNull();
    expect(text(shown)).toContain('Why does my For Each render one row?');
  });

  it('loading pulses and says so', () => {
    const tree = draw({ state: 'loading' });
    expect(byClass(tree, 'LoadingPulse')).toHaveLength(1);
    expect(text(tree)).toContain('Loading');
  });

  it('gone says WHAT, never WHY', () => {
    const tree = draw({ state: 'gone' });
    const words = text(tree);
    expect(words).toContain('not available');
    // 🔴 `docs/API.md` §4: a client must never render "you do not have permission" from a 404.
    // The status code carries neither fact, so neither may appear.
    expect(words.toLowerCase()).not.toContain('permission');
    expect(words.toLowerCase()).not.toContain('moderator');
  });

  it('AC8: never opened and offline says it needs the network', () => {
    const tree = draw({ state: 'unreachable', detail: 'offline' });
    const words = text(tree);
    expect(words).toContain('needs the network');
    expect(words).toContain('offline');
    expect(byClass(tree, 'RetryButton')).toHaveLength(1);
  });

  it('AC8: neither offline state renders as "no answers"', () => {
    // 🔴 The whole of AC8's second sentence. A thread we could not fetch and a thread nobody has
    // answered are opposite facts, and the second is the one that makes a person close the editor.
    for (const state of [
      { state: 'unreachable' as const, detail: 'offline' },
      { state: 'loading' as const }
    ]) {
      expect(text(draw(state))).not.toContain('No answers yet');
    }
  });

  it('AC8: a cached copy admits its age, and still shows the answers it has', () => {
    const tree = draw({ state: 'ready', cachedSince: '2 hours ago', thread: detail() });
    expect(byClass(tree, 'ThreadCached')[0].ownText).toContain('2 hours ago');
    expect(byClass(tree, 'Post')).toHaveLength(2);
  });

  it('control: a live thread carries no cache banner', () => {
    expect(byClass(draw({ state: 'ready', cachedSince: null, thread: detail() }), 'ThreadCached')).toHaveLength(0);
  });

  it('every state except hidden offers a way back', () => {
    for (const state of [
      { state: 'loading' as const },
      { state: 'gone' as const },
      { state: 'unreachable' as const, detail: 'x' },
      { state: 'ready' as const, cachedSince: null, thread: detail() }
    ]) {
      // ⚠️ A thread that replaces the lists and cannot be left is a dead end — worse than the
      // browser hand-off this replaces, because the browser has a back button.
      expect(byClass(draw(state), 'ThreadBack')).toHaveLength(1);
    }
  });

  it('an unanswered thread invites rather than reporting zero', () => {
    const tree = draw({
      state: 'ready',
      cachedSince: null,
      thread: detail({ answers: [], answersLine: 'No answers yet — you could be the first.' })
    });
    expect(byClass(tree, 'ThreadAnswersHead')[0].ownText).toContain('No answers yet');
    expect(byClass(tree, 'Post')).toHaveLength(1);
  });
});

describe('AC1 — the launcher tab opens a thread in place', () => {
  const VIEW: CommunityMirrorView = {
    surface: 'shown',
    viewer: { handle: 'rosborne' },
    standing: null,
    threads: {
      state: 'items',
      items: [{ id: 't-uuid', title: 'A thread', createdAt: '2026-08-16T12:00:00.000Z', firstReplyMinutes: null }]
    },
    articles: { state: 'empty' },
    replays: { state: 'empty' },
    health: null
  };

  const host = (over: Partial<LauncherCommunityHostState> = {}): LauncherCommunityHostState => ({
    view: VIEW,
    isRefreshing: false,
    onRefresh: noop,
    ...over
  });

  it('a row hands back the thread’s OWN id', () => {
    // 🔴 It handed back `externalId` until 2026-08-19 — a field the platform has never sent — so
    // every click opened `/bench/undefined`. See `communityapi.ts`.
    const opened: string[] = [];
    const tree = render(<CommunityTab {...host({ onOpenThread: (id) => opened.push(id) })} />);
    const row = byClass(tree, 'Row')[0];
    (row.props.onClick as () => void)();
    expect(opened).toEqual(['t-uuid']);
  });

  it('with a thread open, the tab draws the thread and NOT the lists', () => {
    const tree = render(
      <CommunityTab
        {...host({
          thread: { state: { state: 'ready', cachedSince: null, thread: detail() }, onBack: noop, onRetry: noop }
        })}
      />
    );
    expect(text(tree)).toContain('Why does my For Each render one row?');
    expect(text(tree)).not.toContain('Call replays');
    expect(byClass(tree, 'Row')).toHaveLength(0);
  });

  it('🔴 D15 still wins over an open thread', () => {
    // The host sets `thread` from its own hook, which knows nothing about D15. If the pane were
    // checked first, a refused viewer holding a thread id would be drawn one.
    const tree = render(
      <CommunityTab
        {...host({
          view: { surface: 'hidden' },
          thread: { state: { state: 'ready', cachedSince: null, thread: detail() }, onBack: noop, onRetry: noop }
        })}
      />
    );
    expect(tree).toBeNull();
  });

  it('control: the same props with a shown surface draw the thread', () => {
    const tree = render(
      <CommunityTab
        {...host({
          thread: { state: { state: 'ready', cachedSince: null, thread: detail() }, onBack: noop, onRetry: noop }
        })}
      />
    );
    expect(tree).not.toBeNull();
  });
});

describe('AC1 — the rail panel opens a thread in place', () => {
  /**
   * ⚠️ **Source analysis, and it is the weaker instrument** — `CommunityPanel` reads two hooks,
   * so `renderElements` cannot call it (a hook throws outside a render). The launcher tab is
   * split into a pure `CommunityTab` for exactly this reason; the panel is not, because it has no
   * host to be split from. 🔴 So this checks the two things source analysis CAN see honestly —
   * that the browser hand-off is gone from the row and that the thread view is reached — and it
   * is the drive, not this, that establishes the panel works.
   */
  const source = stripComments(readFileSync(join(SRC, 'views/panels/CommunityPanel/CommunityPanel.tsx'), 'utf8'));

  it('a thread row no longer opens a browser', () => {
    expect(source).not.toContain('/bench/');
    expect(source).toContain('openThread(thread.id)');
  });

  it('draws the shared thread view, at panel density', () => {
    expect(source).toContain('CommunityThreadView');
    expect(source).toContain('CommunityDensity.Panel');
  });

  it('checks D15 before the pane', () => {
    expect(source.indexOf("view.surface === 'hidden'")).toBeLessThan(source.indexOf('if (pane)'));
  });

  it('control: the checks above can fail', () => {
    // A grep for an absent string passes on an empty file. This is the file being non-empty and
    // the strings being the ones that would move.
    expect(source.length).toBeGreaterThan(2000);
    expect(source).toContain('useCommunityThread');
  });
});
