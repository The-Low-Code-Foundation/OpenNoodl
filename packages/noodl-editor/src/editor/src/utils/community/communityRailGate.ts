/**
 * NAT-012 AC7 — the rail icon is not drawn for a viewer D15 refused.
 *
 * ───────────────────────────────────────────────────────────────────────────────
 * 🔴 THE DEFECT: `SidebarModel.instance.register` at `router.setup.ts` is synchronous at setup
 * with no async predicate, so **every account gets a Community door** — including the org-minor
 * whose school switched the community off. `CommunityPanel` returns `null` for a refused viewer
 * of its own accord, so what that account actually finds behind the icon is a blank panel. D15
 * says the surface is ABSENT, web *and* editor; an icon onto nothing is the door being narrated
 * in the act of closing it, which is the one thing D15 exists to prevent.
 *
 * ## Why an unregister-on-resolution and not a late registration
 *
 * The refusal is only knowable from `/api/v1/me`, which is a network read, and D21 says the
 * panel **ships now** — so the alternatives are to hold the whole rail until the platform
 * answers, or to register as today and take it back. Registration order is shared editor
 * bootstrap (`router.setup.ts` registers eleven panels, and `useSetupSettings` switches to one
 * of them on mount), so making one entry late is a change to everybody's boot. Taking it back
 * touches nothing until the platform has actually refused somebody.
 *
 * ⚠️ **The cost is a visible window**: a refused viewer sees the icon until `me()` answers. That
 * is accepted rather than hidden — the panel behind it draws nothing for them the whole time, so
 * the window leaks *an icon*, and the alternative leaks the entire rail's timing to the network.
 *
 * ## 🔴 The removal is three things, and the obvious one is a hole shaped like the defect
 *
 * See {@link SidebarModel.unregister}, where that is measured and argued. The short version: a
 * splice of `items` alone takes the icon away and **leaves the panel drawing**. A drive that
 * checks the rail passes on that bug; the drive has to read the PANEL.
 *
 * ## 🔴 Only one direction is reachable, and this is why there is no re-register
 *
 * Inside a mounted editor the session can only go signed-out → signed-in: `signIntoCommunity`
 * has an in-editor caller (`AskAboutNodeDialog`), and `signOutOfCommunity` has exactly one
 * caller anywhere, `useCommunityAccount` on the **launcher** — which is a different route, and
 * NAT-012 AC3 established that reaching it closes the project and unmounts all of this. So the
 * viewer can become refused while the editor is open, and cannot become permitted again.
 *
 * ⚠️ **If an in-editor sign-out is ever added, this file is wrong and it will fail quietly** —
 * a viewer who signs out of a refused account keeps the panel removed until they reopen the
 * project. The fix at that point is for the gate to hold the `SidebarItem` and re-`register` it;
 * it is deliberately not built now, because a re-registration nothing can reach is a branch no
 * drive can grade.
 *
 * @module noodl-editor/utils/community/communityRailGate
 */

import { CommunityApiClient } from '@noodl-models/community/communityapi';
import { onCommunityChanged } from '@noodl-models/community/communitychanged';
import { COMMUNITY_URL } from '@noodl-models/community/communityorigin';
import { readCommunitySession } from '@noodl-models/community/communitysession';
import { refusesCommunitySurface } from '@noodl-models/community/mirrorview';
import { SidebarModel } from '@noodl-models/sidebar';

/**
 * ⚠️ The literal id, for the reason `communityThreadRequest.ts` states beside its own copy:
 * importing `CommunityPanel_ID` pulls the *view* barrel — and with it `Icon`, which this repo's
 * jest cannot load — into a module that has to be gradable. `community-rail-gate.test.ts` reads
 * `views/panels/CommunityPanel/index.ts` off disk and fails if this string and that one drift,
 * so the third copy of the id is a checked one rather than a hopeful one.
 */
const COMMUNITY_PANEL_ID = 'community';

/**
 * Resolve the viewer once and take the Community panel off the rail if D15 refuses them.
 *
 * Exported for the specs, which need the decision without the subscription around it.
 *
 * ⚠️ Every non-`ok` answer — unreachable, unauthenticated, a 404 on `me` itself — leaves the
 * panel alone. An editor that cannot reach the platform must not look like a school policy;
 * that is {@link refusesCommunitySurface}'s argument, and this is the call site that makes it
 * matter.
 */
export async function resolveCommunityRail(): Promise<boolean> {
  const session = await readCommunitySession();
  const client = new CommunityApiClient({ baseUrl: COMMUNITY_URL, token: session?.token ?? null });
  const me = await client.me();

  if (!refusesCommunitySurface(me)) {
    return false;
  }

  SidebarModel.instance.unregister(COMMUNITY_PANEL_ID);
  return true;
}

/**
 * Install the gate. Returns the stop function.
 *
 * 🔴 **The caller must stop the previous gate before installing a new one.** `installSidePanel`
 * runs again on every hot reload of `router.setup`, after `SidebarModel.reset()` has put the
 * panel back — so the gate has to re-resolve, and a gate installed without stopping its
 * predecessor leaves the old subscription holding a stale closure.
 */
export function installCommunityRailGate(): () => void {
  const resolve = () => {
    void resolveCommunityRail().catch(() => {
      // ⚠️ Swallowed on purpose, and it is not laziness: the only thing this could do with an
      // error is remove the panel, which is the refusal it failed to establish. `me()` already
      // turns every reachable failure into a `Read` outcome, so arriving here means something
      // outside the client threw. Leaving the panel is the answer that does not invent a policy.
    });
  };

  resolve();

  const unsubscribe = onCommunityChanged((change) => {
    // A sign-in replaces the viewer, so the refusal has to be asked again. `'threads'` cannot
    // change who is asking, so it is ignored rather than re-polled once a minute for nothing.
    if (change === 'session') {
      resolve();
    }
  });

  /**
   * ⚠️ **Stopping unsubscribes; it deliberately does NOT cancel a resolve already in flight.**
   * A late unregister cannot be wrong: it fires only when the platform has said *this account is
   * refused*, the account does not change across a hot reload, and {@link SidebarModel.unregister}
   * is idempotent. A cancellation flag here would be a branch whose two arms produce the same
   * rail, which is a check that cannot fail.
   */
  return unsubscribe;
}
