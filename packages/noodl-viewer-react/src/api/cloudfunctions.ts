const NoodlRuntime = require('@noodl/runtime');

interface RequestOptions {
  appId: string;
  endpoint: string;
  content?: unknown;
  method?: string;
  success: (response: any) => void;
  error: (response: any) => void;
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
      } else options.error(json);
    }
  };

  xhr.open(options.method || 'GET', options.endpoint + path, true);

  xhr.setRequestHeader('X-Parse-Application-Id', options.appId);
  xhr.setRequestHeader('Content-Type', 'application/json');

  const cloudServices = NoodlRuntime.instance.getMetaData('cloudservices');
  if (cloudServices && cloudServices.deployVersion) {
    xhr.setRequestHeader('x-noodl-cloud-version', cloudServices.deployVersion);
  }

  // Check for current users
  const _cu = localStorage['Parse/' + options.appId + '/currentUser'];
  if (_cu !== undefined) {
    try {
      const currentUser = JSON.parse(_cu);
      xhr.setRequestHeader('X-Parse-Session-Token', currentUser.sessionToken);
    } catch (e) {
      // Failed to extract session token
    }
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
        error: (err) => {
          reject(err);
        }
      });
    });
  }
};

export default cloudfunctions;
