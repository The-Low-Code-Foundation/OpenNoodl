import { StyleTokensModel } from '@noodl-models/StyleTokensModel/StyleTokensModel';
import { UndoActionGroup, UndoQueue } from '@noodl-models/undo-queue-model';

/**
 * Undo for design-token edits.
 *
 * These shipped broken, and the reason is a trap worth pinning down rather than
 * just fixing: `UndoActionGroup`'s constructor appends its `{do, undo}` pair
 * straight to the group's action array but leaves the group's pointer at 0, and
 * `undo()` loops from `ptr - 1`. So a group built that way and handed to
 * `UndoQueue.push` has nothing to undo. Fifteen call sites elsewhere in the
 * editor never see it because they go through `pushAndDo`, whose `do()`
 * advances the pointer on the way in. The four token operations do not: they
 * apply the change themselves and then record it, so there is nothing left to
 * `do()`, and ⌘Z after a token change did nothing at all.
 *
 * The last describe block asserts the trap directly, so that a future caller
 * reaching for the constructor form finds a red spec rather than a dead undo.
 */
describe('StyleTokensModel undo', () => {
  let tokens: StyleTokensModel;
  let originalQueue: UndoQueue;

  beforeEach(() => {
    // A private queue per spec. The editor's is a singleton, and leaning on it
    // here would make these specs order-dependent — the exact disease the
    // import/export specs in this suite already have.
    originalQueue = UndoQueue.instance;
    UndoQueue.instance = new UndoQueue();
    tokens = new StyleTokensModel();
  });

  afterEach(() => {
    UndoQueue.instance = originalQueue;
  });

  it('undoes a change to a default token, restoring the default value', () => {
    const before = tokens.getToken('--primary');
    expect(before).toBeDefined();
    const defaultValue = before.value;

    tokens.setToken('--primary', '#abcdef', { undo: true });
    expect(tokens.getToken('--primary').value).toBe('#abcdef');

    UndoQueue.instance.undo();

    expect(tokens.getToken('--primary').value).toBe(defaultValue);
  });

  it('undoes an added custom token', () => {
    tokens.addCustomToken({ name: '--spec-added', value: '#123456', category: 'color-semantic' }, { undo: true });
    expect(tokens.getToken('--spec-added')).toBeDefined();

    UndoQueue.instance.undo();

    expect(tokens.getToken('--spec-added')).toBeUndefined();
  });

  it('undoes a deleted custom token, restoring its value and category', () => {
    tokens.addCustomToken({ name: '--spec-deleted', value: '#654321', category: 'color-semantic' });
    tokens.deleteCustomToken('--spec-deleted', { undo: true });
    expect(tokens.getToken('--spec-deleted')).toBeUndefined();

    UndoQueue.instance.undo();

    const restored = tokens.getToken('--spec-deleted');
    expect(restored).toBeDefined();
    expect(restored.value).toBe('#654321');
    expect(restored.category).toBe('color-semantic');
  });

  it('undoes reset-all, restoring every custom token', () => {
    tokens.addCustomToken({ name: '--spec-one', value: '#111111', category: 'color-semantic' });
    tokens.addCustomToken({ name: '--spec-two', value: '#222222', category: 'color-semantic' });
    tokens.setToken('--primary', '#333333');

    tokens.resetAllToDefaults({ undo: true });
    expect(tokens.getToken('--spec-one')).toBeUndefined();

    UndoQueue.instance.undo();

    expect(tokens.getToken('--spec-one').value).toBe('#111111');
    expect(tokens.getToken('--spec-two').value).toBe('#222222');
    expect(tokens.getToken('--primary').value).toBe('#333333');
  });

  it('redoes after an undo', () => {
    tokens.setToken('--primary', '#abcdef', { undo: true });
    UndoQueue.instance.undo();
    expect(tokens.getToken('--primary').value).not.toBe('#abcdef');

    UndoQueue.instance.redo();

    expect(tokens.getToken('--primary').value).toBe('#abcdef');
  });

  it('records one undo step per edit', () => {
    tokens.setToken('--primary', '#aaaaaa', { undo: true });
    tokens.setToken('--primary', '#bbbbbb', { undo: true });

    expect(UndoQueue.instance.getHistory().length).toBe(2);

    UndoQueue.instance.undo();
    expect(tokens.getToken('--primary').value).toBe('#aaaaaa');
  });

  it('does not touch the undo queue when the caller did not ask for undo', () => {
    tokens.setToken('--primary', '#cccccc');
    expect(UndoQueue.instance.getHistory().length).toBe(0);
  });
});

describe('UndoActionGroup constructor trap', () => {
  it('a constructor-built group handed to push has a dead undo — use group.push instead', () => {
    let undone = 0;

    // The broken form: the action goes in via the constructor, so the group's
    // pointer never advances past it.
    const viaConstructor = new UndoActionGroup({
      label: 'constructor form',
      do: () => undefined,
      undo: () => undone++
    });
    viaConstructor.undo();
    expect(undone).toBe(0);

    // The form every already-applied change should use.
    const viaPush = new UndoActionGroup({ label: 'push form' });
    viaPush.push({ do: () => undefined, undo: () => undone++ });
    viaPush.undo();
    expect(undone).toBe(1);
  });
});
