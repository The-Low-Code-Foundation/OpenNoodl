/**
 * Session 9 (EXP-002-VISUALS-TARGET-OUTPUT.md): the second wave of visual generators —
 * Columns → CSS Grid (+ @container breakpoints), Icon (font/sprite/image), Checkbox and
 * Radio Button (+ Group, useId-scoped names), Range, Dropdown, Video, Circle.
 *
 * The showcase component is synthetic (the checked-in fixtures don't use these nodes); it is
 * grafted onto the cheer fixture and emitted through the whole pipeline, so these assertions
 * hold plan + emit together, not units in isolation.
 */
import * as fs from 'fs';
import * as path from 'path';

import { Catalog } from '../src/catalog';
import { emitApp } from '../src/emit/emitApp';
import { parseProject } from '../src/parse/parseProject';
import { ComponentIR, ExportIR, NodeIR, ParamValue } from '../src/ir/types';

const FIXTURE = path.join(__dirname, 'fixtures', 'cheer');
const CATALOG_PATH = path.join(__dirname, '..', '..', 'noodl-types', 'src', 'node-catalog.json');

const catalog: Catalog = JSON.parse(fs.readFileSync(CATALOG_PATH, 'utf8'));
const baseIr = parseProject(FIXTURE, catalog);

const node = (id: string, type: string, params: Record<string, ParamValue> = {}, extra: Partial<NodeIR> = {}): NodeIR => ({
  id,
  type,
  catalogRef: type,
  parameters: Object.entries(params)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => (a.name < b.name ? -1 : 1)),
  declaredPorts: [],
  portKnowledge: 'complete',
  ...extra
});

const lit = (value: string | number | boolean): ParamValue => ({ kind: 'literal', value });
const px = (value: number): ParamValue => ({ kind: 'dimension', value, unit: 'px' });
const json = (value: unknown): ParamValue => ({ kind: 'json', value });

function showcaseComponent(): ComponentIR {
  return {
    id: 'showcase',
    path: 'Components/Showcase',
    role: 'component',
    connections: [],
    intent: { nodeComments: [], wireLabels: [], regions: [] },
    nodes: [
      node('shell', 'Group', {}, {
        children: ['gallery', 'star', 'truck', 'badge', 'photoIcon', 'remember', 'size', 'volume', 'pick', 'promo', 'dot']
      }),
      node(
        'gallery',
        'net.noodl.visual.columns',
        {
          layoutString: lit('1 2 1'),
          marginX: px(32),
          smallBreakpoint: px(700),
          smallLayout: lit('1')
        },
        { parent: 'shell', children: ['cardA', 'cardB'] }
      ),
      node('cardA', 'Group', { backgroundColor: lit('var(--surface)') }, { parent: 'gallery' }),
      node('cardB', 'Group', { backgroundColor: lit('var(--surface-2)') }, { parent: 'gallery' }),
      node(
        'star',
        'net.noodl.visual.icon',
        {
          iconIconSource: json({ class: 'material-icons', code: 'star' }),
          iconSize: px(22),
          iconColor: lit('var(--accent)')
        },
        { parent: 'shell' }
      ),
      node(
        'truck',
        'net.noodl.visual.icon',
        {
          iconIconSource: json({ class: 'lucide', code: 'icon-truck', codeAsClass: true }),
          iconSize: px(20)
        },
        { parent: 'shell' }
      ),
      node(
        'badge',
        'net.noodl.visual.icon',
        {
          iconIconSource: json({ kind: 'sprite', url: 'noodl_modules/qa-sprites/assets/sprite.svg', symbolId: 'qa-star' }),
          iconSize: px(48),
          iconColor: lit('#ff9900')
        },
        { parent: 'shell' }
      ),
      node(
        'photoIcon',
        'net.noodl.visual.icon',
        {
          iconSourceType: lit('image'),
          iconImageSource: lit('/assets/logo.png'),
          iconSize: px(40)
        },
        { parent: 'shell' }
      ),
      node(
        'remember',
        'net.noodl.controls.checkbox',
        { useLabel: lit(true), label: lit('Remember me'), checked: lit(true) },
        { parent: 'shell' }
      ),
      node(
        'size',
        'Radio Button Group',
        { value: lit('m') },
        { parent: 'shell', children: ['small', 'medium'] }
      ),
      node(
        'small',
        'net.noodl.controls.radiobutton',
        { value: lit('s'), useLabel: lit(true), label: lit('Small'), fillColor: lit('var(--primary)') },
        { parent: 'size' }
      ),
      node(
        'medium',
        'net.noodl.controls.radiobutton',
        { value: lit('m'), useLabel: lit(true), label: lit('Medium') },
        { parent: 'size' }
      ),
      node(
        'volume',
        'net.noodl.controls.range',
        { min: lit(0), max: lit(100), value: lit(30), thumbColor: lit('var(--primary)') },
        { parent: 'shell' }
      ),
      node(
        'pick',
        'net.noodl.controls.options',
        {
          placeholder: lit('Pick a size'),
          items: json([
            { Label: 'Small', Value: 's' },
            { Label: 'Large', Value: 'l', Disabled: 'true' }
          ])
        },
        { parent: 'shell' }
      ),
      node(
        'promo',
        'Video',
        { src: lit('/assets/promo.mp4'), controls: lit(true), muted: lit(true) },
        { parent: 'shell' }
      ),
      node(
        'dot',
        'Circle',
        {
          size: lit(80),
          fillColor: lit('var(--primary)'),
          strokeEnabled: lit(true),
          strokeWidth: lit(8),
          endAngle: lit(270)
        },
        { parent: 'shell' }
      )
    ]
  };
}

const irWithShowcase = (mutate?: (component: ComponentIR) => void): ExportIR => {
  const ir: ExportIR = structuredClone(baseIr);
  const component = showcaseComponent();
  if (mutate) mutate(component);
  ir.components.push(component);
  ir.components.sort((a, b) => (a.path < b.path ? -1 : 1));
  return ir;
};

const withShowcase = (mutate?: (component: ComponentIR) => void): ReturnType<typeof emitApp> =>
  emitApp(irWithShowcase(mutate), catalog);

const app = withShowcase();
const tsx = app.files['src/components/Showcase.tsx'];
const css = app.files['src/components/Showcase.module.css'];

describe('columns → CSS Grid (VISUALS-TARGET §1)', () => {
  test('the layout string becomes fr tracks with the authored and default gaps', () => {
    expect(css).toContain('.gallery {');
    expect(css).toContain('grid-template-columns: 1fr 2fr 1fr;');
    expect(css).toContain('column-gap: 32px;');
    expect(css).toContain('row-gap: 16px;');
  });

  test('an active breakpoint pair earns the container wrapper and an @container override', () => {
    expect(css).toContain('.galleryContainer {\n  container-type: inline-size;\n}');
    expect(css).toContain('@container (max-width: 700px) {\n  .gallery {\n    grid-template-columns: 1fr;\n  }\n}');
    expect(tsx).toContain('<div className={styles.galleryContainer}>');
  });

  test('children are direct grid items', () => {
    expect(tsx).toMatch(/<div className=\{styles\.gallery\}>\n\s+<div className=\{styles\.cardA\} \/>/);
  });

  test('masonry packing defers the node with its reason', () => {
    const result = withShowcase((component) => {
      component.nodes
        .find((n) => n.id === 'gallery')!
        .parameters.push({ name: 'packing', value: lit('masonry') });
    });
    expect(result.notes.join('\n')).toContain('masonry packing is measured at runtime');
    expect(result.files['src/components/Showcase.tsx']).not.toContain('styles.gallery');
  });

  test('a wired layout string defers the node', () => {
    const result = withShowcase((component) => {
      component.connections.push({
        key: 'x:value->gallery:layoutString',
        fromId: 'x',
        fromProperty: 'value',
        toId: 'gallery',
        toProperty: 'layoutString',
        kind: 'value'
      });
    });
    expect(result.notes.join('\n')).toContain('its layoutString arrives over a wire');
  });

  test('auto fit renders the repeat() it was imitating', () => {
    const result = withShowcase((component) => {
      const gallery = component.nodes.find((n) => n.id === 'gallery')!;
      gallery.parameters.push(
        { name: 'sizing', value: lit('autoFit') },
        { name: 'minWidth', value: px(260) }
      );
    });
    expect(result.files['src/components/Showcase.module.css']).toContain(
      'grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));'
    );
  });

  test('unusable layout tokens drop with a note, like parseLayout', () => {
    const result = withShowcase((component) => {
      const gallery = component.nodes.find((n) => n.id === 'gallery')!;
      gallery.parameters.find((p) => p.name === 'layoutString')!.value = lit('1 a 1');
    });
    expect(result.files['src/components/Showcase.module.css']).toContain('grid-template-columns: 1fr 1fr;');
    expect(result.notes.join('\n')).toContain('"a" is not a positive number');
  });
});

describe('icon (VISUALS-TARGET §2)', () => {
  test('a font glyph is a span joining the generated class with the set classes', () => {
    expect(tsx).toContain('<span className={`${styles.star} material-icons`}>star</span>');
    expect(css).toContain('.star {\n  font-size: 22px;\n  line-height: 1;\n  color: var(--accent);\n  user-select: none;\n}');
  });

  test('a codeAsClass set puts the glyph in the class list, not the text', () => {
    expect(tsx).toContain('<span className={`${styles.truck} lucide icon-truck`} />');
  });

  test('a sprite is an svg use, coloured by fill', () => {
    expect(tsx).toContain('<use href="noodl_modules/qa-sprites/assets/sprite.svg#qa-star" />');
    expect(css).toContain('.badge {\n  display: block;\n  width: 48px;\n  height: 48px;\n  fill: #ff9900;\n}');
  });

  test('an image source is an img sized by the class', () => {
    expect(tsx).toContain('<img className={styles.photoIcon} src="/assets/logo.png" alt="" />');
    expect(css).toContain('.photoIcon {\n  display: block;\n  width: 40px;\n  height: 40px;\n}');
  });

  test('an icon set the project does not have is reported once per set', () => {
    // The cheer fixture ships no `noodl_modules`, so neither set is in the project and both
    // icons render blank in the exported app. EXP-010 changed what this note *says*, because it
    // changed the answer: the export now copies every module folder and links every declared
    // stylesheet, so the gap is no longer a capability the export lacks.
    const iconNotes = app.notes.filter((n) => n.includes('font icon set'));
    expect(iconNotes).toEqual([
      'Components/Showcase: font icon set "material-icons" is not a noodl_modules icon set in this project with a stylesheet — the export has nothing to ship for it, and these icons render as blank in the exported app',
      'Components/Showcase: font icon set "lucide" is not a noodl_modules icon set in this project with a stylesheet — the export has nothing to ship for it, and these icons render as blank in the exported app'
    ]);
  });

  test('an icon set the project DOES have earns no note, and its stylesheet is linked', () => {
    // 🔴 The control the note above cannot be read without. A test that only sees the note fire
    // proves the sentence exists, not that it discriminates — and this note's whole job is to
    // separate a set that ships from one that does not. Same graph, same icons; the only thing
    // varied is whether the sets are installed.
    const base = irWithShowcase();
    const withSets: ExportIR = {
      ...base,
      project: {
        ...base.project,
        modules: [
          {
            dirName: 'lucide-icons',
            displayName: 'Lucide',
            kind: 'iconset',
            status: 'no-nodes-declared',
            nodes: [],
            stylesheets: ['noodl_modules/lucide-icons/styles.css'],
            iconClass: 'lucide',
            assets: ['noodl_modules/lucide-icons/styles.css', 'noodl_modules/lucide-icons/lucide.woff2'],
            runtimes: ['browser']
          }
        ]
      }
    };
    const result = emitApp(withSets, catalog);
    const iconNotes = result.notes.filter((n) => n.includes('font icon set'));

    expect(iconNotes).toEqual([
      'Components/Showcase: font icon set "material-icons" is not a noodl_modules icon set in this project with a stylesheet — the export has nothing to ship for it, and these icons render as blank in the exported app'
    ]);
    expect(result.files['index.html']).toContain('<link rel="stylesheet" href="/noodl_modules/lucide-icons/styles.css" />');
    expect(result.copies).toContainEqual({
      from: 'noodl_modules/lucide-icons/lucide.woff2',
      to: 'public/noodl_modules/lucide-icons/lucide.woff2'
    });
  });
});

describe('checkbox and radio (VISUALS-TARGET §3)', () => {
  test('a labelled checkbox wraps in a label, defaultChecked from the literal', () => {
    expect(tsx).toContain('<label className={styles.rememberLabel}>');
    expect(tsx).toContain('<input className={styles.remember} type="checkbox" defaultChecked />');
    expect(tsx).toContain('Remember me');
  });

  test('the box states the effective defaults and draws the tick as a mask', () => {
    expect(css).toContain(
      '.remember {\n  appearance: none;\n  margin: 0;\n  display: grid;\n  place-content: center;\n  width: 32px;\n  height: 32px;\n  border: 2px solid #000000;\n  border-radius: 3px;\n}'
    );
    expect(css).toContain('.remember::before {');
    expect(css).toContain("mask: url(\"data:image/svg+xml,");
    expect(css).toContain('.remember:checked::before {\n  transform: scale(1);\n}');
    expect(css).toContain('.rememberLabel {\n  display: flex;\n  align-items: center;\n  gap: 10px;\n}');
  });

  test('the group scopes its name with useId and marks the selected value', () => {
    expect(tsx).toContain("import { useId } from 'react';");
    expect(tsx).toContain('const sizeId = useId();');
    expect(tsx).toMatch(/small\} type="radio" name=\{sizeId\} value="s"/);
    expect(tsx).toMatch(/medium\} type="radio" name=\{sizeId\} value="m" defaultChecked/);
  });

  test('the radio dot takes the authored fill, else the border colour', () => {
    expect(css).toContain('.small::before {');
    expect(css).toContain('background-color: var(--primary);');
    expect(css).toMatch(/\.medium::before \{[^}]*background-color: #000000;/);
    expect(css).toContain('width: calc(100% - 2px * 2);');
  });

  test('a radio outside any group defers with the runtime error it would raise', () => {
    const result = withShowcase((component) => {
      const shell = component.nodes.find((n) => n.id === 'shell')!;
      shell.children = [...shell.children!, 'stray'];
      component.nodes.push(
        node('stray', 'net.noodl.controls.radiobutton', { value: lit('x') }, { parent: 'shell' })
      );
    });
    expect(result.notes.join('\n')).toContain('radio-button/no-group');
  });

  test('a wired checked mints local state (CONTROLLED-STATE §4c) — a dead feed drops named, the state stays', () => {
    const result = withShowcase((component) => {
      component.connections.push({
        key: 'x:value->remember:checked',
        fromId: 'x',
        fromProperty: 'value',
        toId: 'remember',
        toProperty: 'checked',
        kind: 'value'
      });
    });
    expect(result.notes.join('\n')).toContain('the control keeps local state without the graph feed');
    const tsx = result.files['src/components/Showcase.tsx'];
    // The wired checkbox is controlled off its state row; its authored boot moved into useState.
    expect(tsx).toContain('const [checked, setChecked] = useState<boolean>(true);');
    expect(tsx).toContain('checked={checked}');
    expect(tsx).toContain('onChange={(event) => setChecked(event.target.checked)}');
  });
});

describe('range, dropdown, video, circle (VISUALS-TARGET §4–§7)', () => {
  test('range is a native slider with authored bounds and accent colour', () => {
    expect(tsx).toContain('<input className={styles.volume} type="range" defaultValue={30} min={0} max={100} />');
    expect(css).toContain('.volume {\n  width: 100%;\n  accent-color: var(--primary);\n}');
  });

  test('dropdown renders literal items and the placeholder as a hidden option', () => {
    expect(tsx).toContain('<select className={styles.pick} defaultValue="">');
    expect(tsx).toContain('<option value="" disabled hidden>Pick a size</option>');
    expect(tsx).toContain('<option value="s">Small</option>');
    expect(tsx).toContain('<option value="l" disabled>Large</option>');
  });

  test('wired items defer the dropdown rather than render an empty shell', () => {
    const result = withShowcase((component) => {
      component.connections.push({
        key: 'x:items->pick:items',
        fromId: 'x',
        fromProperty: 'items',
        toId: 'pick',
        toProperty: 'items',
        kind: 'value'
      });
    });
    expect(result.notes.join('\n')).toContain('its items arrives over a wire');
    // §34.7 — the claim in this row's name is about the emitted FILE ("rather than render an
    // empty shell"), and a note cannot see whether the shell is there. The marker is.
    expect(result.files['src/components/Showcase.tsx']).toContain('TODO(export): net.noodl.controls.options — node pick sits here in the');
  });

  test('video passes sources and flags through, always stating object-fit', () => {
    expect(tsx).toContain('<video className={styles.promo} src="/assets/promo.mp4" controls muted />');
    expect(css).toContain('.promo {\n  object-fit: contain;\n}');
  });

  // ── §2: Start/End Time ─────────────────────────────────────────────────────────────────────

  test('🔴 a literal Start or End Time defers the video with a named reason', () => {
    for (const port of ['startTime', 'endTime']) {
      const result = withShowcase((component) => {
        component.nodes.find((n) => n.id === 'promo')!.parameters.push({ name: port, value: lit(5) });
      });
      expect(result.notes.join('\n')).toContain(
        `its ${port} composes a media fragment onto the source — that is resolved in the runtime and is not translated in this slice`
      );
    }
  });

  test('a wired Start or End Time defers too', () => {
    for (const port of ['startTime', 'endTime']) {
      const result = withShowcase((component) => {
        component.connections.push({
          key: `x:value->promo:${port}`,
          fromId: 'x',
          fromProperty: 'value',
          toId: 'promo',
          toProperty: port,
          kind: 'value'
        });
      });
      expect(result.notes.join('\n')).toContain(
        `its ${port} arrives over a wire, so the rendered structure is not static`
      );
    }
  });

  test('🔴 an EMPTY Start/End Time emits no marker and no difference', () => {
    // The state a cleared field leaves behind. It must not defer (nothing was asked for) and it
    // must not raise `has no style or content mapping` either — the trap §1 stage 1 shipped once.
    const result = withShowcase((component) => {
      component.nodes
        .find((n) => n.id === 'promo')!
        .parameters.push({ name: 'startTime', value: lit('') }, { name: 'endTime', value: lit('') });
    });
    const out = result.files['src/components/Showcase.tsx'];
    expect(out).not.toContain('has no style or content mapping');
    expect(out).toBe(tsx);
  });

  test('circle computes the runtime arc paths at generation time', () => {
    expect(tsx).toContain('width={80}');
    expect(tsx).toContain('height={80}');
    expect(tsx).toContain('xmlns="http://www.w3.org/2000/svg"');
    expect(tsx).toContain('<path d="M 0 40 A 40 40 0 1 0 40 0 L 40 40 L 0 40" fill="var(--primary)" />');
    expect(tsx).toContain('d="M 4 40 A 36 36 0 1 0 40 4"');
    expect(tsx).toContain('stroke="black"');
    expect(tsx).toContain('strokeWidth={8}');
  });

  test('a full circle survives via the runtime epsilon nudge', () => {
    const result = withShowcase((component) => {
      const dot = component.nodes.find((n) => n.id === 'dot')!;
      dot.parameters = dot.parameters.filter((p) => p.name !== 'endAngle' && p.name !== 'strokeEnabled' && p.name !== 'strokeWidth');
    });
    const full = result.files['src/components/Showcase.tsx'];
    expect(full).toMatch(/<path d="M 39\.9999 0 A 40 40 0 1 0 40 0 L 40 40 L 39\.9999 0"/);
  });

  /**
   * §1 of NOTES-UNOWNED-NODE-WORK.md, stage 1: `shape` is not translated to Square/Triangle SVG
   * yet — only Circle's arc math is ported here. A literal non-circle shape must defer whole,
   * with a named marker, rather than emit the arc above for a shape that is not a circle at all.
   */
  test('🔴 a literal "square"/"triangle" shape defers the node with a named marker, not an arc', () => {
    const result = withShowcase((component) => {
      component.nodes.find((n) => n.id === 'dot')!.parameters.push({ name: 'shape', value: lit('square') });
    });
    expect(result.notes.join('\n')).toContain('the "square" shape is not translated in this slice');
    const out = result.files['src/components/Showcase.tsx'];
    // The circle's own arc path must not appear — a defer that still drew the old shape would
    // be a silent wrong-shape bug, exactly the class of defect "emit an arc nobody asked for"
    // (the module note in circle.ts) names.
    expect(out).not.toContain('xmlns="http://www.w3.org/2000/svg"');
    expect(out).toContain('TODO(export)');
  });

  test('a WIRED shape defers too, before any literal value is even read', () => {
    const result = withShowcase((component) => {
      component.connections.push({
        key: 'x:value->dot:shape',
        fromId: 'x',
        fromProperty: 'value',
        toId: 'dot',
        toProperty: 'shape',
        kind: 'value'
      });
    });
    expect(result.notes.join('\n')).toContain('its shape arrives over a wire, so the rendered structure is not static');
  });

  test('an explicit `shape: "circle"` renders identically to leaving it unset', () => {
    const result = withShowcase((component) => {
      component.nodes.find((n) => n.id === 'dot')!.parameters.push({ name: 'shape', value: lit('circle') });
    });
    expect(result.files['src/components/Showcase.tsx']).toBe(tsx);
  });

  // ── Stage 2: `points` and `cornerRadius` ───────────────────────────────────────────────────

  test('the two shapes stage 2 added defer by the same named marker', () => {
    for (const shape of ['polygon', 'star']) {
      const result = withShowcase((component) => {
        component.nodes.find((n) => n.id === 'dot')!.parameters.push({ name: 'shape', value: lit(shape) });
      });
      expect(result.notes.join('\n')).toContain(`the "${shape}" shape is not translated in this slice`);
      expect(result.files['src/components/Showcase.tsx']).not.toContain('xmlns="http://www.w3.org/2000/svg"');
    }
  });

  test('a wired `points` or `cornerRadius` defers — both move the outline itself', () => {
    for (const port of ['points', 'cornerRadius']) {
      const result = withShowcase((component) => {
        component.connections.push({
          key: `x:value->dot:${port}`,
          fromId: 'x',
          fromProperty: 'value',
          toId: 'dot',
          toProperty: port,
          kind: 'value'
        });
      });
      expect(result.notes.join('\n')).toContain(
        `its ${port} arrives over a wire, so the rendered structure is not static`
      );
    }
  });

  /**
   * 🔴 **The registry stage 1 found the hard way, checked for stage 2's ports before shipping
   * them.** `cornerRadius` and `points` are gated off for a Circle, so the only way one reaches
   * the exporter is an author who set it on a Square and switched back — a stale parameter on a
   * node that renders perfectly. If it is missing from `emit/style.ts`'s `CONTENT_PARAMS.Circle`,
   * that author gets `TODO(export): … has no style or content mapping` over correct output.
   *
   * ⚠️ Asserting byte-identity against the unset render is what makes this measure the marker's
   * ABSENCE. A test that only asserted the defer cases would pass with the registry untouched —
   * which is exactly how stage 1 shipped the bug it later found.
   */
  test('🔴 a custom SVG source defers by its OWN reason, not the generic shape one', () => {
    // The wall is a different kind — arbitrary author markup rather than un-ported arithmetic —
    // and telling an author to wait for "a translation" would name the wrong obstacle.
    const result = withShowcase((component) => {
      component.nodes
        .find((n) => n.id === 'dot')!
        .parameters.push({ name: 'shape', value: lit('svg') }, { name: 'svgSource', value: lit('<svg><rect/></svg>') });
    });
    const notes = result.notes.join('\n');
    expect(notes).toContain('its shape is a custom SVG source — author markup is not translated into JSX in this slice');
    expect(notes).not.toContain('the "svg" shape is not translated in this slice');
    // And no author markup leaks into the emitted file.
    expect(result.files['src/components/Showcase.tsx']).not.toContain('<rect');
  });

  test('a wired `svgSource` defers before any literal is read', () => {
    const result = withShowcase((component) => {
      component.connections.push({
        key: 'x:value->dot:svgSource',
        fromId: 'x',
        fromProperty: 'value',
        toId: 'dot',
        toProperty: 'svgSource',
        kind: 'value'
      });
    });
    expect(result.notes.join('\n')).toContain(
      'its svgSource arrives over a wire, so the rendered structure is not static'
    );
  });

  test('🔴 a stale `cornerRadius`/`points` on a Circle emits no marker and no difference', () => {
    const result = withShowcase((component) => {
      component.nodes
        .find((n) => n.id === 'dot')!
        .parameters.push(
          { name: 'cornerRadius', value: lit(12) },
          { name: 'points', value: lit(7) },
          { name: 'svgSource', value: lit('<svg><rect/></svg>') }
        );
    });
    const out = result.files['src/components/Showcase.tsx'];
    expect(out).not.toContain('has no style or content mapping');
    expect(out).toBe(tsx);
  });
});

/**
 * Session 30 (RECORD-VERBS §19). A control whose `label`/`min`/`max`/`step` arrives over a wire
 * reported "the rendered structure is not static". It is not: the runtime spends `label` as the
 * single text child of `<label>` and `min`/`max`/`step` as plain attributes, and no emitted CSS
 * reads them. The node must still defer — an omitted bound renders a 0–100 slider where the app
 * renders the row's — but the wall is whatever feeds the port, and every such node in the corpus
 * is behind a wall already on the list. These assertions hold the two halves apart: a genuinely
 * structural port keeps the old verdict, a content port names its source.
 */
describe('wire-fed controls name their source, not a phantom structure wall (§19)', () => {
  const wire = (fromId: string, fromProperty: string, toId: string, toProperty: string) => ({
    key: `${fromId}:${fromProperty}->${toId}:${toProperty}`,
    fromId,
    fromProperty,
    toId,
    toProperty,
    kind: 'value' as const
  });

  /** A row record and a component record, so a reason can name two different sources. */
  const withSource = (type: string, id: string, from: string, to: string, port: string) =>
    withShowcase((component) => {
      component.nodes.push(node(id, type, {}, { parent: undefined }));
      component.connections.push(wire(id, from, to, port));
    });

  test('a wired checkbox label names the record feeding it', () => {
    const result = withSource('Model2', 'row', 'prop-Label', 'remember', 'label');
    const notes = result.notes.join('\n');
    expect(notes).toContain(
      'its label is fed by Model2 — the value is not statically known, and the node is left out rather than drawn with a wrong one'
    );
    expect(notes).not.toContain('its label arrives over a wire');
  });

  test('a wired range bound names the record feeding it', () => {
    const result = withSource('net.noodl.ComponentObject', 'rec', 'value-Min', 'volume', 'min');
    expect(result.notes.join('\n')).toContain(
      'its min is fed by net.noodl.ComponentObject — the value is not statically known, and the node is left out rather than drawn with a wrong one'
    );
  });

  /**
   * The discriminating row. If the reason ever collapses back to one constant sentence, the two
   * sources stop being distinguishable and the census can no longer group these nodes onto the
   * wall they are actually behind — which is the whole point of the change.
   */
  test('the same port fed by two different sources reads as two different walls', () => {
    const fromRow = withSource('Model2', 'row', 'prop-Min', 'volume', 'min').notes.join('\n');
    const fromRecord = withSource('net.noodl.ComponentObject', 'rec', 'value-Min', 'volume', 'min').notes.join('\n');
    expect(fromRow).toContain('its min is fed by Model2');
    expect(fromRecord).toContain('its min is fed by net.noodl.ComponentObject');
    expect(fromRow).not.toContain('net.noodl.ComponentObject');
  });

  test('useLabel still defers as structure — it decides whether the label element exists', () => {
    const result = withSource('Model2', 'row', 'prop-Show', 'remember', 'useLabel');
    expect(result.notes.join('\n')).toContain('its useLabel arrives over a wire, so the rendered structure is not static');
    // "whether the label element exists" is a fact about the file, so the file is what says it.
    expect(result.files['src/components/Showcase.tsx']).toContain('node remember sits here in the');
  });

  test("a radio's wired value still defers as structure — it decides which child is checked", () => {
    const result = withSource('Model2', 'row', 'prop-Value', 'small', 'value');
    expect(result.notes.join('\n')).toContain('its value arrives over a wire, so the rendered structure is not static');
    // "which child is checked" is likewise a fact about the file.
    expect(result.files['src/components/Showcase.tsx']).toContain('node small sits here in the');
  });

  test('an unwired control is untouched by the split', () => {
    const notes = withShowcase().notes.join('\n');
    expect(notes).not.toContain('is fed by');
    expect(notes).not.toContain('arrives over a wire');
  });

  /**
   * EXP-011 §34. Every row above asserts the *note*, and a note is not the thing the author reads
   * first — the exported repo is. A deferred control was left out of the JSX with nothing where it
   * stood, which is exactly the defect EXP-010 AC3 ("nothing dropped silently") exists to close;
   * AC3 marked the child whose *type* could not be identified and left every other one silent.
   *
   * 🔴 Measured before the fix, over the 60 exportable corpus projects: **73 of 73** deferred
   * visual controls appeared nowhere in generated source, while the same export wrote 1077 marked
   * node ids into those same files. These rows assert the file, so the gate can no longer pass on a
   * report sentence alone.
   */
  const showcaseFile = (result: { files: Record<string, string> }) => result.files['src/components/Showcase.tsx'];

  test('a deferred control leaves a marker where it stood, in the emitted file', () => {
    const file = showcaseFile(withSource('Model2', 'row', 'prop-Label', 'remember', 'label'));
    expect(file).toContain('TODO(export): net.noodl.controls.checkbox — node remember sits here in the');
    expect(file).toContain('its label is fed by Model2');
  });

  test('the marker names the reason, not a generic sentence', () => {
    const file = showcaseFile(withSource('net.noodl.ComponentObject', 'rec', 'value-Min', 'volume', 'min'));
    expect(file).toContain('TODO(export): net.noodl.controls.range — node volume sits here in the');
    expect(file).toContain('its min is fed by net.noodl.ComponentObject');
    expect(file).not.toContain('No catalog entry');
  });

  /**
   * The discriminating row. A control that renders must NOT also be marked as dropped — otherwise
   * the fix would be trading a silent hole for a marker on every working node, and the marker would
   * stop meaning anything.
   */
  test('a control that renders is not marked as dropped', () => {
    const file = showcaseFile(withShowcase());
    expect(file).toContain('type="checkbox"');
    expect(file).not.toContain('sits here in the');
  });

});

describe('nothing regresses on the untouched fixture', () => {
  test('the cheer fixture emits with only the router-shell note', () => {
    const plain = emitApp(structuredClone(baseIr), catalog);
    expect(plain.notes).toEqual([
      'App: router shell — emitted as src/App.tsx by the scaffold',
      'Components/GreetingCard: wire greet-state:value-Draft->greet-draft:startValue: property "Draft" reads its boot value — no wire writes it (a runtime script would) — rendered as the empty/omitted form'
    ]);
  });
});
