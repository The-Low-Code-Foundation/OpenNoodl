/**
 * AIX-010 — two banners must not unsubscribe each other.
 *
 * `ProjectReviewBanner` is mounted in the Build panel and in the Docs panel, and
 * this editor's sidebar panels are hidden rather than unmounted, so both are
 * live at once. Both used to subscribe under the module-level string group
 * `'project-review-banner'`, and both `EventDispatcher.off(group)` and
 * `Model.off(group)` splice **every** listener carrying that group out of one
 * global registry — so the first unmount silently deafened the survivor.
 *
 * What that cost is not abstract: the surviving banner never heard
 * `DOCS_CHANGED`, so it kept offering to draft docs for a project that had just
 * accepted them, and never heard `ProjectModel.instanceHasChanged`, so its
 * visibility was stale across a project switch. The module's own claim is that
 * "accepting the drafted CONVENTIONS.md retires the banner on its own" — this is
 * the row that keeps that true.
 *
 * The spec drives `subscribeReviewVisibility` rather than mounting React: the
 * defect is entirely in the listener group, and the subscription function is the
 * production code path the hook calls.
 *
 * describe/it/expect are Jasmine globals; the editor suite is not jest.
 */

import { subscribeReviewVisibility } from '../../src/editor/src/views/panels/AiAuthoringPanel/ProjectReviewBanner';
import { EventDispatcher } from '../../src/shared/utils/EventDispatcher';

/*
 * `ProjectModel.instanceHasChanged` always carries `{ oldInstance }` — see
 * `ProjectModel.setInstance`. Emitting it bare passes in isolation and then
 * fails whenever some other spec has already registered one of the real
 * listeners (`EditorEventBindings`, `ProjectSettingsModel`), both of which read
 * `args.oldInstance` off an object they are entitled to assume exists. That is
 * an order-dependent failure the seed decides, so these emits carry the real
 * payload shape rather than the smallest one that happened to work.
 */
describe('ProjectReviewBanner — one banner unmounting keeps the other listening (AIX-010)', () => {
  it('re-evaluates the surviving banner after the first one is disposed', () => {
    let build = 0;
    let docs = 0;

    const stopBuild = subscribeReviewVisibility(() => (build += 1));
    const stopDocs = subscribeReviewVisibility(() => (docs += 1));

    EventDispatcher.instance.emit('ProjectModel.instanceHasChanged', { oldInstance: undefined });
    expect(build).toBe(1);
    expect(docs).toBe(1);

    // The Build panel's banner goes away. Before the fix this removed the Docs
    // panel's listener too, and `docs` stayed at 1 forever.
    stopBuild();

    EventDispatcher.instance.emit('ProjectModel.instanceHasChanged', { oldInstance: undefined });
    expect(build).toBe(1);
    expect(docs).toBe(2);

    EventDispatcher.instance.emit('ProjectModel.importComplete');
    expect(docs).toBe(3);

    stopDocs();
  });

  it('leaves nothing behind once both are disposed', () => {
    let calls = 0;

    const stopA = subscribeReviewVisibility(() => (calls += 1));
    const stopB = subscribeReviewVisibility(() => (calls += 1));
    stopA();
    stopB();

    EventDispatcher.instance.emit('ProjectModel.instanceHasChanged', { oldInstance: undefined });
    expect(calls).toBe(0);
  });

  it('disposing twice does not reach into anyone else', () => {
    let mine = 0;
    let theirs = 0;

    const stopMine = subscribeReviewVisibility(() => (mine += 1));
    const stopTheirs = subscribeReviewVisibility(() => (theirs += 1));

    stopMine();
    stopMine();

    EventDispatcher.instance.emit('ProjectModel.instanceHasChanged', { oldInstance: undefined });
    expect(mine).toBe(0);
    expect(theirs).toBe(1);

    stopTheirs();
  });
});
