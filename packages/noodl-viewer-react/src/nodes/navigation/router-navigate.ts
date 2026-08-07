import { outcomeOutputs } from '@noodl/runtime/src/outcome';
import type { NodeDefinitionOptions, NodeInstance, NodeModule, NodeOutcome, OutcomeFailureOptions, OutcomeToken } from '@noodl/types';

import { NavigateArgs, RouterHandler } from './router-handler';

/** One `Navigate` invocation's worth of tokens, and whether it has been settled. */
interface PendingNavigation {
  tokens: OutcomeToken[];
  settled: boolean;
}

interface RouterNavigateInstance extends NodeInstance {
  _internal: {
    pageParams: NavigateArgs['params'];
    openInNewTab: boolean;
    router?: string;
    target?: string;
    hasScheduledNavigate?: boolean;
    pendingOutcomes?: OutcomeToken[];
    /** Message for the `Error` output; see NDA-004. */
    lastError?: string;
  };
  scheduleNavigate(outcome: OutcomeToken): void;
  navigate(pending: PendingNavigation): void;
  settle(pending: PendingNavigation, outcome: NodeOutcome, options?: OutcomeFailureOptions): void;
  reportFailure(pending: PendingNavigation, code: string, message: string): void;
  setPageParam(param: string, value: NavigateArgs['params'][string]): void;
  setTargetPage(page: string): void;
  setRouter(value: string): void;
}

const RouterNavigate: NodeDefinitionOptions = {
  name: 'RouterNavigate',
  displayNodeName: 'Navigate',
  category: 'Navigation',
  docs: 'https://docs.noodl.net/nodes/navigation/navigate',
  initialize: function (this: RouterNavigateInstance) {
    this._internal.pageParams = {};
    this._internal.openInNewTab = false;
  },
  inputs: {
    navigate: {
      displayName: 'Navigate',
      group: 'Actions',
      description: 'Navigates the Router to Target Page',
      valueChangedToTrue: function (this: RouterNavigateInstance) {
        this.scheduleNavigate(this.beginOutcome());
      }
    },
    openInNewTab: {
      index: 10,
      displayName: 'Open in new tab',
      group: 'General',
      default: false,
      type: 'boolean',
      description: 'Opens the target page in a new browser tab instead of navigating this one',
      set(this: RouterNavigateInstance, value) {
        this._internal.openInNewTab = !!value;
      }
    }
  },
  // NDA-004 §2: `Navigated` had no counterpart, so a Navigate node with no Target Page, or one
  // pointing at a component the Router does not serve, was a dead button. The trigger is an
  // author `Do` (`Navigate`, group `Actions`), so this port cannot fire on the boot path.
  //
  // ⚠️ ERG-001 §4 renamed `navigated` to `done`. §0.2 Result 2 found eight ports displaying
  // "Done" under four wire names; `navigated` here, `navigated` on Push Component To Stack and
  // `success` on Pop Component Stack were a fifth and sixth, and Richard's 2026-08-02 decision
  // (unify on `done`) applies to the whole navigation family or to none of it.
  outputs: {
    ...outcomeOutputs({
      done:
        'Fires once the Router has switched to the target page. ⚠️ If this node lives on the page ' +
        'being left it is destroyed with that page, so sequence anything that must survive the ' +
        'navigation from a node outside the Router',
      unchanged:
        'Fires when the Router is already showing that page with those parameters, so it was not rebuilt',
      failure: 'Fires when no Target Page is set, or the Router does not serve that page'
    }),
    error: {
      type: 'string',
      displayName: 'Error',
      group: 'Events',
      description: 'Why the navigation did not happen, set just before Failure fires',
      getter: function (this: RouterNavigateInstance) {
        return this._internal.lastError;
      }
    }
  },
  methods: {
    /**
     * End this invocation, at most once.
     *
     * ⚠️ **`RouterHandler.navigate` fans out.** Two Routers registered under one name both
     * receive the args and both call back, so without this guard one press would report twice
     * and `reportOutcome` would — correctly — raise `outcome/duplicate` at an author whose app
     * is merely unusual. The invocation settles on the first Router to answer.
     */
    settle(this: RouterNavigateInstance, pending: PendingNavigation, outcome: NodeOutcome, options?: OutcomeFailureOptions) {
      if (pending.settled) return;
      pending.settled = true;
      for (const token of pending.tokens) this.reportOutcome(token, outcome, options);
    },
    reportFailure(this: RouterNavigateInstance, pending: PendingNavigation, code: string, message: string) {
      this._internal.lastError = message;
      // Value first, signal last — a graph wiring `Failure -> show the reason` must be able to
      // read `Error` when the pulse lands. `reportOutcome` puts the same reason on the NDA-004
      // channel, so `raiseRuntimeError` is *not* called here as well.
      this.flagOutputDirty('error');
      this.settle(pending, 'failure', { code, message });
    },
    scheduleNavigate: function (this: RouterNavigateInstance, outcome: OutcomeToken) {
      const internal = this._internal;
      if (internal.pendingOutcomes === undefined) internal.pendingOutcomes = [];
      internal.pendingOutcomes.push(outcome);

      if (!internal.hasScheduledNavigate) {
        internal.hasScheduledNavigate = true;
        this.scheduleAfterInputsHaveUpdated(() => {
          internal.hasScheduledNavigate = false;
          // One press is one invocation even when a frame's presses coalesce into one
          // navigation — Undo's lesson from Build 2b.
          const pending: PendingNavigation = { tokens: internal.pendingOutcomes || [], settled: false };
          internal.pendingOutcomes = undefined;
          this.navigate(pending);
        });
      }
    },
    navigate(this: RouterNavigateInstance, pending: PendingNavigation) {
      RouterHandler.instance.navigate(this._internal.router, {
        target: this._internal.target,
        params: this._internal.pageParams,
        openInNewTab: this._internal.openInNewTab,
        hasNavigated: () => {
          this.scheduleAfterInputsHaveUpdated(() => {
            this.settle(pending, 'done');
          });
        },
        hasUnchanged: () => {
          this.scheduleAfterInputsHaveUpdated(() => {
            this.settle(pending, 'unchanged');
          });
        },
        hasFailed: (code, message) => {
          this.reportFailure(pending, code, message);
        }
      });
    },
    setPageParam: function (this: RouterNavigateInstance, param: string, value: NavigateArgs['params'][string]) {
      this._internal.pageParams[param] = value;
    },
    setTargetPage: function (this: RouterNavigateInstance, page: string) {
      this._internal.target = page;
    },
    setRouter: function (this: RouterNavigateInstance, value: string) {
      this._internal.router = value;
    },
    registerInputIfNeeded: function (this: RouterNavigateInstance, name: string) {
      if (this.hasInput(name)) {
        return;
      }

      if (name === 'target') {
        return this.registerInput(name, {
          set: this.setTargetPage.bind(this)
        });
      } else if (name === 'router') {
        return this.registerInput(name, {
          set: this.setRouter.bind(this)
        });
      } else if (name.startsWith('pm-')) {
        return this.registerInput(name, {
          set: this.setPageParam.bind(this, name.substring('pm-'.length))
        });
      }
    }
  }
};

const RouterNavigateModule: NodeModule = {
  node: RouterNavigate
};

export default RouterNavigateModule;
