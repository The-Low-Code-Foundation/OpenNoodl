import React, { useEffect, useState } from 'react';

import type { TSFixme } from '../../../../typings/global';
import Layout from '../../../layout';
import Utils from '../../../nodes/controls/utils';
import type { StyleObject } from '../../../react-component-node';
import { Noodl } from '../../../types';
import { noodlRootRef } from '../../noodl-root-ref';
import { IconGlyph } from '../../visual/Icon/IconGlyph';

export interface SelectProps extends Noodl.ReactProps {
  id: string;
  value: string;
  enabled: boolean;
  textStyle: Noodl.TextStyle;
  items: TSFixme;

  placeholder: string;
  placeholderOpacity: string;

  showChevron: boolean;

  useIcon: boolean;
  iconPlacement: 'left' | 'right';
  iconSpacing: string;
  iconSourceType: 'image' | 'icon';
  iconImageSource: Noodl.Image;
  iconIconSource: Noodl.Icon;
  iconSize: string;
  iconColor: Noodl.Color;

  useLabel: boolean;
  label: string;
  labelSpacing: string;
  labeltextStyle: Noodl.TextStyle;

  onClick: () => void;
  valueChanged: (value: string) => void;
}

export function Select(props: SelectProps) {
  const [value, setValue] = useState(props.value);

  useEffect(() => {
    setValue(props.value);
    props.valueChanged(props.value);
  }, [props.value, props.items]);

  let style = { ...props.style };
  Layout.size(style, props);
  Layout.align(style, props);

  if (props.textStyle !== undefined) {
    // Apply text style
    style = Object.assign({}, props.textStyle, style);
    style.color = props.noodlNode.context.styles.resolveColor(style.color);
  }

  // Hide label if there is no selected value, of if value is not in the items array
  const selectedIndex = !props.items || value === undefined ? -1 : props.items.findIndex((i) => i.Value === value);

  const { height, ...otherStyles } = style;

  function _renderIcon() {
    if (props.iconSourceType === 'image' && props.iconImageSource !== undefined)
      return <img alt="" src={props.iconImageSource} style={{ width: props.iconSize, height: props.iconSize }}></img>;
    else if (props.iconSourceType === 'icon' && props.iconIconSource !== undefined) {
      const style: React.CSSProperties = { fontSize: props.iconSize, color: props.iconColor };
      if (props.iconPlacement === 'left' || props.iconPlacement === undefined) style.marginRight = props.iconSpacing;
      else style.marginLeft = props.iconSpacing;

      return <IconGlyph source={props.iconIconSource} style={style} />;
    }

    return null;
  }

  const inputProps = {
    id: props.id,
    className: props.className,
    // Typed as a Noodl StyleObject rather than React.CSSProperties: it carries the
    // vendor key `-webkit-appearance`, which CSSProperties has no place for, and the
    // string values here would otherwise widen away from React's literal unions.
    style: {
      inset: 0,
      opacity: 0,
      position: 'absolute',
      textTransform: 'inherit',
      cursor: props.enabled ? '' : 'default',
      '-webkit-appearance': 'none' //this makes styling possible on Safari, otherwise the size will be incorrect as it will use the native styling
    } as StyleObject,
    onClick: props.onClick
  };

  const inputWrapperStyle = {
    display: 'flex',
    alignItems: 'center',
    ...props.styles.inputWrapper,
    cursor: props.enabled ? '' : 'default'
  };

  const heightInPercent = height && height[String(height).length - 1] === '%';

  if (props.useLabel) {
    if (heightInPercent) {
      inputWrapperStyle.flexGrow = 1;
    } else {
      inputWrapperStyle.height = height;
    }
  } else {
    Object.assign(inputWrapperStyle, otherStyles);
    inputWrapperStyle.height = height;
  }

  let options = [];

  if (props.items) {
    options = props.items.map((i) => (
      <option key={i.Value} value={i.Value} disabled={i.Disabled === 'true' || i.Disabled === true ? true : undefined}>
        {i.Label}
      </option>
    ));
    // options.unshift();
  }

  /**
   * 🔴 **The affordance a native `<select>` draws and this one cannot.** The visible face of this
   * control is the `<span>` below; the real `<select>` is `opacity: 0` and `position: absolute`,
   * overlaid for interaction only — so the browser's own arrow is invisible along with it, and a
   * placed Dropdown was a bordered box with a word in it and nothing saying it opened a list.
   * Richard, 2026-09-06: *"no chevron down icon by default, to make it immediately look like a
   * 'normal' dropdown input."*
   *
   * ⚠️ **Inline SVG in `currentColor`, not the `Icon` ports.** Those need an icon set the project
   * may not have installed, which would make the default draw nothing in a new project. This
   * inherits the control's own text colour and font size, so it tracks a restyled Dropdown without
   * a port of its own to keep in step, and `pointerEvents: none` keeps it out of the way of the
   * overlaid `<select>` that receives every click.
   */
  const chevron =
    props.showChevron === false ? null : (
      <span
        style={{
          display: 'flex',
          alignItems: 'center',
          flexShrink: 0,
          marginLeft: '8px',
          pointerEvents: 'none'
        }}
      >
        <svg width="10" height="6" viewBox="0 0 10 6" fill="none" focusable="false" aria-hidden="true">
          <path
            d="M1 1l4 4 4-4"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
    );

  let label = null;

  /**
   * 🔴 **`props.items`, not `props.items.items`.** This line read `props.items.items` from the
   * initial commit (2024-01-26) onwards, and `props.items` is a plain array — `options.ts` assigns
   * whatever the port delivers straight through, and the `.map` twelve lines above already depends
   * on it being one. So `props.items.items` is `undefined` and `.length` **throws**: a Dropdown
   * with a selected value crashed its own render.
   *
   * ⚠️ **It survived four years because it is behind `selectedIndex >= 0`**, and `selectedIndex`
   * is -1 whenever `value` is undefined — which it was, for every Dropdown nobody had chosen from.
   * `4672d924` then seeded `value` with the first default item so a placed node would draw
   * something, and that made this reachable on every freshly placed Dropdown: the node it was
   * meant to make visible threw instead. Found while moving `items` to `optionslist` (§3); the
   * commit that exposed it is not the commit that caused it.
   */
  if (selectedIndex >= 0 && selectedIndex < props.items.length) {
    label = <span>{props.items[selectedIndex].Label}</span>;
  } else if (props.placeholder) {
    label = <span style={{ opacity: props.placeholderOpacity }}>{props.placeholder}</span>;
  }

  //A hidden first option is preselected and added to the list of options, it makes it possible to select the first item in the dropdown
  const inputWrapper = (
    <div
      ref={noodlRootRef(props.noodlNode)}
      className="ndl-controls-pointer"
      style={inputWrapperStyle}
      noodl-style-tag="inputWrapper"
    >
      {props.useIcon && props.iconPlacement === 'left' ? _renderIcon() : null}
      <div
        style={{
          width: '100%',
          height: '100%',
          alignItems: 'center',
          display: 'flex'
        }}
      >
        {label}
      </div>
      {props.useIcon && props.iconPlacement === 'right' ? _renderIcon() : null}
      {chevron}
      <select
        {...inputProps}
        disabled={!props.enabled}
        value={options.find((i) => i.props.value === value) ? value : undefined}
        {...Utils.controlEvents(props)}
        onChange={(e) => {
          setValue(e.target.value);
          props.valueChanged && props.valueChanged(e.target.value);
        }}
      >
        <option value="" disabled selected hidden />
        {options}
      </select>
    </div>
  );

  if (props.useLabel) {
    const outerWrapperStyle: React.CSSProperties = {
      ...otherStyles,
      display: 'flex',
      flexDirection: 'column'
    };

    if (heightInPercent) {
      outerWrapperStyle.height = height;
    }

    return (
      <div ref={noodlRootRef(props.noodlNode)} style={outerWrapperStyle}>
        <label
          htmlFor={props.id}
          style={{
            ...props.labeltextStyle,
            ...props.styles.label,
            marginBottom: props.labelSpacing
          }}
          noodl-style-tag="label"
        >
          {props.label}
        </label>
        {inputWrapper}
      </div>
    );
  } else {
    return inputWrapper;
  }
}
