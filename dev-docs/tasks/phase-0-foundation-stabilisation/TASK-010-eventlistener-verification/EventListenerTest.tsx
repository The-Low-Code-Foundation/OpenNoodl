/**
 * EventListenerTest.tsx
 *
 * TEMPORARY TEST COMPONENT - Remove after verification complete
 *
 * This component tests that the useEventListener hook correctly receives
 * events from EventDispatcher-based models like ProjectModel.
 *
 * Usage:
 * 1. Import and add to visible location in app
 * 2. Click "Trigger Test Event" - should show event in log
 * 3. Rename a component - should show real event in log
 * 4. Remove this component after verification
 *
 * Created for: TASK-010 (EventListener Verification)
 * Part of: Phase 0 - Foundation Stabilization
 */

// IMPORTANT: Update these imports to match your actual paths
import { useEventListener } from '@noodl-hooks/useEventListener';
import React, { useState, useCallback } from 'react';

import { ProjectModel } from '@noodl-models/projectmodel';

interface EventLogEntry {
  id: number;
  timestamp: string;
  eventName: string;
  data: string;
  source: 'manual' | 'real';
}

export function EventListenerTest() {
  const [eventLog, setEventLog] = useState<EventLogEntry[]>([]);
  const [counter, setCounter] = useState(0);
  const [isMinimized, setIsMinimized] = useState(false);

  // Generate unique ID for log entries
  const nextId = useCallback(() => Date.now() + Math.random(), []);

  // Add entry to log
  const addLogEntry = useCallback(
    (eventName: string, data: unknown, source: 'manual' | 'real') => {
      const entry: EventLogEntry = {
        id: nextId(),
        timestamp: new Date().toLocaleTimeString(),
        eventName,
        data: JSON.stringify(data, null, 2),
        source
      };
      setEventLog((prev) => [entry, ...prev].slice(0, 20)); // Keep last 20
      setCounter((c) => c + 1);
    },
    [nextId]
  );

  // ============================================
  // TEST 1: Single event subscription
  // ============================================
  useEventListener(ProjectModel.instance, 'componentRenamed', (data) => {
    console.log('🎯 TEST [componentRenamed]: Event received!', data);
    addLogEntry('componentRenamed', data, 'real');
  });

  // ============================================
  // TEST 2: Multiple events subscription
  // ============================================
  useEventListener(ProjectModel.instance, ['componentAdded', 'componentRemoved'], (data, eventName) => {
    console.log(`🎯 TEST [${eventName}]: Event received!`, data);
    addLogEntry(eventName || 'unknown', data, 'real');
  });

  // ============================================
  // TEST 3: Root node changes
  // ============================================
  useEventListener(ProjectModel.instance, 'rootNodeChanged', (data) => {
    console.log('🎯 TEST [rootNodeChanged]: Event received!', data);
    addLogEntry('rootNodeChanged', data, 'real');
  });

  // Manual trigger for testing
  const triggerTestEvent = () => {
    console.log('🧪 Manually triggering componentRenamed event...');

    if (!ProjectModel.instance) {
      console.error('❌ ProjectModel.instance is null/undefined!');
      addLogEntry('ERROR', { message: 'ProjectModel.instance is null' }, 'manual');
      return;
    }

    const testData = {
      test: true,
      timestamp: new Date().toISOString(),
      random: Math.random().toString(36).substr(2, 9)
    };

    // @ts-ignore - notifyListeners might not be in types
    ProjectModel.instance.notifyListeners?.('componentRenamed', testData);

    console.log('🧪 Event triggered with data:', testData);
    addLogEntry('componentRenamed (manual)', testData, 'manual');
  };

  // Check ProjectModel status
  const checkStatus = () => {
    console.log('📊 ProjectModel Status:');
    console.log('  - instance:', ProjectModel.instance);
    console.log('  - instance type:', typeof ProjectModel.instance);
    console.log('  - has notifyListeners:', typeof (ProjectModel.instance as any)?.notifyListeners);

    addLogEntry(
      'STATUS_CHECK',
      {
        hasInstance: !!ProjectModel.instance,
        instanceType: typeof ProjectModel.instance
      },
      'manual'
    );
  };

  if (isMinimized) {
    return (
      <div
        onClick={() => setIsMinimized(false)}
        style={{
          position: 'fixed',
          top: 10,
          right: 10,
          background: '#1a1a2e',
          border: '2px solid #00ff88',
          borderRadius: 8,
          padding: '8px 16px',
          zIndex: 99999,
          cursor: 'pointer',
          fontFamily: 'monospace',
          fontSize: 12,
          color: '#00ff88'
        }}
      >
        🧪 Events: {counter} (click to expand)
      </div>
    );
  }

  return (
    <div
      style={{
        position: 'fixed',
        top: 10,
        right: 10,
        background: '#1a1a2e',
        border: '2px solid #00ff88',
        borderRadius: 8,
        padding: 16,
        zIndex: 99999,
        width: 350,
        maxHeight: '80vh',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        fontFamily: 'monospace',
        fontSize: 12,
        color: '#fff',
        boxShadow: '0 4px 20px rgba(0, 255, 136, 0.3)'
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 12,
          paddingBottom: 8,
          borderBottom: '1px solid #333'
        }}
      >
        <h3 style={{ margin: 0, color: '#00ff88' }}>🧪 EventListener Test</h3>
        <button
          onClick={() => setIsMinimized(true)}
          style={{
            background: 'transparent',
            border: '1px solid #666',
            color: '#999',
            padding: '4px 8px',
            borderRadius: 4,
            cursor: 'pointer',
            fontSize: 10
          }}
        >
          minimize
        </button>
      </div>

      {/* Counter */}
      <div
        style={{
          marginBottom: 12,
          padding: 8,
          background: '#0a0a15',
          borderRadius: 4,
          display: 'flex',
          justifyContent: 'space-between'
        }}
      >
        <span>Events received:</span>
        <strong style={{ color: '#00ff88' }}>{counter}</strong>
      </div>

      {/* Buttons */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <button
          onClick={triggerTestEvent}
          style={{
            flex: 1,
            background: '#00ff88',
            color: '#000',
            border: 'none',
            padding: '8px 12px',
            borderRadius: 4,
            cursor: 'pointer',
            fontWeight: 'bold',
            fontSize: 11
          }}
        >
          🧪 Trigger Test Event
        </button>
        <button
          onClick={checkStatus}
          style={{
            background: '#333',
            color: '#fff',
            border: 'none',
            padding: '8px 12px',
            borderRadius: 4,
            cursor: 'pointer',
            fontSize: 11
          }}
        >
          📊 Status
        </button>
        <button
          onClick={() => setEventLog([])}
          style={{
            background: '#333',
            color: '#fff',
            border: 'none',
            padding: '8px 12px',
            borderRadius: 4,
            cursor: 'pointer',
            fontSize: 11
          }}
        >
          🗑️
        </button>
      </div>

      {/* Instructions */}
      <div
        style={{
          marginBottom: 12,
          padding: 8,
          background: '#1a1a0a',
          borderRadius: 4,
          border: '1px solid #444400',
          fontSize: 10,
          color: '#999'
        }}
      >
        <strong style={{ color: '#ffff00' }}>Test steps:</strong>
        <ol style={{ margin: '4px 0 0 0', paddingLeft: 16 }}>
          <li>Click "Trigger Test Event" - should log below</li>
          <li>Rename a component in the tree - should log</li>
          <li>Add/remove components - should log</li>
        </ol>
      </div>

      {/* Event Log */}
      <div
        style={{
          flex: 1,
          background: '#0a0a15',
          padding: 8,
          borderRadius: 4,
          overflow: 'auto',
          minHeight: 100
        }}
      >
        {eventLog.length === 0 ? (
          <div style={{ color: '#666', fontStyle: 'italic', textAlign: 'center', padding: 20 }}>
            No events yet...
            <br />
            Click "Trigger Test Event" or
            <br />
            rename a component to test
          </div>
        ) : (
          eventLog.map((entry) => (
            <div
              key={entry.id}
              style={{
                borderBottom: '1px solid #222',
                paddingBottom: 8,
                marginBottom: 8
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  marginBottom: 4
                }}
              >
                <span
                  style={{
                    color: entry.source === 'manual' ? '#ffaa00' : '#00ff88',
                    fontWeight: 'bold'
                  }}
                >
                  {entry.eventName}
                </span>
                <span style={{ color: '#666', fontSize: 10 }}>{entry.timestamp}</span>
              </div>
              <pre
                style={{
                  margin: 0,
                  fontSize: 10,
                  color: '#888',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-all'
                }}
              >
                {entry.data}
              </pre>
            </div>
          ))
        )}
      </div>

      {/* Footer */}
      <div
        style={{
          marginTop: 8,
          paddingTop: 8,
          borderTop: '1px solid #333',
          fontSize: 10,
          color: '#666',
          textAlign: 'center'
        }}
      >
        TASK-010 | Phase 0 Foundation | Remove after verification ✓
      </div>
    </div>
  );
}

export default EventListenerTest;
