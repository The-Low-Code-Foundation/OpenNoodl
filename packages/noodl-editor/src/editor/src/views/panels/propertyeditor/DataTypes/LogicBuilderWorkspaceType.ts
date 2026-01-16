import React from 'react';
import { createRoot, Root } from 'react-dom/client';

import { EventDispatcher } from '../../../../../../shared/utils/EventDispatcher';
import { GeneratedCodeModal } from '../GeneratedCodeModal';
import { TypeView } from '../TypeView';
import { getEditType } from '../utils';

/**
 * Custom editor for Logic Builder workspace parameter
 * Shows an "Edit Blocks" button that opens the Blockly editor in a tab
 * And a "View Generated Code" button to show the compiled JavaScript
 */
export class LogicBuilderWorkspaceType extends TypeView {
  el: TSFixme;
  editButton: JQuery;
  viewCodeButton: JQuery;
  modalContainer: HTMLDivElement | null = null;
  modalRoot: Root | null = null;
  isModalOpen: boolean = false;

  static fromPort(args) {
    const view = new LogicBuilderWorkspaceType();

    const p = args.port;
    const parent = args.parent;

    view.port = p;
    view.displayName = p.displayName ? p.displayName : p.name;
    view.name = p.name;
    view.type = getEditType(p);
    view.group = null; // Hide group label
    view.tooltip = p.tooltip;
    view.value = parent.model.getParameter(p.name);
    view.parent = parent;
    view.isConnected = parent.model.isPortConnected(p.name, 'target');
    view.isDefault = parent.model.parameters[p.name] === undefined;

    return view;
  }

  render() {
    // Hide empty group labels
    const hideEmptyGroupsCSS = `
      <style>
        /* Hide empty group labels */
        .property-editor-group-name:empty {
          display: none !important;
        }
      </style>
    `;

    // Create a simple container with two buttons
    const html =
      hideEmptyGroupsCSS +
      `
      <div class="property-basic-container logic-builder-workspace-editor" style="display: flex; flex-direction: column; gap: 8px;">
        <button class="edit-blocks-button" 
                style="
                  padding: 8px 16px;
                  background: var(--theme-color-primary);
                  color: white;
                  border: none;
                  border-radius: 4px;
                  cursor: pointer;
                  font-size: 13px;
                  font-weight: 500;
                  transition: background-color 0.2s;
                "
                onmouseover="this.style.backgroundColor='var(--theme-color-primary-hover)'"
                onmouseout="this.style.backgroundColor='var(--theme-color-primary)'">
          Edit Logic Blocks
        </button>
        <button class="view-code-button" 
                style="
                  padding: 8px 16px;
                  background: var(--theme-color-bg-3);
                  color: var(--theme-color-fg-default);
                  border: 1px solid var(--theme-color-border-default);
                  border-radius: 4px;
                  cursor: pointer;
                  font-size: 13px;
                  font-weight: 500;
                  transition: background-color 0.2s;
                "
                onmouseover="this.style.backgroundColor='var(--theme-color-bg-4)'"
                onmouseout="this.style.backgroundColor='var(--theme-color-bg-3)'">
          View Generated Code
        </button>
      </div>
    `;

    this.el = this.bindView($(html), this);

    // Get references to buttons
    this.editButton = this.el.find('.edit-blocks-button');
    this.viewCodeButton = this.el.find('.view-code-button');

    // Handle button clicks
    this.editButton.on('click', () => {
      this.onEditBlocksClicked();
    });

    this.viewCodeButton.on('click', () => {
      this.onViewCodeClicked();
    });

    // Call parent render for common functionality (tooltips, etc.)
    TypeView.prototype.render.call(this);

    // Show/hide the "changed" dot based on whether value is default
    this.updateChangedDot();

    return this.el;
  }

  onEditBlocksClicked() {
    // ModelProxy wraps the actual node model in a .model property
    const nodeId = this.parent?.model?.model?.id;
    const nodeName = this.parent?.model?.model?.label || this.parent?.model?.type?.displayName || 'Logic Builder';
    const workspace = this.parent?.model?.getParameter('workspace') || '';

    console.log('[LogicBuilderWorkspaceType] Opening Logic Builder tab for node:', nodeId);

    // Emit event to open Logic Builder tab
    EventDispatcher.instance.emit('LogicBuilder.OpenTab', {
      nodeId,
      nodeName,
      workspace
    });
  }

  onViewCodeClicked() {
    const nodeName = this.parent?.model?.model?.label || this.parent?.model?.type?.displayName || 'Logic Builder';
    const generatedCode = this.parent?.model?.getParameter('generatedCode') || '';

    console.log('[LogicBuilderWorkspaceType] Opening generated code modal for node:', nodeName);

    this.showModal(nodeName, generatedCode);
  }

  showModal(nodeName: string, code: string) {
    // Create modal container if it doesn't exist
    if (!this.modalContainer) {
      this.modalContainer = document.createElement('div');
      this.modalContainer.id = 'generated-code-modal-container';
      document.body.appendChild(this.modalContainer);
      this.modalRoot = createRoot(this.modalContainer);
    }

    this.isModalOpen = true;
    this.renderModal(nodeName, code);
  }

  hideModal() {
    this.isModalOpen = false;
    this.renderModal('', '');
  }

  renderModal(nodeName: string, code: string) {
    if (!this.modalRoot) return;

    this.modalRoot.render(
      React.createElement(GeneratedCodeModal, {
        isOpen: this.isModalOpen,
        nodeName: nodeName,
        code: code,
        onClose: () => this.hideModal()
      })
    );
  }

  updateChangedDot() {
    const dot = this.el.find('.property-changed-dot');
    if (this.isDefault) {
      dot.hide();
    } else {
      dot.show();
    }
  }

  resetToDefault() {
    // Reset workspace to empty
    this.parent.model.setParameter(this.name, undefined, {
      undo: true,
      label: 'reset workspace'
    });
    this.isDefault = true;
    this.updateChangedDot();
  }

  dispose() {
    // Clean up modal when view is disposed
    if (this.modalRoot) {
      this.modalRoot.unmount();
      this.modalRoot = null;
    }
    if (this.modalContainer && this.modalContainer.parentNode) {
      this.modalContainer.parentNode.removeChild(this.modalContainer);
      this.modalContainer = null;
    }
  }
}
