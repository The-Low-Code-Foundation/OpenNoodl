/**
 * F41 — ⌘B on a floating panel must not return it docked.
 *
 * `SidePanelMode` is a single enum, so `setMode('hidden')` overwrote 'floating'
 * and un-hiding hardcoded 'docked': the mode you were working in vanished on a
 * hide/show round trip. The fix carries the mode the panel was hidden *from*,
 * which keeps the modes CSS-only — PNL-009's constraint, since re-parenting
 * would break the legacy `Frame`-hosted panels.
 *
 * The transitions are pure functions precisely so this round trip is provable
 * without React test infra, which this suite does not have.
 */
import {
  dockTransition,
  hideTransition,
  revealTransition,
  SidePanelHideState,
  toggleHiddenTransition
} from '../../src/editor/src/pages/EditorPage/useSidePanelLayout';

const at = (mode: SidePanelHideState['mode'], remembered: SidePanelHideState['remembered'] = 'docked') =>
  ({ mode, remembered } as SidePanelHideState);

describe('F41 side panel hide/reveal transitions', () => {
  it('⌘B on a floating panel hides it and brings it back FLOATING', () => {
    const hidden = toggleHiddenTransition(at('floating'));
    expect(hidden.mode).toBe('hidden');
    expect(hidden.remembered).toBe('floating');

    const back = toggleHiddenTransition(hidden);
    expect(back.mode).toBe('floating');
  });

  it('⌘B on a full panel brings it back FULL', () => {
    const back = toggleHiddenTransition(toggleHiddenTransition(at('full')));
    expect(back.mode).toBe('full');
  });

  it('⌘B on a docked panel still returns it docked', () => {
    const hidden = toggleHiddenTransition(at('docked'));
    expect(hidden.mode).toBe('hidden');
    expect(toggleHiddenTransition(hidden).mode).toBe('docked');
  });

  it('⌘B on a wide panel brings it back wide', () => {
    // Wide is cleared on a *panel switch* by design; hiding is not a switch.
    const back = toggleHiddenTransition(toggleHiddenTransition(at('wide')));
    expect(back.mode).toBe('wide');
  });

  it('hiding twice does not forget where it came from', () => {
    const once = hideTransition(at('floating'));
    const twice = hideTransition(once);
    expect(twice.mode).toBe('hidden');
    expect(twice.remembered).toBe('floating');
    expect(revealTransition(twice).mode).toBe('floating');
  });

  it('clicking a rail icon reveals a hidden floating panel as floating', () => {
    // `revealIfHidden` — the rail must not silently dock what it reveals.
    expect(revealTransition(hideTransition(at('floating'))).mode).toBe('floating');
  });

  it('revealing a visible panel is a no-op', () => {
    expect(revealTransition(at('floating', 'full'))).toEqual(at('floating', 'full'));
    expect(revealTransition(at('docked'))).toEqual(at('docked'));
  });

  it('docking retires the remembered mode, so a later ⌘B round trip stays docked', () => {
    const docked = dockTransition();
    expect(docked).toEqual(at('docked'));

    // Float, hide, dock (Escape), then hide/show again: must NOT resurrect float.
    const afterEscape = dockTransition();
    const back = toggleHiddenTransition(toggleHiddenTransition(afterEscape));
    expect(back.mode).toBe('docked');
  });
});
