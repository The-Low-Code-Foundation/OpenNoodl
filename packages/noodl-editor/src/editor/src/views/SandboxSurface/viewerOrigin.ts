/**
 * Where the editor serves the running app.
 *
 * ⚠️ **Its own module, extracted by BLD-014, and the reason is the test runner.**
 * This used to live in `useSandboxViewer.ts`, which imports React and
 * `ViewerConnection` — so anything needing the origin inherited a React
 * dependency. `tests-unit/` is a plain-Node runner by design (no React, no
 * Electron, no editor singletons), and the CDP producer's rules — which URL is
 * external, which viewport was asked for — are exactly the kind of pure logic
 * that belongs there. One import of a hook would have put all of it out of
 * reach.
 *
 * ⚠️ Two hand-rolled copies of this expression remain, in `CanvasView.ts` and
 * `InspectPopup.tsx`. They predate this module and are not BLD-014's to move;
 * anything new should import from here.
 *
 * @module noodl-editor/views/SandboxSurface/viewerOrigin
 */

export function viewerOrigin(): string {
  const protocol = process.env.ssl ? 'https://' : 'http://';
  const port = process.env.NOODLPORT || 8574;
  return `${protocol}localhost:${port}`;
}
