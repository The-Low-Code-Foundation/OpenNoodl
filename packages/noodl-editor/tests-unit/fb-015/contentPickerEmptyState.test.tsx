/**
 * FB-015 AC1 + AC5 — the picker says why it is empty, and the empty state is shared.
 *
 * `ContentPicker` is a pure function of props and calls no hooks, so it is rendered end-to-end
 * here (see `support/renderElements`). The copy comes from `pickerEmptyStates`, which is also
 * real — these are the strings the editor draws, not a source-text echo of them.
 */
import React from 'react';

import { ContentPicker, ContentPickerItem } from '../../src/editor/src/views/panels/propertyeditor/components/ContentPicker';
import {
  identifierPickerEmptyState,
  imagePickerActions,
  imagePickerEmptyState,
  sourceCodePickerActions,
  sourceCodePickerEmptyState
} from '../../src/editor/src/views/panels/propertyeditor/components/pickerEmptyStates';
import { PropertyPanelBaseInput } from '@noodl-core-ui/components/property-panel/PropertyPanelBaseInput';

import { byClass, render, text } from '../support/renderElements';

const NO_ROUTES = { onImport: () => undefined, onShowProjectFolder: () => undefined };

const IMAGE_EMPTY = imagePickerEmptyState();

function anImage(fullPath: string): ContentPickerItem {
  return { name: fullPath.split('/').pop(), fullPath, folder: '/', thumbnail: '' };
}

describe('FB-015 AC1 — the three no-rows states are different pictures', () => {
  /**
   * 🔴 THE CONTROL, and not a formality. Every "the empty state is showing" claim below is only
   * worth something beside an arm where the picker demonstrably draws items — `render` returns a
   * tree for a component that drew nothing and for one that was never called, and three of the
   * four states here are "the list is not showing".
   */
  it('draws the items and none of the messages when there are items', () => {
    const tree = render(
      <ContentPicker
        title="Choose image"
        items={[anImage('assets/logo.png')]}
        emptyState={IMAGE_EMPTY}
        onSelect={() => undefined}
      />
    );

    expect(byClass(tree, 'content-picker-list-item').length).toBe(1);
    expect(byClass(tree, 'content-picker-empty').length).toBe(0);
    expect(byClass(tree, 'content-picker-message').length).toBe(0);
    // The row shows the file's name; `fullPath` is what a click commits and what the filter reads.
    expect(text(tree)).toContain('logo.png');
  });

  /**
   * 🔴 The filed bug. Before this task the loading state and the empty state were the same blank
   * panel, so an author with no images and an author whose walk had silently returned early saw
   * identical bytes — and `ImageType`'s `if (!filesLeft) return` meant the second was the one that
   * actually happened.
   */
  it('says it is still looking, and does NOT claim the project is empty', () => {
    const tree = render(
      <ContentPicker
        title="Choose image"
        items={[]}
        isLoading
        emptyState={IMAGE_EMPTY}
        onSelect={() => undefined}
      />
    );

    expect(byClass(tree, 'content-picker-message').length).toBe(1);
    expect(byClass(tree, 'content-picker-empty').length).toBe(0);
    expect(text(tree)).not.toContain('no images yet');
  });

  it('explains the empty project once the walk has reported', () => {
    const tree = render(
      <ContentPicker
        title="Choose image"
        items={[]}
        isLoading={false}
        emptyState={IMAGE_EMPTY}
        onSelect={() => undefined}
      />
    );

    expect(byClass(tree, 'content-picker-empty').length).toBe(1);
    expect(byClass(tree, 'content-picker-list-item').length).toBe(0);
  });

  /**
   * A filter that excludes everything is a fourth state, and it must not read as "this project has
   * no images" — the author has images; they are just not these.
   *
   * ⚠️ `rows` also carries folder headings, so a filter that hides every item still leaves a
   * non-empty row list. The count under test is of items, which is why the group label is asserted
   * gone rather than assumed absent.
   */
  it('says nothing matches the filter, rather than that the project is empty', () => {
    const tree = render(
      <ContentPicker
        title="Choose image"
        items={[{ ...anImage('pictures/logo.png'), folder: 'pictures' }]}
        filter="zzz"
        isLoading={false}
        emptyState={IMAGE_EMPTY}
        onSelect={() => undefined}
      />
    );

    expect(byClass(tree, 'content-picker-message').length).toBe(1);
    expect(byClass(tree, 'content-picker-empty').length).toBe(0);
    expect(byClass(tree, 'content-picker-group-label').length).toBe(0);
    expect(text(tree)).toContain('zzz');
    expect(text(tree)).not.toContain('no images yet');
  });

  it('draws nothing extra when a picker supplies no empty state at all', () => {
    const tree = render(<ContentPicker title="Choose font" items={[]} isLoading={false} onSelect={() => undefined} />);

    expect(byClass(tree, 'content-picker-empty').length).toBe(0);
    expect(byClass(tree, 'content-picker-message').length).toBe(0);
  });
});

describe('FB-015 AC1 — the image picker names both routes and offers Import', () => {
  function imageEmptyPicker(routes = NO_ROUTES) {
    return render(
      <ContentPicker
        title="Choose image"
        items={[]}
        isLoading={false}
        emptyState={IMAGE_EMPTY}
        actions={imagePickerActions(routes)}
        onSelect={() => undefined}
      />
    );
  }

  it('states why it is empty', () => {
    expect(text(imageEmptyPicker())).toContain('no images yet');
  });

  /** Both of the report's two routes — "either add a URL, or add an image to your project folder". */
  it('names the URL route and the file route', () => {
    const shown = text(imageEmptyPicker()).toLowerCase();
    expect(shown).toContain('url');
    expect(shown).toContain('assets/');
  });

  it('offers Import and Show project folder as buttons', () => {
    const labels = byClass(imageEmptyPicker(), 'content-picker-empty-action').map((n) => n.ownText);
    expect(labels).toEqual(['Import image…', 'Show project folder']);
  });

  /**
   * 🔴 A button that draws and does nothing is the same picture as one that works. The handlers
   * are pulled off the rendered tree and invoked, so the wiring is graded rather than the label.
   */
  it('wires each button to the route it is labelled with', () => {
    const called: string[] = [];
    const tree = imageEmptyPicker({
      onImport: () => called.push('import'),
      onShowProjectFolder: () => called.push('folder')
    });

    const buttons = byClass(tree, 'content-picker-empty-action');
    (buttons[0].props.onClick as () => void)();
    (buttons[1].props.onClick as () => void)();

    expect(called).toEqual(['import', 'folder']);
  });
});

/**
 * 🔴 FOUND BY AC2's DRIVE, not by any of the specs above.
 *
 * The actions started life inside `ContentPickerEmptyState`. Every spec passed, and the live
 * import worked — and then the picker refilled, the empty state went away, and **the Import
 * button went with it**. There was no way to import a second image. Nothing here could have
 * caught it, because every arm above renders an EMPTY picker: the state where the button was
 * missing was the one nothing thought to look at.
 */
describe('FB-015 — the routes out of the picker survive the picker filling up', () => {
  function pickerWith(items: ContentPickerItem[]) {
    return render(
      <ContentPicker
        title="Choose image"
        items={items}
        isLoading={false}
        emptyState={imagePickerEmptyState()}
        actions={imagePickerActions(NO_ROUTES)}
        onSelect={() => undefined}
      />
    );
  }

  it('offers Import when the project is empty', () => {
    const labels = byClass(pickerWith([]), 'content-picker-empty-action').map((n) => n.ownText);
    expect(labels).toContain('Import image…');
  });

  it('STILL offers Import once the project has an image', () => {
    const tree = pickerWith([anImage('assets/logo.png')]);

    // The list is showing — so this is the state the first drive left the editor in.
    expect(byClass(tree, 'content-picker-list-item').length).toBe(1);
    expect(byClass(tree, 'content-picker-empty').length).toBe(0);
    // …and the way to add a second one is still on screen.
    expect(byClass(tree, 'content-picker-empty-action').map((n) => n.ownText)).toContain('Import image…');
  });

  it('offers Import even when a filter has hidden every row', () => {
    const tree = render(
      <ContentPicker
        title="Choose image"
        items={[anImage('assets/logo.png')]}
        filter="zzz"
        isLoading={false}
        emptyState={imagePickerEmptyState()}
        actions={imagePickerActions(NO_ROUTES)}
        onSelect={() => undefined}
      />
    );
    expect(byClass(tree, 'content-picker-empty-action').map((n) => n.ownText)).toContain('Import image…');
  });

  it('draws no footer at all for a picker that supplies no actions', () => {
    const tree = render(
      <ContentPicker title="Variables" items={[]} isLoading={false} onSelect={() => undefined} />
    );
    expect(byClass(tree, 'content-picker-actions').length).toBe(0);
  });
});

describe('FB-015 AC5 — the empty state is shared, with per-type copy', () => {
  it('gives the file picker its own words, not the image picker’s', () => {
    const file = sourceCodePickerEmptyState();
    expect(file.message).toContain('JavaScript');
    expect(file.message).not.toBe(imagePickerEmptyState().message);
    // No import route: a .js file is source the author writes, not an asset lying around.
    expect(sourceCodePickerActions({ onShowProjectFolder: () => undefined }).map((a) => a.label)).toEqual([
      'Show project folder'
    ]);
  });

  it('names the identifier kind the port actually asked for', () => {
    expect(identifierPickerEmptyState('Variables').message).toContain('variables');
    expect(identifierPickerEmptyState('Signals').message).toContain('signals');
    // Nothing to click — the route out is the field this picker is attached to, so there is no
    // `identifierPickerActions` to pass and the footer is simply absent.
    const tree = render(
      <ContentPicker
        title="Variables"
        items={[]}
        isLoading={false}
        emptyState={identifierPickerEmptyState('Variables')}
        onSelect={() => undefined}
      />
    );
    expect(byClass(tree, 'content-picker-actions').length).toBe(0);
  });

  it('renders every type through the one shared component', () => {
    const states = [
      imagePickerEmptyState(),
      sourceCodePickerEmptyState(),
      identifierPickerEmptyState('Variables')
    ];

    states.forEach((emptyState) => {
      const tree = render(
        <ContentPicker title="t" items={[]} isLoading={false} emptyState={emptyState} onSelect={() => undefined} />
      );
      expect(byClass(tree, 'content-picker-empty').length).toBe(1);
      expect(byClass(tree, 'content-picker-empty-message')[0].ownText).toBe(emptyState.message);
    });
  });
});

/**
 * FB-015 AC4 — the last hop of the placeholder's journey to the screen.
 *
 * ⚠️ **Bound, and it is a big one.** A port's `placeholder` crosses FIVE hand-written field lists
 * between the node definition and the field: `nodedefinition.registerInput`, `InputPortMetadata`,
 * `nodelibraryexport.formatPort`, `PropertyPanelInput`'s explicit prop hand-off, and
 * `PropertyPanelTextInput`'s. The first three are graded in
 * `noodl-runtime/test/nodelibraryexport.port-placeholders.test.ts`; this grades the last one's
 * destination. **The two middle editor hops are covered by AC4's drive and by nothing else** —
 * both components call hooks, so this runner cannot render them at all. That gap is not
 * incidental: three of the five lists dropped this field silently, and each was found by driving.
 */
describe('FB-015 AC4 — a placeholder reaches the input element', () => {
  it('renders the hint on the field', () => {
    const tree = render(<PropertyPanelBaseInput type="text" value="" placeholder="small.png 480w" />);
    expect(tree.props.placeholder).toBe('small.png 480w');
  });

  /** A port that declares none must not inherit one — `alt` sits beside `srcSet` on the Image node. */
  it('leaves a field with no hint alone', () => {
    const tree = render(<PropertyPanelBaseInput type="text" value="" />);
    expect(tree.props.placeholder).toBeUndefined();
  });
});
