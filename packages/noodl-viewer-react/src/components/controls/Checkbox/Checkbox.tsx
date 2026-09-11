import React, { useEffect, useState } from 'react';

import Layout from '../../../layout';
import Utils from '../../../nodes/controls/utils';
import { Noodl } from '../../../types';
import { noodlRootRef } from '../../noodl-root-ref';
import { IconGlyph } from '../../visual/Icon/IconGlyph';

export interface CheckboxProps extends Noodl.ReactProps {
  id: string;
  enabled: boolean;
  checked: boolean;

  useLabel: boolean;
  label: string;
  labelSpacing: string;
  labeltextStyle: Noodl.TextStyle;

  useIcon: boolean;
  iconPlacement: 'left' | 'right';
  iconSpacing: string;
  iconSourceType: 'image' | 'icon';
  iconImageSource: Noodl.Image;
  iconIconSource: Noodl.Icon;
  iconSize: string;
  iconColor: Noodl.Color;

  checkedChanged: (checked: boolean) => void;
}

export function Checkbox(props: CheckboxProps) {
  const [checked, setChecked] = useState(props.checked);

  // Report initial values when mounted
  useEffect(() => {
    setChecked(!!props.checked);
  }, []);

  useEffect(() => {
    setChecked(!!props.checked);
  }, [props.checked]);

  const style: React.CSSProperties = { ...props.style };

  if (props.parentLayout === 'none') {
    style.position = 'absolute';
  }

  Layout.align(style, props);

  const inputProps = {
    id: props.id,
    className: [props.className, 'ndl-controls-checkbox-2'].join(' '),
    disabled: !props.enabled,
    style: {
      width: props.styles.checkbox.width,
      height: props.styles.checkbox.height
    }
  };

  const inputWrapperStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    position: 'relative',
    ...props.styles.checkbox
  };

  if (!props.useLabel) {
    Object.assign(inputProps, Utils.controlEvents(props));
    Object.assign(inputWrapperStyle, style);
  }

  /**
   * 🔴 **The author's icon is the CHECKED mark, so it draws only when checked.**
   *
   * It used to draw unconditionally, which meant that the moment an author picked an Icon Source
   * the checkbox showed that icon for ever — ticked or not. Reported by Richard, 2026-09-04:
   * *"I can't check and uncheck a Checkbox node... When I click it I see the `checked` output
   * value change to false, but I still see the check icon inside the check box."* The click, the
   * state and the output were all correct; only the mark was wrong, which is FB-020's defect
   * exactly, surviving on the one path FB-020 did not gate.
   *
   * ⚠️ **FB-020 gated `_renderDefaultCheck` and not this.** That is why a *fresh* checkbox behaved
   * correctly and a configured one did not — the bug was invisible until somebody chose an icon,
   * which is the first thing anybody does after adding the node.
   *
   * There is one icon source, not one per state, so "the icon" can only mean the checked mark. An
   * author who wants the unchecked box to carry something styles the box itself.
   */
  function _renderIcon() {
    if (!checked) return null;

    if (props.iconSourceType === 'image' && props.iconImageSource !== undefined)
      return (
        <img
          alt=""
          src={props.iconImageSource}
          style={{
            width: props.iconSize,
            height: props.iconSize,
            position: 'absolute'
          }}
        />
      );
    else if (props.iconSourceType === 'icon' && props.iconIconSource !== undefined) {
      const style: React.CSSProperties = {
        fontSize: props.iconSize,
        color: props.iconColor,
        position: 'absolute'
      };

      return <IconGlyph source={props.iconIconSource} style={style} />;
    }

    return null;
  }

  /**
   * FB-020. A fresh checkbox drew nothing at all when it was ticked, and two users
   * independently reported that as "the box cannot be checked".
   *
   * Nothing was broken: the click lands, `checkedChanged` fires, the `Checked` output
   * goes true. There was simply no mark on screen, because all three things that could
   * have drawn one are off by default — the real `<input>` is `opacity: 0`
   * (assets/style.css), `iconIconSource` ships no default so `_renderIcon` returns null,
   * and `setVisualStates(['checked'])` only applies parameters an author has already
   * configured. A brand new node has none.
   *
   * So the box draws its own tick when it has no icon of its own to draw. It takes the
   * border colour, so it reads against whatever the box is styled as; an author icon or
   * a configured checked state still wins, and turning Enable Icon off is still taken as
   * "no mark, I am styling this myself".
   */
  function _renderDefaultCheck() {
    if (!checked) return null;
    if (props.iconSourceType === 'image' && props.iconImageSource !== undefined) return null;
    if (props.iconSourceType === 'icon' && props.iconIconSource !== undefined) return null;

    return (
      <svg
        aria-hidden="true"
        data-ndl-default-check="true"
        viewBox="0 0 16 16"
        style={{
          width: props.iconSize,
          height: props.iconSize,
          position: 'absolute',
          pointerEvents: 'none',
          // ⚠️ The border is stored per side — `borderTopColor`, never `borderColor`. Reading the
          // shorthand yields undefined and the tick silently falls through to `currentColor`,
          // which is the page's text colour: black here by luck, invisible on a dark page.
          color: props.styles.checkbox?.borderTopColor || props.styles.checkbox?.borderColor || 'currentColor'
        }}
      >
        <path
          d="M3.5 8.5l3 3 6-6"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }

  const checkbox = (
    <div
      ref={noodlRootRef(props.noodlNode)}
      className="ndl-controls-pointer"
      style={inputWrapperStyle}
      noodl-style-tag="checkbox"
    >
      {props.useIcon ? _renderIcon() || _renderDefaultCheck() : null}
      <input
        type="checkbox"
        {...inputProps}
        checked={checked}
        onChange={(e) => {
          setChecked(e.target.checked);
          props.checkedChanged && props.checkedChanged(e.target.checked);
        }}
      />
    </div>
  );

  if (props.useLabel) {
    const labelStyle: React.CSSProperties = {
      marginLeft: props.labelSpacing,
      ...props.labeltextStyle,
      ...props.styles.label
    };

    if (!props.enabled) {
      labelStyle.cursor = 'default';
    }

    labelStyle.color = props.noodlNode.context.styles.resolveColor(labelStyle.color);

    return (
      <div
        ref={noodlRootRef(props.noodlNode)}
        style={{ display: 'flex', alignItems: 'center', ...style }}
        {...Utils.controlEvents(props)}
      >
        {checkbox}
        <label className="ndl-controls-pointer" style={labelStyle} htmlFor={props.id} noodl-style-tag="label">
          {props.label}
        </label>
      </div>
    );
  } else {
    return checkbox;
  }
}
