import React, { useEffect } from 'react';
import NoodlRuntime from '@noodl/runtime';

import type { TSFixme } from '../../../typings/global';

import ASyncQueue from '../../async-queue';
import { noodlRootRef } from '../../components/noodl-root-ref';
import guid from '../../guid';
import { createNodeFromReactComponent } from '../../react-component-node';
import { Noodl, Slot } from '../../types';
import { ComponentPageInfo, NavigateArgs, RouterHandler } from './router-handler';

export interface RouterReactComponentProps extends Noodl.ReactProps {
  didMount: () => void;
  willUnmount: () => void;

  children: Slot;
}

function RouterReactComponent(props: RouterReactComponentProps) {
  const { didMount, willUnmount, children, style } = props;

  useEffect(() => {
    didMount();
    return () => {
      willUnmount();
    };
  }, []);

  return (
    <div ref={noodlRootRef((props as TSFixme).noodlNode)} className={props.className} style={style}>
      {children}
    </div>
  );
}

function _trimUrlPart(url) {
  if (url[0] === '/') url = url.substring(1);
  if (url[url.length - 1] === '/') url = url.substring(0, url.length - 1);
  return url;
}

function getBaseUrlLength(url: string): number {
  // If the URL is a full URL, then we only want to get the pathname.
  // Otherwise we just return the url length which should be the pathname.
  if (!url.startsWith('/')) {
    try {
      // Lets say the baseUrl is:
      // "https://collar-zippy-overcome.sandbox.noodl.app/my-folder"
      // Then we want to remove "/my-folder" from the substring
      return new URL(url).pathname.length;
    } catch {
      /* noop */
    }
  }

  return url.length;
}

const RouterNode = {
  name: 'Router',
  displayNodeName: 'Page Router',
  category: 'Visuals',
  docs: 'https://docs.noodl.net/nodes/navigation/page-router',
  allowAsExportRoot: true,
  useVariants: false,
  noodlNodeAsProp: true,
  connectionPanel: {
    groupPriority: ['General', 'Actions', 'Events', 'Mounted']
  },
  initialize: function () {
    this._internal.asyncQueue = new ASyncQueue();

    this.onScheduleReset = () => {
      this.scheduleReset();
    };

    this.props.didMount = () => {
      // Fires from two places: triggerDidMount (SSR / hydration pre-settle) and the
      // React component's mount effect. During hydration both run — registering the
      // router twice would duplicate it in RouterHandler and re-navigate.
      if (this._internal.isMounted) return;
      this._internal.isMounted = true;

      // SSR Support
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

      this._registerRouter();
    };

    this.props.willUnmount = () => {
      this._internal.isMounted = false;

      if (typeof window !== 'undefined') {
        window.removeEventListener('popstate', this.onScheduleReset);
        window.removeEventListener('hashchange', this.onScheduleReset);
      }

      this._deregisterRouter();
    };

    this.props.layout = 'column';
  },
  getInspectInfo() {
    return this._internal.currentUrl;
  },
  defaultCss: {
    flex: '1 1',
    alignSelf: 'stretch',
    position: 'relative',
    display: 'flex',
    flexDirection: 'column'
  },
  getReactComponent() {
    return RouterReactComponent;
  },
  inputs: {
    name: {
      type: 'string',
      displayName: 'Name',
      group: 'General',
      description: 'Name the Navigate nodes address this router by; leave it blank if there is only one',
      set: function (value) {
        this._deregisterRouter();
        this._internal.name = value;

        if (this._internal.isMounted) {
          this._registerRouter();
        }
      }
    },
    pages: {
      type: { name: 'pages', allowEditOnly: true },
      displayName: 'Pages',
      description: 'The components this router can show, and which of them is the start page',
      group: 'Pages',
      set: function (value) {
        this._internal.pages = value;
        if (this._internal.isMounted) {
          this.scheduleReset();
        }
      }
    },
    urlPath: {
      type: 'string',
      displayName: 'Url path',
      description: 'Path segment prefixed to every page of this router, for nesting one router inside another',
      group: 'General',
      set: function (value) {
        this._internal.urlPath = value;
      }
    },
    clip: {
      displayName: 'Clip Behavior',
      description: 'What happens when a page is taller than the router: grow to fit it, scroll it, or clip it',
      type: {
        name: 'enum',
        enums: [
          { value: 'contentHeight', label: 'Expand to content size' },
          { value: 'scroll', label: 'Scroll' },
          { value: 'clip', label: 'Clip content' }
        ]
      },
      group: 'Layout',
      default: 'contentHeight',
      set(value) {
        switch (value) {
          case 'scroll':
            this.setStyle({ overflow: 'auto' });
            break;
          case 'clip':
            this.setStyle({ overflow: 'hidden' });
            break;
          default:
            this.removeStyle(['overflow']);
            break;
        }
      }
    },
    reset: {
      type: 'signal',
      displayName: 'Reset',
      description: 'Re-reads the URL and rebuilds the current page from scratch',
      group: 'Actions',
      valueChangedToTrue: function () {
        this.scheduleReset();
      }
    }
  },
  inputCss: {
    backgroundColor: {
      type: 'color',
      displayName: 'Background Color',
      description: 'Fill colour behind whichever page is showing',
      group: 'Style',
      default: 'transparent',
      applyDefault: false
    }
  },
  outputs: {
    currentPageTitle: {
      type: 'string',
      group: 'General',
      displayName: 'Current Page Title',
      description: 'Title of the page currently showing, taken from the Pages list',
      getter: function () {
        return this._internal.currentPage !== undefined ? this._internal.currentPage.title : undefined;
      }
    },
    currentPageComponent: {
      type: 'string',
      group: 'General',
      displayName: 'Current Page Component',
      description: 'Component name of the page currently showing',
      getter: function () {
        return this._internal.currentPage !== undefined ? this._internal.currentPage.component : undefined;
      }
    }
  },
  methods: {
    _registerRouter() {
      RouterHandler.instance.registerRouter(this._internal.name, this);
    },
    _deregisterRouter() {
      RouterHandler.instance.deregisterRouter(this._internal.name, this);
    },
    setPageOutputs(outputs) {
      for (const prop in outputs) {
        this._internal[prop] = outputs[prop];
        this.flagOutputDirty(prop);
      }
    },
    scheduleReset() {
      const internal = this._internal;
      if (!internal.hasScheduledReset) {
        internal.hasScheduledReset = true;
        this.scheduleAfterInputsHaveUpdated(() => {
          internal.hasScheduledReset = false;
          this.reset();
        });
      }
    },
    createPageContainer() {
      const group = this.nodeScope.createPrimitiveNode('Group');
      group.setStyle({ flex: '1 0 100%' });
      return group;
    },
    reset() {
      this._internal.asyncQueue.enqueue(this.resetAsync.bind(this));
    },
    scrollToTop() {
      const dom = this.getDOMElement();
      if (dom) {
        dom.scrollTop = 0;

        if (NoodlRuntime.instance.getProjectSettings().bodyScroll) {
          //Automatically scroll the page router into view in case it's currently outside the viewport
          //Might want to add an option to disable this
          dom.scrollIntoView();
        }
      }
    },
    /**
     * NDA-012 (Visual), RT-1/RT-2/RT-3. `resetAsync` is the path `RouterHandler.registerRouter`
     * takes when a router mounts, so it runs *before* any Navigate node fires — and NDA-004 §2
     * gave the full failure channel to `navigateAsync` only. Three defects lived here, all of
     * one family: **the same value is guarded on one line and dereferenced on another**, and
     * every exit was a bare `return`.
     *
     * The reset path has no `args` to carry a `hasFailed`, so each drop reports on the runtime
     * error bus instead (`FAILURE-CONTRACT.md`). The Router is the node that is wrong in all
     * three cases — unconfigured, pointed at a page it does not own, or pointed at a component
     * that is not a page — so it owns the provenance.
     *
     * ⚠️ No outcome *ports* are added here. Completion signals across the Visual family are one
     * design gap with one collision sweep, and `OUTCOME-CONTRACT.md` / phase 35 `ERG-001` owns
     * them. Naming them per-node now would mean naming them twice.
     */
    async resetAsync() {
      let component: string;
      let params = {};

      const matchFromUrl = this.matchPageFromUrl();
      if (matchFromUrl && matchFromUrl.page) {
        // Use the matching page
        component = matchFromUrl.page.component;
        params = Object.assign({}, matchFromUrl.params, matchFromUrl.query);
      } else {
        // Fall back to the start page. Two ways in: the URL matched this router but named no
        // page, or it did not match at all — `matchPageFromUrl` returns undefined when the
        // router has no pages to match against (`:503`).
        //
        // RT-3: those two ways used to be two branches reading `_internal.pages` twice, once
        // guarded and once bare, and `pages` has no `default` (`:141-152`) — so a Page Router
        // dropped on a canvas and not yet configured threw a `TypeError` here on first mount.
        // One read, guarded once.
        component = this._internal.pages !== undefined ? this._internal.pages.startPage : undefined;
        params = matchFromUrl ? Object.assign({}, matchFromUrl.params, matchFromUrl.query) : {};
      }

      if (component === undefined) {
        // Unconfigured, rather than misconfigured: distinguish the two, because "you have not
        // filled in Pages yet" and "your Pages list has no start page" are different fixes.
        if (this._internal.pages === undefined) {
          this.raiseRuntimeError(
            'router/no-pages',
            'This Router has no Pages configured, so it has nothing to show — add the components it should route between to its Pages list'
          );
        } else {
          this.raiseRuntimeError(
            'router/no-start-page',
            'This Router has no start page, so it has nothing to show on load — pick one in its Pages list'
          );
        }
        return;
      }

      // RT-2: named `targetPage`, not `currentPage`, because calling it the current page is what
      // made the comparison below look right. `getPageInfoForComponent` is
      // `ComponentPageInfo | undefined`, and on a fresh router `_internal.currentPage` is
      // undefined too — so an unresolvable start page compared *identical* to "already showing
      // it", and the router returned having built nothing, rendered nothing and said nothing,
      // on every reset. A permanently blank router with no diagnostic.
      const targetPage = RouterHandler.instance.getPageInfoForComponent(component);
      if (targetPage === undefined) {
        this.raiseRuntimeError(
          'router/page-not-found',
          `"${component}" is not a page of this Router, so it cannot be shown — check the Router's Pages list`
        );
        return;
      }

      if (this._internal.currentPage === targetPage) {
        //already at the correct page, keep the current page
        //update page inputs if they have changed
        //TODO: fix if a parameter goes from a value to undefined, the old value will still exist in the connection from previous navigation
        if (!shallowObjectsEqual(this._internal.currentParams, params)) {
          this._internal.currentParams = params;
          this._updatePageInputs(this._internal.currentPageComponent.nodeScope, params);
        }
        return;
      }

      this.scrollToTop();

      // Reset the current page for this router
      // First remove all children
      const children = this.getChildren();
      for (const i in children) {
        const c = children[i];
        this.removeChild(c);
        this.nodeScope.deleteNode(c);
      }

      const content = await this.nodeScope.createNode(component, guid());

      // Find the root page node
      const pageNodes = content.nodeScope.getNodesWithType('Page');
      if (pageNodes === undefined || pageNodes.length !== 1) {
        // RT-1: this used to be a bare `return` *after* `currentPageComponent = content`, so a
        // component wired as a page that is not one was built, never attached, never deleted and
        // never reported — and the output went on pointing at it.
        this.nodeScope.deleteNode(content);

        // The children were torn down above, so the router really is showing nothing now.
        // Leaving `currentPage` set to the page that is no longer on screen would let the
        // identity check above absorb the *next* reset back to it — RT-2's symptom through a
        // second door.
        this._internal.currentPage = undefined;
        this._internal.currentPageComponent = undefined;
        this.flagOutputDirty('currentPageComponent');

        this.raiseRuntimeError(
          'router/component-is-not-a-page',
          `"${component}" cannot be shown by this Router: a routed component must contain exactly one Page node, and this one has ${
            pageNodes === undefined || pageNodes.length === 0 ? 'none' : pageNodes.length
          }`
        );
        return;
      }

      this._internal.currentPageComponent = content;
      this._internal.currentPage = targetPage;
      this._internal.currentParams = params;

      this.flagOutputDirty('currentPageTitle');
      this.flagOutputDirty('currentPageComponent');
      Noodl.SEO.setTitle(this._internal.currentPage.title);

      this._updatePageInputs(this._internal.currentPageComponent.nodeScope, params);

      const group = this.createPageContainer();
      group.addChild(content);

      this.addChild(group);

      /*	this.setPageOutputs({
				currentUrl: pageInfo.path,
				currentTitle: pageInfo.title
			});*/
    },
    _updatePageInputs(nodeScope, params) {
      for (const pageInputNode of nodeScope.getNodesWithType('PageInputs')) {
        pageInputNode._setPageParams(params);
      }
    },
    getRelativeURL(targetPage: ComponentPageInfo, pageParams: NavigateArgs['params']) {
      if (!targetPage) return;

      let urlPath = targetPage.path;
      if (urlPath === undefined) return;

      // First add matching parameters to path
      const paramsInPath = urlPath.match(/{([^}]+)}/g);

      const params = Object.assign({}, pageParams);
      if (paramsInPath) {
        for (const param of paramsInPath) {
          const key = param.replace(/[{}]/g, '');
          if (pageParams[key] !== undefined) {
            urlPath = urlPath.replace(param, encodeURIComponent(params[key]));
            delete params[key];
          }
        }
      }

      // Add other paramters as query
      const query = [];
      for (const key in params) {
        query.push({
          name: key,
          value: encodeURIComponent(params[key])
        });
      }

      urlPath = _trimUrlPart(urlPath);

      // Prepend this routers url path if there is one
      if (this._internal.urlPath !== undefined) urlPath = _trimUrlPart(this._internal.urlPath) + '/' + urlPath;

      return {
        path: urlPath,
        query: query
      };
    },
    getNavigationAbsoluteURL(targetPage: ComponentPageInfo, pageParams: NavigateArgs['params']) {
      let parent = this.parent;
      let parentUrl = { path: '', query: [] };

      while (parent !== undefined && typeof parent.getNavigationAbsoluteURL !== 'function') {
        parent = parent.getVisualParentNode();
      }

      if (parent) {
        parentUrl = parent.getNavigationAbsoluteURL(parent._internal.currentPage, parent._internal.currentParams);
      }

      const thisUrl = this.getRelativeURL(targetPage, pageParams);
      if (thisUrl) {
        const haveForwardSlash = parentUrl.path.endsWith('/') || thisUrl.path.startsWith('/');
        return {
          path: parentUrl.path + (haveForwardSlash ? '' : '/') + thisUrl.path,
          query: parentUrl.query.concat(thisUrl.query)
        };
      }

      return parentUrl;
    },
    _getLocationPath: function () {
      const navigationPathType = NoodlRuntime.instance.getProjectSettings()['navigationPathType'];
      if (navigationPathType === undefined || navigationPathType === 'hash') {
        // Use hash as path
        let hash = location.hash;
        if (hash) {
          if (hash[0] === '#') hash = hash.substring(1);
          if (hash[0] === '/') hash = hash.substring(1);
        }
        return decodeURI(hash);
      } else {
        // Use url as path
        let path = location.pathname;
        if (path) {
          if (path[0] === '/') {
            const baseUrl = Noodl.Env['BaseUrl'];
            if (baseUrl) {
              const pathnameLength = getBaseUrlLength(baseUrl);
              path = path.substring(pathnameLength);
            } else {
              path = path.substring(1);
            }
          }
        }
        return decodeURI(path);
      }
    },
    _getSearchParams: function () {
      // Regex for replacing addition symbol with a space
      const pl = /\+/g;
      const search = /([^&=]+)=?([^&]*)/g;
      const decode = function (s) {
        return decodeURIComponent(s.replace(pl, ' '));
      };
      const query = location.search.substring(1);

      let match: RegExpExecArray;

      const urlParams = {};
      while ((match = search.exec(query))) urlParams[decode(match[1])] = decode(match[2]);

      return urlParams;
    },
    getNavigationRemainingPath() {
      return this._internal.remainingNavigationPath;
    },
    matchPageFromUrl() {
      // Attempt to find relative path from closest navigation parent
      let parent = this.parent;
      while (parent !== undefined && typeof parent.getNavigationRemainingPath !== 'function') {
        parent = parent.getVisualParentNode();
      }

      let pathParts = undefined;

      // Either use current browser location if we have no parent, or use remaining path
      // from parent
      if (parent === undefined) {
        let urlPath = this._getLocationPath();
        if (urlPath[0] === '/') urlPath = urlPath.substring(1);
        pathParts = urlPath.split('/');
      } else {
        pathParts = parent.getNavigationRemainingPath();
      }
      if (pathParts === undefined) return;

      const urlQuery = this._getSearchParams();

      function _matchPathParts(path, pattern) {
        const params = {};
        for (let i = 0; i < pattern.length; i++) {
          const _p = pattern[i];
          if (_p[0] === '{' && _p[_p.length - 1] === '}') {
            // This is a param, collect it
            if (path[i] !== undefined) {
              params[_p.substring(1, _p.length - 1)] = decodeURIComponent(path[i]);
            }
          } else if (path[i] === undefined || _p !== path[i]) return;
        }
        return {
          params: params,
          remainingPathParts: path.slice().splice(pattern.length) // Make copy
        };
      }

      const pages = RouterHandler.instance.getPagesForRouter(this._internal.name);
      if (pages === undefined || pages.length === 0) return;

      let matchedPage,
        bestMatchLength = 9999;
      for (const pageInfo of pages) {
        let pagePattern = pageInfo.path;
        if (pagePattern === undefined) continue;
        pagePattern = _trimUrlPart(pagePattern);

        // Prepend this routers url path if there is one
        if (this._internal.urlPath !== undefined)
          pagePattern = _trimUrlPart(this._internal.urlPath) + '/' + pagePattern;

        const pagePatternParts = pagePattern.split('/');
        const match = _matchPathParts(pathParts, pagePatternParts);

        const dist = Math.abs(pagePatternParts.length - pathParts.length);
        if (match && bestMatchLength > dist) {
          // This page is a match
          matchedPage = { match, pageInfo };
          bestMatchLength = dist;
        }
      }

      if (matchedPage) {
        this._internal.remainingNavigationPath = matchedPage.match.remainingPathParts;
        return {
          page: matchedPage.pageInfo,
          params: matchedPage.match.params,
          query: urlQuery
        };
      } else {
        return {
          page: undefined, // no matched page
          params: {},
          query: urlQuery
        };
      }
    },
    _getCompleteUrlToPage(page: ComponentPageInfo, pageParams: NavigateArgs['params']) {
      const url = this.getNavigationAbsoluteURL(page, pageParams);

      let urlPath, hashPath;
      const navigationPathType = NoodlRuntime.instance.getProjectSettings()['navigationPathType'];
      if (navigationPathType === undefined || navigationPathType === 'hash') {
        hashPath = url.path;
      } else {
        urlPath = url.path;
      }

      const query = url.query.map((q) => q.name + '=' + q.value);
      const compiledUrl =
        (urlPath !== undefined ? urlPath : '') +
        (query.length >= 1 ? '?' + query.join('&') : '') +
        (hashPath !== undefined ? '#' + hashPath : '');

      return compiledUrl;
    },
    _updateUrlWithTopPage() {
      // Push the state to the browser url. `window.history !== undefined` alone
      // would throw server-side — dereferencing window needs its own guard.
      if (typeof window !== 'undefined' && window.history !== undefined) {
        this._internal.remainingNavigationPath = undefined; // Reset remaining nav path

        const url = this._getCompleteUrlToPage(this._internal.currentPage, this._internal.currentParams);
        window.history.pushState({}, '', url);
      }
    },
    navigate(args) {
      this._internal.asyncQueue.enqueue(this.navigateAsync.bind(this, args));
    },
    /**
     * NDA-004 §2. Both early returns were bare, and the second carried the author's own
     * admission — `//TODO: send error to editor, "invalid page component name"`. A Navigate
     * node pointed at a component that is not a page of this router did nothing and said
     * nothing, in every runtime. The editor adapter's health warning
     * (`RouterNavigateAdapter.evaluateHealth`) is the *edit-time* half and does not travel,
     * and neither half gave the graph anything to sequence off.
     *
     * Reported through `args.hasFailed` for `navigation-stack`'s reason: the Router did not
     * fail, the Navigate node did, and it owns the `Failure` port and the provenance.
     */
    async navigateAsync(args: NavigateArgs) {
      if (args.target === undefined) {
        args.hasFailed && args.hasFailed('navigate/no-target-page', 'No Target Page is set on this Navigate node');
        return;
      }

      const newPage = RouterHandler.instance.getPageInfoForComponent(args.target);
      if (!newPage) {
        args.hasFailed &&
          args.hasFailed(
            'navigate/page-not-found',
            `"${args.target}" is not a page of this Router — check the Target Page against the Router's Pages`
          );
        return;
      }

      if (args.openInNewTab) {
        const url = this._getCompleteUrlToPage(newPage, args.params);
        if (typeof window !== 'undefined') {
          window.open(url, '_blank');
        }
        args.hasNavigated && args.hasNavigated();
      } else {
        await this._navigateInCurrentWindow(newPage, args);
      }
    },
    async _navigateInCurrentWindow(newPage: ComponentPageInfo, args: NavigateArgs) {
      this.scrollToTop();

      // Remove all current pages in the stack
      const children = this.getChildren();
      for (const i in children) {
        const c = children[i];
        this.removeChild(c);
        this.nodeScope.deleteNode(c);
      }

      const group = this.createPageContainer();

      // Create the page content
      const content = await this.nodeScope.createNode(args.target, guid());

      this._internal.currentPage = newPage;
      this._internal.currentParams = args.params;

      this.flagOutputDirty('currentPageTitle');
      this.flagOutputDirty('currentPageComponent');
      Noodl.SEO.setTitle(this._internal.currentPage.title);

      const pageInputNodes = content.nodeScope.getNodesWithType('PageInputs');
      if (pageInputNodes !== undefined && pageInputNodes.length > 0) {
        pageInputNodes.forEach((node) => {
          node._setPageParams(args.params);
        });
      }

      group.addChild(content);
      this.addChild(group);

      this._updateUrlWithTopPage();

      args.hasNavigated && args.hasNavigated();
      RouterHandler.instance.onNavigated(this._internal.name, newPage);
    },
    registerInputIfNeeded: function (name) {
      if (this.hasInput(name)) {
        return;
      }
    }
  }
};

function shallowObjectsEqual(object1, object2) {
  const keys1 = Object.keys(object1 || {});
  const keys2 = Object.keys(object2 || {});

  if (keys1.length !== keys2.length) {
    return false;
  }

  return keys1.every((key) => object1[key] === object2[key]);
}

export default createNodeFromReactComponent(RouterNode);
