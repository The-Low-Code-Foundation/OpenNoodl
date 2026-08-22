/**
 * NAT-012 AC3 — what the editor remembers while you are away at the launcher.
 *
 * The ruling (Richard, 2026-08-22) is that going to the launcher **closes the project**, the
 * control says so, and reopening puts you back on the component you were on. This file grades the
 * remembering; the label is graded in `panel-is-a-door.test.ts` beside it.
 *
 * ⚠️ `launcherHandoff.ts` imports **nothing**, which is why this can be a direct-import spec at
 * all — the gesture half (`leaveForLauncher.ts`) pulls in `App`, `ProjectModel` and the node graph
 * and is graded from source there.
 */

import {
  rememberEditorPlace,
  resetLauncherHandoff,
  stashLauncherLanding,
  takeEditorPlace,
  takeLauncherLanding
} from '../../src/editor/src/utils/launcher/launcherHandoff';

beforeEach(() => resetLauncherHandoff());

describe('the landing page is a one-shot request, not a preference', () => {
  it('hands back what was stashed', () => {
    stashLauncherLanding('community');
    expect(takeLauncherLanding()).toBe('community');
  });

  /**
   * 🔴 **The row that separates this from the key FIX-025 stopped consulting.**
   * `usePersistentTab` still *writes* `noodl-launcher-active-tab` and no longer *reads* it,
   * because Richard asked twice for the launcher to open on Projects. A landing that survived its
   * own read would be that defect rebuilt in a new module: close a second project and you would
   * land on Community again, having asked for nothing.
   */
  it('and is GONE on the second read, so a later launcher mount lands on Projects', () => {
    stashLauncherLanding('community');
    takeLauncherLanding();
    expect(takeLauncherLanding()).toBeUndefined();
  });

  it('answers undefined when nobody asked — the ordinary open', () => {
    expect(takeLauncherLanding()).toBeUndefined();
  });

  it('a second stash before any read wins, rather than queueing', () => {
    stashLauncherLanding('community');
    stashLauncherLanding('learning');
    expect(takeLauncherLanding()).toBe('learning');
  });
});

describe('the place is remembered per project', () => {
  it('gives back the component that project was left on', () => {
    rememberEditorPlace('proj-a', 'Pages/Home');
    expect(takeEditorPlace('proj-a')).toBe('Pages/Home');
  });

  /**
   * 🔴 Two projects open in one session — leave one for the launcher, open the other — must not
   * cross. This is the whole reason the store is a Map keyed by project id and not a single slot.
   */
  it('and never hands one project the other project’s place', () => {
    rememberEditorPlace('proj-a', 'Pages/Home');
    rememberEditorPlace('proj-b', 'Pages/Settings');

    expect({ a: takeEditorPlace('proj-a'), b: takeEditorPlace('proj-b') }).toEqual({
      a: 'Pages/Home',
      b: 'Pages/Settings'
    });
  });

  it('is consumed, so reopening a third time does not drag you back two opens', () => {
    rememberEditorPlace('proj-a', 'Pages/Home');
    takeEditorPlace('proj-a');
    expect(takeEditorPlace('proj-a')).toBeUndefined();
  });

  /**
   * ⚠️ Leaving with no component open is a real state — the canvas opens with none and you can
   * close the last one. A falsy name must CLEAR rather than store, or the reader is returned to a
   * component they had deliberately navigated away from.
   */
  it('an empty name clears the entry instead of storing a falsy key', () => {
    rememberEditorPlace('proj-a', 'Pages/Home');
    rememberEditorPlace('proj-a', undefined);
    expect(takeEditorPlace('proj-a')).toBeUndefined();
  });

  it('a project with no id is a no-op at both ends, not a crash', () => {
    expect(() => rememberEditorPlace(undefined, 'Pages/Home')).not.toThrow();
    expect(takeEditorPlace(undefined)).toBeUndefined();
  });

  it('remembers the newest place when the same project is left twice', () => {
    rememberEditorPlace('proj-a', 'Pages/Home');
    rememberEditorPlace('proj-a', 'Pages/Settings');
    expect(takeEditorPlace('proj-a')).toBe('Pages/Settings');
  });
});

describe('the two facts are independent', () => {
  /**
   * A door that stashes a landing but no place (nothing was open) and a project reopened without
   * ever having gone to the launcher are both ordinary. Neither read may be conditioned on the
   * other having happened.
   */
  it('taking the landing does not consume the place', () => {
    stashLauncherLanding('community');
    rememberEditorPlace('proj-a', 'Pages/Home');

    takeLauncherLanding();

    expect(takeEditorPlace('proj-a')).toBe('Pages/Home');
  });

  it('and taking the place does not consume the landing', () => {
    stashLauncherLanding('community');
    rememberEditorPlace('proj-a', 'Pages/Home');

    takeEditorPlace('proj-a');

    expect(takeLauncherLanding()).toBe('community');
  });
});
