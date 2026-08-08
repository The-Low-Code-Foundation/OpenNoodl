/**
 * The pieces a sandbox preview surface is built from, shared by the AI
 * authoring preview (AIX-008) and the component bench (BEN-004). One substrate,
 * two clients — if a change here only helps one of them, it is in the wrong
 * file.
 */
export { SandboxToolbar, type SandboxToolbarProps } from './SandboxToolbar';
export {
  useSandboxViewer,
  viewerOrigin,
  SANDBOX_PARTITION,
  SANDBOX_WEBVIEW_ATTRIBUTES,
  type SandboxViewer,
  type SandboxViewerOptions
} from './useSandboxViewer';
