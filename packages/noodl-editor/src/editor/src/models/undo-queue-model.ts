import Model from '../../../shared/model';

export class UndoQueue extends Model {
  public static instance = new UndoQueue();

  private ptr: number;
  private queue: UndoActionGroup[];

  constructor() {
    super();

    this.ptr = 0;
    this.queue = [];
  }

  getHistoryLocation(): number {
    return this.ptr;
  }

  getHistory(): readonly UndoActionGroup[] {
    return this.queue;
  }

  push(action: UndoActionGroup) {
    this.ptr !== this.queue.length && this.queue.splice(this.ptr);

    this.queue.push(action);
    this.ptr = this.queue.length;

    this.notifyListeners('undoHistoryChanged');
  }

  pushAndDo(action: UndoActionGroup) {
    this.push(action);
    action.do && action.do();
  }

  undo() {
    if (this.ptr > 0) {
      var action = this.queue[this.ptr - 1];
      action.undo && action.undo();
      this.ptr--;

      this.notifyListeners('undo');

      return action;
    }
  }

  redo() {
    if (this.queue.length > this.ptr) {
      var action = this.queue[this.ptr];
      action.do && action.do();
      this.ptr++;

      this.notifyListeners('redo');

      return action;
    }
  }

  clear() {
    this.ptr = 0;
    this.queue = [];
  }
}

export interface UndoActionGroupActions {
  do?: () => void;
  undo?: () => void;
}

export type UndoActionGroupOptions = UndoActionGroupActions & {
  label: string;
};

export class UndoActionGroup {
  public label: string;

  private actions: UndoActionGroupActions[];
  private ptr: number;

  /**
   * NB: passing `do`/`undo` here records the action but leaves `ptr` at 0, and
   * `undo()` loops from `ptr - 1`. So a group built this way and handed to
   * `UndoQueue.push` **cannot be undone** — the loop runs from -1. It works
   * with `UndoQueue.pushAndDo` only because `do()` advances the pointer on the
   * way in, which is why every existing caller of the constructor form is a
   * `pushAndDo` caller.
   *
   * If your change has *already been applied* and you only want to record its
   * inverse, construct with the label alone and use `push()`, which advances
   * the pointer without executing. `StyleTokensModel.pushAppliedUndo` is the
   * worked example; `tests/models/StyleTokensUndo.test.ts` pins the behaviour.
   */
  constructor(args: UndoActionGroupOptions) {
    this.ptr = 0;
    this.label = args.label;
    this.actions = [];

    // Push the initial action
    if (args.do || args.undo) {
      this.actions.push({
        do: args.do,
        undo: args.undo
      });
    }
  }

  push(a: UndoActionGroupActions) {
    this.actions.push(a);

    this.ptr = this.actions.length;
  }

  pushAndDo(a: UndoActionGroupActions) {
    this.push(a);

    a.do && a.do();
  }

  do() {
    for (var i = this.ptr; i < this.actions.length; i++) {
      var a = this.actions[i];
      a.do && a.do();
    }
    this.ptr = this.actions.length;
  }

  undo() {
    for (var i = this.ptr - 1; i >= 0; i--) {
      var a = this.actions[i];
      a.undo && a.undo();
    }
    this.ptr = 0;
  }

  isEmpty() {
    return this.actions.length === 0;
  }
}
