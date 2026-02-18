/**
 * UBA-007: DebugStreamView
 *
 * SSE-based live debug log viewer for UBA backends.
 * Connects to the backend's debug_stream endpoint via UBAClient.openDebugStream()
 * and renders a scrollable, auto-scrolling event log.
 *
 * Features:
 * - Connect / Disconnect toggle button
 * - Auto-scroll to bottom on new events (can be overridden by manual scroll)
 * - Max 500 events in memory (oldest are dropped)
 * - Clear button to reset the log
 * - Per-event type colour coding (log/info/warn/error)
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';

import type { AuthConfig } from '@noodl-models/UBA/types';

import { UBAClient, type DebugEvent, type DebugStreamHandle } from '../../../services/UBA/UBAClient';
import css from './UBAPanel.module.scss';

const MAX_EVENTS = 500;

export interface DebugStreamViewProps {
  endpoint: string;
  auth?: AuthConfig;
  credentials?: { token?: string; username?: string; password?: string };
}

type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

function eventTypeClass(type: string): string {
  switch (type) {
    case 'error':
      return css.eventError;
    case 'warn':
      return css.eventWarn;
    case 'info':
      return css.eventInfo;
    case 'metric':
      return css.eventMetric;
    default:
      return css.eventLog;
  }
}

function formatEventData(data: unknown): string {
  if (typeof data === 'string') return data;
  try {
    return JSON.stringify(data, null, 2);
  } catch {
    return String(data);
  }
}

export function DebugStreamView({ endpoint, auth, credentials }: DebugStreamViewProps) {
  const [events, setEvents] = useState<DebugEvent[]>([]);
  const [status, setStatus] = useState<ConnectionStatus>('disconnected');
  const [statusMsg, setStatusMsg] = useState<string>('');
  const [autoScroll, setAutoScroll] = useState(true);

  const handleRef = useRef<DebugStreamHandle | null>(null);
  const logRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new events arrive
  useEffect(() => {
    if (autoScroll && logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [events, autoScroll]);

  const connect = useCallback(() => {
    if (handleRef.current) return; // already connected

    setStatus('connecting');
    setStatusMsg('');

    handleRef.current = UBAClient.openDebugStream(
      endpoint,
      {
        onOpen: () => {
          setStatus('connected');
          setStatusMsg('');
        },
        onEvent: (event) => {
          setEvents((prev) => {
            const next = [...prev, event];
            return next.length > MAX_EVENTS ? next.slice(next.length - MAX_EVENTS) : next;
          });
        },
        onError: (err) => {
          setStatus('error');
          setStatusMsg(err.message);
          handleRef.current = null;
        }
      },
      auth,
      credentials
    );
  }, [endpoint, auth, credentials]);

  const disconnect = useCallback(() => {
    handleRef.current?.close();
    handleRef.current = null;
    setStatus('disconnected');
    setStatusMsg('');
  }, []);

  // Clean up on unmount or endpoint change
  useEffect(() => {
    return () => {
      handleRef.current?.close();
      handleRef.current = null;
    };
  }, [endpoint]);

  const handleScrollLog = useCallback(() => {
    const el = logRef.current;
    if (!el) return;
    // If user scrolled up more than 40px from bottom, disable auto-scroll
    const distFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    setAutoScroll(distFromBottom < 40);
  }, []);

  const isConnected = status === 'connected';

  return (
    <div className={css.debugStream}>
      {/* Toolbar */}
      <div className={css.debugToolbar}>
        <span className={`${css.statusDot} ${css[`statusDot_${status}`]}`} aria-hidden="true" />
        <span className={css.statusLabel}>
          {status === 'connecting'
            ? 'Connecting…'
            : status === 'connected'
            ? 'Live'
            : status === 'error'
            ? 'Error'
            : 'Disconnected'}
        </span>
        {statusMsg && <span className={css.statusDetail}>{statusMsg}</span>}

        <div className={css.debugToolbarSpacer} />

        <button type="button" className={css.clearBtn} onClick={() => setEvents([])} disabled={events.length === 0}>
          Clear
        </button>

        <button
          type="button"
          className={isConnected ? css.disconnectBtn : css.connectBtn}
          onClick={isConnected ? disconnect : connect}
          disabled={status === 'connecting'}
        >
          {isConnected ? 'Disconnect' : 'Connect'}
        </button>
      </div>

      {/* Event log */}
      <div ref={logRef} className={css.debugLog} onScroll={handleScrollLog}>
        {events.length === 0 ? (
          <div className={css.debugEmpty}>
            {isConnected ? 'Waiting for events…' : 'Connect to start receiving events.'}
          </div>
        ) : (
          events.map((event, i) => (
            <div
              // eslint-disable-next-line react/no-array-index-key
              key={i}
              className={`${css.debugEvent} ${eventTypeClass(event.type)}`}
            >
              <span className={css.debugEventTime}>
                {event.receivedAt.toLocaleTimeString(undefined, { hour12: false })}
              </span>
              <span className={css.debugEventType}>{event.type.toUpperCase()}</span>
              <pre className={css.debugEventData}>{formatEventData(event.data)}</pre>
            </div>
          ))
        )}
      </div>

      {/* Auto-scroll indicator */}
      {!autoScroll && (
        <button
          type="button"
          className={css.scrollToBottomBtn}
          onClick={() => {
            setAutoScroll(true);
            if (logRef.current) {
              logRef.current.scrollTop = logRef.current.scrollHeight;
            }
          }}
        >
          Jump to latest
        </button>
      )}
    </div>
  );
}
