'use strict';

import type { RuntimeDiscoveredPort } from '@noodl/types';

import type { RuntimeEditorConnection } from './internal';

import EventSender = require('./eventsender');
import Services = require('./services/services');
import guid = require('./guid');

import ActiveWarnings = require('./editorconnection.activewarnings');

/** The WebSocket *instance* surface this file uses — DOM `WebSocket` or `ws` alike. */
interface WebSocketLike {
  readyState: number;
  send(data: string): void;
  close(): void;
  addEventListener(event: string, callback: (e?: WebSocketEventLike) => void): void;
}

/** The union of what the open/close/error/message handlers read off their event. */
interface WebSocketEventLike {
  code?: number;
  reason?: string;
  /** A string normally; a Blob when the payload is large — hence the `.text()` branch. */
  data?: string | { text(): Promise<string> };
  [extra: string]: unknown;
}

/** A WebSocket constructor plus the `OPEN` ready-state constant `isConnected` reads. */
interface WebSocketConstructorLike {
  new (address: string, options?: unknown): WebSocketLike;
  OPEN: number;
}

/** The host-supplied platform adapter, as this file uses it. */
interface EditorConnectionPlatform {
  getCurrentTime(): number;
  isRunningLocally?(): boolean;
  /** Node hosts supply `ws` here; browsers fall back to the global `WebSocket`. */
  webSocketClass?: WebSocketConstructorLike;
  webSocketOptions?: unknown;
  [extra: string]: unknown;
}

interface EditorConnectionOptions {
  runtimeType?: string;
  platform?: EditorConnectionPlatform;
  /** AIX-008: a sandbox preview's fixed id; anonymous clients mint a guid instead. */
  clientId?: string;
}

/** OBS-004 — per-connection options. Today: the relay token. */
interface ConnectOptions {
  /**
   * The relay's launch token. Omit in a browser and it is read from
   * `window.__nodegxRelayToken`, which the editor's web server injects into the page it
   * serves — so the page that was served by the relay always has the credential for it, and
   * no caller had to be changed.
   */
  token?: string;
}

/**
 * OBS-004 — the token the editor's web server injected into this page.
 *
 * Returns `undefined` off-browser and in a deployed build, where there is no relay to
 * authenticate to and `EditorConnection` is constructed but never usefully connected.
 */
function relayTokenFromPage(): string | undefined {
  if (typeof window === 'undefined') return undefined;
  const token = (window as unknown as { __nodegxRelayToken?: unknown }).__nodegxRelayToken;
  return typeof token === 'string' ? token : undefined;
}

/** One prefix/plug slice of the port set to run rename detection over. */
interface DetectRenamedSpec {
  prefix?: string;
  plug?: string;
}

interface SendDynamicPortsOptions {
  /** Consumed here: replaced by `renamed` before the message is sent. */
  detectRenamed?: DetectRenamedSpec | DetectRenamedSpec[];
  renamed?: Array<{ plug?: string; patterns: string[]; before: string; after: string }>;
  [extra: string]: unknown;
}

/**
 * The viewer's channel to the editor over the project WebSocket. Published narrowly as
 * `EditorConnectionLike` in `@noodl/types` (what a node definition may call) and more
 * fully as {@link RuntimeEditorConnection} in `internal.d.ts` (what the node context
 * drives); this is the implementation of both.
 */
interface EditorConnection extends RuntimeEditorConnection, EventSender {
  runtimeType?: string;
  platform?: EditorConnectionPlatform;
  fixedClientId?: string;
  clientId?: string;
  ws?: WebSocketConstructorLike;
  wsOptions?: unknown;
  socket?: WebSocketLike;
  reconnectOnClose: boolean;
  enableDebugger: boolean;
  lastSendTimestamp: number;
  sendQueue: unknown[];
  sendTimer?: ReturnType<typeof setTimeout>;
  activeWarnings: ActiveWarnings;

  on(eventName: string, callback: (data?: unknown) => void, ref?: unknown): void;

  /** Set once a rejected register has already triggered one reload; see {@link connect}. */
  hasRetriedRegistration?: boolean;

  isRunningLocally(): boolean;
  connect(address: string, options?: ConnectOptions): void;
  reconnect(address: string, options?: ConnectOptions): void;
  isConnected(): boolean;
  send(data: unknown): void;
  sendInspectId(id: string): void;
  sendSelectComponent(componentName: string): void;
  sendPulsingConnections(connectionMap: Record<string, { connections: unknown[] }>): void;
  sendTraceDictionary(dictionary: unknown): void;
  sendTraceEvents(events: unknown[]): void;
  sendPortValues(values: unknown[]): void;
  sendDynamicPorts(id: string, ports: RuntimeDiscoveredPort[], options?: SendDynamicPortsOptions): void;
  sendNodeSubLabel(nodeId: string, subLabel: string | undefined): void;
  clearWarnings(componentName: string, nodeId: string): void;
  sendPatches(patches: unknown): void;
  requestFullExport(): void;
  requestNoodlModules(): void;
  sendServiceRequest(request: Record<string, unknown>, callback: unknown): void;
  close(): void;
  sendNodeLibrary(nodelibrary: unknown): void;
  sendComponentMetadata(componentName: string, key: string, data: unknown): void;
  sendProjectMetadata(key: string, data: unknown): void;
}

interface EditorConnectionConstructor {
  new (opts?: EditorConnectionOptions): EditorConnection;
  prototype: EditorConnection;
}

const EditorConnection = function EditorConnection(this: EditorConnection, opts?: EditorConnectionOptions) {
  const _opts = opts || {};

  EventSender.call(this);

  this.runtimeType = _opts.runtimeType;
  this.platform = _opts.platform;
  // AIX-008: a client normally mints an anonymous guid. A sandbox preview passes
  // its own id instead, which is how the editor tells that client apart and feeds
  // it a different export (see ViewerConnection.registerSandboxExport). The WS
  // relay is untouched — it only ever copies whatever id the client registered.
  this.fixedClientId = _opts.clientId;
  this.ws =
    (_opts.platform && _opts.platform.webSocketClass) || (typeof WebSocket !== 'undefined' ? WebSocket : undefined);
  this.wsOptions = (_opts.platform && _opts.platform.webSocketOptions) || undefined;
  this.reconnectOnClose = true;
  this.enableDebugger = false;

  this.lastSendTimestamp = 0;
  this.sendQueue = [];
  this.sendTimer = undefined;

  //used to optimize warnings so we're not sending unneccessary warnings.
  //Clan slow down the editor in large projects
  this.activeWarnings = new ActiveWarnings();
} as unknown as EditorConnectionConstructor;

EditorConnection.prototype = Object.create(EventSender.prototype);
EditorConnection.prototype.constructor = EditorConnection;

EditorConnection.prototype.isRunningLocally = function (this: EditorConnection) {
  const runningLocallyInBrowser =
    (this.platform.isRunningLocally && this.platform.isRunningLocally()) ||
    (typeof document !== 'undefined' &&
      (document.location.hostname === 'localhost' || document.location.hostname === '127.0.0.1'));
  return runningLocallyInBrowser;
};

EditorConnection.prototype.connect = function (this: EditorConnection, address, options) {
  this.socket = this.wsOptions ? new this.ws(address, this.wsOptions) : new this.ws(address);

  const self = this;
  const token = (options && options.token) || relayTokenFromPage();

  this.socket.addEventListener('open', function () {
    self.clientId = self.fixedClientId || guid();
    self.socket.send(
      JSON.stringify({
        cmd: 'register',
        type: 'viewer',
        clientId: self.clientId,
        // OBS-004. Absent in a deployed build, where there is no relay listening anyway.
        token: token
      })
    );
    self.emit('connected');
  });

  this.socket.addEventListener('close', function (event) {
    if (self.reconnectOnClose) {
      self.reconnect(address, options);
    }
    console.log('Editor connection closed', event.code, event.reason);
    self.emit('connectionClosed');
  });

  this.socket.addEventListener('error', function (evt) {
    console.log('Editor connection error, trying to reconnect');
  });

  this.socket.addEventListener('message', async (e) => {
    // NOTE: When the data is too big it seems to change from string to a blob
    const text = typeof e.data === 'string' ? e.data : await e.data.text();
    const message = JSON.parse(text);

    let content;

    if (message.cmd === 'registered') {
      //ignore
    } else if (message.cmd === 'registerRejected') {
      // OBS-004. The usual cause is benign and self-healing: the preview was opened in a
      // second browser window, the editor was then restarted, and this page is still holding
      // the *previous* launch's token. Reloading re-fetches the HTML, and the token is
      // injected into the HTML, so one reload fixes it.
      //
      // ⚠️ Bounded to a single attempt. The page could be served from the browser's HTTP
      // cache, in which case the reload returns the same stale token and a naive retry is an
      // infinite reload loop — the worst possible failure for a diagnostic path.
      self.reconnectOnClose = false;
      if (!self.hasRetriedRegistration && typeof window !== 'undefined' && window.location) {
        self.hasRetriedRegistration = true;
        console.log('The editor rejected this preview; reloading to pick up the current token');
        window.location.reload();
      } else {
        console.log(
          'The editor rejected this preview: ' +
            (message.reason || 'unknown reason') +
            '. Reload the page, or reopen the preview from the editor.'
        );
      }
    } else if (message.cmd === 'export') {
      content = JSON.parse(message.content);
      if (message.type === 'full' && message.target === this.clientId) {
        self.emit('exportDataFull', content);
      }
    } else if (message.cmd === 'hoverStart') {
      self.emit('hoverStart', message.content.id);
    } else if (message.cmd === 'hoverEnd') {
      self.emit('hoverEnd', message.content.id);
    } else if (message.cmd === 'refresh') {
      self.emit('reload');
    } else if (message.cmd === 'debugInspectors') {
      if (this.debugInspectorsEnabled) {
        content = JSON.parse(message.content);
        self.emit('debugInspectorsUpdated', content.inspectors);
      }
    } else if (message.cmd === 'debuggingEnabled') {
      if (self.isRunningLocally()) {
        content = JSON.parse(message.content);
        self.emit('debuggingEnabledChanged', content.enabled);
      }
    } else if (message.cmd === 'traceEnabled') {
      // OBS-001. Wired exactly like `debuggingEnabled` above, including the `isRunningLocally`
      // gate: the trace captures every value in the app, so it must never be switchable on a
      // deployed runtime by anything that can reach the socket.
      if (self.isRunningLocally()) {
        content = JSON.parse(message.content);
        self.emit('traceEnabledChanged', content.enabled);
      }
    } else if (message.cmd === 'getTraceEvents') {
      if (self.isRunningLocally()) {
        content = JSON.parse(message.content);
        await self.emit('getTraceEvents', { clientId: content.clientId, afterSeq: content.afterSeq });
      }
    } else if (message.cmd === 'getTraceDictionary') {
      // OBS-002. `setTraceEnabled` sends the dictionary on the off→on transition only, so a
      // consumer that attaches to an already-running trace — the walk panel being re-opened,
      // a second editor window, an agent connecting mid-session — had no way to obtain the
      // topology short of toggling the trace off and on, which would destroy the buffer it
      // came for.
      if (self.isRunningLocally()) {
        content = JSON.parse(message.content);
        await self.emit('getTraceDictionary', { clientId: content.clientId });
      }
    } else if (message.cmd === 'getPortValues') {
      // OBS-002 layer 1. Distinct from `getConnectionValue`, which reads `_outputHistory` —
      // a record of what was *sent* while debug inspectors happened to be on. This reads the
      // ports themselves, so it answers "why is this label X?" on an app that booted with
      // debugging off and has fired nothing since.
      if (self.isRunningLocally()) {
        content = JSON.parse(message.content);
        await self.emit('getPortValues', { clientId: content.clientId, ports: content.ports });
      }
    } else if (message.cmd === 'getConnectionValue') {
      if (self.isRunningLocally()) {
        content = JSON.parse(message.content);
        await self.emit('getConnectionValue', { clientId: content.clientId, connectionId: content.connectionId });
      }
    } else if (message.cmd === 'modelUpdate') {
      await self.emit('modelUpdate', message.content);
    } else if (message.cmd === 'publish') {
      Services.pubsub.routeMessage(message); // Publish a message from the pubsub service
    } else if (message.cmd === 'noodlModules') {
      self.emit('noodlModules', JSON.parse(message.content));
    } else if (message.cmd === 'mqttUpdate') {
      self.emit('mqttUpdate', message.content);
    } else if (message.cmd === 'activeComponentChanged') {
      self.emit('activeComponentChanged', message.component);
    } else {
      console.log('Command not implemented', message);
    }
  });
};

EditorConnection.prototype.reconnect = function (this: EditorConnection, address, options) {
  const self = this;

  setTimeout(function () {
    self.connect(address, options);
  }, 2000);
};

EditorConnection.prototype.isConnected = function (this: EditorConnection) {
  return this.socket !== undefined && this.socket.readyState === this.ws.OPEN;
};

//JSON replacer to make cyclic objects non-cyclic.
//Using this example: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Errors/Cyclic_object_value#examples
const getCircularReplacer = () => {
  const seen = new WeakSet();
  return (key: string, value: unknown) => {
    if (typeof value === 'object' && value !== null) {
      if (seen.has(value)) {
        return '[Circular]';
      }
      seen.add(value);
    }
    return value;
  };
};

EditorConnection.prototype.send = function (this: EditorConnection, data) {
  const now = this.platform.getCurrentTime();
  const dt = now - this.lastSendTimestamp;

  //Send objects as json and capture exceptions
  const trySend = (msg: unknown) => {
    try {
      this.socket.send(JSON.stringify(msg));
    } catch (e) {
      if (e.message && e.message.startsWith('Converting circular')) {
        //the object is circular, try to address it
        try {
          this.socket.send(JSON.stringify(msg, getCircularReplacer()));
        } catch (e) {
          //still failed, give up
          console.log('failed to send message to editor', msg, e);
        }
      } else {
        //message couldn't be serialized to json
        console.log('failed to send message to editor', msg, e);
      }
    }
  };

  //batch messages so they're only sent at most every 200ms
  //note that the first message will always be sent immediately, and the ones for 200ms after
  //that one will be queued. So initial message response time is as low as possible (for hover etc)
  if (dt < 200 || this.sendTimer || !this.isConnected()) {
    this.sendQueue.push(data);
    if (!this.sendTimer) {
      this.sendTimer = setTimeout(() => {
        // Clear the timer handle *before* the connected check, or a disconnected flush leaves
        // `sendTimer` truthy for ever: the guard at the top of `send` then takes the queue
        // branch on every later call, `!this.sendTimer` is false so no replacement timer is
        // armed, and `sendQueue` grows without bound for the life of the page. In a deployed
        // build the socket is never connected (`noodl-runtime.ts:285-288` constructs one
        // anyway), and every runtime warning goes down this path — so the queue was a slow leak
        // driven by exactly the diagnostics that can never be delivered. Dropping the queue is
        // right rather than merely cheap: these messages are editor telemetry, and an editor
        // that connects later wants the current state, not a replay of everything since boot.
        this.sendTimer = undefined;

        if (this.isConnected() === false) {
          this.sendQueue = [];
          return;
        }

        //send messages in chunks. If we send too many at once the editor UI can freeze for a while
        //since it's handling these in the renderer process
        const chunkSize = 50;
        for (let i = 0; i < this.sendQueue.length; i += chunkSize) {
          const chunk = this.sendQueue.slice(i, i + chunkSize);
          trySend(chunk);
        }

        this.sendQueue = [];
        this.sendTimer = undefined;
        this.lastSendTimestamp = this.platform.getCurrentTime();
      }, 100);
    }
  } else {
    this.lastSendTimestamp = now;
    trySend(data);
  }
};

EditorConnection.prototype.sendInspectId = function (this: EditorConnection, id) {
  this.send({
    cmd: 'select',
    type: 'viewer',
    content: JSON.stringify({ id: id })
  });
};

EditorConnection.prototype.sendSelectComponent = function (this: EditorConnection, componentName) {
  this.send({
    cmd: 'select',
    type: 'viewer',
    content: JSON.stringify({ componentName })
  });
};

EditorConnection.prototype.sendPulsingConnections = function (this: EditorConnection, connectionMap) {
  let connectionsToPulse = [];
  Object.keys(connectionMap).forEach(function (c) {
    const connection = connectionMap[c];
    connectionsToPulse = connectionsToPulse.concat(connection.connections);
  });

  this.send({
    cmd: 'connectiondebugpulse',
    type: 'viewer',
    content: JSON.stringify({
      connectionsToPulse: connectionsToPulse
    })
  });
};

EditorConnection.prototype.sendDebugInspectorValues = function (this: EditorConnection, inspectors) {
  this.send({
    cmd: 'debuginspectorvalues',
    type: 'viewer',
    content: { inspectors }
  });
};

EditorConnection.prototype.sendConnectionValue = function (this: EditorConnection, connectionId, value) {
  this.send({
    cmd: 'connectionValue',
    type: 'viewer',
    content: { connectionId, value }
  });
};

/**
 * The session dictionary (OBS-001): ids to names, types, components, and the topology.
 * Sent once when tracing starts and again whenever the graph is replaced.
 */
EditorConnection.prototype.sendTraceDictionary = function (this: EditorConnection, dictionary) {
  this.send({
    cmd: 'traceDictionary',
    type: 'viewer',
    content: JSON.stringify(dictionary)
  });
};

/**
 * A batch of trace events, in the nested wire shape.
 *
 * Batched by the caller rather than sent per event: `send` already coalesces on a 200ms timer
 * and chunks at 50 messages, and one event per message would defeat both.
 */
EditorConnection.prototype.sendTraceEvents = function (this: EditorConnection, events) {
  this.send({
    cmd: 'traceEvents',
    type: 'viewer',
    content: JSON.stringify({ events })
  });
};

/**
 * Current values for a batch of ports (OBS-002 layer 1).
 *
 * Batched because a walk annotates every hop at once: one round trip per row would make a
 * ten-row walk ten round trips over a socket that already coalesces on a 200ms timer.
 */
EditorConnection.prototype.sendPortValues = function (this: EditorConnection, values) {
  this.send({
    cmd: 'portValues',
    type: 'viewer',
    content: JSON.stringify({ values })
  });
};

const dynamicPortsHash: Record<string, string> = {};

function _detectRename(before: string[], after: string[]): { before?: string; after?: string } | undefined {
  if (!before || !after) return;

  if (before.length !== after.length) return; // Must be of same length

  const res: { before?: string; after?: string } = {};
  for (let i = 0; i < before.length; i++) {
    if (after.indexOf(before[i]) === -1) {
      if (res.before) return; // Can only be one from before that is missing
      res.before = before[i];
    }

    if (before.indexOf(after[i]) === -1) {
      if (res.after) return; // Only one can be missing,otherwise we cannot match
      res.after = after[i];
    }
  }

  return res.before && res.after ? res : undefined;
}

EditorConnection.prototype.sendDynamicPorts = function (this: EditorConnection, id, ports, options) {
  const hash = JSON.stringify(ports);
  if (dynamicPortsHash[id] === hash) {
    // Make sure we don't resend the same port data
    return;
  }

  if (dynamicPortsHash[id] && ports && options && options.detectRenamed) {
    const detectRenamed = Array.isArray(options.detectRenamed) ? options.detectRenamed : [options.detectRenamed];

    const renamed: Array<{ plug?: string; patterns: string[]; before: string; after: string }> = [];
    detectRenamed.forEach((d) => {
      let before: RuntimeDiscoveredPort[] = JSON.parse(dynamicPortsHash[id]);
      let after: RuntimeDiscoveredPort[] = ([] as RuntimeDiscoveredPort[]).concat(ports);

      // Filter ports with correct prefix and plug
      if (d.prefix) {
        before = before.filter((p) => p.name.startsWith(d.prefix));
        after = after.filter((p) => p.name.startsWith(d.prefix));
      }

      if (d.plug) {
        before = before.filter((p) => p.plug === d.plug);
        after = after.filter((p) => p.plug === d.plug);
      }

      // Remove the prefix
      const afterNames = after.map((p) => p.name.substring((d.prefix || '').length));
      const beforeNames = before.map((p) => p.name.substring((d.prefix || '').length));

      // Find the one that is renamed (if any)
      const res = _detectRename(beforeNames, afterNames);
      if (res) {
        renamed.push({
          plug: d.plug,
          patterns: [(d.prefix || '') + '{{*}}'],
          before: res.before,
          after: res.after
        });
      }
    });
    if (renamed.length > 0) options.renamed = renamed;

    delete options.detectRenamed;
  }

  dynamicPortsHash[id] = hash;

  this.send({
    cmd: 'instanceports',
    type: 'viewer',
    content: JSON.stringify({
      nodeid: id,
      ports: ports,
      options: options
    })
  });
};

/**
 * Tell the editor what a scope-resolving node actually bound to (BINDING-CONTRACT §(b)).
 *
 * The editor paints it in the node card's sub-label slot. `undefined` clears it.
 *
 * Not a warning: a binding that worked is not a problem, and routing it through
 * `sendWarning` would draw the danger ring and file an entry in the Problems panel for a
 * node that is behaving perfectly. Not a dynamic port either — this is display text, and a
 * port would be structure, saved into the project and connectable.
 *
 * Aggregation across a graph node's live instances happens *before* this call, in
 * `resolvedtarget.ts`; by here there is one string for one node id.
 */
EditorConnection.prototype.sendNodeSubLabel = function (this: EditorConnection, nodeId, subLabel) {
  this.send({
    cmd: 'nodesublabel',
    type: 'viewer',
    content: JSON.stringify({
      nodeId: nodeId,
      subLabel: subLabel
    })
  });
};

EditorConnection.prototype.sendWarning = function (this: EditorConnection, componentName, nodeId, key, warning) {
  const isNewWarning = this.activeWarnings.setWarning(nodeId, key, warning);

  if (isNewWarning) {
    this.send({
      cmd: 'showwarning',
      type: 'viewer',
      content: JSON.stringify({
        componentName: componentName,
        nodeId: nodeId,
        key: key,
        warning: warning
      })
    });
  }
};

EditorConnection.prototype.clearWarning = function (this: EditorConnection, componentName, nodeId, key) {
  const hasWarning = this.activeWarnings.clearWarning(nodeId, key);

  if (hasWarning) {
    this.send({
      cmd: 'showwarning',
      type: 'viewer',
      content: JSON.stringify({
        componentName: componentName,
        nodeId: nodeId,
        key: key,
        warning: undefined
      })
    });
  }
};

EditorConnection.prototype.clearWarnings = function (this: EditorConnection, componentName, nodeId) {
  const hasWarnings = this.activeWarnings.clearWarnings(nodeId);

  if (hasWarnings) {
    this.send({
      cmd: 'clearwarnings',
      type: 'viewer',
      content: JSON.stringify({
        componentName: componentName,
        nodeId: nodeId
      })
    });
  }
};

EditorConnection.prototype.sendPatches = function (this: EditorConnection, patches) {
  this.send({
    cmd: 'patchproject',
    type: 'viewer',
    content: JSON.stringify(patches)
  });
};

EditorConnection.prototype.requestFullExport = function (this: EditorConnection) {
  this.send({
    cmd: 'register',
    type: 'viewer'
  });
};

EditorConnection.prototype.requestNoodlModules = function (this: EditorConnection) {
  this.send({
    cmd: 'getNoodlModules',
    type: 'viewer'
  });
};

/**
 * DEFECT (PLAT-003 NOTES §31), left verbatim: this registry is write-only. No message
 * handler reads `serviceRequests`, so a callback passed to `sendServiceRequest` is never
 * invoked and its entry is never freed — the responses this was built for are not routed
 * anywhere in the repo.
 */
const serviceRequests: Record<string, unknown> = {};
EditorConnection.prototype.sendServiceRequest = function (this: EditorConnection, request, callback) {
  request.token = guid();
  request.clientId = this.clientId;
  serviceRequests[request.token as string] = callback;
  this.send(request);
};

EditorConnection.prototype.close = function (this: EditorConnection) {
  this.reconnectOnClose = false;

  if (this.isConnected() === false) {
    return;
  }

  this.socket.close();
};

EditorConnection.prototype.sendNodeLibrary = function (this: EditorConnection, nodelibrary) {
  this.send({
    cmd: 'nodelibrary',
    type: 'viewer',
    runtimeType: this.runtimeType,
    content: nodelibrary,
    clientId: this.clientId
  });
};

EditorConnection.prototype.sendComponentMetadata = function (this: EditorConnection, componentName, key, data) {
  this.send({
    cmd: 'componentMetadata',
    type: 'viewer',
    content: JSON.stringify({
      componentName,
      key,
      data
    })
  });
};

EditorConnection.prototype.sendProjectMetadata = function (this: EditorConnection, key, data) {
  this.send({
    cmd: 'projectMetadata',
    type: 'viewer',
    content: JSON.stringify({
      key,
      data
    })
  });
};

export = EditorConnection;
