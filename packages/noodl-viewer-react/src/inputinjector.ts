/**
 * OBS-004 — driving the running app from outside it.
 *
 * The difference between *"I can read your trace"* and *"I'll click Add To Cart and watch
 * what happens."* Richard's own framing of the open-ended debugging case was "let me fire a
 * couple of buttons and see why" — that is **agency**, and it is what separates an agent from
 * a chat box. A read-only assistant in the editor is the worst of both: LLM cost, no ability
 * to act.
 *
 * ## Why nodes, not pixels
 *
 * The OBS-004 spec sketched `webContents.sendInputEvent` or CDP `Input.dispatchMouseEvent`,
 * both of which address the app by **screen coordinate**. That is the wrong address for this
 * consumer. Everything else in tier 1 speaks in node ids — the walk's rows are node ids, the
 * session dictionary is keyed by node id, the warnings carry node ids — so an agent that has
 * just been told "`Add To Cart.Click` never fired" can name the node but has no idea where it
 * is on screen. Making it find out (screenshot, vision, guess a coordinate, hope nothing
 * scrolled) is a lot of machinery to arrive back where it started.
 *
 * Addressing by node id also removes a whole class of flake: no layout dependence, no
 * scroll position, no device pixel ratio, no window focus.
 *
 * It costs one thing, and the cost is recorded rather than hidden: this dispatches **DOM
 * events, not OS input**. `event.isTrusted` is false. Handlers that gate on `isTrusted`, and
 * browser behaviours that only untrusted events cannot trigger (opening a file picker, exiting
 * fullscreen), will not fire. Noodl's own nodes do not check `isTrusted`, so for the product's
 * own components this is invisible; for a third-party React component embedded in a project it
 * may not be. CDP remains the escape hatch for that case and is unaffected by this file.
 *
 * ## Why it lives here and not in the main process
 *
 * The preview is a `<webview>` inside the editor's renderer, so `webContents.sendInputEvent`
 * from main would first have to find the right `webContents` among all of them and match it
 * by URL. That is a second channel, a second failure mode, and it still could not resolve a
 * node id — only this process knows the node-to-element mapping.
 *
 * @module noodl-viewer-react/inputinjector
 */

import type { ReactNodeInstance } from './react-component-node';

/** The slice of `NoodlRuntime` this reaches for. Mirrors `highlighter.ts`. */
interface InjectorRuntime {
  rootComponent?: {
    nodeScope: {
      getNodesWithIdRecursive(nodeId: string): ReactNodeInstance[];
    };
  };
}

export type InputAction = 'click' | 'setText';

export interface InputRequest {
  requestId?: string;
  /** A node id from the session dictionary, the walk, or a warning. */
  nodeId?: string;
  /** A CSS selector, for the cases a node id cannot reach — third-party markup, `<body>`. */
  selector?: string;
  action: InputAction;
  /** For `setText`. */
  value?: string;
  /**
   * Which instance, when a node id resolves to several.
   *
   * A node inside a Repeater exists once per row, and all of them carry the *same* node id —
   * that is what makes `getNodesWithIdRecursive` recursive. Defaulting to 0 rather than
   * refusing keeps the overwhelmingly common single-instance case one round trip; the reply
   * always carries `matched`, so a caller that acted on the wrong row can see that it did.
   */
  index?: number;
}

export interface InputResult {
  requestId?: string;
  ok: boolean;
  /**
   * How many elements the address resolved to. **Reported even on success**: `ok: true` with
   * `matched: 7` is a materially different outcome from `ok: true` with `matched: 1`, and a
   * result that only said "ok" would let an agent conclude it had clicked *the* button.
   */
  matched: number;
  /** Present on failure, and on the surprising successes. Written to be read by an LLM. */
  message?: string;
}

/**
 * Resolve an address to the elements it names.
 *
 * Exported for the corpus: the resolution rules (a node may have many instances; a node may
 * have no DOM at all) are the part worth pinning, and they are testable without a browser.
 */
export function resolveTargets(
  runtime: InjectorRuntime,
  request: Pick<InputRequest, 'nodeId' | 'selector'>,
  doc?: Pick<Document, 'querySelectorAll'>
): HTMLElement[] {
  if (request.selector) {
    if (!doc) return [];
    return Array.prototype.slice.call(doc.querySelectorAll(request.selector)) as HTMLElement[];
  }

  if (!request.nodeId) return [];
  if (!runtime.rootComponent) return [];

  const instances = runtime.rootComponent.nodeScope.getNodesWithIdRecursive(request.nodeId);
  const elements: HTMLElement[] = [];
  for (const instance of instances) {
    // ⚠️ Not every node has an element. A Variable, a Counter, a Cloud Function all appear in
    // the walk and in the dictionary and have no DOM whatsoever — so "the node exists but is
    // not clickable" is an ordinary answer here, not an error, and the message says which.
    const element = instance.getDOMElement && instance.getDOMElement();
    if (element) elements.push(element);
  }
  return elements;
}

/**
 * Dispatch a click at the centre of an element.
 *
 * The full pointer/mouse sequence rather than `element.click()`: `click()` fires only the
 * `click` event, and components that track press state (Noodl's own Button does, for its
 * `pressed` visual state) listen on `pointerdown`/`mousedown`. A lone `click` leaves them in
 * a state a real user cannot produce.
 *
 * `bubbles: true` is what makes React see it at all — React attaches its listeners once at
 * the root container and relies on native bubbling, so a non-bubbling event never reaches a
 * single `onClick` in the app.
 */
function dispatchClick(element: HTMLElement): void {
  const rect = element.getBoundingClientRect();
  const init: MouseEventInit = {
    bubbles: true,
    cancelable: true,
    view: typeof window !== 'undefined' ? window : undefined,
    clientX: rect.left + rect.width / 2,
    clientY: rect.top + rect.height / 2,
    button: 0,
    buttons: 1
  };

  if (typeof PointerEvent === 'function') {
    element.dispatchEvent(new PointerEvent('pointerdown', { ...init, pointerId: 1, isPrimary: true }));
  }
  element.dispatchEvent(new MouseEvent('mousedown', init));
  if (typeof element.focus === 'function') element.focus();
  if (typeof PointerEvent === 'function') {
    element.dispatchEvent(new PointerEvent('pointerup', { ...init, buttons: 0, pointerId: 1, isPrimary: true }));
  }
  element.dispatchEvent(new MouseEvent('mouseup', { ...init, buttons: 0 }));
  element.dispatchEvent(new MouseEvent('click', { ...init, buttons: 0 }));
}

/**
 * Set the text of an input or textarea so that React notices.
 *
 * ⚠️ **`element.value = x` does not work on a React-controlled input, and fails silently.**
 * React installs its own `value` setter on the element instance to track what it last
 * rendered; assigning through it updates the DOM *and* React's record, so the subsequent
 * `input` event looks like a no-op change and `onChange` never fires. Calling the prototype's
 * native setter leaves React's record stale, which is exactly what makes the event look like
 * a real edit. This is the standard workaround and it is standard because there is no other
 * way in.
 */
function setText(element: HTMLElement, value: string): boolean {
  const tag = (element.tagName || '').toLowerCase();
  if (tag !== 'input' && tag !== 'textarea') return false;

  const prototype = tag === 'input' ? HTMLInputElement.prototype : HTMLTextAreaElement.prototype;
  const descriptor = Object.getOwnPropertyDescriptor(prototype, 'value');
  if (descriptor && descriptor.set) descriptor.set.call(element, value);
  else (element as HTMLInputElement).value = value;

  element.dispatchEvent(new Event('input', { bubbles: true }));
  element.dispatchEvent(new Event('change', { bubbles: true }));
  return true;
}

/**
 * Carry out one request and describe what happened.
 *
 * ⚠️ **Never throws.** This is a diagnostic channel driven by a remote peer; an exception here
 * would be swallowed by the socket's message handler and the caller would wait out its timeout
 * with no idea why. Every failure is a `message` instead, phrased for the thing that will read
 * it — an agent that has just been told "no element" needs to know whether the node is missing,
 * has no DOM, or is one of seven.
 */
export function performInput(
  runtime: InjectorRuntime,
  request: InputRequest,
  doc?: Pick<Document, 'querySelectorAll'>
): InputResult {
  const reply = (ok: boolean, matched: number, message?: string): InputResult => ({
    requestId: request.requestId,
    ok,
    matched,
    message
  });

  // ⚠️ Held outside the `try` so the catch can still report it. A failure *during* the
  // dispatch does not un-resolve the target, and answering `matched: 0` there would tell the
  // caller its address was wrong when in fact its address was right and the click was not
  // delivered — two different next moves.
  let matched = 0;

  try {
    if (!request.nodeId && !request.selector) {
      return reply(false, 0, 'No target: pass a nodeId (preferred) or a CSS selector.');
    }

    const elements = resolveTargets(runtime, request, doc);
    matched = elements.length;
    if (elements.length === 0) {
      if (request.selector) return reply(false, 0, `No element matches the selector "${request.selector}".`);
      if (!runtime.rootComponent) return reply(false, 0, 'The app has no root component yet — is it still loading?');
      const instances = runtime.rootComponent.nodeScope.getNodesWithIdRecursive(request.nodeId as string);
      return instances.length === 0
        ? reply(false, 0, `No node with id ${request.nodeId} is running. It may be on a page that is not open.`)
        : reply(
            false,
            0,
            `Node ${request.nodeId} is running (${instances.length} instance(s)) but renders no DOM element, so it cannot receive input.`
          );
    }

    const index = request.index ?? 0;
    const element = elements[index];
    if (!element) {
      return reply(false, elements.length, `index ${index} is out of range — ${elements.length} instance(s) matched.`);
    }

    const many =
      elements.length > 1 && request.index === undefined
        ? ` ⚠️ ${elements.length} instances matched (a Repeater row, most likely); acted on index 0. Pass "index" to choose.`
        : '';

    if (request.action === 'click') {
      dispatchClick(element);
      return reply(true, elements.length, `Clicked <${element.tagName.toLowerCase()}>.` + many);
    }

    if (request.action === 'setText') {
      if (typeof request.value !== 'string') return reply(false, elements.length, 'setText needs a "value" string.');
      return setText(element, request.value)
        ? reply(true, elements.length, `Set the text of <${element.tagName.toLowerCase()}>.` + many)
        : reply(
            false,
            elements.length,
            `<${element.tagName.toLowerCase()}> is not an input or textarea, so it has no text to set.`
          );
    }

    return reply(false, elements.length, `Unknown action "${request.action}".`);
  } catch (e) {
    return reply(false, matched, 'The input could not be delivered: ' + ((e && (e as Error).message) || String(e)));
  }
}

/** The connection surface this needs. Structural, so the real one satisfies it unchanged. */
interface InjectorConnection {
  clientId?: string;
  on(event: string, callback: (data?: unknown) => void, ref?: unknown): void;
  sendInputResult(result: InputResult): void;
}

/**
 * Wire the injector to a live editor connection.
 *
 * The `clientId` filter is the same self-addressing every other pull in the trace channel
 * uses: the relay broadcasts to *all* viewers, and a project with a preview and a cloud
 * runtime attached would otherwise have two peers each answer — and, worse, each act.
 */
export function bindInputInjector(runtime: InjectorRuntime, connection: InjectorConnection): void {
  connection.on('injectInput', (payload) => {
    const request = payload as InputRequest & { clientId?: string };
    if (!request || request.clientId !== connection.clientId) return;
    connection.sendInputResult(performInput(runtime, request, typeof document !== 'undefined' ? document : undefined));
  });
}
