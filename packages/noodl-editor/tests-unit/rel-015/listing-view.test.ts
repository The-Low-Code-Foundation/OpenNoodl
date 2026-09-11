/**
 * REL-015 §1 — `composeListing`, the branch that decides whether a member is offered a way into
 * the directory at all.
 *
 * ## 🔴 Three different refusals collapse into one screen, and that is what needs grading
 *
 * D15 answering `absent`, a signed-out reader, and the route answering `absent` itself all draw
 * **nothing** — the directory, with no button. That is the right screen for all three, and it is
 * also exactly the screen a component that was never called produces. So every "hidden" arm below
 * is paired with a **shown** arm differing in one field, which is `people-render`'s rule carried
 * over: *"one call with one field different"*.
 *
 * ## ⚠️ The distinction this file exists to defend
 *
 * `unreachable` is an ERROR and not hidden. A network failure drawn as *"you cannot list
 * yourself"* would be this client inventing a platform policy out of its own broken connection —
 * and it is the one mistake here that nobody would ever report as a bug, because the screen looks
 * deliberate.
 *
 * @module noodl-editor/tests-unit/rel-015/listing-view
 */
import { composeListing } from '@noodl-models/community/peopleview';
import type { MeResponse, MyListingResponse, Read } from '@noodl-models/community/communityapi';

/** D15's `present` reading, with a viewer. The state every arm below varies ONE field of. */
function me(over: Partial<MeResponse> = {}): Read<MeResponse> {
  return {
    outcome: 'ok',
    value: {
      viewer: { handle: 'ada', kind: 'individual' },
      community: {
        surface: 'present',
        capabilities: { editProfile: true }
      } as MeResponse['community'],
      ...over
    }
  };
}

function listing(over: Partial<NonNullable<MyListingResponse['item']>> = {}): Read<MyListingResponse> {
  return {
    outcome: 'ok',
    value: {
      item: {
        handle: 'ada',
        displayName: 'Ada Lovelace',
        bio: 'Builds compilers.',
        visibility: 'public',
        listing: { status: 'unlisted', note: null },
        profilePath: '/u/ada',
        ...over
      }
    }
  };
}

describe('composeListing — who is offered the button', () => {
  it('shows the card to a signed-in individual, and hides it from a D15-refused viewer', () => {
    // 🔴 THE PAIR, AND THE SHOWN ARM IS READ FIRST. Without it "hidden" is satisfied by a
    // function that returns hidden for everything, which is the shape of the mistake.
    expect(composeListing({ me: me(), read: listing() }).surface).toBe('shown');

    const refused = composeListing({
      me: {
        outcome: 'ok',
        value: {
          viewer: { handle: 'pupil', kind: 'org_minor' },
          community: { surface: 'absent' } as MeResponse['community']
        }
      },
      read: listing()
    });
    expect(refused.surface).toBe('hidden');
  });

  it('hides it from a signed-out reader, who still gets the directory', () => {
    // ⚠️ ONE FIELD: the same `present` community, with no viewer.
    const out = composeListing({
      me: me({ viewer: null }),
      read: undefined
    });
    expect(out.surface).toBe('hidden');
    expect(composeListing({ me: me(), read: undefined }).surface).toBe('shown');
  });

  it('hides it when the route itself refuses — 401 and 404 both', () => {
    expect(composeListing({ me: me(), read: { outcome: 'unauthenticated' } }).surface).toBe('hidden');
    expect(composeListing({ me: me(), read: { outcome: 'absent' } }).surface).toBe('hidden');
  });

  /**
   * 🔴 THE ONE THAT MATTERS MOST, because it is the arm a lazier implementation gets wrong in the
   * direction nobody notices: an unreachable community is a RETRYABLE fault this client caused,
   * and folding it into "hidden" would draw a deliberate-looking screen over a broken connection.
   */
  it('draws a retryable error for an unreachable community, not a hidden card', () => {
    const shown = composeListing({
      me: me(),
      read: { outcome: 'unreachable', status: null, detail: 'ECONNREFUSED' }
    });
    expect(shown.surface).toBe('shown');
    expect(shown.surface === 'shown' && shown.state.kind).toBe('error');
  });

  it('is loading until the read lands', () => {
    const shown = composeListing({ me: me(), read: undefined });
    expect(shown.surface === 'shown' && shown.state.kind).toBe('loading');
  });
});

describe('composeListing — the state it reports', () => {
  /**
   * 🔴 `none` AND `unlisted` ARE DIFFERENT, and this is where that is pinned. `item: null` is an
   * account with no profile row — the state every real sign-up produces — and `unlisted` is a row
   * that exists and has not asked. They lead to the same button and to different sentences, and a
   * composer that collapsed them would have to tell everybody one of the two.
   */
  it('tells a never-created profile from one that simply has not asked', () => {
    const never = composeListing({ me: me(), read: { outcome: 'ok', value: { item: null } } });
    expect(never.surface === 'shown' && never.state.kind === 'ready' && never.state.status).toBe('none');

    const notAsked = composeListing({ me: me(), read: listing() });
    expect(notAsked.surface === 'shown' && notAsked.state.kind === 'ready' && notAsked.state.status).toBe(
      'unlisted'
    );
  });

  it('carries the handle from `me` when there is no profile row to take it from', () => {
    // ⚠️ The fallback is load-bearing: `none` is exactly the state whose sentence has to name the
    // page that does not exist yet, and there is no item to read a handle off.
    const never = composeListing({ me: me(), read: { outcome: 'ok', value: { item: null } } });
    expect(never.surface === 'shown' && never.state.kind === 'ready' && never.state.handle).toBe('ada');
  });

  it('passes the decline reason through, and only for a decline', () => {
    const declined = composeListing({
      me: me(),
      read: listing({ listing: { status: 'declined', note: 'Please say what you build.' } })
    });
    expect(declined.surface === 'shown' && declined.state.kind === 'ready' && declined.state.note).toBe(
      'Please say what you build.'
    );

    // The known-firing other half: the platform makes the note a biconditional with the status,
    // so a composer inventing one for `pending` would be inventing a refusal that never happened.
    const pending = composeListing({ me: me(), read: listing({ listing: { status: 'pending', note: null } }) });
    expect(pending.surface === 'shown' && pending.state.kind === 'ready' && pending.state.note).toBeNull();
  });

  it('reports approved as approved', () => {
    const live = composeListing({
      me: me(),
      read: listing({ listing: { status: 'approved', note: null } })
    });
    expect(live.surface === 'shown' && live.state.kind === 'ready' && live.state.status).toBe('approved');
  });
});
