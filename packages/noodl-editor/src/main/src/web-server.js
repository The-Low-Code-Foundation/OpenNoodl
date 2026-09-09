const fs = require('fs');
const http = require('http');
const https = require('https');
const path = require('path');
const URL = require('url');

// projectmodules is now an ES module (TS default export); under webpack's
// CJS↔ESM interop the singleton class lives on `.default`.
const ProjectModules = require('../../shared/utils/projectmodules').default;
const JSONStorage = require('../../shared/utils/jsonstorage');
const { getRelayToken, injectRelayToken } = require('./relay-token');
const { startWebSocketServer } = require('./relay-server');
// HLS-006 — the binding and the gate. Resolved through the `@nodegx/export` alias that already
// exists in this package's tsconfig, jest config and webpack config; it is the same module the
// `nodegx serve` command uses, which is the whole reason it is not four lines in this file.
const {
  resolveAccess,
  authoriseRequest,
  describeAccess,
  shareUrl,
  lanAddress,
  ALL_INTERFACES
} = require('@nodegx/export/serve/access');

/**
 * HLS-006 — what this launch's web server is currently bound to, and who may talk to it.
 *
 * Module scope rather than a closure inside {@link startServer} because the share action is
 * reached from `main.js` over IPC, and there is exactly one web server per launch.
 */
let access = null;
let httpServer = null;
let listeningPort = null;
/** Every open connection, so a rebind can end them rather than wait on them. */
const openSockets = new Set();
/** True while {@link setSharing} owns the socket, so the launch-failure handler stands down. */
let rebinding = false;
/** The relay is attached once per launch; `listening` fires once per bind. */
let relayAttached = false;


function parseRangeHeader(range, length) {
  if (!range || range.length === 0) {
    return null;
  }

  const parts = range.replace(/bytes=/, '').split('-');
  const partialstart = parts[0];
  const partialend = parts[1];

  const start = parseInt(partialstart, 10);
  const end = parseInt(partialend, 10);

  const result = {
    start: isNaN(start) ? 0 : start,
    end: isNaN(end) ? length - 1 : end
  };

  if (!isNaN(start) && isNaN(end)) {
    result.start = start;
    result.end = length - 1;
  }

  if (isNaN(start) && !isNaN(end)) {
    result.start = length - end;
    result.end = length - 1;
  }

  return result;
}

function startServer(
  app,
  projectGetSettings,
  projectGetInfo,
  projectGetComponentBundleExport,
  projectGetDesignTokenCss
) {
  const appPath = app.getAppPath();

  //accept any certificate from localhost (e.g. self signed)
  app.on('certificate-error', (event, webContents, url, error, certificate, callback) => {
    if (url.startsWith('wss://localhost') || url.startsWith('https://localhost')) {
      event.preventDefault();
      callback(true);
    } else {
      console.log('reject certificate', url);
      callback(false);
    }
  });

  var port = process.env.NOODLPORT || 8574;

  // 🔴 HLS-006. Until this line the server below called `.listen(port)` with no address, which
  // binds `::` — every interface on the machine, with nothing asked of a caller. #31 is a report
  // of exactly that, confirmed from a second machine on a LAN. The default is now loopback and
  // there is no path to anything else that does not go through `setSharing`.
  //
  // The share credential is this launch's relay token, deliberately and not as a shortcut: the
  // page being shared is the viewer, the viewer connects back to the relay to receive the project
  // at all, and the token is therefore already injected into the HTML it is served. Minting a
  // second one would let the URL imply a smaller capability than it actually hands over.
  access = resolveAccess({ token: getRelayToken(app) });

  function serveIndexFile(path, response) {
    fs.readFile(path, 'utf8', function (err, data) {
      if (err) {
        response.writeHead(404);
        response.end('internal error');
      }

      projectGetInfo((info) => {
        ProjectModules.instance.injectIntoHtml(info.projectDirectory, data, '/', function (injected) {
          // Optional so an older caller — or a harness that starts the server
          // with the original four arguments — degrades to the previous
          // behaviour rather than hanging on a callback nobody will fire.
          const withTokenCss = projectGetDesignTokenCss
            ? projectGetDesignTokenCss
            : (callback) => callback('');

          withTokenCss((tokenCss) => {
            projectGetSettings((settings) => {
              settings = settings || {};
              injected = injected.replace('{{#title#}}', settings.htmlTitle || 'Noodl Viewer');

              // Everything served here must resolve the same `var(--token)`
              // vocabulary the canvas webview and an exported build do. Ahead of
              // the project's own head code, so a hand-written override still
              // wins — the same ordering `html-processor` uses for exports.
              const headCode = tokenCss
                ? `<style id="noodl-design-tokens">\n${tokenCss}\n</style>\n` + (settings.headCode || '')
                : settings.headCode || '';
              injected = injected.replace('{{#customHeadCode#}}', headCode);

              //RUN-001: projects on the React 19 runtime load the react19/ pair instead of the
              //vendored 18.3.1 default; distinct URLs keep the browser cache honest when switching
              if (info.runtimeVersion === 'react19') {
                injected = injected
                  .replace('src="/react.production.min.js"', 'src="/react19/react.production.min.js"')
                  .replace('src="/react-dom.production.min.js"', 'src="/react19/react-dom.production.min.js"');
              }

              injected = injectRelayToken(injected, getRelayToken(app));

              response.writeHead(200, {
                'Content-Type': 'text/html'
              });
              response.end(injected);
            });
          });
        });
      });
    });
  }

  function serveProjectBundle(path, response) {
    const idx = path.indexOf('/noodl_bundles/') + '/noodl_bundles/'.length;
    const name = decodeURI(path.substring(idx).replace('.json', ''));

    projectGetComponentBundleExport(name, (data) => {
      if (!data) {
        response.writeHead(404);
        response.end('component not found');
      } else {
        response.writeHead(200, { 'Content-Type': 'application/json' });
        response.end(data);
      }
    });
  }

  /**
   * 🔴 HLS-006 — the gate, in front of every branch rather than on the routes that looked
   * sensitive. `handleRequest` is the single entry point and this is its first statement, so a
   * route added later is covered by construction. A gate placed per-route is a gate with a hole
   * shaped like whichever route somebody adds next.
   *
   * A loopback caller is never challenged — see the module note in `serve/access.ts` for why
   * that is the honest boundary and not a weakening.
   */
  function handleRequest(request, response) {
    const verdict = authoriseRequest(
      {
        url: request.url,
        headers: request.headers,
        remoteAddress: request.socket && request.socket.remoteAddress
      },
      access
    );

    if (verdict.ok === false) {
      console.log(`[preview] refused a request from ${request.socket && request.socket.remoteAddress}: ${verdict.reason}`);
      response.writeHead(verdict.status, { 'Content-Type': 'text/plain; charset=utf-8' });
      response.end(verdict.body);
      return;
    }

    if (verdict.setCookie) {
      // The token arrived in the URL the person was handed; every asset the page then requests is
      // a bare GET, so it is handed back as a cookie or the HTML is the only thing that renders.
      response.setHeader('Set-Cookie', verdict.setCookie);
    }

    handleAuthorisedRequest(request, response);
  }

  function handleAuthorisedRequest(request, response) {
    var parsedUrl = URL.parse(request.url, true);

    let path = decodeURI(parsedUrl.pathname);

    //previous versions of Noodl will request /external/viewer/index.html or /external/viewer/index.htmlnull
    //new version can also do this if old requests are cached by electron
    if (path === '/external/viewer/index.html' || path.endsWith('viewer/index.htmlnull')) {
      serveIndexFile(appPath + '/src/external/viewer/index.html', response);
      return;
    }

    if (path.startsWith('/external/canvas/')) {
      if (path === '/external/canvas/index.html') {
        serveIndexFile(appPath + '/src' + path, response);
        //all done
        return;
      }
      //look in canvas folder for static files
      const fullPath = appPath + '/src' + path;
      if (fs.existsSync(fullPath)) {
        serveFile(fullPath, request, response);
        return;
      }

      //not done, strip away the index part of the path and continue
      path = path.replace('/external/canvas', '');
    } else if (path.startsWith('/external/viewer')) {
      //we're in the viewer folder, just strip away and proceed (treat it as the regular root path)
      path = path.replace('/external/viewer', '');
    }

    //special bundle folder that requests dynamic data from editor
    if (path.includes('/noodl_bundles/')) {
      serveProjectBundle(path, response);
      return;
    }

    //any folder, including root, serves the index (SPA app). Make any index.html just return the viewer
    //exclude noodl module folder (shouldn't be any folder requests, but who knows)
    if (path.includes('/noodl_modules/') === false && (path.endsWith('index.html') || path.includes('.') === false)) {
      serveIndexFile(appPath + '/src/external/viewer/index.html', response);
      return;
    }

    //by this point it must be a static file in either the viewer folder or the project
    //check if it's a viewer file
    const viewerFilePath = appPath + '/src/external/viewer/' + path;
    
    // Debug: Log ALL font requests regardless of where they're served from
    const fontExtensions = ['.ttf', '.otf', '.woff', '.woff2'];
    const ext = (path.match(/\.[^.]+$/) || [''])[0].toLowerCase();
    const isFont = fontExtensions.includes(ext);
    
    if (isFont) {
      console.log(`\n======= FONT REQUEST =======`);
      console.log(`[Font] Requested path: ${path}`);
      console.log(`[Font] Checking viewer path: ${viewerFilePath}`);
    }
    
    if (fs.existsSync(viewerFilePath)) {
      if (isFont) console.log(`[Font] SERVED from viewer folder`);
      serveFile(viewerFilePath, request, response);
    } else {
      // Check if file exists in project directory
      projectGetInfo((info) => {
        const projectPath = info.projectDirectory + path;
        
        if (isFont) {
          console.log(`[Font] Project dir: ${info.projectDirectory}`);
          console.log(`[Font] Checking project path: ${projectPath}`);
          console.log(`[Font] Exists at project path: ${fs.existsSync(projectPath)}`);
        }
        
        if (fs.existsSync(projectPath)) {
          if (isFont) console.log(`[Font] SERVED from project folder`);
          serveFile(projectPath, request, response);
        } else {
          // For fonts, try common fallback locations
          // Legacy projects may store fonts without folder prefix, or in different locations
          const fontExtensions = ['.ttf', '.otf', '.woff', '.woff2'];
          const ext = (path.match(/\.[^.]+$/) || [''])[0].toLowerCase();
          
          if (fontExtensions.includes(ext)) {
            console.log(`[Font Debug] Request: ${path}`);
            console.log(`[Font Debug] Project dir: ${info.projectDirectory}`);
            console.log(`[Font Debug] Primary path NOT found: ${projectPath}`);
            
            const filename = path.split('/').pop();
            const fallbackPaths = [
              info.projectDirectory + '/fonts' + path,           // /fonts/filename.ttf
              info.projectDirectory + '/fonts/' + filename,      // /fonts/filename.ttf (when path has no subfolder)
              info.projectDirectory + '/' + filename,            // /filename.ttf (root level)
              info.projectDirectory + '/assets/fonts/' + filename // /assets/fonts/filename.ttf
            ];
            
            console.log(`[Font Debug] Trying fallback paths:`);
            for (const fallbackPath of fallbackPaths) {
              const exists = fs.existsSync(fallbackPath);
              console.log(`[Font Debug]   ${exists ? '✓' : '✗'} ${fallbackPath}`);
              if (exists) {
                console.log(`[Font Debug] SUCCESS - serving from fallback`);
                serveFile(fallbackPath, request, response);
                return;
              }
            }
            console.log(`[Font Debug] FAILED - no fallback found`);
          }
          
          serve404(response);
        }
      });
    }
  }

  var server;
  if (process.env.ssl) {
    console.log('Using SSL');

    const options = {
      key: fs.readFileSync(process.env.sslKey),
      cert: fs.readFileSync(process.env.sslCert)
    };
    server = https.createServer(options, handleRequest).listen(port, access.host);
  } else {
    server = http.createServer(handleRequest).listen(port, access.host);
  }
  httpServer = server;

  // ⚠️ `http.Server#close` stops accepting new connections and then waits for the open ones to
  // end — and neither a WebSocket nor a kept-alive viewer ever ends on its own. Without this the
  // rebind in `setSharing` would hang forever rather than fail, which is the worst of the three
  // outcomes. `relay-auth.test.js` hit the same wall for the same reason.
  server.on('connection', (socket) => {
    openSockets.add(socket);
    socket.on('close', () => openSockets.delete(socket));
  });

  server.on('error', (e) => {
    // 🔴 HLS-006. This handler quits the app, which is right for a web server that never came up
    // — the editor cannot preview anything without it — and badly wrong for a *rebind*. Sharing
    // is an optional action; a port the OS will not give us is a reason to tell the person that
    // sharing failed, not to close their editor with unsaved work in it. `setSharing` owns the
    // error while it is rebinding and puts it in a dialog of its own.
    if (rebinding) return;
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { dialog } = require('electron');
    dialog
      .showMessageBox({
        type: 'error',
        message: `A problem was encountered while starting Noodl's webserver\n\n${e.message}`
      })
      .then(() => {
        app.quit();
      });
  });

  server.on('listening', () => {
    // The port the OS actually gave us. With `NOODLPORT=0` — which a harness and a second editor
    // both use — that is not the number that was passed in, and a rebind that reused the request
    // rather than the result would move the server to a different port every time.
    listeningPort = server.address().port;
    console.log('webserver hustling bytes on port', listeningPort);
    // #31's complaint is as much that the editor never said what was listening as that it was
    // listening everywhere. It says so now, on every launch and on every change.
    console.log('[preview]', describeAccess(access, listeningPort, lanAddress() || undefined));
    process.env.NOODLPORT = String(listeningPort);

    // 🔴 HLS-006. `listening` fires again after every rebind, and everything below it is
    // once-per-launch work. Attaching a second relay to the same HTTP server is not a no-op: both
    // `WebSocketServer`s take the `upgrade` event, every peer ends up registered twice, and each
    // message is delivered twice to a viewer that has no way to tell the copies apart. Found by
    // reading this handler after writing the rebind, not by a spec — which is why there is now a
    // spec for it (`hls006-preview-binding.test.js`, "attaches exactly one relay").
    if (relayAttached) return;
    relayAttached = true;

    // Mint the token before the first socket can arrive, so an early `register` cannot race it.
    getRelayToken(app);

    startWebSocketServer(server);
  });
}

function getContentType(request) {
  var extname = path.extname(request.url);
  var contentType = 'text/html';
  switch (extname) {
    case '.js':
      contentType = 'text/javascript';
      break;
    case '.css':
      contentType = 'text/css';
      break;
    case '.json':
      contentType = 'application/json';
      break;
    case '.png':
      contentType = 'image/png';
      break;
    case '.webp':
      contentType = 'image/webp';
      break;
    case '.gif':
      contentType = 'image/gif';
      break;
    case '.jpg':
      contentType = 'image/jpg';
      break;
    case '.wav':
      contentType = 'audio/wav';
      break;
    case '.mp4':
    case '.m4v':
      contentType = 'video/mp4';
      break;
    case '.wasm':
      contentType = 'application/wasm';
      break;
    case '.svg':
      contentType = 'image/svg+xml';
      break;
    case '.ttf':
      contentType = 'font/ttf';
      break;
    case '.otf':
      contentType = 'font/otf';
      break;
    case '.woff':
      contentType = 'font/woff';
      break;
    case '.woff2':
      contentType = 'font/woff2';
      break;
  }

  return contentType;
}

function serveFile(filePath, request, response) {
  fs.stat(decodeURI(filePath), (error, stat) => {
    if (error) {
      response.writeHead(404);
      response.end(error.message);
      return null;
    }

    const range = parseRangeHeader(request.headers.range, stat.size);
    if (range) {
      const start = range.start;
      const end = range.end;

      if (start >= stat.size || end >= stat.size) {
        response.writeHead(416, {
          'Content-Type': getContentType(request),
          'Content-Range': 'bytes */' + stat.size
        });

        return null;
      }

      const fileStream = fs.createReadStream(decodeURI(filePath), {
        start: range.start,
        end: range.end
      });

      fileStream.on('error', function (err) {
        response.writeHead(404);
        response.end(err.message);
      });

      const responseHeaders = {
        'Content-Range': 'bytes ' + start + '-' + end + '/' + stat.size,
        'Content-Length': start == end ? 0 : end - start + 1,
        'Content-Type': getContentType(request),
        'Accept-Ranges': 'bytes',
        'Cache-Control': 'no-cache'
      };

      response.writeHead(206, responseHeaders);
      fileStream.pipe(response);
    } else {
      response.writeHead(200, {
        'Content-Type': getContentType(request),
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET'
      });
      const fileStream = fs.createReadStream(decodeURI(filePath));
      fileStream.on('error', function (err) {
        response.writeHead(404);
        response.end(err.message);
      });

      fileStream.pipe(response);
    }
  });
}

function serve404(response) {
  response.writeHead(404);
  response.end('file not found');
}

/**
 * What is listening, in the shape the renderer and the menu need to say it.
 *
 * Returns `null` before {@link startServer} has run — the caller is a menu item and a menu can be
 * built before the server is, so "not yet" is a real answer rather than an exception.
 */
function getAccessStatus() {
  if (!access || !httpServer) return null;
  /**
   * 🔴 Read off the socket, not off `access`.
   *
   * `access.host` is what was *asked for*, and HLS-006 AC2 exists because those are two
   * different facts — a `listen()` that ignored the argument entirely would leave every
   * assertion about `access.host` green. It also matters in ordinary use: `NOODLPORT=0` is a
   * real configuration and the port that was requested is then not the port anybody can
   * connect to, so the share URL built from it would name a port nothing is listening on.
   */
  const bound = httpServer.address();
  if (bound === null || typeof bound === 'string') return null;
  const lan = lanAddress();
  return {
    shared: access.shared,
    host: bound.address,
    port: bound.port,
    token: access.token,
    lanAddress: lan,
    url: access.shared ? shareUrl(lan || bound.address, bound.port, access.token) : null,
    description: describeAccess(access, bound.port, lan || undefined)
  };
}

/**
 * HLS-006 — turn network sharing on or off, by actually rebinding the socket.
 *
 * 🔴 **The alternative was to keep binding every interface and refuse non-loopback callers in the
 * handler, which is strictly worse and looks identical from the editor.** A port that is open and
 * answers 401 is still an open port: it is found by every scanner, it is still reachable by
 * anything that can speak to the socket before the handler runs, and — the reason it matters here
 * — it would make HLS-006 AC2 unverifiable, because there would be no honest way to read
 * "loopback" off the listening socket. So the address changes.
 *
 * The cost, stated because it is a real one: rebinding ends the open preview connections, so the
 * app being previewed reloads. That is why this is a deliberate action and not a setting that
 * something else can toggle underneath the author.
 */
function setSharing(shared) {
  return new Promise((resolve, reject) => {
    if (!httpServer || !access) {
      reject(new Error('The preview server has not started yet.'));
      return;
    }
    if (access.shared === Boolean(shared)) {
      resolve(getAccessStatus());
      return;
    }

    const previous = access;
    const next = resolveAccess({ share: Boolean(shared), host: ALL_INTERFACES, token: access.token });

    rebinding = true;
    const settle = (fn, value) => {
      rebinding = false;
      fn(value);
    };

    httpServer.close((closeError) => {
      if (closeError) {
        settle(reject, closeError);
        return;
      }

      const onError = (error) => {
        /**
         * 🔴 The socket is now closed and the rebind failed, so the preview is down. Going back
         * to what was working is the only acceptable end state — the alternative is an editor
         * whose preview silently stopped because somebody tried to share it.
         */
        httpServer.listen(listeningPort, previous.host, () => {
          access = previous;
          settle(reject, error);
        });
      };

      httpServer.once('error', onError);
      httpServer.listen(listeningPort, next.host, () => {
        httpServer.removeListener('error', onError);
        access = next;
        console.log('[preview]', describeAccess(access, listeningPort, lanAddress() || undefined));
        settle(resolve, getAccessStatus());
      });
    });

    for (const socket of openSockets) socket.destroy();
    openSockets.clear();
  });
}

/**
 * Test seam. Never called in the app: the web server lives as long as the process does.
 *
 * `relay-token.js` carries `_resetRelayTokenForTests` for the same reason — the module holds
 * one-per-launch state, and a spec that starts a second server in the same process needs the
 * first one gone rather than a second copy of the state.
 */
function _stopServerForTests() {
  return new Promise((resolve) => {
    if (!httpServer) {
      resolve();
      return;
    }
    const server = httpServer;
    httpServer = null;
    access = null;
    listeningPort = null;
    relayAttached = false;
    rebinding = false;
    for (const socket of openSockets) socket.destroy();
    openSockets.clear();
    server.close(() => resolve());
  });
}

module.exports = startServer;
module.exports.getAccessStatus = getAccessStatus;
module.exports.setSharing = setSharing;
module.exports._stopServerForTests = _stopServerForTests;
/**
 * Test seam. The live `http.Server`, so a spec can count the `upgrade` listeners on it — one per
 * attached WebSocket relay, which is the only way to see the double-attach a rebind used to cause
 * without standing up two peers and comparing message counts.
 */
module.exports._getHttpServerForTests = () => httpServer;
