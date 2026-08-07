import React from 'react';

import Layout from '../../../layout';
import PointerListeners from '../../../pointerlisteners';
import { Noodl } from '../../../types';
import { noodlRootRef } from '../../noodl-root-ref';

export interface TextProps extends Noodl.ReactProps {
  as?: keyof React.JSX.IntrinsicElements | React.ComponentType<unknown>;

  textStyle: Noodl.TextStyle;
  text: string;

  sizeMode?: Noodl.SizeMode;
  width?: string;
  height?: string;
  fixedWidth?: boolean;
  fixedHeight?: boolean;

  // Extra Attributes
  dom: Record<string, unknown>;
}

/**
 * What an empty `Text` value renders as — NDA-012 (Visual), check G1.
 *
 * This used to be a bare `String(props.text)`, which is the Empty-Value Contract's headline
 * defect in the one place an author cannot miss it: **the literal four characters `null`
 * painted on the page.** `String(null)` is `'null'` and `String(undefined)` is
 * `'undefined'`, and both are ordinary arrivals here — a record property that has not been
 * filled in, a Function node's early return, a Repeater item's missing field. The same
 * `String(value)` cast is recorded in `FINDINGS.md` class A2 against the String *variable*,
 * where the garbage at least stays inside the graph; here it is on screen.
 *
 * `null` clears, per the contract. Every other value keeps its old rendering, and that is
 * deliberate rather than incidental: `0` and `false` are legitimate things to put in a Text
 * node, and a truthiness test here would blank both.
 */
export function renderableText(value: unknown): string {
  return value === null || value === undefined ? '' : String(value);
}

export function Text(props: TextProps) {
  // React.ElementType collapses the intrinsic-elements union; with the ref prop added,
  // the raw union exceeds the compiler's representation limit (TS2590).
  const Component = (props.as || 'div') as React.ElementType;

  const style = {
    ...props.textStyle,
    ...props.style
  };

  Layout.size(style, props);
  Layout.align(style, props);

  style.color = props.noodlNode.context.styles.resolveColor(style.color);

  // Respect '\n' in the string
  if (props.sizeMode === 'contentSize' || props.sizeMode === 'contentWidth') {
    style.whiteSpace = 'pre';
  } else {
    style.whiteSpace = 'pre-wrap';
    style.overflowWrap = 'anywhere';
  }

  if (style.opacity === 0) {
    style.pointerEvents = 'none';
  }

  return (
    <Component
      ref={noodlRootRef(props.noodlNode)}
      className={['ndl-visual-text', props.className].join(' ')}
      {...props.dom}
      {...PointerListeners(props)}
      style={style}
    >
      {renderableText(props.text)}
    </Component>
  );
}
