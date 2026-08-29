/**
 * STYLE-002: Checkbox Element Config
 *
 * Defines default styles for the Checkbox node (net.noodl.controls.checkbox).
 */

import { ElementConfig } from '../ElementConfigTypes';

export const CheckboxConfig: ElementConfig = {
  nodeType: 'net.noodl.controls.checkbox',

  defaults: {
    width: 'var(--space-4)',
    height: 'var(--space-4)',
    borderWidth: 'var(--border-1)',
    // DEF-001: same 1.23:1 edge as the TextInput. This row was NOT in DEF-001's write-up — the
    // task named the text field, and the derived ratchet found the checkbox beside it. A pair
    // list written by hand would have fixed one control and shipped the other.
    borderColor: 'var(--border-control)',
    borderStyle: 'solid',
    borderRadius: 'var(--radius-sm)',
    cursor: 'pointer',
    _variant: 'default'
  },

  variants: {
    default: {
      borderColor: 'var(--border-control)',
      states: {
        hover: { borderColor: 'var(--primary)' },
        disabled: { opacity: '0.5', cursor: 'not-allowed' }
      }
    }
  }
};
