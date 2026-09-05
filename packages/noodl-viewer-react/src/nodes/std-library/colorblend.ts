import type { NodeDefinitionOptions, NodeInstance } from '@noodl/types';

import EaseCurves from '../../easecurves';

type RGB = [number, number, number];

interface ColorBlendInstance extends NodeInstance {
  _internal: {
    resultColor: string;
    blendValue: number;
    colors: string[];
    /** The last value warned about, so one bad colour reports once and not once per frame. */
    warnedAbout?: string;
  };
  updateColor(): void;
  warnUnreadableColor(value: string): void;
}

function clamp(min: number, max: number, value: number) {
  return Math.max(min, Math.min(max, value));
}

/**
 * 🔴 P79 E2 — the parser used to be three blind `parseInt(hex.substring(...), 16)` calls.
 *
 * Handed `var(--primary)` it read `"ar"`, `"--"` and `"pr"`, all `NaN`, and `rgbToHex` returned
 * the literal string `#NaNNaNNaN` — no warning, no fallback, no console error. Since every
 * project the authoring tools build styles on design tokens, that made `Color Blend` unusable in
 * all of them: the corpus's own idiom for a smooth interaction is
 * `Switch → Animate To Value → Color Blend → backgroundColor`, and spine lesson 3 had to be
 * redesigned around `opacity` because of this.
 *
 * ⚠️ **Three-digit hex was broken too, and nobody had noticed.** `#abc` read `ab`, `c` and `""`,
 * so the blue channel alone came back `NaN` — a colour that is wrong rather than absent, which is
 * the harder kind to see.
 */
const HEX_3 = /^#([0-9a-f])([0-9a-f])([0-9a-f])$/i;
// Deliberately unanchored at the end: `#RRGGBBAA` is a valid authored colour and its first six
// digits are the ones being blended.
const HEX_6 = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})/i;
const RGB_FN = /^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)/i;
const VAR_FN = /^var\(\s*(--[^,)\s]+)\s*(?:,([\s\S]*))?\)$/;

/**
 * A custom property's value, as the document actually resolves it.
 *
 * The one honest source: a token can be redefined per theme, per component, per media query, and
 * only the browser knows which definition won. Returns `''` anywhere there is no DOM — this node
 * is also compiled into the SSR and deploy bundles — so the caller falls back rather than throwing.
 */
function cssVariableValue(name: string): string {
  if (typeof document === 'undefined' || !document.documentElement) return '';
  if (typeof getComputedStyle !== 'function') return '';
  try {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  } catch (e) {
    return '';
  }
}

/** The colour as three channels, or `null` when this notation cannot be read. */
function parseColor(value: unknown, depth = 0): RGB | null {
  if (typeof value !== 'string') return null;
  const text = value.trim();
  if (!text) return null;

  const asVar = VAR_FN.exec(text);
  if (asVar) {
    // A token may resolve to another token. Bounded so a definition that refers to itself
    // cannot hang the render.
    if (depth >= 8) return null;
    const resolved = cssVariableValue(asVar[1]);
    if (resolved) return parseColor(resolved, depth + 1);
    // `var(--x, #fff)` — the author's own fallback, which is what CSS would use here.
    if (asVar[2] !== undefined) return parseColor(asVar[2], depth + 1);
    return null;
  }

  const short = HEX_3.exec(text);
  if (short) {
    return [
      parseInt(short[1] + short[1], 16),
      parseInt(short[2] + short[2], 16),
      parseInt(short[3] + short[3], 16)
    ];
  }

  const long = HEX_6.exec(text);
  if (long) return [parseInt(long[1], 16), parseInt(long[2], 16), parseInt(long[3], 16)];

  const fn = RGB_FN.exec(text);
  if (fn) {
    return [
      clamp(0, 255, Math.round(Number(fn[1]))),
      clamp(0, 255, Math.round(Number(fn[2]))),
      clamp(0, 255, Math.round(Number(fn[3])))
    ];
  }

  return null;
}

function componentToHex(c: number) {
  const hex = c.toString(16);
  return hex.length == 1 ? '0' + hex : hex;
}

function rgbToHex(rgb: RGB) {
  return '#' + componentToHex(rgb[0]) + componentToHex(rgb[1]) + componentToHex(rgb[2]);
}

/** Copies parsed channels into one of the reused buffers. */
function setRGB(result: RGB, rgb: RGB) {
  result[0] = rgb[0];
  result[1] = rgb[1];
  result[2] = rgb[2];
}

//reusing these to reduce GC pressure
const rgb0: RGB = [0, 0, 0];
const rgb1: RGB = [0, 0, 0];
const rgb2: RGB = [0, 0, 0];

const ColorBlendNode: NodeDefinitionOptions = {
  name: 'Color Blend',
  docs: 'https://docs.noodl.net/nodes/utilities/color-blend',
  category: 'Interpolation',
  getInspectInfo(this: ColorBlendInstance) {
    return [{ type: 'color', value: this._internal.resultColor }];
  },
  initialize(this: ColorBlendInstance) {
    const internal = this._internal;

    internal.resultColor = '#000000';
    internal.blendValue = 0;
    internal.colors = [];
  },
  numberedInputs: {
    color: {
      type: 'color',
      displayPrefix: 'Color',
      createSetter(index: number) {
        return function (this: ColorBlendInstance, value: string) {
          this._internal.colors[index] = value;
          this.updateColor();
        };
      }
    }
  },
  inputs: {
    blendValue: {
      group: 'Values',
      type: 'number',
      displayName: 'Blend Value',
      description: 'Position along the colour list, where 1 is exactly Color 1 and 1.5 is halfway to Color 2; values outside the list are clamped',
      default: 0,
      set: function (this: ColorBlendInstance, value: number) {
        this._internal.blendValue = value;
        this.updateColor();
      }
    }
  },
  outputs: {
    result: {
      group: 'Values',
      type: 'color',
      displayName: 'Result',
      description:
        'The blended colour. Inputs may be #RGB, #RRGGBB, rgb()/rgba() or var(--token); a colour ' +
        'it cannot read is reported and the nearest input is shown unblended',
      getter: function (this: ColorBlendInstance) {
        return this._internal.resultColor;
      }
    }
  },
  methods: {
    /**
     * Reported once per distinct offending value.
     *
     * ⚠️ This node re-blends on every frame an animation touches it, so an undeduped report would
     * emit an event per frame and drown the channel it is trying to report on — the same shape
     * NDA-004 fixed on the Expression node's compile failure.
     */
    warnUnreadableColor(this: ColorBlendInstance, value: string) {
      if (this._internal.warnedAbout === value) return;
      this._internal.warnedAbout = value;
      // 🔴 Guarded. `raiseRuntimeError` lives on `Node.prototype`, and this node is also loaded as
      // a BARE DEFINITION OBJECT — `nodegx-export`'s parity suite does exactly that to grade its
      // emitted copy against this source. Reporting must never be the thing that throws: an
      // unreadable colour has to degrade to the fallback above, not take the render down with it.
      const report = (this as { raiseRuntimeError?: (c: string, m: string) => void }).raiseRuntimeError;
      if (typeof report !== 'function') return;
      report.call(
        this,
        'color-blend/unreadable-color',
        `Color Blend cannot read the colour ${JSON.stringify(value)}, so it is showing the nearest ` +
          `colour unblended. It understands #RGB, #RRGGBB, rgb()/rgba() and var(--token) when the ` +
          `token is defined on the page.`
      );
    },
    updateColor(this: ColorBlendInstance) {
      const colors = this._internal.colors;
      if (colors.length === 0) {
        return;
      }

      function getColor(index: number) {
        return colors[index] ? colors[index] : '#000000';
      }

      const clampedBlendValue = clamp(0, colors.length - 1, this._internal.blendValue);
      const index = Math.floor(clampedBlendValue);
      const t = clampedBlendValue - index;

      if (t === 0) {
        // Passed through verbatim, which is why a token has always worked at rest: `var(--primary)`
        // reaching a colour port is resolved by the DOM. Only the blend in between was broken.
        this._internal.resultColor = getColor(index);
      } else {
        const from = parseColor(getColor(index));
        const to = parseColor(getColor(index + 1));

        if (!from || !to) {
          // 🔴 The endpoint the blend is nearest to, verbatim — an authored colour the DOM can
          // resolve, rather than `#NaNNaNNaN`. Falling back to a colour the author actually chose
          // is the only option here that cannot be mistaken for a working blend.
          this._internal.resultColor = getColor(t < 0.5 ? index : index + 1);
          this.warnUnreadableColor(!from ? getColor(index) : getColor(index + 1));
        } else {
          setRGB(rgb0, from);
          setRGB(rgb1, to);

          rgb2[0] = Math.floor(EaseCurves.linear(rgb0[0], rgb1[0], t));
          rgb2[1] = Math.floor(EaseCurves.linear(rgb0[1], rgb1[1], t));
          rgb2[2] = Math.floor(EaseCurves.linear(rgb0[2], rgb1[2], t));
          this._internal.resultColor = rgbToHex(rgb2);
        }
      }

      this.flagOutputDirty('result');
    }
  }
};

export default {
  node: ColorBlendNode
};
