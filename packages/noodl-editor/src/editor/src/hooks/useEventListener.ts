import { useEffect, useRef } from 'react';

/**
 * useEventListener
 *
 * React hook for subscribing to EventDispatcher events.
 *
 * This hook solves the incompatibility between React's closure-based
 * lifecycle and EventDispatcher's context-object-based cleanup pattern.
 *
 * @example
 * ```tsx
 * useEventListener(ProjectModel.instance, 'componentRenamed', (data) => {
 *   console.log('Component renamed:', data);
 *   setUpdateCounter(c => c + 1);
 * });
 * ```
 *
 * @see dev-docs/tasks/phase-2/TASK-008-eventdispatcher-react-investigation/
 */

// 🔥 MODULE LOAD MARKER - If you see this, the new useEventListener code is loaded!
console.log('🔥🔥🔥 useEventListener.ts MODULE LOADED WITH DEBUG LOGS - Version 2.0 🔥🔥🔥');

/**
 * Interface for objects that support EventDispatcher-like subscriptions.
 * This includes EventDispatcher itself and Model subclasses like ProjectModel.
 */
interface IEventEmitter {
  on(event: string | string[], listener: (...args: unknown[]) => void, group: unknown): void;
  off(group: unknown): void;
}

/**
 * Subscribe to an EventDispatcher event with proper React lifecycle handling.
 *
 * Key features:
 * - Prevents stale closures by using useRef for the callback
 * - Creates stable group reference for proper cleanup
 * - Automatically unsubscribes on unmount or when dependencies change
 *
 * @param dispatcher - The EventDispatcher instance to subscribe to
 * @param eventName - Name of the event to listen for (or array of event names)
 * @param callback - Function to call when event is emitted
 * @param deps - Optional dependency array (like useEffect). If provided, re-subscribes when deps change
 */
export function useEventListener<T = unknown>(
  dispatcher: IEventEmitter | null | undefined,
  eventName: string | string[],
  callback: (data?: T, eventName?: string) => void,
  deps?: React.DependencyList
) {
  // Store callback in ref to avoid stale closures
  const callbackRef = useRef(callback);

  // Update ref whenever callback changes
  useEffect(() => {
    callbackRef.current = callback;
  });

  // Set up subscription
  useEffect(
    () => {
      if (!dispatcher) {
        return;
      }

      // Create wrapper that calls the current callback ref
      const wrapper = (data?: T, emittedEventName?: string) => {
        callbackRef.current(data, emittedEventName);
      };

      // Create stable group object for cleanup
      // Using a unique object ensures proper unsubscription
      const group = { id: `useEventListener_${Math.random()}` };

      // Subscribe to event(s)
      dispatcher.on(eventName, wrapper, group);

      // Cleanup: unsubscribe when unmounting or dependencies change
      return () => {
        dispatcher.off(group);
      };
    },
    // CRITICAL: Always spread eventName array into dependencies, never pass array directly
    // React's Object.is() comparison fails with arrays, causing useEffect to never run
    deps
      ? [dispatcher, ...(Array.isArray(eventName) ? eventName : [eventName]), ...deps]
      : [dispatcher, ...(Array.isArray(eventName) ? eventName : [eventName])]
  );
}

/**
 * Subscribe to multiple events from the same dispatcher.
 *
 * This is a convenience wrapper around useEventListener for cases where
 * you need to subscribe to multiple events with the same callback.
 *
 * @example
 * ```tsx
 * useEventListenerMultiple(
 *   ProjectModel.instance,
 *   ['componentAdded', 'componentRemoved', 'componentRenamed'],
 *   () => setUpdateCounter(c => c + 1)
 * );
 * ```
 */
export function useEventListenerMultiple<T = unknown>(
  dispatcher: IEventEmitter | null | undefined,
  eventNames: string[],
  callback: (data?: T, eventName?: string) => void,
  deps?: React.DependencyList
) {
  useEventListener(dispatcher, eventNames, callback, deps);
}
