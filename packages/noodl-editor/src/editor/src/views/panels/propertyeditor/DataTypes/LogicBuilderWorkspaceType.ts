import { EventDispatcher } from '../../../../../../shared/utils/EventDispatcher';
import { TypeView } from '../TypeView';
import { getEditType } from '../utils';

/**
 * Custom editor for Logic Builder workspace parameter
 * Shows an "Edit Blocks" button that opens the Blockly editor in a tab
 */
export class LogicBuilderWorkspaceType extends TypeView {
  el: TSFixme;
  editButton: JQuery;

  static fromPort(args) {
    const view = new LogicBuilderWorkspaceType();

    const p = args.port;
    const parent = args.parent;

    view.port = p;
    view.displayName = p.displayName ? p.displayName : p.name;
    view.name = p.name;
    view.type = getEditType(p);
    view.group = p.group;
    view.tooltip = p.tooltip;
    view.value = parent.model.getParameter(p.name);
    view.parent = parent;
    view.isConnected = parent.model.isPortConnected(p.name, 'target');
    view.isDefault = parent.model.parameters[p.name] === undefined;

    return view;
  }

  render() {
    // Create a simple container with a button
    const html = `
      <div class="property-basic-container logic-builder-workspace-editor">
        <div class="property-label-container" style="display: flex; align-items: center; gap: 8px;">
          <div class="property-changed-dot" data-click="resetToDefault" style="display: none;"></div>
          <div class="property-label">${this.displayName}</div>
        </div>
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
          ✨ Edit Logic Blocks
        </button>
      </div>
    `;

    this.el = this.bindView($(html), this);

    // Get reference to button
    this.editButton = this.el.find('.edit-blocks-button');

    // Handle button click
    this.editButton.on('click', () => {
      this.onEditBlocksClicked();
    });

    // Call parent render for common functionality (tooltips, etc.)
    TypeView.prototype.render.call(this);

    // Show/hide the "changed" dot based on whether value is default
    this.updateChangedDot();

    return this.el;
  }

  onEditBlocksClicked() {
    const nodeId = this.parent.model.id;
    const nodeName = this.parent.model.label || this.parent.model.getDisplayName() || 'Logic Builder';
    const workspace = this.parent.model.getParameter('workspace') || '';

    console.log('[LogicBuilderWorkspaceType] Opening tab for node:', nodeId);

    // Emit event to open Logic Builder tab
    EventDispatcher.instance.emit('LogicBuilder.OpenTab', {
      nodeId,
      nodeName,
      workspace
    });
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
}
