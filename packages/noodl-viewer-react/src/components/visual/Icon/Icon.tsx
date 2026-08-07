import React from 'react';

import Layout from '../../../layout';
import { Noodl } from '../../../types';
import { noodlRootRef } from '../../noodl-root-ref';
import { IconGlyph } from './IconGlyph';

export interface IconProps extends Noodl.ReactProps {
  iconSourceType: 'image' | 'icon';
  iconImageSource: Noodl.Image;
  iconIconSource: Noodl.Icon;
  iconSize: string;
  iconColor: Noodl.Color;
}

export function Icon(props: IconProps) {
  const style: React.CSSProperties = { userSelect: 'none', ...props.style };
  Layout.size(style, props);
  Layout.align(style, props);

  function _renderIcon() {
    const style: React.CSSProperties = {};
    if (props.iconSourceType === 'image' && props.iconImageSource !== undefined) {
      style.width = props.iconSize;
      style.height = props.iconSize;
      return <img alt="" src={props.iconImageSource} style={style} />;
    } else if (props.iconSourceType === 'icon' && props.iconIconSource !== undefined) {
      style.fontSize = props.iconSize;
      style.color = props.iconColor;
      style.lineHeight = 1;
      return (
        <div style={{ lineHeight: 0 }}>
          <IconGlyph source={props.iconIconSource} style={style} />
        </div>
      );
    }

    return null;
  }

  let className = 'ndl-visual-icon';
  if (props.className) className = className + ' ' + props.className;

  return (
    <div ref={noodlRootRef(props.noodlNode)} className={className} style={style}>
      {_renderIcon()}
    </div>
  );
}
