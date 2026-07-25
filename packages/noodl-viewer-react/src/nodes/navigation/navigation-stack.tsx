import React, { useEffect } from 'react';
import NoodlRuntime from '@noodl/runtime';
import type {
  EditorConnectionLike,
  GraphModelLike,
  GraphNodeModel,
  InspectInfoEntry,
  NodeContextLike,
  NodeInstance
} from '@noodl/types';

import type { TSFixme } from '../../../typings/global';
import ASyncQueue from '../../async-queue';
import { noodlRootRef } from '../../components/noodl-root-ref';
import guid from '../../guid';
import { createNodeFromReactComponent, ReactNodeInstance } from '../../react-component-node';
import { Noodl, Slot } from '../../types';
import NavigationHandler, { StackNavigateArgs } from './navigation-handler';
import Transitions from './transitions';
import type Transition from './transitions/transition';

interface PageStackReactComponentProps extends Noodl.ReactProps {
  didMount: () => void;
  willUnmount: () => void;

  children: Slot;
}

function PageStackReactComponent(props: PageStackReactComponentProps) {
  const { didMount, willUnmount, style, children } = props;

  useEffect(() => {
    didMount();
    return () => {
      willUnmount();
    };
  }, []);

  return (
    <div ref={noodlRootRef((props as TSFixme).noodlNode)} style={style}>
      {children}
    </div>
  );
}

/** One row of this node's `pages` proplist parameter. */
interface PageListItem {
  id: string;
  label: string;
}

/**
 * What `_findPage` returns. `path` carries the per-page `pagePath-…` input (from
 * `_internal.pageInfo[id].path`) so that `getRelativeURL` writes the same custom
 * path `matchPageFromUrl` matches on. The two were asymmetric until DEBT-006:
 * inbound URLs honoured a custom path while written URLs always used the
 * label-derived slug (PLAT-003 NOTES §19.4 #2).
 */
interface FoundPage {
  component: string;
  label: string;
  id: string;
  path?: string;
}

interface StackEntry {
  from: ReactNodeInstance | null;
  page: ReactNodeInstance;
  pageId: string;
  pageInfo: FoundPage;
  params: Record<string, unknown>;
  transition?: Transition;
  backCallback?: StackNavigateArgs['backCallback'];
  componentName?: string;
}

interface PageStackInstance extends ReactNodeInstance {
  _internal: {
    stack: StackEntry[];
    topPageName: string;
    stackDepth: number;
    /** Per-page registry filled by the `pageComp-…` / `pagePath-…` dynamic inputs. */
    pageInfo: Record<string, { component?: string; path?: string }>;
    asyncQueue: ASyncQueue;
    isMounted?: boolean;
    isTransitioning?: boolean;
    name?: string;
    useRoutes?: boolean;
    pages?: PageListItem[];
    startPageId?: string;
    startPage?: string;
    hasScheduledReset?: boolean;
    remainingNavigationPath?: string[];
    [extra: string]: unknown;
  };
  onScheduleReset?: () => void;
  _registerPageStack(): void;
  _deregisterPageStack(): void;
  _findPage(pageIdOrLabel: string): FoundPage | undefined;
  setPageOutputs(outputs: Record<string, unknown>): void;
  scheduleReset(): void;
  createPageContainer(): ReactNodeInstance;
  reset(): void;
  resetAsync(): Promise<void>;
  getRelativeURL(): { path: string; query: { name: string; value: unknown }[] } | undefined;
  getNavigationAbsoluteURL(): { path: string; query: { name: string; value: unknown }[] };
  _getLocationPath(): string;
  _getSearchParams(): Record<string, string>;
  getNavigationRemainingPath(): string[] | undefined;
  matchPageFromUrl(): { pageId: string; params: Record<string, string>; query: Record<string, string> } | undefined;
  _updateUrlWithTopPage(): void;
  replace(args: StackNavigateArgs): void;
  replaceAsync(args: StackNavigateArgs): Promise<void>;
  navigate(args: StackNavigateArgs): void;
  navigateAsync(args: StackNavigateArgs): Promise<void>;
  back(args: { backAction?: string; results?: Record<string, unknown> }): void;
  setPageComponent(pageId: string, component: string): void;
  setPagePath(pageId: string, path: string): void;
  setStartPage(pageId: string): void;
}

const PageStack = {
  name: 'Page Stack',
  displayNodeName: 'Component Stack',
  category: 'Visuals',
  docs: 'https://docs.noodl.net/nodes/component-stack/component-stack-node',
  ssr: {
    compat: 'partial' as const,
    note: 'The initial stack renders server-side; browser URL/history sync only runs in the browser.'
  },
  useVariants: false,
  noodlNodeAsProp: true,
  initialize(this: PageStackInstance) {
    this._internal.stack = [];

    this._internal.topPageName = '';
    this._internal.stackDepth = 0;

    this._internal.pageInfo = {};

    this._internal.asyncQueue = new ASyncQueue();

    this.onScheduleReset = () => {
      this.scheduleReset();
    };

    this.props.didMount = () => {
      // Fires from both triggerDidMount (SSR / hydration pre-settle) and the React
      // mount effect; during hydration both run. Registering twice would duplicate
      // the stack in RouterHandler.
      if (this._internal.isMounted) return;
      this._internal.isMounted = true;

      // didMount also fires server-side (triggerDidMount during SSR); the URL
      // listeners are browser-only, the stack registration is not.
      if (typeof window !== 'undefined') {
        // Listen to push state events and update stack
        if (window.history && window.history.pushState) {
          //this is event is manually sent on push, so covers both pop and push state
          window.addEventListener('popstate', this.onScheduleReset);
        } else {
          // Only hash support
          window.addEventListener('hashchange', this.onScheduleReset);
        }
      }

      this._registerPageStack();
    };

    this.props.willUnmount = () => {
      this._internal.isMounted = false;

      if (typeof window !== 'undefined') {
        window.removeEventListener('popstate', this.onScheduleReset);
        window.removeEventListener('hashchange', this.onScheduleReset);
      }

      this._deregisterPageStack();
    };
  },
  getInspectInfo(this: PageStackInstance) {
    if (this._internal.stack.length === 0) {
      return 'No active page';
    }

    const info: InspectInfoEntry[] = [{ type: 'text', value: 'Active Components:' }];

    return info.concat(
      this._internal.stack.map((p) => {
        const pageInfo = this._findPage(p.pageId);
        return {
          type: 'text' as const,
          value: '- ' + pageInfo.label
        };
      })
    );
  },
  defaultCss: {
    width: '100%',
    flex: '1 1 100%',
    position: 'relative',
    display: 'flex',
    flexDirection: 'column'
  },
  getReactComponent() {
    return PageStackReactComponent;
  },
  inputs: {
    name: {
      type: { name: 'string', identifierOf: 'PackStack' },
      displayName: 'Name',
      group: 'General',
      default: 'Main',
      set: function (this: PageStackInstance, value: string) {
        this._deregisterPageStack();
        this._internal.name = value;

        if (this._internal.isMounted) {
          this._registerPageStack();
        }
      }
    },
    /*	startPage: {
			type: 'component',
			displayName: 'Start Page',
			group: 'General',
			set: function (value) {
				this._internal.startPage = value;
				this.scheduleReset();
			}
		},*/
    useRoutes: {
      type: 'boolean',
      displayName: 'Use Routes',
      group: 'General',
      default: false,
      set: function (this: PageStackInstance, value) {
        this._internal.useRoutes = !!value;
      }
    },
    clip: {
      displayName: 'Clip Content',
      type: 'boolean',
      group: 'Layout',
      default: true,
      set(this: PageStackInstance, value) {
        if (value) {
          this.setStyle({ overflow: 'hidden' });
        } else {
          this.removeStyle(['overflow']);
        }
      }
    },
    pages: {
      type: 'proplist',
      displayName: 'Components',
      group: 'Components',
      set: function (this: PageStackInstance, value: PageListItem[]) {
        this._internal.pages = value;
        if (this._internal.isMounted) {
          this.scheduleReset();
        }
      }
    },
    reset: {
      type: 'signal',
      displayName: 'Reset',
      group: 'Actions',
      valueChangedToTrue: function (this: PageStackInstance) {
        this.scheduleReset();
      }
    }
  },
  inputCss: {
    backgroundColor: {
      type: 'color',
      displayName: 'Background Color',
      group: 'Style',
      default: 'transparent',
      applyDefault: false
    }
  },
  outputs: {
    topPageName: {
      type: 'string',
      displayName: 'Top Component Name',
      group: 'General',
      get(this: PageStackInstance) {
        return this._internal.topPageName;
      }
    },
    stackDepth: {
      type: 'number',
      displayName: 'Stack Depth',
      group: 'General',
      get(this: PageStackInstance) {
        return this._internal.stackDepth;
      }
    }
  },
  methods: {
    _registerPageStack(this: PageStackInstance) {
      NavigationHandler.instance.registerPageStack(this._internal.name, this);
    },
    _deregisterPageStack(this: PageStackInstance) {
      NavigationHandler.instance.deregisterPageStack(this._internal.name, this);
    },
    _findPage(this: PageStackInstance, pageIdOrLabel: string): FoundPage | undefined {
      if (this._internal.pageInfo[pageIdOrLabel]) {
        const pageInfo = this._internal.pageInfo[pageIdOrLabel];
        const pageRef = this._internal.pages.find((x) => x.id === pageIdOrLabel);
        return {
          component: String(pageInfo.component),
          label: String(pageRef.label),
          id: String(pageIdOrLabel),
          path: pageInfo.path !== undefined ? String(pageInfo.path) : undefined
        };
      }

      const pageRef = this._internal.pages.find((x) => x.label === pageIdOrLabel);
      if (pageRef) {
        const pageInfo = this._internal.pageInfo[pageRef.id];
        return {
          component: String(pageInfo.component),
          label: String(pageRef.label),
          id: String(pageRef.id),
          path: pageInfo.path !== undefined ? String(pageInfo.path) : undefined
        };
      }

      return undefined;
    },
    setPageOutputs(this: PageStackInstance, outputs: Record<string, unknown>) {
      for (const prop in outputs) {
        this._internal[prop] = outputs[prop];
        this.flagOutputDirty(prop);
      }
    },
    scheduleReset(this: PageStackInstance) {
      const internal = this._internal;
      if (!internal.hasScheduledReset) {
        internal.hasScheduledReset = true;
        this.scheduleAfterInputsHaveUpdated(() => {
          internal.hasScheduledReset = false;
          this.reset();
        });
      }
    },
    createPageContainer(this: PageStackInstance) {
      const group = this.nodeScope.createPrimitiveNode('Group') as ReactNodeInstance;
      group.setStyle({ flex: '1 0 100%' });
      return group;
    },
    reset(this: PageStackInstance) {
      this._internal.asyncQueue.enqueue(this.resetAsync.bind(this));
    },
    async resetAsync(this: PageStackInstance) {
      const children = this.getChildren();
      for (const i in children) {
        const c = children[i];
        this.removeChild(c);
        this.nodeScope.deleteNode(c);
      }

      if (this._internal.pages === undefined || this._internal.pages.length === 0) return;

      let startPageId: string;
      let params: Record<string, unknown> = {};

      const pageFromUrl = this.matchPageFromUrl();
      if (pageFromUrl !== undefined) {
        // We have an url matching a page, use that page as start page
        startPageId = pageFromUrl.pageId;

        params = Object.assign({}, pageFromUrl.query, pageFromUrl.params);
      } else {
        startPageId = this._internal.startPageId;
        if (startPageId === undefined) startPageId = this._internal.pages[0].id;
      }

      // Find the page by either ID or by Label
      const pageInfo = this._findPage(startPageId);
      if (pageInfo === undefined || pageInfo.component === undefined) {
        // No page was found
        return;
      }

      // In the React viewer a component instance is always a ReactNodeInstance; the
      // published createNode signature only promises the runtime-level NodeInstance.
      const content = (await this.nodeScope.createNode(pageInfo.component, guid())) as ReactNodeInstance;

      for (const key in params) {
        content.setInputValue(key, params[key]);
      }

      const group = this.createPageContainer();
      group.addChild(content);

      this.addChild(group);
      this._internal.stack = [
        {
          from: null,
          page: group,
          pageId: startPageId,
          pageInfo: pageInfo,
          params: params,
          componentName: this._internal.startPage
        }
      ];

      this.setPageOutputs({
        topPageName: pageInfo.label,
        stackDepth: this._internal.stack.length
      });
    },
    getRelativeURL(this: PageStackInstance) {
      const top = this._internal.stack[this._internal.stack.length - 1];
      if (top === undefined) return;

      let urlPath = top.pageInfo.path;
      if (urlPath === undefined) {
        const pageItem = this._internal.pages.find((p) => p.id == top.pageId);
        if (pageItem === undefined) return;

        urlPath = pageItem.label.replace(/\s+/g, '-').toLowerCase();
      }

      // First add matching parameters to path
      const paramsInPath = urlPath.match(/{([^}]+)}/g);

      const params = Object.assign({}, top.params);
      if (paramsInPath) {
        for (const param of paramsInPath) {
          const key = param.replace(/[{}]/g, '');
          if (top.params[key] !== undefined) {
            urlPath = urlPath.replace(param, encodeURIComponent(String(params[key])));
            delete params[key];
          }
        }
      }

      // Add other paramters as query
      const query: { name: string; value: unknown }[] = [];
      for (const key in params) {
        query.push({
          name: key,
          value: params[key]
        });
      }

      if (urlPath.startsWith('/')) urlPath = urlPath.substring(1);

      return {
        path: urlPath,
        query: query
      };
    },
    getNavigationAbsoluteURL(this: PageStackInstance) {
      let parent = this.parent;

      while (parent !== undefined && typeof parent.getNavigationAbsoluteURL !== 'function') {
        parent = parent.getVisualParentNode();
      }

      let parentUrl: { path: string; query: { name: string; value: unknown }[] };
      if (parent === undefined) {
        parentUrl = { path: '', query: [] };
      } else {
        parentUrl = (parent as PageStackInstance).getNavigationAbsoluteURL();
      }

      const thisUrl = this.getRelativeURL();
      if (thisUrl === undefined) return parentUrl;
      else {
        return {
          path: parentUrl.path + (parentUrl.path.endsWith('/') ? '' : '/') + thisUrl.path,
          query: parentUrl.query.concat(thisUrl.query)
        };
      }
    },
    _getLocationPath: function (this: PageStackInstance) {
      const navigationPathType = NoodlRuntime.instance.getProjectSettings()['navigationPathType'];
      if (navigationPathType === undefined || navigationPathType === 'hash') {
        // Use hash as path
        let hash = location.hash;
        if (hash) {
          if (hash[0] === '#') hash = hash.substring(1);
          if (hash[0] === '/') hash = hash.substring(1);
        }
        return hash;
      } else {
        // Use url as path
        let path = location.pathname;
        if (path) {
          if (path[0] === '/') path = path.substring(1);
        }
        return path;
      }
    },
    _getSearchParams: function (this: PageStackInstance) {
      const pl = /\+/g, // Regex for replacing addition symbol with a space
        search = /([^&=]+)=?([^&]*)/g,
        decode = function (s: string) {
          return decodeURIComponent(s.replace(pl, ' '));
        },
        // Bare `location` (not window.location): the SSR server shims
        // globalThis.location, so URL matching also works server-side.
        query = location.search.substring(1);

      let match: RegExpExecArray;

      const urlParams: Record<string, string> = {};
      while ((match = search.exec(query))) urlParams[decode(match[1])] = decode(match[2]);

      return urlParams;
    },
    getNavigationRemainingPath(this: PageStackInstance) {
      return this._internal.remainingNavigationPath;
    },
    matchPageFromUrl(this: PageStackInstance) {
      if (!this._internal.useRoutes) return;
      if (this._internal.pages === undefined || this._internal.pages.length === 0) return;

      // Attempt to find relative path from closest navigation parent
      let parent = this.parent;
      while (parent !== undefined && typeof parent.getNavigationRemainingPath !== 'function') {
        parent = parent.getVisualParentNode();
      }

      let pathParts: string[];
      if (parent === undefined) {
        let urlPath = this._getLocationPath();
        if (urlPath[0] === '/') urlPath = urlPath.substring(1);
        pathParts = urlPath.split('/');
      } else {
        pathParts = (parent as PageStackInstance).getNavigationRemainingPath();
      }
      if (pathParts === undefined) return;

      const urlQuery = this._getSearchParams();

      function _matchPathParts(path: string[], pattern: string[]) {
        const params: Record<string, string> = {};
        for (let i = 0; i < pattern.length; i++) {
          if (path[i] === undefined) return;

          const _p = pattern[i];
          if (_p[0] === '{' && _p[_p.length - 1] === '}') {
            // This is a param, collect it
            params[_p.substring(1, _p.length - 1)] = decodeURIComponent(path[i]);
          } else if (_p !== path[i]) return;
        }
        return {
          params: params,
          remainingPathParts: path.splice(pattern.length)
        };
      }

      for (const page of this._internal.pages) {
        const pageInfo = this._internal.pageInfo[page.id];
        if (pageInfo === undefined) continue;

        let pagePattern = pageInfo.path;
        if (pagePattern === undefined) {
          pagePattern = page.label.replace(/\s+/g, '-').toLowerCase();
        }
        if (pagePattern[0] === '/') pagePattern = pagePattern.substring(1);

        const match = _matchPathParts(pathParts, pagePattern.split('/'));
        if (match) {
          // This page is a match
          this._internal.remainingNavigationPath = match.remainingPathParts;
          return {
            pageId: page.id,
            params: match.params,
            query: urlQuery
          };
        }
      }
    },
    _updateUrlWithTopPage(this: PageStackInstance) {
      // Push the state to the browser url. `window.history !== undefined` alone
      // would throw server-side — dereferencing window needs its own guard.
      if (this._internal.useRoutes && typeof window !== 'undefined' && window.history !== undefined) {
        const url = this.getNavigationAbsoluteURL();

        let urlPath, hashPath;
        const navigationPathType = NoodlRuntime.instance.getProjectSettings()['navigationPathType'];
        if (navigationPathType === undefined || navigationPathType === 'hash') hashPath = url.path;
        else urlPath = url.path;

        const query = url.query.map((q) => q.name + '=' + q.value);
        const compiledUrl =
          (urlPath !== undefined ? urlPath : '') +
          (query.length >= 1 ? '?' + query.join('&') : '') +
          (hashPath !== undefined ? '#' + hashPath : '');

        this._internal.remainingNavigationPath = undefined; // Reset remaining nav path
        //	console.log(compiledUrl);
        window.history.pushState({}, '', compiledUrl);
      }
    },
    replace(this: PageStackInstance, args: StackNavigateArgs) {
      this._internal.asyncQueue.enqueue(this.replaceAsync.bind(this, args));
    },
    async replaceAsync(this: PageStackInstance, args: StackNavigateArgs) {
      if (this._internal.pages === undefined || this._internal.pages.length === 0) {
        return;
      }

      if (this._internal.isTransitioning) {
        return;
      }

      const pageId = args.target || this._internal.pages[0].id;

      // Find the page by either ID or by Label
      const pageInfo = this._findPage(pageId);
      if (pageInfo === undefined || pageInfo.component === undefined) {
        // No page was found
        return;
      }

      // Remove all current pages in the stack
      const children = this.getChildren();
      for (const i in children) {
        const c = children[i];
        this.removeChild(c);
        this.nodeScope.deleteNode(c);
      }

      const group = this.createPageContainer();

      // Create the page content
      const content = (await this.nodeScope.createNode(pageInfo.component, guid())) as ReactNodeInstance;
      for (const key in args.params) {
        content.setInputValue(key, args.params[key]);
      }
      group.addChild(content);

      this.addChild(group);

      // Replace stack
      this._internal.stack = [
        {
          from: null,
          page: group,
          pageId: pageId,
          pageInfo: pageInfo,
          params: args.params,
          componentName: args.target
        }
      ];

      this.setPageOutputs({
        topPageName: pageInfo.label,
        stackDepth: this._internal.stack.length
      });

      this._updateUrlWithTopPage();

      args.hasNavigated && args.hasNavigated();
    },
    navigate(this: PageStackInstance, args: StackNavigateArgs) {
      this._internal.asyncQueue.enqueue(this.navigateAsync.bind(this, args));
    },
    async navigateAsync(this: PageStackInstance, args: StackNavigateArgs) {
      if (this._internal.pages === undefined || this._internal.pages.length === 0) {
        return;
      }

      if (this._internal.isTransitioning) {
        return;
      }

      const pageId = args.target || this._internal.pages[0].id;

      // Find the page by either ID or by Label
      const pageInfo = this._findPage(pageId);
      if (pageInfo === undefined || pageInfo.component === undefined) {
        // No page was found
        return;
      }

      // Create the container group
      const group = this.createPageContainer();
      group.setInputValue('position', 'absolute');

      // Create the page content
      const content = (await this.nodeScope.createNode(pageInfo.component, guid())) as ReactNodeInstance;
      for (const key in args.params) {
        content.setInputValue(key, args.params[key]);
      }
      group.addChild(content);

      // Connect navigate back nodes
      // `_setBackCallback` is a method of the Pop Component Stack node (navigate-back.ts),
      // reached here across the node-type boundary the same way the Router reaches
      // `_setPageParams` on PageInputs.
      const navigateBackNodes = content.nodeScope.getNodesWithType('PageStackNavigateBack') as Array<
        NodeInstance & { _setBackCallback(cb: PageStackInstance['back']): void }
      >;
      if (navigateBackNodes && navigateBackNodes.length > 0) {
        for (let j = 0; j < navigateBackNodes.length; j++) {
          navigateBackNodes[j]._setBackCallback(this.back.bind(this));
        }
      }

      // Push the new top
      const top = this._internal.stack[this._internal.stack.length - 1];
      const newTop: StackEntry = {
        from: top.page,
        page: group,
        pageInfo: pageInfo,
        pageId: pageId,
        params: args.params,
        transition: new Transitions[args.transition.type || 'Push'](top.page, group, args.transition),
        backCallback: args.backCallback,
        componentName: args.target
      };
      this._internal.stack.push(newTop);
      this.setPageOutputs({
        topPageName: pageInfo.label,
        stackDepth: this._internal.stack.length
      });
      this._updateUrlWithTopPage();

      newTop.transition.forward(0);

      this._internal.isTransitioning = true;
      newTop.transition.start({
        end: () => {
          this._internal.isTransitioning = false;

          // Transition has completed, remove the previous top from the stack
          this.removeChild(top.page);
          group.setInputValue('position', 'relative');
        }
      });

      this.addChild(group);

      args.hasNavigated && args.hasNavigated();
    },
    back(this: PageStackInstance, args: { backAction?: string; results?: Record<string, unknown> }) {
      if (this._internal.stack.length <= 1) return;
      if (this._internal.isTransitioning) return;

      const top = this._internal.stack[this._internal.stack.length - 1];

      top.page.setInputValue('position', 'absolute');
      // Insert the destination in the stack again
      this.addChild(top.from, 0);
      top.backCallback && top.backCallback(args.backAction, args.results);

      // Find the page by either ID or by Label
      const pageInfo = this._findPage(this._internal.stack[this._internal.stack.length - 2].pageId);

      this.setPageOutputs({
        topPageName: pageInfo.label,
        stackDepth: this._internal.stack.length - 1
      });

      this._internal.isTransitioning = true;
      top.transition.start({
        end: () => {
          this._internal.isTransitioning = false;

          top.page.setInputValue('position', 'relative');
          this.removeChild(top.page);
          this.nodeScope.deleteNode(top.page);
          this._internal.stack.pop();

          this._updateUrlWithTopPage();
        },
        back: true
      });
    },
    setPageComponent(this: PageStackInstance, pageId: string, component: string) {
      const internal = this._internal;
      if (!internal.pageInfo[pageId]) internal.pageInfo[pageId] = {};
      internal.pageInfo[pageId].component = component;

      // this.scheduleRefresh();
    },
    setPagePath(this: PageStackInstance, pageId: string, path: string) {
      const internal = this._internal;
      if (!internal.pageInfo[pageId]) internal.pageInfo[pageId] = {};
      internal.pageInfo[pageId].path = path;

      //  this.scheduleRefresh();
    },
    setStartPage(this: PageStackInstance, pageId: string) {
      this._internal.startPageId = pageId;
    },
    registerInputIfNeeded: function (this: PageStackInstance, name: string) {
      if (this.hasInput(name)) {
        return;
      }

      if (name.startsWith('pageComp-'))
        return this.registerInput(name, {
          set: this.setPageComponent.bind(this, name.substring('pageComp-'.length))
        });

      if (name.startsWith('pagePath-'))
        return this.registerInput(name, {
          set: this.setPagePath.bind(this, name.substring('pagePath-'.length))
        });

      if (name === 'startPage')
        return this.registerInput(name, {
          set: this.setStartPage.bind(this)
        });
    }
  },
  setup(context: NodeContextLike, graphModel: GraphModelLike) {
    if (!context.editorConnection || !context.editorConnection.isRunningLocally()) {
      return;
    }
    const editorConnection: EditorConnectionLike = context.editorConnection;

    function _managePortsForNode(node: GraphNodeModel) {
      function _updatePorts() {
        const ports = [];

        const pages = node.parameters['pages'] as PageListItem[] | undefined;
        if (pages !== undefined && pages.length > 0) {
          pages.forEach((p) => {
            // Component for page
            ports.push({
              name: 'pageComp-' + p.id,
              displayName: 'Component',
              editorName: p.label + ' | Component',
              plug: 'input',
              type: 'component',
              parent: 'pages',
              parentItemId: p.id
            });

            // Path for page
            if (node.parameters['useRoutes'] === true) {
              ports.push({
                name: 'pagePath-' + p.id,
                displayName: 'Path',
                editorName: p.label + ' | Path',
                plug: 'input',
                type: 'string',
                default: p.label.replace(/\s+/g, '-').toLowerCase(),
                parent: 'pages',
                parentItemId: p.id
              });
            }
          });

          ports.push({
            plug: 'input',
            type: {
              name: 'enum',
              enums: pages.map((p) => ({
                label: p.label,
                value: p.id
              })),
              allowEditOnly: true
            },
            group: 'General',
            displayName: 'Start Page',
            name: 'startPage',
            default: pages[0].id
          });
        }

        editorConnection.sendDynamicPorts(node.id, ports);
      }

      _updatePorts();
      node.on('parameterUpdated', function (ev) {
        if (ev.name === 'pages' || ev.name === 'useRoutes') _updatePorts();
      });
    }

    graphModel.on('editorImportComplete', () => {
      graphModel.on('nodeAdded.Page Stack', function (node: GraphNodeModel) {
        _managePortsForNode(node);
      });

      for (const node of graphModel.getNodesWithType('Page Stack')) {
        _managePortsForNode(node);
      }
    });
  }
};

export default createNodeFromReactComponent(PageStack);
