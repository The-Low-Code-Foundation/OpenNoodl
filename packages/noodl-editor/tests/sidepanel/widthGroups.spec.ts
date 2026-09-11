/**
 * FIX-009 — one width for the selection slot.
 *
 * `components`, `PropertyEditor` and `PortEditor` take turns in the same slot as
 * the canvas selection changes. Storing a width per panel id meant the first
 * drag wrote one of them and the divider jumped on every select and deselect —
 * the reported "jumping". Equalising the *defaults* (`d12b1329`) held only until
 * that first drag; grouping the storage key is what makes them one slot.
 *
 * The mapping and the read are pure functions precisely so the group is provable
 * without React test infra, which this suite does not have.
 */
import { storedWidthFor, widthKeyFor } from '../../src/editor/src/pages/EditorPage/useSidePanelLayout';

describe('FIX-009 selection slot width group', () => {
  it('maps all three selection-slot panels to one key', () => {
    expect(widthKeyFor('components')).toBe('selection-slot');
    expect(widthKeyFor('PropertyEditor')).toBe('selection-slot');
    expect(widthKeyFor('PortEditor')).toBe('selection-slot');
  });

  it('leaves every other panel keyed by its own id', () => {
    // The control: Search and Docs are sized differently on purpose.
    expect(widthKeyFor('search')).toBe('search');
    expect(widthKeyFor('docs')).toBe('docs');
    expect(widthKeyFor('')).toBe('');
  });

  it('reads one dragged width back for all three panels', () => {
    // Drag Components to 420 -> select a node -> Properties must be 420 too.
    const widths = { 'selection-slot': 420 };
    expect(storedWidthFor(widths, 'components')).toBe(420);
    expect(storedWidthFor(widths, 'PropertyEditor')).toBe(420);
    expect(storedWidthFor(widths, 'PortEditor')).toBe(420);
  });

  it('does not hand a grouped width to an ungrouped panel', () => {
    const widths = { 'selection-slot': 420 };
    expect(storedWidthFor(widths, 'search')).toBeUndefined();
  });

  it('keeps ungrouped panels on their own stored widths', () => {
    const widths = { 'selection-slot': 420, search: 340, docs: 500 };
    expect(storedWidthFor(widths, 'search')).toBe(340);
    expect(storedWidthFor(widths, 'docs')).toBe(500);
    expect(storedWidthFor(widths, 'components')).toBe(420);
  });

  it('falls back to undefined when nothing is stored, so the default applies', () => {
    expect(storedWidthFor({}, 'components')).toBeUndefined();
    expect(storedWidthFor({}, 'search')).toBeUndefined();
  });

  it('inherits a width dragged before the group existed', () => {
    // Upgrade path: without this, every user's sidebar silently resets.
    expect(storedWidthFor({ components: 400 }, 'PropertyEditor')).toBe(400);
    expect(storedWidthFor({ PropertyEditor: 300 }, 'components')).toBe(300);
    expect(storedWidthFor({ PortEditor: 360 }, 'components')).toBe(360);
  });

  it('prefers the group key over a stale legacy entry', () => {
    // The next drag writes the group key; the legacy entry is inert from then on.
    const widths = { 'selection-slot': 420, components: 280, PropertyEditor: 328 };
    expect(storedWidthFor(widths, 'components')).toBe(420);
    expect(storedWidthFor(widths, 'PropertyEditor')).toBe(420);
    expect(storedWidthFor(widths, 'PortEditor')).toBe(420);
  });

  it('resolves legacy entries in a fixed order, whatever the key order', () => {
    // Two legacy widths and no group key: the answer must not depend on which
    // key the settings file happens to list first.
    const widths = { PropertyEditor: 300, components: 400 };
    expect(storedWidthFor(widths, 'PortEditor')).toBe(400);
    expect(storedWidthFor(widths, 'PropertyEditor')).toBe(400);
  });
});
