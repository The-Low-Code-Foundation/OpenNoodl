/**
 * BEN-003 — the outputs channel, as a hook.
 *
 * Owns the one thing the read-out cannot be written without: a trace armed on
 * **this bench's client and no other**, pulled as a tail, and torn down when
 * the bench goes away.
 *
 * ## The editor pulls; the runtime never pushes
 *
 * That is a deliberate design decision recorded on `ViewerConnection`, and
 * streaming events at the renderer is what killed the shelved Trigger Chain
 * Debugger. There is no push channel here and there must not be one.
 *
 * ## What arming is careful about
 *
 * - **`getTraceState` before arming**, per BEN-003 §1, so the read-out starts
 *   from `highestSeq` rather than replaying a buffer that was already running.
 * - **The arm carries a `target`**, so it reaches the bench's sandbox client
 *   alone. Measured before it was built: a broadcast armed the app preview too
 *   (register B17). TALK-003's *"an agent's `start_trace` destroys a human's
 *   recording"* is avoided by not reaching the human's runtime at all.
 * - **Re-armed when the client registers.** The bench mounts before its webview
 *   has connected, and a message aimed at a client the relay has never heard of
 *   is dropped in silence — the same shape `TraceSession` hit in FH-011 when a
 *   reloaded preview came back untraced.
 *
 * ⚠️ **A reply is only ours if it says so.** Until BEN-003 no reply on this
 * channel carried a `clientId` at all (register B15); with two traced clients
 * the app preview's buffer and the bench's were indistinguishable. The runtime
 * now stamps it and this filters on it — an unstamped reply is *not* accepted
 * here, unlike in `TraceSession`, because a bench that shows another runtime's
 * events is worse than one that shows none.
 *
 * ⚠️ **Pacing.** `setInterval` in an occluded renderer is clamped hard (B10),
 * so a bench nobody is looking at pulls rarely. That is the right behaviour and
 * not a bug — but it means a *driver* must not read the absence of a pull as a
 * broken channel. Interactions pull immediately in addition, which is both
 * better to use and what makes the common case observable.
 *
 * @module noodl-editor/views/VisualCanvas/useBenchOutputs
 */

import { useCallback, useEffect, useRef, useState } from 'react';

import type { BenchPort } from '@noodl-models/AiAssistant/authoring';

import { EventDispatcher } from '../../../../shared/utils/EventDispatcher';
import { ViewerConnection } from '../../ViewerConnection';
import {
  appendSignals,
  applyValueEmissions,
  benchEmissions,
  benchOutputNodeIds,
  benchOutputPortRefs,
  seedValues,
  type BenchEmission,
  type BenchValueState
} from './benchOutputs';

/** How often the tail is pulled while the bench is on screen. */
const PULL_INTERVAL_MS = 700;

export interface BenchOutputs {
  /** Current value per declared value output. */
  values: Record<string, BenchValueState>;
  /** Signal emissions, oldest first, capped. */
  log: BenchEmission[];
  /** The runtime clock of the first emission seen — the origin every row is relative to. */
  origin: number;
  /** Whether the trace is armed on this client. False means the read-out cannot see anything. */
  armed: boolean;
  /** Drop the log. Values are state and are not cleared — there is nothing to go back to. */
  clearLog: () => void;
  /** Pull the tail now. Called after an interaction, so "I clicked" reads instantly. */
  pullNow: () => void;
}

export function useBenchOutputs({
  clientId,
  target,
  outputs
}: {
  clientId: string;
  target: string;
  outputs: BenchPort[] | undefined;
}): BenchOutputs {
  const [values, setValues] = useState<Record<string, BenchValueState>>({});
  const [log, setLog] = useState<BenchEmission[]>([]);
  const [armed, setArmed] = useState(false);
  const [origin, setOrigin] = useState(0);

  /**
   * Everything the listeners read is a ref, because they are registered once
   * per client and would otherwise close over the first render's values —
   * `lastSeq` above all, where a stale copy re-delivers the whole buffer on
   * every pull and doubles the log.
   */
  const outputNodeIds = useRef<string[]>([]);
  const lastSeq = useRef(0);
  const originRef = useRef(0);
  const outputsRef = useRef(outputs);
  outputsRef.current = outputs;
  /** Mirrors `armed` for the listeners, which are registered once per client. */
  const armedRef = useRef(false);

  const pullNow = useCallback(() => {
    ViewerConnection.instance?.sendGetTraceEvents(clientId, lastSeq.current || undefined);
  }, [clientId]);

  const clearLog = useCallback(() => setLog([]), []);

  useEffect(() => {
    // A different client (or a different component) shares nothing with the
    // previous one: its seq numbering restarts and its ports are not the same
    // ports. Reset before anything can arrive.
    outputNodeIds.current = [];
    lastSeq.current = 0;
    originRef.current = 0;
    setValues({});
    setLog([]);
    setArmed(false);
    setOrigin(0);

    const connection = ViewerConnection.instance;
    if (!connection) return undefined;

    const eventGroup = {};
    /** ⚠️ An unstamped reply is refused — see the module note. */
    const isOurs = (id: unknown) => id === clientId;

    const arm = () => {
      // Ask what state the trace is in *before* touching it, so a buffer that
      // was already running is read from its end rather than replayed.
      connection.sendGetTraceState(clientId);
    };

    EventDispatcher.instance.on(
      'TraceState',
      ({ clientId: from, state }: TSFixme) => {
        if (!isOurs(from) || !state) return;
        if (!armedRef.current) {
          lastSeq.current = typeof state.highestSeq === 'number' ? state.highestSeq : 0;
          armedRef.current = true;
          setArmed(true);
          connection.sendTraceEnabled(true, clientId);
          connection.sendGetTraceDictionary(clientId);
          const refs = benchOutputPortRefs(outputsRef.current);
          if (refs.length) connection.sendGetPortValues(clientId, refs);
        }
      },
      eventGroup
    );

    EventDispatcher.instance.on(
      'TraceDictionary',
      ({ clientId: from, dictionary }: TSFixme) => {
        if (!isOurs(from)) return;
        outputNodeIds.current = benchOutputNodeIds(dictionary, target);
      },
      eventGroup
    );

    EventDispatcher.instance.on(
      'TracePortValues',
      ({ clientId: from, values: replied }: TSFixme) => {
        if (!isOurs(from)) return;
        // The seed only fills rows nothing has reported yet: a real emission
        // arriving first is newer than a snapshot taken at arming time.
        const seeded = seedValues(replied);
        setValues((previous) => {
          const next = { ...previous };
          for (const name of Object.keys(seeded)) {
            if (!(name in next)) next[name] = seeded[name];
          }
          return next;
        });
      },
      eventGroup
    );

    EventDispatcher.instance.on(
      'TraceEvents',
      ({ clientId: from, events }: TSFixme) => {
        if (!isOurs(from) || !Array.isArray(events) || events.length === 0) return;

        const highest = events[events.length - 1].seq;
        // A batch numbered below what we hold can only mean the runtime
        // restarted its numbering — a reload. Anything we had describes a graph
        // that no longer exists.
        if (highest < lastSeq.current) {
          lastSeq.current = highest;
          originRef.current = 0;
          setValues({});
          setLog([]);
          setOrigin(0);
        } else {
          const fresh = events.filter((event: TSFixme) => event.seq > lastSeq.current);
          if (fresh.length === 0) return;
          lastSeq.current = fresh[fresh.length - 1].seq;
        }

        const emissions = benchEmissions(events, outputNodeIds.current);
        if (emissions.length === 0) return;

        if (originRef.current === 0) {
          originRef.current = emissions[0].t;
          setOrigin(emissions[0].t);
        }
        setValues((previous) => applyValueEmissions(previous, emissions));
        setLog((previous) => appendSignals(previous, emissions));
      },
      eventGroup
    );

    // The webview may not have registered yet; a message aimed at a client the
    // relay has never seen is dropped without a word.
    EventDispatcher.instance.on(
      'ViewerRegistered',
      ({ clientId: from }: TSFixme) => {
        if (!isOurs(from)) return;
        armedRef.current = false;
        arm();
      },
      eventGroup
    );

    arm();
    const timer = setInterval(pullNow, PULL_INTERVAL_MS);

    return () => {
      clearInterval(timer);
      EventDispatcher.instance.off(eventGroup);
      // Targeted, so it can only ever release this bench's own runtime. A
      // human's recording of the app preview is on a different client and is
      // not reachable from here.
      if (armedRef.current) connection.sendTraceEnabled(false, clientId);
      armedRef.current = false;
    };
    // ⚠️ `outputs` is deliberately NOT a dependency: it is read through a ref
    // at arming time, and re-arming because a port was added mid-session would
    // disarm, clear the log, and throw away the emissions someone was reading.
  }, [clientId, target, pullNow]);

  return { values, log, origin, armed, clearLog, pullNow };
}
