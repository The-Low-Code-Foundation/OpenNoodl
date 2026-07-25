const NoodlRuntime = require('@noodl/runtime');

function _makeRequest(path, options) {
  var xhr = new XMLHttpRequest();

  xhr.onreadystatechange = function () {
    if (xhr.readyState === 4) {
      var json;
      try {
        json = JSON.parse(xhr.response);
      } catch (e) {}

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
  var _cu = localStorage['Parse/' + options.appId + '/currentUser'];
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

const cloudfunctions = {
  async run(functionName, params) {
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

module.exports = cloudfunctions;
