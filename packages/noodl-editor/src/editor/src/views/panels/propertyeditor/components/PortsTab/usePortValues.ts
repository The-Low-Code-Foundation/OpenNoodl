/**
 * The Ports tab's live-value channel — the pulling half of {@link portValues}.
 *
 * ## The editor pulls; the runtime never pushes
 *
 * A deliberate design decision recorded on `ViewerConnection`, and streaming
 * events at the renderer is what killed the shelved Trigger Chain Debugger.
 * So this polls, on a timer, only while the tab is on screen and only while a
 * preview is actually running.
 *
 * ## Layer 1 only — nothing is armed and nothing needs tearing down
 *
 * `getPortValues` reads the ports themselves, so it needs no trace, clears no
 * buffer and cannot disturb a recording somebody else is taking. That is the
 * whole reason this does not go through `TraceSession`: it borrows only that
 * session's client pick (which viewer is *the preview*, sandboxes excluded) and
 * keeps its own state, so a node switch cannot leave a previous node's values
 * on screen and the Provenance panel's map is neither read nor grown.
 *
 * ⚠️ **A reply is only ours if it says so.** The relay broadcasts every viewer
 * reply to every editor peer, so an unfiltered listener here would show the
 * component bench's sandbox values on the app preview's rows. Unlike
 * `TraceSession`, an *unstamped* reply is refused: a viewer bundle old enough
 * not to stamp its replies is also old enough not to answer `getPortValues` at
 * all, so accepting one buys nothing and risks the wrong runtime.
 *
 * ⚠️ **Pacing.** `setInterval` in an occluded renderer is clamped hard, so an
 * editor nobody is looking at pulls rarely. That is the right behaviour, and a
 * driver must not read the absence of a pull as a broken channel.
 *
 * @module noodl-editor/views/panels/propertyeditor/components/PortsTab/usePortValues
 */

import { useEffect, useMemo, useRef, useState } from 'react';

import { TraceSession } from '@noodl-utils/provenance/TraceSession';

import { EventDispatcher } from '../../../../../../../shared/utils/EventDispatcher';
import { ViewerConnection } from '../../../../../ViewerConnection';
import {
  EMPTY_PORT_VALUES,
  foldPortValues,
  portValuesStatus,
  samePortValues,
  type PortValueMap,
  type PortValueRef,
  type PortValueReply,
  type PortValuesStatus,
  type PortValueState
} from './portValues';

/**
 * How often the values are re-read while the tab is on screen.
 *
 * Slower than the component bench's 700ms tail on purpose: the bench is a
 * read-out somebody is watching fire, this is a reference panel that happens to
 * be current. The socket coalesces sends on a 200ms timer either way.
 */
export const PORT_VALUE_POLL_MS = 1000;

export interface LivePortValues {
  values: PortValueMap;
  /** What the panel may honestly say about why the rows look the way they do. */
  status: PortValuesStatus;
}

/**
 * Current values for `refs`, refreshed while mounted.
 *
 * `refs` is compared by content, not by identity: it is rebuilt on every render
 * of the tab, and a dependency on the array itself would re-subscribe (and
 * re-request) on every keystroke elsewhere in the panel.
 */
export function usePortValues(refs: PortValueRef[], nodeId: string | undefined): LivePortValues {
  const [state, setState] = useState<PortValueState>(EMPTY_PORT_VALUES);
  const [isPreviewRunning, setIsPreviewRunning] = useState(false);
  /** Whether a reply about *this* node has come back yet — see `portValuesStatus`. */
  const [hasAnswered, setHasAnswered] = useState(false);

  const refsKey = useMemo(() => refs.map((r) => r.direction + ':' + r.port).join(','), [refs]);
  const refsRef = useRef(refs);
  refsRef.current = refs;

  useEffect(() => {
    // A different node shares nothing with the previous one. Clear before
    // anything can arrive, so a reply in flight for the old node cannot land on
    // the new one's rows — `foldPortValues` filters on the id, but the state it
    // is folding into must not be the old node's either.
    setState(EMPTY_PORT_VALUES);
    setHasAnswered(false);

    if (!nodeId || refsRef.current.length === 0) {
      setIsPreviewRunning(TraceSession.instance.isPreviewRunning);
      return undefined;
    }

    const eventGroup = {};

    EventDispatcher.instance.on(
      'TracePortValues',
      ({ clientId, values }: TSFixme) => {
        // ⚠️ Unstamped is refused — see the module note.
        if (typeof clientId !== 'string' || clientId !== TraceSession.instance.previewClientId) return;
        if (!Array.isArray(values)) return;
        const folded = foldPortValues(values as PortValueReply[], nodeId);
        setHasAnswered(true);
        // A poll answers every second whether or not anything moved.
        setState((previous) => (samePortValues(previous, folded) ? previous : folded));
      },
      eventGroup
    );

    const pull = () => {
      const clientId = TraceSession.instance.previewClientId;
      setIsPreviewRunning(clientId !== undefined);
      if (!clientId) {
        // The preview closed. Its last values describe a runtime that is gone,
        // and a stale value presented as current is the one thing a read-out
        // may not do.
        setState(EMPTY_PORT_VALUES);
        setHasAnswered(false);
        return;
      }
      ViewerConnection.instance?.sendGetPortValues(clientId, refsRef.current);
    };

    pull();
    const timer = setInterval(pull, PORT_VALUE_POLL_MS);

    return () => {
      clearInterval(timer);
      EventDispatcher.instance.off(eventGroup);
    };
    // ⚠️ `refs` itself is not a dependency — see `refsKey`.
  }, [nodeId, refsKey]);

  return {
    values: state.values,
    status: portValuesStatus({ isPreviewRunning, hasAnswered, nodeIsLive: state.nodeIsLive })
  };
}
