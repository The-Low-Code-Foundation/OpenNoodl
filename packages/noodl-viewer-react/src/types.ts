import React, { ReactElement, ReactPortal } from 'react';

import type { ReactNodeInstance } from './react-component-node';

export namespace Noodl {
  export type SizeMode = 'explicit' | 'contentWidth' | 'contentHeight' | 'contentSize';

  export type Color = string;

  export type Image = string;

  /**
   * An icon source — see `dev-docs/reference/ICON-SOURCE-MODEL.md` (NDA-007 §1).
   *
   * A tagged union, with `kind` absent meaning `'font'` so every value written before the
   * union existed parses unchanged. The value stays plainly serialisable: it travels through
   * ports, project JSON and the AI authoring loop, so no functions and no components.
   */
  export type Icon = IconFontSource | IconSpriteSource | IconInlineSource;

  /** An icon font: a CSS class plus either a codepoint or a class-per-glyph. */
  export type IconFontSource = {
    kind?: 'font';
    class: string;
    code: string;
    codeAsClass?: boolean;
  };

  /** An SVG sprite sheet: `<svg><use href={url + '#' + symbolId}/></svg>`. */
  export type IconSpriteSource = {
    kind: 'sprite';
    url: string;
    symbolId: string;
  };

  /** Markup rendered directly, for glyphs that must be animated or multicolour. */
  export type IconInlineSource = {
    kind: 'inline';
    svg: string;
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
