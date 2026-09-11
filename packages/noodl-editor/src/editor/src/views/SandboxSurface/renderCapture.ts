/**
 * BLD-014 — the wire between the Build panel and the hidden browser window.
 *
 * ⚠️ **The only one of the CDP producer's three files that imports `electron`,
 * and it is kept that way on purpose.** Every rule worth grading lives in
 * `renderCaptureModel.ts`, which a plain-Node runner can import; this file is
 * the expression it sends and the `invoke` it sends it over. If a decision
 * starts creeping in here, it belongs next door.
 *
 * @module noodl-editor/views/SandboxSurface/renderCapture
 */

import { ipcRenderer } from 'electron';

import { measureExpression, placeholderStringsFromCatalog, type ViewportSpec } from '@nodegx/render-measure';

import { defaultCatalog } from '../../validation/catalog';
import {
  interpretCaptureReply,
  type CapturedViewport,
  type RenderCaptureReply
} from './renderCaptureModel';

export interface RenderCaptureRequest {
  url: string;
  viewports: ViewportSpec[];
  screenshot?: 'full' | 'viewport' | 'none';
  deviceScaleFactor?: number;
}

type Invoke = (channel: string, request: unknown) => Promise<RenderCaptureReply>;

/**
 * Render `url` at each viewport and judge what came back.
 *
 * ⚠️ The expression is built **here**, from `defaultCatalog()`, rather than in
 * the main process — the same `placeholderStringsFromCatalog(defaultCatalog())`
 * the webview producer runs. The main process has no catalog and should not
 * grow one: two sources of "what does an unstyled node say by default" would
 * disagree the first time the catalog changed, and the disagreement would show
 * up as a placeholder finding on one producer and not the other.
 */
export async function renderCapture(
  request: RenderCaptureRequest,
  invoke: Invoke = (channel, payload) => ipcRenderer.invoke(channel, payload)
): Promise<{ captures: CapturedViewport[]; error?: string }> {
  const expression = measureExpression(placeholderStringsFromCatalog(defaultCatalog()));

  let reply: RenderCaptureReply;
  try {
    reply = await invoke('render-capture', {
      url: request.url,
      viewports: request.viewports,
      expression,
      screenshot: request.screenshot ?? 'full',
      // 0.5 keeps a full page around 500KB — `render-report.js`'s number, and
      // the reason a capture is affordable to send at all.
      deviceScaleFactor: request.deviceScaleFactor ?? 0.5
    });
  } catch (e) {
    return { captures: [], error: e instanceof Error ? e.message : String(e) };
  }

  return interpretCaptureReply(reply, request.viewports);
}
