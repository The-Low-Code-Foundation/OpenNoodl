// WF-007: the "viewer" config (webpack.viewer.*) built the sandboxed
// BrowserWindow bundle for the dev-time cloud-function-server (port 8577).
// That server and its cloudruntime sandbox are deleted — cloud functions now
// run inside nodegx-backend, which esbuilds this package's `src/` directly
// via the `@cloud-runtime` alias (see packages/nodegx-backend/scripts/build.js).
// Only the isolate bundle (used elsewhere) is still built here.
const isolate = require('./webpack.isolate.prod');

module.exports = [isolate];
