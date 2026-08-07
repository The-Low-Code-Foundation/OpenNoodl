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
    borderColor: 'var(--border)',
    borderStyle: 'solid',
    borderRadius: 'var(--radius-sm)',
    cursor: 'pointer',
    _variant: 'default'
  },

  variants: {
    default: {
      borderColor: 'var(--border)',
      states: {
        hover: { borderColor: 'var(--primary)' },
        disabled: { opacity: '0.5', cursor: 'not-allowed' }
      }
    }
  }
};
