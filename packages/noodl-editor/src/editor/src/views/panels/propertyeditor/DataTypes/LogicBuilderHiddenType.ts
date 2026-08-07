import { TypeView } from '../TypeView';
import { getEditType } from '../utils';

/**
 * Hidden editor type for internal Logic Builder parameters
 * Renders nothing - used for parameters that need to be stored
 * but should not appear in the property panel
 */
export class LogicBuilderHiddenType extends TypeView {
  el: TSFixme;

  static fromPort(args) {
    const view = new LogicBuilderHiddenType();

    const p = args.port;
    const parent = args.parent;

    view.port = p;
    view.displayName = p.displayName ? p.displayName : p.name;
    view.name = p.name;
    view.type = getEditType(p);
    view.group = null; // No group
    view.tooltip = p.tooltip;
    view.value = parent.model.getParameter(p.name);
    view.parent = parent;
    view.isConnected = parent.model.isPortConnected(p.name, 'target');
    view.isDefault = parent.model.parameters[p.name] === undefined;

    return view;
  }

  render() {
    // Render an empty, invisible element
    // This is necessary because the property panel expects something to be returned
    // but we want it to take up no space
    const div = document.createElement('div');
    div.style.display = 'none';
    this.el = div;
    return this.el;
  }

  dispose() {
    // Nothing to clean up
  }
}
