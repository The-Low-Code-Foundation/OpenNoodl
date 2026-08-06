/**
 * OBS-002 — the editor's half of the trace channel.
 *
 * Owns the dictionary and the event buffer on the editor side, and nothing else: the walk
 * itself is {@link ../provenance/walkEngine}, which this file never calls. That split is the
 * point. The retired Data Lineage panel welded its algorithm to selection events and spent
 * five documented fix attempts on timing races rather than on lineage, so here the stateful,
 * racy, singleton-shaped part is quarantined into one object with a small surface, and the
 * part that has to be *correct* is a pure function with no dependencies.
 *
 * ⚠️ **The editor pulls; the runtime never pushes.** Every read here is a request/response over
 * the relay. Nothing subscribes to a stream, because the shelved panel died of exactly that.
 */

import { NodeLibraryImporter } from '@noodl-models/nodelibrary/NodeLibraryImporter';
import { RuntimeType } from '@noodl-models/nodelibrary/NodeLibraryData';
import { ProjectModel } from '@noodl-models/projectmodel';

import Model from '../../../../shared/model';
import { EventDispatcher } from '../../../../shared/utils/EventDispatcher';
import { ViewerConnection } from '../../ViewerConnection';
import { PortRef, PortValues, Topology, TraceEventLike, valueKey } from './walkEngine';

/** What the runtime answers a `getPortValues` request with. */
interface PortValueResult extends PortRef {
  exists: boolean;
  value: string | undefined;
}

/** How long a pull may go unanswered before the caller is told rather than left hanging. */
const REQUEST_TIMEOUT = 2000;

/**
 * How often a running recording is pulled.
 *
 * Slow enough that a long trace is not re-indexed continuously, fast enough that pressing a
 * button in the preview and looking back at the editor shows what happened rather than what had
 * happened before you pressed it.
 *
 * ⚠️ **The timer belongs to the session, not to a surface.** It lived in `ProvenancePanel` and
 * was gated on a walk being on screen, which made Record → click → Stop a guaranteed empty
 * panel: nothing pulled the runtime's buffer unless a walk happened to be open (FH-011). A
 * sidebar panel is also not merely hidden while closed — `SidePanel` does not *construct* it
 * until it is first opened — so a poll owned by the panel does not run for a user who has never
 * opened it, which is the ordinary case once Record moves to the canvas (TALK-003 / HUD-001).
 */
export const LIVE_POLL_MS = 1500;

/**
 * Replace the runtime's node names with the labels the user actually typed.
 *
 * ⚠️ The dictionary's `name` is the *runtime* node's `name`, which is its **type** — so a walk
 * built straight from it reads `Text.text` and `net.noodl.controls.button.onClick` where the
 * canvas says `RAW: -` and `Add To Cart`. Observed live on the QA fixture. The whole claim of
 * the walk is that it reads in one glance, and a chain of type names identifies nothing when a
 * component contains four Texts and three Counters.
 *
 * The runtime cannot fix this at source — it has never been told the editor's labels — so the
 * merge belongs here, on the way in, where the project is available. The engine stays pure and
 * still needs no project access, which is what keeps it usable from OBS-004.
 */
function withEditorLabels(dictionary: Topology): Topology {
  const project = ProjectModel.instance;
  if (!project) return dictionary;

  const nodes: Topology['nodes'] = {};
  for (const id of Object.keys(dictionary.nodes)) {
    const entry = dictionary.nodes[id];
    let label: string | undefined;
    try {
      label = project.findNodeWithId(id)?.label;
    } catch (e) {
      /* a node the editor no longer has is still worth showing under its runtime name */
    }
    nodes[id] = label ? { ...entry, name: label } : entry;
  }
  return { nodes, edges: dictionary.edges };
}

export class TraceSession extends Model {
  public static instance: TraceSession = new TraceSession();

  /** Ids to names, types, components, and the topology. Empty until a viewer answers. */
  public topology: Topology = { nodes: {}, edges: [] };
  /** ⚠️ Not `events`: `Model` already declares one, with an unrelated meaning. */
  public traceEvents: TraceEventLike[] = [];
  public portValues: PortValues = {};

  /** Whether the runtime has been asked to record. Not whether anything has been recorded. */
  public recording = false;
  /**
   * Whether the events this session holds came from a recording — armed or finished.
   *
   * ⚠️ **Not the same question as {@link recording}, and not `traceEvents.length > 0` either.**
   * It is what `walkEngine`'s `hasTrace` wants: the difference between a silent edge that
   * *never fired during a recording* (✕, the answer the panel exists to give) and one nobody
   * ever watched (·). Reading `recording` for it meant pressing **Stop** turned every ✕ in the
   * walk back into `unknown` — the recording was taken, and the moment you finished taking it
   * the panel forgot it had one. Reading the event count instead loses the case the feature is
   * *for*: a recording in which nothing fired at all.
   */
  public hasTrace = false;
  public hasTopology = false;

  /**
   * Peers holding the runtime's trace, **excluding this editor** — HUD-004.
   *
   * The trace is one switch with two peers, and until it grew owners the second one to arm wiped
   * the first one's buffer. Surfaced rather than merely fixed because "it stopped by itself" is a
   * whole class of report that a sentence prevents: a HUD that says `also traced by an agent` is
   * telling the truth about a session it does not control.
   *
   * ⚠️ Names, not credentials. See `ViewerConnection.clientId`.
   */
  public otherOwners: string[] = [];
  /**
   * Whether this recording *joined* a trace somebody else had already started.
   *
   * Not derivable from {@link otherOwners}: an agent that arms halfway through is a different
   * fact from a recording that began inside one, and only the second one means the buffer this
   * session is reading has history in it that the user did not record.
   */
  public joinedExistingTrace = false;

  private lastSeq = 0;
  /**
   * True between arming and the runtime answering where its buffer had got to.
   *
   * ⚠️ **Pulls are held off while it is set, and that is load-bearing.** `start()` used to set
   * `lastSeq = 0` because arming always cleared the runtime's buffer. Under HUD-004 it no longer
   * does, so a first pull issued before the runtime has said `highestSeq` would return the *other
   * owner's* history and this session would present it as what the user had just recorded.
   * Cleared by the `TraceState` reply, or by a deadline so a runtime too old to answer behaves
   * exactly as it did before.
   */
  private armSyncing = false;
  private armSyncTimer: ReturnType<typeof setTimeout> | undefined;
  private listening = false;
  private pollTimer: ReturnType<typeof setInterval> | undefined;
  private pollInFlight = false;
  /**
   * Bumped on every arm. A pull is allowed to outlive the recording that issued it (2s
   * deadline), so the disarm at the end of {@link stop} has to check that a *new* recording did
   * not start in the meantime — otherwise stopping the previous one turns the new one off.
   */
  private armGeneration = 0;

  private constructor() {
    super();
  }

  /**
   * The viewer to address.
   *
   * ⚠️ Browser runtime only, and deliberately: a project with a cloud runtime attached has two
   * clients, and the walk is about the preview the user is looking at. Returns `undefined`
   * rather than throwing so callers can render "no preview running" instead of an error.
   */
  private get clientId(): string | undefined {
    const clients = NodeLibraryImporter.instance.clientsWithRuntime(RuntimeType.Browser);
    return clients.length ? clients[0] : undefined;
  }

  public get isPreviewRunning(): boolean {
    return this.clientId !== undefined;
  }

  private listen() {
    if (this.listening) return;
    this.listening = true;

    // ⚠️ **POL-010 slice 2b — the graph belongs to a project, and this object outlives them.**
    // `hasTopology` was set `true` once and never back, and `topology` was only ever replaced
    // by a newly arrived dictionary, so opening a second project left the first one's graph in
    // place *claiming to be current*. Observed live: the panel reported 12 nodes of `/erg-rig`
    // while the editor showed a chat project, and every walk it served was about a graph that
    // was no longer on screen. A stale answer delivered confidently is worse than no answer,
    // and this surface exists to not do that.
    //
    // Registered here rather than in the constructor so every subscription this object makes
    // is in one place, and because nothing can be stale before the first `listen()`: the
    // dictionary arrives on the very listener below.
    EventDispatcher.instance.on('ProjectModel.instanceHasChanged', () => this.forget(), this);

    EventDispatcher.instance.on(
      'TraceDictionary',
      ({ dictionary }) => {
        this.topology = withEditorLabels(dictionary);
        this.hasTopology = true;
        this.notifyListeners('topologyChanged');
      },
      this
    );

    // FH-011 slice 3 — a reloaded preview comes back untraced.
    //
    // The runtime's `traceEnabled` lives on the `NodeContext`, and a reload builds a new one
    // starting at `false` (`nodecontext.ts:191`). Nothing was re-sent on registration, so any
    // reload mid-recording — a full export, a resolved warning, the user hitting reload —
    // left the button saying "Stop" over a runtime that had stopped tracing, silently and for
    // the rest of the session. Same pattern as `sendDebugInspectorsEnabled`, which is
    // re-sent on registration for exactly this reason.
    //
    // Safe to send unconditionally: `setTraceEnabled` early-returns when the flag already
    // matches, so a viewer that *is* already tracing does not have its buffer replaced.
    EventDispatcher.instance.on(
      'ViewerRegistered',
      () => {
        if (!this.recording) return;
        ViewerConnection.instance?.sendTraceEnabled(true);
      },
      this
    );

    EventDispatcher.instance.on(
      'TraceEvents',
      ({ events }) => {
        if (!Array.isArray(events)) return;

        // ⚠️ **An empty pull is an answer, and it has to be delivered as one.** Every read here
        // waits on `eventsChanged`, which only fires when the buffer actually grew — so a
        // recording in which nothing has happened yet answered every pull by *timing out*
        // after 2s, indistinguishable from a preview that has gone away. The runtime always
        // replies (`nodecontext.ts:270-273` sends whatever `getTraceEvents` returns, empty
        // included); this is where that reply stops being silent.
        this.notifyListeners('eventsPulled');
        if (events.length === 0) return;

        // ⚠️ **Not every batch that arrives here was asked for by this panel.** The relay
        // broadcasts viewer traffic to *every* editor peer, and OBS-004 adds a second one:
        // an MCP server pulling the buffer for an agent. Its reply lands here too, and the
        // reply to a first pull is the whole buffer — so concatenating blindly would double
        // every event the panel already had, and with it every `fired N×` count. The
        // aggregation exists precisely so one row can say "fired 100×" instead of showing
        // 100 rows; silently doubling it is the failure mode that surface cannot afford.
        //
        // `seq` is monotonic across a session and does not reset when the ring wraps, so it is
        // a sound identity *within* a session. Filtering rather than de-duplicating a merged
        // list keeps this O(batch).
        //
        // ⚠️ It is **not** monotonic across a preview reload: a reloaded page builds a fresh
        // `TraceBuffer` numbering from 1 again. A filter that only ever moves `lastSeq`
        // forward would then discard every event of the new session — silently, and for as
        // long as the panel stayed open. A whole batch numbered *below* what we hold can only
        // mean the runtime restarted its numbering; a mere re-delivery of what we already have
        // tops out at `lastSeq`, never under it.
        const highest = events[events.length - 1].seq;
        if (highest < this.lastSeq) {
          this.traceEvents = events.slice();
          this.lastSeq = highest;
          this.notifyBufferReset();
          this.notifyListeners('eventsChanged');
          return;
        }

        const fresh = events.filter((event: TraceEventLike) => event.seq > this.lastSeq);
        if (fresh.length === 0) return;

        this.traceEvents = this.traceEvents.concat(fresh);
        this.lastSeq = fresh[fresh.length - 1].seq;
        this.notifyListeners('eventsChanged');
      },
      this
    );

    // HUD-004 — the runtime saying who holds its trace.
    //
    // Arrives twice for two different reasons: once at the moment of arming, where it decides
    // where this recording starts reading from, and then on every poll, where it keeps the
    // header honest about an agent that joined or left after the fact.
    EventDispatcher.instance.on(
      'TraceState',
      ({ state }) => {
        if (!state || typeof state !== 'object') return;
        const owners: string[] = Array.isArray(state.owners) ? state.owners : [];
        const mine = ViewerConnection.instance?.clientId;
        const others = owners.filter((owner) => owner !== mine);

        if (this.armSyncing) {
          this.clearArmSync();
          // The pre-arm state: `enabled` means somebody else was already tracing, and
          // `highestSeq` is everything they had captured before this recording existed. Reading
          // from there is what keeps their history out of it.
          this.joinedExistingTrace = !!state.enabled;
          this.lastSeq = typeof state.highestSeq === 'number' ? state.highestSeq : 0;
        }

        const changed = others.length !== this.otherOwners.length || others.some((o, i) => o !== this.otherOwners[i]);
        this.otherOwners = others;
        if (changed) this.notifyListeners('ownersChanged');
      },
      this
    );

    EventDispatcher.instance.on(
      'TracePortValues',
      ({ values }) => {
        if (!Array.isArray(values)) return;
        for (const entry of values as PortValueResult[]) {
          // An absent port is left out of the map entirely rather than stored as undefined,
          // so a walk row can tell "the runtime says this port is gone" from "not asked yet".
          if (!entry.exists) continue;
          this.portValues[valueKey(entry, entry.direction)] = entry.value ?? 'undefined';
        }
        this.notifyListeners('portValuesChanged');
      },
      this
    );
  }

  /**
   * Start recording. Returns whether anything was armed.
   *
   * The dictionary arrives unprompted on the off→on transition; {@link refreshTopology} covers
   * the case where the trace was already on when this session attached.
   *
   * ⚠️ **Refuses to arm with no preview running.** `ViewerConnection.send()` no-ops on a closed
   * socket, so arming used to flip the button to "Stop" over nothing at all — a recorder that
   * says it is recording and cannot be, which is the one thing a debugging surface may not do.
   * The caller gets `false` and says so.
   */
  public start(): boolean {
    this.listen();
    const clientId = this.clientId;
    if (!clientId) return false;

    this.traceEvents = [];
    this.lastSeq = 0;
    this.recording = true;
    this.hasTrace = true;
    this.joinedExistingTrace = false;
    this.armGeneration++;
    this.notifyBufferReset();

    // ⚠️ **Order is the whole of HUD-004 slice 4.** Both messages ride one socket and the
    // runtime handles them in order, so asking *first* gets the state the trace was in before
    // this editor touched it — which is the only version of it worth having.
    this.beginArmSync();
    ViewerConnection.instance?.sendGetTraceState(clientId);
    ViewerConnection.instance?.sendTraceEnabled(true);

    this.startPolling();
    this.notifyListeners('recordingChanged');
    return true;
  }

  /**
   * Hold the first pull until the runtime says where its buffer had got to.
   *
   * The deadline is not padding. A viewer bundle older than this change never answers
   * `getTraceState` at all, and a recording that waited forever for it would capture nothing
   * while displaying a live counter — strictly worse than the behaviour it replaced.
   */
  private beginArmSync() {
    this.clearArmSync();
    this.armSyncing = true;
    this.armSyncTimer = setTimeout(() => {
      this.armSyncing = false;
      this.armSyncTimer = undefined;
    }, REQUEST_TIMEOUT);
  }

  private clearArmSync() {
    this.armSyncing = false;
    if (this.armSyncTimer) clearTimeout(this.armSyncTimer);
    this.armSyncTimer = undefined;
  }

  /**
   * Stop recording, keeping what was recorded.
   *
   * ⚠️ **The pull has to happen before the disarm, and it is the whole point of this method.**
   * `setTraceEnabled(false)` does not merely stop writing — it drops the runtime's buffer
   * outright (`nodecontext.ts:691-695`) — so a stop that disarms first is a stop that throws
   * the recording away. Record → click the app → Stop showed an empty panel *every time*, and
   * no later Refresh could recover it (FH-011).
   *
   * `recording` flips first, before the pull, so the button stops saying "Stop" the moment it
   * is pressed rather than up to 2s later. The promise is returned for tests and for the
   * surfaces that want to know when the last events have landed; the UI ignores it.
   */
  public async stop(): Promise<void> {
    if (!this.recording) return;

    const armed = this.armGeneration;
    this.recording = false;
    this.stopPolling();
    // The pull below has to be allowed to happen; nothing is waiting on the arm any more.
    this.clearArmSync();
    this.notifyListeners('recordingChanged');

    await this.refreshEvents();

    // A new recording started while that pull was in flight; disarming now would turn it off.
    if (this.armGeneration !== armed) return;
    // ⚠️ This releases *this editor's* ownership and nothing else (HUD-004). If an agent is
    // still holding the trace, the runtime keeps capturing and keeps its buffer — which is the
    // point: the reverse of this used to destroy the agent's recording, and the agent's used to
    // destroy this one.
    ViewerConnection.instance?.sendTraceEnabled(false);
  }

  /**
   * Pull the buffer on a timer for as long as a recording is armed.
   *
   * Still a **pull**, deliberately — the runtime is not made to push, which is the constraint
   * that keeps this out of the failure mode the shelved Data Lineage panel died of. Each tick
   * asks for events after the last `seq` it holds, so a long recording is a stream of deltas.
   */
  private startPolling() {
    if (this.pollTimer) return;
    this.pollTimer = setInterval(() => {
      // A tick can outlive its interval: every pull has a 2s deadline, and a preview that has
      // gone away takes all of it. Overlapping pulls would queue requests faster than they
      // resolve.
      if (this.pollInFlight) return;
      this.pollInFlight = true;
      // HUD-004: piggybacked on the pull rather than given a timer of its own. This is what
      // makes "the agent has gone" arrive on the header instead of being true and invisible —
      // and an agent joining or leaving is not something the runtime ever announces.
      const clientId = this.clientId;
      if (clientId) ViewerConnection.instance?.sendGetTraceState(clientId);
      void this.refreshEvents().finally(() => {
        this.pollInFlight = false;
      });
    }, LIVE_POLL_MS);
  }

  private stopPolling() {
    if (!this.pollTimer) return;
    clearInterval(this.pollTimer);
    this.pollTimer = undefined;
  }

  /**
   * Ask for the topology without touching the buffer.
   *
   * Layer 1 needs only this — no recording, nothing fired — which is what lets the walk answer
   * "why is this label X?" on a cold editor.
   */
  public refreshTopology(): Promise<Topology> {
    this.listen();
    const clientId = this.clientId;
    if (!clientId) return Promise.resolve(this.topology);

    return new Promise((resolve) => {
      this.awaitEvent('topologyChanged', () => resolve(this.topology), () => resolve(this.topology));
      ViewerConnection.instance.sendGetTraceDictionary(clientId);
    });
  }

  /**
   * Pull whatever has been recorded since the last pull.
   *
   * ⚠️ `listen()` here as well as in its siblings. This was the one pull that did not subscribe
   * first, and it is the one the Refresh button calls before anything else: on a session where
   * nothing had yet asked for a topology, the reply landed on no listener at all and the pull
   * timed out with the events sitting unread in the message.
   *
   * Waits on `eventsPulled`, not on `eventsChanged` — see the listener. A recording that has
   * captured nothing yet is answered, not timed out.
   */
  public refreshEvents(): Promise<TraceEventLike[]> {
    this.listen();
    const clientId = this.clientId;
    if (!clientId) return Promise.resolve(this.traceEvents);
    // ⚠️ The arm has not been told where to start reading yet. Pulling now would ask for
    // everything from `seq 0` and hand this session another owner's recording (HUD-004).
    if (this.armSyncing) return Promise.resolve(this.traceEvents);

    return new Promise((resolve) => {
      this.awaitEvent('eventsPulled', () => resolve(this.traceEvents), () => resolve(this.traceEvents));
      ViewerConnection.instance?.sendGetTraceEvents(clientId, this.lastSeq || undefined);
    });
  }

  /**
   * Resolve current values for a batch of ports.
   *
   * Batched because a walk annotates every hop at once; one request per row would be ten round
   * trips over a socket that already coalesces sends on a 200ms timer.
   */
  public resolvePortValues(ports: PortRef[]): Promise<PortValues> {
    this.listen();
    const clientId = this.clientId;
    if (!clientId || ports.length === 0) return Promise.resolve(this.portValues);

    return new Promise((resolve) => {
      this.awaitEvent('portValuesChanged', () => resolve(this.portValues), () => resolve(this.portValues));
      ViewerConnection.instance.sendGetPortValues(clientId, ports);
    });
  }

  /**
   * Drop everything the editor holds.
   *
   * Note this does not clear the runtime's buffer — `start()` does that, because the runtime
   * clears on trace-start by design. Reloading the preview clears both.
   */
  public clear() {
    this.traceEvents = [];
    this.portValues = {};
    this.lastSeq = 0;
    // Still a trace if one is running: an emptied buffer under a live recording is "nothing has
    // fired since", which is a ✕, not an "unknown".
    this.hasTrace = this.recording;
    this.notifyBufferReset();
    this.notifyListeners('eventsChanged');
  }

  /**
   * HUD-003 — every event this session held has been replaced, so anything holding one is stale.
   *
   * ⚠️ **A held `TraceEvent` is not safe across this, and a held `seq` is worse.** `seq` restarts
   * at 1 when a preview reloads, so a forward walk focused on "root 7" does not merely go blank
   * after a reload — it silently re-points at whatever the *new* session numbered 7 and renders
   * it under the old label, which is a confident wrong answer of exactly the kind this surface
   * exists not to give.
   *
   * Announced rather than acted on, because the things that hold roots are surfaces: the panel's
   * `focusedRoot`, and the request module's unclaimed stash. Neither is reachable from here
   * without importing a view, and the session is the only thing that knows.
   */
  private notifyBufferReset() {
    this.notifyListeners('bufferReset');
  }

  /**
   * Forget the graph as well as the trace — the project this session was about has gone.
   *
   * Stronger than {@link clear}, which keeps the topology deliberately: clearing the buffer is
   * something a user asks for mid-session, and the graph is still the graph. Here it is not.
   *
   * `recording` is reset too, and that is not tidiness. `hasTrace` is derived from it, and it
   * decides whether a silent edge reads as `never fired` or as `unknown` — so a session left
   * "recording" against a viewer that has gone away would stamp confident ✕ glyphs on a graph
   * nothing was ever asked to trace.
   *
   * ⚠️ **The disarm is sent, contrary to what this comment used to say.** "The client this flag
   * was about is the one that just went" is true of a project *closed*, and false of a project
   * *switched*: the preview outlives the switch, keeps its `traceEnabled = true`, and goes on
   * filling a 250k-event ring for a recording no surface is watching and no gesture can stop —
   * the editor's own `recording` flag, the only thing that could have turned it off, was just
   * cleared. Broadcast, so it reaches whichever viewer is still there.
   */
  private forget() {
    if (this.recording) ViewerConnection.instance?.sendTraceEnabled(false);
    this.stopPolling();
    this.clearArmSync();
    this.otherOwners = [];
    this.joinedExistingTrace = false;
    this.topology = { nodes: {}, edges: [] };
    this.hasTopology = false;
    this.traceEvents = [];
    this.portValues = {};
    this.lastSeq = 0;
    this.recording = false;
    this.hasTrace = false;
    this.notifyBufferReset();
    this.notifyListeners('topologyChanged');
    this.notifyListeners('eventsChanged');
    this.notifyListeners('recordingChanged');
  }

  /**
   * One-shot listener with a deadline.
   *
   * ⚠️ Not named `once`: `Model` already has one, with a different signature and no timeout.
   *
   * ⚠️ The timeout is not defensive padding. Every pull here is answered by a *different
   * process*, which may have gone away between the client list being read and the message
   * landing — a preview closed mid-walk is the ordinary case, not the exotic one. Without this
   * the panel would sit on a promise that never settles and render a spinner forever, which is
   * indistinguishable from a hang.
   */
  private awaitEvent(event: string, resolve: () => void, onTimeout: () => void) {
    const group = {};
    const timer = setTimeout(() => {
      this.off(group);
      onTimeout();
    }, REQUEST_TIMEOUT);

    this.on(
      event,
      () => {
        clearTimeout(timer);
        this.off(group);
        resolve();
      },
      group
    );
  }
}
