/**
 * REL-009b AC3 — the fourth listener that read a reload as a deletion, and the
 * only one of the four that destroyed a person's project.
 *
 * The three guards session 20 added (`UseSetupNodeGraph`, `ModelBindings`,
 * `EditorEventBindings`) all stop a view re-pointing the canvas. This one is
 * different in kind: it drops the page from every Router's `routes`, and the
 * editor's next autosave writes that loss to disk. Measured in the running
 * product before the fix — `/App` read `routes: ["/Pages/Third"]`,
 * `startPage: "/Pages/Third"`; an agent added one node to `Pages/Third` over
 * MCP; fourteen seconds later the same file read `routes: []`, no `startPage`,
 * and the preview was blank because the router had nothing left to show.
 *
 * 🔴 The negative arms are the point. A guard that refused every removal would
 * pass the reload spec and leave deleted pages listed in routers forever, so
 * the deletion cases are asserted here in the same shape. What these specs
 * CANNOT see is whether `RouterAdapter` still calls this — that is the drive.
 */

import { pagesAfterComponentRemoved } from '../../src/editor/src/models/NodeTypeAdapters/routerRouteRemoval';

describe('REL-009b — a reload swap must not prune a router', () => {
  it('changes nothing when the removal is half of a reload', () => {
    const pages = { routes: ['/Pages/Third'], startPage: '/Pages/Third' };
    expect(pagesAfterComponentRemoved(pages, '/Pages/Third', { reloadingFromDisk: true })).toBeNull();
  });

  it('still prunes a genuine deletion, and takes startPage with it', () => {
    const pages = { routes: ['/Pages/Home', '/Pages/Third'], startPage: '/Pages/Third' };
    expect(pagesAfterComponentRemoved(pages, '/Pages/Third', { reloadingFromDisk: false })).toEqual({
      routes: ['/Pages/Home'],
      startPage: undefined
    });
  });

  it('treats a missing flag as a deletion — every caller predating REL-009b sends none', () => {
    const pages = { routes: ['/Pages/Third'], startPage: '/Pages/Third' };
    expect(pagesAfterComponentRemoved(pages, '/Pages/Third')).toEqual({ routes: [], startPage: undefined });
  });

  it('leaves startPage alone when a DIFFERENT page is deleted', () => {
    const pages = { routes: ['/Pages/Home', '/Pages/Third'], startPage: '/Pages/Home' };
    expect(pagesAfterComponentRemoved(pages, '/Pages/Third', {})).toEqual({
      routes: ['/Pages/Home'],
      startPage: '/Pages/Home'
    });
  });

  it('does not touch a router that never listed the component', () => {
    expect(pagesAfterComponentRemoved({ routes: ['/Pages/Home'] }, '/Pages/Third', {})).toBeNull();
  });

  it('does not touch a router with no pages parameter at all', () => {
    expect(pagesAfterComponentRemoved(undefined, '/Pages/Third', {})).toBeNull();
    expect(pagesAfterComponentRemoved({}, '/Pages/Third', {})).toBeNull();
  });

  it('does not mutate the value it was given — the caller decides whether to write', () => {
    const pages = { routes: ['/Pages/Third'], startPage: '/Pages/Third' };
    pagesAfterComponentRemoved(pages, '/Pages/Third', {});
    expect(pages).toEqual({ routes: ['/Pages/Third'], startPage: '/Pages/Third' });
  });
});
