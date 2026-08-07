'use strict';

/**
 * The runtime error channel — see `dev-docs/reference/FAILURE-CONTRACT.md`.
 *
 * The contract's rule is that *a node that goes wrong says so at runtime, through a channel
 * that exists in every runtime, in a structured form, observable from the graph*. Before this
 * file the only channel was `context.editorConnection.sendWarning`, which exists solely in the
 * editor: every diagnosis an author leaned on while building vanished the moment the app
 * shipped.
 *
 * So the bus lives here, in `noodl-runtime`, with no editor dependency at all. The editor's
 * warning path becomes one *subscriber* among others rather than the channel itself, which is
 * what keeps existing editor behaviour identical while giving the deployed app, the cloud
 * runtime, SSR and exported code the same events.
 */

import type { RuntimeErrorEventLike, RuntimeErrorSubscriptionLike } from '@noodl/types';

/**
 * One raised failure, structured.
 *
 * Provenance (`nodeId`, `componentName`, `nodeType`) is filled in by `Node.raiseRuntimeError`
 * rather than by the caller, so a call site stays one line and cannot misattribute itself.
 * `code` is the matchable half of the pair — stable, kebab-case, namespaced by node type — and
 * `message` is the half that may be reworded freely.
 *
 * Aliased to the published type rather than restated, so the two cannot drift: node
 * definitions and the `On App Error` node both read this shape.
 */
export type RuntimeErrorEvent = RuntimeErrorEventLike;

export type RuntimeErrorSubscriber = (event: RuntimeErrorEvent) => void;

/** Handed back by `subscribe`, so a caller never needs to keep the function to remove it. */
export type RuntimeErrorSubscription = RuntimeErrorSubscriptionLike;

/**
 * How deep a raise-inside-a-subscriber chain is allowed to go before events are dropped.
 *
 * A subscriber that itself fails — an `On App Error` node whose downstream graph raises, say —
 * would otherwise recurse until the stack gives out, turning one node's failure into a dead
 * app. Two levels is enough for "the error handler had a problem" to be reported once.
 */
const MAX_DELIVERY_DEPTH = 2;

/**
 * Plain synchronous pub/sub. Deliberately not an `EventEmitter`: this has exactly one event
 * type, must never be `async` (a failure has to be observable in the same update pass that
 * produced it), and must survive a throwing subscriber.
 */
export class RuntimeErrorBus {
  private _subscribers: RuntimeErrorSubscriber[] = [];
  private _depth = 0;

  subscribe(subscriber: RuntimeErrorSubscriber): RuntimeErrorSubscription {
    this._subscribers.push(subscriber);
    return {
      unsubscribe: () => {
        this.unsubscribe(subscriber);
      }
    };
  }

  unsubscribe(subscriber: RuntimeErrorSubscriber): void {
    const index = this._subscribers.indexOf(subscriber);
    if (index !== -1) this._subscribers.splice(index, 1);
  }

  /** Whether anything is listening. Lets a caller skip building an expensive `detail`. */
  get hasSubscribers(): boolean {
    return this._subscribers.length > 0;
  }

  raise(event: RuntimeErrorEvent): void {
    if (this._subscribers.length === 0) return;

    if (this._depth >= MAX_DELIVERY_DEPTH) {
      // Past this point a subscriber is failing in response to a failure. Report it on the
      // one channel that cannot recurse and stop, rather than growing the stack.
      console.error('[noodl] runtime error raised while delivering another; dropped', event);
      return;
    }

    // Clone: a subscriber is allowed to unsubscribe itself (or another) during delivery, and
    // splicing the live array mid-loop would silently skip its neighbour.
    const subscribers = this._subscribers.slice();
    this._depth++;
    try {
      for (let i = 0; i < subscribers.length; i++) {
        try {
          subscribers[i](event);
        } catch (e) {
          // One bad subscriber must not stop the rest — that is the failure mode this whole
          // contract exists to remove, and it would be embarrassing to reintroduce it here.
          console.error('[noodl] a runtime-error subscriber threw', e);
        }
      }
    } finally {
      this._depth--;
    }
  }
}

/**
 * The bus for failures that happen where no node is in scope.
 *
 * `Collection`'s notification loop is the case that forced this: listeners are registered
 * through the patched `Array.prototype.on`, whose signature carries no reference back to the
 * node that registered them, so a throwing listener cannot be attributed the way
 * `Node.raiseRuntimeError` attributes everything else. Threading a node ref through that
 * public, prototype-patched API is a change well beyond this contract, so such failures are
 * reported with `'<runtime>'` provenance instead of being reported not at all.
 *
 * Last context wins. That is exact in every real deployment — one `NodeContext` per JS realm,
 * and the editor's preview is its own realm with its own copy of this module. Where it is not
 * exact (several SSR renders in one process) the events are identical in content and land in
 * the same console, so the ambiguity costs nothing.
 */
let ambientBus: RuntimeErrorBus | undefined;

export function setAmbientErrorBus(bus: RuntimeErrorBus): void {
  ambientBus = bus;
}

/**
 * Raise a failure that has no node to attribute it to.
 *
 * Falls back to `console.error` when no `NodeContext` has been built yet, or when one exists
 * with nothing subscribed. "Never fully silent" is the property this channel is for, and it
 * should hold by construction rather than by whether the app got far enough to have a
 * context — `Array.prototype` is patched at import time, so a collection can genuinely
 * notify before any context exists.
 */
export function raiseUnattributedRuntimeError(code: string, message: string, detail?: unknown): void {
  const event: RuntimeErrorEvent = {
    nodeId: '<runtime>',
    componentName: '<runtime>',
    nodeType: '<runtime>',
    code,
    message,
    detail
  };

  if (ambientBus && ambientBus.hasSubscribers) {
    ambientBus.raise(event);
    return;
  }

  console.error('[noodl] ' + message + ' [' + code + ']', event);
}

/**
 * The default subscriber for every context without an editor attached — deployed browser
 * apps, cloud runtime, SSR/SSG and exported code.
 *
 * One structured line, so a failure is never *fully* silent even in an app where nobody wired
 * a `Failure` output or dropped in an `On App Error` node.
 */
export function createConsoleErrorSubscriber(): RuntimeErrorSubscriber {
  return function consoleErrorSubscriber(event: RuntimeErrorEvent) {
    console.error(
      '[noodl] ' + event.nodeType + ' (' + event.componentName + '): ' + event.message + ' [' + event.code + ']',
      event
    );
  };
}

/**
 * The editor subscriber: forwards to `editorConnection.sendWarning`, so the editor shows
 * exactly what it showed before this channel existed.
 *
 * The warning key is the raised `code`, which is per-node-type and stable — two different
 * failures on one node therefore occupy two warning slots rather than overwriting each other,
 * and a repeat of the same failure replaces its own.
 */
export function createEditorWarningSubscriber(editorConnection: {
  sendWarning(componentName: string, nodeId: string, key: string, warning: unknown): void;
}): RuntimeErrorSubscriber {
  return function editorWarningSubscriber(event: RuntimeErrorEvent) {
    editorConnection.sendWarning(event.componentName, event.nodeId, event.code, {
      showGlobally: true,
      message: event.message
    });
  };
}
