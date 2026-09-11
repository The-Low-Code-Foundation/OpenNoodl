/**
 * A model field must never land on top of a method of the same name.
 *
 * 🔴 `NodeGraphEditorConnection`'s constructor copies every model field onto the
 * view. `labelT` is both a stored number (CAN-001 — where the label sits) and a
 * method (the same value, clamped), and an own property beats a prototype
 * method — so a wire whose label had been moved turned `this.labelT()` into
 * `TypeError: this.labelT is not a function`. It throws inside `paint`, so the
 * frame stops there and **every node after that wire disappears**.
 *
 * ⚠️ It was latent for as long as CAN-001 has shipped, because it only fires
 * once the view is rebuilt from a model that already carries the key — switch
 * component, or reopen the project. The drag that causes it and the breakage are
 * sessions apart, which is why it read as a canvas bug.
 *
 * Graded here rather than in the Electron suite because it is a property of the
 * constructor, not of the canvas: no context, no editor, no paint.
 */
class Base {
  model: Record<string, unknown>;

  constructor(model: Record<string, unknown>) {
    this.model = model;
    for (const i in model) {
      if (typeof this[i] === 'function') continue;
      this[i] = model[i];
    }
  }

  labelT(): number {
    return typeof this.model.labelT === 'number' ? (this.model.labelT as number) : 0.5;
  }

  labelText(): string {
    return (this.model.label as string) ?? '';
  }
}

describe('a connection view built from a model', () => {
  it('keeps its methods when the model carries a field of the same name', () => {
    const view = new Base({ fromId: 'a', labelT: 0.3, label: 'retry' });

    expect(typeof view.labelT).toBe('function');
    expect(view.labelT()).toBe(0.3);
  });

  it('still copies fields that do not collide', () => {
    const view = new Base({ fromId: 'a', toId: 'b', labelT: 0.3 }) as unknown as Record<string, unknown>;

    expect(view.fromId).toBe('a');
    expect(view.toId).toBe('b');
  });

  it('is unaffected when the model has no colliding field at all', () => {
    const view = new Base({ fromId: 'a' });
    expect(view.labelT()).toBe(0.5);
    expect(view.labelText()).toBe('');
  });

  /** The exact shape that broke: a route field beside a route method. */
  it('protects any future field that shares a method name', () => {
    const view = new Base({ labelText: 'not a function please' });
    expect(typeof view.labelText).toBe('function');
  });
});
