import { EventDispatcher } from '../../../../../shared/utils/EventDispatcher';
import View from '../../../../../shared/ListenableView';

/**
 * Base class for the property-editor rows.
 *
 * Every row is now a React component mounted into `el` (a raw `HTMLElement`),
 * so the chrome this class used to wire up by hand — the connected-port
 * tooltip, the input focus class and the reset-to-default dot — lives in the
 * components instead (`PropertyPanelInput` / `PropertyPanelRow`). What is left
 * here is the model-side behaviour shared by all rows.
 */
export class TypeView extends View {
  port: TSFixme;
  displayName: TSFixme;
  name: TSFixme;
  type: TSFixme;
  group: TSFixme;
  parent: TSFixme;
  value: TSFixme;
  default: TSFixme;
  tooltip: TSFixme;
  isConnected: TSFixme;
  isDefault: TSFixme;
  el: TSFixme;

  /**
   * Own listener group for the style watch below. Subclasses call
   * `EventDispatcher.instance.off(this)` when they (re)subscribe, which would
   * otherwise take this subscription with it.
   */
  private readonly styleWatchGroup: Record<string, never> = {};

  dispose() {
    EventDispatcher.instance.off(this);
    EventDispatcher.instance.off(this.styleWatchGroup);
  }

  /**
   * If the port has a "parentPort" its default value is derived from a text
   * style, so the row has to refresh whenever that style changes. Called by
   * `Ports` for every row it creates.
   */
  bindStyleDefaultWatch() {
    if (!(this.parent.model && this.parent.model.model)) return;

    EventDispatcher.instance.off(this.styleWatchGroup); // safeguard against multiple renders

    const port = this.parent.model.model.getPort(this.name);
    if (!port || !port.type || !port.type.parentPort) return;

    EventDispatcher.instance.on(
      'ProjectModel.metadataChanged',
      ({ key }) => {
        // only need to update if we're at the default value
        if (key === 'styles' && this.isDefault) {
          this.resetToDefault();
        }
      },
      this.styleWatchGroup
    );
  }

  render() {
    this.bindStyleDefaultWatch();

    return this.el;
  }

  getCurrentValue(name?: string) {
    const _name = name === undefined ? this.name : name;

    if (this.parent.model.hasParameter && !this.parent.model.hasParameter(_name)) {
      // Happens for dynamic port sometimes
      return '' as TSFixme;
    }

    return {
      value: this.parent.model.getParameter(_name),
      isDefault: this.parent.model.parameters[_name] === undefined
    };
  }

  /**
   * Despite the name this does not reset anything — it re-reads the current
   * value from the model and updates the row. Rows that need to derive extra
   * state from the value override it and call `renderReact` themselves.
   */
  resetToDefault() {
    // Every converted row implements `renderReact`; the visibility varies, so
    // this is reached through a cast rather than a declared base member.
    const self = this as TSFixme;
    self.renderReact && self.renderReact();
  }
}
