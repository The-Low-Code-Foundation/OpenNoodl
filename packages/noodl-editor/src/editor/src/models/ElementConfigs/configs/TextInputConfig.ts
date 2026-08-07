/**
 * STYLE-002: TextInput Element Config
 *
 * Defines default styles and pre-built variants for the TextInput node
 * (net.noodl.controls.textinput). Includes default + error variants
 * with proper focus ring styling.
 */

import { ElementConfig } from '../ElementConfigTypes';

export const TextInputConfig: ElementConfig = {
  nodeType: 'net.noodl.controls.textinput',

  defaults: {
    width: '100%',
    height: 'auto',

    paddingTop: 'var(--space-2)',
    paddingBottom: 'var(--space-2)',
    paddingLeft: 'var(--space-3)',
    paddingRight: 'var(--space-3)',

    fontFamily: 'var(--font-sans)',
    fontSize: 'var(--text-base)',
    color: 'var(--foreground)',

    borderWidth: 'var(--border-1)',
    borderColor: 'var(--border)',
    borderStyle: 'solid',
    borderRadius: 'var(--radius-md)',

    backgroundColor: 'var(--background)',

    _variant: 'default'
  },

  variants: {
    default: {
      borderColor: 'var(--border)',
      backgroundColor: 'var(--background)',
      states: {
        focus: {
          borderColor: 'var(--ring)',
          boxShadow: '0 0 0 2px var(--ring)',
          outline: 'none'
        },
        disabled: {
          backgroundColor: 'var(--muted)',
          opacity: '0.5',
          cursor: 'not-allowed'
        },
        placeholder: {
          color: 'var(--muted-foreground)'
        }
      }
    },

    error: {
      borderColor: 'var(--destructive)',
      states: {
        focus: {
          borderColor: 'var(--destructive)',
          boxShadow: '0 0 0 2px var(--destructive)'
        }
      }
    }
  }
};
