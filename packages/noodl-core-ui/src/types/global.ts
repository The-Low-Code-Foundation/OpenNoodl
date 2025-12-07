import React, { ReactElement, ReactPortal } from 'react';

export interface UnsafeStyleProps {
  UNSAFE_className?: string;
  UNSAFE_style?: React.CSSProperties;
}

// FIXME: add generics to be able to specify what exact components are allowed?
// Note: ReactFragment removed in React 19, using React.ReactNode for fragments
export type SingleSlot =
  | ReactElement<TSFixme, TSFixme>
  | Iterable<React.ReactNode>
  | ReactPortal
  | boolean
  | null
  | undefined;

export type Slot = SingleSlot | SingleSlot[];
