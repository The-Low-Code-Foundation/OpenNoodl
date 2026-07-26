import BezierEasing from 'bezier-easing';

import type { StateTransition } from '@noodl/types';

import type { ReactNodeInstance } from './react-component-node';
import EaseCurves from './easecurves';

/** Maps `t` in [0,1] onto the animated value. */
type Animation = (t: number) => number | string;

/**
 * Animates one of `node`'s inputs from its current value to `endValue`.
 *
 * Three value shapes are supported — colors (interpolated per RGBA channel via the
 * project's style resolution), plain numbers, and unit-bearing `{ value, unit }`
 * objects. Anything else has no meaningful interpolation, so the value is set
 * outright rather than animated; that fallback is deliberate, not a gap.
 *
 * A transition already running on the same port is stopped first, so repeated
 * changes retarget rather than stacking.
 */
export default function transitionParameter(
  node: ReactNodeInstance,
  name: string,
  endValue: unknown,
  transition: StateTransition
): void {
  if (node._transitions && node._transitions[name]) {
    node._transitions[name].stop();
    delete node._transitions[name];
  }

  const startValue = node.getInputValue(name);

  const input = node.getInput(name);

  let animation: Animation | undefined;

  if (input && input.type === 'color') {
    animation = colorAnimation(
      node.context.styles.resolveColor(startValue as string),
      node.context.styles.resolveColor(endValue as string)
    );
  } else if (typeof startValue === 'number' && typeof endValue === 'number') {
    animation = numberAnimation(startValue, endValue);
  } else if (
    typeof startValue === 'object' &&
    startValue.hasOwnProperty('value') &&
    typeof endValue === 'object' &&
    endValue.hasOwnProperty('value')
  ) {
    animation = numberAnimation((startValue as any).value, (endValue as any).value);
  }

  if (animation) {
    if (!node._transitions) node._transitions = {};

    const ease = BezierEasing(transition.curve);

    node._transitions[name] = node.context.timerScheduler.createTimer({
      duration: transition.dur,
      onRunning: (t: number) => {
        const v = animation(ease.get(t));
        node.queueInput(name, v);
      },
      onFinish: () => {
        delete node._transitions[name];
      }
    });

    node._transitions[name].start();
  } else {
    //no transition supported for this parameter type, so just set it
    node.queueInput(name, endValue);
  }
}

function numberAnimation(start: number, end: number): Animation {
  return (t: number) => {
    return EaseCurves.linear(start, end, t);
  };
}

/**
 * Fills `result` from a `#rrggbb`/`#rrggbbaa` string. `transparent` and empty values
 * zero the alpha only, leaving the RGB for the caller to borrow from the other endpoint.
 */
function setRGBA(result: number[], hex: string): void {
  if (hex === 'transparent' || !hex) {
    result[3] = 0;
    return;
  }

  const numComponents = (hex.length - 1) / 2;

  for (let i = 0; i < numComponents; ++i) {
    const index = 1 + i * 2;
    result[i] = parseInt(hex.substring(index, index + 2), 16);
  }
}

function componentToHex(c: number): string {
  const hex = c.toString(16);
  return hex.length == 1 ? '0' + hex : hex;
}

function rgbaToHex(rgba: number[]): string {
  return '#' + componentToHex(rgba[0]) + componentToHex(rgba[1]) + componentToHex(rgba[2]) + componentToHex(rgba[3]);
}

/**
 * Interpolates two colors per channel.
 *
 * A `transparent` endpoint borrows the *other* endpoint's RGB before animating, so
 * fading in from transparent fades up the target hue rather than sliding through
 * black.
 */
function colorAnimation(start: string, end: string): Animation {
  const rgba0 = [0, 0, 0, 255];
  setRGBA(rgba0, start);

  const rgba1 = [0, 0, 0, 255];
  setRGBA(rgba1, end);

  if (!start || start === 'transparent') {
    rgba0[0] = rgba1[0];
    rgba0[1] = rgba1[1];
    rgba0[2] = rgba1[2];
  }
  if (!end || end === 'transparent') {
    rgba1[0] = rgba0[0];
    rgba1[1] = rgba0[1];
    rgba1[2] = rgba0[2];
  }

  const rgba = [0, 0, 0, 0];

  return (t: number) => {
    rgba[0] = Math.floor(EaseCurves.linear(rgba0[0], rgba1[0], t));
    rgba[1] = Math.floor(EaseCurves.linear(rgba0[1], rgba1[1], t));
    rgba[2] = Math.floor(EaseCurves.linear(rgba0[2], rgba1[2], t));
    rgba[3] = Math.floor(EaseCurves.linear(rgba0[3], rgba1[3], t));

    return rgbaToHex(rgba);
  };
}
