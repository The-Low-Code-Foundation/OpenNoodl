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
  public hasTopology = false;

  private lastSeq = 0;
  private listening = false;

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

    EventDispatcher.instance.on(
      'TraceDictionary',
      ({ dictionary }) => {
        this.topology = withEditorLabels(dictionary);
        this.hasTopology = true;
        this.notifyListeners('topologyChanged');
      },
      this
    );

    EventDispatcher.instance.on(
      'TraceEvents',
      ({ events }) => {
        if (!Array.isArray(events) || events.length === 0) return;

        // ⚠️ **Not every batch that arrives here was asked for by this panel.** The relay
        // broadcasts viewer traffic to *every* editor peer, and OBS-004 adds a second one:
        // an MCP server pulling the buffer for an agent. Its reply lands here too, and the
        // reply to a first pull is the whole buffer — so concatenating blindly would double
        // every event the panel already had, and with it every `fired N×` count. The
        // aggregation exists precisely so one row can say "fired 100×" instead of showing
        // 100 rows; silently doubling it is the failure mode that surface cannot afford.
        //
        // `seq` is monotonic across the whole session and never resets when the ring wraps,
        // so it is a sound identity. Filtering rather than de-duplicating a merged list keeps
        // this O(batch).
        const fresh = events.filter((event: TraceEventLike) => event.seq > this.lastSeq);
        if (fresh.length === 0) return;

        this.traceEvents = this.traceEvents.concat(fresh);
        this.lastSeq = fresh[fresh.length - 1].seq;
        this.notifyListeners('eventsChanged');
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
   * Start recording.
   *
   * The dictionary arrives unprompted on the off→on transition; {@link refreshTopology} covers
   * the case where the trace was already on when this session attached.
   */
  public start() {
    this.listen();
    this.traceEvents = [];
    this.lastSeq = 0;
    this.recording = true;
    ViewerConnection.instance.sendTraceEnabled(true);
    this.notifyListeners('recordingChanged');
  }

  public stop() {
    this.recording = false;
    ViewerConnection.instance.sendTraceEnabled(false);
    this.notifyListeners('recordingChanged');
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

  /** Pull whatever has been recorded since the last pull. */
  public refreshEvents(): Promise<TraceEventLike[]> {
    const clientId = this.clientId;
    if (!clientId) return Promise.resolve(this.traceEvents);

    return new Promise((resolve) => {
      this.awaitEvent('eventsChanged', () => resolve(this.traceEvents), () => resolve(this.traceEvents));
      ViewerConnection.instance.sendGetTraceEvents(clientId, this.lastSeq || undefined);
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
    this.notifyListeners('eventsChanged');
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
