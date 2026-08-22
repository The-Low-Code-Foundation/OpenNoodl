/**
 * NAT-012 AC3 — where the launcher lands when a door in the editor sends you there.
 *
 * The ruling (Richard, 2026-08-22) is that going to the launcher **closes the project**, the
 * control says so, and reopening puts you back on the component you were on. This file grades the
 * landing; the label is graded in `panel-is-a-door.test.ts` beside it.
 *
 * 🔴 **The place half was deleted by the drive, not descoped.** This file used to grade a
 * `rememberEditorPlace` / `takeEditorPlace` pair. Driving AC3 on 2026-08-22 showed the pair never
 * affected what the reader saw — `useSwitchToDefaultComponent` (`UseSetupNodeGraph.ts:26`)
 * overwrote its restore on every open, and the restore AC3 asks for is `EditorDocument`'s
 * persisted `selectedComponentName`, which predates this task. Those specs all passed on code
 * with no consequence, which is the reason AC3 says the claim is **driven**. What the ordinary
 * exit control does is now the arm that keeps this file honest: it closes the project too and
 * lands on **Projects**, so a landing that survived its own read would be visible immediately.
 *
 * ⚠️ `launcherHandoff.ts` imports **nothing**, which is why this can be a direct-import spec at
 * all — the gesture half (`leaveForLauncher.ts`) pulls in `App` and `ProjectModel` and is graded
 * from source there.
 */

import {
  resetLauncherHandoff,
  stashLauncherLanding,
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
