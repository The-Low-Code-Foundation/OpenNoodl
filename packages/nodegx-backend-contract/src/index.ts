/**
 * `@noodl/backend-contract` — the backend-neutral contracts, and the capability
 * descriptor that says what each backend can actually do.
 *
 * Types and frozen data. **No I/O, no adapter implementations, no node code.**
 * Adapters arrive in BCN-002 onwards; this package is what they register
 * against, and what the editor gates ports on.
 *
 * @module backend-contract
 */

export * from './backends';
export * from './capabilities';
export * from './data';
export * from './auth';
export * from './events';
export * from './filter';
export * from './descriptors';
