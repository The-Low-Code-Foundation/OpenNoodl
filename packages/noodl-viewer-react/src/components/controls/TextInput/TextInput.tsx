import React from 'react';

import Layout from '../../../layout';
import Utils from '../../../nodes/controls/utils';
import { outwardValueForFieldType } from '../../../nodes/controls/textInputValue';
import { Noodl, Slot } from '../../../types';
import { noodlRootRef } from '../../noodl-root-ref';
import { IconGlyph } from '../../visual/Icon/IconGlyph';

//this stops a text field from being unfocused by the clickHandler in the viewer that handles focus globally.
//The specific case is when a mouseDown is registered in the input, but the mouseUp is outside.
//It'll trigger a focus change that'll blur the input field, which is annyoing when you're selecting text
function preventGlobalFocusChange(e) {
  e.stopPropagation();
  window.removeEventListener('click', preventGlobalFocusChange, true);
}

export interface TextInputProps extends Noodl.ReactProps {
  id: string;
  type: 'text' | 'textArea' | 'email' | 'number' | 'password' | 'url';
  textStyle: Noodl.TextStyle;

  enabled: boolean;

  placeholder: string;
  maxLength: number;

  startValue: string | number;
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

  onTextChanged?: (value: string | number | null) => void;
  onEnter?: () => void;

  children: Slot;
}

// Based on (HTMLTextAreaElement | HTMLInputElement)
type InputRef = (HTMLTextAreaElement | HTMLInputElement) & {
  noodlNode?: Noodl.ReactProps['noodlNode'];
};

type State = {
  value: string;
};

export class TextInput extends React.Component<TextInputProps, State> {
  ref: React.MutableRefObject<InputRef>;

  constructor(props: TextInputProps) {
    super(props);

    this.state = {
      // Same coercion `setText` does, for the same reason: a Number field can be given its
      // start value as a number, and the controlled `<input>` needs a string.
      value: props.startValue === null || props.startValue === undefined ? '' : String(props.startValue)
    } satisfies State;

    this.ref = React.createRef();
  }

  /**
   * FB-026 — what the field *holds* and what the node *emits* are two different things, and
   * before this they were the same string. The rule, and why the state stays raw text, is in
   * `nodes/controls/textInputValue.ts`.
   */
  setText(value: string | number) {
    // Inward it is always text: `startValue` may arrive as a number on a Number field, and the
    // `<input>`'s `value` has to be a string or React drops the control.
    const text = value === null || value === undefined ? '' : String(value);
    this.setState({ value: text });
    this.props.onTextChanged && this.props.onTextChanged(outwardValueForFieldType(this.props.type, text));
  }

  componentDidMount() {
    //plumbing for the focused signals
    this.ref.current.noodlNode = this.props.noodlNode;

    this.setText(this.props.startValue);
  }

  render() {
    const style: React.CSSProperties = { ...this.props.style };

    Layout.size(style, this.props);
    Layout.align(style, this.props);

    if (style.opacity === 0) {
      style.pointerEvents = 'none';
    }

    const { height, ...otherStylesTmp } = style;
    
    // otherStylesTmp is not React.CSSProperties, reassigning it will correct the type.
    const otherStyles: React.CSSProperties = otherStylesTmp;

    const props = this.props;

    const _renderIcon = () => {
      if (props.iconSourceType === 'image' && props.iconImageSource !== undefined)
        return (
          <img
            alt=""
            src={props.iconImageSource}
            style={{
              width: props.iconSize,
              height: props.iconSize
            }}
            onClick={() => this.focus()}
          />
        );
      else if (props.iconSourceType === 'icon' && props.iconIconSource !== undefined) {
        const style: React.CSSProperties = {
          userSelect: 'none',
          fontSize: props.iconSize,
          color: props.iconColor
        };
        if (props.iconPlacement === 'left' || props.iconPlacement === undefined) style.marginRight = props.iconSpacing;
        else style.marginLeft = props.iconSpacing;

        return <IconGlyph source={props.iconIconSource} style={style} />;
      }

      return null;
    };

    let className = 'ndl-controls-textinput ' + props.id;
    if (props.className) className = className + ' ' + props.className;

    let inputContent;

    const inputStyles: React.CSSProperties = {
      ...props.textStyle,
      ...props.styles.input,
      width: '100%',
      height: '100%'
    };

    inputStyles.color = props.noodlNode.context.styles.resolveColor(inputStyles.color);

    const inputProps = {
      id: props.id,
      value: this.state.value,
      ...Utils.controlEvents(props),
      disabled: !props.enabled,
      style: inputStyles,
      className,
      placeholder: props.placeholder,
      maxLength: props.maxLength,
      onChange: (e) => this.onChange(e)
    };

    if (props.type !== 'textArea') {
      inputContent = (
        <input
          // Block body on purpose: React 19 treats a ref callback's return value as a
          // cleanup function, and the concise `(ref) => (this.ref.current = ref)` form
          // returns the element itself.
          ref={(ref) => {
            this.ref.current = ref;
          }}
          type={this.props.type}
          {...inputProps}
          onKeyDown={(e) => this.onKeyDown(e)}
          onMouseDown={() => window.addEventListener('click', preventGlobalFocusChange, true)}
          noodl-style-tag="input"
        />
      );
    } else {
      inputProps.style.resize = 'none'; //disable user resizing
      inputContent = (
        <textarea
          // Block body on purpose: React 19 treats a ref callback's return value as a
          // cleanup function, and the concise `(ref) => (this.ref.current = ref)` form
          // returns the element itself.
          ref={(ref) => {
            this.ref.current = ref;
          }}
          {...inputProps}
          onKeyDown={(e) => this.onKeyDown(e)}
          noodl-style-tag="input"
        />
      );
    }

    const inputWrapperStyle = {
      display: 'flex',
      alignItems: 'center',
      ...props.styles.inputWrapper
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

    if (props.type !== 'textArea') {
      inputWrapperStyle.alignItems = 'center';
    }

    const inputWithWrapper = (
      <div ref={noodlRootRef(this.props.noodlNode)} style={inputWrapperStyle} noodl-style-tag="inputWrapper">
        {props.useIcon && props.iconPlacement === 'left' ? _renderIcon() : null}
        {inputContent}
        {props.useIcon && props.iconPlacement === 'right' ? _renderIcon() : null}
      </div>
    );

    if (props.useLabel) {
      otherStyles.display = 'flex';
      otherStyles.flexDirection = 'column';
      if (heightInPercent) otherStyles.height = height;

      const labelStyle: React.CSSProperties = {
        ...props.labeltextStyle,
        ...props.styles.label,
        marginBottom: props.labelSpacing
      };
      labelStyle.color = props.noodlNode.context.styles.resolveColor(labelStyle.color);

      return (
        <div ref={noodlRootRef(this.props.noodlNode)} style={otherStyles}>
          <label htmlFor={props.id} style={labelStyle} noodl-style-tag="label">
            {props.label}
          </label>
          {inputWithWrapper}
        </div>
      );
    } else {
      return inputWithWrapper;
    }
  }

  onKeyDown(e) {
    if (e.key === 'Enter' || e.which === 13) {
      this.props.onEnter && this.props.onEnter();
    }
  }

  onChange(event) {
    const value = event.target.value;
    this.setText(value);
  }

  focus() {
    this.ref.current && this.ref.current.focus();
  }

  blur() {
    this.ref.current && this.ref.current.blur();
  }

  hasFocus() {
    return document.activeElement === this.ref.current;
  }
}
