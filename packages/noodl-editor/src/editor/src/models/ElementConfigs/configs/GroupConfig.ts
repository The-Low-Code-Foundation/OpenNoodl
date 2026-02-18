/**
 * STYLE-002: Group Element Config
 *
 * Defines default styles and pre-built variants for the Group node
 * (net.noodl.visual.group). Groups start transparent by default but
 * offer card/section/inset/flex layout variants.
 */

import { ElementConfig } from '../ElementConfigTypes';

export const GroupConfig: ElementConfig = {
  nodeType: 'net.noodl.visual.group',

  defaults: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'stretch',
    _variant: 'default'
  },

  variants: {
    default: {
      backgroundColor: 'transparent',
      padding: '0',
      borderWidth: '0',
      borderRadius: '0'
    },

    card: {
      backgroundColor: 'var(--surface)',
      padding: 'var(--space-4)',
      borderWidth: 'var(--border-1)',
      borderColor: 'var(--border-subtle)',
      borderStyle: 'solid',
      borderRadius: 'var(--radius-lg)',
      boxShadow: 'var(--shadow-md)'
    },

    section: {
      padding: 'var(--space-8)'
    },

    inset: {
      backgroundColor: 'var(--muted)',
      padding: 'var(--space-4)',
      borderRadius: 'var(--radius-md)'
    },

    'flex-row': {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 'var(--space-2)'
    },

    'flex-col': {
      flexDirection: 'column',
      gap: 'var(--space-2)'
    },

    centered: {
      alignItems: 'center',
      justifyContent: 'center'
    }
  }
};
