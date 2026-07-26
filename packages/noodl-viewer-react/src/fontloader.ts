import { getAbsoluteUrl } from '@noodl/runtime/src/utils';

/** Fonts the browser always has, so they never need an `@font-face` rule. */
const BUILT_IN_FONT_FAMILIES = [
  'Arial',
  'Arial Black',
  'Courier New',
  'Helvetica',
  'Impact',
  'Lucida Console',
  'Tahoma',
  'Times New Roman'
];

function removeFileEnding(url: string): string {
  return url.replace(/\.[^/.]+$/, '');
}

/**
 * Loads project fonts and tells callers when one is ready to measure against.
 *
 * The family name is derived from the file name, not declared — a font at
 * `fonts/Inter-Bold.woff2` becomes the family `Inter-Bold`. That is why the same
 * derivation has to happen in `callWhenFontIsActive`'s callers.
 *
 * Three pieces of state, and they are not redundant: `loadedFontFamilies` marks
 * fonts that are ready, `fontCssFamiliesAdded` marks ones whose `@font-face` rule
 * has been written (so a second request while the first is still downloading is
 * dropped), and `fontCallbacks` queues the waiters in between.
 */
export default class FontLoader {
  /** The shared instance. Everything in the viewer uses this rather than constructing one. */
  static instance: FontLoader;

  loadedFontFamilies: Record<string, boolean>;
  fontCssFamiliesAdded: Record<string, boolean>;
  fontCallbacks: Record<string, (() => void)[]>;

  constructor() {
    this.loadedFontFamilies = {};
    this.fontCssFamiliesAdded = {};
    this.fontCallbacks = {};

    BUILT_IN_FONT_FAMILIES.forEach((fontFamily) => {
      this.loadedFontFamilies[fontFamily] = true;
    });
  }

  loadFont(fontURL: string): void {
    // Support SSR
    if (typeof document === 'undefined') return;

    fontURL = getAbsoluteUrl(fontURL);

    //get file name without path and file ending
    const family = removeFileEnding(fontURL).split('/').pop();

    //check if it's already loaded
    if (this.loadedFontFamilies[family]) {
      this.fontCallbacks[family] &&
        this.fontCallbacks[family].forEach(function (callback) {
          callback();
        });
      return;
    }

    //check if font is already being loaded, we're just waiting for the callback
    if (this.fontCssFamiliesAdded[family]) {
      return;
    }

    this.fontCssFamiliesAdded[family] = true;

    const newStyle = document.createElement('style');
    newStyle.type = 'text/css';

    const baseUrl = Noodl.Env['BaseUrl'] || '/';

    if (fontURL.startsWith('/')) {
      fontURL = fontURL.substring(1);
    }

    newStyle.appendChild(
      document.createTextNode("@font-face { font-family: '" + family + "'; src: url('" + baseUrl + fontURL + "'); }\n")
    );
    document.head.appendChild(newStyle);

    // Support SSR
    if (typeof window !== 'undefined') {
      // Required lazily on purpose: `webfontloader` touches `document` at import
      // time, so a top-level import would break server-side rendering, which
      // reaches the lines above but never gets here.
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const WebFontLoader = require('webfontloader');
      WebFontLoader.load({
        timeout: 1000 * 600, //10 minutes in case the bandwidth is reeeeeeally low
        custom: {
          families: [family]
        },
        fontactive: (activeFamily: string) => {
          this.loadedFontFamilies[activeFamily] = true;
          if (this.fontCallbacks[activeFamily]) {
            this.fontCallbacks[activeFamily].forEach(function (callback) {
              callback();
            });
          }
        }
      });
    }
  }

  callWhenFontIsActive(family: string, callback: () => void): void {
    if (this.loadedFontFamilies[family]) {
      callback();
      return;
    }

    if (!this.fontCallbacks[family]) {
      this.fontCallbacks[family] = [];
    }
    this.fontCallbacks[family].push(callback);
  }
}

FontLoader.instance = new FontLoader();
