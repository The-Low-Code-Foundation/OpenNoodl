/**
 * Backend Services Module
 *
 * The backends a project can point at: the built-in one, a Parse server,
 * Directus, Supabase, PocketBase, or a custom REST API — one union, six presets,
 * and one statement per backend of what choosing it publishes.
 *
 * @module BackendServices
 * @since 1.2.0
 */

export { BackendServices } from './BackendServices';
export * from './activeBackend';
export * from './types';
export * from './presets';
export * from './schemaParsers';
export * from './security';
export * from './securityFindings';
export * from './backendList';
