import * as monaco from 'monaco-editor/esm/vs/editor/editor.api';
import React from 'react';
import { createRoot, Root } from 'react-dom/client';

import { CodeHistoryManager } from '@noodl-models/CodeHistoryManager';
import { WarningsModel } from '@noodl-models/warningsmodel';
import { createModel } from '@noodl-utils/CodeEditor';
import { EditorModel } from '@noodl-utils/CodeEditor/model/editorModel';

import { JavaScriptEditor, type ValidationType } from '@noodl-core-ui/components/code-editor';

import { TypeView } from '../TypeView';
import { getEditType } from '../utils';
import { CodeEditorProps } from './CodeEditor';
import { Property, PropertyProps } from './Property';

// hot-reload
const CodeEditor = require('./CodeEditor').CodeEditor;

/**
 * Collect more information for where the error occurred.
 */
function parseStackTrace(stack: string) {
  const stackTraceLines = stack.split('\n');
  if (stackTraceLines.length <= 1) return null;

  const result = stackTraceLines[1].match(/<anonymous>:(\d+):(\d+)\)/);
  if (!result) return {};
  if (result.length < 3) return {};

  return {
    lineNumber: Number(result[1]),
    columnNumber: Number(result[2])
  };
}

// HACK: This is a very ugly solution to keep track of the position, for this
//       purpose I think it is an alright trade off with how the current system
//       is built, since we only care about the position during the currently
//       active editor instance.
//
// Ideally CodeEditorType should be more merged in to the React component and
// control everything from in there.
class CodeEditorViewStateCache {
  static instance = new CodeEditorViewStateCache();

  _cache: Record<string, monaco.editor.ICodeEditorViewState> = {};

  save(nodeId: string, viewState: monaco.editor.ICodeEditorViewState) {
    this._cache[nodeId] = viewState;
  }

  get(nodeId: string): monaco.editor.ICodeEditorViewState | undefined {
    return this._cache[nodeId];
  }
}

export class CodeEditorType extends TypeView {
  el: TSFixme;
  propertyName: string;

  propertyDiv: HTMLDivElement;
  popoutDiv: HTMLDivElement;

  model: EditorModel;
  editor: monaco.editor.ICodeEditor;

  nodeId: string;

  isPrimary: boolean;
  readOnly: boolean;

  propertyRoot: Root | null = null;
  popoutRoot: Root | null = null;

  static fromPort(args): TSFixme {
    const view = new CodeEditorType();

    const p = args.port;
    const parent = args.parent;

    // Debug: Log all port properties
    console.log('[CodeEditorType.fromPort] Port properties:', {
      name: p.name,
      readOnly: p.readOnly,
      type: p.type,
      allKeys: Object.keys(p)
    });

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

    console.log('[CodeEditorType.fromPort] Resolved readOnly:', view.readOnly);

    // HACK: Like most of Property panel,
    //       since the property panel can have many code editors
    //       we want to open the one most likely to be the
    //       primary one when dubble clicking a node.
    view.isPrimary = !!view.type?.codeeditor;

    return view;
  }

  dispose(): void {
    this.model?.dispose();
    this.model = null;

    // Unmount popout root
    if (this.popoutRoot) {
      this.popoutRoot.unmount();
      this.popoutRoot = null;
    }

    WarningsModel.instance.off(this);
  }

  render(): TSFixme {
    this.el = this.bindView($(`<div></div>`), this);
    super.render();

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

    return this.propertyDiv;
  }

  updateWarnings(): void {
    const _this = this;

    if (!this.model) {
      return;
    }

    const markers: monaco.editor.IMarkerData[] = [];
    const decorations: monaco.editor.IModelDecoration[] = [];

    try {
      WarningsModel.instance.forEachWarning(function (_w, _ref, _key, warning) {
        if (!warning.ref.node) return; // Only for node warnings
        if (!_this.parent.model.model) return; // Head code doesn't have a model

        // Check if the warning is for this node and property
        const isThisNode = warning.ref.node.id === _this.parent.model.model.id;
        const isThisProp = warning.ref.node.typename === _this.parent.model.model.typename;
        const isForMe = isThisNode && isThisProp;
        if (!isForMe) return;

        // Check if the warning has a stack trace
        if (!warning.warning.stack) return;

        const { columnNumber, lineNumber } = parseStackTrace(warning.warning.stack);
        const length = warning.warning.message.split(' ')[0].length;

        // NOTE: This is becuase when the method is called, we pass in 3 arguments.
        //  await func.apply(this._internal._this, [inputs, outputs, JavascriptNodeParser.getComponentScopeForNode(this)]);
        const lineNumberOffset = -3;

        markers.push({
          severity: monaco.MarkerSeverity.Error,
          startLineNumber: lineNumber + lineNumberOffset,
          startColumn: columnNumber,
          endLineNumber: lineNumber + lineNumberOffset,
          endColumn: columnNumber + length,
          message: 'Runtime: ' + warning.warning.message
        });
      });
    } catch (error) {
      // Lets just catch any errors here
      // Doing so will not prevent the code editor from opening
      console.error(error);
    }

    // Decorations are on the sidebar
    // decorations.push({
    //   ownerId: 999,
    //   id: 'test-999',
    //   range: new monaco.Range(lineNumber - 2, columnNumber, lineNumber - 2, columnNumber + 1),
    //   options: {
    //     isWholeLine: true,
    //     // linesDecorationsClassName: 'code-editor__line__error',
    //     inlineClassName: 'code-editor__inline__error',
    //     hoverMessage: { value: 'Runtime: ' + warning.warning.message },
    //   }
    // });

    monaco.editor.setModelMarkers(this.model.model, 'editor', markers);
    this.model.model.deltaDecorations([], decorations);
  }

  /** HTML Binding */
  onLaunchClicked(scope, el, evt): void {
    const _this = this;
    const nodeId = _this.parent.model?.model?.id;

    this.propertyName = scope.name;

    this.parent.hidePopout();

    // Always use new JavaScriptEditor for JavaScript/TypeScript
    const isJavaScriptEditor = this.type.codeeditor === 'javascript' || this.type.codeeditor === 'typescript';

    // Only set up Monaco warnings for Monaco-based editors
    if (!isJavaScriptEditor) {
      WarningsModel.instance.off(this);
      WarningsModel.instance.on(
        'warningsChanged',
        function () {
          _this.updateWarnings();
        },
        this
      );
    }

    function save() {
      // For JavaScriptEditor, use this.value (already updated in onChange)
      // For Monaco editor, get value from model
      let source = isJavaScriptEditor ? _this.value : _this.model.getValue();
      if (source === '') source = undefined;

      // Save snapshot to history (before updating)
      if (source && nodeId) {
        CodeHistoryManager.instance.saveSnapshot(nodeId, scope.name, source);
      }

      _this.value = source;
      _this.parent.setParameter(scope.name, source !== _this.default ? source : undefined);
      _this.isDefault = source === undefined;
    }

    const node = this.parent.model.model;

    // Only create Monaco model for Monaco-based editors
    if (!isJavaScriptEditor) {
      this.model = createModel(
        {
          type: this.type.name || this.type,
          value: this.value,
          codeeditor: this.type.codeeditor?.toLowerCase()
        },
        node
      );
    }

    const props: CodeEditorProps = {
      nodeId,
      model: this.model,
      // NOTE(auto-saving): Add debounce to enable auto saving
      // onSave: debounce(save, 500)
      onSave: save,
      outEditor: (editor) => {
        this.editor = editor;

        // Allow the editor to be rendered
        setImmediate(() => {
          const viewState = CodeEditorViewStateCache.instance.get(nodeId);
          if (viewState) {
            editor.restoreViewState(viewState);
          }
        });
      }
    };

    if (localStorage['codeeditor_size_percentage']) {
      try {
        const json = JSON.parse(localStorage['codeeditor_size_percentage']);

        const b = document.body.getBoundingClientRect();
        const width = Math.min(Math.max(b.width * json.width, 400), b.width - 300);
        const height = Math.min(Math.max(b.height * json.height, 400), b.height - 300);

        props.initialSize = {
          x: width,
          y: height
        };
      } catch (error) {}
    } else {
      // Default size: Make it wider (60% of viewport width, 70% of height)
      const b = document.body.getBoundingClientRect();
      props.initialSize = {
        x: Math.min(b.width * 0.6, b.width - 200), // 60% width, but leave some margin
        y: Math.min(b.height * 0.7, b.height - 200) // 70% height
      };
    }

    this.popoutDiv = document.createElement('div');
    this.popoutRoot = createRoot(this.popoutDiv);

    // Determine which editor to use
    if (isJavaScriptEditor) {
      console.log('✨ Using JavaScriptEditor for:', this.type.codeeditor);

      // Determine validation type based on editor type
      let validationType: ValidationType = 'function';
      if (this.type.codeeditor === 'javascript') {
        // Could be expression or function - check type name for hints
        const typeName = (this.type.name || '').toLowerCase();
        if (typeName.includes('expression')) {
          validationType = 'expression';
        } else if (typeName.includes('script')) {
          validationType = 'script';
        } else {
          validationType = 'function';
        }
      } else if (this.type.codeeditor === 'typescript') {
        validationType = 'script';
      }

      // Debug logging
      console.log('[CodeEditorType] Rendering JavaScriptEditor:', {
        parameterName: scope.name,
        readOnly: this.readOnly,
        nodeId: nodeId
      });

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
            // Don't update Monaco model - JavaScriptEditor is independent
            // The old code triggered Monaco validation which caused errors
          },
          onSave: () => {
            save();
          },
          onClose: closeHandler,
          validationType,
          disabled: this.readOnly, // Enable read-only mode if port is marked readOnly
          width: props.initialSize?.x || 800,
          height: props.initialSize?.y || 500,
          // Only add history tracking for editable fields
          nodeId: this.readOnly ? undefined : nodeId,
          parameterName: this.readOnly ? undefined : scope.name
        })
      );
    } else {
      // Use existing Monaco CodeEditor
      this.popoutRoot.render(React.createElement(CodeEditor, props));
    }

    const popoutDiv = this.popoutDiv;
    this.parent.showPopout({
      content: { el: [this.popoutDiv] },
      attachTo: $(el),
      position: 'right',
      disableDynamicPositioning: true,
      onClose: function () {
        // ---
        // Save the document
        save();

        if (_this.editor) {
          const viewState = _this.editor.saveViewState();
          CodeEditorViewStateCache.instance.save(nodeId, viewState);
        }

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

    // Only update warnings for Monaco-based editors
    if (!isJavaScriptEditor) {
      this.updateWarnings();
    }

    evt.stopPropagation();
  }
}
