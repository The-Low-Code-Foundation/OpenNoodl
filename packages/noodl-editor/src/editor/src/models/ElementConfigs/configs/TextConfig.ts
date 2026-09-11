/**
 * STYLE-002: Text Element Config
 *
 * Defines default styles and pre-built variants for the Text node.
 *
 * BUG FIX: Text elements previously defaulted to width: 100% with no flex-shrink,
 * causing them to push sibling elements off-screen in row layouts.
 * Fixed by using width: auto + proper flex participation defaults.
 */

import { ElementConfig } from '../ElementConfigTypes';

export const TextConfig: ElementConfig = {
  nodeType: 'Text',

  defaults: {
    // BUG FIX: Proper flex participation (was: width: '100%' with no shrink)
    width: 'auto',
    height: 'auto',
    flexShrink: '1',
    flexGrow: '0',
    minWidth: '0',

    // Typography
    fontFamily: 'var(--font-sans)',
    fontSize: 'var(--text-base)',
    fontWeight: 'var(--font-normal)',
    lineHeight: 'var(--leading-normal)',
    color: 'var(--foreground)',

    _variant: 'body'
  },

  variants: {
    body: {
      fontSize: 'var(--text-base)',
      fontWeight: 'var(--font-normal)',
      lineHeight: 'var(--leading-normal)',
      color: 'var(--foreground)'
    },

    'heading-1': {
      fontSize: 'var(--text-4xl)',
      fontWeight: 'var(--font-bold)',
      lineHeight: 'var(--leading-tight)',
      letterSpacing: 'var(--tracking-tight)',
      color: 'var(--foreground)'
    },

    'heading-2': {
      fontSize: 'var(--text-3xl)',
      fontWeight: 'var(--font-semibold)',
      lineHeight: 'var(--leading-tight)',
      color: 'var(--foreground)'
    },

    'heading-3': {
      fontSize: 'var(--text-2xl)',
      fontWeight: 'var(--font-semibold)',
      lineHeight: 'var(--leading-snug)',
      color: 'var(--foreground)'
    },

    'heading-4': {
      fontSize: 'var(--text-xl)',
      fontWeight: 'var(--font-semibold)',
      lineHeight: 'var(--leading-snug)',
      color: 'var(--foreground)'
    },

    'heading-5': {
      fontSize: 'var(--text-lg)',
      fontWeight: 'var(--font-medium)',
      lineHeight: 'var(--leading-normal)',
      color: 'var(--foreground)'
    },

    'heading-6': {
      fontSize: 'var(--text-base)',
      fontWeight: 'var(--font-medium)',
      lineHeight: 'var(--leading-normal)',
      color: 'var(--foreground)'
    },

    muted: {
      fontSize: 'var(--text-sm)',
      color: 'var(--muted-foreground)'
    },

    label: {
      fontSize: 'var(--text-sm)',
      fontWeight: 'var(--font-medium)',
      color: 'var(--foreground)'
    },

    small: {
      fontSize: 'var(--text-xs)',
      color: 'var(--muted-foreground)'
    },

    // Typography only. `Text` is not a box in this runtime — it has no
    // background, padding or radius port — so the tinted, padded chip this
    // variant used to describe was three properties that could never apply.
    // A chip is a `Group { backgroundColor, padding*, borderRadius }` wrapping
    // a `Text` with this variant.
    code: {
      fontFamily: 'var(--font-mono)',
      fontSize: 'var(--text-sm)'
    },

    lead: {
      fontSize: 'var(--text-xl)',
      color: 'var(--muted-foreground)',
      lineHeight: 'var(--leading-relaxed)'
    },

    // The rule and its indent belong to a wrapping
    // `Group { borderLeftWidth, borderLeftStyle, borderLeftColor, paddingLeft }`
    // for the same reason as `code` above. `fontStyle` stays, and now applies:
    // it was specified here from the start against a runtime with no such port.
    blockquote: {
      fontStyle: 'italic',
      color: 'var(--muted-foreground)'
    }
  }
};
