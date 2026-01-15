/**
 * ImageConfig
 *
 * Element configuration for Image nodes.
 * Defines default styling and 3 variants for common image presentations.
 *
 * @module noodl-editor/models/ElementConfigs/configs
 * @since 1.2.0
 */

import type { ElementConfig } from '../ElementConfigTypes';

/**
 * Image element configuration
 * Provides flexible image display styles with shape variants
 */
export const ImageConfig: ElementConfig = {
  nodeType: 'net.noodl.visual.image',

  description: 'Image element with shape and sizing variants',

  categories: ['media', 'visual'],

  // Default properties applied when a new Image is created
  defaults: {
    // Sizing
    width: 'auto',
    height: 'auto',
    maxWidth: '100%',

    // Display
    display: 'block',
    objectFit: 'cover',
    objectPosition: 'center',

    // Border
    borderRadius: '0',
    borderWidth: '0',
    borderStyle: 'solid',
    borderColor: 'transparent',

    // Background (for loading/error states)
    backgroundColor: 'var(--theme-color-bg-2)',

    // Default variant
    _variant: 'default'
  },

  // Style variants
  variants: {
    // Default: Standard rectangular image
    default: {
      borderRadius: '0',
      objectFit: 'cover',
      objectPosition: 'center',
      overflow: 'hidden'
    },

    // Rounded: Image with rounded corners
    rounded: {
      borderRadius: 'var(--radius-lg)',
      objectFit: 'cover',
      objectPosition: 'center',
      overflow: 'hidden'
    },

    // Circle: Circular image (for avatars, icons)
    circle: {
      borderRadius: '9999px',
      objectFit: 'cover',
      objectPosition: 'center',
      overflow: 'hidden',
      aspectRatio: '1 / 1' // Ensure square for perfect circle
    }
  }
};
