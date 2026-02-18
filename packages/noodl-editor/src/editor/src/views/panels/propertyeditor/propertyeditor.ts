import { NodeGraphContextTmp } from '@noodl-contexts/NodeGraphContext/NodeGraphContext';
import _ from 'underscore';
import React from 'react';
import { createRoot, Root } from 'react-dom/client';

import { NodeGraphNode } from '@noodl-models/nodegraphmodel';
import { UndoQueue, UndoActionGroup } from '@noodl-models/undo-queue-model';

import { ElementStyleSection } from '@noodl-core-ui/components/propertyeditor/ElementStyleSection';

import View from '../../../../../shared/view';
import { ElementConfigRegistry } from '../../../models/ElementConfigs/ElementConfigRegistry';
import { ProjectModel } from '../../../models/projectmodel';
import { ToastLayer } from '../../ToastLayer/ToastLayer';
import { VariantsEditor } from './components/VariantStates';
import { VisualStates } from './components/VisualStates';
import { Ports } from './DataTypes/Ports';
import { ModelProxy } from './models/modelProxy';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const PropertyEditorTemplate = require('../../../templates/propertyeditor/propertyeditor.html');

// Styles
require('../../../styles/propertyeditor/propertyeditor.css');

export class PropertyEditor extends View {
  parent: TSFixme;
  model: TSFixme;
  modelProxy: ModelProxy;
  allowAsRoot: TSFixme;
  portsView: TSFixme;
  renderPortsViewScheduled: TSFixme;
  variantsRoot: Root | null = null;
  visualStatesRoot: Root | null = null;
  /** React root for the ElementStyleSection (variant + size picker). */
  elementStyleRoot: Root | null = null;
  /** Stable group object used to manage undo/redo event subscriptions. */
  private readonly _elementStyleGroup: Record<string, never> = {};

  constructor(args) {
    super();

    this.parent = args.parent;
    this.model = args.model;

    this.modelProxy = new ModelProxy({ model: this.model });

    //this.isRoot = ProjectModel.instance.getRootNode() === this.model;
    this.allowAsRoot = this.model.type.allowAsExportRoot;
  }

  dispose() {
    this.portsView.dispose();
  }
  scheduleRenderPortsView() {
    if (this.renderPortsViewScheduled) return;

    const _this = this;
    this.renderPortsViewScheduled = true;
    setTimeout(function () {
      _this.renderPortsViewScheduled = false;
      _this.renderPortsView();
    }, 0);
  }
  renderPortsView() {
    this.portsView.render();
    this.$('.groups').html(this.portsView.el);
  }
  renderVariantsEditor() {
    if (this.model.type.useVariants) {
      const props = {
        model: this.model,
        onEditVariant: () => {
          // Hide top panel when editing variant
          this.$('.property-editor-label-and-buttons').hide();
          this.modelProxy.setEditMode('variant');
          this.scheduleRenderPortsView();

          this.$('.sidebar-property-editor').addClass('variants-sidepanel-edit-mode');
        },
        onDoneEditingVariant: () => {
          this.$('.property-editor-label-and-buttons').show();
          this.modelProxy.setEditMode('node');
          this.scheduleRenderPortsView();
          this.$('.sidebar-property-editor').removeClass('variants-sidepanel-edit-mode');
        }
      };
      const container = this.$('.variants')[0];
      if (!this.variantsRoot) {
        this.variantsRoot = createRoot(container);
      }
      this.variantsRoot.render(React.createElement(VariantsEditor, props));
    }
  }
  renderVisualStates() {
    if (this.model.type.visualStates !== undefined) {
      const props = {
        model: this.modelProxy,
        onVisualStateChanged: this.onVisualStateChanged.bind(this),
        portsView: this.portsView
      };
      const container = this.$('.visual-states')[0];
      if (!this.visualStatesRoot) {
        this.visualStatesRoot = createRoot(container);
      }
      this.visualStatesRoot.render(React.createElement(VisualStates, props));
    }
  }
  onVisualStateChanged(state) {
    this.modelProxy.setVisualState(state.name);

    // Interaction state changed, schedule
    this.scheduleRenderPortsView();
  }

  /**
   * STYLE-004: Render the ElementStyleSection (variant + size picker) for nodes
   * that have an ElementConfig registered. Safe to call multiple times — reuses
   * the existing React root.
   */
  renderElementStyleSection() {
    const typeName: string | undefined = this.model.type?.name;
    if (!typeName || !ElementConfigRegistry.has(typeName)) return;

    const variants = ElementConfigRegistry.getVariantNames(typeName);
    const sizes = ElementConfigRegistry.getSizeNames(typeName);
    const currentVariant = this.model.parameters['_variant'] as string | undefined;
    const currentSize = this.model.parameters['_size'] as string | undefined;

    const props = {
      variants,
      currentVariant,
      onVariantChange: this.onElementVariantChange.bind(this),
      sizes,
      currentSize,
      onSizeChange: sizes.length > 0 ? this.onElementSizeChange.bind(this) : undefined
    };

    const container = this.$('.element-style-section')[0];
    if (!container) return;

    if (!this.elementStyleRoot) {
      this.elementStyleRoot = createRoot(container);
    }
    this.elementStyleRoot.render(React.createElement(ElementStyleSection, props));
  }

  /**
   * STYLE-004: Apply a new variant to the node with full undo support.
   * All property changes are batched into a single UndoActionGroup.
   */
  onElementVariantChange(variantName: string) {
    const typeName: string | undefined = this.model.type?.name;
    if (!typeName) return;

    const resolved = ElementConfigRegistry.resolveVariant(typeName, variantName);
    if (!resolved) return;

    const undo = new UndoActionGroup({ label: 'change variant' });

    for (const [key, value] of Object.entries(resolved.baseStyles)) {
      this.model.setParameter(key, value, { undo, label: 'change variant' });
    }
    // Persist the active variant marker
    this.model.setParameter('_variant', variantName, { undo, label: 'change variant' });

    UndoQueue.instance.push(undo);

    // Refresh port list (style changes may affect visible ports)
    this.scheduleRenderPortsView();
    // Refresh the picker to reflect the new selection
    this.renderElementStyleSection();
  }

  /**
   * STYLE-004: Apply a size preset to the node with full undo support.
   * Size overrides are batched into a single UndoActionGroup.
   */
  onElementSizeChange(sizeName: string) {
    const typeName: string | undefined = this.model.type?.name;
    if (!typeName) return;

    const config = ElementConfigRegistry.get(typeName);
    if (!config?.sizes) return;

    const sizePreset = config.sizes[sizeName];
    if (!sizePreset) return;

    const undo = new UndoActionGroup({ label: 'change size' });

    for (const [key, value] of Object.entries(sizePreset)) {
      this.model.setParameter(key, value, { undo, label: 'change size' });
    }
    this.model.setParameter('_size', sizeName, { undo, label: 'change size' });

    UndoQueue.instance.push(undo);

    this.scheduleRenderPortsView();
    this.renderElementStyleSection();
  }

  render() {
    this.el = this.bindView($(PropertyEditorTemplate), this);

    this.portsView = new Ports({
      model: this.modelProxy
    });
    this.renderPortsView();

    this.renderVariantsEditor();

    this.renderVisualStates();

    // STYLE-004: Re-render ElementStyleSection on undo/redo so the picker
    // reflects the restored parameter values.
    this.model.off(this._elementStyleGroup);
    this.model.on(
      ['modelParameterUndo', 'modelParameterRedo'],
      () => {
        this.renderElementStyleSection();
      },
      this._elementStyleGroup
    );
    this.renderElementStyleSection();

    this.parent && this.parent.append(this.el);

    return this.el;
  }

  performDelete() {
    if (!this.model.canBeDeleted()) {
      ToastLayer.showError('This node cannot be deleted');
      return;
    }

    const graph = this.model.owner;
    const undo = new UndoActionGroup({ label: 'delete node' });
    graph.removeNode(this.model, { undo: undo });
    UndoQueue.instance.push(undo);
  }

  _tryPropertyPanelInputInteraction(inputIdentifier: string) {
    const input = document.querySelector(
      `div[data-panel-id="PropertyEditor"] [data-identifier="${inputIdentifier}"]`
    ) as HTMLInputElement | HTMLTextAreaElement | HTMLButtonElement;

    if (input) {
      setTimeout(() => {
        switch (input?.nodeName) {
          case 'BUTTON': {
            input.click();

            // if the button click opens a code editor we want to focus that
            const codeEditor =
              (document.querySelector('.monaco-editor .inputarea') as HTMLTextAreaElement) || undefined;

            if (codeEditor) {
              codeEditor.focus();
            }
            break;
          }

          case 'INPUT': {
            if (input.dataset.type === 'color') {
              input.click();
            } else {
              input.focus();
            }
            break;
          }

          default: {
            input.focus();
          }
        }

        input.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 1);
    }
  }

  doubleClick(node: NodeGraphNode) {
    if (node.metadata?.AiAssistant) {
      const aiButton = document.querySelector<HTMLButtonElement>('button[data-test="ai-code-editor"]');
      if (aiButton) {
        setTimeout(() => {
          aiButton.click();
          $('.monaco-editor .inputarea')[0].focus();
        }, 1);
      }
    } else if (node.type.name === 'CloudFunction2') {
      const functionName = '/#__cloud__/' + node.parameters.function;
      const component = ProjectModel.instance.getComponentWithName(functionName);
      if (component) {
        NodeGraphContextTmp.switchToComponent(component, { pushHistory: true });
      } else {
        ToastLayer.showError('Could not find Cloud Function in project.');
      }
    } else if (node.type.nodeDoubleClickAction) {
      if (Array.isArray(node.type.nodeDoubleClickAction)) {
        node.type.nodeDoubleClickAction.forEach((action) => {
          this._tryPropertyPanelInputInteraction(action.focusPort);
        });
      } else {
        this._tryPropertyPanelInputInteraction(node.type.nodeDoubleClickAction.focusPort);
      }
    }
  }

  /*PropertyEditor.prototype.onMakeRootClicked = function (scope, el, evt) {
    if (ProjectModel.instance.getRootNode() === this.model) {
      ProjectModel.instance.setRootNode(undefined);
      this.isRoot = false;
    }
    else {
      ProjectModel.instance.setRootNode(this.model);
      this.isRoot = true;
    }
  }*/
}
