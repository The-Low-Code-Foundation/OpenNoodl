/**
 * Schema Validator
 *
 * Ajv-based validation utilities for the v2 multi-file project format.
 * Validates project files against their JSON schemas before reading/writing.
 *
 * @module noodl-editor/schemas/validator
 * @since 1.2.0
 */

import Ajv, { ValidateFunction } from 'ajv';
// ajv-formats may resolve to a different Ajv version at the root node_modules.
// Using require() + type assertion avoids the TS type mismatch while keeping
// the same runtime behaviour (both are Ajv v8 compatible).
// eslint-disable-next-line @typescript-eslint/no-var-requires
const addFormats = require('ajv-formats') as (ajv: Ajv) => Ajv;

// Import schemas
import projectV2Schema from './project-v2.schema.json';
import componentSchema from './component.schema.json';
import nodesSchema from './nodes.schema.json';
import connectionsSchema from './connections.schema.json';
import registrySchema from './registry.schema.json';
import routesSchema from './routes.schema.json';
import stylesSchema from './styles.schema.json';
import modelSchema from './model.schema.json';

// ─── Schema IDs ──────────────────────────────────────────────────────────────

export const SCHEMA_IDS = {
  PROJECT: 'https://opennoodl.dev/schemas/project-v2.json',
  COMPONENT: 'https://opennoodl.dev/schemas/component-v2.json',
  NODES: 'https://opennoodl.dev/schemas/nodes-v2.json',
  CONNECTIONS: 'https://opennoodl.dev/schemas/connections-v2.json',
  REGISTRY: 'https://opennoodl.dev/schemas/registry-v2.json',
  ROUTES: 'https://opennoodl.dev/schemas/routes-v2.json',
  STYLES: 'https://opennoodl.dev/schemas/styles-v2.json',
  MODEL: 'https://opennoodl.dev/schemas/model-v2.json'
} as const;

export type SchemaId = (typeof SCHEMA_IDS)[keyof typeof SCHEMA_IDS];

// ─── Validation Result ────────────────────────────────────────────────────────

export interface ValidationError {
  /** JSON path to the failing field (e.g. '/components/Header/type') */
  path: string;
  /** Human-readable error message */
  message: string;
  /** Ajv keyword that triggered the error */
  keyword: string;
  /** Additional error params from Ajv */
  params: Record<string, unknown>;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
}

// ─── Validator class ──────────────────────────────────────────────────────────

/**
 * Singleton validator that compiles all schemas once and reuses them.
 *
 * @example
 * ```ts
 * const result = SchemaValidator.instance.validate('component', myComponentJson);
 * if (!result.valid) {
 *   console.error(result.errors);
 * }
 * ```
 */
export class SchemaValidator {
  private static _instance: SchemaValidator | undefined;

  public static get instance(): SchemaValidator {
    if (!SchemaValidator._instance) {
      SchemaValidator._instance = new SchemaValidator();
    }
    return SchemaValidator._instance;
  }

  private ajv: Ajv;
  private validators: Map<string, ValidateFunction>;

  constructor() {
    this.ajv = new Ajv({
      allErrors: true, // Collect all errors, not just the first
      strict: false, // Allow unknown keywords (e.g. 'description' in definitions)
      validateFormats: true
    });

    addFormats(this.ajv);

    // Register all schemas
    this.ajv.addSchema(projectV2Schema);
    this.ajv.addSchema(componentSchema);
    this.ajv.addSchema(nodesSchema);
    this.ajv.addSchema(connectionsSchema);
    this.ajv.addSchema(registrySchema);
    this.ajv.addSchema(routesSchema);
    this.ajv.addSchema(stylesSchema);
    this.ajv.addSchema(modelSchema);

    // Pre-compile validators for each schema
    this.validators = new Map([
      [SCHEMA_IDS.PROJECT, this.ajv.compile(projectV2Schema)],
      [SCHEMA_IDS.COMPONENT, this.ajv.compile(componentSchema)],
      [SCHEMA_IDS.NODES, this.ajv.compile(nodesSchema)],
      [SCHEMA_IDS.CONNECTIONS, this.ajv.compile(connectionsSchema)],
      [SCHEMA_IDS.REGISTRY, this.ajv.compile(registrySchema)],
      [SCHEMA_IDS.ROUTES, this.ajv.compile(routesSchema)],
      [SCHEMA_IDS.STYLES, this.ajv.compile(stylesSchema)],
      [SCHEMA_IDS.MODEL, this.ajv.compile(modelSchema)]
    ]);
  }

  /**
   * Validate data against a named schema.
   *
   * @param schemaId - One of the SCHEMA_IDS values
   * @param data - The parsed JSON object to validate
   * @returns ValidationResult with valid flag and any errors
   */
  validate(schemaId: SchemaId, data: unknown): ValidationResult {
    const validator = this.validators.get(schemaId);

    if (!validator) {
      return {
        valid: false,
        errors: [
          {
            path: '',
            message: `Unknown schema ID: ${schemaId}`,
            keyword: 'schema',
            params: { schemaId }
          }
        ]
      };
    }

    const valid = validator(data) as boolean;

    if (valid) {
      return { valid: true, errors: [] };
    }

    const errors: ValidationError[] = (validator.errors ?? []).map((err) => ({
      path: err.instancePath || '/',
      message: err.message ?? 'Validation error',
      keyword: err.keyword,
      params: (err.params as Record<string, unknown>) ?? {}
    }));

    return { valid: false, errors };
  }

  /**
   * Validate and throw if invalid. Useful for strict import paths.
   *
   * @throws Error with formatted validation messages
   */
  validateOrThrow(schemaId: SchemaId, data: unknown, context?: string): void {
    const result = this.validate(schemaId, data);

    if (!result.valid) {
      const prefix = context ? `[${context}] ` : '';
      const messages = result.errors.map((e) => `  ${e.path}: ${e.message}`).join('\n');
      throw new Error(`${prefix}Schema validation failed for ${schemaId}:\n${messages}`);
    }
  }

  /**
   * Validate a project file (nodegx.project.json).
   */
  validateProject(data: unknown): ValidationResult {
    return this.validate(SCHEMA_IDS.PROJECT, data);
  }

  /**
   * Validate a component metadata file (component.json).
   */
  validateComponent(data: unknown): ValidationResult {
    return this.validate(SCHEMA_IDS.COMPONENT, data);
  }

  /**
   * Validate a nodes file (nodes.json).
   */
  validateNodes(data: unknown): ValidationResult {
    return this.validate(SCHEMA_IDS.NODES, data);
  }

  /**
   * Validate a connections file (connections.json).
   */
  validateConnections(data: unknown): ValidationResult {
    return this.validate(SCHEMA_IDS.CONNECTIONS, data);
  }

  /**
   * Validate a component registry file (_registry.json).
   */
  validateRegistry(data: unknown): ValidationResult {
    return this.validate(SCHEMA_IDS.REGISTRY, data);
  }

  /**
   * Validate a routes file (nodegx.routes.json).
   */
  validateRoutes(data: unknown): ValidationResult {
    return this.validate(SCHEMA_IDS.ROUTES, data);
  }

  /**
   * Validate a styles file (nodegx.styles.json).
   */
  validateStyles(data: unknown): ValidationResult {
    return this.validate(SCHEMA_IDS.STYLES, data);
  }

  /**
   * Validate a model definition file (models/<Name>.json).
   */
  validateModel(data: unknown): ValidationResult {
    return this.validate(SCHEMA_IDS.MODEL, data);
  }

  /**
   * Reset the singleton (useful for testing).
   */
  static reset(): void {
    SchemaValidator._instance = undefined;
  }
}

// ─── Convenience functions ────────────────────────────────────────────────────

/**
 * Validate data against a schema. Uses the singleton validator.
 *
 * @example
 * ```ts
 * const { valid, errors } = validateSchema(SCHEMA_IDS.COMPONENT, data);
 * ```
 */
export function validateSchema(schemaId: SchemaId, data: unknown): ValidationResult {
  return SchemaValidator.instance.validate(schemaId, data);
}

/**
 * Format validation errors into a human-readable string.
 */
export function formatValidationErrors(errors: ValidationError[]): string {
  if (errors.length === 0) return 'No errors';
  return errors.map((e) => `  • ${e.path || '/'}: ${e.message}`).join('\n');
}
