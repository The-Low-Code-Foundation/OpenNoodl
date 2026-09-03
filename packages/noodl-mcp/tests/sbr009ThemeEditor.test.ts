/**
 * SBR-009 — the theme editor demos itself.
 *
 * The phase's root person-sentence is *"a client can change their site's colour
 * and see the site change"*, and this file grades the screen that sentence is
 * about. It reads the **shipped artefact off disk**, not the component sets: the
 * sets are the argument, `site-builder.content.json` is what a person receives,
 * and every finding this phase has paid for came from grading the second.
 *
 * ## What a structural gate can hold, and what it cannot
 *
 * 🔴 Three of SBR-009's four acceptance criteria are **person sentences** and
 * are settled in a browser, in the task file — a spec cannot see a colour
 * change. What it can hold is every claim the drive would otherwise have to
 * re-derive by hand, and each one here is chosen because a plausible edit
 * breaks it silently:
 *
 *  - the presets row is **generated** from `SITE_THEME_PRESETS`, so a fourth
 *    preset cannot exist in the data and be missing from the screen;
 *  - a pick reaches **all twelve** record fields, not the five with a box —
 *    which is the whole of SBR-003's *"the preset row writes the full record"*;
 *  - the record reaches all twelve **back**, so opening this screen and pressing
 *    Save stops blanking the seven it does not show (it did, before SBR-009);
 *  - the preview consumes **token names**, and the scope class it is keyed on
 *    is the one the rule writes — the trap in SBR-009 §4, which has a mechanism
 *    here rather than a promise;
 *  - the admin panel's applier is **the same script** as the public site's.
 *
 * Every arm is paired with a mutant, because an arm that reads green over an
 * artefact it cannot see reads exactly like an arm that passes.
 *
 * @see siteBuilderStyleScan.ts — the shared artefact walker.
 * @see sbr012RawColourGate.test.ts — where the preset block's ONE colour
 *      exemption is asserted to BE `SITE_THEME_PRESETS`.
 */
import {
  SITE_THEME_PRESETS,
  SITE_THEME_PRESET_LABELS,
  THEME_TOKEN_FIELDS,
  ThemeField,
  buildThemeApplierScript
} from '../../noodl-editor/src/editor/src/models/template/templates/siteTheme';
import { PREVIEW_SCOPE_CLASS, THEME_EDITOR_FIELDS } from './sb005Components';
import { readArtefact } from './siteBuilderStyleScan';

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

const artefact = readArtefact() as unknown as {
  components: Array<{ name: string; graph: { roots: Node[]; connections?: Connection[] } }>;
};

const component = (name: string) => {
  const found = artefact.components.find((c) => c.name === name);
  if (!found) throw new Error(`SBR-009: no component "${name}" in the artefact`);
  return found;
};

/** Every node of a component, flattened — visual children included. */
const nodesOf = (name: string): Node[] => {
  const out: Node[] = [];
  const walk = (n: Node) => {
    out.push(n);
    for (const c of n.children ?? []) walk(c);
  };
  for (const r of component(name).graph.roots) walk(r);
  return out;
};

const wiresOf = (name: string): Connection[] => component(name).graph.connections ?? [];

/** 🔴 The door reallocates ids (`save` ships as `save-3`), so nothing here keys on one. */
const byLabel = (name: string, label: string): Node => {
  const found = nodesOf(name).filter((n) => n.label === label);
  if (found.length !== 1) throw new Error(`SBR-009: ${found.length} nodes labelled "${label}" in ${name}, wanted 1`);
  return found[0];
};

const EDITOR = '/Pages/ThemeEditor';
const SHELL = '/Admin/Shell';
const CHIP = '/Admin/PresetChip';

/** `colorPrimary` → `primary`, the port name the graph carries. */
const portOf = (field: ThemeField): string => field.replace(/^color(.)/, (_, c: string) => c.toLowerCase());
const FIELDS = Object.keys(THEME_TOKEN_FIELDS) as ThemeField[];

/** The subtree the preview rule scopes — the class is the whole mechanism. */
const previewSubtree = (): Node[] => {
  const scope = byLabel(EDITOR, 'Preview scope');
  const out: Node[] = [];
  const walk = (n: Node) => {
    out.push(n);
    for (const c of n.children ?? []) walk(c);
  };
  walk(scope);
  return out;
};

describe('SBR-009 §0 — the instrument can see', () => {
  /**
   * 🔴 Read this before believing any assertion below. Every one of them is a
   * claim about a walk, and a walk that visited nothing produces the same green
   * as a screen that is correct — which is the one failure this phase has paid
   * for more often than any other.
   */
  it('the walker reaches the three components this file is about', () => {
    expect(nodesOf(EDITOR).length).toBeGreaterThanOrEqual(50);
    expect(nodesOf(SHELL).length).toBeGreaterThanOrEqual(20);
    // 3 → 4 with D54: the chip gained the `pick` script that republishes its own
    // name at the press. See §1's block below.
    expect(nodesOf(CHIP)).toHaveLength(4);
    expect(wiresOf(EDITOR).length).toBeGreaterThanOrEqual(60);
  });

  it('the source of truth is not empty either', () => {
    expect(Object.keys(SITE_THEME_PRESETS)).toHaveLength(3);
    expect(FIELDS).toHaveLength(12);
    expect(THEME_EDITOR_FIELDS).toHaveLength(5);
  });
});

describe('SBR-009 §1 — the presets row is generated, not typed', () => {
  const chips = () => nodesOf(EDITOR).filter((n) => n.type === CHIP);

  it('there is one chip per preset, and its name and label come from the data', () => {
    expect(chips().map((c) => c.parameters?.name).sort()).toEqual(Object.keys(SITE_THEME_PRESETS).sort());
    for (const chip of chips()) {
      const name = chip.parameters?.name as keyof typeof SITE_THEME_PRESETS;
      expect(`${String(name)} label: ${String(chip.parameters?.label)}`).toBe(
        `${String(name)} label: ${SITE_THEME_PRESET_LABELS[name]}`
      );
    }
  });

  /**
   * 🔴 One component placed three times, not three buttons. The `Component
   * Inputs` interface is what makes one component render three different chips —
   * a chip without one would render identically however many times it was placed,
   * which is the ghost the MCP's own guidance warns about and the same argument
   * that made `/Admin/Shell` a component.
   */
  it('the chip has an interface, and it is what the placements differ by', () => {
    const inputs = nodesOf(CHIP).find((n) => n.type === 'Component Inputs');
    expect((inputs as unknown as { ports?: Array<{ name: string }> })?.ports?.map((p) => p.name).sort()).toEqual([
      'label',
      'name'
    ]);
    // The placements are observably different renders, not three copies.
    expect(new Set(chips().map((c) => c.parameters?.name)).size).toBe(3);
  });

  it('every chip is wired to the picker: the press as a value, the click as a signal', () => {
    const wires = wiresOf(EDITOR);
    const picker = byLabel(EDITOR, 'The three presets');
    for (const chip of chips()) {
      const mine = wires.filter((w) => w.fromId === chip.id && w.toId === picker.id);
      expect(`${String(chip.parameters?.name)}: ${mine.map((w) => `${w.fromProperty}->${w.toProperty}`).sort().join(',')}`).toBe(
        `${String(chip.parameters?.name)}: Picked->run,pick->in-pick`
      );
    }
  });

  /**
   * 🔴 **D54 — the wire above was here all along and said nothing about WHICH.**
   *
   * `name->in-name` was this block's pin for the life of the template, and it was
   * true: every chip did wire its name into the picker. All three wired it into
   * the **same** port, as a `Component Inputs` constant published at MOUNT, so the
   * last placement — `night` — is what sat there, and `run` carries no payload. A
   * person pressing `Studio` got Night, on every surface, for the life of the
   * screen. It read as *"the presets are dead on the deploy"* because the screen it
   * was measured on already held Night.
   *
   * ⚠️ **A structural pin cannot see this and this one is kept anyway** — it is what
   * says the wires exist. The behaviour is graded in `d54ThemePresetIdentity.test.ts`,
   * which instantiates the shipped chip in the real runtime, presses each of the
   * three, and carries the pre-fix pair beside it as the arm that answers `night`
   * whichever chip is pressed.
   */
  it('the chip publishes the press itself, so the picker can tell the three apart', () => {
    const pick = byLabel(CHIP, 'This chip, at the moment it is pressed');
    // An object, not a name: a Function publishes an output only when it CHANGES,
    // so a re-pressed chip republishing its own string sends nothing.
    expect(String(pick.parameters?.functionScript)).toContain('Outputs.pick = { name: Inputs.name };');
    // And it waits for the click, exactly as the picker does.
    expect(pick.parameters?.['runOnChange-in-name']).toBe(false);
    const chipWires = wiresOf(CHIP);
    expect(chipWires.some((w) => w.toId === pick.id && w.toProperty === 'run')).toBe(true);
    expect(chipWires.some((w) => w.fromId === pick.id && w.fromProperty === 'out-pick')).toBe(true);
  });

  /**
   * 🔴 **The defect the browser found, pinned on the artefact.**
   *
   * Each chip publishes its `name` at MOUNT — a `Component Inputs` constant per
   * placement — so with the checkbox ticked this node ran three times before
   * anybody touched anything and the screen booted wearing the LAST placement's
   * palette, picked by nobody. `run` is additive: wiring it does not stop a node
   * running on its own.
   *
   * ⚠️ Authored `false` rather than left unstated, and the distinction is this
   * template's alone: DEF-007 §3.2's `pinRunOnValueChangeDefaults` writes `true`
   * into the artefact for every governed checkbox the source leaves unstated, so
   * "unstated" here means "runs on arrival". The only way to say *wait for the
   * signal* is to say it.
   *
   * @see sbr009ThemeEditorDrive — the same claim on the rendered screen.
   */
  it('the picker waits for the signal — it does not run when a chip mounts', () => {
    const picker = byLabel(EDITOR, 'The three presets');
    expect(picker.parameters?.['runOnChange-in-pick']).toBe(false);
    // The pair: `run` IS wired, so the node is not simply switched off.
    expect(wiresOf(EDITOR).some((w) => w.toId === picker.id && w.toProperty === 'run')).toBe(true);
  });

  it('MUTANT: a preset in the data with no chip on the screen reddens', () => {
    const chipNames = chips().map((c) => c.parameters?.name);
    const withAFourth = [...Object.keys(SITE_THEME_PRESETS), 'winter'];
    expect(chipNames.sort()).not.toEqual(withAFourth.sort());
  });
});

describe('SBR-009 §2 — a pick fills the whole record, not the visible five', () => {
  const picker = () => byLabel(EDITOR, 'The three presets');
  const builder = () => byLabel(EDITOR, 'The theme tokens, as one object');

  it('the picker publishes exactly the twelve contract fields', () => {
    const script = String(picker().parameters?.functionScript);
    const published = [...script.matchAll(/Outputs\.([A-Za-z]+) =/g)].map((m) => m[1]).sort();
    expect(published).toEqual(FIELDS.map(portOf).sort());
  });

  /**
   * 🔴 **SBR-003 §1: "the preset row writes the full record."** The five a client
   * edits by hand are the five with a box; the other seven — `colorOnPrimary`,
   * `colorSurface`, `colorTextSoft`, `colorBorder`, `colorAccentSoft`, `fontUi`,
   * `measure` — are the companions a hand-editor never thinks about and is not
   * asked to. If a pick reached only the boxes, picking Night would leave the
   * previous look's border and accent behind and the site would be neither.
   */
  it('all twelve reach the working set, including the seven with no box', () => {
    const wires = wiresOf(EDITOR);
    const reached = wires
      .filter((w) => w.fromId === picker().id && w.toId === builder().id)
      .map((w) => w.toProperty)
      .sort();
    expect(reached).toEqual(FIELDS.map((f) => `in-${portOf(f)}`).sort());

    const invisible = FIELDS.filter((f) => !THEME_EDITOR_FIELDS.some((e) => e.field === f));
    expect(invisible).toHaveLength(7);
    for (const field of invisible) {
      expect(`${field} reached: ${reached.includes(`in-${portOf(field)}`)}`).toBe(`${field} reached: true`);
    }
  });

  /**
   * 🔴 **And the record reaches all twelve back — which is a defect SBR-009
   * fixed rather than a feature it added.** Before this task `buildTokens` was
   * fed four inputs and wrote twelve keys, so opening the theme editor on a
   * preset-themed site and pressing Save wrote `''` over the other eight. Nobody
   * had seen it because nothing could set those eight in the first place; the
   * presets row is what would have made it lossy.
   */
  it('the record reaches all twelve back, so Save cannot blank the invisible seven', () => {
    const reader = byLabel(EDITOR, 'Read the theme tokens');
    const reached = wiresOf(EDITOR)
      .filter((w) => w.fromId === reader.id && w.toId === builder().id)
      .map((w) => w.toProperty)
      .sort();
    expect(reached).toEqual(FIELDS.map((f) => `in-${portOf(f)}`).sort());
  });

  it('MUTANT: the pre-SBR-009 shape — four inputs on the builder — names the eight it lost', () => {
    const before = ['in-primary', 'in-background', 'in-text', 'in-fontDisplay'];
    const lost = FIELDS.map((f) => `in-${portOf(f)}`).filter((p) => !before.includes(p));
    expect(lost.sort()).toEqual(
      [
        'in-accentSoft',
        'in-border',
        'in-fontUi',
        'in-measure',
        'in-onPrimary',
        'in-radius',
        'in-surface',
        'in-textSoft'
      ].sort()
    );
    // …and the shipped graph is not that shape.
    const reached = wiresOf(EDITOR)
      .filter((w) => w.toId === builder().id)
      .map((w) => w.toProperty);
    for (const port of lost) expect(`${port} present: ${reached.includes(port)}`).toBe(`${port} present: true`);
  });
});

describe('SBR-009 §3 — the five boxes, and the pulse that refills them', () => {
  it('the five editable fields are labelled, and are the five the module names', () => {
    for (const f of THEME_EDITOR_FIELDS) {
      const node = byLabel(EDITOR, f.label);
      expect(`${f.id} type: ${node.type}`).toBe(`${f.id} type: net.noodl.controls.textinput`);
      expect(`${f.id} useLabel: ${String(node.parameters?.useLabel)}`).toBe(`${f.id} useLabel: true`);
      expect(`${f.id} label: ${String(node.parameters?.label)}`).toBe(`${f.id} label: ${f.label}`);
    }
  });

  /**
   * 🔴 `startValue`'s setter returns early when the incoming text equals the one
   * it last received (`text-input.ts:184`) and typing does NOT update that copy.
   * Pick Night, type over the primary, pick Night again: without the `Set` pulse
   * the box keeps the typed value and quietly disagrees with the record about to
   * be saved. Both halves are asserted — the value AND the pulse — because
   * either alone is a screen that lies in one direction.
   */
  it('each box takes the picked value AND a Set pulse', () => {
    const wires = wiresOf(EDITOR);
    const picker = byLabel(EDITOR, 'The three presets');
    for (const f of THEME_EDITOR_FIELDS) {
      const box = byLabel(EDITOR, f.label);
      const from = wires
        .filter((w) => w.fromId === picker.id && w.toId === box.id)
        .map((w) => `${w.fromProperty}->${w.toProperty}`)
        .sort();
      expect(`${f.id}: ${from.join(',')}`).toBe(
        `${f.id}: ${['out-picked->set', `out-${portOf(f.field)}->startValue`].sort().join(',')}`
      );
    }
  });

  /**
   * ⚠️ Belt and braces, and the reason is worth writing down. NDA-017's migration
   * silences every value input of a node whose control signal is wired — and
   * `Set` is now wired on all five. It does not bite HERE, because DEF-007 §3.2's
   * `pinRunOnValueChangeDefaults` states every governed checkbox `true` into the
   * artefact at generation time and the migration never touches a key that is
   * present. This arm is what says the shipped artefact really does state it: if
   * the pinner ever stopped covering this family, the record would silently stop
   * reaching the boxes on load and nothing else here would notice.
   */
  it('the shipped boxes state runOnChange-startValue, and it is true', () => {
    for (const f of THEME_EDITOR_FIELDS) {
      const box = byLabel(EDITOR, f.label);
      expect(`${f.id}: ${String(box.parameters?.['runOnChange-startValue'])}`).toBe(`${f.id}: true`);
    }
  });

  /**
   * 🔴 SBR-016's defect, one wire away from being re-introduced. SBR-009 wires
   * `storageFetch` on the theme singleton so the panel repaints on Save, and that
   * alone would have put `runOnChange-collectionName: false` into the bag on every
   * project load — killing the LOAD-time fetch and opening the screen with eleven
   * empty boxes on a themed site.
   */
  it('the theme singleton keeps its load-time fetch despite the refresh wire', () => {
    const query = nodesOf(EDITOR).find((n) => n.type === 'DbCollection2' && n.parameters?.collectionName === 'Theme');
    expect(query).toBeDefined();
    expect(String(query?.parameters?.['runOnChange-collectionName'])).toBe('true');
    expect(wiresOf(EDITOR).some((w) => w.toId === query?.id && w.toProperty === 'storageFetch')).toBe(true);
  });
});

describe('SBR-009 §4 — the preview consumes token NAMES', () => {
  /**
   * 🔴 **The trap, with a mechanism instead of a promise.** SBR-009 §4: *"the
   * preview panel must consume the SAME token names, not a copied palette (the
   * second-copy-drifts trap wearing a preview costume)"*. Wiring the edited hexes
   * into the preview's colour ports would have been fewer nodes and a second
   * palette: the panel would show *the fields* rather than *the site*, and would
   * disagree the day a component started reading a token the fields do not carry.
   */
  it('not one colour in the preview is a value — every one is a var(--token)', () => {
    const painted = ['backgroundColor', 'color', 'borderColor', 'borderRadius', 'fontFamily'];
    const offenders: string[] = [];
    for (const node of previewSubtree()) {
      for (const [port, value] of Object.entries(node.parameters ?? {})) {
        if (!painted.includes(port)) continue;
        if (typeof value === 'string' && /^var\(--[A-Za-z0-9_-]+\)$/.test(value)) continue;
        offenders.push(`${node.label ?? node.type}.${port} = ${JSON.stringify(value)}`);
      }
    }
    expect(offenders).toEqual([]);
    // …beside the floor that makes the emptiness mean something.
    expect(previewSubtree().length).toBeGreaterThanOrEqual(8);
  });

  /** No wire lands on a painted port inside the preview: the scope is the only channel. */
  it('nothing is wired into the preview — the class is the only thing that changes it', () => {
    const inside = new Set(previewSubtree().map((n) => n.id));
    const landed = wiresOf(EDITOR)
      .filter((w) => inside.has(w.toId))
      .map((w) => `${w.toId}.${w.toProperty}`);
    expect(landed).toEqual([]);
  });

  /**
   * 🔴 **One name, two readers, and a spec that holds them together.** The scope
   * class is a parameter on a Group and a string inside a script; a rename that
   * reached one of them would leave a preview that renders the *saved* theme and
   * a rule that styles nothing — green everywhere, and wrong in the one place
   * this task exists to be right.
   */
  it('the class on the scope Group is the class the rule writes', () => {
    const scope = byLabel(EDITOR, 'Preview scope');
    expect(scope.parameters?.cssClassName).toBe(PREVIEW_SCOPE_CLASS);
    const rule = String(byLabel(EDITOR, 'The edited tokens, as a scoped rule').parameters?.functionScript);
    expect(rule).toContain(`.${PREVIEW_SCOPE_CLASS} {`);
  });

  it('the rule can write exactly the twelve contract tokens, and it reaches a CSS Definition', () => {
    const rule = String(byLabel(EDITOR, 'The edited tokens, as a scoped rule').parameters?.functionScript);
    const named = [...rule.matchAll(/"(--[A-Za-z0-9_-]+)"/g)].map((m) => m[1]).sort();
    expect(named).toEqual([...Object.values(THEME_TOKEN_FIELDS)].sort());

    const sheet = byLabel(EDITOR, 'Preview token scope');
    expect(sheet.type).toBe('CSS Definition');
    expect(
      wiresOf(EDITOR).some(
        (w) => w.toId === sheet.id && w.toProperty === 'style' && w.fromProperty === 'out-css'
      )
    ).toBe(true);
  });

  /**
   * 🔴 **The half that makes the preview a demo rather than a decoration.** Every
   * one of the five boxes a client edits must reach something the preview draws,
   * or a change is invisible in the panel built to show it. Asserted per field,
   * by the token that field overlays, so a preview that stopped painting with the
   * heading face names `fontDisplay` rather than failing as a total.
   */
  it('every editable field paints something in the preview', () => {
    const consumed = new Set<string>();
    for (const node of previewSubtree()) {
      for (const value of Object.values(node.parameters ?? {})) {
        if (typeof value !== 'string') continue;
        for (const m of value.matchAll(/var\(\s*(--[A-Za-z0-9_-]+)/g)) consumed.add(m[1]);
      }
    }
    for (const f of THEME_EDITOR_FIELDS) {
      const token = THEME_TOKEN_FIELDS[f.field];
      expect(`${f.field} → ${token}: ${consumed.has(token)}`).toBe(`${f.field} → ${token}: true`);
    }
  });

  it('MUTANT: a preview keyed on a class the rule does not write is invisible, and this pair says so', () => {
    const scope = byLabel(EDITOR, 'Preview scope');
    const rule = String(byLabel(EDITOR, 'The edited tokens, as a scoped rule').parameters?.functionScript);
    // The shipped pair agrees…
    expect(rule.includes(`.${String(scope.parameters?.cssClassName)} {`)).toBe(true);
    // …and a renamed Group would not, which is the whole of the failure.
    expect(rule.includes('.ndl-theme-preview-renamed {')).toBe(false);
  });
});

describe('SBR-009 §5 — AC1: the admin panel wears the theme too', () => {
  /**
   * 🔴 A client who changes their site's colour from a panel that stays the
   * shipped Studio blue reads it as *"it did not work"*. The applier is in the
   * SHELL because every admin screen places one — the same argument that made the
   * sidebar a component, and the reason one node cannot disagree with itself
   * between two screens.
   */
  it('the shell reads the Theme record and applies it', () => {
    const query = nodesOf(SHELL).find((n) => n.type === 'DbCollection2' && n.parameters?.collectionName === 'Theme');
    expect(query).toBeDefined();
    const applier = byLabel(SHELL, 'The saved theme, on this document');
    const wires = wiresOf(SHELL).filter((w) => w.fromId === query?.id && w.toId === applier.id);
    expect(wires.map((w) => `${w.fromProperty}->${w.toProperty}`).sort()).toEqual(['fetched->run', 'items->in-rows']);
  });

  /**
   * 🔴 **The second-copy-of-a-palette trap, closed by construction.** The derived
   * companions — `--primary-hover`, `--ring`, `--accent-foreground`, the two
   * border steps and the mirrored base family — are what would drift first,
   * because nobody edits two appliers on the same day. All three run one string.
   */
  it('all three appliers run ONE script, and it is the one in siteTheme.ts', () => {
    const shipped = [
      byLabel('/Pages/Site', 'The theme record, as CSS variables'),
      byLabel(SHELL, 'The saved theme, on this document'),
      byLabel(EDITOR, 'The saved theme, on this document')
    ].map((n) => String(n.parameters?.functionScript));

    for (const script of shipped) expect(script).toBe(buildThemeApplierScript());
    // The floor: the script is a real one, not an empty string agreeing with itself.
    expect(buildThemeApplierScript()).toContain("root.style.setProperty('--primary'");
    expect(buildThemeApplierScript().length).toBeGreaterThan(800);
  });

  /**
   * The repaint path. `saveTheme.done` re-fetches the singleton and the fetch runs
   * the editor's own applier, so the panel changes the instant Save lands rather
   * than on the next full load — which is the half of AC1 a reload would hide.
   */
  it('saving re-fetches the record, and the fetch is what repaints the panel', () => {
    const save = byLabel(EDITOR, 'Save the theme row');
    const query = nodesOf(EDITOR).find((n) => n.type === 'DbCollection2' && n.parameters?.collectionName === 'Theme');
    const applier = byLabel(EDITOR, 'The saved theme, on this document');
    const wires = wiresOf(EDITOR);

    expect(wires.some((w) => w.fromId === save.id && w.fromProperty === 'done' && w.toId === query?.id)).toBe(true);
    expect(wires.some((w) => w.fromId === query?.id && w.fromProperty === 'fetched' && w.toId === applier.id)).toBe(true);
    // And Save is one wire from the button to the write — the builder is no longer
    // in the path, which is why it lost its `run` and its `Outputs.built()`.
    const button = byLabel(EDITOR, 'Save theme');
    expect(wires.some((w) => w.fromId === button.id && w.toId === save.id && w.toProperty === 'store')).toBe(true);
  });
});
