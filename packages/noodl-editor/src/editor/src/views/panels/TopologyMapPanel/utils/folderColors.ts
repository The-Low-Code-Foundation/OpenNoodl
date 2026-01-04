/**
 * Folder Color Mappings
 *
 * Defines colors for folder types used in:
 * - Gradient edge coloring (source to target)
 * - Folder node styling accents
 */

import { ComponentModel } from '@noodl-models/componentmodel';

import { IconName } from '@noodl-core-ui/components/common/Icon';

import { FolderType } from './topologyTypes';

/**
 * Maps folder types to their visual color.
 * Used for gradient edges and visual accents.
 */
export function getFolderColor(type: FolderType): string {
  switch (type) {
    case 'page':
      return '#4CAF50'; // Green - entry points
    case 'integration':
      return '#FF9800'; // Orange - external connections
    case 'ui':
      return '#2196F3'; // Blue - visual components
    case 'utility':
      return '#9C27B0'; // Purple - helper functions
    case 'feature':
      return '#FFC107'; // Amber - business logic
    case 'orphan':
      return '#F44336'; // Red - unused/isolated
    default:
      return '#757575'; // Grey - unknown
  }
}

/**
 * Maps folder types to their icon.
 * Used instead of emojis for professional appearance.
 */
export function getFolderIcon(type: FolderType): IconName {
  switch (type) {
    case 'page':
      return IconName.PageRouter;
    case 'integration':
      return IconName.RestApi;
    case 'ui':
      return IconName.UI;
    case 'utility':
      return IconName.Sliders;
    case 'feature':
      return IconName.ComponentWithChildren;
    case 'orphan':
      return IconName.WarningCircle;
    default:
      return IconName.FolderClosed;
  }
}

/**
 * Gets icon for a component based on its type.
 * Uses runtime property checks to handle optional ComponentModel properties.
 */
export function getComponentIcon(component: ComponentModel): IconName {
  // Use runtime checks since ComponentModel properties may vary
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const comp = component as any;

  if (comp.isPage === true) {
    return IconName.PageRouter;
  } else if (comp.isCloudFunction === true) {
    return IconName.CloudFunction;
  }
  return IconName.Component;
}
