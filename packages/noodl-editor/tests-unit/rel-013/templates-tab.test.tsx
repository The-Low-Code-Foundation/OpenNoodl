/**
 * REL-013 — the Templates tab, from the gate that decides whether to fetch to the words a bare
 * shelf puts on the screen.
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 * ## 🔴 WHAT THIS FILE IS GUARDING AGAINST, AND WHAT IT CANNOT SEE
 *
 * The tab shipped for its whole life as one hardcoded sentence with no registry behind it. The
 * failure this file exists to prevent is that *replacing* it lands in one of the three states
 * that look identical to the person in front of the screen and mean opposite things:
 *
 *   1. **A spinner that never resolves** — `isLoading` left true on an empty shelf.
 *   2. **A bare panel** — zero rows drawn as nothing at all, which reads as *broken*.
 *   3. **A "nothing published yet" over a community outage** — the shelf could not be READ, and
 *      saying it is empty is a claim the tab has no evidence for.
 *
 * ⚠️ **Every render assertion here comes in a PAIR that must DISAGREE.** A spec that only ever
 * renders the empty gallery cannot tell "the empty state draws" from "this component draws the
 * empty text no matter what it is handed", and the latter would pass on a component whose whole
 * body was that one panel — which is exactly the defect being replaced.
 *
 * 🔴 **WHAT A GREEN RUN HERE DOES NOT PROVE.** `useProjectTemplates` is a hook: its `if (!enabled)
 * return` cannot be executed by this runner (no React renderer in this repo, and
 * `@testing-library/react` is not installed). So AC2's *"a cold start makes no community request"*
 * is graded here as (a) the pure gate returning `false` for that combination and (b) a cardinality
 * check that `ProjectsPage` has exactly ONE `useProjectTemplates(` call and passes exactly that
 * gate to it. The remaining link — the effect really returning early — is closed by a drive, and
 * by nothing in this file.
 *
 * @module noodl-editor/tests-unit/rel-013
 */

import React from 'react';

import { readFileSync } from 'fs';
import { join } from 'path';

import type {
  TemplateChoice,
  TemplateGalleryState
} from '@noodl-core-ui/preview/launcher/Launcher/components/ProjectCreationWizard/steps/TemplateStep';
import {
  getStepSequence,
  isStepValid,
  seedWizardState,
  type WizardState
} from '@noodl-core-ui/preview/launcher/Launcher/components/ProjectCreationWizard/WizardContext';
import { isValidPageId } from '@noodl-core-ui/preview/launcher/Launcher/hooks/usePersistentTab';
import { TemplatesTabBody } from '@noodl-core-ui/preview/launcher/Launcher/views/Templates';

import {
  TEMPLATES_PAGE_ID,
  galleryFromListing,
  shouldFetchTemplates
} from '../../src/editor/src/hooks/useProjectTemplates';
import { byClass, render, stripComments, text, walk } from '../support/renderElements';

const EDITOR_SRC = join(__dirname, '../../src/editor/src');
const LAUNCHER_SRC = join(__dirname, '../../../noodl-core-ui/src/preview/launcher/Launcher');

function sourceOf(absolutePath: string): string {
  return stripComments(readFileSync(absolutePath, 'utf8'));
}

// ── Fixtures ──────────────────────────────────────────────────────────────────

function row(overrides: Partial<TemplateChoice> = {}): TemplateChoice {
  return {
    url: 'community://members-area',
    title: 'Members area',
    description: 'A sign-in, a members-only page and the records behind them.',
    category: 'data-app',
    origin: 'Community',
    needsBackend: true,
    ...overrides
  };
}

/** The shelf as it ships today: read successfully, and holding nothing. */
const EMPTY_SHELF: TemplateGalleryState = { items: [], isLoading: false };

const LOADING_SHELF: TemplateGalleryState = { items: [], isLoading: true };

function shelfOf(...items: TemplateChoice[]): TemplateGalleryState {
  return { items, isLoading: false };
}

// ═══════════════════════════════════════════════════════════════════════════════
// AC2 — the fetch is gated on a surface being LOOKED AT, and cold start is neither
// ═══════════════════════════════════════════════════════════════════════════════

describe('REL-013 AC2 — shouldFetchTemplates', () => {
  it('🔴 THE CONTROL: a cold start with neither the wizard nor the tab open does NOT fetch', () => {
    // This is the whole of AC2's negative arm, and it is the reading that would have gone the
    // other way if the tab had simply called the hook with `enabled` left true.
    expect(shouldFetchTemplates({ isCreateWizardOpen: false, activeLauncherPage: 'projects' })).toBe(false);
  });

  it('does not fetch on any of the other tabs either', () => {
    // ⚠️ Named individually rather than "anything but templates": the union is small and a new
    // tab that accidentally spelled itself `'templates '` would slip through a negated check.
    for (const page of ['projects', 'community', 'learning', 'github', 'learn']) {
      expect(shouldFetchTemplates({ isCreateWizardOpen: false, activeLauncherPage: page })).toBe(false);
    }
  });

  it('fetches when the create wizard is open — FB-005 T3\u2019s original gate, unchanged', () => {
    expect(shouldFetchTemplates({ isCreateWizardOpen: true, activeLauncherPage: 'projects' })).toBe(true);
  });

  it('fetches when the Templates tab is open — the reason this row exists', () => {
    expect(shouldFetchTemplates({ isCreateWizardOpen: false, activeLauncherPage: 'templates' })).toBe(true);
  });

  it('stays enabled when the tab opens the wizard, so the shelf is not re-read under the picker', () => {
    expect(shouldFetchTemplates({ isCreateWizardOpen: true, activeLauncherPage: 'templates' })).toBe(true);
  });

  it('🔴 the page id it compares against is one the launcher can actually be on', () => {
    // A literal in two files is a literal that drifts. `isValidPageId` is the one place a STORED
    // string is turned into a page, so a rename that missed the gate reddens here rather than
    // silently disabling the tab's fetch for ever.
    expect(isValidPageId(TEMPLATES_PAGE_ID)).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// AC1 + Trap 2 — ONE hook instance, and it is the one the wizard reads
// ═══════════════════════════════════════════════════════════════════════════════

describe('REL-013 AC1 / Trap 2 — one shelf, two surfaces', () => {
  const projectsPage = sourceOf(join(EDITOR_SRC, 'pages/ProjectsPage/ProjectsPage.tsx'));

  it('🔴 instantiates useProjectTemplates EXACTLY ONCE in the whole application', () => {
    // Trap 2. Two instances would issue two community requests for every one the user caused,
    // and the tab and the wizard could then show two different shelves — a difference that looks
    // perfectly plausible on either screen alone.
    const callSites = [...projectsPage.matchAll(/useProjectTemplates\s*\(/g)];
    expect(callSites.length).toBe(1);

    // …and nowhere else in the editor or in core-ui. `grep -rl` over both trees is the population
    // this claim is really about; the two files below are the only ones allowed to name it.
    const launcherFiles = [
      join(LAUNCHER_SRC, 'views/Templates.tsx'),
      join(LAUNCHER_SRC, 'Launcher.tsx'),
      join(LAUNCHER_SRC, 'LauncherContext.tsx')
    ];
    for (const file of launcherFiles) {
      expect(sourceOf(file)).not.toContain('useProjectTemplates');
    }
  });

  it('passes the gate — not a bare boolean — to that one call', () => {
    expect(projectsPage).toMatch(/useProjectTemplates\(\s*shouldFetchTemplates\(/);
  });

  it('hands the SAME gallery value to the launcher and to the wizard', () => {
    // The reach assertion AC1 is really about: "the same `useProjectTemplates` state the create
    // wizard uses". Both props are fed from the one `projectTemplates` binding.
    expect(projectsPage).toContain('templates={projectTemplates}');
    expect([...projectsPage.matchAll(/templates=\{projectTemplates\}/g)].length).toBe(2);
  });

  it('learns which tab is open from the launcher rather than guessing', () => {
    expect(projectsPage).toContain('onActivePageChange={setActiveLauncherPage}');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// AC1 + AC3 — the tab draws the rows, and the three states the hook produces
// ═══════════════════════════════════════════════════════════════════════════════

describe('REL-013 AC1 — the tab draws the registry\u2019s rows', () => {
  it('draws every row it is handed, with its title and its description', () => {
    const tree = render(
      <TemplatesTabBody gallery={shelfOf(row(), row({ url: 'embedded://crm', title: 'Simple CRM' }))} />
    );
    const words = text(tree);

    expect(words).toContain('Members area');
    expect(words).toContain('Simple CRM');
    expect(words).toContain('A sign-in, a members-only page and the records behind them.');
    expect(byClass(tree, 'TemplateCard').length).toBe(2);
  });

  it('🔴 draws the category LABEL, not the platform slug', () => {
    // The vocabulary was ruled to the platform's on 2026-08-26 — right for a CHECK constraint,
    // wrong for a card. `hello-world`'s card drew the literal string `starter` at a person for
    // the whole of FB-005 T3.
    const words = text(render(<TemplatesTabBody gallery={shelfOf(row({ category: 'data-app' }))} />));
    expect(words).toContain('Data app');
    expect(words).not.toContain('data-app');
  });

  it('badges where the row came from', () => {
    const words = text(render(<TemplatesTabBody gallery={shelfOf(row({ origin: 'Built in' }))} />));
    expect(words).toContain('Built in');
  });

  it('⚠️ draws no image element at all — there is no thumbnail column and there never will be', () => {
    // Trap 4. `PlatformTemplateProvider` ships `iconURL: ''` deliberately.
    const tree = render(<TemplatesTabBody gallery={shelfOf(row())} />);
    expect(walk(tree).filter((n) => n.type === 'img').length).toBe(0);
  });

  it('says on every row what clicking it does', () => {
    const words = text(render(<TemplatesTabBody gallery={shelfOf(row())} />));
    expect(words).toContain('Use this template');
  });
});

describe('REL-013 AC3 — loading, rows and partial are three different screens', () => {
  it('says it is looking while the host has not answered', () => {
    const words = text(render(<TemplatesTabBody gallery={LOADING_SHELF} />));
    expect(words).toContain('Looking for templates');
  });

  it('🔴 …and the KNOWN-FIRING CONTROL beside it: a settled empty shelf says the opposite', () => {
    // The pair that has to disagree. Without this, "the loading text renders" is equally true of
    // a component that renders the loading text unconditionally — a spinner that never resolves,
    // which is one of the two failures AC4 names by name.
    const words = text(render(<TemplatesTabBody gallery={EMPTY_SHELF} />));
    expect(words).not.toContain('Looking for templates');
  });

  it('draws the short-shelf notice BESIDE the rows, not instead of them', () => {
    const partial = 'Some templates could not be loaded (Community), so this list may be short.';
    const tree = render(<TemplatesTabBody gallery={{ items: [row()], isLoading: false, partial }} />);
    const words = text(tree);

    expect(words).toContain(partial);
    // 🔴 The rows are still there. A provider outage arrives as a SHORTER list, and drawing the
    // notice instead of the list would throw away the templates that did arrive.
    expect(words).toContain('Members area');
    expect(byClass(tree, 'TemplateCard').length).toBe(1);
  });

  it('offers the retry the host supplied, and calls it', () => {
    const calls: number[] = [];
    const tree = render(
      <TemplatesTabBody
        gallery={{
          items: [row()],
          isLoading: false,
          partial: 'Some templates could not be loaded (Community), so this list may be short.',
          onRetry: () => calls.push(1)
        }}
      />
    );
    const retry = byClass(tree, 'TemplatesTab-retry')[0];
    expect(retry).toBeDefined();
    (retry.props.onClick as () => void)();
    expect(calls.length).toBe(1);
  });

  it('says nothing about a short shelf when nothing was short', () => {
    const words = text(render(<TemplatesTabBody gallery={shelfOf(row())} />));
    expect(words).not.toContain('could not be loaded');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// AC4 — 🔴 THE SHIPPED STATE
// ═══════════════════════════════════════════════════════════════════════════════

describe('REL-013 AC4 — the empty shelf is the shipped state and it must read as an answer', () => {
  it('🔴 says nothing is published yet, in words, on a settled empty shelf', () => {
    const words = text(render(<TemplatesTabBody gallery={EMPTY_SHELF} onCreateProject={() => undefined} />));

    expect(words).toContain('No templates published yet');
    // The sentence that says *this is not a failure*. Its absence is what turns a bare panel into
    // something a person reads as broken.
    expect(words).toContain('Nothing has gone wrong');
  });

  it('🔴 is not a spinner and is not blank', () => {
    const tree = render(<TemplatesTabBody gallery={EMPTY_SHELF} onCreateProject={() => undefined} />);

    expect(tree).not.toBeNull();
    expect(text(tree)).not.toContain('Looking for templates');
    expect(byClass(tree, 'TemplatesTab-empty').length).toBe(1);
  });

  it('🔴 is BETTER THAN THE SENTENCE IT REPLACES — the placeholder is gone from the source', () => {
    // Trap 1: `Projects.tsx` links here from the first-launch welcome, so this tab is the first
    // thing a brand-new user is offered. Asserted against the file with its comments stripped —
    // a module note quoting the old sentence must not satisfy this.
    const tabSource = sourceOf(join(LAUNCHER_SRC, 'views/Templates.tsx'));
    expect(tabSource).not.toContain('coming soon');
    expect(tabSource).not.toContain('will be displayed here');
  });

  it('hands over the thing you came here to do — the create route, from the empty panel', () => {
    const calls: number[] = [];
    const tree = render(<TemplatesTabBody gallery={EMPTY_SHELF} onCreateProject={() => calls.push(1)} />);

    const buttons = walk(tree).filter((n) => n.type === 'button' && n.ownText === 'New project');
    expect(buttons.length).toBe(1);
    (buttons[0].props.onClick as () => void)();
    expect(calls.length).toBe(1);
  });

  it('🔴 an UNREADABLE shelf is not an empty one, and the two get opposite screens', () => {
    // The absence rule: "no rows" and "we could not find out" are opposite facts with opposite
    // fixes. `galleryFromListing` reports a provider that could not answer as `partial`, so zero
    // rows WITH a partial must never claim the shelf is bare.
    const partial = 'Some templates could not be loaded (Community), so this list may be short.';
    const words = text(
      render(<TemplatesTabBody gallery={{ items: [], isLoading: false, partial, onRetry: () => undefined }} />)
    );

    expect(words).toContain('Templates could not be loaded');
    expect(words).toContain(partial);
    expect(words).not.toContain('No templates published yet');
    expect(words).toContain('Try again');
  });

  it('…and the control: the SAME empty shelf with nothing to report says the other thing', () => {
    const words = text(render(<TemplatesTabBody gallery={EMPTY_SHELF} />));
    expect(words).toContain('No templates published yet');
    expect(words).not.toContain('Templates could not be loaded');
  });

  it('🔴 the shipped empty state is what `galleryFromListing` ACTUALLY produces from a held shelf', () => {
    // 🔴 Not a hand-written `{ items: [], isLoading: false }`. A budget measured on a fixture is a
    // budget on the fixture: this drives the real mapping with the listing an all-held embedded
    // provider and a quiet platform produce, and asserts the screen that comes out of it.
    const gallery = galleryFromListing({ items: [], failures: [] });
    expect(gallery.items.length).toBe(0);
    expect(gallery.partial).toBeUndefined();

    const words = text(
      render(<TemplatesTabBody gallery={{ ...gallery, isLoading: false }} onCreateProject={() => undefined} />)
    );
    expect(words).toContain('No templates published yet');
  });

  it('a bare shelf that ALSO had a failure comes out of the mapping as the unreadable screen', () => {
    const gallery = galleryFromListing({
      items: [],
      failures: [{ provider: 'community-templates', reason: 'ECONNREFUSED' }]
    });
    const words = text(render(<TemplatesTabBody gallery={{ ...gallery, isLoading: false }} />));

    expect(words).toContain('Templates could not be loaded');
    expect(words).toContain('Community');
    expect(words).not.toContain('No templates published yet');
  });

  it('⚠️ an UNWIRED host is a third fact again, and does not claim an empty shelf', () => {
    const words = text(render(<TemplatesTabBody />));
    expect(words).toContain('not available in this build');
    expect(words).not.toContain('No templates published yet');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// The filter — the wizard's producer, not a second one
// ═══════════════════════════════════════════════════════════════════════════════

describe('REL-013 — narrowing the shelf reuses FB-005 T4\u2019s one producer', () => {
  it('tells "no templates at all" from "nothing matches what you typed"', () => {
    const words = text(
      render(
        <TemplatesTabBody
          gallery={shelfOf(row())}
          filter={{ category: null, query: 'zzzznothing' }}
          onFilterChange={() => undefined}
        />
      )
    );

    expect(words).toContain('No templates match that search');
    // 🔴 NOT the empty-shelf sentence — one of these is our fault and the other is one button away.
    expect(words).not.toContain('No templates published yet');
    expect(words).toContain('Clear filters');
  });

  it('a pill\u2019s count is the rows behind it', () => {
    const tree = render(
      <TemplatesTabBody
        gallery={shelfOf(row({ category: 'data-app' }), row({ url: 'e://b', category: 'starter' }))}
        onFilterChange={() => undefined}
      />
    );
    const pills = byClass(tree, 'TemplatesTab-pill').map((p) => p.ownText);

    // ⚠️ The ✓ is part of the ACTIVE pill's text, not a decoration beside it — FB-002 shipped a
    // selected pill at 1.16:1 and a state carried only by fill is a state somebody cannot see.
    // So the "All" pill's label is asserted WITH it: dropping the mark would redden this.
    expect(pills).toContain('All (2) ✓');
    expect(pills).toContain('Starter (1)');
    expect(pills).toContain('Data app (1)');
  });

  it('does not carry a second matcher of its own', () => {
    // The one producer. A copy of `filterTemplates` here is exactly how a pill's count stops
    // meaning the rows beside it, and nothing in a "does it render?" test can see the drift.
    const tabSource = sourceOf(join(LAUNCHER_SRC, 'views/Templates.tsx'));
    expect(tabSource).toContain('filterTemplates');
    expect(tabSource).not.toContain('function filterTemplates');
    expect(tabSource).not.toContain('scoreTemplate');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// AC5 + Trap 3 — one creation route, and it is the one that reads needsBackend
// ═══════════════════════════════════════════════════════════════════════════════

describe('REL-013 AC5 — picking from the tab creates by the wizard\u2019s path', () => {
  it('a row\u2019s click reports the URL and does nothing else', () => {
    const chosen: string[] = [];
    const tree = render(<TemplatesTabBody gallery={shelfOf(row())} onUseTemplate={(url) => chosen.push(url)} />);

    const card = byClass(tree, 'TemplateCard')[0];
    (card.props.onClick as () => void)();
    expect(chosen).toEqual(['community://members-area']);
  });

  it('🔴 the tab CANNOT create, install or fetch anything — Trap 3, as an absence over the file', () => {
    // A create path from this tab that dropped `needsBackend` would re-enter SBR-001 by a new
    // door. The strongest available guarantee is that there is no second path at all.
    const tabSource = sourceOf(join(LAUNCHER_SRC, 'views/Templates.tsx'));
    for (const forbidden of ['newProject', 'templateRegistry', 'createProjectFromTemplate', 'needsBackend', 'fetch(']) {
      expect(tabSource).not.toContain(forbidden);
    }
  });

  it('the host turns that URL into an open wizard, not into a project', () => {
    const projectsPage = sourceOf(join(EDITOR_SRC, 'pages/ProjectsPage/ProjectsPage.tsx'));
    expect(projectsPage).toContain('onUseTemplate={handleUseTemplate}');
    expect(projectsPage).toContain('initialTemplateUrl={wizardTemplateUrl}');
    // Still exactly one creation call in the page, and it is `handleCreateProjectConfirm`'s.
    expect([...projectsPage.matchAll(/LocalProjectsModel\.instance\.newProject\(/g)].length).toBe(1);
  });

  it('🔴 the seed sets the MODE, which is the condition needsBackend is read under', () => {
    // `handleNext` passes `mode === 'template' ? selectedTemplateUrl : ''`, and
    // `handleCreateProjectConfirm` reads `mode === 'template' && items.find(...)?.needsBackend`.
    // A seed that set the URL without the mode would create the DEFAULT template while Review
    // named another one — and would never look up `needsBackend` at all.
    const seed = seedWizardState({ initialTemplateUrl: 'community://members-area' });

    expect(seed).toBeDefined();
    expect(seed?.mode).toBe('template');
    expect(seed?.selectedTemplateUrl).toBe('community://members-area');
  });

  it('lands on basics, so the name and the folder are still collected', () => {
    const seed = seedWizardState({ initialTemplateUrl: 'community://members-area' });
    expect(seed?.currentStep).toBe('basics');

    // …and the picker and Review are still ahead of it, so the choice can be changed and is named
    // before anything is created.
    expect(getStepSequence('template')).toEqual(['basics', 'template', 'review']);
  });

  it('a seeded wizard passes the template step\u2019s own validity check', () => {
    // `WizardProvider`'s own defaults, then the seed on top \u2014 the exact composition the provider
    // performs, written out rather than spread, so this asserts against the real `isStepValid`
    // and not against a shape TypeScript widened on the way in.
    const seed = seedWizardState({ initialTemplateUrl: 'community://members-area' });
    const state: WizardState = {
      mode: seed?.mode ?? 'quick',
      currentStep: seed?.currentStep ?? 'entry',
      projectName: '',
      description: '',
      location: '',
      selectedPresetId: 'modern',
      selectedTemplateUrl: seed?.selectedTemplateUrl ?? ''
    };

    expect(isStepValid('template', state)).toBe(true);

    // \ud83d\udd34 The control: without the seed the same step is INVALID, which is `TemplateStep`'s own
    // rule \u2014 "there is no default; a picker that pre-selected a row would send someone to Review
    // with a template they never looked at".
    expect(isStepValid('template', { ...state, selectedTemplateUrl: '' })).toBe(false);
  });

  it('🔴 THE CONTROL: with no template asked for, the wizard is seeded exactly as before', () => {
    // The pair that has to disagree. Without it, "the seed sets template mode" is equally true of
    // a `seedWizardState` that returned template mode unconditionally — which would put every
    // "New project" click into a template flow.
    expect(seedWizardState({})).toBeUndefined();
    expect(seedWizardState({ initialTemplateUrl: '' })).toBeUndefined();

    const locationOnly = seedWizardState({ initialLocation: '/tmp/projects' });
    expect(locationOnly).toEqual({ location: '/tmp/projects' });
    expect(locationOnly?.mode).toBeUndefined();
  });

  it('both openers set the template, so neither inherits the other\u2019s last one', () => {
    const projectsPage = sourceOf(join(EDITOR_SRC, 'pages/ProjectsPage/ProjectsPage.tsx'));
    // `handleCreateProject` clears it; `handleUseTemplate` sets it. Two writers, no reader that
    // could be looking at a stale value.
    expect([...projectsPage.matchAll(/setWizardTemplateUrl\(/g)].length).toBe(2);
    expect(projectsPage).toContain("setWizardTemplateUrl('')");
  });
});
