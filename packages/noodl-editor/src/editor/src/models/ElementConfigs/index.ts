/**
 * STYLE-002: ElementConfigs public API
 */

export type { ElementConfig, VariantConfig, StateStyles, SizePresets, ResolvedVariant } from './ElementConfigTypes';
export { ElementConfigRegistry } from './ElementConfigRegistry';
export type { NodeModelLike } from './ElementConfigRegistry';

// Config objects (useful for testing or direct access)
export { ButtonConfig } from './configs/ButtonConfig';
export { CheckboxConfig } from './configs/CheckboxConfig';
export { TextConfig } from './configs/TextConfig';
export { TextInputConfig } from './configs/TextInputConfig';
