/**
 * REL-011c — the six product findings REL-011 §AC3 registered against the admin
 * panel, graded on **the shipped artefact** rather than on the source constants
 * that produce it.
 *
 * 🔴 **The artefact, on purpose.** `sb005Components.ts` is an argument sent
 * through the MCP door; `site-builder.content.json` is what a person receives.
 * The door renames ids, drops parameters it refuses and rewrites connections, so
 * a spec over the constants can be green about a template that does not carry the
 * fix. `sb007Template.test.ts` already asserts the committed JSON is byte-identical
 * to what the door writes today, so reading it here costs nothing and measures the
 * thing.
 *
 * ## What each arm is about, and what its mutant is
 *
 * Every arm below either **runs the shipped script** (A1, A5, A6) or asserts a
 * parameter/connection the render depends on (A2, A4, A7). The three script arms
 * carry the **reverted** script beside them, because a derivation that is only
 * ever run one way is a derivation nobody has graded: `revertedUnpack()` is the
 * `Outputs.image = (d.image && d.image.url)` line this row replaced, and it must
 * FAIL exactly the two arms the photograph showed and pass the rest.
 *
 * ⚠️ **What this file cannot see.** It grades derivations and wiring, not pixels.
 * A1's fold is a `Screen Resolution` reading turned into four port values — the
 * arithmetic is here, the *rendered* result is `vib001-site.look.ts`'s phone
 * column and nothing else. Both halves are named in REL-011's write-up.
 */
import * as fs from 'fs';
import * as path from 'path';

import { DEFAULT_SECTION_KIND, SECTION_KIND_LABELS, SECTION_KINDS } from './sb005Components';

const ARTEFACT = path.join(
  __dirname,
  '..',
  '..',
  'noodl-editor',
  'src',
  'editor',
  'src',
  'models',
  'template',
  'templates',
  'site-builder.content.json'
);

const REGENERATE = 'npm run template:site-builder';

interface Node {
  id: string;
  type: string;
  label?: string;
  parameters?: Record<string, unknown>;
  children?: Node[];
}
interface Connection {
  fromId: string;
  fromProperty: string;
  toId: string;
  toProperty: string;
}
interface Component {
  name: string;
  graph: { roots: Node[]; connections: Connection[]; visualRoots?: string[] };
}
interface Content {
  components: Component[];
}

const shipped = JSON.parse(fs.readFileSync(ARTEFACT, 'utf-8')) as Content;

function component(name: string): Component {
  const found = shipped.components.find((c) => c.name === name);
  if (!found) throw new Error(`${name} is not in the shipped template. Run \`${REGENERATE}\`.`);
  return found;
}

function nodesOf(c: Component): Node[] {
  const out: Node[] = [];
  const walk = (nodes: Node[], parent: Node | null) => {
    for (const node of nodes) {
      (node as Node & { __parent?: Node | null }).__parent = parent;
      out.push(node);
      if (node.children?.length) walk(node.children, node);
    }
  };
  walk(c.graph.roots ?? [], null);
  return out;
}

function byLabel(c: Component, label: string): Node {
  const hits = nodesOf(c).filter((n) => n.label === label);
  if (hits.length !== 1) throw new Error(`${c.name} has ${hits.length} nodes labelled ${label}, expected 1`);
  return hits[0];
}

function parentOf(node: Node): Node | null {
  return (node as Node & { __parent?: Node | null }).__parent ?? null;
}

/** The connections landing on one port, as `fromId.fromProperty` strings. */
function sourcesOf(c: Component, toId: string, toProperty: string): string[] {
  return c.graph.connections
    .filter((w) => w.toId === toId && w.toProperty === toProperty)
    .map((w) => `${w.fromId}.${w.fromProperty}`)
    .sort();
}

/**
 * Run a `JavaScriptFunction`'s shipped script the way the runtime does: one
 * `Inputs` bag in, one `Outputs` bag out.
 *
 * ⚠️ A plain object for `Outputs`, not a proxy. The runtime's proxy publishes
 * only on change (which is why `railWidth` below is built fresh every run), but
 * that is a property of the *connection*, not of the script — and re-implementing
 * it here would be a second copy of the runtime to be wrong in.
 */
function run(script: string, inputs: Record<string, unknown>): Record<string, unknown> {
  const Outputs: Record<string, unknown> = {};
  // eslint-disable-next-line no-new-func
  new Function('Inputs', 'Outputs', script)(inputs, Outputs);
  return Outputs;
}

function scriptOf(componentName: string, label: string): string {
  const node = byLabel(component(componentName), label);
  const script = node.parameters?.functionScript;
  if (typeof script !== 'string' || script.length === 0) {
    throw new Error(`${componentName} | ${label} carries no functionScript in the artefact`);
  }
  return script;
}

// ─────────────────────────────────────────────────────────────────────────────

describe('REL-011c A5/A6 — the section card says one thing about itself', () => {
  const unpack = () => scriptOf('/Admin/SectionRow', 'Read this section out of data, and decide which controls it needs');

  /**
   * The line this row replaced, restored over the shipped script.
   *
   * 🔴 This is the whole reason the arms below mean anything. Both defects were
   * ONE derivation, so a fix that "looks right" is indistinguishable from no fix
   * unless the old derivation is run against the same arms and seen to fail.
   */
  function revertedUnpack(): string {
    const before = unpack();
    const after = before.replace(
      "const shown = isGallery ? images[images.length - 1] : d.image;\nOutputs.image = (shown && shown.url) || '';",
      "Outputs.image = (d.image && d.image.url) || '';"
    );
    expect(after).not.toBe(before);
    return after;
  }

  it('A5: a gallery shows the LAST of its own pictures, and says how many', () => {
    // The state the product actually produces: `absorb` pushes an upload onto
    // `data.images` for this kind and never writes `data.image`.
    const out = run(unpack(), {
      kind: 'gallery',
      data: { images: [{ url: 'first.png' }, { url: 'last.png' }] }
    });
    expect(out.image).toBe('last.png');
    expect(out.count).toBe('2 pictures');
    expect(out.hasImage).toBe(true);
    // It is the picture `Remove last picture` takes back, which is the reason it
    // is the last one and not the first.
    expect(out.canRemove).toBe(true);
  });

  it('A5 REVERTED: the same gallery showed NO picture beside a count of two', () => {
    const out = run(revertedUnpack(), {
      kind: 'gallery',
      data: { images: [{ url: 'first.png' }, { url: 'last.png' }] }
    });
    expect(out.image).toBe('');
    // 🔴 The half the photograph could not show, because the seeded fixture had
    // no `images` array at all: a client who had uploaded three pictures saw an
    // empty card that told them there were three.
    expect(out.count).toBe('2 pictures');
  });

  it('A5: a gallery with nothing in it shows nothing and says so', () => {
    const out = run(unpack(), { kind: 'gallery', data: { image: { url: 'legacy.png' } } });
    expect(out.image).toBe('');
    expect(out.hasImage).toBe(false);
    expect(out.count).toBe('No pictures yet');
    expect(out.canRemove).toBe(false);
  });

  it('A5 REVERTED: that is the screen the row was opened on — a picture over "No pictures yet"', () => {
    const out = run(revertedUnpack(), { kind: 'gallery', data: { image: { url: 'legacy.png' } } });
    expect(out.image).toBe('legacy.png');
    expect(out.count).toBe('No pictures yet');
  });

  it('A5: every other kind still reads its single picture, which the revert must NOT change', () => {
    for (const kind of SECTION_KINDS.filter((k) => k !== 'gallery')) {
      const data = { image: { url: `${kind}.png` } };
      expect(`${kind}: ${String(run(unpack(), { kind, data }).image)}`).toBe(`${kind}: ${kind}.png`);
      // The control that stops this fix being a blunt instrument: four of the
      // five kinds are untouched by it, and the reverted script agrees.
      expect(`${kind}: ${String(run(revertedUnpack(), { kind, data }).image)}`).toBe(`${kind}: ${kind}.png`);
    }
  });

  it('A5: an unset picture never reaches the Image as the string "undefined"', () => {
    for (const arm of [{}, { image: null }, { image: {} }, { images: [] }]) {
      const out = run(unpack(), { kind: 'gallery', data: arm });
      expect(out.image).toBe('');
      expect(out.hasImage).toBe(false);
    }
  });

  it('A6: the card is headed by the human word, for every kind the picker offers', () => {
    for (const kind of SECTION_KINDS) {
      expect(`${kind} → ${String(run(unpack(), { kind, data: {} }).kindLabel)}`).toBe(
        `${kind} → ${SECTION_KIND_LABELS[kind]}`
      );
    }
    // The exact pair the photograph showed: a card headed `richText` under a
    // picker offering `Rich text`.
    expect(SECTION_KIND_LABELS.richText).toBe('Rich text');
  });

  it('A6: an unknown kind falls back to the slug rather than to `undefined`', () => {
    // A row written by an older version of this panel, or by hand. A card headed
    // `undefined` would be worse than one headed with the slug.
    expect(run(unpack(), { kind: 'quote', data: {} }).kindLabel).toBe('quote');
  });

  it('A6: the heading is wired FROM the derivation, and no longer from the raw kind', () => {
    const row = component('/Admin/SectionRow');
    const kindText = byLabel(row, 'Kind');
    const unpackNode = byLabel(row, 'Read this section out of data, and decide which controls it needs');
    expect(sourcesOf(row, kindText.id, 'text')).toEqual([`${unpackNode.id}.out-kindLabel`]);
    // SB-018 (3): the standing value is what covers the gap before `unpack` first
    // publishes — without it the card would be headed with the literal word "Text".
    expect(kindText.parameters?.text).toBe('');
  });
});

describe('REL-011c A2 — the page editor fits on the screen it is opened on', () => {
  it('the section card\'s picture states a box instead of taking its source\'s width', () => {
    const preview = byLabel(component('/Admin/SectionRow'), 'Image preview');
    // 🔴 The defect was an EMPTY parameter bag. `Image` defaults to
    // `contentSize` (`image.ts:176`), which assigns neither axis, so the node
    // rendered at its source's intrinsic width and `layout.ts:82` left it
    // `flexShrink: 0` — one 1200px picture made the editor's content column
    // 1216px wide at every viewport.
    expect(preview.parameters?.sizeMode).toBe('explicit');
    expect(preview.parameters?.width).toEqual({ value: 100, unit: '%' });
    expect(preview.parameters?.height).toEqual({ value: 180, unit: 'px' });
    // Without `cover` the crop distorts every photograph that is not 100:180.
    expect(preview.parameters?.objectFit).toBe('cover');
  });

  it('an empty preview takes no space, rather than 180px of empty ground', () => {
    const row = component('/Admin/SectionRow');
    const preview = byLabel(row, 'Image preview');
    const unpackNode = byLabel(row, 'Read this section out of data, and decide which controls it needs');
    // `mounted`, not `visible` — the rule every other conditional control on this
    // card already follows, and the one that costs no row height.
    expect(preview.parameters?.mounted).toBe(false);
    expect(sourcesOf(row, preview.id, 'mounted')).toEqual([`${unpackNode.id}.out-hasImage`]);
  });

  it('no node anywhere in the admin panel is left to size itself from a picture', () => {
    // The generalisation, because this defect was one node and could be several:
    // an `Image` with no `sizeMode` takes whatever it is given, wherever it is.
    const admin = shipped.components.filter((c) => c.name.startsWith('/Admin/') || c.name.startsWith('/Pages/'));
    const unsized = admin.flatMap((c) =>
      nodesOf(c)
        .filter((n) => n.type === 'Image' && n.parameters?.sizeMode === undefined)
        .map((n) => `${c.name} | ${n.label ?? n.id}`)
    );
    expect(unsized).toEqual([]);
  });
});

describe('REL-011c A1 — the admin rail yields when there is no room for it', () => {
  const shell = () => component('/Admin/Shell');
  const fold = () => scriptOf('/Admin/Shell', 'Is there room for the rail beside the content?');

  it('the shell reads the viewport at all', () => {
    // 🔴 The finding was that NO node in this component carried a breakpoint of
    // any kind. `Screen Resolution` is the only reactive source of a viewport
    // width in the runtime that is not a `Columns` ratio.
    const viewport = byLabel(shell(), 'How wide is the window');
    expect(viewport.type).toBe('Screen Resolution');
    const foldNode = byLabel(shell(), 'Is there room for the rail beside the content?');
    expect(sourcesOf(shell(), foldNode.id, 'in-width')).toEqual([`${viewport.id}.width`]);
    // SBR-004 §9.2: an explicit `true` survives the NDA-017 migration; an absent
    // key does not, and losing it would freeze the shell in its first shape.
    expect(foldNode.parameters?.['runOnChange-in-width']).toBe(true);
  });

  it('a phone gets the whole width, and a desktop keeps the rail', () => {
    const narrow = run(fold(), { width: 390 });
    expect(narrow.frameDirection).toBe('column');
    expect(narrow.railWidth).toEqual({ value: 100, unit: '%' });
    // A rule down the left of a stacked band is a line in mid-air.
    expect(narrow.railRightBorder).toBe('none');

    for (const width of [988, 1280, 1900]) {
      const roomy = run(fold(), { width });
      expect(`${width}: ${String(roomy.frameDirection)}`).toBe(`${width}: row`);
      expect(roomy.railWidth).toEqual({ value: 240, unit: 'px' });
      expect(`${width}: ${String(roomy.railRightBorder)}`).toBe(`${width}: solid`);
    }
  });

  it('the breakpoint is one pixel wide, and it is where it says it is', () => {
    // Named rather than inferred: the three judged widths above are all one side
    // of it, so without this the constant could be anything from 391 to 988.
    expect(run(fold(), { width: 759 }).frameDirection).toBe('column');
    expect(run(fold(), { width: 760 }).frameDirection).toBe('row');
  });

  it('an unmeasured viewport leaves the authored wide shape standing', () => {
    // `Screen Resolution` is client-only, so a server render has no width. The
    // guarded return is what stops the shell folding on a page nobody has
    // measured — and the authored parameters are the wide shape for exactly this.
    expect(run(fold(), {})).toEqual({});
    expect(byLabel(shell(), 'Admin frame').parameters?.flexDirection).toBe('row');
    // 🔴 `contentHeight`, and the mode is now the SAME in both fold states — see
    // the §8.3 note on the node. `explicit` handed the rail a 100% height (the
    // `addDimensions` default), which overrode the frame's `stretch` and left
    // the rail's ground and rule stopping at the last nav item.
    expect(byLabel(shell(), 'Sidebar').parameters?.sizeMode).toBe('contentHeight');
    expect(byLabel(shell(), 'Sidebar').parameters?.width).toEqual({ value: 240, unit: 'px' });
  });

  it('the width publishes a FRESH object, because the proxy only sends changes', () => {
    // 🔴 A shared constant here would be sent once and never re-sent when the
    // window came back over the fold — a `Function`'s `Outputs` proxy compares
    // before it publishes. Two runs of the same arm must not be the same object.
    const a = run(fold(), { width: 390 }).railWidth;
    const b = run(fold(), { width: 390 }).railWidth;
    expect(a).toEqual(b);
    expect(a).not.toBe(b);
  });

  it('the rail is stretched by the frame, not sized by itself', () => {
    // 🔴 The pair that closes §3 seam 3's second clause, asserted together
    // because either alone is inert: `stretch` does nothing to an item with a
    // specified cross size, and `contentHeight` alone leaves the rail at its
    // content in a frame that never told it otherwise.
    const frame = byLabel(shell(), 'Admin frame');
    expect(frame.parameters?.alignItems).toBe('stretch');
    expect(frame.parameters?.minHeight).toEqual({ value: 100, unit: 'vh' });
    expect(byLabel(shell(), 'Sidebar').parameters?.sizeMode).toBe('contentHeight');
    // The control: `main` is the other child of the same frame and is NOT
    // exempted from stretching — if a future edit narrows `stretch` to the rail
    // alone, the ground under the content column goes back to the body's white.
    expect(byLabel(shell(), 'Admin content').parameters?.sizeMode).toBeUndefined();
  });

  it('all three wired ports move together, from the one reading', () => {
    const c = shell();
    const foldNode = byLabel(c, 'Is there room for the rail beside the content?');
    const frame = byLabel(c, 'Admin frame');
    const sidebar = byLabel(c, 'Sidebar');
    // A stacked frame whose rail still states 240px is a 240px block with the
    // content beneath it; a rail at 100% inside a row is the whole screen. The
    // three are one change, so the gate asserts them as one.
    expect(sourcesOf(c, frame.id, 'flexDirection')).toEqual([`${foldNode.id}.out-frameDirection`]);
    // ⚠️ `sizeMode` is deliberately NOT in this list any more: both fold states
    // want `contentHeight`, so the output and its wire were deleted rather than
    // left publishing one value forever.
    expect(sourcesOf(c, sidebar.id, 'sizeMode')).toEqual([]);
    expect(sourcesOf(c, sidebar.id, 'width')).toEqual([`${foldNode.id}.out-railWidth`]);
    expect(sourcesOf(c, sidebar.id, 'borderRightStyle')).toEqual([`${foldNode.id}.out-railRightBorder`]);
  });
});

describe('REL-011c A1 — the page editor stops being two-up on a phone', () => {
  const fields = () => scriptOf('/Pages/PageEditor', 'Is there room for two fields side by side?');

  it('the title/slug pair stacks below the same 760 the shell folds at', () => {
    expect(run(fields(), { width: 390 }).fieldsDirection).toBe('column');
    expect(run(fields(), { width: 759 }).fieldsDirection).toBe('column');
    expect(run(fields(), { width: 760 }).fieldsDirection).toBe('row');
    expect(run(fields(), { width: 1280 }).fieldsDirection).toBe('row');
    // 🔴 **`flexWrap` moves with it, and this arm exists because the first build
    // did not.** The authored `wrap` is there only to make `rowGap` authorable;
    // left on, two children with a 100% flex-basis each take their own line at
    // EVERY width, and the 1280 and 1900 photographs came back with Title above
    // Slug. The render caught it; this is what stops it coming back.
    expect(run(fields(), { width: 390 }).fieldsWrap).toBe('wrap');
    expect(run(fields(), { width: 1280 }).fieldsWrap).toBe('nowrap');
    expect(run(fields(), { width: 1900 }).fieldsWrap).toBe('nowrap');
    // The two decisions are one decision about whether this is a phone, so the
    // two scripts must not drift to different numbers.
    const foldScript = scriptOf('/Admin/Shell', 'Is there room for the rail beside the content?');
    for (const width of [389, 390, 759, 760, 988, 1280, 1900]) {
      const stacked = run(fields(), { width }).fieldsDirection === 'column';
      const folded = run(foldScript, { width }).frameDirection === 'column';
      expect(`${width}: ${String(stacked)}`).toBe(`${width}: ${String(folded)}`);
    }
  });

  it('the stacked pair has a gap, which needs `flexWrap` to be authorable at all', () => {
    const nameRow = byLabel(component('/Pages/PageEditor'), 'Title and slug');
    const editor = component('/Pages/PageEditor');
    const fieldsNode = byLabel(editor, 'Is there room for two fields side by side?');
    expect(sourcesOf(editor, nameRow.id, 'flexDirection')).toEqual([`${fieldsNode.id}.out-fieldsDirection`]);
    expect(sourcesOf(editor, nameRow.id, 'flexWrap')).toEqual([`${fieldsNode.id}.out-fieldsWrap`]);
    // 🔴 `rowGap` is gated on `flexDirection = column OR flexWrap = wrap`
    // (`group.ts:478`), and this Group is authored as a row — so without the
    // wrap the door would have refused the gap and the stacked form would have
    // had none. The port survived the door, which is what this asserts.
    expect(nameRow.parameters?.flexWrap).toBe('wrap');
    expect(nameRow.parameters?.rowGap).toBe('var(--space-4)');
    expect(nameRow.parameters?.columnGap).toBe('var(--space-4)');
  });
});

describe('REL-011c A9 — the theme editor stops being two-up on a phone', () => {
  it("the preview pane stacks under the fields, at the same 760", () => {
    const panes = scriptOf('/Pages/ThemeEditor', 'Is there room for the preview beside the fields?');
    expect(run(panes, { width: 390 }).panesDirection).toBe('column');
    expect(run(panes, { width: 759 }).panesDirection).toBe('column');
    expect(run(panes, { width: 760 }).panesDirection).toBe('row');
    // The same pair, and for the same reason — see `fields` above. Without it
    // SBR-009's side-by-side preview is gone at 1900 as well as at 390.
    expect(run(panes, { width: 390 }).panesWrap).toBe('wrap');
    expect(run(panes, { width: 1900 }).panesWrap).toBe('nowrap');
    expect(run(panes, {})).toEqual({});

    const theme = component('/Pages/ThemeEditor');
    const columns = byLabel(theme, 'Fields and preview');
    const panesNode = byLabel(theme, 'Is there room for the preview beside the fields?');
    expect(sourcesOf(theme, columns.id, 'flexDirection')).toEqual([`${panesNode.id}.out-panesDirection`]);
    expect(sourcesOf(theme, columns.id, 'flexWrap')).toEqual([`${panesNode.id}.out-panesWrap`]);
    expect(columns.parameters?.flexWrap).toBe('wrap');
    expect(columns.parameters?.rowGap).toBe('var(--space-6)');
  });

  it('the three breakpoints are ONE number, in three places', () => {
    // 🔴 Three copies of a threshold is three chances for them to disagree, and
    // a screen that folds its shell at one width and its panes at another is
    // worse than one that folds neither. There is no shared constant to assert —
    // they are three scripts in a shipped JSON — so the gate is that they answer
    // identically across the range.
    const scripts = [
      ['shell', scriptOf('/Admin/Shell', 'Is there room for the rail beside the content?'), 'frameDirection'],
      ['editor', scriptOf('/Pages/PageEditor', 'Is there room for two fields side by side?'), 'fieldsDirection'],
      ['theme', scriptOf('/Pages/ThemeEditor', 'Is there room for the preview beside the fields?'), 'panesDirection']
    ] as const;
    for (const width of [320, 390, 600, 759, 760, 988, 1280, 1900]) {
      const answers = scripts.map(([who, script, port]) => `${who}=${String(run(script, { width })[port])}`);
      const expected = width >= 760 ? 'row' : 'column';
      expect(answers).toEqual(scripts.map(([who]) => `${who}=${expected}`));
    }
  });
});

describe('REL-011c A8 — the Kind picker is a control you can see', () => {
  it('it starts on the kind the site falls back to, so the box has a word in it', () => {
    const picker = byLabel(component('/Pages/PageEditor'), 'Section kind');
    // 🔴 `Select.tsx:125-130` renders no label at all when nothing is selected
    // and no placeholder is set, so the bordered wrapper collapsed to its own
    // padding — a ~16px empty sliver, 1450px wide at 1900.
    expect(picker.parameters?.value).toBe(DEFAULT_SECTION_KIND);
    // ⚠️ The value, not a placeholder: `Add section` writes whatever the picker
    // says, so a legible-but-unset control would create a section whose `kind`
    // is undefined and which the site draws as `richText` by fallback. Starting
    // ON the fallback makes the button honest about what it will do.
    expect(SECTION_KINDS).toContain(picker.parameters?.value);
    expect(picker.parameters?.placeholder).toBeUndefined();
  });

  // ⚠️ **Green at HEAD too, and that is what it is for.** This arm and the
  // population check in A7 are the only two of the twenty-eight that survive the
  // reverted-artefact control; both are preconditions rather than grades, and a
  // control that reads the same in both arms is what says the other twenty-six
  // were reading something.
  it('the word it starts on is one the picker actually offers', () => {
    const items = byLabel(component('/Pages/PageEditor'), 'The five section kinds').parameters?.json;
    const rows = JSON.parse(String(items)) as Array<{ Label: string; Value: string }>;
    expect(rows.map((r) => r.Value)).toEqual([...SECTION_KINDS]);
    const start = rows.find((r) => r.Value === DEFAULT_SECTION_KIND);
    // A `value` matching no option deselects everything (`options.ts:112`), which
    // would put the control straight back where it was.
    expect(start?.Label).toBe(SECTION_KIND_LABELS[DEFAULT_SECTION_KIND]);
  });
});

describe('REL-011c A4 — a label sits over the control it names', () => {
  it('the Kind picker is on its own line, under the Sections heading', () => {
    const editor = component('/Pages/PageEditor');
    const header = byLabel(editor, 'Add a section');
    const heading = byLabel(editor, 'Sections heading');
    const picker = byLabel(editor, 'Section kind');
    const add = byLabel(editor, 'Add');

    // 🔴 The finding was containment, not spacing: `useLabel` draws the label
    // ABOVE the box, so in a shared centred row the word `Kind` landed beside
    // `Sections` and read as a second heading of the same rank.
    expect(header.parameters?.flexDirection).toBe('column');
    expect(parentOf(heading)?.id).toBe(header.id);
    expect(parentOf(picker)?.id).not.toBe(header.id);
    expect(parentOf(picker)?.id).toBe(parentOf(add)?.id);
    expect(parentOf(picker)?.label).toBe('Pick a kind and add it');
    expect(parentOf(picker)?.parameters?.flexDirection).toBe('row');
    // The picker is labelled and the button is not, so their boxes are different
    // heights: centred, `Add section` sits halfway up the field beside it.
    expect(parentOf(picker)?.parameters?.alignItems).toBe('flex-end');
    // The heading's parent is a column now, so `contentSize` would assign neither
    // axis — this is the `STACKED`/`IN_A_ROW` distinction, at the one node that
    // had to change with the direction.
    expect(heading.parameters?.sizeMode).toBe('contentHeight');
  });
});

describe('REL-011c A7 — an admin screen has a heading, not just a big word', () => {
  /** The six admin routes, by the component that draws each. */
  const ADMIN_SCREENS = [
    '/Pages/Setup',
    '/Pages/SignIn',
    '/Pages/Admin',
    '/Pages/PageEditor',
    '/Pages/ThemeEditor',
    '/Pages/Messages'
  ];

  it('every admin screen draws exactly one `h1`', () => {
    const counted = ADMIN_SCREENS.map((name) => {
      const h1s = nodesOf(component(name)).filter((n) => n.type === 'Text' && n.parameters?.as === 'h1');
      return `${name}: ${h1s.length}`;
    });
    // 🔴 All twelve admin shots recorded `headings: []`, on screens that visibly
    // had titles: a `Text` renders a `<div>` unless told otherwise. Exactly one,
    // because two `h1`s on a page is the other way to have no heading structure.
    expect(counted).toEqual(ADMIN_SCREENS.map((name) => `${name}: 1`));
  });

  it('the population is real — these are the screens the router actually serves', () => {
    // A list of six names is only a gate while all six exist; the `component()`
    // helper throws otherwise, and this states the intent out loud.
    for (const name of ADMIN_SCREENS) expect(component(name).name).toBe(name);
    expect(ADMIN_SCREENS.length).toBe(6);
  });

  it("the heading a screen already had is the one that took the tag, not a new node", () => {
    // The tag changes nothing visually, which is the point — so the check that it
    // was not "fixed" by adding an invisible heading is that the tagged node is
    // the one carrying the screen's own words.
    const titles: Record<string, string> = {
      '/Pages/Setup': 'Claim this site',
      '/Pages/SignIn': 'Sign in',
      '/Pages/Admin': 'Pages',
      '/Pages/ThemeEditor': 'Theme and settings',
      '/Pages/Messages': 'Messages'
    };
    for (const [name, text] of Object.entries(titles)) {
      const h1 = nodesOf(component(name)).find((n) => n.type === 'Text' && n.parameters?.as === 'h1');
      expect(`${name}: ${String(h1?.parameters?.text)}`).toBe(`${name}: ${text}`);
    }
    // ⚠️ The page editor's is the exception and it has to be: its heading is
    // `Editing · <title>`, wired from the record, so its standing text is empty
    // (SB-018 (3)) and the words arrive at runtime.
    const editorH1 = nodesOf(component('/Pages/PageEditor')).find(
      (n) => n.type === 'Text' && n.parameters?.as === 'h1'
    );
    expect(editorH1?.label).toBe('Heading');
    expect(editorH1?.parameters?.text).toBe('');
  });
});
