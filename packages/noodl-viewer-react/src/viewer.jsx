import React from 'react';

import { NoHomeError } from './components/common/NoHomeError';
import GraphWarnings from './graph-warnings';
import { Highlighter } from './highlighter';
import { bindInputInjector } from './inputinjector';
import Inspector from './inspector';
import NoodlJSAPI from './noodl-js-api';
import projectSettings from './project-settings';
import { createNodeFromReactComponent } from './react-component-node';
import registerNodes from './register-nodes';
import Styles from './styles';

if (typeof window !== 'undefined' && window.NoodlEditor) {
  window.NoodlEditorInspectorAPI = {
    enabled: false,
    inspector: null,
    setInspector(inspector) {
      this.inspector = inspector;
      this.enabled ? this.inspector.enable() : this.inspector.disable();
    },
    setEnabled(enabled) {
      this.enabled = enabled;
      if (this.inspector) {
        this.enabled ? this.inspector.enable() : this.inspector.disable();
      }

      if (window.NoodlEditorHighlightAPI.highlighter) {
        window.NoodlEditorHighlightAPI.highlighter.setWindowSelected(enabled);
        // FB-016 — the box model overlay is design mode's, and only design mode's. Selection is
        // pushed across this bridge in preview mode too, so the highlighter cannot infer it.
        window.NoodlEditorHighlightAPI.highlighter.setDesignMode(enabled);
      }
    }
  };

  window.NoodlEditorHighlightAPI = {
    highlighter: null,
    setHighlighter(highlighter) {
      this.highlighter = highlighter;

      this.highlighter.setWindowSelected(window.NoodlEditorInspectorAPI.enabled);
      this.highlighter.setDesignMode(window.NoodlEditorInspectorAPI.enabled);
    },
    selectNode(nodeId) {
      this.highlighter.deselectNodes();

      if (nodeId && nodeId !== 'null') {
        this.highlighter.selectNodesWithId(nodeId);
      } else if (window.NoodlEditorInspectorAPI.enabled) {
        this.highlighter.setWindowSelected(true);
      }
    },
    /**
     * FB-016 scope 4 — the crosshair follows focus on the editor's transform-origin field, and
     * only the editor can know that. Everything else in the overlay is inferable from the DOM the
     * viewer already has; this one fact is not, so it is pushed.
     */
    setTransformOriginFocus(enabled) {
      if (this.highlighter) {
        this.highlighter.setTransformOriginFocus(enabled);
      }
    }
  };
}

/**
 * ✅ **D20** — register one kit, and if it throws, lose that kit and nothing else.
 *
 * 🔴 **The failure this ends, exactly as it was hit.** A kit logic node with no `category` threw
 * out of `registerModule`, the loop below aborted, and **the whole viewer rendered nothing** —
 * `reactMounted: false`, `rootChildren: 0`. One missing field in one node of one kit took down the
 * entire preview, and the editor's node library then read *empty* because the viewer had died,
 * which looks like a second fault and is not one.
 *
 * ⚠️ **`registerModule` still throws, deliberately** — the cloud loader and the MCP kit extractor
 * both read that throw to report a broken kit, and silencing it would leave both calling a broken
 * kit healthy. It is atomic now, so what arrives here is a kit that registered *nothing*, never a
 * half-registered one.
 *
 * 🔴 **Skipping silently would be strictly worse than the blank screen**: it replaces a failure the
 * author cannot miss with a missing node they will blame on a typo. So the caller must do something
 * with what this returns — the browser path puts it on CN-015's channel to Settings → Kits.
 *
 * @returns {null | { module: string, reason: string, message: string }} the failure, or null
 */
function registerModuleIsolated(noodlRuntime, module) {
  if (module.reactNodes) {
    const reactNodes = [];
    for (const nodeDefinition of module.reactNodes) {
      reactNodes.push(createNodeFromReactComponent(nodeDefinition));
    }
    const nodes = module.nodes || [];
    module.nodes = nodes.concat(reactNodes);
  }

  try {
    noodlRuntime.registerModule(module);
    return null;
  } catch (e) {
    const message = e && e.message ? e.message : String(e);
    /*
     * `registerModule` has already named the kit and the node (CN-015), so the sentence is passed
     * through rather than rebuilt.
     *
     * ⚠️ **The consequence clause is added only when the message does not already carry one.**
     * `defineNode`'s own hint ends *"The rest of the app still runs."*, and appending unconditionally
     * printed both — observed on the console during the s29 drive:
     * *"…The rest of the app still runs. The rest of the app is unaffected."* Same shape as the
     * "do not say the kit twice" rule one layer down, and it needs the same guard. The clause still
     * has a population: a throw from a definition's `setup` carries no consequence sentence at all.
     */
    const consequence = /rest of the app/i.test(message) ? '' : ' The rest of the app is unaffected.';
    console.error(`${message}${consequence}`);
    return { module: module.name || 'Unknown Module', reason: 'registration-failed', message };
  }
}

export function ssrSetupRuntime(noodlRuntime, noodlModules, projectData) {
  registerNodes(noodlRuntime);

  // Noodl static API
  NoodlJSAPI(noodlRuntime);

  noodlRuntime.setProjectSettings(projectSettings);

  // Register module nodes. ✅ D20 — a kit that throws costs its own nodes; the page still renders.
  // There is no editor to report to on a server render, so the console is the whole surface, and
  // `kit-modules.js` has already warned about the kits that never got this far.
  if (noodlModules) {
    for (const module of noodlModules) {
      registerModuleIsolated(noodlRuntime, module);
    }
  }

  const styles = new Styles({
    graphModel: noodlRuntime.graphModel,
    getNodeScope: () => noodlRuntime.context.rootComponent && noodlRuntime.context.rootComponent.nodeScope,
    nodeRegister: noodlRuntime.context.nodeRegister
  });

  //make the styles available to all nodes via `this.context.styles`
  noodlRuntime.context.styles = styles;

  // The load is async (bundle fetches, root component creation). The SSR server
  // doesn't await it — it waits for 'rootComponentUpdated' and settles — but the
  // client hydration path must, so it can render the settled tree synchronously
  // into hydrateRoot. _disableLoad makes the Viewer constructor's own setData a
  // no-op (it only guards the entry, not this already-running call).
  const dataLoaded = noodlRuntime.setData(projectData);
  noodlRuntime._disableLoad = true;
  return dataLoaded;
}

export default class Viewer extends React.Component {
  constructor(props) {
    super(props);

    this.state = {
      popups: []
    };

    const { noodlRuntime } = props;
    this.runningDeployed = this.props.projectData !== undefined;
    this.focusedNoodlNodes = [];

    noodlRuntime.context.setNodeFocused = this.setNodeFocused.bind(this);

    const enableDebugInspectors =
      (typeof document !== 'undefined' && document.location.href.indexOf('forceDebugger=true') !== -1) ||
      Noodl.enableDebugInspectors;
    noodlRuntime.setDebugInspectorsEnabled(enableDebugInspectors);

    noodlRuntime.context.setPopupCallbacks({
      onShow: (popup) => {
        const newPopupArray = this.state.popups.concat([popup]);

        const bodyScroll = noodlRuntime.getProjectSettings().bodyScroll;

        //Disable body scroll when showing a popup
        if (bodyScroll && newPopupArray.length === 1) {
          document.body.style.width = document.body.clientWidth + 'px';
          document.body.style.top = `-${window.scrollY}px`;
          document.body.style.position = 'fixed';
        }

        this.setState({
          popups: newPopupArray
        });
      },
      onClose: (popup) => {
        const newPopupArray = this.state.popups.filter((p) => p !== popup);

        this.setState({
          popups: newPopupArray
        });

        const bodyScroll = noodlRuntime.getProjectSettings().bodyScroll;

        //Enable body scroll when hiding all popups
        if (bodyScroll && newPopupArray.length === 0) {
          const scrollY = document.body.style.top;
          document.body.style.position = '';
          document.body.style.top = '';
          document.body.style.width = '100%';
          window.scrollTo(0, parseInt(scrollY || '0') * -1);
        }
      }
    });

    registerNodes(noodlRuntime);

    // Noodl static API
    NoodlJSAPI(noodlRuntime);

    noodlRuntime.setProjectSettings(projectSettings);

    // Register module nodes. ✅ D20 — one kit's throw costs that kit and nothing else.
    const registrationFailures = [];
    if (this.props.noodlModules) {
      for (const module of this.props.noodlModules) {
        const failure = registerModuleIsolated(noodlRuntime, module);
        if (failure) registrationFailures.push(failure);
      }
    }

    // 🔴 CN-015 — the kits that are NOT in the loop above.
    //
    // Everything registered here is a kit that loaded. A kit whose `index.js`
    // threw, failed to parse or 404'd never called `Noodl.defineModule`, so it
    // is simply absent from `noodlModules` — and absent is exactly what an
    // uninstalled kit looks like too. The page recorded the difference while it
    // was loading (`@nodegx/module-inject`'s capture preamble); this hands that
    // record to the runtime so `sendNodeLibrary` carries it to the editor,
    // which otherwise has no way to learn it (✅ D3).
    //
    // ✅ **D20 adds the second half of the same list.** A kit whose script *ran* and then threw in
    // `registerModule` is the opposite case: it is present in `noodlModules` and absent from the
    // node register. Both are "this kit is installed and its nodes are not here", both belong on
    // one channel, and `getModuleFailures` deduplicates by kit name — a kit cannot be in both
    // halves, because a script that threw never called `Noodl.defineModule` at all.
    if (noodlRuntime.setModuleFailures) {
      const loadFailures = (typeof window !== 'undefined' && window.__noodl_module_failures) || [];
      // ⚠️ `[]` rather than `undefined` is safe: `getNodeLibrary` omits the field entirely when the
      // list is empty, so a healthy project's payload is byte-identical to what it was.
      noodlRuntime.setModuleFailures(loadFailures.concat(registrationFailures));
    }

    noodlRuntime.eventEmitter.on('rootComponentUpdated', () => {
      //wait until next frame to trigger a react update, so inputs etc have a chance to settle
      //(forceUpdate is synchronous)
      requestAnimationFrame(() => this.forceUpdate());
    });

    noodlRuntime.graphModel.on('projectSettingsChanged', (settings) => {
      // Suppport SSR
      if (typeof document === 'undefined') return;

      if (settings.bodyScroll) {
        document.body.classList.add('body-scroll');
      } else {
        document.body.classList.remove('body-scroll');
      }
    });

    this.styles = new Styles({
      graphModel: noodlRuntime.graphModel,
      getNodeScope: () => noodlRuntime.context.rootComponent && noodlRuntime.context.rootComponent.nodeScope,
      nodeRegister: noodlRuntime.context.nodeRegister
    });

    //make the styles available to all nodes via `this.context.styles`
    noodlRuntime.context.styles = this.styles;

    this.state.waitingForExport = !this.runningDeployed;

    if (this.runningDeployed) {
      this.props.noodlRuntime.setData(this.props.projectData);

      //start pre-fetching the rest of the bundles after a while, if there arent too many of them
      const allBundles = Object.keys(this.props.projectData.componentIndex);
      if (allBundles.length < 30) {
        setTimeout(() => {
          this.props.noodlRuntime.prefetchBundles(allBundles, 3);
        }, 10000);
      }
    } else {
      noodlRuntime.graphModel.on('editorImportComplete', () => {
        this.setState({ waitingForExport: false });
      });
      this.connectToEditor();
    }

    this.focusedNoodlNodes = [];
  }

  connectToEditor() {
    const { noodlRuntime } = this.props;

    // Remove hash if it is in location href
    var href =
      (Noodl.host || location.protocol + '//' + location.host) +
      location.pathname +
      (location.search ? location.search : '');

    const address = href.replace('http', 'ws');
    noodlRuntime.connectToEditor(address);

    this.highlightedNodes = new Map();
    this.isUpdatingHighlights = false;

    if (typeof window !== 'undefined' && window.NoodlEditor) {
      this.highlighter = new Highlighter(noodlRuntime);
      NoodlEditorHighlightAPI.setHighlighter(this.highlighter);

      noodlRuntime.editorConnection.on('hoverStart', (id) => {
        this.highlighter.highlightNodesWithId(id);
      });
      noodlRuntime.editorConnection.on('hoverEnd', (id) => {
        this.highlighter.disableHighlight();
      });

      this.inspector = new Inspector({
        onDisableHighlight: () => this.highlighter.disableHighlight(),
        onHighlight: (id) => this.highlighter.highlightNodesWithId(id),
        onInspect: (ids) => {
          NoodlEditor.inspectNodes(ids);
        }
      });
      NoodlEditorInspectorAPI.setInspector(this.inspector);
    }

    noodlRuntime.editorConnection.on('debuggingEnabledChanged', (enabled) => {
      noodlRuntime.setDebugInspectorsEnabled(enabled);
    });

    // OBS-004 — let an authorised peer click and type in the running app.
    //
    // Bound here rather than inside the `window.NoodlEditor` branch above, deliberately: that
    // branch is the editor's *own* webview, and the whole point of this channel is that an
    // agent can drive a preview it did not open — a second browser window, or one reached
    // over the relay with no editor UI in front of it at all.
    bindInputInjector(noodlRuntime, noodlRuntime.editorConnection);

    this.graphWarnings = new GraphWarnings(noodlRuntime.graphModel, noodlRuntime.editorConnection);
  }

  setNodeFocused(node, focused) {
    if (focused && this.focusedNoodlNodes.indexOf(node) === -1) {
      //blur nodes that don't contain this new node
      this.focusedNoodlNodes
        .filter((focusedNode) => !focusedNode.contains(node))
        .forEach((blurredNode) => {
          blurredNode._blur();
        });

      node._focus();
      this.focusedNoodlNodes.push(node);
    } else if (!focused) {
      const index = this.focusedNoodlNodes.indexOf(node);
      if (index !== -1) {
        return;
      }

      node._blur();

      //also blur nodes that contain this node
      this.focusedNoodlNodes
        .filter((focusedNode) => focusedNode.contains(node))
        .forEach((blurredNode) => {
          blurredNode._blur();
        });

      this.focusedNoodlNodes.splice(index, 1);
    }
  }

  onClickCapture(e) {
    const focusedNoodlNodes = [];

    //walk up the dom tree and collect all noodl nodes
    let elem = e.target;
    while (elem) {
      if (elem.noodlNode && elem.noodlNode._focus) focusedNoodlNodes.push(elem.noodlNode);
      elem = elem.parentNode;
    }

    //blur nodes that weren't part of this click
    this.focusedNoodlNodes.filter((node) => focusedNoodlNodes.indexOf(node) === -1).forEach((node) => node._blur());

    //focus all new focused nodes
    focusedNoodlNodes.filter((node) => this.focusedNoodlNodes.indexOf(node) === -1).forEach((node) => node._focus());

    this.focusedNoodlNodes = focusedNoodlNodes;
  }

  render() {
    const rootComponent = this.props.noodlRuntime.rootComponent;
    if (this.state.waitingForExport) return null;

    if (!rootComponent) {
      if (this.runningDeployed) {
        return null;
      } else {
        return NoHomeError();
      }
    }

    const bodyScroll = this.props.noodlRuntime.getProjectSettings().bodyScroll;

    if (bodyScroll) {
      const style = {
        margin: 0,
        padding: 0,
        minHeight: '100vh',
        alignSelf: 'stretch',
        display: 'flex',
        flexDirection: 'column'
      };
      return (
        <div style={style} onClickCapture={(e) => this.onClickCapture(e)}>
          <div style={{ ...style, isolation: 'isolate' }}>{rootComponent.render()}</div>
          {this.state.popups.length ? (
            <div style={{ ...style, isolation: 'isolate' }}>{this.state.popups.map((p) => p.render())}</div>
          ) : null}
        </div>
      );
    } else {
      return (
        <div
          style={{
            margin: 0,
            padding: 0,
            // `clip`, not `hidden` — NDA-008 §0.
            //
            // This div is pinned to the viewport and routinely holds taller content. With
            // `overflow: hidden` it is still a *scroll container*: the browser can scroll it
            // (any real DOM focus does, and `TextInput` is the library's one focus call), while
            // the user cannot scroll it back, because hidden only removes the scrollbars. That
            // asymmetry is the reported "the page jumps and the header never comes back" — the
            // Component Stack, long blamed for it, moves the scroll position 0 px.
            //
            // `overflow: clip` creates no scroll container at all, so there is nothing to
            // scroll in either direction and the two sides agree again. A deliberate `Focus`
            // still scrolls the nearest ancestor that genuinely *is* scrollable — a Group with
            // scroll enabled — which is why `TextInput` keeps its plain `.focus()` rather than
            // `preventScroll: true`. Richard's call, 2026-07-29: fix the box, keep the feature.
            //
            // Note this drops the block formatting context `hidden` implied. Nothing here
            // relies on one: the tree below is flex and absolutely positioned throughout, and
            // `#root` above is `position: fixed`, which already provides positional containment.
            overflow: 'clip',
            width: '100%',
            height: '100%'
          }}
          onClickCapture={(e) => this.onClickCapture(e)}
        >
          {rootComponent.render()}
          {this.state.popups.map((p) => p.render())}
        </div>
      );
    }
  }
}
