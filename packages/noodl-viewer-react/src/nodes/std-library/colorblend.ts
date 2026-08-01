import type { NodeDefinitionOptions, NodeInstance } from '@noodl/types';

import EaseCurves from '../../easecurves';

type RGB = [number, number, number];

interface ColorBlendInstance extends NodeInstance {
  _internal: {
    resultColor: string;
    blendValue: number;
    colors: string[];
  };
  updateColor(): void;
}

function clamp(min: number, max: number, value: number) {
  return Math.max(min, Math.min(max, value));
}

function setRGB(result: RGB, hex: string) {
  for (let i = 0; i < 3; ++i) {
    const index = 1 + i * 2;
    result[i] = parseInt(hex.substring(index, index + 2), 16);
  }
}

function componentToHex(c: number) {
  const hex = c.toString(16);
  return hex.length == 1 ? '0' + hex : hex;
}

function rgbToHex(rgb: RGB) {
  return '#' + componentToHex(rgb[0]) + componentToHex(rgb[1]) + componentToHex(rgb[2]);
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
      type: 'color',
      displayName: 'Result',
      description: 'The blended colour as a hex string; the inputs must be 6-digit hex, since any other notation yields nonsense',
      getter: function (this: ColorBlendInstance) {
        return this._internal.resultColor;
      }
    }
  },
  methods: {
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
        this._internal.resultColor = getColor(index);
      } else {
        setRGB(rgb0, getColor(index));
        setRGB(rgb1, getColor(index + 1));

        rgb2[0] = Math.floor(EaseCurves.linear(rgb0[0], rgb1[0], t));
        rgb2[1] = Math.floor(EaseCurves.linear(rgb0[1], rgb1[1], t));
        rgb2[2] = Math.floor(EaseCurves.linear(rgb0[2], rgb1[2], t));
        this._internal.resultColor = rgbToHex(rgb2);
      }

      this.flagOutputDirty('result');
    }
  }
};

export default {
  node: ColorBlendNode
};
