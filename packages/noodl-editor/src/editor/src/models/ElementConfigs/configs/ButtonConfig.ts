/**
 * STYLE-002: Button Element Config
 *
 * Defines default styles and pre-built variants for the Button node
 * (net.noodl.controls.button). All values use design token CSS variables
 * so changing a token cascades to all buttons.
 */

import { ElementConfig } from '../ElementConfigTypes';

export const ButtonConfig: ElementConfig = {
  nodeType: 'net.noodl.controls.button',

  // Applied when a Button node is first dropped onto the canvas
  defaults: {
    paddingTop: 'var(--space-2)',
    paddingBottom: 'var(--space-2)',
    paddingLeft: 'var(--space-4)',
    paddingRight: 'var(--space-4)',
    fontSize: 'var(--text-sm)',
    fontWeight: 'var(--font-medium)',
    fontFamily: 'var(--font-sans)',
    borderRadius: 'var(--radius-md)',
    cursor: 'pointer',
    _variant: 'primary'
  },

  sizes: {
    sm: {
      paddingTop: 'var(--space-1)',
      paddingBottom: 'var(--space-1)',
      paddingLeft: 'var(--space-2)',
      paddingRight: 'var(--space-2)',
      fontSize: 'var(--text-xs)'
    },
    md: {
      paddingTop: 'var(--space-2)',
      paddingBottom: 'var(--space-2)',
      paddingLeft: 'var(--space-4)',
      paddingRight: 'var(--space-4)',
      fontSize: 'var(--text-sm)'
    },
    lg: {
      paddingTop: 'var(--space-3)',
      paddingBottom: 'var(--space-3)',
      paddingLeft: 'var(--space-6)',
      paddingRight: 'var(--space-6)',
      fontSize: 'var(--text-base)'
    },
    xl: {
      paddingTop: 'var(--space-4)',
      paddingBottom: 'var(--space-4)',
      paddingLeft: 'var(--space-8)',
      paddingRight: 'var(--space-8)',
      fontSize: 'var(--text-lg)'
    }
  },

  variants: {
    primary: {
      backgroundColor: 'var(--primary)',
      color: 'var(--primary-foreground)',
      borderWidth: '0',
      boxShadow: 'var(--shadow-sm)',
      states: {
        hover: { backgroundColor: 'var(--primary-hover)' },
        active: { transform: 'scale(0.98)' },
        disabled: { opacity: '0.5', cursor: 'not-allowed' }
      }
    },

    secondary: {
      backgroundColor: 'var(--secondary)',
      color: 'var(--secondary-foreground)',
      borderWidth: '0',
      boxShadow: 'var(--shadow-sm)',
      states: {
        hover: { backgroundColor: 'var(--secondary-hover)' },
        active: { transform: 'scale(0.98)' },
        disabled: { opacity: '0.5', cursor: 'not-allowed' }
      }
    },

    outline: {
      backgroundColor: 'transparent',
      color: 'var(--foreground)',
      borderWidth: 'var(--border-1)',
      // DEF-001: the third control on the same 1.23:1 edge, and its `hover` was worse still —
      // `--border` over `--accent` bottoms out at **1.04:1** in `soft`, because the hover tint and
      // the hairline are neighbours on the same scale. `--border-control` clears 3:1 over both
      // `--background` and `--accent` in every preset.
      borderColor: 'var(--border-control)',
      borderStyle: 'solid',
      states: {
        hover: { backgroundColor: 'var(--accent)', color: 'var(--accent-foreground)' },
        disabled: { opacity: '0.5', cursor: 'not-allowed' }
      }
    },

    ghost: {
      backgroundColor: 'transparent',
      color: 'var(--foreground)',
      borderWidth: '0',
      states: {
        hover: { backgroundColor: 'var(--accent)', color: 'var(--accent-foreground)' },
        disabled: { opacity: '0.5', cursor: 'not-allowed' }
      }
    },

    destructive: {
      backgroundColor: 'var(--destructive)',
      color: 'var(--destructive-foreground)',
      borderWidth: '0',
      boxShadow: 'var(--shadow-sm)',
      states: {
        hover: { backgroundColor: 'var(--destructive-hover)' },
        disabled: { opacity: '0.5', cursor: 'not-allowed' }
      }
    },

    // No `textDecoration` port on this node, so the underline-on-hover this
    // variant described never rendered. Dropped rather than left claiming it;
    // the variant is now the colour and the absent chrome, which is the part
    // that always worked.
    link: {
      backgroundColor: 'transparent',
      color: 'var(--primary)',
      borderWidth: '0',
      paddingLeft: '0',
      paddingRight: '0'
    }
  }
};
