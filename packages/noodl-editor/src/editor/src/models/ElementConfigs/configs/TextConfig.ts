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

    code: {
      fontFamily: 'var(--font-mono)',
      fontSize: 'var(--text-sm)',
      backgroundColor: 'var(--muted)',
      padding: '2px 4px',
      borderRadius: 'var(--radius-sm)'
    },

    lead: {
      fontSize: 'var(--text-xl)',
      color: 'var(--muted-foreground)',
      lineHeight: 'var(--leading-relaxed)'
    },

    blockquote: {
      fontStyle: 'italic',
      borderLeftWidth: '4px',
      borderLeftColor: 'var(--border)',
      borderLeftStyle: 'solid',
      paddingLeft: 'var(--space-4)',
      color: 'var(--muted-foreground)'
    }
  }
};
