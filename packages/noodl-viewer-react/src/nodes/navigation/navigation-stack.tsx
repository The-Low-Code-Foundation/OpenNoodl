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

/**
 * What a pop attempt did — NDA-008 §3.
 *
 * Returned rather than raised, because the Component Stack is not the node that failed: the
 * Pop Component Stack node was asked to act and could not, and it is the one carrying the
 * `Failure` port and the provenance an author can act on (Failure Contract).
 */
export type StackBackResult = { ok: true } | { ok: false; code: string; message: string };

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
  /** NDA-004 §2 — hand a dropped navigation back to the node that asked for it. */
  _reportNavigationFailure(args: StackNavigateArgs, code: string, message: string): void;
  /** NDA-008 §2 — whether this exact page-and-params is already the top of the stack. */
  _isAlreadyShowing(pageInfo: FoundPage, params: Record<string, unknown> | undefined): boolean;
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
  back(args: { backAction?: string; results?: Record<string, unknown> }): StackBackResult;
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
    flexDirection: 'column',
    // NDA-012 (Visual), DV-iii. `clip` declares `default: true` and its setter is the only thing
    // that writes `overflow`, but a declared default never runs its setter (FINDINGS DB-ii) — so
    // a stack whose panel read "Clip Content ✓" let a pushed component taller than itself spill
    // out. `defaultCss` is the route that *is* applied at initialize, so the declared default and
    // the rendered state now agree. Unticking the box still reaches `removeStyle(['overflow'])`,
    // which deletes from this same style object, so the round trip works.
    //
    // ⚠️ `Page Router` has the identical port shape and needs no equivalent: its default enum
    // value takes the `removeStyle` branch, a no-op on a node that never had the style. That
    // asymmetry is what makes this a defect rather than a pattern.
    overflow: 'hidden'
  },
  getReactComponent() {
    return PageStackReactComponent;
  },
  inputs: {
    name: {
      type: { name: 'string', identifierOf: 'PackStack' },
      displayName: 'Name',
      group: 'General',
      description: 'Name the Push and Pop nodes address this stack by; leave it as Main if there is only one',
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
      description: 'Puts the top component in the browser URL, so back and forward move through the stack',
      group: 'General',
      default: false,
      set: function (this: PageStackInstance, value) {
        this._internal.useRoutes = !!value;
      }
    },
    clip: {
      displayName: 'Clip Content',
      description: 'Clips a pushed component that is bigger than the stack',
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
      description: 'The components this stack can show, and which of them it starts on',
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
      description: 'Empties the stack and rebuilds the start component',
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
      description: 'Fill colour behind whichever component is showing',
      group: 'Style',
      default: 'transparent',
      applyDefault: false
    }
  },
  outputs: {
    topPageName: {
      type: 'string',
      displayName: 'Top Component Name',
      description: 'Name of the component currently on top of the stack',
      group: 'General',
      get(this: PageStackInstance) {
        return this._internal.topPageName;
      }
    },
    stackDepth: {
      type: 'number',
      displayName: 'Stack Depth',
      description: 'How many components are on the stack, so 1 means only the start component',
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
    /**
     * NDA-004 §2. Deliberately does *not* fall back to raising on this node when the caller
     * supplied no `hasFailed`: the only such caller is a project's own JavaScript
     * (`Noodl.Navigation`), and attributing its mistake to whichever Component Stack happened
     * to receive it would put the diagnosis on a node the author did not write.
     */
    _reportNavigationFailure(this: PageStackInstance, args: StackNavigateArgs, code: string, message: string) {
      args.hasFailed && args.hasFailed(code, message);
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
    /**
     * Is the requested page, with these params, already the top of the stack? — NDA-008 §2.
     *
     * Using a Component Stack for internal tabs is the common case, and re-selecting the
     * current tab used to **re-mount it**: measured, `navigate` created a fresh component *and*
     * pushed a duplicate stack entry (depth 1 → 2), and `replace` created a fresh one and
     * destroyed the old. Either way the tab's state was lost on a click that should have done
     * nothing, and push additionally grew a stack that Back then had to walk back through.
     *
     * **Params are part of the question, and that is what keeps this safe.** "Same component"
     * alone would have broken the ordinary stack idiom — master → detail(id=1) → detail(id=2)
     * is the same component three times and must keep pushing. Only a request that would
     * reproduce the state already on screen is skipped.
     *
     * Comparison is shallow and by identity, deliberately. Params are port values and may be
     * arbitrary objects; a deep compare would be both expensive and wrong (two structurally
     * equal Models are not interchangeable). Shallow-unequal falls through to today's exact
     * behaviour, so every uncertain case stays as it was.
     */
    _isAlreadyShowing(
      this: PageStackInstance,
      pageInfo: FoundPage,
      params: Record<string, unknown> | undefined
    ): boolean {
      const stack = this._internal.stack;
      if (!stack || stack.length === 0) return false;

      const top = stack[stack.length - 1];
      if (!top || !top.pageInfo || top.pageInfo.id !== pageInfo.id) return false;

      const a = top.params || {};
      const b = params || {};

      const aKeys = Object.keys(a);
      const bKeys = Object.keys(b);
      if (aKeys.length !== bKeys.length) return false;

      for (let i = 0; i < aKeys.length; i++) {
        const key = aKeys[i];
        if (!Object.prototype.hasOwnProperty.call(b, key)) return false;
        if (a[key] !== b[key]) return false;
      }

      return true;
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
      // `.slice()` for the same reason as in `replaceAsync`: `getChildren()` is the live array,
      // and removing while iterating it by index skips every other child. Reset is the initial
      // mount and deliberately has no transition — the app's first paint should not animate.
      const children = this.getChildren().slice();
      for (const c of children) {
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
    /**
     * NDA-008 §1 — one mechanism, two policies.
     *
     * Replace used to have no animation *surface at all*: it deleted every current page before
     * the new one existed, so there was never anything to transition from, and the entry it
     * pushed carried no `transition`. That is the split Richard called sad — you picked your
     * semantics and the animation capability came bundled with the choice, rather than being an
     * independent axis.
     *
     * Now replace is "push, then drop the previous entries once the transition completes",
     * which is `navigateAsync` with one difference: the outgoing pages do not stay in the
     * stack. Same `Transitions` registry, same `tr-…` params, same `isTransitioning` gate.
     *
     * **The default stays `None`, so no existing project starts animating.** Push's default is
     * `Push`; matching it here would silently add an animation to every replace already out
     * there. An author who wants one now picks it — see the mode-aware port default in
     * `navigate.ts`.
     */
    async replaceAsync(this: PageStackInstance, args: StackNavigateArgs) {
      // NDA-004 §2 — the same three, in the same order, for the same reason. See `navigateAsync`.
      if (this._internal.pages === undefined || this._internal.pages.length === 0) {
        return this._reportNavigationFailure(
          args,
          'push-component-stack/stack-has-no-components',
          `The Component Stack "${this._internal.name || 'Main'}" has no components to show — its Components list is empty`
        );
      }

      if (this._internal.isTransitioning) {
        return this._reportNavigationFailure(
          args,
          'push-component-stack/stack-transitioning',
          'The Component Stack is still animating the previous navigation — this one was dropped'
        );
      }

      const pageId = args.target || this._internal.pages[0].id;

      // Find the page by either ID or by Label
      const pageInfo = this._findPage(pageId);
      if (pageInfo === undefined || pageInfo.component === undefined) {
        // No page was found
        return this._reportNavigationFailure(
          args,
          'push-component-stack/component-not-found',
          `The Component Stack "${this._internal.name || 'Main'}" has no component "${pageId}" — check the Target Page against its Components list`
        );
      }

      // NDA-008 §2 — as in `navigateAsync`, but with one extra condition that matters.
      //
      // Replace's post-condition is "the stack is one deep, showing the target". A no-op is
      // only correct when that is *already* true. With a deeper stack, replace still has
      // collapsing to do even though the top page is right, so it must proceed — skipping
      // there would silently leave entries the author asked to be rid of. The tab case, which
      // is what §2 is about, is depth 1 by construction and lands on the no-op.
      if (this._internal.stack.length === 1 && this._isAlreadyShowing(pageInfo, args.params)) {
        args.hasNavigated && args.hasNavigated();
        return;
      }

      // `.slice()`: `getChildren()` hands back the live array, so removing while iterating it
      // skips every other entry. Harmless while a stack had one visible child, wrong the moment
      // it has two — and the animated path below genuinely needs the whole snapshot.
      const outgoing = this.getChildren().slice();
      const from = this._internal.stack.length > 0 ? this._internal.stack[this._internal.stack.length - 1].page : null;

      const transitionType = (args.transition && args.transition.type) || 'None';
      const willAnimate = !!from && transitionType !== 'None' && !!Transitions[transitionType];

      const dropOutgoing = () => {
        for (const child of outgoing) {
          this.removeChild(child);
          this.nodeScope.deleteNode(child);
        }
      };

      // Unanimated replace keeps its original ordering exactly — tear down first, then build —
      // so the two pages are never children at the same time and cannot flash side by side.
      if (!willAnimate) dropOutgoing();

      const group = this.createPageContainer();
      if (willAnimate) group.setInputValue('position', 'absolute');

      // Create the page content
      const content = (await this.nodeScope.createNode(pageInfo.component, guid())) as ReactNodeInstance;
      for (const key in args.params) {
        content.setInputValue(key, args.params[key]);
      }
      group.addChild(content);

      const transition = willAnimate
        ? new Transitions[transitionType](from as ReactNodeInstance, group, args.transition)
        : undefined;

      // Replace stack. `from: null` regardless: whatever was showing is on its way out, so
      // there is nothing above this entry to go back to — that is what makes this a replace.
      this._internal.stack = [
        {
          from: null,
          page: group,
          pageId: pageId,
          pageInfo: pageInfo,
          params: args.params,
          componentName: args.target,
          transition: transition
        }
      ];

      this.setPageOutputs({
        topPageName: pageInfo.label,
        stackDepth: this._internal.stack.length
      });

      this._updateUrlWithTopPage();

      if (transition) {
        transition.forward(0);

        this._internal.isTransitioning = true;
        transition.start({
          end: () => {
            this._internal.isTransitioning = false;

            // The only difference from `navigateAsync`: the outgoing pages are destroyed
            // rather than kept below the new top.
            dropOutgoing();
            group.setInputValue('position', 'relative');
          }
        });
      }

      this.addChild(group);

      args.hasNavigated && args.hasNavigated();
    },
    navigate(this: PageStackInstance, args: StackNavigateArgs) {
      this._internal.asyncQueue.enqueue(this.navigateAsync.bind(this, args));
    },
    /**
     * NDA-004 §2 — the three bare returns below were the Pop node's three, unfixed.
     *
     * A push that lands on any of them does nothing and says nothing, which from the canvas
     * is a dead button. The third is the one an author hits first: `target` is an *enum*
     * input and a wire can feed an enum any string at all (the States lesson), so a page
     * renamed in the editor while something upstream still spells it the old way silently
     * stops navigating.
     *
     * Reported through `args.hasFailed` rather than raised here, for `back()`'s reason: this
     * stack did not fail, the Push Component To Stack node was asked to act and could not,
     * and it is the one carrying the `Failure` port and the provenance.
     */
    async navigateAsync(this: PageStackInstance, args: StackNavigateArgs) {
      if (this._internal.pages === undefined || this._internal.pages.length === 0) {
        return this._reportNavigationFailure(
          args,
          'push-component-stack/stack-has-no-components',
          `The Component Stack "${this._internal.name || 'Main'}" has no components to show — its Components list is empty`
        );
      }

      if (this._internal.isTransitioning) {
        return this._reportNavigationFailure(
          args,
          'push-component-stack/stack-transitioning',
          'The Component Stack is still animating the previous navigation — this one was dropped'
        );
      }

      const pageId = args.target || this._internal.pages[0].id;

      // Find the page by either ID or by Label
      const pageInfo = this._findPage(pageId);
      if (pageInfo === undefined || pageInfo.component === undefined) {
        // No page was found
        return this._reportNavigationFailure(
          args,
          'push-component-stack/component-not-found',
          `The Component Stack "${this._internal.name || 'Main'}" has no component "${pageId}" — check the Target Page against its Components list`
        );
      }

      // NDA-008 §2 — re-selecting the current page is a no-op, not a re-mount *and* a duplicate
      // stack entry. `hasNavigated` still fires: the request was satisfied, the stack is showing
      // exactly what was asked for, and swallowing the completion callback here would turn a
      // re-selected tab into a dead button — the failure this phase exists to remove.
      if (this._isAlreadyShowing(pageInfo, args.params)) {
        args.hasNavigated && args.hasNavigated();
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
    /**
     * Pop the top of the stack, and **say what happened** — NDA-008 §3 / NDA-004 §2.
     *
     * Both early returns below were bare. A Pop Component Stack node asked to pop the root of
     * the stack, or asked twice while a transition was still running, did nothing and reported
     * nothing — indistinguishable from a broken Back button. The second case is the one authors
     * actually hit: a double-tapped back button silently loses its second tap.
     *
     * The outcome is returned rather than raised here, because *this* node did not fail — the
     * Pop Component Stack node did, and it is the one that owns the `Failure` port and the
     * provenance an author needs. See `navigate-back.ts`.
     */
    back(
      this: PageStackInstance,
      args: { backAction?: string; results?: Record<string, unknown> }
    ): StackBackResult {
      if (this._internal.stack.length <= 1) {
        return { ok: false, code: 'pop-component-stack/stack-at-root', message: 'Nothing to pop — the Component Stack is already showing its first component' };
      }
      if (this._internal.isTransitioning) {
        return { ok: false, code: 'pop-component-stack/transition-in-progress', message: 'Ignored — the Component Stack is still animating the previous navigation' };
      }

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

      return { ok: true };
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
