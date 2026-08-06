/**
 * HUD-001 — Record, on the canvas.
 *
 * TALK-003's product split: **the Provenance panel asks questions about wiring; the HUD watches
 * the app run.** Arming a recorder used to live inside a question-answering panel, which is why
 * it felt vestigial — and it had a mechanical cost too: `SidePanel` does not *construct* a
 * panel until it is first opened, so the recorder's only surface did not exist at all for a
 * user who had never opened that one.
 *
 * ONE control with two states, not two surfaces. A permanent pill plus a separate recording bar
 * would be two controls for one switch, and "is it on?" is exactly the state the user is trying
 * to read.
 *
 * ⚠️ **This component computes nothing.** The recording lives in `TraceSession` — FH-011 moved
 * the poll there, and it is the same singleton the Provenance panel reads — and every sentence
 * drawn here comes from `utils/provenance/recordingHud`. Anything that looks like analysis in
 * this file is a bug.
 */

import { useEventListener } from '@noodl-hooks/useEventListener';
import React, { useEffect, useState } from 'react';

import { EventDispatcher } from '../../../../../shared/utils/EventDispatcher';
import { TraceSession } from '../../../utils/provenance/TraceSession';
import { canvasNote, headerSummary } from '../../../utils/provenance/recordingHud';
import type { NodeBounds } from '../ExecutionOverlay';
import styles from './RecordingOverlay.module.scss';

export interface RecordingOverlayProps {
  /**
   * Current canvas viewport.
   *
   * Unused by the control itself, which is fixed-position — it is here because HUD-002 hangs
   * canvas-space badges off this same overlay, and the prop has to be live by the time it does.
   * The render/update pair in `OverlayViews` already keeps it current on pan and zoom.
   */
  viewport: {
    x: number;
    y: number;
    zoom: number;
  };

  /** A node's canvas-space bounds, or `null` when it is not in the open graph. HUD-002 uses it. */
  getNodeBounds: (nodeId: string) => NodeBounds | null;

  /**
   * False on read-only canvases (diff and review documents).
   *
   * Those render a second and third `NodeGraphEditor` over historical graphs; a Record button
   * on one of them would arm the live preview from a canvas showing last week's code.
   */
  enabled: boolean;
}

export function RecordingOverlay({ enabled }: RecordingOverlayProps) {
  const session = TraceSession.instance;

  const [recording, setRecording] = useState(session.recording);
  /**
   * Bumped on `eventsChanged`.
   *
   * A counter rather than the array itself: the session mutates its buffer in place — React
   * would not see a new reference — and copying a 250k-event buffer per render is exactly the
   * cost the whole trace design exists to avoid. Same trick, same reason, as the panel's.
   */
  const [, setRevision] = useState(0);
  /** Why the last press did nothing. Cleared when a preview shows up. */
  const [refusal, setRefusal] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (!enabled) return;

    const group = {};
    session.on('recordingChanged', () => setRecording(session.recording), group);
    session.on('eventsChanged', () => setRevision((r) => r + 1), group);

    return () => {
      session.off(group);
    };
  }, [session, enabled]);

  // A preview arriving is the one thing that can turn a refused Record into a working one, and
  // the user who just read "no preview is running" is the user who then started one.
  useEventListener(EventDispatcher.instance, 'ViewerRegistered', () => setRefusal(undefined));

  const eventCount = session.traceEvents.length;
  const note = refusal ?? canvasNote({ recording, eventCount });

  const handleRecord = () => {
    // ⚠️ `start()` answers whether anything was actually armed. `ViewerConnection.send()`
    // no-ops on a closed socket, so without this the pill would flip to "recording", capture
    // nothing, and leave the user blaming their graph — the one thing a debugging surface may
    // not do.
    if (session.start()) {
      setRefusal(undefined);
    } else {
      setRefusal('No preview is running — open the app, then press Record.');
    }
  };

  const handleStop = () => {
    // Not awaited: `stop()` pulls the buffer before it disarms the runtime (FH-011) and that
    // round trip takes up to 2s, but `recording` flips synchronously inside it, so the control
    // returns to the idle pill the moment it is pressed rather than two seconds later.
    void session.stop();
  };

  if (!enabled) return null;

  return (
    <div className={styles.Overlay}>
      <div className={styles.Control} data-recording={String(recording)} data-test="recording-hud">
        <span className={styles.Dot} aria-hidden="true" />
        {recording ? (
          <>
            <span className={styles.Label}>recording</span>
            <span className={styles.Separator}>·</span>
            <span className={styles.Count} data-test="recording-hud-count">
              {headerSummary(eventCount)}
            </span>
            <button className={styles.Stop} onClick={handleStop} data-test="recording-hud-stop">
              Stop
            </button>
          </>
        ) : (
          <button className={styles.Record} onClick={handleRecord} data-test="recording-hud-record">
            Record
          </button>
        )}
      </div>

      {note && (
        <div className={styles.Note} data-test="recording-hud-note">
          {note}
        </div>
      )}
    </div>
  );
}
