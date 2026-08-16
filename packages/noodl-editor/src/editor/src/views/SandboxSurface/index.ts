/**
 * The pieces a sandbox preview surface is built from, shared by the AI
 * authoring preview (AIX-008) and the component bench (BEN-004). One substrate,
 * two clients — if a change here only helps one of them, it is in the wrong
 * file.
 */
export { SandboxToolbar, type SandboxToolbarProps } from './SandboxToolbar';
/*
 * BLD-014 — the webview grab, read by the Build panel's `◎ Look at it` and by
 * UNI-011 AC3's composer.
 *
 * 🔴 **The registry is no longer `useSandboxViewer`'s alone**, and the correction
 * matters more than the export. Until UNI-011 AC3 its only registrants were this
 * directory's two hosts — the AI authoring preview and the component bench — so
 * `hasLivePreview()` answered **false** while the *app* preview was running in
 * front of the user. That preview is a `<webview>` in `VisualCanvas`, which now
 * registers itself, which is why the two functions are exported.
 */
export {
  captureLivePreview,
  hasLivePreview,
  registerLivePreview,
  unregisterLivePreview,
  type PreviewCapture
} from './livePreviewCapture';
// BLD-014 — the CDP render. The other producer behind the same control, and the
// only one that can answer "at 390×844" or point at a URL.
/*
 * ⚠️ **`renderCapture.ts` is deliberately NOT re-exported here.**
 *
 * It is the one module in this directory that imports `electron`, and this
 * barrel is imported by `ComponentBench.tsx` and `AuthoringPreviewDocument` —
 * so re-exporting it silently put `ipcRenderer` into the import graph of every
 * consumer of the sandbox surface, including the two that are graded in the
 * Jasmine suite. The one caller that needs the transport imports it by path.
 *
 * Everything below is Electron-free and safe for any consumer.
 */
export {
  appViewerUrl,
  base64Bytes,
  interpretCaptureReply,
  isExternalUrl,
  parseViewports,
  type CapturedViewport,
  type RenderCaptureReply
} from './renderCaptureModel';
export {
  useSandboxViewer,
  viewerOrigin,
  SANDBOX_PARTITION,
  SANDBOX_WEBVIEW_ATTRIBUTES,
  type SandboxViewer,
  type SandboxViewerOptions
} from './useSandboxViewer';
