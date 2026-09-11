/**
 * TUT-004 AC1 — what the tutorials section actually draws.
 *
 * 🔴 **THE SENTENCES ARE THE CRITERIA, AND THEY DIFFER ONLY IN WORDING.** "There is nothing to
 * install" and "we could not reach the community" produce the same visible outcome — no lesson —
 * and have opposite fixes: one is permanent and the learner should stop waiting, the other is
 * transient and they should retry. Every layer below this one keeps them apart (`absent` vs
 * `unreachable` on the wire, `unavailable` vs `offline` in the installer); this is the last place
 * they could be collapsed, so these specs assert the two **differ**, not that each is non-empty.
 *
 * ⚠️ `renderElements` is not a render: no effects, no state, no DOM, no hooks. It answers *"what
 * did this component draw"*, which is what AC1 and D15 are claims about — and it is blind to
 * layout, colour and anything a hook would have supplied. Saying so is the point; an unstated
 * limit reads as coverage.
 */
import React from 'react';

import { composeTutorials, actionLabel, tutorialMetaLine, noteForOutcome } from '../../src/editor/src/models/community/tutorialsview';
import type { TutorialsView } from '../../src/editor/src/models/community/tutorialsview';
import type { Paged, Read, TutorialSummary } from '../../src/editor/src/models/community/communityapi';
import { Tutorials } from '../../src/editor/src/views/panels/CommunityPanel/Tutorials';
import { render, text, walk } from '../support/renderElements';

// ─── Fixtures ───────────────────────────────────────────────────────────────

function row(over: Partial<TutorialSummary> = {}): TutorialSummary {
  return {
    slug: 'log-a-thing',
    title: 'Log a thing',
    summary: 'Save one row, and see it come back.',
    level: 'beginner',
    category: 'data-lists',
    estimatedMinutes: 20,
    outcomes: [],
    nodes: [],
    installable: true,
    ...over
  };
}

const paged = (items: TutorialSummary[]): Read<Paged<TutorialSummary>> => ({
  outcome: 'ok',
  value: { items, page: { limit: 20, offset: 0, total: items.length, nextOffset: null } }
});

function paneFor(
  view: TutorialsView,
  onInstall: (slug: string) => void = () => undefined,
  onRead: (slug: string) => void = () => undefined
) {
  return { view, onInstall, onRead, onRetry: () => undefined };
}

// ─── The view model ─────────────────────────────────────────────────────────

describe('which tutorials offer to install', () => {
  it('offers an install for a tutorial with a bundle', () => {
    const view = composeTutorials(paged([row()]));
    expect(view).toMatchObject({ surface: 'present', section: { state: 'items' } });
    if (view.surface !== 'present' || view.section.state !== 'items') return;
    expect(view.section.items[0]).toMatchObject({ slug: 'log-a-thing', action: 'install' });
  });

  /**
   * 🔴 **This row used to assert `none`, and `none` is what Richard hit.** 2026-09-06: *"in the
   * community tab in the editor, you can't click on a tutorial item, it does nothing."* Measured
   * against the live platform the same day, `/api/v1/community/tutorials` serves exactly one row
   * and it is `installable: false` — so every tutorial anybody can see took this branch, and the
   * branch drew no action word and ignored the click.
   *
   * ⚠️ **The rule that produced `none` is still kept, and this row still guards it**: a missing
   * bundle must never be advertised as an install. What changed is that "cannot be installed" was
   * being read as "cannot be done anything with", and a tutorial can always be READ.
   */
  it('🔴 offers a READ, never an install, for a tutorial with no bundle', () => {
    const view = composeTutorials(paged([row({ installable: false })]));
    if (view.surface !== 'present' || view.section.state !== 'items') throw new Error('expected items');
    expect(view.section.items[0].action).toBe('read');
    expect(view.section.items[0].action).not.toBe('install');
    expect(actionLabel('read')).toBe('Read on the web');
  });

  it('⚠️ and the word says where the click goes, because it leaves the editor', () => {
    // D6 removed the reading SECTION from this panel precisely because its rows opened a browser.
    // One row that can only be read is a different thing, but it still owes the user that fact
    // before they click rather than after.
    expect(actionLabel('read')).toContain('web');
  });

  it('🔴 says INSTALLED rather than offering to overwrite work in progress', () => {
    const view = composeTutorials(paged([row()]), { installedSlugs: new Set(['log-a-thing']) });
    if (view.surface !== 'present' || view.section.state !== 'items') throw new Error('expected items');
    expect(view.section.items[0].action).toBe('installed');
  });

  it('says INSTALLING for the row that is busy, and only that row', () => {
    const view = composeTutorials(paged([row(), row({ slug: 'other', title: 'Other' })]), { busySlug: 'other' });
    if (view.surface !== 'present' || view.section.state !== 'items') throw new Error('expected items');
    expect(view.section.items.map((i) => i.action)).toEqual(['install', 'installing']);
  });

  it('🔴 D15 draws nothing at all — not an empty section', () => {
    expect(composeTutorials({ outcome: 'absent' })).toEqual({ surface: 'hidden' });
    // ✅ Known-firing control: the same function produces a visible surface for a real read, so
    // `hidden` is the rule and not the only thing this function can return.
    expect(composeTutorials(paged([row()])).surface).toBe('present');
  });

  it('🔴 unreachable and empty are DIFFERENT states, carrying different shapes', () => {
    const offline = composeTutorials({ outcome: 'unreachable', status: null, detail: 'ENOTFOUND' });
    const empty = composeTutorials(paged([]));
    if (offline.surface !== 'present' || empty.surface !== 'present') throw new Error('expected present');
    expect(offline.section.state).toBe('unreachable');
    expect(empty.section.state).toBe('empty');
    // `CommunitySectionBody` draws `unreachable` with a rule and a retry and `empty` with
    // neither. A flaky network must not read like a quiet room.
    expect(offline.section.state).not.toBe(empty.section.state);
  });

  it('is loading before the first answer, never empty', () => {
    const view = composeTutorials(null);
    if (view.surface !== 'present') throw new Error('expected present');
    expect(view.section.state).toBe('loading');
  });
});

describe('the meta line says only what the row carries', () => {
  it('builds from the fields that are present', () => {
    expect(tutorialMetaLine(row())).toBe('Beginner · data lists · 20 min');
  });
  it('⚠️ draws nothing rather than padding absent fields', () => {
    expect(tutorialMetaLine(row({ level: null, category: null, estimatedMinutes: null }))).toBeNull();
  });
});

describe('what a row says after an attempt', () => {
  it('🔴 an offline failure and a nothing-to-install both say WHY, and differently', () => {
    const offline = noteForOutcome({ result: 'offline', reason: 'NodeGX Community could not be reached, so "x" can\'t be installed right now.' });
    const nothing = noteForOutcome({ result: 'unavailable', reason: 'There is nothing to install for "x".' });
    expect(offline).toBeTruthy();
    expect(nothing).toBeTruthy();
    expect(offline).not.toBe(nothing);
  });

  it('an install reports what was CHECKED, including what was not', () => {
    expect(noteForOutcome({ result: 'installed', checked: 'Checked as local-ai: F1, F2, F3 passed; F4 not checked.' }))
      .toMatch(/F4 not checked/);
  });

  it('a refusal reports the reason rather than "it failed"', () => {
    expect(noteForOutcome({ result: 'refused', reason: 'a step can never be completed' })).toMatch(/never be completed/);
  });

  it('⚠️ says nothing when a person cancelled — they know they cancelled', () => {
    expect(noteForOutcome({ result: 'cancelled' })).toBeNull();
  });
});

// ─── What the component draws ───────────────────────────────────────────────

describe('the tutorials section, drawn', () => {
  it('🔴 draws NOTHING when D15 refused the viewer', () => {
    const tree = render(React.createElement(Tutorials, { pane: paneFor({ surface: 'hidden' }) }));
    expect(tree).toBeNull();
  });

  it('✅ draws a section for a real list — the control the null above is read against', () => {
    const tree = render(
      React.createElement(Tutorials, { pane: paneFor(composeTutorials(paged([row()]))) })
    );
    expect(tree).not.toBeNull();
    expect(text(tree)).toContain('Log a thing');
    expect(text(tree)).toContain('Install');
  });

  it('🔴 AC1 — clicking the row installs, and it is the ONE action on it', () => {
    const clicked: string[] = [];
    const tree = render(
      React.createElement(Tutorials, {
        pane: paneFor(composeTutorials(paged([row()])), (slug) => clicked.push(slug))
      })
    );
    const clickable = walk(tree).filter((n) => typeof n.props.onClick === 'function');
    // One handler on the row. A second control would be two answers to one question.
    const rowHandlers = clickable.filter((n) => String(n.props['aria-label'] ?? n.props.ariaLabel ?? '').includes('Log a thing'));
    expect(rowHandlers.length).toBe(1);
    (rowHandlers[0].props.onClick as () => void)();
    expect(clicked).toEqual(['log-a-thing']);
  });

  /**
   * 🔴 **The row this replaces asserted the defect.** It read *"a tutorial with no bundle is drawn
   * with NO handler"* and it passed, every time, while the only tutorial the platform serves is
   * exactly that shape — so the section a user opens was a list of rows that ignored the click,
   * with a green spec over it. Richard found it by clicking one.
   *
   * ⚠️ The rule the old row was protecting is not dropped, and the second and third assertions
   * below are it: no install word, and the click must be the READ and not the install.
   */
  it('🔴 a tutorial with no bundle opens the page it is published to — the click is not dead', () => {
    const read: string[] = [];
    const installed: string[] = [];
    const tree = render(
      React.createElement(Tutorials, {
        pane: paneFor(
          composeTutorials(paged([row({ installable: false })])),
          (slug) => installed.push(slug),
          (slug) => read.push(slug)
        )
      })
    );

    expect(text(tree)).toContain('Log a thing');
    // The `0011` rule, unchanged: never advertise an install this row cannot perform.
    expect(text(tree)).not.toContain('Install');

    const onTheRow = walk(tree).filter(
      (n) =>
        typeof n.props.onClick === 'function' &&
        String(n.props['aria-label'] ?? n.props.ariaLabel ?? '').includes('Log a thing')
    );
    expect(onTheRow.length).toBe(1);

    (onTheRow[0].props.onClick as () => void)();
    expect(read).toEqual(['log-a-thing']);
    expect(installed).toEqual([]);
  });

  it('⚠️ a row already installed still has nothing to offer, so the click stays absent', () => {
    // The control for the row above: `walk(...).length === 1` there has to be able to read 0
    // somewhere, or it is not measuring the handler — it is measuring that rows exist.
    const tree = render(
      React.createElement(Tutorials, {
        pane: paneFor(composeTutorials(paged([row()]), { installedSlugs: new Set(['log-a-thing']) }))
      })
    );
    const onTheRow = walk(tree).filter(
      (n) =>
        typeof n.props.onClick === 'function' &&
        String(n.props['aria-label'] ?? n.props.ariaLabel ?? '').includes('Log a thing')
    );
    expect(onTheRow).toEqual([]);
  });

  it("draws the row's note — what was checked, or why it was refused", () => {
    const view = composeTutorials(paged([row()]), {
      installedSlugs: new Set(['log-a-thing']),
      notes: new Map([['log-a-thing', 'Installed. Checked as local-ai: F1, F2, F3 passed; F4 not checked.']])
    });
    const tree = render(React.createElement(Tutorials, { pane: paneFor(view) }));
    expect(text(tree)).toContain('F4 not checked');
  });

  it('the empty line says what the section is FOR', () => {
    const tree = render(React.createElement(Tutorials, { pane: paneFor(composeTutorials(paged([]))) }));
    expect(text(tree)).toMatch(/Tutorials published with a project/);
  });
});
