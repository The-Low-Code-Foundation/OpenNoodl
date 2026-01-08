/**
 * App Configuration Validation
 *
 * Provides validation utilities for config keys and values.
 *
 * @module config/validation
 */

import { ConfigType, ConfigValidation, RESERVED_CONFIG_KEYS } from './types';

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * Validates a configuration variable key.
 * Keys must be valid JavaScript identifiers and not reserved.
 *
 * @param key - The key to validate
 * @returns Validation result with errors if invalid
 */
export function validateConfigKey(key: string): ValidationResult {
  const errors: string[] = [];

  if (!key || key.trim() === '') {
    errors.push('Key cannot be empty');
    return { valid: false, errors };
  }

  // Must be valid JS identifier
  if (!/^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(key)) {
    errors.push('Key must be a valid JavaScript identifier (letters, numbers, _, $ only; cannot start with a number)');
  }

  // Check reserved keys
  if ((RESERVED_CONFIG_KEYS as readonly string[]).includes(key)) {
    errors.push(`"${key}" is a reserved configuration key`);
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Validates a configuration value based on its type and validation rules.
 *
 * @param value - The value to validate
 * @param type - The expected type
 * @param validation - Optional validation rules
 * @returns Validation result with errors if invalid
 */
export function validateConfigValue(value: unknown, type: ConfigType, validation?: ConfigValidation): ValidationResult {
  const errors: string[] = [];

  // Required check
  if (validation?.required && (value === undefined || value === null || value === '')) {
    errors.push('This field is required');
    return { valid: false, errors };
  }

  // If value is empty and not required, skip type validation
  if (value === undefined || value === null || value === '') {
    return { valid: true, errors: [] };
  }

  // Type-specific validation
  switch (type) {
    case 'number':
      if (typeof value !== 'number' || isNaN(value)) {
        errors.push('Value must be a number');
      } else {
        if (validation?.min !== undefined && value < validation.min) {
          errors.push(`Value must be at least ${validation.min}`);
        }
        if (validation?.max !== undefined && value > validation.max) {
          errors.push(`Value must be at most ${validation.max}`);
        }
      }
      break;

    case 'string':
      if (typeof value !== 'string') {
        errors.push('Value must be a string');
      } else if (validation?.pattern) {
        try {
          const regex = new RegExp(validation.pattern);
          if (!regex.test(value)) {
            errors.push('Value does not match required pattern');
          }
        } catch (e) {
          errors.push('Invalid validation pattern');
        }
      }
      break;

    case 'boolean':
      if (typeof value !== 'boolean') {
        errors.push('Value must be true or false');
      }
      break;

    case 'color':
      if (typeof value !== 'string') {
        errors.push('Color value must be a string');
      } else if (!/^#[0-9A-Fa-f]{6}([0-9A-Fa-f]{2})?$/.test(value)) {
        errors.push('Value must be a valid hex color (e.g., #ff0000 or #ff0000ff)');
      }
      break;

    case 'array':
      if (!Array.isArray(value)) {
        errors.push('Value must be an array');
      }
      break;

    case 'object':
      if (typeof value !== 'object' || value === null || Array.isArray(value)) {
        errors.push('Value must be an object');
      }
      break;

    default:
      errors.push(`Unknown type: ${type}`);
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Validates an entire app config object.
 *
 * @param config - The app config to validate
 * @returns Validation result with all errors found
 */
export function validateAppConfig(config: unknown): ValidationResult {
  const errors: string[] = [];

  // Type guard for config object
  if (!config || typeof config !== 'object') {
    errors.push('Config must be an object');
    return { valid: false, errors };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const cfg = config as Record<string, any>;

  // Check required identity fields
  if (!cfg.identity?.appName || cfg.identity.appName.trim() === '') {
    errors.push('App name is required');
  }

  // Validate custom variables
  if (cfg.variables && Array.isArray(cfg.variables)) {
    const seenKeys = new Set<string>();

    for (const variable of cfg.variables) {
      // Check for duplicate keys
      if (seenKeys.has(variable.key)) {
        errors.push(`Duplicate variable key: ${variable.key}`);
        continue;
      }
      seenKeys.add(variable.key);

      // Validate key
      const keyValidation = validateConfigKey(variable.key);
      if (!keyValidation.valid) {
        errors.push(...keyValidation.errors.map((e) => `Variable "${variable.key}": ${e}`));
      }

      // Validate value
      const valueValidation = validateConfigValue(variable.value, variable.type, variable.validation);
      if (!valueValidation.valid) {
        errors.push(...valueValidation.errors.map((e) => `Variable "${variable.key}": ${e}`));
      }
    }
  }

  return { valid: errors.length === 0, errors };
}
