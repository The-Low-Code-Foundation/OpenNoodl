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
    // DEF-001: was `var(--border)`, the decorative hairline, at **1.23:1** against `--background`
    // — a field a person is asked to type into, with an edge below WCAG 1.4.11's 3:1.
    // `--border-control` exists in the defaults and in every preset for exactly this and already
    // clears 3:1 in all of them (3.62–4.83). The knowledge was one composition away and never
    // made the trip; this is the trip.
    borderColor: 'var(--border-control)',
    borderStyle: 'solid',
    borderRadius: 'var(--radius-md)',

    backgroundColor: 'var(--background)',

    _variant: 'default'
  },

  variants: {
    default: {
      borderColor: 'var(--border-control)',
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
