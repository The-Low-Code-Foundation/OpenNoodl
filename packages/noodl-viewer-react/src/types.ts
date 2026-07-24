import React, { ReactElement, ReactPortal } from 'react';

import type { ReactNodeInstance } from './react-component-node';

export namespace Noodl {
  export type SizeMode = 'explicit' | 'contentWidth' | 'contentHeight' | 'contentSize';

  export type Color = string;

  export type Image = string;

  export type Icon = {
    class: string;
    code: string;
    codeAsClass?: boolean;
  };

  export type TextStyle = {
    color: string;
    fontFamily: string;
    fontSize: string;
    letterSpacing: string;
    lineHeight: string;
    textTransform: React.CSSProperties['textTransform'];
  };

  export interface ReactProps {
    /**
     * The node rendering this component. Present only when the node definition
     * sets `noodlNodeAsProp`.
     */
    noodlNode: ReactNodeInstance;
    style: React.CSSProperties;
    styles: Record<string, React.CSSProperties>;
    className: string;
    parentLayout: 'none' | 'row' | 'column';
  }
}

export type SingleSlot = ReactElement<unknown> | Iterable<React.ReactNode> | ReactPortal | boolean | null | undefined;

export type Slot = SingleSlot | SingleSlot[];
