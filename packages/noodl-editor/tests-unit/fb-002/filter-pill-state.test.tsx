/**
 * FB-002 / NAT-008 / FB-013 — the selected filter pill, measured rather than described.
 *
 * ## 🔴 The defect this file is a gate against, and why it took three surfaces to fix
 *
 * The shared `.FilterPill`'s selected state was carried by **fill alone**. Measured live in the
 * running editor (session 57, on the Chat tab), against the `.SectionCard` the pills sit on:
 *
 * | pair | was | needed |
 * |---|---|---|
 * | active fill vs panel | **1.36:1** | 3:1 (WCAG 1.4.11, a non-text state boundary) |
 * | active vs inactive fill | 1.94:1 | — |
 * | border, active vs inactive | **identical** (4.17:1 both) | — |
 * | label text vs its own fill | 8.46:1 | ✅ never the problem |
 *
 * Every *label* passed AA comfortably and **which pill was on was invisible**. FB-002 recorded it
 * on the Bench, NAT-008 inherited it on People and FB-013's C4 made it three — because the pill
 * markup was copied into three components over one shared class. So the fix is a shared
 * `FilterPill` component, and this file gates both halves of what it does.
 *
 * ## ⚠️ Token NAMES are read out of the stylesheet, never restated here
 *
 * Following `fix-005/dropdown-contrast.spec.ts`: a contrast spec carrying its own copy of the
 * token names keeps passing after somebody changes the rule it claims to grade. Everything below
 * is derived from `Community.module.scss` and `colors.css`.
 *
 * 🔴 **Comments are stripped first.** The rule this file grades has a comment *explaining* that it
 * uses `border-color` — an unstripped check would pass on the prose while the declaration was
 * gone, which is this repo's twice-bitten failure and `stripComments`'s whole reason to exist.
 *
 * ## 🔴 What this file CANNOT prove, and hands to the drive
 *
 * - That these rules **win**, or that the pill is painted at all. A declaration that loses to
 *   another selector is invisible from here.
 * - That the `✓` is legible, or that the border is where a person's eye goes. The numbers say the
 *   contrast is available, not that the design reads.
 *
 * @module noodl-editor/tests-unit/fb-002/filter-pill-state
 */
import * as fs from 'fs';
import * as path from 'path';

import React from 'react';

import {
  CommunityBenchView,
  CommunityChatView,
  CommunityDensity,
  CommunityDirectoryView,
  FilterPill
} from '@noodl-core-ui/components/community';

import { byClass, render, stripComments, text } from '../support/renderElements';
import { tokenContrast } from '../support/themeTokens';
import type { ThemeName } from '../support/themeTokens';

const COMMUNITY_DIR = path.join(__dirname, '../../../noodl-core-ui/src/components/community');
const SCSS = path.join(COMMUNITY_DIR, 'Community.module.scss');

const THEMES: ThemeName[] = ['dark', 'light'];

/** WCAG 1.4.11 — the boundary of a user interface component, which is what a selected state is. */
const COMPONENT = 3;

const source = fs.readFileSync(SCSS, 'utf8');
const declarations = stripComments(source);

/** The body of the rule whose selector text starts at `needle`, walking braces for nested SCSS. */
function ruleBody(needle: string): string {
  const at = declarations.indexOf(needle);
  expect(at).toBeGreaterThan(-1);
  const open = declarations.indexOf('{', at);
  let depth = 0;
  for (let i = open; i < declarations.length; i++) {
    if (declarations[i] === '{') depth++;
    else if (declarations[i] === '}' && --depth === 0) return declarations.slice(open + 1, i);
  }
  throw new Error(`unbalanced braces after ${needle}`);
}

/**
 * The token named by `property` in `body`, e.g. `--theme-color-primary`, or `null` when the rule
 * does not declare it.
 *
 * 🔴 **Returns `null` rather than asserting, and that is the difference between a red row and a
 * suite that does not run.** The first version called `expect()` here, at module scope — so the
 * mutant that deletes `border-color` (the exact regression that shipped) threw during collection
 * and jest reported **`Tests: 0 total`**: no named failure, and the fourteen unrelated rows in
 * this file silently stopped running with it. A missing declaration is a FINDING and has to be
 * reported as one, by the row whose sentence describes it.
 */
function tokenFor(body: string, property: string): string | null {
  const declaration = body
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.split(':')[0].trim() === property);
  if (declaration === undefined) return null;

  const token = declaration.match(/var\(\s*(--[\w-]+)\s*\)/);
  return token === null ? null : token[1];
}

const pill = ruleBody('.FilterPill {');
const active = ruleBody('&.is-active {');
/** The card every community section — Bench, People, Chat — is drawn inside. */
const card = ruleBody('.SectionCard {');

/**
 * The ratio between two tokens, or `0` when either is absent.
 *
 * ⚠️ `0` and not a throw: an absent token means the state is not being carried at all, which is
 * the *worst* score rather than an unmeasurable one — so it fails the floor and says so in the row
 * that owns the claim.
 */
function ratio(theme: ThemeName, foreground: string | null, background: string | null): number {
  if (foreground === null || background === null) return 0;
  return tokenContrast(theme, foreground, background);
}

const GROUND = tokenFor(card, 'background');
const RESTING_BORDER = tokenFor(pill, 'border');
const ACTIVE_BORDER = tokenFor(active, 'border-color');
const ACTIVE_FILL = tokenFor(active, 'background');

describe('FB-002 — a selected pill is visible without reading its fill', () => {
  describe('CONTROL: the instrument reached the real rules', () => {
    it('read the stylesheet, and found the three rules it grades', () => {
      expect(source.length).toBeGreaterThan(1000);
      expect([pill.length > 0, active.length > 0, card.length > 0]).toEqual([true, true, true]);
    });

    it('🔴 every token this file measures was actually found in the stylesheet', () => {
      expect({ GROUND, RESTING_BORDER, ACTIVE_BORDER, ACTIVE_FILL }).toEqual({
        GROUND: expect.stringMatching(/^--/),
        RESTING_BORDER: expect.stringMatching(/^--/),
        ACTIVE_BORDER: expect.stringMatching(/^--/),
        ACTIVE_FILL: expect.stringMatching(/^--/)
      });
    });

    it('🔴 and they are distinct names, not one token measured against itself', () => {
      expect(new Set([GROUND, RESTING_BORDER, ACTIVE_BORDER, ACTIVE_FILL]).size).toBeGreaterThan(1);
    });
  });

  /*
    🔴 BOTH SIDES OF THE BORDER, because a boundary is only a boundary against what sits on either
    side of it. A border that reads against the panel and dissolves into its own fill is still a
    line nobody can find — and grading only the outer side is exactly how the fill-only version
    would have scored well on the pair somebody happened to pick.
  */
  describe.each(THEMES)('%s theme', (theme) => {
    it('🔴 the active border clears 3:1 against the card it sits on', () => {
      expect(ratio(theme, ACTIVE_BORDER, GROUND)).toBeGreaterThanOrEqual(COMPONENT);
    });

    it('🔴 and clears 3:1 against its own fill', () => {
      expect(ratio(theme, ACTIVE_BORDER, ACTIVE_FILL)).toBeGreaterThanOrEqual(COMPONENT);
    });
  });

  it('🔴 the border CHANGES on selection — the identical-border defect, by name', () => {
    expect(ACTIVE_BORDER).not.toBe(RESTING_BORDER);
  });

  /*
    ⚠️ The regression this pins is the specific one that shipped: `is-active` setting only
    `background`/`color`. It asserts the rule still *declares* a border colour, which is the one
    thing the ratios above would stop measuring if it were deleted — `tokenFor` would throw, but
    it would throw as an error rather than as a sentence about the defect.
  */
  it('🔴 `is-active` declares a border colour and NOT a border width', () => {
    expect(active).toContain('border-color');
    expect(active).not.toMatch(/border\s*:/);
  });
});

const noop = () => undefined;
const pillOf = (active: boolean) => ({ key: 'k', label: 'Solved', count: 3, active });

describe('FB-002 — the state is said in text as well as drawn in colour', () => {
  /*
    🔴 WCAG 1.4.1: colour may not be the ONLY carrier of a state, however much contrast it has.
    So the pill draws a mark, and these rows are what a mutant deleting that branch fails.
  */
  const on = render(FilterPill({ filter: pillOf(true), onSelect: noop }) as React.ReactNode);
  const off = render(FilterPill({ filter: pillOf(false), onSelect: noop }) as React.ReactNode);

  it('CONTROL: both pills drew, and both carry their label and count', () => {
    expect([text(on), text(off)]).toEqual(['Solved 3 ✓', 'Solved 3']);
  });

  it('🔴 the selected pill carries a non-colour marker and the resting one does not', () => {
    expect([byClass(on, 'FilterPillMark').length, byClass(off, 'FilterPillMark').length]).toEqual([1, 0]);
  });

  it('🔴 `aria-pressed` still separates them for a screen reader', () => {
    expect([on?.props['aria-pressed'], off?.props['aria-pressed']]).toEqual([true, false]);
  });

  /*
    ⚠️ The marker is hidden from assistive tech ON PURPOSE — `aria-pressed` already says this, and
    letting the `✓` into the accessible name makes the button announce "Solved 3 ✓, pressed".
    This row is why that is a decision rather than a slip.
  */
  it('⚠️ the marker is `aria-hidden`, so selection does not change the accessible name', () => {
    expect(byClass(on, 'FilterPillMark')[0].props['aria-hidden']).toBe('true');
  });

  it('🔴 selection is reported by key, so a host cannot mistake which pill was clicked', () => {
    const asked: string[] = [];
    const node = render(FilterPill({ filter: pillOf(false), onSelect: (key) => asked.push(key) }) as React.ReactNode);
    (node?.props.onClick as () => void)();
    expect(asked).toEqual(['k']);
  });
});

describe('🔴 all three surfaces draw through the ONE pill, which is how this defect spread', () => {
  /*
    ⚠️ These view models are literals, and that is right HERE and wrong in `bench-filter-render`:
    that file grades the composer, so a literal would agree with nothing. This grades the pill, and
    the composers are irrelevant to whether the pill draws its state.
  */
  const filters = [pillOf(true), { key: 'other', label: 'Waiting', count: 1, active: false }];
  const section = { state: 'empty' } as const;

  const surfaces: [string, React.ReactNode][] = [
    [
      'Bench',
      CommunityBenchView({
        view: { section, summary: null, boundLine: null, emptyLine: 'Nobody has asked yet.', filters },
        onSelectFilter: noop,
        onOpenThread: noop,
        onRetry: noop,
        density: CommunityDensity.Page
      }) as React.ReactNode
    ],
    [
      'People',
      CommunityDirectoryView({
        view: {
          section,
          summary: null,
          boundLine: null,
          emptyLine: 'Nobody is here yet.',
          searchLabel: 'Search',
          query: '',
          filters
        },
        onQueryChange: noop,
        onToggleFilter: noop,
        onOpenPerson: noop,
        onRetry: noop,
        density: CommunityDensity.Page
      }) as React.ReactNode
    ],
    [
      'Chat',
      CommunityChatView({
        view: { section, summary: null, emptyLine: 'Nothing in #lounge yet.', filters },
        onSelectChannel: noop,
        onOpenThread: noop,
        onRetry: noop,
        density: CommunityDensity.Page
      }) as React.ReactNode
    ]
  ];

  it.each(surfaces)('%s draws the selected pill with its marker', (_name, node) => {
    const tree = render(node);
    expect(byClass(tree, 'FilterPill').length).toBe(2);
    expect(byClass(tree, 'FilterPillMark').length).toBe(1);
  });

  /*
    🔴 THE ANTI-DRIFT ROW. Three copies of seven lines over one class is how one defect reached
    three shipped tabs, and this phase has already lost a day to a nav list that was copied in two
    places. The class may be named in exactly one component.
  */
  /*
    🔴 THE PILLS WERE FINE AND THE GROUP WAS NAMELESS. Every row above passes on a surface
    whose filter bar is two loose buttons: they render, the marker draws, the contrast is there,
    and a screen reader still meets "Available for work, pressed" with nothing saying what is
    being narrowed. The Bench and the Chat carried `role="group"` and a label from the day they
    were written; the People directory never did, and no check in this file could see the gap.

    ⚠️ `ChipRow` names TWO different things in this directory — this filter bar, and the skill
    chips inside `CommunityPersonRow`. These surfaces render with `section.state === 'empty'`, so
    no person row exists and the row below is the filter bar; the length assertion is what makes
    that a claim rather than a coincidence.
  */
  const groupOf = (node: React.ReactNode) => {
    const rows = byClass(render(node), 'ChipRow');
    expect(rows).toHaveLength(1);
    return rows[0];
  };

  it.each(surfaces)('%s wraps its pills in a group that has a name', (_name, node) => {
    const row = groupOf(node);
    expect(row.props.role).toBe('group');
    expect(String(row.props['aria-label'] ?? '')).not.toHaveLength(0);
  });

  /*
    ⚠️ A name that does not distinguish is the same defect wearing a label: three bars all called
    "Filters" announce identically in a rotor listing every group on the page.
  */
  it('🔴 the three group names are DISTINCT — each says what IT is narrowing', () => {
    const labels = surfaces.map(([, node]) => groupOf(node).props['aria-label']);
    expect(new Set(labels).size).toBe(surfaces.length);
  });

  it('🔴 `FilterPill` is referenced by exactly ONE component in the directory', () => {
    const owners = fs
      .readdirSync(COMMUNITY_DIR)
      .filter((name) => name.endsWith('.tsx'))
      .filter((name) => stripComments(fs.readFileSync(path.join(COMMUNITY_DIR, name), 'utf8')).includes("css['FilterPill']"));

    expect(owners).toEqual(['CommunityFilterPill.tsx']);
  });
});
