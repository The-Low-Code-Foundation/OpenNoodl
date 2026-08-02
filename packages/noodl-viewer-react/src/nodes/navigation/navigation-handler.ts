import type { TransitionParams } from './transitions/transition';

/**
 * What a Push/Pop navigation asks a Component Stack to do. `transition` is only present
 * for pushes — `replace` never carries one. `backCallback` is the *push node's* callback,
 * invoked by the stack when a Pop Component Stack node later navigates back.
 */
export interface StackNavigateArgs {
  target?: string;
  params: Record<string, unknown>;
  transition?: TransitionParams & { type?: string };
  backCallback?(action: string | undefined, results: Record<string, unknown>): void;
  hasNavigated?(): void;
  /**
   * ERG-001 §4. The stack is already showing exactly what was asked for, so it did not switch.
   *
   * ⚠️ NDA-008 §2's `_isAlreadyShowing` branch called `hasNavigated`, which was the best of the
   * two callbacks that existed. Reporting "the stack switched" for a request that changed
   * nothing is `Insert Object Into Array`'s lie, and this is the port the contract mints for it.
   */
  hasUnchanged?(): void;
  /**
   * NDA-004 §2. The counterpart to `hasNavigated`, for the three ways a push can be
   * dropped on the floor. Optional for the same reason `hasNavigated` is: only the
   * Push Component To Stack *node* supplies one, and it is the node that owns the
   * `Failure` port and the provenance — the stack itself did not fail (NDA-008 §3,
   * `back()`'s `StackBackResult`, same decision one call shape along).
   *
   * A callback rather than a return value because `navigate`/`replace` go through the
   * stack's `asyncQueue`, so by the time the outcome is known the caller's frame is gone.
   */
  hasFailed?(code: string, message: string): void;
}

/** The subset of the Component Stack node the handler drives. */
export interface PageStackLike {
  navigate(args: StackNavigateArgs): void;
  replace(args: StackNavigateArgs): void;
  reset(): void;
}

interface QueuedNavigation {
  name: string;
  args: StackNavigateArgs;
  type: 'navigate' | 'replace';
}

class NavigationHandler {
  static instance: NavigationHandler;

  _pageStacks: Record<string, PageStackLike[]>;
  _navigationQueue: QueuedNavigation[];

  constructor() {
    this._pageStacks = {};
    this._navigationQueue = [];
  }

  _performNavigation(name: string, args: StackNavigateArgs, type: 'navigate' | 'replace') {
    name = name || 'Main';
    if (this._pageStacks[name]) {
      for (const pageStack of this._pageStacks[name]) {
        type === 'navigate' ? pageStack.navigate(args) : pageStack.replace(args);
      }
    } else {
      this._navigationQueue.push({ name, args, type });
    }
  }

  navigate(name: string, args: StackNavigateArgs) {
    name = name || 'Main';
    this._performNavigation(name, args, 'navigate');
  }

  replace(name: string, args: StackNavigateArgs) {
    name = name || 'Main';
    this._performNavigation(name, args, 'replace');
  }

  registerPageStack(name: string, pageStack: PageStackLike) {
    name = name || 'Main';
    if (!this._pageStacks[name]) {
      this._pageStacks[name] = [];
    }

    this._pageStacks[name].push(pageStack);

    let hasReset = false;
    let hasNavigated = false;

    let i = 0;
    while (i < this._navigationQueue.length) {
      const e = this._navigationQueue[i];
      if (e.name === name) {
        if (e.type === 'navigate') {
          if (!hasReset) {
            //we need to reset to the start page before doing the first navigation
            pageStack.reset();
            hasReset = true;
          }
          pageStack.navigate(e.args);
        } else {
          pageStack.replace(e.args);
        }

        hasNavigated = true;
        this._navigationQueue.splice(i, 1);
      } else {
        i++;
      }
    }

    if (!hasNavigated) {
      pageStack.reset(); //no navigation has happened, call reset() so the start page is created
    }
  }

  deregisterPageStack(name: string, pageStack: PageStackLike) {
    name = name || 'Main';

    if (!this._pageStacks[name]) {
      return;
    }

    const index = this._pageStacks[name].indexOf(pageStack);
    if (index === -1) {
      return;
    }

    this._pageStacks[name].splice(index, 1);
    if (this._pageStacks[name].length === 0) {
      delete this._pageStacks[name];
    }
  }
}

NavigationHandler.instance = new NavigationHandler();

export default NavigationHandler;
