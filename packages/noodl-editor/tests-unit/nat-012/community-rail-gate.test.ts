/**
 * NAT-012 AC7 — the rail icon is not drawn for a viewer D15 refused.
 *
 * ## 🔴 What this spec exists to catch, and it is NOT "the icon went away"
 *
 * The removal path AC7 needs looked like one line, because `SidebarModel` already had one: the
 * experimental-panel branch splices `items` and notifies. **That was measured against a live,
 * active Community panel in the editor on 2026-08-22, before anything was written**, and it
 * reads:
 *
 * | | naive splice | required |
 * |---|---|---|
 * | rail icon gone | ✅ | ✅ |
 * | `activeId` | 🔴 `'community'` | not `'community'` |
 * | `panels['community']` | 🔴 registered | gone |
 * | the panel itself | 🔴 **still drawing** | gone |
 *
 * So a refused viewer gets **the surface with no icon on it** — the inverse of D15, and worse
 * than the bug, because `CommunityPanel` returns `null` for a refused viewer of its own accord
 * and would have masked it all the way to a release.
 *
 * ⚠️ **Five of the rows below fail on the naive fix and the icon row does not.** That is the
 * point of them: `rail icon gone` is where a lazy drive and a lazy spec both stop.
 *
 * ## Mutation arms, MEASURED 2026-08-23 (not estimated — two of the first guesses were wrong)
 *
 * | mutation | reds |
 * |---|---|
 * | `unregister` is a no-op | **9** |
 * | `unregister` reduced to the naive body (splice `items` + notify) | **5** |
 * | drop only `delete this.panels[id]` | **2** |
 * | drop only the switch-away | **2** |
 * | drop only the `previousActiveId` clear | **1** |
 * | the gate unregisters unconditionally (both viewer states agree) | **4** |
 * | `prunePanels` is the identity — `SidePanel`'s pre-drive behaviour | **2** |
 * | `prunePanels` always returns a fresh object | **1** |
 *
 * 🔴 **The last row is the one that makes the rest mean anything.** A gate that removes the panel
 * for everybody satisfies every "the panel is gone" assertion ever written; only a paired reading
 * — refused *and* permitted, in the same test — can tell the fix from the sledgehammer.
 *
 * ⚠️ **The `previousActiveId` row was VACUOUS on its first draft** and is recorded here because
 * it is the shape this phase keeps meeting: it asserted `ActiveId !== 'community'` after a
 * `hidePanels()`, which is already true without the clear, because `delete panels[id]` stops the
 * panel coming back on its own. It read `0` reds against its own mutation. What the clear
 * actually buys is the *clean fallback* — without it `switch` takes its catch path and leaves the
 * rail on the transient property editor of a node that is no longer selected — so that is what
 * the row reads now, and it fails when the clear is removed.
 *
 * ## The gate's two states must DISAGREE
 *
 * A spec where the refused arm and the permitted arm both end with no panel proves nothing —
 * it is satisfied by a `resolveCommunityRail` that unregisters unconditionally, and by one that
 * throws on line one. Every gate row here is a pair.
 */

/**
 * ⚠️ `EditorSettings` constructs itself at import time and its constructor calls
 * `JSONStorage.get`, which is `StorageWeb`'s "Method not implemented." outside Electron — so
 * `sidebarmodel.tsx` cannot be imported into this jest run at all without this. The mock is the
 * two members the model actually uses, and nothing else.
 */
jest.mock('@noodl-utils/editorsettings', () => ({
  EditorSettings: {
    instance: {
      on: () => undefined,
      get: () => undefined
    }
  }
}));

const readCommunitySession = jest.fn();
const me = jest.fn();

jest.mock('@noodl-models/community/communitysession', () => ({
  readCommunitySession: () => readCommunitySession()
}));

jest.mock('@noodl-models/community/communityapi', () => ({
  CommunityApiClient: class {
    me() {
      return me();
    }
  }
}));

import { readFileSync } from 'fs';
import { join } from 'path';

import { notifyCommunityChanged } from '@noodl-models/community/communitychanged';
import { refusesCommunitySurface } from '@noodl-models/community/mirrorview';
import { SidebarModel } from '@noodl-models/sidebar';

import { installCommunityRailGate, resolveCommunityRail } from '../../src/editor/src/utils/community/communityRailGate';
import { prunePanels } from '../../src/editor/src/views/SidePanel/prunePanels';

const PANEL_ID = 'community';

/** A permitted `me`. `surface` is anything the platform does not call `absent`. */
const permitted = { outcome: 'ok', value: { community: { surface: 'ok' } } };
/** 🔴 D15's refusal: the org-minor whose school switched the community off. */
const refused = { outcome: 'ok', value: { community: { surface: 'absent' } } };

/** A stand-in panel component. Never rendered — the model only ever holds the reference. */
const Panel = () => null;

function registerRail() {
  SidebarModel.instance.reset();
  SidebarModel.instance.register({ id: 'components', name: 'Components', order: 1, panel: Panel });
  SidebarModel.instance.register({ id: PANEL_ID, name: 'Community', order: 5.9, panel: Panel });
}

beforeEach(() => {
  readCommunitySession.mockReset().mockResolvedValue(null);
  me.mockReset().mockResolvedValue(permitted);
  registerRail();
});

describe('SidebarModel.unregister — the removal is three things', () => {
  /** Put the panel in the state the measurement was taken in: registered AND active. */
  function makeActive() {
    SidebarModel.instance.switch(PANEL_ID);
    expect(SidebarModel.instance.ActiveId).toBe(PANEL_ID);
    expect(SidebarModel.instance.getActive()).toBeTruthy();
  }

  it('takes the icon off the rail — the row the naive fix already passed', () => {
    makeActive();
    SidebarModel.instance.unregister(PANEL_ID);

    expect(SidebarModel.instance.getItems().map((x) => x.id)).not.toContain(PANEL_ID);
    expect(SidebarModel.instance.getPanel(PANEL_ID)).toBeNull();
  });

  it('🔴 takes the CONSTRUCTED PANEL with it — fails on the naive fix', () => {
    makeActive();
    SidebarModel.instance.unregister(PANEL_ID);

    expect(SidebarModel.instance.getPanelComponent(PANEL_ID)).toBeUndefined();
  });

  it('🔴 stops the panel DRAWING, and switches away — fails on the naive fix', () => {
    makeActive();
    SidebarModel.instance.unregister(PANEL_ID);

    // `getActive()` is what `SidePanel` renders. This is the row that is the whole defect.
    expect(SidebarModel.instance.ActiveId).not.toBe(PANEL_ID);
    expect(SidebarModel.instance.ActiveId).toBe('components');
    expect(SidebarModel.instance.getActive()).toBeTruthy();
  });

  it('🔴 forgets it as previousActiveId, so hidePanels lands on the fallback', () => {
    // The other door into the same hole. `switchToNode` stores the panel you were on in
    // `previousActiveId`; `hidePanels` switches back to it when the node is deselected. If the
    // removed panel is still named there, that switch resolves to a panel whose component has
    // been deleted — `switch` throws inside `createPanel`, takes its catch, logs, and returns
    // having moved nothing, so the rail is left on the TRANSIENT property editor of a node that
    // is no longer selected.
    //
    // ⚠️ The first version of this row asserted only `ActiveId !== 'community'` and was
    // **vacuous** — it passed with the clear removed, because `delete panels[id]` already stops
    // the panel coming back. What the clear actually buys is the clean fallback below, and that
    // is what has to be read.
    SidebarModel.instance.register({ transient: true, id: 'PropertyEditor', name: 'Properties', panel: Panel });
    const internals = SidebarModel.instance as unknown as { previousActiveId: string; activeId: string };
    SidebarModel.instance.switch(PANEL_ID);
    SidebarModel.instance.switch('PropertyEditor');
    internals.previousActiveId = PANEL_ID;

    SidebarModel.instance.unregister(PANEL_ID);
    SidebarModel.instance.hidePanels();

    expect(SidebarModel.instance.ActiveId).toBe('components');
    expect(SidebarModel.instance.getActive()).toBeTruthy();
  });

  it('leaves every other panel alone — the control', () => {
    makeActive();
    SidebarModel.instance.unregister(PANEL_ID);

    expect(SidebarModel.instance.getItems().map((x) => x.id)).toContain('components');
    expect(SidebarModel.instance.getPanelComponent('components')).toBeTruthy();
  });

  it('is idempotent, and silent about an id nobody registered', () => {
    const heard: string[] = [];
    SidebarModel.instance.on('itemsChanged' as never, (() => heard.push('x')) as never, {});

    SidebarModel.instance.unregister(PANEL_ID);
    const afterFirst = heard.length;
    SidebarModel.instance.unregister(PANEL_ID);
    SidebarModel.instance.unregister('a-panel-that-was-never-registered');

    expect(heard.length).toBe(afterFirst);
  });
});

describe('refusesCommunitySurface — the one reading of D15', () => {
  it('🔴 refused and permitted DISAGREE', () => {
    expect(refusesCommunitySurface(refused as never)).toBe(true);
    expect(refusesCommunitySurface(permitted as never)).toBe(false);
  });

  it('a signed-out viewer is NOT refused — 401 is unauthenticated, never absent', () => {
    expect(refusesCommunitySurface({ outcome: 'unauthenticated' } as never)).toBe(false);
  });

  it('an editor that cannot reach the platform is NOT refused', () => {
    expect(refusesCommunitySurface({ outcome: 'unreachable', status: null, detail: 'x' } as never)).toBe(false);
    expect(refusesCommunitySurface(undefined)).toBe(false);
  });

  it('a 404 on `me` itself is NOT the surface refusal — that is a read outcome, not a policy', () => {
    expect(refusesCommunitySurface({ outcome: 'absent' } as never)).toBe(false);
  });
});

describe('the gate', () => {
  it('🔴 removes the panel for a refused viewer, and NOT for a permitted one', async () => {
    me.mockResolvedValue(refused);
    await resolveCommunityRail();
    const forRefused = SidebarModel.instance.getItems().map((x) => x.id);

    registerRail();
    me.mockResolvedValue(permitted);
    await resolveCommunityRail();
    const forPermitted = SidebarModel.instance.getItems().map((x) => x.id);

    expect(forRefused).not.toContain(PANEL_ID);
    expect(forPermitted).toContain(PANEL_ID);
  });

  it('🔴 removes the SURFACE for a refused viewer, not only the icon', async () => {
    SidebarModel.instance.switch(PANEL_ID);
    me.mockResolvedValue(refused);

    await resolveCommunityRail();

    expect(SidebarModel.instance.getPanelComponent(PANEL_ID)).toBeUndefined();
    expect(SidebarModel.instance.ActiveId).not.toBe(PANEL_ID);
  });

  it('leaves the panel alone when the platform is unreachable', async () => {
    me.mockResolvedValue({ outcome: 'unreachable', status: null, detail: 'offline' });
    await resolveCommunityRail();
    expect(SidebarModel.instance.getItems().map((x) => x.id)).toContain(PANEL_ID);
  });

  it('🔴 re-asks when the session changes — the in-editor sign-in path', async () => {
    const stop = installCommunityRailGate();
    await Promise.resolve();
    await Promise.resolve();
    // Permitted while signed out: still there.
    expect(SidebarModel.instance.getItems().map((x) => x.id)).toContain(PANEL_ID);

    // `AskAboutNodeDialog` signs in, as a viewer the school refused.
    me.mockResolvedValue(refused);
    notifyCommunityChanged('session');
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    expect(SidebarModel.instance.getItems().map((x) => x.id)).not.toContain(PANEL_ID);
    stop();
  });

  it('ignores a threads change — it cannot alter who is asking', async () => {
    const stop = installCommunityRailGate();
    await Promise.resolve();
    const callsAfterInstall = me.mock.calls.length;

    notifyCommunityChanged('threads');
    await Promise.resolve();

    expect(me.mock.calls.length).toBe(callsAfterInstall);
    stop();
  });

  it('🔴 stops listening when stopped', async () => {
    const stop = installCommunityRailGate();
    await Promise.resolve();
    stop();
    const callsAfterStop = me.mock.calls.length;

    notifyCommunityChanged('session');
    await Promise.resolve();

    expect(me.mock.calls.length).toBe(callsAfterStop);
  });
});

describe('the id this module duplicates', () => {
  it('🔴 still agrees with the panel it names', () => {
    const barrel = readFileSync(
      join(__dirname, '../../src/editor/src/views/panels/CommunityPanel/index.ts'),
      'utf8'
    );
    const gate = readFileSync(
      join(__dirname, '../../src/editor/src/utils/community/communityRailGate.ts'),
      'utf8'
    );

    // The view owns the id; this module holds a copy because importing the barrel pulls `Icon`
    // into a jest run that cannot load it. If they drift, the gate unregisters nothing.
    expect(barrel).toContain(`export const CommunityPanel_ID = '${PANEL_ID}';`);
    expect(gate).toContain(`const COMMUNITY_PANEL_ID = '${PANEL_ID}';`);
  });
});

/**
 * 🔴 THE THIRD PLACE THE REMOVAL LEAKED, and the model could not reach it.
 *
 * Found by driving on 2026-08-23, after `SidebarModel.unregister` was already correct. `SidePanel`
 * keeps its OWN `panels` React state and had no removal path at all, so a refused viewer's
 * `[data-panel-id="community"]` stayed **mounted** — rendering empty only because `CommunityPanel`
 * asks D15 itself. The surface's absence was resting on the second reading of the refusal, and a
 * mounted panel keeps `useCommunityMirror` polling three endpoints a minute.
 *
 * ⚠️ These rows grade the decision. That `SidePanel` actually calls it is established by the
 * drive — a `toContain` on the call site would pass on dead code, which is the exact trap NAT-012
 * AC3 fell into.
 */
describe('prunePanels — SidePanel drops what is no longer registered', () => {
  const registered = (ids: string[]) => (id: string) => ids.includes(id);

  it('🔴 removes an unregistered panel, and keeps the rest', () => {
    const panels = { components: 1, community: 2, search: 3 };
    expect(prunePanels(panels, registered(['components', 'search']))).toEqual({ components: 1, search: 3 });
  });

  it('🔴 returns the SAME object when nothing is stale, so it cannot loop a render', () => {
    const panels = { components: 1, community: 2 };
    expect(prunePanels(panels, registered(['components', 'community']))).toBe(panels);
  });

  it('does not mutate what it was given — the previous state stays intact', () => {
    const panels = { components: 1, community: 2 };
    prunePanels(panels, registered(['components']));
    expect(panels).toEqual({ components: 1, community: 2 });
  });

  it('copes with nothing registered, and with nothing mounted', () => {
    expect(prunePanels({ community: 1 }, registered([]))).toEqual({});
    expect(prunePanels({}, registered(['components']))).toEqual({});
  });
});
