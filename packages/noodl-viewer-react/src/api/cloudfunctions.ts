const NoodlRuntime = require('@noodl/runtime');
import { parseSessionStore } from '@noodl/runtime/src/api/backends/SessionStore';

interface RequestOptions {
  appId: string;
  endpoint: string;
  content?: unknown;
  method?: string;
  success: (response: any) => void;
  /** DEF-026: `status` separates "answered with an error" from "never answered" (0). */
  error: (response: any, status?: number) => void;
}

/**
 * Bare XHR rather than `fetch`, and Parse-shaped headers — the backend contract
 * (`X-Parse-Application-Id`, `X-Parse-Session-Token`) is still Parse's wire format
 * even though the server behind it is nodegx-backend.
 *
 * The session token is read straight out of `localStorage` under Parse's own key,
 * so a signed-in user's calls are authenticated without the caller doing anything.
 */
function _makeRequest(path: string, options: RequestOptions): void {
  const xhr = new XMLHttpRequest();

  xhr.onreadystatechange = function () {
    if (xhr.readyState === 4) {
      let json;
      try {
        json = JSON.parse(xhr.response);
      } catch (e) {
        // Non-JSON body — both branches below tolerate `undefined`.
      }

      if (xhr.status === 200 || xhr.status === 201) {
        options.success(json);
      } else options.error(json, xhr.status);
    }
  };

  xhr.open(options.method || 'GET', options.endpoint + path, true);

  xhr.setRequestHeader('X-Parse-Application-Id', options.appId);
  xhr.setRequestHeader('Content-Type', 'application/json');

  const cloudServices = NoodlRuntime.instance.getMetaData('cloudservices');
  if (cloudServices && cloudServices.deployVersion) {
    xhr.setRequestHeader('x-noodl-cloud-version', cloudServices.deployVersion);
  }

  // Check for current users.
  //
  // BCN-006: through `SessionStore`, which is the same object the data wire and
  // the auth adapter read. Three copies of this block spelled
  // `Parse/<appId>/currentUser` out by hand, and each was a separate opinion
  // about who is signed in — the trap BCN-006 names for `cloudstore.js` was
  // real, it was just in three other files by the time the task started.
  const currentUser = parseSessionStore(options.appId).read();
  if (currentUser !== undefined) {
    xhr.setRequestHeader('X-Parse-Session-Token', currentUser.sessionToken);
  }

  xhr.send(JSON.stringify(options.content));
}

/** `Noodl.CloudFunctions` — calls a backend function by name. */
const cloudfunctions = {
  async run(functionName: string, params?: unknown): Promise<unknown> {
    return new Promise((resolve, reject) => {
      const cloudServices = NoodlRuntime.instance.getMetaData('cloudservices');
      if (cloudServices === undefined) {
        reject('No cloud services defined in this project.');
        return;
      }

      // WF-007: this used to redirect to a fixed dev-only port (8577) running a
      // hidden-BrowserWindow cloud-function sandbox whenever the preview ran
      // inside the editor. That sandbox is gone — cloud functions now always
      // execute through whatever backend `cloudservices.endpoint` points at
      // (a local nodegx-backend, auto-set by the Backend Services panel when
      // one is running, or a manually configured deployed/external endpoint).
      const appId = cloudServices.appId;
      const endpoint = cloudServices.endpoint;

      _makeRequest('/functions/' + encodeURIComponent(functionName), {
        appId,
        endpoint,
        content: params,
        method: 'POST',
        success: (res) => {
          resolve(res ? res.result : undefined);
        },
        // DEF-026: a connection refusal has no body, so `err` is `undefined` and
        // this rejected with no reason at all — a caller's catch saw nothing.
        // A JSON error body still passes through untouched (user code reads
        // `err.error` off it), so only the empty case is filled, in the same shape.
        error: (err, status) => {
          reject(
            err !== undefined
              ? err
              : {
                  error:
                    status === 0
                      ? 'Could not reach the backend at ' + endpoint
                      : 'Cloud function call failed with no response body'
                }
          );
        }
      });
    });
  }
};

export default cloudfunctions;
