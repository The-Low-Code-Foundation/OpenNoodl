/**
 * FB-017 — what the property panel remembers, graded against a real store.
 *
 * The store is a plain object standing in for disk, not a mock of the class under test, so
 * every assertion here is about the module's own behaviour: which groups start open, what gets
 * written when one is toggled, and what is deliberately *not* written.
 */

import { ADVANCED_CSS_GROUP } from '../../src/editor/src/views/panels/propertyeditor/propertyPanelTiers';
import {
  GROUP_EXPANSION_SETTINGS_KEY,
  PropertyPanelViewState,
  SCROLL_MEMORY_LIMIT,
  defaultExpansionFor,
  parseGroupExpansion
} from '../../src/editor/src/views/panels/propertyeditor/propertyPanelViewState';

/** A settings store that records what it was asked to keep. */
function fakeStore(initial?: unknown) {
  const values: Record<string, unknown> = {};
  if (initial !== undefined) values[GROUP_EXPANSION_SETTINGS_KEY] = initial;

  return {
    values,
    writes: 0,
    get(key: string) {
      return values[key];
    },
    set(key: string, value: unknown) {
      values[key] = value;
      this.writes++;
    }
  };
}

describe('defaults', () => {
  it('collapses Advanced CSS and nothing else', () => {
    expect(defaultExpansionFor(ADVANCED_CSS_GROUP)).toBe(false);

    for (const name of ['General', 'Dimensions', 'Margin and padding', 'Some Kit Heading']) {
      expect(defaultExpansionFor(name)).toBe(true);
    }
  });

  it('opens every heading a fresh user has never touched', () => {
    const state = new PropertyPanelViewState(fakeStore());

    expect(state.isExpanded('Dimensions')).toBe(true);
    expect(state.isExpanded(ADVANCED_CSS_GROUP)).toBe(false);
  });
});

describe('parseGroupExpansion', () => {
  it('keeps booleans and drops everything else', () => {
    expect(parseGroupExpansion({ a: true, b: false, c: 'yes', d: 1, e: null })).toEqual({ a: true, b: false });
  });

  it('answers a malformed blob with defaults rather than a repaired version of nonsense', () => {
    for (const junk of [null, undefined, 'nope', 42, ['a'], true]) {
      expect(parseGroupExpansion(junk)).toEqual({});
    }
  });

  /** A stored blob from an older build must not shut sections a user never closed. */
  it('degrades a junk blob to open headings, not arbitrary closed ones', () => {
    const state = new PropertyPanelViewState(fakeStore('this used to be something else'));
    expect(state.isExpanded('Dimensions')).toBe(true);
  });
});

describe('remembering a toggle', () => {
  it('reads back what was set, in the same session', () => {
    const state = new PropertyPanelViewState(fakeStore());

    state.setExpanded(ADVANCED_CSS_GROUP, true);
    expect(state.isExpanded(ADVANCED_CSS_GROUP)).toBe(true);

    state.setExpanded('Dimensions', false);
    expect(state.isExpanded('Dimensions')).toBe(false);
  });

  /** AC1: expansion survives an editor restart. A restart is a new instance over the same store. */
  it('survives a restart', () => {
    const store = fakeStore();

    const before = new PropertyPanelViewState(store);
    before.setExpanded(ADVANCED_CSS_GROUP, true);
    before.setExpanded('Box Shadow', false);

    const after = new PropertyPanelViewState(store);
    expect(after.isExpanded(ADVANCED_CSS_GROUP)).toBe(true);
    expect(after.isExpanded('Box Shadow')).toBe(false);
    expect(after.isExpanded('Dimensions')).toBe(true);
  });

  it('stores only deliberate choices, so a default changed later still reaches the user', () => {
    const store = fakeStore();
    const state = new PropertyPanelViewState(store);

    state.setExpanded(ADVANCED_CSS_GROUP, true);
    expect(store.values[GROUP_EXPANSION_SETTINGS_KEY]).toEqual({ [ADVANCED_CSS_GROUP]: true });

    // Back to the default — the entry goes away rather than being written as `false`.
    state.setExpanded(ADVANCED_CSS_GROUP, false);
    expect(store.values[GROUP_EXPANSION_SETTINGS_KEY]).toEqual({});
  });

  it('writes a fresh object rather than handing the store its own live map', () => {
    // A stored reference the panel keeps mutating is a settings blob that changes without a
    // write, which `EditorSettings`' debounced store would then persist at an arbitrary moment.
    const store = fakeStore();
    const state = new PropertyPanelViewState(store);

    state.setExpanded('Dimensions', false);
    const written = store.values[GROUP_EXPANSION_SETTINGS_KEY];

    state.setExpanded('Box Shadow', false);
    expect(written).toEqual({ Dimensions: false });
  });
});

describe('remembering a scroll offset', () => {
  it('is per node, and starts at the top for a node never visited', () => {
    const state = new PropertyPanelViewState(fakeStore());

    state.setScroll('node-a', 240);
    expect(state.getScroll('node-a')).toBe(240);
    expect(state.getScroll('node-b')).toBe(0);
  });

  it('ignores an offset that is not a place anybody scrolled to', () => {
    const state = new PropertyPanelViewState(fakeStore());

    state.setScroll('node-a', 120);
    state.setScroll('node-a', -5);
    state.setScroll('node-a', NaN);
    state.setScroll('node-a', Infinity);

    expect(state.getScroll('node-a')).toBe(120);
  });

  it('remembers nothing for a view that has no node behind it', () => {
    const state = new PropertyPanelViewState(fakeStore());

    state.setScroll(undefined, 90);
    expect(state.getScroll(undefined)).toBe(0);
  });

  it('never persists a scroll offset', () => {
    // Deliberate: an offset measured against a panel that has since changed height is a stale
    // number, and restoring one on a fresh editor start scrolls a builder somewhere they have
    // never been.
    const store = fakeStore();
    const state = new PropertyPanelViewState(store);

    state.setScroll('node-a', 300);
    expect(store.writes).toBe(0);
    expect(store.values[GROUP_EXPANSION_SETTINGS_KEY]).toBeUndefined();
  });

  it('evicts the least recently touched node once it is full', () => {
    const state = new PropertyPanelViewState(fakeStore());

    for (let i = 0; i < SCROLL_MEMORY_LIMIT; i++) state.setScroll(`node-${i}`, i + 1);
    expect(state.getScroll('node-0')).toBe(1);

    // Touching node-0 again must make it the newest, not leave it the oldest.
    state.setScroll('node-0', 999);
    state.setScroll('overflow', 5);

    expect(state.getScroll('node-0')).toBe(999);
    expect(state.getScroll('node-1')).toBe(0);
    expect(state.getScroll('overflow')).toBe(5);
  });
});
