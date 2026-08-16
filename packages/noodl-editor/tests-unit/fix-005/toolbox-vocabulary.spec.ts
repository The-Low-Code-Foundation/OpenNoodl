/**
 * FIX-005 part 2 — the rename, and the one thing a rename can get wrong.
 *
 * > *"We should rename 'Runtime Variables' to 'App variables'."*
 *
 * Ruled in session 42: `Noodl.Variables` is **App Variables**, the declared bag is **App
 * Config**, and one vocabulary runs across the toolbox, the settings panel and the locales
 * (acceptance criterion 5). ⚠️ **This knowingly reverses VFN-012**, which renamed *away* from
 * `App Variables` so the two shelves would not read alike; the argument for reversing it is on
 * `ToolboxLabels.noodlVariables` and is not repeated here.
 *
 * ## 🔴 What this file exists to catch
 *
 * A rename is not hard, it is **wide** — and the failure is always the surface nobody listed.
 * FIX-005's own record says so twice over: session 43 deleted five specs it had concluded did
 * not exist, because it searched two roots when there are three. So this grades the surfaces
 * *together*, and the two that no other spec touches at all:
 *
 *  1. **The six locales.** Nothing graded them before this file. They live behind
 *     `applyLanguage`, which loads Blockly and a message bundle first and **catches every
 *     failure into English** — so a spec calling it cannot tell a correct translation from a
 *     bundle that would not load, and the second passes any assertion English satisfies.
 *     `toolboxLabelsFor` was split out for that reason and is what this file reads.
 *  2. **The settings panel's section title**, which `APP_CONFIG_SETTINGS_PATH` sends builders
 *     to by name. Two strings in two packages' worth of tree that have to say the same word,
 *     with nothing but this test between them.
 */
import { readFileSync } from 'fs';
import { join } from 'path';

import { APP_CONFIG_SETTINGS_PATH } from '../../src/editor/src/views/BlocklyEditor/appConfig';
import {
  DEFAULT_TOOLBOX_LABELS,
  toolboxLabelsFor,
  TRANSLATED_TOOLBOX_LANGUAGES
} from '../../src/editor/src/views/BlocklyEditor/BlocklyToolbox';

/**
 * The word each language uses to say "the app's", taken from that language's own `App Objects`
 * and `App Arrays` — which were already translated and are not being changed. A shared marker
 * is the whole claim: `App Variables` has to sit *with* its neighbours in every language, not
 * merely be a correct translation of the English.
 */
const APP_MARKER: Record<string, string> = {
  fr: "de l'app",
  es: 'de la app',
  de: 'App-',
  it: "dell'app",
  nl: 'App-',
  'pt-br': 'do app'
};

/** What each language said before FIX-005. The negative control for the marker check below. */
const PRE_FIX_LABELS: Record<string, string> = {
  fr: "Variables d'exécution",
  es: 'Variables de ejecución',
  de: 'Laufzeit-Variablen',
  it: 'Variabili di runtime',
  nl: 'Runtime-variabelen',
  'pt-br': 'Variáveis de execução'
};

describe('FIX-005 part 2 — one vocabulary, in English', () => {
  it('names all four Noodl shelves `App <something>`', () => {
    expect(DEFAULT_TOOLBOX_LABELS.noodlVariables).toBe('App Variables');
    expect(DEFAULT_TOOLBOX_LABELS.noodlObjects).toBe('App Objects');
    expect(DEFAULT_TOOLBOX_LABELS.noodlArrays).toBe('App Arrays');
    expect(DEFAULT_TOOLBOX_LABELS.noodlAppConfig).toBe('App Config');
  });

  /**
   * 🔴 The reversal's cost, asserted rather than glossed. VFN-012 was right that two shelves now
   * read alike; what it wanted — telling the declared bag from the runtime one — is carried by
   * `APP_CONFIG_SETTINGS_PATH` instead, and that is a difference a builder can act on.
   */
  it('still distinguishes the two variable bags, by route rather than by adjective', () => {
    expect(DEFAULT_TOOLBOX_LABELS.noodlVariables).not.toBe(DEFAULT_TOOLBOX_LABELS.noodlAppConfig);
    expect(APP_CONFIG_SETTINGS_PATH).toContain('App Config');
    expect(APP_CONFIG_SETTINGS_PATH).not.toContain('Custom Variables');
  });
});

describe('FIX-005 part 2 — the six locales, which nothing graded before', () => {
  it('translates all six, without falling back to English', () => {
    expect(TRANSLATED_TOOLBOX_LANGUAGES.sort()).toEqual(['de', 'es', 'fr', 'it', 'nl', 'pt-br']);

    for (const code of TRANSLATED_TOOLBOX_LANGUAGES) {
      const labels = toolboxLabelsFor(code);
      // The fallback is a *different object*, and it is the failure mode this whole file is
      // built around: an untranslated locale silently answers in English.
      expect(labels).not.toBe(DEFAULT_TOOLBOX_LABELS);
      expect(labels.noodlVariables).not.toBe(DEFAULT_TOOLBOX_LABELS.noodlVariables);
    }
  });

  it('🔴 puts App Variables on the same shelf as App Objects and App Arrays, in every language', () => {
    for (const code of TRANSLATED_TOOLBOX_LANGUAGES) {
      const labels = toolboxLabelsFor(code);
      const marker = APP_MARKER[code];
      expect(marker).toBeTruthy();

      // The marker is real: it is how this language already says it for the two neighbours.
      expect(labels.noodlObjects).toContain(marker);
      expect(labels.noodlArrays).toContain(marker);
      // …and now for the renamed one.
      expect(labels.noodlVariables).toContain(marker);
    }
  });

  /**
   * The control. Every assertion above is `toContain`, which passes on a locale left alone if the
   * marker happened to be in the old string too — so the old strings are run through the same
   * check and required to fail it. Without this, "all six were translated" would be a claim about
   * six `toContain`s that were never in danger.
   */
  it('🔴 would have failed on every one of the six pre-fix strings', () => {
    const survivors = TRANSLATED_TOOLBOX_LANGUAGES.filter((code) =>
      PRE_FIX_LABELS[code].includes(APP_MARKER[code])
    );
    expect(survivors).toEqual([]);

    // And none of the old wording is still in the tree, which is the other way a locale gets
    // missed: edited in one place, left in another.
    for (const code of TRANSLATED_TOOLBOX_LANGUAGES) {
      expect(toolboxLabelsFor(code).noodlVariables).not.toBe(PRE_FIX_LABELS[code]);
    }
  });
});

describe('FIX-005 part 2 — the settings panel says what the flyout sends builders to', () => {
  const VARIABLES_SECTION = join(
    __dirname,
    '../../src/editor/src/views/panels/SettingsPanel/sections/VariablesSection.tsx'
  );

  /**
   * ⚠️ **This reads source text, and that is a real limitation stated rather than hidden.** It
   * proves the title *prop* is written as `App Config`; it cannot prove the section renders, or
   * that `CollapsableSection` draws its `title` at all. Rendering it here is not on offer — the
   * component reaches ProjectModel and the editor singletons.
   *
   * It is still worth having, because the failure it catches is not a rendering failure. It is
   * `APP_CONFIG_SETTINGS_PATH` and this heading drifting apart, which no gate sees and which
   * turns a route into a dead end.
   */
  const sectionTitle = () => {
    const source = readFileSync(VARIABLES_SECTION, 'utf8');
    const match = source.match(/<CollapsableSection\s+title="([^"]+)"/);
    return match?.[1];
  };

  it('titles the section with the last segment of the documented route', () => {
    const title = sectionTitle();
    expect(title).toBe('App Config');
    expect(APP_CONFIG_SETTINGS_PATH.endsWith(title!)).toBe(true);
  });

  it('🔴 the reader can fail — it is not just returning whatever it found', () => {
    // The regex found a real title, not `undefined` quietly compared to `undefined`.
    expect(sectionTitle()).toBeTruthy();
    // And it is anchored: a title that is not there is not reported as present.
    expect(sectionTitle()).not.toBe('Custom Variables');
    expect(APP_CONFIG_SETTINGS_PATH.endsWith('Custom Variables')).toBe(false);
  });
});
