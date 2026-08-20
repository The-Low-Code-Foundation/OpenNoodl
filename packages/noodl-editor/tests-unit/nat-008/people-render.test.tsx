/**
 * NAT-008 — what the directory and a profile actually DRAW, by walking the element tree.
 *
 * ## 🔴 Every absence here has a known-drawing control beside it
 *
 * Three of this task's criteria are claims about drawing nothing — D15 refuses a viewer, a
 * missing profile draws no retry, a person with no contact route gets no button — and a spec that
 * matched strings in the `.tsx` cannot tell a component that drew nothing from one that was never
 * called. So each pair below is **one call with one field different**.
 *
 * @module noodl-editor/tests-unit/nat-008/people-render
 */
import React from 'react';

import {
  CommunityDirectoryView,
  CommunityPersonRow,
  CommunityProfileView,
  CommunityThreadView,
  type CommunityDirectoryViewModel,
  type CommunityPersonRowView,
  type CommunityPostView,
  type CommunityProfileDetailView,
  type CommunityThreadDetailView
} from '@noodl-core-ui/components/community';
import { CommunityTab, type LauncherCommunityHostState } from '@noodl-core-ui/preview/launcher/Launcher/views/Community';
import type { ThreadDetail } from '@noodl-models/community/communityapi';
import { threadDetailView } from '@noodl-models/community/threadview';

import { CommunityDensity } from '@noodl-core-ui/components/community';

import { byClass, render, text, walk } from '../support/renderElements';

const noop = () => undefined;

function personRow(over: Partial<CommunityPersonRowView> = {}): CommunityPersonRowView {
  return {
    handle: 'ada',
    title: 'Ada Lovelace',
    meta: '@ada · 40 points · 2 of 12 badges',
    detail: 'Builds compilers.',
    initial: 'A',
    chips: [{ label: 'Available for work', tone: 'good' }],
    ...over
  };
}

function directory(over: Partial<CommunityDirectoryViewModel> = {}): CommunityDirectoryViewModel {
  return {
    section: { state: 'items', items: [personRow()] },
    summary: '1 person',
    boundLine: null,
    emptyLine: 'Builders who have published or finished something appear here.',
    searchLabel: 'Search names, handles, bios and skills',
    query: '',
    filters: [{ key: 'work', label: 'Available for work', count: 1, active: false }],
    ...over
  };
}

function profileDetail(over: Partial<CommunityProfileDetailView> = {}): CommunityProfileDetailView {
  return {
    title: 'Ada Lovelace',
    handle: '@ada',
    initial: 'A',
    eyebrow: 'Available for work',
    bio: 'Builds compilers.',
    stat: '40 points · 1 of 12 badges',
    chips: [{ label: 'Available for work', tone: 'good' }],
    badges: [{ title: 'First prefab', meta: 'building · bronze · earned 2 months ago', mark: 'url("data:image/svg+xml,x")' }],
    badgesEmptyLine: 'Badges are earned by publishing, answering and finishing lessons. None yet.',
    links: [{ label: 'ada.example', url: 'https://ada.example' }],
    barLine: null,
    contact: null,
    ...over
  };
}

function directoryProps(view = directory()) {
  return {
    view,
    onQueryChange: noop,
    onToggleFilter: noop,
    onOpenPerson: noop,
    onRetry: noop
  };
}

describe('NAT-008 — the directory draws', () => {
  it('a row per person, with the name, the meta, the blurb and the chips', () => {
    const tree = render(<CommunityDirectoryView {...directoryProps()} />);
    const words = text(tree);

    expect(words).toContain('Ada Lovelace');
    expect(words).toContain('40 points');
    expect(words).toContain('Builds compilers.');
    expect(words).toContain('Available for work');
    // The avatar letter is drawn, and it is `aria-hidden` because the name is right beside it.
    const avatar = byClass(tree, 'PersonAvatar')[0];
    expect(avatar.ownText).toBe('A');
    expect(avatar.props['aria-hidden']).toBe('true');
  });

  it('the search box is a labelled input, not a placeholder', () => {
    // ⚠️ A placeholder disappears the moment somebody types — which is when they most need to be
    // told what the box searches — and it is not an accessible name.
    const tree = render(<CommunityDirectoryView {...directoryProps()} />);
    const label = byClass(tree, 'SearchLabel')[0];
    const input = byClass(tree, 'SearchInput')[0];

    expect(label.ownText).toBe('Search names, handles, bios and skills');
    expect(label.props.htmlFor).toBe(input.props.id);
    expect(input.props.placeholder).toBeUndefined();
  });

  it('the two densities give their search boxes DIFFERENT ids', () => {
    // 🔴 `htmlFor` binds by document-unique id, and the launcher tab and the editor's rail live in
    // the SAME BrowserWindow. Two boxes with one id resolve to the first: clicking the rail's
    // label would focus the launcher's field. Asserted rather than trusted.
    const page = render(<CommunityDirectoryView {...directoryProps()} density={CommunityDensity.Page} />);
    const panel = render(<CommunityDirectoryView {...directoryProps()} density={CommunityDensity.Panel} />);

    const pageId = byClass(page, 'SearchInput')[0].props.id;
    const panelId = byClass(panel, 'SearchInput')[0].props.id;

    expect(pageId).not.toBe(panelId);
    // ...and each label still points at its OWN field — the half a "they differ" check misses.
    expect(byClass(page, 'SearchLabel')[0].props.htmlFor).toBe(pageId);
    expect(byClass(panel, 'SearchLabel')[0].props.htmlFor).toBe(panelId);
  });

  it('the label NAMES the fields, so the box does not promise more than it does', () => {
    const tree = render(<CommunityDirectoryView {...directoryProps()} />);
    expect(text(tree)).toContain('names, handles, bios and skills');
  });

  it('a row is a button, so it can be reached from a keyboard', () => {
    // 🔴 `CommunityRow`'s fix, inherited: an entry point you cannot tab to is one a screen-reader
    // user does not have.
    const tree = render(<CommunityPersonRow person={personRow()} onClick={noop} />);
    expect(tree?.type).toBe('button');
    expect(tree?.props.type).toBe('button');
  });

  it('a filter pill carries its state in aria-pressed as well as in its fill', () => {
    const tree = render(
      <CommunityDirectoryView
        {...directoryProps(directory({ filters: [{ key: 'work', label: 'Available for work', count: 2, active: true }] }))}
      />
    );
    const pill = byClass(tree, 'FilterPill')[0];
    expect(pill.props['aria-pressed']).toBe(true);
    expect(text(pill as never)).toContain('2');
  });

  it('the partial-directory sentence is drawn ABOVE the rows', () => {
    // 🔴 A reader who stops scrolling at row eight would never see a footnote.
    const tree = render(
      <CommunityDirectoryView {...directoryProps(directory({ boundLine: 'Showing the first 100 of 340 — search covers only these.' }))} />
    );
    const nodes = walk(tree);
    const boundAt = nodes.findIndex((n) => String(n.props.className ?? '').includes('DirectoryBound'));
    const firstRowAt = nodes.findIndex((n) => String(n.props.className ?? '').includes('PersonRow'));

    expect(boundAt).toBeGreaterThan(-1);
    expect(firstRowAt).toBeGreaterThan(boundAt);
  });

  it('a complete directory draws NO bound sentence — and the control above proves it can', () => {
    const tree = render(<CommunityDirectoryView {...directoryProps()} />);
    expect(byClass(tree, 'DirectoryBound')).toHaveLength(0);
  });

  it('an unreachable directory does not read as an empty one', () => {
    const tree = render(
      <CommunityDirectoryView {...directoryProps(directory({ section: { state: 'unreachable', detail: 'offline' } }))} />
    );
    const words = text(tree);
    expect(words).toContain('Could not reach the community');
    expect(words).not.toContain('Builders who have published');
  });
});

describe('NAT-008 — a profile draws', () => {
  it('the head, the badges and the links', () => {
    const words = text(render(<CommunityProfileView state={{ state: 'ready', profile: profileDetail(), cachedSince: null }} onBack={noop} onRetry={noop} />));

    expect(words).toContain('Ada Lovelace');
    expect(words).toContain('@ada');
    expect(words).toContain('40 points · 1 of 12 badges');
    expect(words).toContain('First prefab');
    expect(words).toContain('ada.example');
  });

  it('a badge is painted through a mask and is NOT an image element', () => {
    // 🔴 AC3. An `<img>`-loaded SVG inherits no colour: twelve invisible marks in one theme and
    // twelve black ones in the other.
    const tree = render(
      <CommunityProfileView state={{ state: 'ready', profile: profileDetail(), cachedSince: null }} onBack={noop} onRetry={noop} />
    );
    const art = byClass(tree, 'BadgeArt')[0];
    const style = art.props.style as Record<string, string>;

    expect(style.maskImage).toBe('url("data:image/svg+xml,x")');
    expect(style.WebkitMaskImage).toBe('url("data:image/svg+xml,x")');
    expect(walk(tree).some((n) => n.type === 'img')).toBe(false);
  });

  it('a badge this editor has no mark for still draws its title and tier', () => {
    // ⚠️ The web keeps this branch too: a badge with no artwork is a badge, not a broken square.
    const tree = render(
      <CommunityProfileView
        state={{
          state: 'ready',
          profile: profileDetail({ badges: [{ title: 'Mentor', meta: 'mentoring · bronze', mark: null }] }),
          cachedSince: null
        }}
        onBack={noop}
        onRetry={noop}
      />
    );
    expect(text(tree)).toContain('Mentor');
    expect(byClass(tree, 'BadgeArt')).toHaveLength(0);
  });

  it('a profile link is a button, so nothing navigates this window on its own', () => {
    // 🔴 An `<a href>` in this renderer navigates the EDITOR. The hand-off is the host's, and it
    // is the call site NAT-012 audits.
    const tree = render(
      <CommunityProfileView state={{ state: 'ready', profile: profileDetail(), cachedSince: null }} onBack={noop} onRetry={noop} onOpenLink={noop} />
    );
    expect(walk(tree).some((n) => n.type === 'a')).toBe(false);
    expect(byClass(tree, 'PostLink')[0].type).toBe('button');
  });

  it('draws no contact button when there is no route — with a control that it can draw one', () => {
    const without = render(
      <CommunityProfileView state={{ state: 'ready', profile: profileDetail(), cachedSince: null }} onBack={noop} onRetry={noop} />
    );
    const with_ = render(
      <CommunityProfileView
        state={{
          state: 'ready',
          profile: profileDetail({ contact: { label: 'Ask on the Bench', line: 'Opens a thread in the editor.', onAction: noop } }),
          cachedSince: null
        }}
        onBack={noop}
        onRetry={noop}
      />
    );

    expect(text(without)).not.toContain('Ask on the Bench');
    // 🔴 The control. Without it, "no contact button" is also true of a component that crashed.
    expect(text(with_)).toContain('Ask on the Bench');
  });

  it('`gone` says one sentence for all four things a 404 means, and offers no retry', () => {
    const tree = render(<CommunityProfileView state={{ state: 'gone' }} onBack={noop} onRetry={noop} />);
    const words = text(tree);

    expect(words).toContain('There is no public profile here.');
    // ⚠️ None of the four is fixed by asking again, and a retry would invite somebody to keep
    // trying a door that is not there.
    expect(words).not.toContain('Try again');
    // It still says "hidden" nowhere — that would be the disclosure the platform declined.
    expect(words.toLowerCase()).not.toContain('hidden');
    expect(words.toLowerCase()).not.toContain('private');
  });

  it('a cached profile says how old the copy is', () => {
    const words = text(
      render(
        <CommunityProfileView state={{ state: 'ready', profile: profileDetail(), cachedSince: '5 minutes ago' }} onBack={noop} onRetry={noop} />
      )
    );
    expect(words).toContain('Showing a copy from 5 minutes ago');
  });
});

describe('NAT-008 — D15 draws nothing, with a permitted control beside it', () => {
  it('a refused viewer gets NO profile pane at all', () => {
    expect(render(<CommunityProfileView state={{ state: 'hidden' }} onBack={noop} onRetry={noop} />)).toBeNull();
  });

  it('the control: the same component with one field changed draws a profile', () => {
    // 🔴 Without this row, `null` above is also what a component that never ran would produce.
    const tree = render(
      <CommunityProfileView state={{ state: 'ready', profile: profileDetail(), cachedSince: null }} onBack={noop} onRetry={noop} />
    );
    expect(tree).not.toBeNull();
    expect(text(tree)).toContain('Ada Lovelace');
  });

  it('the launcher tab draws no People section when the host says the viewer is refused', () => {
    // ⚠️ `people: null` is D15's refusal; `undefined` is a host that has not wired the surface.
    // Both draw nothing here, and the tab does not decide which is which.
    const base: LauncherCommunityHostState = {
      view: {
        surface: 'shown',
        viewer: { handle: 'ada' },
        standing: null,
        replays: { state: 'empty' },
        articles: { state: 'empty' },
        threads: { state: 'empty' },
        health: null
      },
      isRefreshing: false,
      onRefresh: noop
    };

    const refused = render(<CommunityTab {...base} people={null} />);
    const permitted = render(
      <CommunityTab {...base} people={{ directory: directory(), onQueryChange: noop, onToggleFilter: noop, onOpenPerson: noop, onRetry: noop }} />
    );

    expect(text(refused)).not.toContain('Ada Lovelace');
    // 🔴 The control, one field different.
    expect(text(permitted)).toContain('Ada Lovelace');
    expect(text(permitted)).toContain('People');
  });

  it('a profile opens IN PLACE of the lists, and after the D15 check', () => {
    const openProfile = {
      state: { state: 'ready' as const, profile: profileDetail(), cachedSince: null },
      onBack: noop,
      onRetry: noop
    };

    // 🔴 A refused viewer who somehow holds a handle reaches nothing — the `profile` prop being
    // set does not get it drawn.
    const refused: LauncherCommunityHostState = {
      view: { surface: 'hidden' },
      isRefreshing: false,
      onRefresh: noop,
      profile: openProfile
    };
    expect(render(<CommunityTab {...refused} />)).toBeNull();

    // The control: the same open profile, one field different on the viewer.
    const permitted: LauncherCommunityHostState = {
      view: {
        surface: 'shown',
        viewer: { handle: 'ada' },
        standing: null,
        replays: { state: 'empty' },
        articles: { state: 'empty' },
        threads: { state: 'empty' },
        health: null
      },
      isRefreshing: false,
      onRefresh: noop,
      profile: openProfile
    };
    const words = text(render(<CommunityTab {...permitted} />));
    expect(words).toContain('Ada Lovelace');
    // In place OF the lists: the tab's own section headings are gone while a profile is open.
    expect(words).not.toContain('Call replays');
  });
});

describe('NAT-008 AC4 — author lines are entry points', () => {
  function threadDetail(): CommunityThreadDetailView {
    return {
      title: 'Why does my For Each render one row?',
      meta: '@rosborne · 3 days ago',
      question: {
        id: 'p1',
        author: '@rosborne',
        authorHandle: 'rosborne',
        when: '3 days ago',
        accepted: false,
        blocks: [{ kind: 'paragraph', inlines: [{ kind: 'text', text: 'Hello.' }] }],
        attachments: []
      } as CommunityPostView,
      answers: [],
      answersLine: 'No answers yet — you could be the first.'
    };
  }

  it('a post\'s author is a button when the host can open a profile', () => {
    const tree = render(
      <CommunityThreadView
        state={{ state: 'ready', thread: threadDetail(), cachedSince: null }}
        onBack={noop}
        onRetry={noop}
        onOpenPerson={noop}
      />
    );
    const link = byClass(tree, 'PostAuthorLink')[0];
    expect(link.type).toBe('button');
    expect(link.ownText).toBe('@rosborne');
  });

  it('and plain text when it cannot — never a dead control', () => {
    // ⚠️ Both branches draw the SAME words, so a thread rendered without a people host reads
    // identically. A control that looked clickable and was not would be worse than the text.
    const tree = render(
      <CommunityThreadView state={{ state: 'ready', thread: threadDetail(), cachedSince: null }} onBack={noop} onRetry={noop} />
    );
    expect(byClass(tree, 'PostAuthorLink')).toHaveLength(0);
    expect(byClass(tree, 'PostAuthor')[0].ownText).toBe('@rosborne');
  });

  it('the PRODUCER supplies null for a post with no handle — not a handle made from the words', () => {
    // 🔴 THIS ASSERTION EXISTS BECAUSE THE ONE BELOW WAS NOT ENOUGH. Red-verified on 2026-08-20:
    // replacing `postView`'s `authorHandle` with `post.author.replace('@', '')` left every render
    // spec green, because they all build the view by hand. The defect it would have shipped is a
    // profile link on an anonymous post that opens `/people/someone`.
    //
    // ⚠️ The general shape, worth naming: a spec that constructs a view model cannot grade the
    // function that constructs it. The two halves need one assertion each.
    const wire: ThreadDetail = {
      id: 't1',
      section: 'bench',
      title: 'A question',
      authorHandle: '',
      createdAt: '2026-08-17T12:00:00.000Z',
      replyCount: 0,
      accepted: false,
      acceptedPostId: null,
      firstReplyMinutes: null,
      question: {
        id: 'p1',
        authorHandle: '',
        blocks: [],
        createdAt: '2026-08-17T12:00:00.000Z',
        accepted: false,
        attachments: []
      },
      answers: []
    };

    const view = threadDetailView(wire, Date.parse('2026-08-20T12:00:00.000Z'));
    expect(view.question.author).toBe('someone');
    expect(view.question.authorHandle).toBeNull();
  });

  it('a post with no handle stays plain text even when the host CAN open profiles', () => {
    // 🔴 `postView` draws 'someone' for a payload with no handle, and there is no profile to
    // open for one. Reconstructing a handle by stripping the '@' would produce `someone`.
    const detail = threadDetail();
    const anonymous = { ...detail, question: { ...detail.question, author: 'someone', authorHandle: null } };
    const tree = render(
      <CommunityThreadView
        state={{ state: 'ready', thread: anonymous, cachedSince: null }}
        onBack={noop}
        onRetry={noop}
        onOpenPerson={noop}
      />
    );
    expect(byClass(tree, 'PostAuthorLink')).toHaveLength(0);
    expect(byClass(tree, 'PostAuthor')[0].ownText).toBe('someone');
  });
});
