/**
 * The pieces a sandbox preview surface is built from, shared by the AI
 * authoring preview (AIX-008) and the component bench (BEN-004). One substrate,
 * two clients — if a change here only helps one of them, it is in the wrong
 * file.
 */
export { SandboxToolbar, type SandboxToolbarProps } from './SandboxToolbar';
// BLD-014 — the webview grab. Registered by `useSandboxViewer`, read by the
// Build panel's `◎ Look at it`.
export { captureLivePreview, hasLivePreview, type PreviewCapture } from './livePreviewCapture';
// BLD-014 — the CDP render. The other producer behind the same control, and the
// only one that can answer "at 390×844" or point at a URL.
export { renderCapture, type RenderCaptureRequest } from './renderCapture';
// The rules half, importable without Electron — see the module header for why
// the split exists.
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
