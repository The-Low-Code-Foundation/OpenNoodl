/**
 * REL-019 §3 — a spine step with an installed copy OPENS IT.
 *
 * Richard, 2026-09-06: *"you can't actually click any of the spine steps to open the tutorial."*
 *
 * 🔴 Every "it is a control" arm is paired with the same step drawn WITHOUT a copy, which must
 * stay exactly the inert row UNI-007 specced — so an assertion about a button that appeared is
 * never satisfied by a walk that saw a different tree.
 *
 * @module noodl-editor/tests-unit/rel-019/path-open-render
 */
import React from 'react';

import {
  LearnerPathSection,
  installedOnPath,
  installedStepsFrom,
  type LauncherLearnerPath,
  type LauncherPathInstalledStep,
  type PathStepView
} from '@noodl-core-ui/preview/launcher/Launcher/components/LearnerPathSection';

import { render, text, walk } from '../support/renderElements';

function step(over: Partial<PathStepView> = {}): PathStepView {
  return {
    position: 1,
    slug: 'poke-it',
    title: 'Poke it',
    description: 'The card ignores you.',
    reason: 'Part of the spine everybody walks.',
    standing: 'In writing',
    installable: false,
    minutes: 30,
    projection: null,
    projectable: true,
    ...over
  };
}

const TRUTH =
  'This is your path — 2 lessons in the order they build on each other. None of them can be installed yet: every one is still being written.';

function path(steps: PathStepView[], over: Record<string, unknown> = {}): LauncherLearnerPath {
  return { state: 'path', truth: TRUTH, ready: 0, total: steps.length, duration: '1 hour', steps, omitted: [], answers: null, ...over } as LauncherLearnerPath;
}

const STEPS = [step(), step({ position: 2, slug: 'snacks', title: 'Snacks' })];
const INSTALLED: Record<string, LauncherPathInstalledStep> = {
  'poke-it': { id: 'shipped_poke-it', state: 'in-progress', progressPercent: 40 }
};

const byTest = (tree: ReturnType<typeof render>, prefix: string) =>
  walk(tree).filter((n) => String(n.props['data-test'] ?? '').startsWith(prefix));

describe('installedStepsFrom — the join', () => {
  it('keys the shelf by slug and ignores cards with none', () => {
    const map = installedStepsFrom([
      { id: 'shipped_poke-it', slug: 'poke-it', state: 'not-started', progressPercent: 0 },
      { id: 'mine', state: 'in-progress', progressPercent: 50 }
    ]);
    expect(Object.keys(map)).toEqual(['poke-it']);
    expect(map['poke-it']).toEqual({ id: 'shipped_poke-it', state: 'not-started', progressPercent: 0 });
  });

  it('prefers the copy that is further along when a lesson is on the shelf twice', () => {
    const map = installedStepsFrom([
      { id: 'shipped_poke-it', slug: 'poke-it', state: 'not-started', progressPercent: 0 },
      { id: 'poke-it', slug: 'poke-it', state: 'in-progress', progressPercent: 40 }
    ]);
    expect(map['poke-it'].id).toBe('poke-it');
    // …and the order of arrival does not change that.
    const reversed = installedStepsFrom([
      { id: 'poke-it', slug: 'poke-it', state: 'in-progress', progressPercent: 40 },
      { id: 'shipped_poke-it', slug: 'poke-it', state: 'not-started', progressPercent: 0 }
    ]);
    expect(reversed['poke-it'].id).toBe('poke-it');
  });

  it('carries `missing`, so a step cannot open a folder that is gone', () => {
    const map = installedStepsFrom([{ id: 'x', slug: 'poke-it', state: 'not-started', progressPercent: 0, missing: true }]);
    expect(map['poke-it'].missing).toBe(true);
  });

  it('installedOnPath counts the steps the shelf holds', () => {
    expect(installedOnPath(STEPS, INSTALLED)).toBe(1);
    expect(installedOnPath(STEPS, undefined)).toBe(0);
  });
});

describe('a step with an installed copy', () => {
  const opened: string[] = [];
  const tree = render(
    <LearnerPathSection surface={path(STEPS)} installed={INSTALLED} onOpenStep={(slug) => opened.push(slug)} />
  );

  it('is a control twice over — the title and a button — and only that step is', () => {
    expect(byTest(tree, 'learning-open-').length).toBe(0); // not the shelf's control
    expect(byTest(tree, 'learner-path-open-title-').map((n) => n.props['data-test'])).toEqual([
      'learner-path-open-title-poke-it'
    ]);
    expect(byTest(tree, 'learner-path-open-').filter((n) => !String(n.props['data-test']).includes('title')).map((n) => n.props['data-test'])).toEqual([
      'learner-path-open-poke-it'
    ]);
  });

  it('opens by SLUG, and both controls open the same thing', () => {
    (byTest(tree, 'learner-path-open-title-poke-it')[0].props.onClick as () => void)();
    (byTest(tree, 'learner-path-open-poke-it')[0].props.onClick as () => void)();
    expect(opened).toEqual(['poke-it', 'poke-it']);
  });

  it('shows the COPY’S state where the platform’s standing would be', () => {
    const state = byTest(tree, 'learner-path-lesson-state-poke-it')[0];
    expect(text(state)).toBe('In progress · 40%');
    expect(byTest(tree, 'learner-path-standing-poke-it')).toHaveLength(0);
    // The uninstalled step still carries the platform's word.
    expect(text(byTest(tree, 'learner-path-standing-snacks')[0])).toBe('In writing');
  });

  it('labels the button by state', () => {
    const done = render(
      <LearnerPathSection
        surface={path(STEPS)}
        installed={{ 'poke-it': { id: 'x', state: 'completed', progressPercent: 100 } }}
        onOpenStep={() => undefined}
      />
    );
    expect(text(byTest(done, 'learner-path-open-poke-it')[0])).toBe('Open again');
    const fresh = render(
      <LearnerPathSection
        surface={path(STEPS)}
        installed={{ 'poke-it': { id: 'x', state: 'not-started', progressPercent: 0 } }}
        onOpenStep={() => undefined}
      />
    );
    expect(text(byTest(fresh, 'learner-path-open-poke-it')[0])).toBe('Start this lesson');
    expect(text(byTest(tree, 'learner-path-open-poke-it')[0])).toBe('Continue');
  });

  it('says, under the platform’s truth, that the shelf disagrees with it', () => {
    // The platform's sentence is drawn verbatim (UNI-007) — and the launcher's own line follows.
    expect(text(byTest(tree, 'learner-path-truth')[0])).toBe(TRUTH);
    expect(text(byTest(tree, 'learner-path-installed-note')[0])).toContain('One of these lessons is already installed');
  });

  it('a missing folder is not a control, and says why', () => {
    const gone = render(
      <LearnerPathSection
        surface={path(STEPS)}
        installed={{ 'poke-it': { id: 'x', state: 'not-started', progressPercent: 0, missing: true } }}
        onOpenStep={() => undefined}
      />
    );
    expect(byTest(gone, 'learner-path-open-poke-it')).toHaveLength(0);
    expect(byTest(gone, 'learner-path-open-title-poke-it')).toHaveLength(0);
    expect(text(byTest(gone, 'learner-path-missing-poke-it')[0])).toContain('no longer on disk');
  });
});

describe('🔴 the paired control — the same step with nothing installed', () => {
  it('is the inert row UNI-007 specced: no open control, the platform’s standing, no note', () => {
    const tree = render(<LearnerPathSection surface={path(STEPS)} />);
    expect(byTest(tree, 'learner-path-open-')).toHaveLength(0);
    expect(byTest(tree, 'learner-path-lesson-state-')).toHaveLength(0);
    expect(byTest(tree, 'learner-path-installed-note')).toHaveLength(0);
    expect(text(byTest(tree, 'learner-path-standing-poke-it')[0])).toBe('In writing');
  });

  it('a copy with no `onOpenStep` is shown as installed but is not a control', () => {
    const tree = render(<LearnerPathSection surface={path(STEPS)} installed={INSTALLED} />);
    expect(byTest(tree, 'learner-path-open-')).toHaveLength(0);
    expect(text(byTest(tree, 'learner-path-lesson-state-poke-it')[0])).toBe('In progress · 40%');
  });

  it('the note is not drawn when the platform already counts the lesson ready', () => {
    const tree = render(
      <LearnerPathSection surface={path(STEPS, { ready: 1 })} installed={INSTALLED} onOpenStep={() => undefined} />
    );
    expect(byTest(tree, 'learner-path-installed-note')).toHaveLength(0);
  });
});
