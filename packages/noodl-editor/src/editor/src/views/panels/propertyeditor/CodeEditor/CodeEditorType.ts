import React from 'react';
import { flushSync } from 'react-dom';
import { createRoot, Root } from 'react-dom/client';

import { CodeHistoryStore } from '@noodl-models/CodeHistory';
import { WarningsModel } from '@noodl-models/warningsmodel';

import { JavaScriptEditor, type ValidationType } from '@noodl-core-ui/components/code-editor';

import { TypeView } from '../TypeView';
import { getEditType } from '../utils';
import { Property, PropertyProps } from './Property';

/** The `codeeditor` values a port may declare, and what each one is. */
const LANGUAGE_MODES: Record<string, ValidationType> = {
  json: 'json',
  css: 'css',
  html: 'html',
  text: 'text'
};

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
 * `javascript`/`typescript` keep the name-based guess they always had: the
 * three JS modes differ only in what wrapping the validator accepts, and the
 * port name is the only signal available for that.
 *
 * Anything unrecognised stays `expression`, which is the safest JS reading. It
 * is no longer the array/object case, though — since ERG-003 those ports route
 * to `ListValueType`'s JSON editor and never reach this view.
 *
 * Exported for the spec; `getValidationType` is the only caller in the product.
 */
export function validationTypeForEditType(type: { name?: string; codeeditor?: string } | undefined): ValidationType {
  const language = type?.codeeditor;

  if (language && LANGUAGE_MODES[language]) {
    return LANGUAGE_MODES[language];
  }

  if (language === 'javascript' || language === 'typescript') {
    const typeName = (type?.name || '').toLowerCase();
    if (typeName.includes('expression')) return 'expression';
    if (typeName.includes('script')) return 'script';
    return 'function';
  }

  return 'expression';
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
    const nodeId = _this.parent.model?.model?.id;

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

    let initialSize: { x: number; y: number };

    if (localStorage['codeeditor_size_percentage']) {
      try {
        const json = JSON.parse(localStorage['codeeditor_size_percentage']);

        const b = document.body.getBoundingClientRect();
        const width = Math.min(Math.max(b.width * json.width, 400), b.width - 300);
        const height = Math.min(Math.max(b.height * json.height, 400), b.height - 300);

        initialSize = { x: width, y: height };
      } catch (error) {}
    } else {
      // Default size: Make it wider (60% of viewport width, 70% of height)
      const b = document.body.getBoundingClientRect();
      initialSize = {
        x: Math.min(b.width * 0.6, b.width - 200), // 60% width, but leave some margin
        y: Math.min(b.height * 0.7, b.height - 200) // 70% height
      };
    }

    this.popoutDiv = document.createElement('div');
    this.popoutRoot = createRoot(this.popoutDiv);

    const validationType = this.getValidationType();

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

    // Synchronous so showPopout can measure real content (DEBT-010). The editor's
    // size is an inline width/height on its root, so one flushed commit is the
    // whole box — CodeMirror's own layout happens inside it and cannot change it.
    // Without this the popout is measured as 0×0 and opens with its top edge at
    // the button's Y, i.e. below the fold for any row low in the panel (FH-005).
    flushSync(() =>
      this.popoutRoot.render(
        React.createElement(JavaScriptEditor, {
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
          historyProvider
        })
      )
    );

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
        // Save the window size
        const a = popoutDiv.getBoundingClientRect();
        const b = document.body.getBoundingClientRect();

        localStorage['codeeditor_size_percentage'] = JSON.stringify({
          width: a.width / b.width,
          height: a.height / b.height
        });

        // ---
        // Dispose
        _this.dispose();
      }
    });

    evt.stopPropagation();
  }
}
