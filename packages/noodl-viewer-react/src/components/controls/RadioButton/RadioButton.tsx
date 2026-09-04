import React, { useContext, useEffect } from 'react';

import RadioButtonContext from '../../../contexts/radiobuttoncontext';
import Layout from '../../../layout';
import Utils from '../../../nodes/controls/utils';
import { Noodl } from '../../../types';
import { noodlRootRef } from '../../noodl-root-ref';
import { IconGlyph } from '../../visual/Icon/IconGlyph';

export interface RadioButtonProps extends Noodl.ReactProps {
  id: string;
  enabled: boolean;
  value: string;

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

  fillSpacing: string;

  checkedChanged: (value: boolean, fromUser: boolean) => void;
  /** NDA-012 (Visual) F1 — called once when this button renders with no group above it. */
  groupMissing?: () => void;
}

function isPercentage(size /* string */) {
  return size && size[size.length - 1] === '%';
}

export function RadioButton(props: RadioButtonProps) {
  const radioButtonGroup = useContext(RadioButtonContext);

  const style = { ...props.style };

  if (props.parentLayout === 'none') {
    style.position = 'absolute';
  }

  Layout.align(style, props);

  // Whether this button is the group's selection. A render *output*, so it is computed here and
  // used below for the `<input>`'s `checked` attribute.
  //
  // ⚠️ NDA-012 (Visual) F1. `radioButtonGroup` is `null` outside a group now; it used to be the
  // context's default *object*, which is truthy — so this took the first branch either way and
  // compared `undefined === props.value`. A groupless button with no `Value` therefore rendered
  // **checked**, permanently.
  const checked = radioButtonGroup ? radioButtonGroup.selected === props.value : false;

  // F1. A Radio Button resolves its group through React context and has no `Group` port, so
  // there is no way to name one and — until this — no way to find out that none was found. One
  // rendered outside a group gets `name: undefined`, `checked: false` forever and a click that
  // short-circuits to nothing: visibly a control, functionally inert. The node raises it on the
  // runtime error bus, so it is visible in a deployed app too, not just while authoring.
  const hasGroup = radioButtonGroup !== null;
  useEffect(() => {
    if (!hasGroup) props.groupMissing && props.groupMissing();
  }, [hasGroup, props.groupMissing]);

  // NDA-012 (Visual), A3. This used to call `props.checkedChanged(checked)` right here, from the
  // render body — and on the node side that reaches `flagOutputDirty('checked')` and
  // `_updateVisualState()` (`radiobutton.ts:39-46`). So a render React discarded or double-invoked
  // moved graph state and repainted visual states for a checked-ness the committed tree never had.
  //
  // Reporting to the graph is a side effect and belongs after commit. `checkedChanged` already
  // no-ops when the value has not changed, so the extra render this costs on a real change is the
  // one the old code needed anyway.
  useEffect(() => {
    // A1: the second argument is what lets the node fire `Changed` for a click and stay silent
    // for the graph setting the group's `Value` — the same distinction `Checkbox` and
    // `Radio Button Group` already make.
    props.checkedChanged && props.checkedChanged(checked, radioButtonGroup ? radioButtonGroup.selectionFromUser : false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [checked, props.checkedChanged]);

  const inputProps = {
    id: props.id,
    disabled: !props.enabled,
    className: [props.className, 'ndl-controls-radio-2'].join(' '),
    style: {
      width: props.styles.radio.width,
      height: props.styles.radio.height
    }
  };

  const inputWrapperStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    flexShrink: 0,
    ...props.styles.radio
  };

  if (props.useLabel) {
    if (isPercentage(props.styles.radio.width)) {
      delete inputWrapperStyle.width;
      inputWrapperStyle.flexGrow = 1;
    }
  } else {
    Object.assign(inputProps, Utils.controlEvents(props));
    Object.assign(inputWrapperStyle, style);
  }

  /**
   * 🔴 **The author's icon is the SELECTED mark, so it draws only when selected.**
   *
   * Found by sweeping this component after the same defect was fixed on the Checkbox
   * (Richard, 2026-09-04). It drew unconditionally, so an author who picked an Icon Source got
   * that icon on **every button in the group at once** — the exact shape FB-020 already recorded
   * for `fillColor` on this very node: *"an author who set `Fill Color` as a plain parameter got
   * a filled dot on every option."* FB-020 gated the fill and left this path ungated beside it.
   *
   * ⚠️ Nobody reported this one; it was found by reading the sibling of a reported defect. The
   * `fillColor` half is gated at `const fillColor = checked ? … : undefined` below, which is why
   * a radio button with no icon has always behaved correctly.
   */
  function _renderIcon() {
    if (!checked) return null;

    if (props.iconSourceType === 'image' && props.iconImageSource !== undefined)
      return <img alt="" src={props.iconImageSource} style={{ width: props.iconSize, height: props.iconSize }} />;
    else if (props.iconSourceType === 'icon' && props.iconIconSource !== undefined) {
      const style = { fontSize: props.iconSize, color: props.iconColor };
      return <IconGlyph source={props.iconIconSource} style={style} className="ndl-controls-abs-center" />;
    }

    return null;
  }

  /**
   * FB-020 (AC4). The Radio Button has no `props.checked` desync — `checked` above is derived
   * from the group on every render — but it shipped the *other* half of the checkbox's defect:
   * `fillColor` has no default and `initialize` sets `props.styles.fill = {}`, so the dot was
   * `backgroundColor: undefined` and a fresh radio button looked identical selected or not.
   *
   * The dot is now drawn only while this button is the selection — which is what a radio button
   * means, and what the fill was always for. It was previously painted on every button in the
   * group at once, so an author who set `Fill Color` as a plain parameter got a filled dot on
   * every option including the unselected ones; setting it on the checked visual state was the
   * only arrangement that worked, and nothing said so. A colour set on the checked state behaves
   * exactly as before, because it is only present in `styles.fill` while checked anyway.
   *
   * With no colour of its own the dot takes the button's border colour, so a fresh radio button
   * shows its selection the way a fresh checkbox now shows its tick.
   *
   * ⚠️ Borders are stored per side — `borderTopColor`, never the `borderColor` shorthand.
   */
  const borderColor = props.styles.radio?.borderTopColor || props.styles.radio?.borderColor;
  const fillColor = checked ? props.styles.fill.backgroundColor || borderColor : undefined;

  const fillStyle: React.CSSProperties = {
    left: props.fillSpacing,
    right: props.fillSpacing,
    top: props.fillSpacing,
    bottom: props.fillSpacing,
    backgroundColor: fillColor,
    borderRadius: 'inherit',
    position: 'absolute'
  };

  const radioButton = (
    <div
      ref={noodlRootRef(props.noodlNode)}
      className="ndl-controls-pointer"
      style={inputWrapperStyle}
      noodl-style-tag="radio"
    >
      <div style={fillStyle} noodl-style-tag="fill" />
      {props.useIcon ? _renderIcon() : null}
      <input
        type="radio"
        name={radioButtonGroup ? radioButtonGroup.name : undefined}
        {...inputProps}
        checked={checked}
        onChange={(e) => {
          radioButtonGroup && radioButtonGroup.checkedChanged && radioButtonGroup.checkedChanged(props.value);
        }}
      />
    </div>
  );

  if (props.useLabel) {
    const labelStyle = {
      marginLeft: props.labelSpacing,
      ...props.labeltextStyle,
      ...props.styles.label,
      cursor: props.enabled ? undefined : 'default'
    };

    labelStyle.color = props.noodlNode.context.styles.resolveColor(labelStyle.color);

    const wrapperStyle = { display: 'flex', alignItems: 'center', ...style };
    if (isPercentage(props.styles.radio.width)) {
      wrapperStyle.width = props.styles.radio.width;
    }
    if (isPercentage(props.styles.radio.height)) {
      wrapperStyle.height = props.styles.radio.height;
    }

    return (
      <div ref={noodlRootRef(props.noodlNode)} style={wrapperStyle} {...Utils.controlEvents(props)}>
        {radioButton}
        <label className="ndl-controls-pointer" style={labelStyle} htmlFor={props.id} noodl-style-tag="label">
          {props.label}
        </label>
      </div>
    );
  } else {
    return radioButton;
  }
}
