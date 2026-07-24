import type { NodeDefinitionOptions, NodeInstance, NodeModule } from '@noodl/types';

import { NavigateArgs, RouterHandler } from './router-handler';

interface RouterNavigateInstance extends NodeInstance {
  _internal: {
    pageParams: NavigateArgs['params'];
    openInNewTab: boolean;
    router?: string;
    target?: string;
    hasScheduledNavigate?: boolean;
  };
  scheduleNavigate(): void;
  navigate(): void;
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
      valueChangedToTrue: function (this: RouterNavigateInstance) {
        this.scheduleNavigate();
      }
    },
    openInNewTab: {
      index: 10,
      displayName: 'Open in new tab',
      group: 'General',
      default: false,
      type: 'boolean',
      set(this: RouterNavigateInstance, value) {
        this._internal.openInNewTab = !!value;
      }
    }
  },
  outputs: {
    navigated: {
      type: 'signal',
      displayName: 'Navigated',
      group: 'Events'
    }
  },
  methods: {
    scheduleNavigate: function (this: RouterNavigateInstance) {
      const internal = this._internal;
      if (!internal.hasScheduledNavigate) {
        internal.hasScheduledNavigate = true;
        this.scheduleAfterInputsHaveUpdated(() => {
          internal.hasScheduledNavigate = false;
          this.navigate();
        });
      }
    },
    navigate(this: RouterNavigateInstance) {
      RouterHandler.instance.navigate(this._internal.router, {
        target: this._internal.target,
        params: this._internal.pageParams,
        openInNewTab: this._internal.openInNewTab,
        hasNavigated: () => {
          this.scheduleAfterInputsHaveUpdated(() => {
            this.sendSignalOnOutput('navigated');
          });
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
