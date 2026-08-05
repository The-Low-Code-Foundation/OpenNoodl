/**
 * OBS-004 — an `editor` peer on the project relay, from outside the editor.
 *
 * ## Why this needs no access to the project on disk
 *
 * That is the whole point, and it is why OBS-001's session dictionary ships **topology** and
 * not just names. A peer that can read the dictionary knows every node's id, name, type and
 * component, *and* every connection between them — which is everything the walk needs. So this
 * server works on a project it cannot see, in a format it does not understand, including the
 * legacy projects `@noodl/mcp` refuses outright.
 *
 * ⚠️ **Not to be confused with `@noodl/mcp`.** That server reads project *directories*; this
 * one reads a *running app* over a socket. They share a package for packaging reasons only —
 * one npm dependency set, one build — and share no code paths.
 *
 * ## The parts that are not obvious
 *
 * ⚠️ **Every reply is a broadcast.** The relay fans viewer traffic to *all* editor peers, and
 * the runtime's own `send()` batches messages into arrays on a 200ms timer — so a reply
 * cannot be routed back to just this client by setting `target`, because the array wrapper has
 * no `target` field for the relay to read. Correlation is therefore done here, on receipt, and
 * the editor window will also see the answers to questions this server asked. That is benign
 * for values and the dictionary; for the event buffer it is the reason `TraceSession`
 * de-duplicates by `seq`.
 *
 * ⚠️ **There is one runtime, and the trace switch is global.** If this server starts a trace,
 * the editor's Provenance panel sees the same trace, and `start_trace` clears the buffer for
 * both. That is a property of there being one running app, not a bug — but it means two
 * consumers can surprise each other, and it is called out in the tool descriptions.
 *
 * ⚠️ **`globalThis.WebSocket`, not the `ws` package.** Node 22 ships one and this repo
 * requires Node 22, so the observe server has no dependencies of its own at all.
 *
 * ⚠️ **This client outlives the editor** (MCP-003). An MCP client spawns a stdio server once
 * and holds it for the whole session, while the editor it talks to is quit and restarted
 * freely — minting a *new* relay token every time. So a connection is a thing that drops and
 * comes back, not a thing that is established once, and everything that describes the running
 * app is per-connection state that a reconnect must drop rather than carry over.
 */

const DEFAULT_PORT = 8574;

/** How long a request may go unanswered before the caller is told rather than left hanging. */
const DEFAULT_TIMEOUT = 5000;

/**
 * How long to wait after `register` before calling a connection accepted.
 *
 * ⚠️ Load-bearing, and the reason the backoff below has a floor: there is no `registered` ack
 * for an *editor* peer — the relay only announces viewers — so "accepted" is distinguished from
 * "refused" by nothing happening for this long. A retry faster than this races its own success
 * detection.
 */
const ACCEPT_GRACE = 250;

/** First reconnect delay, and the ceiling it doubles towards. */
const DEFAULT_RECONNECT_DELAY = 500;
const DEFAULT_MAX_RECONNECT_DELAY = 10_000;

export interface EdgeRef {
  node: string;
  port: string;
}

export interface Topology {
  nodes: Record<string, { name: string; type: string; component: string }>;
  edges: Array<{ from: EdgeRef; to: EdgeRef }>;
}

export interface WireTraceEvent {
  seq: number;
  t: number;
  cause: number;
  from: EdgeRef;
  to: EdgeRef;
  value: string;
  kind: 'value' | 'signal';
}

export interface PortValueResult extends EdgeRef {
  direction: 'input' | 'output';
  exists: boolean;
  value?: string;
}

export interface InputResult {
  requestId?: string;
  ok: boolean;
  matched: number;
  message?: string;
}

/** A warning the running app reported about one of its own nodes. */
export interface RuntimeWarning {
  componentName: string;
  nodeId: string;
  key: string;
  message: string;
}

interface Waiter {
  matches: (message: Record<string, unknown>) => boolean;
  resolve: (message: Record<string, unknown>) => void;
  /** Used when the connection dies under a request — see `onConnectionLost`. */
  reject: (error: Error) => void;
  timer: ReturnType<typeof setTimeout>;
}

export interface RelayClientOptions {
  token: string;
  port?: number;
  host?: string;
  timeout?: number;
  /**
   * Re-read the token before each reconnect attempt.
   *
   * ⚠️ The whole point of MCP-003. The editor mints a fresh token every launch, so the token
   * this client started with is stale the moment the editor restarts, and reusing it produces
   * close code 4401 forever. The *caller* supplies this rather than the client calling
   * `findRelayToken` itself, so the `--token` / `$NODEGX_RELAY_TOKEN` / file precedence stays
   * in one place (`token.ts`) and an explicit token stays explicit across reconnects.
   *
   * Returning `undefined` (nothing found this instant — the editor is still down) keeps the
   * current token and retries; it is not an error.
   */
  refreshToken?: () => string | undefined;
  /** First backoff delay, ms. Floored at {@link ACCEPT_GRACE}. */
  reconnectDelay?: number;
  /** Backoff ceiling, ms. */
  maxReconnectDelay?: number;
  /**
   * Where lifecycle lines go.
   *
   * ⚠️ stdout is the MCP protocol channel — one stray line there corrupts the session in a way
   * that looks like a client bug — so the default is stderr, and tests pass their own sink.
   */
  log?: (line: string) => void;
}

/**
 * `disconnected` is the state before the first `connect()`; `closed` means *we* closed it and
 * no reconnect is coming. Only `reconnecting` is recoverable without user action.
 */
export type RelayConnectionState = 'disconnected' | 'connected' | 'reconnecting' | 'closed';

export class RelayClient {
  private socket: WebSocket | undefined;
  private readonly options: Required<Omit<RelayClientOptions, 'token' | 'refreshToken'>>;
  private readonly refreshToken: () => string | undefined;
  /** Mutable: a reconnect after an editor restart replaces it. */
  private token: string;
  private waiters: Waiter[] = [];

  /** Observable so the tools, and the tests, can say what is actually true. */
  public state: RelayConnectionState = 'disconnected';
  /** Failed reconnect attempts since the last successful connection. */
  private attempts = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | undefined;
  private lastLoggedDelay = 0;
  private lastFailure: string | undefined;

  /** Viewer clients that have announced a node library, in announcement order. */
  public viewerClients: string[] = [];
  public topology: Topology | undefined;
  /** Accumulated trace events, de-duplicated and ordered by `seq`. */
  public events: WireTraceEvent[] = [];
  /**
   * Whether *this* server asked for a recording.
   *
   * ⚠️ Not `events.length > 0`. A recording that captured nothing is an answer — every edge
   * genuinely never fired — and inferring it from the count reports the single most
   * informative run as "we know nothing". OBS-002 shipped this bug and found it live.
   */
  public recording = false;
  public warnings = new Map<string, RuntimeWarning>();

  private highestSeq = 0;

  constructor(options: RelayClientOptions) {
    this.token = options.token;
    this.refreshToken = options.refreshToken ?? (() => undefined);
    this.options = {
      port: options.port ?? Number(process.env.NOODLPORT || DEFAULT_PORT),
      host: options.host ?? 'localhost',
      timeout: options.timeout ?? DEFAULT_TIMEOUT,
      // ⚠️ Floored at the accept grace: see ACCEPT_GRACE. A caller asking for 50ms would get a
      // client that reports every successful reconnect as a failure.
      reconnectDelay: Math.max(ACCEPT_GRACE, options.reconnectDelay ?? DEFAULT_RECONNECT_DELAY),
      maxReconnectDelay: options.maxReconnectDelay ?? DEFAULT_MAX_RECONNECT_DELAY,
      log: options.log ?? ((line: string) => process.stderr.write(line + '\n'))
    };
  }

  get address(): string {
    return `ws://${this.options.host}:${this.options.port}`;
  }

  get isConnected(): boolean {
    return !!this.socket && this.socket.readyState === 1;
  }

  /**
   * The first connection.
   *
   * ⚠️ **Still rejects when there is nothing to connect to**, and deliberately does not start
   * retrying — `cli.ts` refuses to start a server whose editor is absent, because a server that
   * starts cleanly and then answers "could not connect" to every call reads as a broken server.
   * Recovery is for the *already-running* server only, and begins at the first close after a
   * connection that worked.
   */
  async connect(): Promise<void> {
    this.state = 'disconnected';
    await this.openSocket();
    this.state = 'connected';
    this.attempts = 0;
    this.lastLoggedDelay = 0;
  }

  /**
   * Open one socket and register on it.
   *
   * The `settled` guard covers the *initial* handshake only. A close after settling is a lost
   * connection rather than a failed one, and is what schedules the reconnect — the bug MCP-003
   * fixes was that this handler returned early and did nothing else, forever.
   */
  private openSocket(): Promise<void> {
    return new Promise((resolve, reject) => {
      let settled = false;
      let socket: WebSocket;
      try {
        socket = new WebSocket(this.address);
      } catch (e) {
        reject(new Error(`Could not reach the NodeGX relay at ${this.address}: ${(e as Error).message}`));
        return;
      }

      socket.addEventListener('open', () => {
        socket.send(JSON.stringify({ cmd: 'register', type: 'editor', token: this.token }));
        // There is no `registered` ack for an editor peer — the relay only announces
        // *viewers*. A rejection, however, arrives immediately and closes the socket, so a
        // short grace period is what distinguishes accepted from refused.
        setTimeout(() => {
          if (settled) return;
          settled = true;
          this.socket = socket;
          resolve();
        }, ACCEPT_GRACE);
      });

      socket.addEventListener('message', (event: MessageEvent) => {
        void this.onMessage(event.data);
      });

      socket.addEventListener('close', (event: CloseEvent) => {
        if (!settled) {
          settled = true;
          reject(
            new Error(
              event.code === 4401
                ? 'The editor refused this connection: the relay token is wrong or stale. The editor mints a new one every launch — re-read it, or restart this server.'
                : `The connection to ${this.address} closed before it was established (code ${event.code}).`
            )
          );
          return;
        }
        // A superseded socket closing must not tear down the one that replaced it.
        if (this.socket !== socket) return;
        this.onConnectionLost(`the connection closed (code ${event.code})`);
      });

      socket.addEventListener('error', () => {
        if (settled) return;
        settled = true;
        reject(
          new Error(
            `Could not reach the NodeGX relay at ${this.address}. Is the editor running, with a project open?`
          )
        );
      });
    });
  }

  /**
   * The editor went away.
   *
   * ⚠️ **Everything this client knows about the running app dies with the connection**, and
   * keeping any of it is worse than losing it:
   *
   *  - `viewerClients` are ids of a process that no longer exists; addressing one produces
   *    "the preview did not answer" on every call — connected-looking and permanently silent.
   *  - `topology` describes that same dead app.
   *  - `highestSeq` is the one that would be silent rather than noisy: a fresh runtime builds a
   *    fresh `TraceBuffer` whose `nextSeq` starts at **1** (`noodl-runtime/src/tracebuffer.ts`),
   *    so a retained high-water mark discards every event of the new session while the tools
   *    report a healthy connection. The buffer goes with it, for the same reason
   *    `setTraceEnabled(true)` clears it: a walk spliced from two sessions is a wrong answer.
   *
   * `recording` is the one thing that is *kept* — it is what this server was asked to do, not
   * something the app told us — and is re-sent once the connection is back.
   */
  private onConnectionLost(reason: string): void {
    if (this.state === 'closed' || this.state === 'reconnecting') return;
    this.state = 'reconnecting';
    this.socket = undefined;
    this.lastFailure = reason;

    this.viewerClients = [];
    this.topology = undefined;
    this.events = [];
    this.highestSeq = 0;

    // A pending request would otherwise sit until its timeout and then blame the preview for
    // not answering, which sends the reader off looking at the wrong process.
    const waiting = this.waiters.splice(0);

    this.options.log(`nodegx-observe: lost the editor connection (${reason}).`);
    this.scheduleReconnect();

    // After the state is `reconnecting`, so the rejection carries the retry message rather
    // than the pre-connection one.
    for (const waiter of waiting) {
      clearTimeout(waiter.timer);
      waiter.reject(new Error(this.describeDisconnected()));
    }
  }

  private scheduleReconnect(): void {
    if (this.state !== 'reconnecting') return;
    const delay = Math.min(
      this.options.reconnectDelay * Math.pow(2, this.attempts),
      this.options.maxReconnectDelay
    );
    // stderr is the human channel, so: the first failure and every escalation, never every
    // attempt. Once the delay is capped this stops logging entirely.
    if (delay !== this.lastLoggedDelay) {
      this.lastLoggedDelay = delay;
      this.options.log(`nodegx-observe: retrying the editor connection every ${delay}ms until it is back.`);
    }
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = setTimeout(() => {
      void this.attemptReconnect();
    }, delay);
    // Never hold the process open on our own account: the MCP transport owns the lifetime.
    if (typeof (this.reconnectTimer as { unref?: () => void }).unref === 'function') {
      (this.reconnectTimer as unknown as { unref: () => void }).unref();
    }
  }

  private async attemptReconnect(): Promise<void> {
    if (this.state !== 'reconnecting') return;

    const refreshed = this.refreshToken();
    if (refreshed) this.token = refreshed;

    try {
      await this.openSocket();
    } catch (err) {
      this.lastFailure = (err as Error).message;
      this.attempts++;
      this.scheduleReconnect();
      return;
    }

    if (this.state !== 'reconnecting') return; // closed while we were connecting
    this.state = 'connected';
    this.attempts = 0;
    this.lastLoggedDelay = 0;
    this.lastFailure = undefined;
    this.options.log(`nodegx-observe: reconnected to ${this.address}.`);

    // Re-arm what we asked for, not what the app remembers — the relay and the runtime know
    // nothing about a trace requested over a socket that no longer exists, so an armed
    // recording would silently disarm across a restart (FH-011's class of defect).
    if (this.recording) {
      try {
        this.send({ cmd: 'traceEnabled', content: JSON.stringify({ enabled: true }) });
      } catch (e) {
        /* the socket died again between here and there; the close handler takes it from here */
      }
    }
  }

  close(): void {
    this.state = 'closed';
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = undefined;
    if (this.socket) this.socket.close();
    this.socket = undefined;
  }

  /**
   * What to tell a caller that arrived while there is no socket.
   *
   * ⚠️ The bar is `describeMissingToken` in `token.ts`: actionable rather than
   * accurate-and-useless. "Not connected to the NodeGX relay." was accurate, permanent, and
   * read like a bug in NodeGX — the user was never told that the cause was their own editor
   * restart, nor that nothing on their side needs restarting.
   */
  private describeDisconnected(): string {
    if (this.state === 'reconnecting') {
      return (
        'The connection to the NodeGX editor dropped, and this server is retrying' +
        (this.lastFailure ? ` (${this.lastFailure})` : '') +
        '. The usual cause is the editor being quit or restarted. Start the editor again with ' +
        'the project open and the preview running, then try again — this server reconnects on ' +
        'its own, including to the new relay token the editor mints at each launch, so there ' +
        'is nothing here to restart.'
      );
    }
    if (this.state === 'closed') {
      return 'This server has closed its connection to the NodeGX relay and is not retrying.';
    }
    return `Not connected to the NodeGX relay at ${this.address}. Is the editor running, with a project open?`;
  }

  private async onMessage(data: unknown): Promise<void> {
    let text: string;
    if (typeof data === 'string') text = data;
    else if (data && typeof (data as Blob).text === 'function') text = await (data as Blob).text();
    else text = String(data);

    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch (e) {
      return;
    }

    // ⚠️ The runtime batches into arrays under load. A consumer that only handles objects
    // works perfectly on an idle app and silently drops everything on a busy one — which is
    // the only time it matters.
    const messages = Array.isArray(parsed) ? parsed : [parsed];
    for (const message of messages) {
      if (message && typeof message === 'object') this.handle(message as Record<string, unknown>);
    }
  }

  private handle(message: Record<string, unknown>): void {
    const content = () => {
      const raw = message.content;
      if (typeof raw === 'string') {
        try {
          return JSON.parse(raw);
        } catch (e) {
          return undefined;
        }
      }
      return raw;
    };

    switch (message.cmd) {
      case 'nodelibrary': {
        // The only announcement that names a viewer client. OBS-002 learned the hard way that
        // the node library, not `registered`, is what tells you a client is ready to answer.
        const id = message.clientId as string;
        if (id && !this.viewerClients.includes(id)) this.viewerClients.push(id);
        break;
      }
      case 'disconnect': {
        this.viewerClients = this.viewerClients.filter((id) => id !== message.clientId);
        break;
      }
      case 'traceDictionary': {
        const dictionary = content() as Topology | undefined;
        if (dictionary) this.topology = dictionary;
        break;
      }
      case 'traceEvents': {
        const body = content() as { events?: WireTraceEvent[] } | undefined;
        if (body && Array.isArray(body.events)) this.absorbEvents(body.events);
        break;
      }
      case 'showwarning': {
        const body = content() as { componentName: string; nodeId: string; key: string; warning?: { message?: string } };
        if (!body) break;
        const key = body.nodeId + '|' + body.key;
        if (body.warning && body.warning.message) {
          this.warnings.set(key, {
            componentName: body.componentName,
            nodeId: body.nodeId,
            key: body.key,
            message: body.warning.message
          });
        } else {
          this.warnings.delete(key);
        }
        break;
      }
      case 'clearwarnings': {
        const body = content() as { nodeId: string };
        if (!body) break;
        for (const key of Array.from(this.warnings.keys())) {
          if (key.startsWith(body.nodeId + '|')) this.warnings.delete(key);
        }
        break;
      }
      default:
        break;
    }

    for (const waiter of this.waiters.slice()) {
      if (!waiter.matches(message)) continue;
      clearTimeout(waiter.timer);
      this.waiters = this.waiters.filter((w) => w !== waiter);
      waiter.resolve(message);
    }
  }

  /**
   * Merge a batch of events into the buffer.
   *
   * ⚠️ De-duplicated by `seq`, because the editor and this server both pull from the same
   * runtime and every reply is broadcast to both. Without this, an editor window open on the
   * Provenance panel would double every `fired N×` count this server reports — the aggregation
   * that OBS-002 built specifically so one row could say "fired 100×" instead of showing 100.
   */
  private absorbEvents(incoming: WireTraceEvent[]): void {
    let added = false;
    for (const event of incoming) {
      if (event.seq <= this.highestSeq) continue;
      this.events.push(event);
      this.highestSeq = event.seq;
      added = true;
    }
    // The runtime emits in `seq` order, so this is a no-op in practice; it costs nothing and
    // makes the buffer's ordering a property of the buffer rather than of the sender.
    if (added) this.events.sort((a, b) => a.seq - b.seq);
  }

  private send(message: Record<string, unknown>): void {
    if (!this.isConnected) {
      throw new Error(this.describeDisconnected());
    }
    this.socket!.send(JSON.stringify(message));
  }

  /** Send, then wait for the first inbound message that satisfies `matches`. */
  private request(
    message: Record<string, unknown>,
    matches: (reply: Record<string, unknown>) => boolean,
    what: string
  ): Promise<Record<string, unknown>> {
    return new Promise((resolve, reject) => {
      const waiter: Waiter = {
        matches,
        resolve,
        reject,
        timer: setTimeout(() => {
          this.waiters = this.waiters.filter((w) => w !== waiter);
          // ⚠️ Every request here is answered by a *different process* which may have gone
          // away between the client list being read and the message landing — a preview closed
          // mid-request is the ordinary case. A promise that never settles is
          // indistinguishable from a hang.
          reject(new Error(`The preview did not answer the ${what} request within ${this.options.timeout}ms.`));
        }, this.options.timeout)
      };
      this.waiters.push(waiter);
      try {
        this.send(message);
      } catch (e) {
        clearTimeout(waiter.timer);
        this.waiters = this.waiters.filter((w) => w !== waiter);
        reject(e);
      }
    });
  }

  /**
   * The viewer to address.
   *
   * ⚠️ Deliberately the first browser client. A project with a cloud runtime attached has two,
   * and everything here is about the preview the user is looking at.
   */
  async resolveClientId(): Promise<string> {
    // ⚠️ Before discovery, not after. `discoverClients` swallows request failures, so a
    // disconnected client would otherwise report "no preview is running" — true of a dead app,
    // and exactly the wrong thing to send a user off checking.
    if (!this.isConnected) throw new Error(this.describeDisconnected());
    if (!this.viewerClients.length) await this.discoverClients();
    if (!this.viewerClients.length) {
      throw new Error(
        'No preview is running. Open the project in the editor and start the preview, then try again.'
      );
    }
    return this.viewerClients[0];
  }

  /**
   * Find the running preview by asking the relay who is connected.
   *
   * ⚠️ **Not by asking the app.** A `nodelibrary` announcement only happens when a viewer
   * registers, so a server that attaches after the preview is already up never sees one — and
   * the obvious way to force a fresh one, `cmd: 'refresh'`, makes the viewer reload the page
   * and so clears the very trace buffer the caller connected to read. Discovery must not have
   * side effects on the thing being observed. The relay knows the answer and can be asked
   * without touching the app at all.
   */
  async discoverClients(): Promise<string[]> {
    const reply = await this.request({ cmd: 'clients' }, (m) => m.cmd === 'clients', 'client list').catch(
      () => undefined
    );
    const listed = (reply && (reply.clients as Array<{ clientId: string; type: string }>)) || [];
    for (const entry of listed) {
      if (entry.type === 'viewer' && !this.viewerClients.includes(entry.clientId)) {
        this.viewerClients.push(entry.clientId);
      }
    }
    return this.viewerClients;
  }

  async setTraceEnabled(enabled: boolean): Promise<void> {
    this.send({ cmd: 'traceEnabled', content: JSON.stringify({ enabled }) });
    if (enabled) {
      // The runtime clears its buffer on the off->on transition, so ours must go too, or the
      // walk would be built from a mix of two sessions.
      this.events = [];
      this.highestSeq = 0;
    }
    this.recording = enabled;
  }

  async fetchTopology(): Promise<Topology> {
    const clientId = await this.resolveClientId();
    const reply = await this.request(
      { cmd: 'getTraceDictionary', content: JSON.stringify({ clientId }) },
      (m) => m.cmd === 'traceDictionary',
      'topology'
    );
    const body = typeof reply.content === 'string' ? JSON.parse(reply.content) : reply.content;
    this.topology = body as Topology;
    return this.topology;
  }

  async fetchEvents(): Promise<WireTraceEvent[]> {
    const clientId = await this.resolveClientId();
    await this.request(
      {
        cmd: 'getTraceEvents',
        content: JSON.stringify({ clientId, afterSeq: this.highestSeq || undefined })
      },
      (m) => m.cmd === 'traceEvents',
      'trace events'
    );
    return this.events;
  }

  async fetchPortValues(ports: Array<EdgeRef & { direction: 'input' | 'output' }>): Promise<PortValueResult[]> {
    if (!ports.length) return [];
    const clientId = await this.resolveClientId();
    const reply = await this.request(
      { cmd: 'getPortValues', content: JSON.stringify({ clientId, ports }) },
      (m) => m.cmd === 'portValues',
      'port values'
    );
    const body = typeof reply.content === 'string' ? JSON.parse(reply.content) : reply.content;
    return (body && body.values) || [];
  }

  async injectInput(request: {
    nodeId?: string;
    selector?: string;
    action: 'click' | 'setText';
    value?: string;
    index?: number;
  }): Promise<InputResult> {
    const clientId = await this.resolveClientId();
    const requestId = 'obs-' + Math.random().toString(36).slice(2, 10);
    const reply = await this.request(
      { cmd: 'injectInput', content: JSON.stringify({ clientId, requestId, ...request }) },
      (m) => {
        if (m.cmd !== 'inputResult') return false;
        const body = typeof m.content === 'string' ? JSON.parse(m.content as string) : m.content;
        return !!body && (body as InputResult).requestId === requestId;
      },
      'input'
    );
    const body = typeof reply.content === 'string' ? JSON.parse(reply.content) : reply.content;
    return body as InputResult;
  }
}
