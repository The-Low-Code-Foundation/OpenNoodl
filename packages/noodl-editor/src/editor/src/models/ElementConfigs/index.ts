// Import configs synchronously for initialization
import { ButtonConfig, TextConfig, GroupConfig, TextInputConfig, ImageConfig } from './configs';
import { ElementConfigRegistry } from './ElementConfigRegistry';

/**
 * ElementConfigs
 *
 * System for managing default configurations, style variants, and size presets
 * for Noodl's visual nodes (Button, Text, Group, Input, etc.).
 *
 * @module noodl-editor/models/ElementConfigs
 * @since 1.2.0
 */

// Export all types
export * from './ElementConfigTypes';

// Export registry
export { ElementConfigRegistry, registry } from './ElementConfigRegistry';

// Export configs
export * from './configs';

/**
 * Initialize Element Configs
 *
 * Registers all built-in element configurations.
 * Should be called once at application startup.
 */
export function initElementConfigs(): void {
  console.log('[ElementConfigs] Initializing element configs...');

  // Register all configs synchronously
  ElementConfigRegistry.instance.register(ButtonConfig);
  ElementConfigRegistry.instance.register(TextConfig);
  ElementConfigRegistry.instance.register(GroupConfig);
  ElementConfigRegistry.instance.register(TextInputConfig);
  ElementConfigRegistry.instance.register(ImageConfig);

  console.log('[ElementConfigs] ✅ Initialized with', ElementConfigRegistry.instance.getCount(), 'configs');
}
