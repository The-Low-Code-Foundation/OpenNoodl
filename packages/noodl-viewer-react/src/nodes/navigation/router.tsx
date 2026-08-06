import React, { useEffect } from 'react';
import NoodlRuntime from '@noodl/runtime';
import { outcomeOutputs } from '@noodl/runtime/src/outcome';
import type { NodeOutcome, OutcomeFailureOptions, OutcomeToken } from '@noodl/types';

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

/**
 * NDA-012 (Visual) D1 — decode one path segment, exactly once, and never throw.
 *
 * The path used to be decoded **twice, by two different rules**: `_getLocationPath` ran
 * `decodeURI` over the whole location, and `_matchPathParts` then ran `decodeURIComponent` over
 * each captured parameter. The two are not the same function — `decodeURI` deliberately leaves
 * the reserved set (`; / ? : @ & = + $ , #`) encoded and decodes everything else.
 *
 * ⚠️ The worksheet recorded this as "decoded twice and by two different rules". The consequence
 * is sharper than that: it **throws**. `Navigate` encodes a parameter with
 * `encodeURIComponent`, so a value containing a literal `%` leaves as `a%25b`; `decodeURI`
 * turns that into `a%b` because `%25` is not reserved; and `decodeURIComponent('a%b')` raises
 * `URIError: URI malformed`. A page parameter with a `%` in it therefore took the router's
 * whole match down, uncaught. `decodeURI` itself throws the same way on a hand-typed or
 * truncated URL (`/%zz`) — a bad address bar entry, not an author mistake at all.
 *
 * Decoding *after* the split is also what makes `%2F` mean what it was encoded to mean: a
 * literal slash **inside** a parameter rather than a segment boundary.
 *
 * Undecodable input is carried through as written rather than thrown or dropped. A segment that
 * cannot be decoded simply will not match a page pattern, which is the correct outcome for a
 * malformed URL — and the router reports the miss through its own `router/page-not-found` path.
 */
function _decodePathSegment(segment: string): string {
  try {
    return decodeURIComponent(segment);
  } catch (e) {
    return segment;
  }
}

/**
 * NDA-012 (Visual) A2 — a copy of the page info as it was when the page was built.
 *
 * `RouterHandler.getPageInfoForComponent` hands back the live entry from
 * `graphModel.routerIndex.pages`. Holding that reference as "the current page" means an
 * in-place edit changes what the router *thinks it rendered* retroactively, so no comparison
 * against it can detect the edit. Three flat strings; a copy is all it takes.
 */
function _snapshotPageInfo(pageInfo: ComponentPageInfo | undefined) {
  if (pageInfo === undefined) return undefined;
  return { path: pageInfo.path, title: pageInfo.title, component: pageInfo.component };
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

/**
 * AAQ-011 **F9** — every diagnosis `resetAsync` can reach, in one list, so the clear can name
 * them all.
 *
 * The editor's warning subscriber (`runtimeerror.ts::createEditorWarningSubscriber`) keys a
 * warning by the raised **`code`**, so a clear must spell the same string the raise did — the
 * lesson `dbmodelcrudbase.clearWarnings` records after a `clearWarning` naming the wrong key
 * left every Record node holding a warning it could never shed. Adding a fifth `_reportReset`
 * failure without adding it here reinstates F9 for that code, which is why the list sits beside
 * the node rather than inside the method that raises.
 */
const RESET_DIAGNOSIS_CODES = [
  'router/no-pages',
  'router/no-start-page',
  'router/page-not-found',
  'router/component-is-not-a-page'
] as const;

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
        // ERG-001 §4. The token is minted **here and only here**, because this is the only
        // caller of `scheduleReset` that is an author asking for a reset. See `scheduleReset`.
        this.scheduleReset(this.beginOutcome());
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
    // ERG-001 §4 / OUTCOME-CONTRACT.md. §0.3 recorded this node as emitting **nothing at all**:
    // `router.tsx` had zero `sendSignalOnOutput` calls, so a graph could not sequence anything
    // after a `Reset` and could not tell a rebuild from a drop.
    ...outcomeOutputs({
      done: 'Fires once the page has been rebuilt, or its Page Inputs updated with new parameters',
      unchanged:
        'Fires when the Router is already showing that page with those parameters, so nothing needed rebuilding',
      failure:
        'Fires when the Router has no Pages, no start page, a start page it does not serve, or a routed component that is not a page'
    }),
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
    /**
     * ERG-001 §4 — **the token is optional, and that is the design.**
     *
     * `scheduleReset` has four callers and only one of them is the author's `Reset` port. The
     * `pages` setter calls it, `popstate`/`hashchange` call it, and — the one that matters —
     * `RouterHandler.registerRouter` calls `reset()` directly on mount so the start page is
     * created (`router-handler.ts:83`). A mount that reported `Done` would pulse every chain in
     * the app at boot, which is worse than the silence this contract exists to remove.
     *
     * So an invocation without a token reports nothing and still raises its diagnosis; see
     * `_reportReset`.
     *
     * ⚠️ Tokens are collected in a **list**, not overwritten. Two `Reset` pulses in one frame
     * coalesce into one rebuild, and Undo's lesson from Build 2b applies here too: coalescing
     * the work is right, coalescing the outcomes loses an invocation the author made.
     */
    scheduleReset(outcome?: OutcomeToken) {
      const internal = this._internal;
      if (outcome !== undefined) {
        if (internal.pendingResetOutcomes === undefined) internal.pendingResetOutcomes = [];
        internal.pendingResetOutcomes.push(outcome);
      }

      if (!internal.hasScheduledReset) {
        internal.hasScheduledReset = true;
        this.scheduleAfterInputsHaveUpdated(() => {
          internal.hasScheduledReset = false;
          const outcomes = internal.pendingResetOutcomes;
          internal.pendingResetOutcomes = undefined;
          this.reset(outcomes);
        });
      }
    },
    /**
     * AAQ-011 **F9** — withdraw every reset diagnosis this pass did *not* reach.
     *
     * A raise is an **event**; the editor turns it into a **warning**, which is a predicate, and
     * nothing in this file ever said the predicate had stopped being true. So a Page Router that
     * was momentarily unconfigured — the mount that runs before its `pages` parameter lands, which
     * is the ordinary shape of an apply that streams `createNode` before `setParameter` — kept
     * *"This Router has no Pages configured"* for the life of the editor session, on a router
     * showing all three of its pages. `⚠ 1`, permanent, false, on every wizard-built app.
     *
     * ⚠️ **`keep` is why this is not "clear on success".** Clearing only when the reset succeeds
     * would leave a router that is *genuinely* empty warned — correct — but so would clearing
     * unconditionally and re-raising, at the cost of a clear/show round trip on every reset. This
     * withdraws the three codes that are now false and leaves the one being raised alone, so a
     * persistent misconfiguration never flickers and never has its warning re-sent
     * (`sendWarning` deduplicates on `activeWarnings`, so a re-raise after a clear *is* a second
     * message the editor has to process).
     *
     * Editor-only by construction: `clearWarning` exists only on the editor connection, and a
     * deployed app has none. Every hop is guarded because this method also runs under the unit
     * harnesses, which build a bare instance with no `context` and no `componentOwner`.
     */
    _clearResetWarnings(keep?: string) {
      const editorConnection = this.context && this.context.editorConnection;
      if (!editorConnection || typeof editorConnection.clearWarning !== 'function') return;

      const componentOwner = this.nodeScope && this.nodeScope.componentOwner;
      const component = componentOwner && componentOwner.name;
      if (!component) return;

      for (const code of RESET_DIAGNOSIS_CODES) {
        if (code !== keep) editorConnection.clearWarning(component, this.id, code);
      }
    },
    /**
     * End a `Reset` invocation — or, on the mount path, end none.
     *
     * ⚠️ The four `failure` paths below each **already** called `raiseRuntimeError` (NDA-012).
     * `reportOutcome` raises too, so the raise moved *into* it rather than sitting beside it —
     * leave both and one drop puts two events on the error channel.
     *
     * The clear runs **before** either branch and for *every* outcome, not just the successful
     * ones: `done`, `unchanged` and a failure with a *different* code all mean the previous
     * diagnosis is no longer true. `unchanged` is included deliberately — `Treat Unchanged as`
     * can remap it to a failure carrying `outcome/unchanged-as-failure`, which is not a reset
     * diagnosis, so the router's own codes are stale either way.
     */
    _reportReset(outcomes: OutcomeToken[] | undefined, outcome: NodeOutcome, options?: OutcomeFailureOptions) {
      this._clearResetWarnings(outcome === 'failure' && options ? options.code : undefined);

      if (outcomes === undefined || outcomes.length === 0) {
        // No author invocation to report to. The diagnosis still belongs on the channel: an
        // unconfigured Page Router is diagnosed on mount, which is the only time anyone sees it.
        if (outcome === 'failure' && options) {
          this.raiseRuntimeError(options.code, options.message);
        }
        return;
      }

      for (const token of outcomes) this.reportOutcome(token, outcome, options);
    },
    createPageContainer() {
      const group = this.nodeScope.createPrimitiveNode('Group');
      group.setStyle({ flex: '1 0 100%' });
      return group;
    },
    reset(outcomes?: OutcomeToken[]) {
      this._internal.asyncQueue.enqueue(this.resetAsync.bind(this, outcomes));
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
     * ✅ **The outcome ports arrived with ERG-001 §4.** Each of the four raise-and-return paths
     * below now carries the code it already raised through `reportOutcome`, and the successful
     * path reports `Done`. ⚠️ `outcomes` is `undefined` on the mount path — see `scheduleReset`.
     */
    async resetAsync(outcomes?: OutcomeToken[]) {
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
          this._reportReset(outcomes, 'failure', {
            code: 'router/no-pages',
            message:
              'This Router has no Pages configured, so it has nothing to show — add the components it should route between to its Pages list'
          });
        } else {
          this._reportReset(outcomes, 'failure', {
            code: 'router/no-start-page',
            message: 'This Router has no start page, so it has nothing to show on load — pick one in its Pages list'
          });
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
        this._reportReset(outcomes, 'failure', {
          code: 'router/page-not-found',
          message: `"${component}" is not a page of this Router, so it cannot be shown — check the Router's Pages list`
        });
        return;
      }

      /**
       * NDA-012 (Visual) A2. "Am I already showing this page?" — asked against a *snapshot*.
       *
       * This was `this._internal.currentPage === targetPage`, and the worksheet filed it as an
       * identity-versus-value comparison. ⚠️ **Comparing by value would have fixed nothing.**
       * `getPageInfoForComponent` returns the entry straight out of
       * `graphModel.routerIndex.pages`, and `currentPage` was assigned that same object — so
       * editing a page's path or title *in place* mutates both sides of the comparison at once.
       * Identity and value agree, and both say "no change", because there is only one object.
       *
       * The missing ingredient was never the comparison operator, it was a record of what was
       * actually rendered. `currentPageSnapshot` is a copy taken at render time, so an in-place
       * edit moves the index and leaves the snapshot behind, and an explicit `Reset` sees the
       * difference and rebuilds. Same reason a title-only edit now re-runs `Noodl.SEO.setTitle`.
       */
      if (shallowObjectsEqual(this._internal.currentPageSnapshot, _snapshotPageInfo(targetPage))) {
        //already at the correct page, keep the current page
        //update page inputs if they have changed
        //TODO: fix if a parameter goes from a value to undefined, the old value will still exist in the connection from previous navigation
        //
        // ERG-001 §4 — the split between `Done` and `Unchanged` is here, and it is the
        // parameters that decide it. "`Done`: the action happened and changed something."
        // Updating the Page Inputs *is* a change, and a graph wiring `Done -> refetch` wants
        // the pulse; a reset onto the identical page with identical parameters genuinely did
        // nothing, and that is the case §0.3 collects.
        if (!shallowObjectsEqual(this._internal.currentParams, params)) {
          this._internal.currentParams = params;
          this._updatePageInputs(this._internal.currentPageComponent.nodeScope, params);
          this._reportReset(outcomes, 'done');
        } else {
          this._reportReset(outcomes, 'unchanged');
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
        this._internal.currentPageSnapshot = undefined;
        this._internal.currentPageComponent = undefined;
        this.flagOutputDirty('currentPageComponent');

        this._reportReset(outcomes, 'failure', {
          code: 'router/component-is-not-a-page',
          message: `"${component}" cannot be shown by this Router: a routed component must contain exactly one Page node, and this one has ${
            pageNodes === undefined || pageNodes.length === 0 ? 'none' : pageNodes.length
          }`
        });
        return;
      }

      this._internal.currentPageComponent = content;
      this._internal.currentPage = targetPage;
      this._internal.currentPageSnapshot = _snapshotPageInfo(targetPage);
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

      // Last, after the page is on screen and its outputs are flagged — "the outcome is the last
      // thing an action does" is the phase's most-repeated defect shape, closed here by placement.
      this._reportReset(outcomes, 'done');
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
    /**
     * The location path, **still encoded**. See `_decodePathSegment`: decoding happens once,
     * per segment, after the split — not here over the whole path, which both double-decoded
     * parameters and threw on a malformed escape before any of this could be caught.
     */
    _getLocationPath: function () {
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
        return path;
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
        // Split first, decode second — one decode per segment (`_decodePathSegment`). A nested
        // router receives already-decoded parts from its parent below and must not decode
        // again, which is the same double-decode seen from the other end.
        pathParts = urlPath.split('/').map(_decodePathSegment);
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
            // This is a param, collect it. Already decoded once by `_decodePathSegment` at the
            // split; decoding here as well is what turned an encoded `%` into a `URIError`.
            if (path[i] !== undefined) {
              params[_p.substring(1, _p.length - 1)] = path[i];
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
    /**
     * ERG-001 §4 / NDA-008 §2 — **re-selecting the page already showing is a no-op.**
     *
     * ⚠️ §0.3 filed "`RouterNavigate` — Navigate to the current page" against `router.tsx`'s
     * already-showing branch, and that branch is in **`resetAsync`**, not here. Measured: this
     * method had no such check at all. A Navigate to the page already on screen destroyed the
     * page component and built a fresh one — losing its state on a click that should have done
     * nothing. That is NDA-008 §2's Component Stack finding, unfixed on the Router side, and
     * §0.3's verdict was right about the node and wrong about the mechanism.
     *
     * Parameters are part of the question, for NDA-008 §2's reason: `/product/{id}` navigated
     * to twice with different ids is the same page and must still rebuild.
     *
     * This is also the path the contract's navigation exception is *about*. It does not leave
     * the page, so the graph that asked is still there to hear `Unchanged`.
     */
    async _navigateInCurrentWindow(newPage: ComponentPageInfo, args: NavigateArgs) {
      if (
        shallowObjectsEqual(this._internal.currentPageSnapshot, _snapshotPageInfo(newPage)) &&
        shallowObjectsEqual(this._internal.currentParams, args.params)
      ) {
        args.hasUnchanged && args.hasUnchanged();
        return;
      }

      await this._buildPage(newPage, args);
    },
    async _buildPage(newPage: ComponentPageInfo, args: NavigateArgs) {
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
      this._internal.currentPageSnapshot = _snapshotPageInfo(newPage);
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
