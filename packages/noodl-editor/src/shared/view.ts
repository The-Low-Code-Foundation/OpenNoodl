/**
 * What is left of the editor's original jQuery MVC base class.
 *
 * The template-binding half — `bindView`, `cloneTemplate`, `this.$()`, the
 * `data-click`/`data-text`/`data-class`/... attribute walker and its
 * getter/setter `watch()` — is gone (PLAT-002 wave 5b), together with the last
 * two runtime `.html` templates and vendored jQuery.
 *
 * All that survives is the per-instance listener bus that ~10 classes still use
 * to talk to their owners, plus the `el` handle React's {@link Frame} appends.
 * This is not a framework to build on: new UI is React under
 * `noodl-core-ui`, and each remaining subclass should shed this base as it is
 * converted.
 */
export default class View {
  /** The view's root element, created by the subclass's `render()`. */
  el: HTMLElement;

  private listeners: { event: string; listener: (args?: TSFixme) => void; group?: TSFixme }[] = [];

  render?(): TSFixme;

  on(event: string, listener: (args?: TSFixme) => void, group?: TSFixme): this {
    this.listeners.push({ event, listener, group });
    return this;
  }

  /** Removes every listener registered under `group`. */
  off(group: TSFixme): this {
    this.listeners = this.listeners.filter((l) => l.group !== group);
    return this;
  }

  notifyListeners(event: string, args?: TSFixme): void {
    // Iterate a copy: listeners commonly call `off()` on themselves.
    for (const l of this.listeners.slice()) {
      if (l.event === event) l.listener(args);
    }
  }
}
