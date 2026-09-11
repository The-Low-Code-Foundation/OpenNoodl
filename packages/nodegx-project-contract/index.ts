/**
 * The package root re-exports both modules for convenience, but **prefer the subpath imports** —
 * `@nodegx/project-contract/tokens` and `@nodegx/project-contract/logic-builder-io`.
 *
 * The runtime imports the Logic Builder module and ships in the browser viewer; pulling the whole
 * token vocabulary in behind it, on the chance a bundler declines to tree-shake, is a cost the
 * viewer should not pay for a barrel file's convenience.
 */
export * from './tokens';
export * from './logic-builder-io';
