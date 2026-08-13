import React from 'react';
import { createRoot, Root } from 'react-dom/client';

import { PropertyPanelButton } from '@noodl-core-ui/components/property-panel/PropertyPanelButton';

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
  modalContainer: HTMLDivElement | null = null;
  modalRoot: Root | null = null;
  isModalOpen: boolean = false;
  private root: Root | null = null;

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
    const div = document.createElement('div');
    div.style.width = '100%';

    if (!this.root) {
      this.root = createRoot(div);
    }

    this.renderReact();

    this.el = div;
    return this.el;
  }

  private renderReact() {
    if (!this.root) return;

    this.root.render(
      React.createElement(
        'div',
        {
          className: 'logic-builder-workspace-editor',
          style: { display: 'flex', flexDirection: 'column', gap: '8px', width: '100%' }
        },
        React.createElement(PropertyPanelButton, {
          properties: {
            isPrimary: true,
            buttonLabel: 'Edit Logic Blocks',
            dataIdentifier: this.name,
            onClick: () => this.onEditBlocksClicked()
          }
        }),
        React.createElement(PropertyPanelButton, {
          properties: {
            buttonLabel: 'View Generated Code',
            onClick: () => this.onViewCodeClicked()
          }
        })
      )
    );
  }

  onEditBlocksClicked() {
    // ModelProxy wraps the actual node model in a .model property
    const nodeId = this.parent?.model?.model?.id;
    const nodeName = this.parent?.model?.model?.label || this.parent?.model?.type?.displayName || 'Logic Builder';
    const workspace = this.parent?.model?.getParameter('workspace') || '';
    /**
     * VFN-011 — what the app would actually run for this node, right now.
     *
     * Carried so the block editor's value strip can name the one empty state it could not: a
     * program whose `generatedCode` predates value tracing emits no probes, so no run of it —
     * in the app or on the bench — can ever produce a badge. Read only; the node's parameter is
     * written by the workspace's own flush and by nothing on this path.
     */
    const generatedCode = this.parent?.model?.getParameter('generatedCode') || '';

    console.log('[LogicBuilderWorkspaceType] Opening Logic Builder tab for node:', nodeId);

    // Emit event to open Logic Builder tab
    EventDispatcher.instance.emit('LogicBuilder.OpenTab', {
      nodeId,
      nodeName,
      workspace,
      generatedCode
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

  resetToDefault() {
    this.isDefault = this.getCurrentValue().isDefault;
    this.renderReact();
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
    if (this.root) {
      this.root.unmount();
      this.root = null;
    }
    super.dispose();
  }
}
