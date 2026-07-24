export default class View {
  /**
   * Converted views expose a raw `HTMLElement`, legacy ones a jQuery set.
   * Narrows back to `HTMLElement` once `view.js` is retired (PLAT-002 wave 5).
   */
  el: HTMLElement | JQuery<HTMLElement>;

  render(): TSFixme;

  static $(el, selector): JQuery<HTMLElement>;

  static showTooltip(args): void;
  static hideTooltip(args): void;

  $(selector): any;

  on(event: string, listener: (...args: TSFixme) => void, group?: any): View;
  off(group): View;
  notifyListeners(event, args?): void;

  cloneTemplate(tmpl): TSFixme;

  bindView(el, obj?): TSFixme;
}
