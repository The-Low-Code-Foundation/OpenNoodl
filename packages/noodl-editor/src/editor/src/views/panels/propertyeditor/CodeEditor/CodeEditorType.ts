import React from 'react';
import { flushSync } from 'react-dom';
import { createRoot, Root } from 'react-dom/client';

import { CodeHistoryStore } from '@noodl-models/CodeHistory';
import { WarningsModel } from '@noodl-models/warningsmodel';

import {
  JavaScriptEditor,
  collectDeclaredPorts,
  declaredPortsEqual,
  modeHasDeclaredPorts,
  setOpenNodeContext,
  type DeclaredPorts,
  type RuntimeDiagnostic,
  type ValidationType
} from '@noodl-core-ui/components/code-editor';

import { TypeView } from '../TypeView';
import { getEditType } from '../utils';
import {
  defaultCodeEditorSize,
  restoreCodeEditorSize,
  storableCodeEditorSize,
  type PopoutSize,
  type Viewport
} from './popoutSize';
import { Property, PropertyProps } from './Property';

/** Where the popout's remembered size lives. Unchanged, so an existing good size survives. */
const SIZE_STORAGE_KEY = 'codeeditor_size_percentage';

function readViewport(): Viewport {
  const body = document.body.getBoundingClientRect();
  return { width: body.width, height: body.height };
}

function readStoredSize(viewport: Viewport): PopoutSize {
  try {
    const raw = localStorage[SIZE_STORAGE_KEY];
    return raw ? restoreCodeEditorSize(JSON.parse(raw), viewport) : defaultCodeEditorSize(viewport);
  } catch (error) {
    // Unparseable is the same as nothing stored, and neither is worth an exception over the
    // size of a window.
    return defaultCodeEditorSize(viewport);
  }
}

function writeStoredSize(measured: { width: number; height: number }): void {
  const fractions = storableCodeEditorSize(measured, readViewport());
  if (!fractions) return;

  try {
    localStorage[SIZE_STORAGE_KEY] = JSON.stringify(fractions);
  } catch (error) {
    /* a full or blocked store is not worth an exception either */
  }
}

/** The `codeeditor` values a port may declare, and what each one is. */
const LANGUAGE_MODES: Record<string, ValidationType> = {
  json: 'json',
  css: 'css',
  html: 'html',
  text: 'text'
};

/** The `codenotation` values a JavaScript port may declare. */
const NOTATION_MODES: Record<string, ValidationType> = {
  expression: 'expression',
  function: 'function',
  script: 'script'
};

/**
 * Which mode a JavaScript port opens in when it does not say.
 *
 * `'function'` because that is what every one of these ports resolved to before
 * FUN-009 — the guess this function used to make returned `'function'` for
 * every real port in the product — so a port that has not been given a
 * `codenotation` behaves exactly as it did. It is a fallback, not a claim about
 * the port; see the `⚠️` in {@link validationTypeForEditType}.
 */
const DEFAULT_JS_NOTATION: ValidationType = 'function';

/**
 * Which editor mode a `codeeditor` port opens in.
 *
 * The port's own `codeeditor` value is the language. It has never all been
 * JavaScript — `css-definition`'s `style` is CSS, every visual node's
 * `styleCss` and Static Data's `csv` are plain text, project settings'
 * `headCode` is HTML — but everything that was not `json` used to be validated
 * as a JavaScript expression and titled **EXPRESSION** in the popout's toolbar.
 * A stylesheet was therefore presented as an expression and then reported as a
 * syntax error, on a node whose whole purpose is to hold a stylesheet.
 *
 * ## The JavaScript half, and why it is a second declaration (FUN-009)
 *
 * The three JavaScript modes are not three flavours of validation. They are
 * three **different scoping rules**, and two of them are opposites:
 *
 * | | reads an input as | an unknown name is |
 * |---|---|---|
 * | `function` | `Inputs.Name` | undefined — `no-undef` warns |
 * | `script` | a declared `inputs:{}` entry | undefined — `no-undef` warns |
 * | `expression` | the bare name itself | **a new input port** (`expression.ts:399`) |
 *
 * Which rule a port follows is known only to the node that declares it, and
 * nothing derivable carries it. This function used to guess from `type.name`
 * — three lines below its own comment saying the *port* name was the only
 * signal — and `type.name` is `'string'` for all three, so **both name branches
 * were unreachable and every JavaScript port in the product opened as
 * `function`**. Measured live 2026-08-12; the user-visible half was an
 * Expression node running `no-undef` and underlining `total * 2` as an
 * undefined variable while dutifully minting the port `total`.
 *
 * ⚠️ The repair is **not** the port name either. `functionScript` (Function)
 * contains `script` and `code` (Script) contains neither, so switching to the
 * port name fixes Expression and inverts the other two. So the port says which
 * rule it follows, in `type.codenotation`, next to the language it is written
 * in — `expression.ts`, `javascript.ts` (`Javascript2`) and
 * `simplejavascript.ts` are the three declarations.
 *
 * ⚠️ A JavaScript port that declares no `codenotation` gets
 * {@link DEFAULT_JS_NOTATION}, which reproduces today's behaviour exactly. That
 * is a compatibility floor and not an assertion that the port is a Function
 * body: `mapScript` (Map Collection) declares its outputs through `map({…})`
 * and `storageJSONFilter` (Database Collection) is a filter with `$variables`,
 * and neither has `Inputs.`/`Outputs.` in it. They were offered Function
 * completions before this change and still are. Filed as FUN-009 F35.
 *
 * Anything unrecognised stays `expression`, which is the safest JS reading. It
 * is no longer the array/object case, though — since ERG-003 those ports route
 * to `ListValueType`'s JSON editor and never reach this view.
 *
 * Exported for the spec; `getValidationType` is the only caller in the product.
 */
export function validationTypeForEditType(
  type: { name?: string; codeeditor?: string; codenotation?: string } | undefined
): ValidationType {
  const language = type?.codeeditor;

  if (language && LANGUAGE_MODES[language]) {
    return LANGUAGE_MODES[language];
  }

  if (language === 'javascript' || language === 'typescript') {
    const notation = type?.codenotation;
    return (notation && NOTATION_MODES[notation]) || DEFAULT_JS_NOTATION;
  }

  return 'expression';
}

/**
 * Find the last run's error among a node's warnings (FUN-007 §2).
 *
 * ## Why this matches on the shape and not on the warning key
 *
 * The keys (`js-function-run-waring`, and its `script-` twin) are string
 * literals in `simplejavascript.ts`, a package this one does not import. Copying
 * them here would create exactly the drift the runtime lane's F32 already
 * records for the *message* builders — two copies of a constant that must agree,
 * with nothing to notice when they stop. What this actually needs is narrower
 * and self-describing: **a warning that names a line in the document**. Only the
 * run-error path attaches `line`, and if another path ever attaches one it will
 * be for the same reason and should render the same way.
 *
 * ⚠️ **Known limit: the warning does not say which port it is about.** A node
 * with two code ports — `For Each` has `templateScript` beside its others — would
 * anchor the same error in both editors. Every node that can currently throw this
 * has one body, so it is not reachable today; a second code port on a running
 * node is what would make it real, and the fix is a port name on the payload.
 *
 * Exported for the spec.
 */
export function runtimeDiagnosticFromWarnings(warnings: TSFixme): RuntimeDiagnostic | null {
  const list = warnings?.warnings;
  if (!Array.isArray(list)) return null;

  for (const entry of list) {
    const warning = entry?.warning;
    // `line` is 1-based in the author's document — the runtime subtracted the
    // compiled prefix before sending it (`functionDiagnostics.ts`). Nothing here
    // adjusts it again.
    if (!warning || typeof warning.line !== 'number') continue;
    if (typeof warning.message !== 'string' || !warning.message) continue;

    return {
      line: warning.line,
      column: typeof warning.column === 'number' ? warning.column : undefined,
      message: warning.message
    };
  }

  return null;
}

export class CodeEditorType extends TypeView {
  el: TSFixme;
  propertyName: string;

  propertyDiv: HTMLDivElement;
  popoutDiv: HTMLDivElement;

  nodeId: string;

  isPrimary: boolean;
  readOnly: boolean;

  propertyRoot: Root | null = null;
  popoutRoot: Root | null = null;

  value: TSFixme;
  default: TSFixme;

  /**
   * The node this popout is publishing the declared ports of, while it is open.
   * Held only so `dispose()` can unsubscribe from the exact model it subscribed
   * to — `parent.model` can be gone by then.
   */
  openNode: TSFixme = null;
  /** The last ports published, so an unrelated parameter write costs nothing. */
  publishedPorts: DeclaredPorts | null = null;

  static fromPort(args): TSFixme {
    const view = new CodeEditorType();

    const p = args.port;
    const parent = args.parent;

    view.port = p;
    view.displayName = p.displayName ? p.displayName : p.name;
    view.name = p.name;
    view.type = getEditType(p);
    view.group = p.group;
    view.parent = parent;
    view.value = parent.model.getParameter(p.name);
    view.default = p.default;
    view.tooltip = p.tooltip;
    view.isConnected = parent.model.isPortConnected(p.name, 'target');
    view.isDefault = parent.model.parameters[p.name] === undefined;

    // Try multiple locations for readOnly flag
    view.readOnly = p.readOnly || p.type?.readOnly || getEditType(p)?.readOnly || false;

    // HACK: Like most of Property panel,
    //       since the property panel can have many code editors
    //       we want to open the one most likely to be the
    //       primary one when dubble clicking a node.
    view.isPrimary = !!view.type?.codeeditor;

    return view;
  }

  dispose(): void {
    // FUN-003. The code editor's view of "the node whose code is open" is a
    // per-editor slot, and this is the one path every close takes: the popout's
    // own `onClose` calls `dispose()`, and so does a panel teardown that removes
    // the view out from under an open popout. Left standing, the next editor
    // opened over a different node completes against this node's ports — a live
    // wrong answer rather than an empty one.
    setOpenNodeContext(null);

    // The republish subscription (FIX-016 §2 follow-up). Dropped here rather than
    // in the popout's `onClose`, for the same reason the slot above is: a panel
    // teardown can dispose this view out from under an open popout, and that path
    // does not go through `onClose` — a subscription left standing would publish
    // an open node whose editor no longer exists.
    if (this.openNode) {
      this.openNode.off(this);
      this.openNode = null;
    }
    this.publishedPorts = null;

    // Unmount popout root
    if (this.popoutRoot) {
      this.popoutRoot.unmount();
      this.popoutRoot = null;
    }

    WarningsModel.instance.off(this);
  }

  render(): TSFixme {
    const self = this;

    const propertyProps: PropertyProps = {
      isPrimary: this.isPrimary,
      displayName: this.displayName || 'Script',
      tooltip: this.tooltip,
      isDefault: this.isDefault,
      onClick(event) {
        self.onLaunchClicked(self, event.currentTarget, event);
      }
    };

    this.propertyDiv = document.createElement('div');
    this.propertyRoot = createRoot(this.propertyDiv);
    this.propertyRoot.render(React.createElement(Property, propertyProps));

    this.el = this.propertyDiv;
    return this.propertyDiv;
  }

  private getValidationType(): ValidationType {
    return validationTypeForEditType(this.type);
  }

  /** HTML Binding */
  onLaunchClicked(scope, el, evt): void {
    const _this = this;
    // `parent.model` is the panel's `ModelProxy`; `.model` is the `NodeGraphNode`
    // underneath it, which is where the id and the raw parameter bag live.
    const node = _this.parent.model?.model;
    const nodeId = node?.id;

    this.propertyName = scope.name;

    this.parent.hidePopout();

    function save() {
      let source = _this.value;
      if (source === '') source = undefined;

      // Snapshot before updating. This goes to `<project>/.nodegx/code-history.json`,
      // never to the node's metadata — see CED-001 (B1/B3). Fire-and-forget: a
      // snapshot that cannot be written must not hold up the parameter write.
      if (source && nodeId && !_this.readOnly) {
        void CodeHistoryStore.instance.saveSnapshot(nodeId, scope.name, source);
      }

      _this.value = source;
      _this.parent.setParameter(scope.name, source !== _this.default ? source : undefined);
      _this.isDefault = source === undefined;
    }

    // 🔴 CED-002. This used to clamp a stored fraction up to a 400px floor, and the floor was
    // hiding a defect: `onClose` measured the React root's container, `dispose()` can have
    // unmounted it already, and an emptied div measures 0×0 — so `{width: 0, height: 0}` was
    // stored as if it were a chosen size, and every code editor from then on opened at 400px.
    // The arithmetic, both floors and the refusal to store an impossible measurement are in
    // `popoutSize.ts`, where they are gated by specs.
    const viewport = readViewport();
    const size = readStoredSize(viewport);
    const initialSize = { x: size.width, y: size.height };

    this.popoutDiv = document.createElement('div');
    this.popoutRoot = createRoot(this.popoutDiv);

    const validationType = this.getValidationType();

    // ---
    // FUN-003. Tell the code editor which node it is holding the code of, so the
    // ports declared in the property panel are readable alongside the ones mined
    // out of the document. This is the only producer; the four `JavaScriptEditor`
    // call sites read it through the registry and none of the other three needs
    // to know it exists.
    //
    // ⚠️ The `else` is load bearing. A mode with no declared ports must *clear*
    // the slot rather than skip it — opening a CSS Definition's `style` after a
    // Function node would otherwise leave the Function's ports standing, and in
    // `'expression'` mode a consumer acting on them would write `Inputs.foo` into
    // a language where a bare identifier *becomes* a port (`expression.ts:399`).
    if (node && modeHasDeclaredPorts(validationType)) {
      // FIX-016 §2 follow-up. Publishing once, at open, was the whole of it — and
      // that made message 5 a diagnostic whose own advice does not take effect.
      // It says *"set its Type to Signal in the property panel"*, the panel is
      // right there behind the popout, and doing it changed nothing until the
      // editor was closed and reopened.
      //
      // ⚠️ The other four messages are about the *document*, which re-lints
      // itself on every keystroke. Message 5 is the only one about a **panel
      // setting**, which is why it is the only one that could be told and not
      // hear.
      const publish = () => {
        const declared = collectDeclaredPorts(node.parameters);

        // Every parameter write lands here, including this editor's own save of
        // `functionScript` on Cmd-S. Republishing that would re-lint the document
        // it just wrote, per save, for no change in the answer.
        if (this.publishedPorts && declaredPortsEqual(this.publishedPorts, declared)) return;
        this.publishedPorts = declared;

        setOpenNodeContext({
          nodeId,
          typeName: node.typename,
          declaredInputs: declared.inputs,
          declaredOutputs: declared.outputs
        });
      };

      publish();

      // Unsubscribed in `dispose()`, which every close path goes through.
      this.openNode = node;
      node.on('parametersChanged', publish, this);
    } else {
      setOpenNodeContext(null);
    }

    // Create close handler to trigger popout close
    const closeHandler = () => {
      _this.parent.hidePopout();
    };

    // History is offered only for editable fields of a project that exists on disk —
    // there is nowhere to put the sidecar otherwise, and a History button that can
    // never have anything in it is worse than no button.
    const historyProvider =
      !this.readOnly && nodeId && CodeHistoryStore.instance.isAvailable()
        ? CodeHistoryStore.instance.providerFor(nodeId, scope.name)
        : undefined;

    // FUN-007 §2. What the node's last run threw, if it threw. Read from the
    // model rather than pushed by the runtime: the throw may have happened long
    // before this popout existed — a node runs at load when `Run` is unconnected
    // — so an editor that only listened would open blank over a node that is
    // already dotted.
    const readRuntimeDiagnostic = (): RuntimeDiagnostic | null => {
      if (!node) return null;

      return runtimeDiagnosticFromWarnings(
        WarningsModel.instance.getWarnings({ component: node.owner?.owner, node })
      );
    };

    const renderEditor = (flush: boolean) => {
      const element = React.createElement(JavaScriptEditor, {
        value: this.value || '',
        onChange: (newValue) => {
          this.value = newValue;
        },
        onSave: () => {
          save();
        },
        onClose: closeHandler,
        validationType,
        // No placeholder: the mode supplies its own (core-ui `utils/modes.ts`).
        disabled: this.readOnly, // Enable read-only mode if port is marked readOnly
        width: initialSize?.x || 800,
        height: initialSize?.y || 500,
        historyProvider,
        runtimeDiagnostic: readRuntimeDiagnostic()
      });

      // Synchronous so showPopout can measure real content (DEBT-010). The editor's
      // size is an inline width/height on its root, so one flushed commit is the
      // whole box — CodeMirror's own layout happens inside it and cannot change it.
      // Without this the popout is measured as 0×0 and opens with its top edge at
      // the button's Y, i.e. below the fold for any row low in the panel (FH-005).
      //
      // ⚠️ Only the first commit. A later re-render must **not** flush: the size is
      // already measured, and `flushSync` from inside the model's notification would
      // commit React from a place React is entitled to refuse.
      if (flush) flushSync(() => this.popoutRoot.render(element));
      else this.popoutRoot.render(element);
    };

    renderEditor(true);

    // Re-render when the node's warnings change, so an error raised by a run that
    // happens *while* the popout is open reaches the gutter, and a cleared warning
    // takes it away again. Unsubscribed in `dispose()`, which every close path
    // goes through — the pre-existing `WarningsModel.instance.off(this)` there was
    // waiting for a subscriber and now has one.
    if (node) {
      WarningsModel.instance.on(
        'warningsChanged',
        () => {
          if (this.popoutRoot) renderEditor(false);
        },
        this
      );
    }

    const popoutDiv = this.popoutDiv;
    this.parent.showPopout({
      content: { el: this.popoutDiv },
      attachTo: el,
      position: 'right',
      disableDynamicPositioning: true,
      onClose: function () {
        // ---
        // Save the document
        save();

        // ---
        // Save the window size — but only if what we measured can be a real one.
        //
        // 🔴 CED-002. `popoutDiv` is the React root's container, and `dispose()` unmounts that
        // root. Every close reaches here first, but a *panel teardown* can dispose the view out
        // from under an open popout, at which point this measures an empty div: 0×0, stored as
        // a fraction, restored as the 400px floor, forever. `storableCodeEditorSize` answers
        // `null` for anything below the floor, and the last good size is kept instead.
        writeStoredSize(popoutDiv.getBoundingClientRect());

        // ---
        // Dispose
        _this.dispose();
      }
    });

    evt.stopPropagation();
  }
}
