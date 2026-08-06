/**
 * The project relay — the WebSocket half of the editor's web server.
 *
 * A typed broadcast relay, not a protocol. Peers `register` as `viewer`, `editor` or
 * `service`; a message fans to every peer of the **opposite** type, or to one peer by
 * `clientId` via `target`, or to a named `service`. It knows nothing about what it carries:
 * project exports, model deltas, debug inspector values, warnings, and (OBS-001/002) the
 * trace channel all ride the same pipe.
 *
 * Split out of `web-server.js` for OBS-004. The HTTP half is ~350 lines of static-file and
 * font-fallback plumbing that pulls in `projectmodules`, and the relay is the part with a
 * silent failure mode — an unauthorised peer that should have been refused simply receives
 * everything, and nothing anywhere looks wrong. Keeping it in its own module is what makes
 * `tests-main/relay-auth.test.js` able to drive it with real sockets and no Electron.
 *
 * ## The token gate (OBS-004)
 *
 * ⚠️ **Every peer must present the launch token in its `register`, and a peer that has not is
 * neither sent to nor read from.** Two halves, both required:
 *
 *  1. The first message on a socket must be a `register` carrying a valid token, or the socket
 *     is closed. Ignoring it instead would leave a silent listener attached.
 *  2. Every fan-out skips unauthorised sockets, because `close()` is asynchronous and because
 *     the `!type` branch of {@link broadcastMessage} deliberately ignores peer type.
 *
 * See `relay-token.js` for why this is here at all — in short, browsers do not apply the
 * same-origin policy to WebSockets, so before this any page the user visited could read the
 * whole stream.
 */

const WebSocket = require('ws');

const WebSocketServer = WebSocket.Server;

const { isValidRelayToken } = require('./relay-token');

/** Close code for a peer that did not present a valid token. In the application-private range. */
const CLOSE_UNAUTHORISED = 4401;

/**
 * Attach the relay to an already-listening HTTP server.
 *
 * @param {import('http').Server} server
 * @param {{ isValidToken?: (token: unknown) => boolean }} [options] Test seam only; the app
 *   always uses the process-wide launch token.
 */
function startWebSocketServer(server, options) {
  const isValidToken = (options && options.isValidToken) || isValidRelayToken;

  // Websocket server for sending updates and debugging
  var connectedSockets = [];
  var services = {};

  function broadcastMessage(msg, type) {
    var broadcastToType = type === 'viewer' ? 'editor' : 'viewer';
    for (var i = 0; i < connectedSockets.length; i++) {
      var s = connectedSockets[i];
      if (!s.authorised) continue; // see the module note — this is half the gate
      if (!type || s.type === broadcastToType) {
        s.ws.readyState === WebSocket.OPEN && s.ws.send(msg);
      }
    }
  }

  var wss = new WebSocketServer({
    server: server
  });

  wss.on('connection', function (ws) {
    var handle = {
      ws: ws
    };
    connectedSockets.push(handle);

    (function () {
      var _handle = handle;

      ws.on('message', function (message) {
        var request;
        try {
          request = JSON.parse(message);
        } catch (e) {
          // Unparseable input from an unauthorised socket is the shape a port scanner has.
          // Previously this threw out of the handler and `ws` swallowed it.
          return;
        }
        if (!request || typeof request !== 'object') return;

        // ⚠️ The token gate. Placed on `register` rather than on the HTTP upgrade because
        // `ws` can give a close *reason* here that a client can log, whereas a 401 on the
        // upgrade surfaces in browsers as an indistinguishable generic connection error.
        if (!_handle.authorised) {
          if (request.cmd !== 'register' || !isValidToken(request.token)) {
            console.log('Rejected an unauthorised connection to the project relay');
            try {
              ws.send(JSON.stringify({ cmd: 'registerRejected', reason: 'invalid or missing token' }));
            } catch (e) {
              /* the socket is going away regardless */
            }
            ws.close(CLOSE_UNAUTHORISED, 'unauthorised');
            return;
          }
          _handle.authorised = true;
        }

        // OBS-004 — "who is connected?", answered by the relay itself.
        //
        // The relay is the only party that knows. A peer that attaches *after* the preview
        // has already registered never sees its `nodelibrary` announcement, and there was no
        // other way to learn a viewer's clientId — which every pull on the trace channel
        // requires, because the runtime self-filters on it.
        //
        // ⚠️ The obvious alternative, `cmd: 'refresh'`, is destructive: the viewer handles it
        // by reloading the page, which clears the very trace buffer the caller connected to
        // read. Discovery must not have side effects on the thing being observed.
        //
        // Answered only to the asking socket, and only with ids and peer types — no project
        // content crosses this, and an unauthorised socket never reaches this line.
        if (request.cmd === 'clients') {
          ws.send(
            JSON.stringify({
              cmd: 'clients',
              clients: connectedSockets
                .filter((s) => s.authorised && s.clientId)
                .map((s) => ({ clientId: s.clientId, type: s.type }))
            })
          );
          return;
        }

        if (request.cmd === 'register') {
          _handle.type = request.type;
          _handle.clientId = request.clientId;

          // A viewer is connected, broadcast to editors
          if (request.type === 'viewer')
            broadcastMessage(
              JSON.stringify({
                cmd: 'registered',
                type: _handle.type,
                clientId: _handle.clientId
              }),
              _handle.type
            );

          if (_handle.type === 'service' && request.service)
            // A new serivce is registered
            services[request.service] = handle;
        }
        // If this is a request to a service, pass it along to the service
        else if (request.service) {
          var s = services[request.service];
          s && s.authorised && s.ws.send(message);
        } else {
          // If there is a target client, send the message to that client
          if (request.target) {
            for (var i = 0; i < connectedSockets.length; i++)
              if (connectedSockets[i].authorised && connectedSockets[i].clientId === request.target)
                connectedSockets[i].ws.send(message);
          }
          // Broadcast message to other connected sockets
          // message from viewers should go to connected editors and vice versa
          else broadcastMessage(message, _handle.type);
        }
      });

      ws.on('error', (e) => {
        console.log('ws error', e);
      });

      ws.on('close', function () {
        const idx = connectedSockets.indexOf(_handle);
        // A socket can close before it ever appears here in principle; `indexOf` returning
        // -1 used to throw on the next line, inside a `close` handler, where it is invisible.
        if (idx === -1) return;
        const clientId = connectedSockets[idx].clientId;
        connectedSockets.splice(idx, 1);

        // An unauthorised peer never announced itself, so there is nothing to un-announce —
        // and telling every editor that a viewer it never saw has disconnected would drop
        // that clientId's export cache.
        if (!_handle.authorised) return;

        // ⚠️ **Gated on the peer's type, which it never used to be.** This branch fired for
        // every socket, including editors, and got away with it only because editor peers had
        // no `clientId` — so the message editors received named nobody and did nothing. HUD-004
        // gives editor peers ids, and without this gate an editor window closing would tell
        // every other editor that client `editor-…` had disconnected: an export cache dropped
        // and a `viewerClientsChanged` for a viewer that never existed.
        if (_handle.type === 'viewer') {
          const msg = JSON.stringify({
            cmd: 'disconnect',
            clientId: clientId
          });
          broadcastMessage(msg, 'viewer'); // Notify editor that a viewer disconnected
          return;
        }

        // HUD-004 slice 3 — the other direction, which did not exist.
        //
        // Disconnects were announced only *toward editors*, so a viewer never learned that a
        // peer had gone away. That was harmless while the trace was one global boolean and
        // became a permanent failure the moment it grew owners: an agent killed mid-trace holds
        // its ownership for the life of the page, the set never empties, and the human's Stop
        // silently does nothing. Same class as "a project switch leaves the runtime tracing
        // forever" (FH-011).
        //
        // A peer with no `clientId` names nobody and is not worth the traffic.
        if (!clientId) return;
        broadcastMessage(
          JSON.stringify({
            cmd: 'peerDisconnected',
            clientId: clientId
          }),
          _handle.type || 'editor'
        );
      });
    })();
  });

  return wss;
}

module.exports = { startWebSocketServer, CLOSE_UNAUTHORISED };
