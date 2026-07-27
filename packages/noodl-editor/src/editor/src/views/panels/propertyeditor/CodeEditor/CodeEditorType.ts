import React from 'react';
import { createRoot, Root } from 'react-dom/client';

import { CodeHistoryManager } from '@noodl-models/CodeHistoryManager';
import { WarningsModel } from '@noodl-models/warningsmodel';

import { JavaScriptEditor, type ValidationType } from '@noodl-core-ui/components/code-editor';

import { TypeView } from '../TypeView';
import { getEditType } from '../utils';
import { Property, PropertyProps } from './Property';

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

  /**
   * Determine which CodeMirror validation/language mode to use for this port.
   *
   * - `codeeditor: 'json'` ports get real JSON highlighting/validation.
   * - `codeeditor: 'javascript' | 'typescript'` ports use the JS heuristics that were
   *   already in place (name-based expression/script/function guess).
   * - Anything else reaching this view is an array- or object-typed port edited as a JS
   *   literal (see DataTypes/Ports.ts `isOfArrayType` / `isOfObjectType`) - treat it as an
   *   expression. Not `json`, deliberately: `{ Authorization: 'Bearer x' }` is a perfectly
   *   good object literal and JSON validation would mark the unquoted key as an error.
   */
  private getValidationType(): ValidationType {
    if (this.type.codeeditor === 'json') {
      return 'json';
    }

    if (this.type.codeeditor === 'javascript' || this.type.codeeditor === 'typescript') {
      const typeName = (this.type.name || '').toLowerCase();
      if (typeName.includes('expression')) {
        return 'expression';
      } else if (typeName.includes('script')) {
        return 'script';
      }
      return 'function';
    }

    // Array- or object-typed port edited as a JS literal (the Options node's "Items", a
    // Global Store's "Initial State", an SSE call's "Headers")
    return 'expression';
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

      // Save snapshot to history (before updating)
      if (source && nodeId) {
        CodeHistoryManager.instance.saveSnapshot(nodeId, scope.name, source);
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

    // Render JavaScriptEditor with proper sizing and history support
    // For read-only fields, don't pass nodeId/parameterName (no history tracking)
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
        placeholder: validationType === 'json' ? '{}' : undefined,
        disabled: this.readOnly, // Enable read-only mode if port is marked readOnly
        width: initialSize?.x || 800,
        height: initialSize?.y || 500,
        // Only add history tracking for editable fields
        nodeId: this.readOnly ? undefined : nodeId,
        parameterName: this.readOnly ? undefined : scope.name
      })
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
