/**
 * HUD-001 / HUD-002 — Record, on the canvas, with the graph lighting up under it.
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
 * the poll there, and it is the same singleton the Provenance panel reads — and every badge and
 * every sentence drawn here is a pure function of it in `utils/provenance/recordingHud`.
 * Anything that looks like analysis in this file is a bug.
 */

import { useEventListener } from '@noodl-hooks/useEventListener';
import React, { useEffect, useState } from 'react';

import { EventDispatcher } from '../../../../../shared/utils/EventDispatcher';
import { TraceSession } from '../../../utils/provenance/TraceSession';
import {
  BADGE_FADE_MS,
  BadgeState,
  EMPTY_BADGE_STATE,
  EMPTY_OFF_CANVAS,
  badgeOpacity,
  canvasNote,
  foldEvents,
  headerSummary,
  offCanvas,
  visibleBadges
} from '../../../utils/provenance/recordingHud';
import type { NodeBounds } from '../ExecutionOverlay';
import { RecordingNodeBadge } from './RecordingNodeBadge';
import styles from './RecordingOverlay.module.scss';

/**
 * How often the overlay re-renders purely to age its badges.
 *
 * Only while at least one badge is on screen: the interval clears itself when the last one
 * fades, so an idle canvas — and a recording nobody is interacting with — costs one
 * subscription and no timers at all. The poll that keeps the *recording* alive belongs to
 * `TraceSession`, not to this.
 */
const FADE_TICK_MS = 250;

export interface RecordingOverlayProps {
  /** Current canvas viewport — applied as a CSS transform to the badge container. */
  viewport: {
    x: number;
    y: number;
    zoom: number;
  };

  /** A node's canvas-space bounds, or `null` when it is not in the open graph. */
  getNodeBounds: (nodeId: string) => NodeBounds | null;

  /**
   * False on read-only canvases (diff and review documents).
   *
   * Those render a second and third `NodeGraphEditor` over historical graphs; a Record button
   * on one of them would arm the live preview from a canvas showing last week's code.
   */
  enabled: boolean;
}

export function RecordingOverlay({ viewport, getNodeBounds, enabled }: RecordingOverlayProps) {
  const session = TraceSession.instance;

  const [recording, setRecording] = useState(session.recording);
  const [badges, setBadges] = useState<BadgeState>(EMPTY_BADGE_STATE);
  /** Only the setter is wanted: the render this causes is the whole point (see the fade below). */
  const [, setTick] = useState(0);
  /** Why the last press did nothing. Cleared when a preview shows up. */
  const [refusal, setRefusal] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (!enabled) return;

    const group = {};
    session.on(
      'recordingChanged',
      () => {
        setRecording(session.recording);
        // Both directions clear the badges: arming empties the runtime's buffer, and stopping
        // ends the "this just happened" claim a badge is making. The events themselves survive
        // both — they are what the Provenance panel's walk reads afterwards.
        setBadges(EMPTY_BADGE_STATE);
      },
      group
    );
    session.on('eventsChanged', () => setBadges((prev) => foldEvents(prev, session.traceEvents, Date.now())), group);

    return () => {
      session.off(group);
    };
  }, [session, enabled]);

  // A preview arriving is the one thing that can turn a refused Record into a working one, and
  // the user who just read "no preview is running" is the user who then started one.
  useEventListener(EventDispatcher.instance, 'ViewerRegistered', () => setRefusal(undefined));

  // ⚠️ Recomputed in render rather than memoised, deliberately: the open graph changes
  // underneath this component on every navigation, and badge ages change with the wall clock,
  // so a cached answer would be a confidently stale one. This is the same call the execution
  // overlay's comment describes as free by design — with more force here, because a recording
  // re-renders on every poll *and* every pan.
  const visible = recording ? visibleBadges(badges, Date.now()) : [];
  const animating = visible.length > 0;

  useEffect(() => {
    if (!animating) return;
    const timer = setInterval(() => setTick((t) => t + 1), FADE_TICK_MS);
    return () => clearInterval(timer);
    // Not keyed on the tick: the interval outlives its own ticks and stops only once the last
    // badge has faded, which is what makes a quiet canvas free again.
  }, [animating]);

  // `getNodeBounds` walks the graph per call (`HitTester.findNodeWithId`), and this render asks
  // about every node the recording has touched — once for the off-canvas summary and once per
  // badge. One cache per render pass, thrown away with it, so each node is resolved once.
  const resolved = new Map<string, NodeBounds | null>();
  const boundsOf = (nodeId: string): NodeBounds | null => {
    if (!resolved.has(nodeId)) resolved.set(nodeId, getNodeBounds(nodeId));
    return resolved.get(nodeId) ?? null;
  };

  const off = recording
    ? offCanvas(
        badges,
        (nodeId) => boundsOf(nodeId) !== null,
        (nodeId) => session.topology.nodes[nodeId]?.component || undefined
      )
    : EMPTY_OFF_CANVAS;

  const eventCount = session.traceEvents.length;
  const onCanvasBadges = visible.filter((badge) => boundsOf(badge.nodeId) !== null).length;
  const note = refusal ?? canvasNote({ recording, eventCount, onCanvasBadges, off });

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

  const containerTransform = `scale(${viewport.zoom}) translate(${viewport.x}px, ${viewport.y}px)`;

  return (
    <div className={styles.Overlay}>
      <div className={styles.Control} data-recording={String(recording)} data-test="recording-hud">
        <span className={styles.Dot} aria-hidden="true" />
        {recording ? (
          <>
            <span className={styles.Label}>recording</span>
            <span className={styles.Separator}>·</span>
            <span className={styles.Count} data-test="recording-hud-count">
              {headerSummary(eventCount, off)}
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

      {recording && (
        <div className={styles.TransformContainer} style={{ transform: containerTransform, transformOrigin: '0 0' }}>
          {visible.map((badge) => {
            const bounds = boundsOf(badge.nodeId);
            // Off canvas, or deleted since it fired. Both are counted in `off` and answered by
            // the note above; neither gets a badge nowhere.
            if (!bounds) return null;
            return (
              <RecordingNodeBadge
                key={badge.nodeId}
                nodeId={badge.nodeId}
                count={badge.count}
                opacity={badgeOpacity(badge.age, BADGE_FADE_MS)}
                bounds={bounds}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
