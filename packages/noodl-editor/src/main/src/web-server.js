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

function startServer(app, projectGetSettings, projectGetInfo, projectGetComponentBundleExport) {
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

  function serveIndexFile(path, response) {
    fs.readFile(path, 'utf8', function (err, data) {
      if (err) {
        response.writeHead(404);
        response.end('internal error');
      }

      projectGetInfo((info) => {
        ProjectModules.instance.injectIntoHtml(info.projectDirectory, data, '/', function (injected) {
          projectGetSettings((settings) => {
            settings = settings || {};
            injected = injected.replace('{{#title#}}', settings.htmlTitle || 'Noodl Viewer');
            injected = injected.replace('{{#customHeadCode#}}', settings.headCode || '');

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

  function handleRequest(request, response) {
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
    server = https.createServer(options, handleRequest).listen(port);
  } else {
    server = http.createServer(handleRequest).listen(port);
  }

  server.on('error', (e) => {
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
    console.log('webserver hustling bytes on port', port);
    process.env.NOODLPORT = port;

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

module.exports = startServer;
