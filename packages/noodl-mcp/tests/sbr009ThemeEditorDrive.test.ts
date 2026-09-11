/**
 * SBR-009 AC2, in a browser — *"picking the Night preset restyles the preview
 * panel immediately, before save; never saving leaves the site unchanged."*
 *
 * ## Why this drive exists, and what it is allowed to conclude
 *
 * 🔴 The preview's whole mechanism is a **CSS scope**: `previewScope` carries
 * `cssClassName`, `previewCss` writes `.ndl-theme-preview { --primary: … }` into
 * a `CSS Definition`, and every node inside resolves the SAME token names
 * against that element instead of `:root`. Three things in that sentence are
 * unprovable from the graph and were unmeasured until this file:
 *
 *  1. a `CSS Definition`'s `style` input is declared `allowEditOnly` in the node
 *     catalog — the door accepted a **connection** into it, and nothing in the
 *     repository said whether the runtime would honour one;
 *  2. a custom property set on an ancestor really does win for a subtree whose
 *     colours are Noodl **inline** styles;
 *  3. the pick reaches the boxes and the rule in one pass.
 *
 * ⚠️ **No backend.** `DbCollection2` fires neither `fetched` nor `failure` with
 * no backend bound, so the record half of this screen does nothing here: the
 * boxes start empty and `applyTheme` never runs. That is not a limitation to
 * work around — it is the **strongest possible control** for AC2's second half.
 * The site's own tokens cannot have been touched by a record that was never
 * read, so a `:root` that does not move while the preview does is attributable
 * to the scope and to nothing else. AC1 (save changes the site AND the panel)
 * needs a provisioned backend and is settled in the task file, not here.
 *
 * 🔴 The reading that matters is the **painted** one. `--primary` moving inside
 * the scope is the mechanism; the hero band's computed `background-color`
 * changing from the shipped blue to Night's `#d9a441` is the person sentence,
 * and a spec that stopped at the variable would pass on a preview nothing draws.
 */
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import { SITE_THEME_PRESETS } from '../../noodl-editor/src/editor/src/models/template/templates/siteTheme';
import { Landmarks, NO_LANDMARKS, outlineFault, readLandmarks, stripOutlineTags } from './documentOutline';
import {
  ADMIN_PATH_PREFIX,
  PREVIEW_SCOPE_CLASS,
  SB005_COMPONENTS,
  THEME_EDITOR_FIELDS
} from './sb005Components';
import { buildSiteTemplateProject } from './sb007Template';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { withRenderedPage } = require(path.resolve(__dirname, '..', '..', '..', 'scripts', 'devtools', 'render-report.js'));

jest.setTimeout(600000);

interface RenderedPage {
  navigate(urlPath: string): Promise<void>;
  evaluate(expression: string): Promise<string>;
}

interface Reading {
  scopePresent: boolean;
  rootPrimary: string;
  scopePrimary: string;
  rootBackground: string;
  scopeBackground: string;
  scopeRadius: string;
  heroPainted: string | null;
  outsidePainted: string | null;
  rule: string | null;
  boxes: string[];
  chips: string[];
  chipReachable: boolean;
}

/**
 * One evaluate, one moment.
 *
 * `outsidePainted` is the negative control and it is deliberately a node the
 * theme also owns: the sidebar's current item is painted `var(--primary)` by
 * `/Admin/Shell`, on the same document, from the same token name. If the scope
 * leaked, this is what would move with it.
 */
const READ = `(function () {
  var scope = document.querySelector('.${PREVIEW_SCOPE_CLASS}');
  var prop = function (el, name) { return el ? getComputedStyle(el).getPropertyValue(name).trim() : ''; };
  var texts = [].slice.call(document.querySelectorAll('div, span, p'));
  var find = function (t) { return texts.filter(function (e) { return e.children.length === 0 && e.textContent.trim() === t; })[0] || null; };
  var hero = scope ? scope.querySelector('div') : null;
  var outside = find('Theme & settings');
  var rule = [].slice.call(document.querySelectorAll('style'))
    .map(function (s) { return s.textContent || ''; })
    .filter(function (t) { return t.indexOf('${PREVIEW_SCOPE_CLASS}') >= 0; })[0] || null;
  var buttons = [].slice.call(document.querySelectorAll('button'));
  var night = buttons.filter(function (b) { return b.textContent.trim() === 'Night'; })[0] || null;
  var reachable = false;
  if (night) {
    var r = night.getBoundingClientRect();
    var at = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    reachable = !!at && (at === night || night.contains(at) || at.contains(night));
  }
  return JSON.stringify({
    scopePresent: !!scope,
    rootPrimary: prop(document.documentElement, '--primary'),
    scopePrimary: prop(scope, '--primary'),
    rootBackground: prop(document.documentElement, '--background'),
    scopeBackground: prop(scope, '--background'),
    scopeRadius: prop(scope, '--radius-md'),
    heroPainted: hero ? getComputedStyle(hero).backgroundColor : null,
    outsidePainted: outside ? getComputedStyle(outside).color : null,
    rule: rule,
    boxes: [].slice.call(document.querySelectorAll('input')).map(function (i) { return i.value; }),
    chips: buttons.map(function (b) { return b.textContent.trim(); }),
    chipReachable: reachable
  });
})()`;

const CLICK = (label: string) => `(function () {
  var b = [].slice.call(document.querySelectorAll('button')).filter(function (x) { return x.textContent.trim() === '${label}'; })[0];
  if (!b) return 'no ${label} chip';
  b.click();
  return 'clicked';
})()`;
const CLICK_NIGHT = CLICK('Night');

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

let before: Reading;
let after: Reading;
let clickResult: string;
/** D54's readings: a chip that is NOT the last placement, and then a re-press. */
let afterStudio: Reading;
let afterNightAgain: Reading;
let afterStudioAgain: Reading;

/**
 * 🔴 **§4 — `/Pages/ThemeEditor`'s document outline, as the browser builds it.**
 *
 * REL-011c gave the six admin screens a landmark and a heading; `sb007Template`
 * §12 gates those `as` parameters **on disk**. Nothing rendered one until
 * SBR-010 §7, and that drive reaches only three of the six. This screen is a
 * fourth, and it is free here: this file already loads it in a real browser.
 *
 * ⚠️ Deliberately the WHOLE screen and not the preview scope. Everything else
 * in this file is about a CSS scope; this is about the document that contains
 * it, and the two claims share only the page load.
 */
let outline: Landmarks = NO_LANDMARKS;
/** The same screen with the panel's thirteen `as` tags deleted. */
let outlineReverted: Landmarks = NO_LANDMARKS;
/** How many tags that strip removed — an arm that stripped none proves nothing. */
let strippedTags = -1;

describe('SBR-009 AC2 — the preset restyles the preview and nothing else, driven at 1280×900', () => {
  beforeAll(async () => {
    const built = await buildSiteTemplateProject();
    await withRenderedPage({ projectDir: built.projectDir }, async (page: RenderedPage) => {
      await page.navigate(`/${ADMIN_PATH_PREFIX}/theme`);
      before = JSON.parse(await page.evaluate(READ)) as Reading;
      // §4, on the screen as it first settles — one extra `evaluate`, no extra
      // navigation, and taken BEFORE any chip is pressed so it is a reading of
      // the shipped screen rather than of a screen this drive has restyled.
      outline = await readLandmarks(page);
      clickResult = await page.evaluate(CLICK_NIGHT);
      await wait(600);
      after = JSON.parse(await page.evaluate(READ)) as Reading;

      // D54. Three more presses on the same screen, in this order deliberately:
      // Studio after Night is *which chip*, and Studio after Night again is
      // *the same chip twice*. They are different defects with different fixes.
      await page.evaluate(CLICK('Studio'));
      await wait(600);
      afterStudio = JSON.parse(await page.evaluate(READ)) as Reading;
      await page.evaluate(CLICK('Night'));
      await wait(600);
      afterNightAgain = JSON.parse(await page.evaluate(READ)) as Reading;
      await page.evaluate(CLICK('Studio'));
      await wait(600);
      afterStudioAgain = JSON.parse(await page.evaluate(READ)) as Reading;
    });

    // ── §4's REVERTED ARM: the same screen with no `as` tags at all ─────────
    //
    // 🔴 The arm restores the ABSENCE the fix removed rather than breaking
    // something new: before REL-011c not one SB-005 component carried an `as`.
    // Without it, `outline` reading a tidy 1/1/1 would be equally consistent
    // with a runtime that renders a `<main>` for reasons of its own.
    const revertedDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sbr009-noas-'));
    fs.cpSync(built.projectDir, revertedDir, { recursive: true });
    strippedTags = stripOutlineTags(
      fs,
      path.join,
      revertedDir,
      SB005_COMPONENTS.map((c) => c.path)
    );
    await withRenderedPage({ projectDir: revertedDir }, async (page: RenderedPage) => {
      await page.navigate(`/${ADMIN_PATH_PREFIX}/theme`);
      await wait(600);
      outlineReverted = await readLandmarks(page);
    });

    // eslint-disable-next-line no-console
    console.log('        before:', JSON.stringify({ ...before, rule: before.rule }, null, 0));
    // eslint-disable-next-line no-console
    console.log('        after :', JSON.stringify({ ...after, rule: after.rule }, null, 0));
    // eslint-disable-next-line no-console
    console.log('        §4 outline:', JSON.stringify({ outline, outlineReverted, strippedTags }));
  });

  /**
   * 🔴 Before any assertion about what changed: the screen is there and the chip
   * is REACHABLE. `elementFromPoint` rather than "the DOM has a button" —
   * SBR-005's drive spent a cycle on a control that was painted, correct and
   * behind something, and `render:report`'s own harness records the same trap.
   */
  it('CONTROL: the screen rendered, the three chips are there, and Night is clickable', () => {
    expect(before.scopePresent).toBe(true);
    expect(before.chips).toEqual(expect.arrayContaining(['Studio', 'Press', 'Night']));
    expect(before.chipReachable).toBe(true);
    expect(before.boxes.length).toBeGreaterThanOrEqual(THEME_EDITOR_FIELDS.length);
    expect(clickResult).toBe('clicked');
  });

  /**
   * The starting state, and it is a real reading rather than an assumption.
   *
   * 🔴 **The rule is already there and it is EMPTY**, which is the single most
   * useful line in this file: it answers the question the graph could not, that a
   * connection into `CSS Definition.style` — an input the catalog declares
   * `allowEditOnly` — is honoured by the runtime from the first paint. The scope
   * is armed and overriding nothing, so inside and outside agree, and every
   * difference in the next spec is attributable to the pick.
   *
   * ⚠️ `#2563eb` is `DefaultTokens`' blue, not Studio's `#1e4d8c`: this temp
   * project is authored through the door and carries no `designTokens` metadata,
   * which `EmbeddedTemplateProvider.install` is what writes. It does not touch
   * the reading — every assertion here compares INSIDE the scope against OUTSIDE
   * it in the same document — and saying so is cheaper than someone later reading
   * this number as a claim about the Studio floor.
   */
  it('CONTROL: before the pick, the scope is armed and overrides nothing', () => {
    expect(before.rule).toContain(`.${PREVIEW_SCOPE_CLASS} {`);
    expect(before.rule?.replace(/\s+/g, ' ').trim()).toBe(`.${PREVIEW_SCOPE_CLASS} { }`);
    expect(before.scopePrimary).toBe(before.rootPrimary);
    expect(before.scopeBackground).toBe(before.rootBackground);
    expect(before.rootPrimary).not.toBe('');
  });

  /**
   * 🔴 **The defect this drive found, kept as the arm that would catch it again.**
   *
   * `presets` reads `in-name` from three chips, each of which publishes its
   * constant at MOUNT. With the checkbox ticked — which is what this template's
   * generator writes for any input the source leaves unstated — the node ran
   * three times before anybody touched anything, last placement winning: the
   * screen booted showing the **Night** palette in the preview with all five
   * boxes pre-filled, picked by nobody. `run` is additive and does not stop a
   * node running on its own; `runOnChange-in-name: false` is what does.
   *
   * Asserted on the RENDERED screen rather than on the parameter, because the
   * parameter is graded in `sbr009ThemeEditor.test.ts` and the two together are
   * the pair: one says the flag is set, this one says the flag is the thing that
   * keeps the screen honest.
   */
  it('the screen does not pick a preset for you — the boxes are empty until a chip is clicked', () => {
    expect(before.boxes.filter((v) => v !== '')).toEqual([]);
    expect(before.scopePrimary).not.toBe(SITE_THEME_PRESETS.night.colorPrimary);
    expect(before.scopePrimary).not.toBe(SITE_THEME_PRESETS.press.colorPrimary);
    expect(before.heroPainted).toBe(before.outsidePainted);
  });

  /**
   * 🔴 **AC2, first half.** The rule arrives, the tokens inside the panel move to
   * Night's values, and the hero band is PAINTED with them. The painted reading
   * is the person sentence; the token reading is why.
   */
  it('AC2: picking Night restyles the preview immediately, before any save', () => {
    const night = SITE_THEME_PRESETS.night;
    expect(after.rule).toContain(`.${PREVIEW_SCOPE_CLASS} {`);
    expect(after.rule).toContain(`--primary: ${night.colorPrimary}`);
    expect(after.scopePrimary).toBe(night.colorPrimary);
    expect(after.scopeBackground).toBe(night.colorBackground);
    expect(after.scopeRadius).toBe(night.radius);

    // The hero band actually repainted — and it MOVED, which a hard-coded
    // expectation alone would not have said.
    expect(after.heroPainted).toBe('rgb(217, 164, 65)'); // #d9a441
    expect(after.heroPainted).not.toBe(before.heroPainted);
  });

  /**
   * 🔴 **AC2, second half — the negative control, in the same reading.** Nothing
   * outside the scope moved: not `:root`'s tokens, and not the sidebar item the
   * shell paints from the same token name. A preview that wrote
   * `document.documentElement.style` would have been simpler to build and would
   * fail exactly here.
   */
  it('AC2: and nothing outside the preview changed — the site is untouched until Save', () => {
    expect(after.rootPrimary).toBe(before.rootPrimary);
    expect(after.rootBackground).toBe(before.rootBackground);
    expect(after.outsidePainted).toBe(before.outsidePainted);
    // The control is not vacuous: the sidebar item IS painted from `--primary`,
    // so it is a surface the leak would have reached.
    expect(before.outsidePainted).not.toBeNull();
  });

  /**
   * The pick reaches the boxes as well as the rule — SBR-009 §2's *"a client
   * never faces an empty colour picker"*, measured rather than wired.
   */
  it('AC2: the five boxes were filled by the pick', () => {
    const values = new Set(after.boxes);
    for (const f of THEME_EDITOR_FIELDS) {
      const expected = SITE_THEME_PRESETS.night[f.field];
      expect(`${f.field}: ${values.has(expected)}`).toBe(`${f.field}: true`);
    }
    // They were empty before, with no backend to read a record from — so the
    // fill is the pick's and not the record's (asserted in its own arm above,
    // where the defect it guards is written down).
  });

  /**
   * 🔴 **D54 — and this file is why it survived eleven sessions.**
   *
   * Every arm above clicks **Night**, which is the THIRD and last chip placed.
   * All three chips wired their `name` into the same `presets.in-name` port as a
   * mount-time constant, so `night` is what sat in it, and `run` carries no
   * payload: the picker answered `night` whichever chip a person pressed. Night
   * is the one press this drive could never have caught.
   *
   * It surfaced as *"the theme presets are dead on the deployed site"* — 0 of 7
   * fields changed — because the screen it was measured on already held Night's
   * values, so the right preset arriving twice read as nothing arriving at all.
   * There was never a preview-versus-deploy difference.
   *
   * ⚠️ The chip now publishes `{ name }` at the press; the object matters and is
   * graded in `d54ThemePresetIdentity.test.ts` §MUTANT.
   */
  it('D54: pressing Studio after Night gives STUDIO, not the last chip placed', () => {
    const studio = SITE_THEME_PRESETS.studio;
    expect(afterStudio.rule).toContain(`--primary: ${studio.colorPrimary}`);
    expect(afterStudio.scopePrimary).toBe(studio.colorPrimary);
    expect(afterStudio.scopeBackground).toBe(studio.colorBackground);
    expect(afterStudio.scopeRadius).toBe(studio.radius);
    // It MOVED off Night — the reading that separates "Studio arrived" from
    // "the screen was already Studio".
    expect(afterStudio.scopePrimary).not.toBe(after.scopePrimary);
  });

  /**
   * 🔴 **The second half, and the first draft of the D54 fix passed everything
   * above and failed this.** A Function publishes an output only when it
   * CHANGES, so a chip republishing the string it last published sends nothing
   * and the picker keeps whatever the chip pressed in between left behind.
   */
  it('D54: a chip pressed a SECOND time still answers with itself', () => {
    expect(afterNightAgain.scopePrimary).toBe(SITE_THEME_PRESETS.night.colorPrimary);
    expect(afterStudioAgain.scopePrimary).toBe(SITE_THEME_PRESETS.studio.colorPrimary);
    expect(afterStudioAgain.scopeRadius).toBe(SITE_THEME_PRESETS.studio.radius);
  });

  /**
   * The boxes follow the last press too — the person sentence for both arms
   * above, since the boxes are what a client edits and then saves.
   */
  it('D54: the five boxes hold the LAST preset pressed, not the last one placed', () => {
    const values = new Set(afterStudioAgain.boxes);
    for (const f of THEME_EDITOR_FIELDS) {
      expect(`${f.field}: ${values.has(SITE_THEME_PRESETS.studio[f.field])}`).toBe(`${f.field}: true`);
    }
  });

  // ── §4. The screen's document outline ─────────────────────────────────────

  /**
   * 🔴 **A parameter is an intention.** `sb007Template` §12 asserts that
   * `/Pages/ThemeEditor` carries `as: 'main'` and `as: 'h1'` in the JSON it
   * ships. This says the browser built them, which is a different claim and the
   * one a person using a screen reader actually depends on.
   *
   * This is the FOURTH of the six admin screens to be graded at render time —
   * SBR-010 §7 covers `/admin/signin`, `/admin/pages` and `/admin/messages`.
   * `/Pages/PageEditor` and `/Pages/Setup` remain ungraded; owner `NONE`.
   */
  describe('🔴 §4 the outline the browser actually builds', () => {
    it('the theme editor renders exactly one <main>, one <h1>, and the <h1> is inside it', () => {
      expect(outlineFault(outline)).toBeNull();
    });

    /**
     * 🔴 **The negative control, in the same document.** `/Admin/Shell`'s rail
     * is on this screen and is deliberately outside the content column. Without
     * something known to be OUTSIDE, `h1sInMain === 1` would also be the answer
     * a probe gives when it reports on the whole document.
     */
    it('🔴 CONTROL — the rail’s <nav> is in the document and NOT inside the <main>', () => {
      expect(outline.navsInDoc).toBe(1);
      expect(outline.navsInMain).toBe(0);
    });

    it('🔴 REVERTED ARM: the strip removed all thirteen tags the panel ships', () => {
      // Counted, not assumed — a strip that matched nothing would leave the arm
      // below reading a good outline and calling it a detection failure.
      expect(`stripped:${strippedTags}`).toBe('stripped:13');
    });

    it('🔴 REVERTED ARM: with the tags gone this screen builds no outline at all', () => {
      // 🔴 Not `NO_LANDMARKS`: `-1` would mean the arm never ran, and zeroes are
      // the reading only a page that really rendered without landmarks gives.
      expect(outlineReverted).toEqual({ mains: 0, h1s: 0, h1sInMain: 0, navsInDoc: 0, navsInMain: 0 });
      // …beside the shipped arm, in the same run, one project directory apart.
      expect(outline.mains).toBe(1);
    });
  });
});
