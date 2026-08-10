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
export {
  useSandboxViewer,
  viewerOrigin,
  SANDBOX_PARTITION,
  SANDBOX_WEBVIEW_ATTRIBUTES,
  type SandboxViewer,
  type SandboxViewerOptions
} from './useSandboxViewer';
