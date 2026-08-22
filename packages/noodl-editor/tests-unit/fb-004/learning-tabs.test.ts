/**
 * FB-004 — the Learning tab is two tabs, and which one opens.
 *
 * Richard, 2026-08-22: *"The 'Your path' thing dominates the learning page in the
 * launcher, it should be two tabs no? Otherwise you have to scroll down a page
 * every time you want to see your actual installed lessons."*
 *
 * 🔴 This is the **third** report of this class (FIX-024, FIX-025 §2/§3), which
 * is why the default gets a spec rather than a comment: the failure mode each
 * time has been a learning surface quietly ending up first, and each time
 * nothing was watching the ordering.
 *
 * ⚠️ It grades `learningTabs`, not the view. `Learning` reads context and `Tabs`
 * holds state, so neither survives `tests-unit`'s element walker — it invokes
 * function components directly and any hook call throws. The last test here is
 * the weaker source-level half, checking the view still asks this function
 * rather than deciding for itself.
 */

import fs from 'fs';
import path from 'path';

import { learningTabs } from '@noodl-core-ui/preview/launcher/Launcher/views/learningTabs';

describe('which tabs exist', () => {
  it('draws both when there is a path to draw', () => {
    expect(learningTabs({ installedLessonCount: 2, pathState: 'path' }).tabs).toEqual(['lessons', 'path']);
  });

  it.each(['intake', 'loading', 'signed-out', 'unreachable'] as const)(
    'draws both when the path is in its `%s` state — an unfinished path is still a path',
    (pathState) => {
      expect(learningTabs({ installedLessonCount: 2, pathState }).tabs).toEqual(['lessons', 'path']);
    }
  );

  it('🔴 draws NO path tab for a D15-refused viewer', () => {
    // The section draws nothing for `hidden`; a strip around it would put the
    // words "Your path" on the screen anyway and leak the refusal through the
    // chrome. Paired with the control above, which is the same call returning
    // two tabs — so "one tab" here is a decision, not a function that did
    // nothing.
    expect(learningTabs({ installedLessonCount: 2, pathState: 'hidden' }).tabs).toEqual(['lessons']);
  });

  it('draws no path tab when no host wired one (Storybook)', () => {
    expect(learningTabs({ installedLessonCount: 2, pathState: undefined }).tabs).toEqual(['lessons']);
  });

  it('shows the shelf whatever happens to the path', () => {
    for (const pathState of ['path', 'hidden', undefined] as const) {
      expect(learningTabs({ installedLessonCount: 0, pathState }).tabs).toContain('lessons');
    }
  });
});

describe('which tab opens', () => {
  it('opens on the shelf when there are lessons on it — the complaint', () => {
    expect(learningTabs({ installedLessonCount: 1, pathState: 'path' }).active).toBe('lessons');
  });

  it('opens on the path when the shelf is empty — UNI-007s argument, kept', () => {
    // An empty grid explaining a folder format is not a first screen.
    expect(learningTabs({ installedLessonCount: 0, pathState: 'intake' }).active).toBe('path');
  });

  it('🔴 recomputes from the shelf rather than latching: 0 lessons then 3 opens on the shelf', () => {
    // The host's `learning` starts `[]` and is filled by an effect. A default
    // computed once at mount would read that empty array and open on the path
    // for everybody — the fix reintroducing the bug it fixes.
    const firstRender = learningTabs({ installedLessonCount: 0, pathState: 'path' });
    const afterLessonsArrive = learningTabs({ installedLessonCount: 3, pathState: 'path' });
    expect(firstRender.active).toBe('path');
    expect(afterLessonsArrive.active).toBe('lessons');
  });

  it('respects a click, and keeps respecting it', () => {
    expect(learningTabs({ installedLessonCount: 3, pathState: 'path', chosen: 'path' }).active).toBe('path');
    expect(learningTabs({ installedLessonCount: 0, pathState: 'path', chosen: 'lessons' }).active).toBe('lessons');
  });

  it('cannot open a tab it does not draw', () => {
    // A learner who picked `path` before a school switched the community off.
    const plan = learningTabs({ installedLessonCount: 0, pathState: 'hidden', chosen: 'path' });
    expect(plan.tabs).not.toContain('path');
    expect(plan.active).toBe('lessons');
  });
});

describe('the view is the caller', () => {
  const source = fs.readFileSync(
    path.join(
      __dirname,
      '..',
      '..',
      '..',
      'noodl-core-ui',
      'src',
      'preview',
      'launcher',
      'Launcher',
      'views',
      'Learning.tsx'
    ),
    'utf8'
  );

  it('asks `learningTabs` instead of deciding for itself', () => {
    expect(source).toContain('learningTabs({');
    expect(source).toContain('plan.tabs.map(');
    expect(source).toContain('activeTab={plan.active}');
  });

  it('labels the two tabs the way Richard named them', () => {
    expect(source).toContain("lessons: 'Installed lessons'");
    expect(source).toContain("path: 'Your path'");
  });
});
