/**
 * Every icon in the library is black by default — except the one node that draws on a filled ground.
 *
 * ## The defect
 *
 * `addIconInputs` shipped `iconColor: '#FFFFFF'` as the shared default for every node that can draw
 * an icon. White is invisible on every ground the library actually puts an icon on: the page, an
 * unfilled Checkbox, an unfilled Radio Button. Richard found it from the checkbox end, 2026-09-04:
 * *"of course it's WHITE by default so I didn't see it... Can we make every icon everywhere black
 * by default please?"*
 *
 * `Text Input` and `Select` had already passed `'#000000'` explicitly — the same judgement reached
 * one node at a time, which is the shape of a default that was wrong at the source.
 *
 * ## Why `Button` is exempt, and why that is a fact rather than a preference
 *
 * A Button dropped on the canvas is given `_variant: 'primary'` by `ButtonConfig`, which paints
 * `backgroundColor: var(--primary)` with `color: var(--primary-foreground)` (`#ffffff`). The icon
 * lands on a filled dark ground, so white is correct there and black would merely move the
 * invisibility onto the default button. §3 pins that reasoning to the config it depends on, so the
 * exemption fails loudly if the default variant ever stops painting a ground.
 *
 * ## The population is derived, not listed
 *
 * §2 counts `addIconInputs(` call sites on disk and requires the table below to cover all of them.
 * A new node that gains an icon therefore fails this suite until somebody states what its default
 * should be — which is the decision this file exists to keep from being made by accident.
 */

import * as fs from 'fs';
import * as path from 'path';

/**
 * ⚠️ **`require`, not `import`, and the global has to be set first.**
 *
 * `addDimensions` reads a bare `Noodl.deployed` at module scope (`node-shared-port-definitions.ts`),
 * so importing `button.ts` throws `ReferenceError: Noodl is not defined` and the suite fails *to
 * run* — `Tests: 0 total`, which reads nothing like a red assertion. ES imports hoist above any
 * assignment, so the stub cannot be installed by an `import`-shaped file.
 *
 * `deployed: true` takes the branch that skips tooltip wiring. It does not touch `addIconInputs`,
 * which is where every value this file asserts is decided.
 */
(globalThis as unknown as { Noodl: unknown }).Noodl = { deployed: true };

/* eslint-disable @typescript-eslint/no-var-requires */
const ButtonNodeModule = require('../src/nodes/controls/button').default;
const CheckBoxNodeModule = require('../src/nodes/controls/checkbox').default;
const OptionsNodeModule = require('../src/nodes/controls/options').default;
const RadioButtonNodeModule = require('../src/nodes/controls/radiobutton').default;
const TextInputNodeModule = require('../src/nodes/controls/text-input').default;
const IconNodeModule = require('../src/nodes/visual/icon').default;
/* eslint-enable @typescript-eslint/no-var-requires */

const BLACK = '#000000';
const WHITE = '#FFFFFF';

/**
 * ⚠️ `inputs`, not `inputProps`. `addInputProps` is the *helper's* name; what it writes lands on
 * the definition's `inputs` map, which is what a reader of the node definition sees.
 */
type NodeModule = { node: { name: string; inputs?: Record<string, { default?: unknown }> } };

/** What each node ships, and the reason — the reason is the part worth reviewing. */
const EXPECTED: Array<{ label: string; module: unknown; expected: string; because: string }> = [
  { label: 'Icon', module: IconNodeModule, expected: BLACK, because: 'draws bare on the page ground' },
  { label: 'Checkbox', module: CheckBoxNodeModule, expected: BLACK, because: 'the tick sits in an unfilled box' },
  { label: 'Radio Button', module: RadioButtonNodeModule, expected: BLACK, because: 'as the checkbox' },
  { label: 'Text Input', module: TextInputNodeModule, expected: BLACK, because: 'was already explicit' },
  { label: 'Select', module: OptionsNodeModule, expected: BLACK, because: 'was already explicit' },
  {
    label: 'Button',
    module: ButtonNodeModule,
    expected: undefined,
    because: 'it inherits the label colour — no constant is right for both filled and transparent variants'
  }
];

/**
 * A Button rendered with an icon and nothing else, so the glyph's own style is the only thing in
 * the markup that could carry a colour. `textStyle` is left undefined on purpose — that branch
 * calls `resolveColor` through the node context, and none of this is about resolution.
 */
function renderButtonIcon(iconColor: string | undefined): string {
  /* eslint-disable @typescript-eslint/no-var-requires */
  const React = require('react');
  const { renderToStaticMarkup } = require('react-dom/server');
  const { Button } = require('../src/components/controls/Button');
  /* eslint-enable @typescript-eslint/no-var-requires */

  return renderToStaticMarkup(
    React.createElement(Button, {
      enabled: true,
      buttonType: 'button',
      useLabel: false,
      useIcon: true,
      iconSourceType: 'icon',
      iconIconSource: { codeAsClass: true, class: 'fa', code: 'fa-check' },
      iconSize: '16px',
      iconColor,
      style: {},
      styles: {},
      parentLayout: 'block',
      noodlNode: { context: { styles: { resolveColor: (c: unknown) => c } } }
    })
  );
}

function iconColorPort(mod: unknown): { default?: unknown } | undefined {
  return (mod as NodeModule).node?.inputs?.iconColor;
}

function iconColorDefault(mod: unknown): unknown {
  return iconColorPort(mod)?.default;
}

describe('§1 — the icon colour every node ships', () => {
  it.each(EXPECTED)('$label defaults to $expected — $because', ({ module, expected }) => {
    expect(iconColorDefault(module)).toBe(expected);
  });

  it('gives every node in the table an iconColor PORT, whatever its default', () => {
    /**
     * 🔴 **Presence of the port, not of a default.** Button's default is deliberately `undefined`,
     * so a check written as *"every default is defined"* would either fail on the one correct row
     * or, written the other way, pass for a node whose port had vanished entirely. Those are
     * different facts and this asserts the one that is always true.
     */
    const missing = EXPECTED.filter((row) => iconColorPort(row.module) === undefined);
    expect(missing.map((row) => row.label)).toEqual([]);
  });
});

describe('§2 — the table covers every node that can draw an icon', () => {
  /**
   * 🔴 **Derived from disk, so a new icon-bearing node cannot slip past.**
   *
   * Counting call sites rather than naming files: `addIconInputs` is the only way a node gets an
   * icon, so its call sites *are* the population. A node added next month reddens this and the
   * person adding it has to say which ground its icon sits on.
   */
  function addIconInputsCallSites(): string[] {
    const roots = [path.join(__dirname, '..', 'src', 'nodes')];
    const hits: string[] = [];

    const walk = (dir: string) => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) walk(full);
        else if (/\.tsx?$/.test(entry.name) && fs.readFileSync(full, 'utf8').includes('addIconInputs(')) {
          hits.push(full);
        }
      }
    };

    for (const root of roots) walk(root);
    return hits;
  }

  it('finds exactly as many icon-bearing nodes as the table describes', () => {
    const sites = addIconInputsCallSites();

    // The known-firing half: if the scan found nothing, the equality below would be a comparison
    // of two empty populations and would pass while measuring nothing at all.
    expect(sites.length).toBeGreaterThan(0);
    expect(sites.length).toBe(EXPECTED.length);
  });
});

describe('§3 — why a Button cannot take a constant, and what it does instead', () => {
  it('has two default variants that need opposite icon colours', () => {
    /**
     * The evidence for §1's Button row, read from the config rather than restated. A fresh Button
     * is `primary` — a filled `--primary` ground with `--primary-foreground` text, where a black
     * icon would vanish. `outline` is transparent with `--foreground` text, where a white one does.
     * That is the whole argument for inheriting, and it fails here if either variant changes.
     */
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { ButtonConfig } = require('../../noodl-editor/src/editor/src/models/ElementConfigs/configs/ButtonConfig');

    expect(ButtonConfig.defaults._variant).toBe('primary');
    expect(ButtonConfig.variants.primary.backgroundColor).toBe('var(--primary)');
    expect(ButtonConfig.variants.outline.backgroundColor).toBe('transparent');
  });

  it('🔴 emits NO colour on the glyph when the author has not set one, so it inherits', () => {
    // The behaviour, not the default: `_renderIcon` must leave `color` off the icon's style so the
    // button's own resolved text colour reaches it. Paired with the case below, which is the
    // known-firing control — without it, an assertion that no colour appears would pass just as
    // well if the icon never rendered at all.
    const html = renderButtonIcon(undefined);

    expect(html).toContain('fa-check');
    expect(html).not.toMatch(/color:/);
  });

  it('still honours an author-set icon colour', () => {
    const html = renderButtonIcon('#123456');

    expect(html).toContain('fa-check');
    expect(html).toContain('#123456');
  });
});
