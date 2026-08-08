/**
 * The plumbing a sandbox preview window needs, in one place.
 *
 * AIX-008 built this inline in `SandboxPreview`; BEN-004 gives it a second
 * caller (the component bench), and the phase's standing constraint is "one
 * substrate, two clients" — a second dialect here is the BCN-003 mistake. So it
 * is a hook, and the two surfaces differ only in what they build an export
 * *from*, which is the only thing they should differ in.
 *
 * What it owns:
 *
 * - the client id. A window announces itself as `sandbox-<sessionId>` and that
 *   is the only reason the editor feeds it something other than the project
 *   (see the runtime's `readSandboxSession`);
 * - the export provider. `ViewerConnection` calls it whenever the client
 *   (re)connects, which is not when React renders — hence the ref;
 * - design tokens. Without the injection every `var(--token)` renders
 *   unresolved, which is exactly the styling the agent is taught to write;
 * - the URL, which carries the data source and the auth state because both are
 *   read once, before the runtime exists.
 *
 * @module noodl-editor/views/SandboxSurface/useSandboxViewer
 */

import { useCallback, useEffect, useMemo, useRef } from 'react';

import { guid } from '@noodl-utils/utils';

import { PreviewTokenInjector } from '../../services/PreviewTokenInjector';
import { ViewerConnection } from '../../ViewerConnection';

/**
 * Its own storage jar: a sandbox signs in as a fake user and must not leak that
 * into the session the real preview is using.
 */
export const SANDBOX_PARTITION = 'persist:nodegx-authoring-sandbox';

/**
 * Same webview settings the live preview uses. Spread rather than written as
 * props because the React typings declare these as booleans and HTML attributes
 * are strings.
 */
export const SANDBOX_WEBVIEW_ATTRIBUTES: Record<string, string> = {
  disablewebsecurity: 'true',
  webpreferences: 'allowRunningInsecureContent'
};

export function viewerOrigin(): string {
  const protocol = process.env.ssl ? 'https://' : 'http://';
  const port = process.env.NOODLPORT || 8574;
  return `${protocol}localhost:${port}`;
}

export interface SandboxViewerOptions {
  /** The export this window is fed. `undefined` while there is nothing to show. */
  json: object | undefined;
  /** False for "Real backend": no shim, no fake data. */
  useSampleData: boolean;
  /** POL-008: whether the window runs as the seeded sample user. */
  signedIn: boolean;
  /**
   * Bump to force the window to reload even though the export has not changed.
   *
   * ⚠️ **There is no other way to do it, and BEN-002 shipped a Reset that did
   * nothing before finding that out.** `_exportToClient` drops an export
   * identical to the last one it sent that client, which is right — it is what
   * stops an unchanged project reloading a preview. But a bench input set
   * through a targeted `modelUpdate` never entered the export, so rebuilding
   * after clearing it produces the *same bytes*, the send is dropped, and the
   * runtime keeps the value. Rebuilding is therefore not a remount, and only
   * the `src` is.
   *
   * Reloading also clears the dedupe on the way back: the reconnecting client
   * re-imports its node library, and `loadNodeLibrary` deletes
   * `lastExports[clientId]` for a sandbox client.
   */
  remountKey?: number;
}

export interface SandboxViewer {
  clientId: string;
  /** `src` for the `<webview>`; changing it reloads, which is the point. */
  src: string;
  /**
   * Ref callback for the `<webview>` element.
   *
   * A callback ref rather than an object ref read in an effect dependency:
   * `[ref.current]` is evaluated during *render*, when the ref still holds the
   * previous element, so a remount could attach the listener to the wrong one
   * or not at all. This fires with the element on mount and `null` on unmount,
   * which is exactly the add/remove the injector needs.
   */
  attachWebview: (element: Electron.WebviewTag | null) => void;
}

export function useSandboxViewer({
  json,
  useSampleData,
  signedIn,
  remountKey = 0
}: SandboxViewerOptions): SandboxViewer {
  const sessionId = useMemo(() => guid(), []);
  const clientId = `sandbox-${sessionId}`;

  // The provider is called on (re)connect, not on render, so it reads the
  // latest build through a ref rather than through a closure.
  const latest = useRef<object | undefined>(undefined);
  latest.current = json;

  const webview = useRef<Electron.WebviewTag | null>(null);
  const onDomReady = useRef<(() => void) | null>(null);

  useEffect(() => {
    ViewerConnection.instance.registerSandboxExport(clientId, () => latest.current);
    return () => ViewerConnection.instance.unregisterSandboxExport(clientId);
  }, [clientId]);

  useEffect(() => {
    if (json) ViewerConnection.instance.exportSandbox(clientId);
  }, [clientId, json]);

  const attachWebview = useCallback((element: Electron.WebviewTag | null) => {
    if (webview.current && onDomReady.current) {
      webview.current.removeEventListener('dom-ready', onDomReady.current);
      PreviewTokenInjector.instance.clearWebview(webview.current);
    }

    webview.current = element;
    onDomReady.current = null;

    if (element) {
      const handler = () => PreviewTokenInjector.instance.notifyDomReady(element);
      onDomReady.current = handler;
      element.addEventListener('dom-ready', handler);
    }
  }, []);

  // The network shim is installed from the URL before the runtime exists, so
  // switching data sources reloads the window rather than toggling in place.
  //
  // ⚠️ The auth state rides in the URL for the same reason, and it must: the
  // session is read once, in `UserService`'s constructor, and that service is a
  // singleton that is never rebuilt. Clearing the key under a running preview
  // would change storage and change nothing on screen.
  const src =
    `${viewerOrigin()}/?noodl-sandbox=${sessionId}` +
    `&noodl-sandbox-data=${useSampleData ? 'sample' : 'real'}` +
    `&noodl-sandbox-auth=${signedIn ? 'in' : 'out'}` +
    // Only ever appended, so the URL a normal sandbox loads is byte-identical
    // to the one it loaded before this option existed.
    (remountKey > 0 ? `&noodl-sandbox-remount=${remountKey}` : '');

  return { clientId, src, attachWebview };
}
