/**
 * DRIVE-G — the four defects the 2026-08-13 live drive found and fixed, each with the control
 * that was watched red **in the running editor** before the fix and is reproduced here.
 *
 * All four are the same shape and it is the shape this phase keeps producing: **a declaration
 * that is present and does nothing.** A stylesheet property that resolves to the document
 * initial; a button callback that calls half of a two-call contract; a `catch` that reports the
 * parser's own words; an outline request with no owner. None of them is visible to a spec that
 * asserts the declaration exists, which is why each assertion below is paired with the pre-fix
 * body as a literal fixture — if the fix is reverted, the control fixture and the live source
 * agree and the test says so.
 *
 * See `dev-docs/tasks/phase-64-the-visual-function-in-use/DRIVE-2026-08-13-G.md`.
 */
import * as fs from 'fs';
import * as path from 'path';

import { MyBlocksSaveOutline } from '../../src/editor/src/views/BlocklyEditor/MyBlocksSaveOutline';

const SRC = path.join(__dirname, '../../src/editor/src');

const read = (relative: string) => fs.readFileSync(path.join(SRC, relative), 'utf8');

/* ------------------------------------------------------------------------- *
 * 1. The outline that never went away — the one defect with a real behaviour
 *    to grade, so it is graded behaviourally rather than by reading source.
 * ------------------------------------------------------------------------- */

/**
 * The smallest DOM `MyBlocksSaveOutline` can draw into.
 *
 * `jest.config.js` runs `testEnvironment: 'node'` and this package has no jsdom, so the class
 * would otherwise be unreachable from a runner — which is exactly the gap that let a stale hover
 * request survive every existing VFN-006 spec. The class touches four DOM calls and no more
 * (`createElementNS`, `cloneNode`, `appendChild`/`removeChild`, `querySelector`), so a fake that
 * implements those four grades the *request arithmetic* honestly. It does not grade painting;
 * painting is what the drive is for.
 */
interface FakeNode {
  tagName: string;
  attrs: Record<string, string>;
  children: FakeNode[];
  parentNode: FakeNode | null;
  setAttribute(name: string, value: string): void;
  removeAttribute(name: string): void;
  appendChild(child: FakeNode): FakeNode;
  removeChild(child: FakeNode): FakeNode;
  cloneNode(deep: boolean): FakeNode;
  querySelector(selector: string): FakeNode | null;
}

function fakeElement(tagName: string, className = ''): FakeNode {
  const node: FakeNode = {
    tagName,
    attrs: className ? { class: className } : {},
    children: [],
    parentNode: null,
    setAttribute(name, value) {
      node.attrs[name] = value;
    },
    removeAttribute(name) {
      delete node.attrs[name];
    },
    appendChild(child) {
      child.parentNode = node;
      node.children.push(child);
      return child;
    },
    removeChild(child) {
      const at = node.children.indexOf(child);
      if (at >= 0) node.children.splice(at, 1);
      child.parentNode = null;
      return child;
    },
    cloneNode() {
      return fakeElement(node.tagName, node.attrs.class || '');
    },
    // Only the one selector the class uses: the block's own top-level path.
    querySelector(selector) {
      if (selector !== ':scope > path.blocklyPath') return null;
      return node.children.find((c) => c.tagName === 'path' && (c.attrs.class || '') === 'blocklyPath') ?? null;
    }
  };
  return node;
}

/** A workspace of `n` rendered blocks, each with a `<path class="blocklyPath">` to clone. */
function fakeWorkspace(ids: string[]) {
  const roots = new Map<string, FakeNode>();
  for (const id of ids) {
    const root = fakeElement('g');
    root.appendChild(fakeElement('path', 'blocklyPath'));
    roots.set(id, root);
  }
  return {
    roots,
    getBlockById(id: string) {
      const root = roots.get(id);
      if (!root) return null;
      return { getSvgRoot: () => root } as never;
    }
  };
}

describe('DRIVE-G · VFN-006 — a pin consumes the hover, so unpin actually clears', () => {
  const originalDocument = (globalThis as { document?: unknown }).document;

  beforeAll(() => {
    (globalThis as { document?: unknown }).document = {
      createElementNS: (_ns: string, tag: string) => fakeElement(tag)
    };
  });

  afterAll(() => {
    (globalThis as { document?: unknown }).document = originalDocument;
  });

  const IDS = ['a', 'b', 'c'];

  it('the live symptom: hover, then pin, then unpin leaves nothing on the workspace', () => {
    const workspace = fakeWorkspace(IDS);
    const outline = new MyBlocksSaveOutline(workspace);

    // The menu item is pointed at.
    outline.show(IDS);
    expect(outline.count).toBe(3);

    // The item is clicked. The menu row is destroyed with the pointer inside it, so its
    // `pointerleave` never fires — `hide()` is deliberately NOT called here, because that is
    // exactly what happens in the editor.
    outline.pin(IDS);
    expect(outline.count).toBe(3);

    // The dialog closes: save, cancel or Escape, all of them this unmount.
    outline.unpin();

    // Driven 2026-08-13: this was 3, five seconds and eight polls after the dialog closed.
    expect(outline.count).toBe(0);
  });

  /**
   * 🔴 NEGATIVE CONTROL — the same instrument, with the fix's one line undone.
   *
   * `pin` is re-implemented here exactly as it read before (`pinned = ids; render()`), through
   * the class's own public surface: `show` after `pin` restores a hover request that the fixed
   * `pin` would have consumed. If this ever stops printing 3, the assertion above has stopped
   * measuring anything.
   */
  it('NEGATIVE CONTROL — a hover request that outlives the pin keeps the outline up', () => {
    const workspace = fakeWorkspace(IDS);
    const outline = new MyBlocksSaveOutline(workspace);

    outline.pin(IDS);
    // Re-assert the hover *after* the pin, which is the pre-fix state: both requests live.
    outline.show(IDS);
    outline.unpin();

    expect(outline.count).toBe(3);
  });

  it('hide alone still withdraws a hover that was never pinned', () => {
    const workspace = fakeWorkspace(IDS);
    const outline = new MyBlocksSaveOutline(workspace);

    outline.show(IDS);
    expect(outline.count).toBe(3);
    outline.hide();
    expect(outline.count).toBe(0);
  });

  it('pin still outranks a hover for a different set of blocks', () => {
    const workspace = fakeWorkspace(['a', 'b', 'c', 'd']);
    const outline = new MyBlocksSaveOutline(workspace);

    outline.show(['a']);
    outline.pin(['b', 'c', 'd']);
    expect(outline.count).toBe(3);
  });
});

/* ------------------------------------------------------------------------- *
 * 2. The yield's second door.
 * ------------------------------------------------------------------------- */

describe('DRIVE-G · VFN-005/012 — both flyout buttons open settings through the same callback', () => {
  const source = read('views/BlocklyEditor/BlocklyWorkspace.tsx');

  /**
   * The pre-fix body, verbatim. `openSettingsPanel('project')` and nothing else — which is what
   * made the panel open **behind** the window from the Libraries & Browser flyout while the
   * App Config flyout's identical button moved it clear.
   */
  const PRE_FIX =
    "workspace.registerButtonCallback(LIBRARIES_SETTINGS_BUTTON, () => openSettingsPanel('project'));";

  it('the pre-fix registration is gone', () => {
    expect(source).not.toContain(PRE_FIX);
  });

  it('NEGATIVE CONTROL — the pre-fix registration is what the assertion above can see', () => {
    // The same predicate, against the string it is meant to reject. If `toContain` were the
    // wrong instrument for this shape, this would fail and the assertion above would be vacuous.
    expect(PRE_FIX).toContain('registerButtonCallback(LIBRARIES_SETTINGS_BUTTON');
    expect(PRE_FIX).not.toContain('SidePanelOpened');
  });

  it('there is exactly one function that opens settings from a flyout, and it emits the yield', () => {
    const fn = source.slice(source.indexOf('export function openProjectSettingsFromFlyout'));
    const body = fn.slice(0, fn.indexOf('\n}') + 2);

    expect(body).toContain("openSettingsPanel('project')");
    expect(body).toContain("EventDispatcher.instance.emit('LogicBuilder.SidePanelOpened')");
  });

  it('both buttons register that one function, by name', () => {
    for (const key of ['APP_CONFIG_SETTINGS_BUTTON', 'LIBRARIES_SETTINGS_BUTTON']) {
      expect(source).toContain(`registerButtonCallback(${key}, openProjectSettingsFromFlyout)`);
    }
  });
});

/* ------------------------------------------------------------------------- *
 * 3. The glyph that was black.
 * ------------------------------------------------------------------------- */

describe('DRIVE-G · VFN-009/010 — the saved-block glyph names its colour', () => {
  const sheet = read('views/panels/SettingsPanel/sections/SavedBlocksSection.module.scss');
  const glyph = sheet.slice(sheet.indexOf('.Glyph {'), sheet.indexOf('.Name {'));

  /**
   * Measured in the running launcher, dark theme, 2026-08-13:
   * `color: rgb(0, 0, 0)` on `rgb(24, 29, 36)` = **1.24:1**. `currentColor` is inherited, and no
   * ancestor of this section sets `color` — so the declaration resolved to the document initial.
   */
  it('does not lean on an inherited colour that nothing in this tree sets', () => {
    expect(glyph).not.toContain('currentColor');
  });

  it('names the same token its sibling label names', () => {
    expect(glyph).toContain('var(--theme-color-fg-default)');
  });

  it('NEGATIVE CONTROL — the sibling that legitimately inherits is untouched', () => {
    // `CanvasTabs` sets `color` on `.Tab` two rules above its mark, so `currentColor` there is
    // correct. If this ever stops containing it, the rule above has been applied too widely.
    const tabs = read('views/CanvasTabs/CanvasTabs.module.scss');
    const mark = tabs.slice(tabs.indexOf('.SavedBlockMark {'), tabs.indexOf('.TabCloseButton {'));
    expect(mark).toContain('currentColor');
    expect(tabs.slice(tabs.indexOf('.Tab {'))).toContain('color: var(--theme-color-fg-default)');
  });
});

/* ------------------------------------------------------------------------- *
 * 4. The import that reported the parser.
 * ------------------------------------------------------------------------- */

describe('DRIVE-G · VFN-009/010 — a clipboard that is not an export says so in words', () => {
  const source = read('views/panels/SettingsPanel/sections/SavedBlocksSection.tsx');
  const handler = source.slice(source.indexOf('const handleImport'), source.indexOf('const handleRename'));

  it('parses in its own try, so a parse failure is not reported as a domain refusal', () => {
    // Pre-fix: `importDefinitions(JSON.parse(text), target)` inside the one try, so a SyntaxError
    // reached the same `showError` as a cycle refusal and printed V8's message verbatim.
    expect(handler).not.toContain('importDefinitions(JSON.parse(text)');
  });

  it('the parse failure has a written sentence, and an empty clipboard has its own', () => {
    expect(handler).toContain('the clipboard is empty');
    expect(handler).toContain('does not hold an exported block');
  });

  it('NEGATIVE CONTROL — the domain refusals still report their own words untouched', () => {
    // `importDefinitions` throws sentences written to be read. Softening those would be the
    // opposite mistake, so the outer catch must still pass `error.message` straight through.
    expect(handler).toContain('error instanceof Error ? error.message : String(error)');
  });
});
