/**
 * A root element plus a per-instance listener bus — all that survives of the
 * editor's original jQuery MVC base class (renamed from `shared/view.ts` by
 * DEBT-010; the old name promised a view framework that PLAT-002 deleted).
 *
 * ~10 classes still extend this to talk to their owners via
 * `on`/`off`/`notifyListeners`, plus the `el` handle React's {@link Frame}
 * appends. This is not a framework to build on: new UI is React under
 * `noodl-core-ui`, and each remaining subclass should shed this base as it is
 * converted.
 */
export default class ListenableView {
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
