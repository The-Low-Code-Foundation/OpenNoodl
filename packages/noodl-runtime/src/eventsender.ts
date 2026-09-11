'use strict';

/** A listener. `this` is the `ref` it was registered with, or `null` when there is none. */
type Listener = (this: unknown, data?: any) => unknown;

/**
 * The runtime's own event emitter, used by the graph and node models.
 *
 * It differs from a plain emitter in two ways that matter. Listeners may be registered
 * against a `ref` — normally the object that owns them — so they can all be dropped in one
 * call when that object goes away, which is how nodes detach from their models without
 * tracking individual callbacks. And `emit` is asynchronous and *sequential*: it awaits
 * each listener before calling the next, so handlers that return promises are ordered.
 */
interface EventSender {
  listeners: Record<string, Listener[]>;
  listenersWithRefs: Record<string, Map<unknown, Listener[]>>;

  on(eventName: string, callback: Listener, ref?: unknown): void;
  removeListenersWithRef(ref: unknown): void;
  removeAllListeners(eventName?: string): void;
  emit(eventName: string, data?: unknown): Promise<void>;
}

interface EventSenderConstructor {
  new (): EventSender;
  prototype: EventSender;
}

const EventSender = function EventSender(this: EventSender) {
  this.listeners = {};
  this.listenersWithRefs = {};
} as unknown as EventSenderConstructor;

EventSender.prototype.on = function (eventName, callback, ref) {
  if (ref) {
    if (!this.listenersWithRefs.hasOwnProperty(eventName)) {
      this.listenersWithRefs[eventName] = new Map();
    }

    if (!this.listenersWithRefs[eventName].get(ref)) {
      this.listenersWithRefs[eventName].set(ref, []);
    }

    this.listenersWithRefs[eventName].get(ref)!.push(callback);
  } else {
    if (!this.listeners.hasOwnProperty(eventName)) {
      this.listeners[eventName] = [];
    }

    this.listeners[eventName].push(callback);
  }
};

EventSender.prototype.removeListenersWithRef = function (ref) {
  Object.keys(this.listenersWithRefs).forEach((eventName) => {
    const listeners = this.listenersWithRefs[eventName];
    if (listeners.has(ref)) {
      listeners.delete(ref);
    }
  });
};

EventSender.prototype.removeAllListeners = function (eventName) {
  if (eventName) {
    delete this.listeners[eventName];
    delete this.listenersWithRefs[eventName];
  } else {
    this.listeners = {};
    this.listenersWithRefs = {};
  }
};

EventSender.prototype.emit = async function (eventName, data) {
  const array = this.listeners[eventName];

  if (array) {
    for (let i = 0; i < array.length; i++) {
      const callback = array[i];
      await Promise.resolve(callback.call(null, data));
    }
  }

  const map = this.listenersWithRefs[eventName];

  if (map) {
    for (const [ref, callbacks] of map) {
      for (const callback of callbacks) {
        await Promise.resolve(callback.call(ref, data));
      }
    }
  }
};

export = EventSender;
