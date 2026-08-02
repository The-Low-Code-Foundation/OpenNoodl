/**
 * OBS-002/003 — the first "Why is this empty?" of a session.
 *
 * ⚠️ **The defect this pins was invisible to anyone who had already used the feature.** The canvas
 * entry points emitted `provenance:walk` and then switched the sidebar. The panel subscribes when
 * it *mounts*, and it does not mount until the switch — so the first request of a session fired
 * into no listener, the panel opened on its own placeholder, and the user had to ask twice. Every
 * later request worked, because the panel stays mounted once shown.
 *
 * Found by driving the real editor, not by review, and not by any test that existed.
 *
 * The models are mocked because this module's whole job is *ordering* — what happens when the
 * listener does not exist yet — and that is answerable without a sidebar or a renderer.
 */

const emitted: Array<{ event: string; payload: unknown }> = [];
const switched: string[] = [];

// `virtual`, because this runner has no `@noodl-models` alias — it exists to run editor code
// that is *pure*, and adding a renderer alias to reach a singleton would defeat that.
jest.mock(
  '@noodl-models/sidebar',
  () => ({ SidebarModel: { instance: { switch: (id: string) => switched.push(id) } } }),
  { virtual: true }
);

jest.mock('../../src/shared/utils/EventDispatcher', () => ({
  EventDispatcher: {
    instance: {
      emit: (event: string, payload: unknown) => emitted.push({ event, payload })
    }
  }
}));

import {
  clearPendingProvenanceWalk,
  requestProvenanceWalk,
  takePendingProvenanceWalk
} from '../../src/editor/src/utils/provenance/provenanceRequest';

const REF = { node: 'cartList', port: 'items' };

beforeEach(() => {
  emitted.length = 0;
  switched.length = 0;
  takePendingProvenanceWalk();
});

describe('requestProvenanceWalk', () => {
  test('emits and switches, which is what the old inline code did', () => {
    requestProvenanceWalk(REF);

    expect(emitted).toEqual([{ event: 'provenance:walk', payload: REF }]);
    expect(switched).toEqual(['provenance']);
  });

  test('a panel that mounts afterwards claims the request — the first-use case', () => {
    requestProvenanceWalk(REF);

    // Nothing was listening; the panel mounts now.
    expect(takePendingProvenanceWalk()).toEqual(REF);
  });

  test('a request claimed once is not replayed on the next mount', () => {
    requestProvenanceWalk(REF);

    expect(takePendingProvenanceWalk()).toEqual(REF);
    // Switching sidebars and back must not silently repeat a walk the user has moved on from.
    expect(takePendingProvenanceWalk()).toBeUndefined();
  });

  test('a live listener consumes it, so a mounted panel never also replays it', () => {
    requestProvenanceWalk(REF);
    // What the panel's own `provenance:walk` handler does.
    clearPendingProvenanceWalk();

    expect(takePendingProvenanceWalk()).toBeUndefined();
  });

  test('a second request replaces the first — the newer question is the one being asked', () => {
    requestProvenanceWalk(REF);
    const second = { node: 'countLabel', port: 'text' };
    requestProvenanceWalk(second);

    expect(takePendingProvenanceWalk()).toEqual(second);
  });

  test('nothing is pending before anything is requested', () => {
    expect(takePendingProvenanceWalk()).toBeUndefined();
  });
});
