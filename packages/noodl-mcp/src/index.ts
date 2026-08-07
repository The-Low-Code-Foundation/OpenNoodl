/**
 * Library surface of @noodl/mcp — lets tests (and future embedders, e.g. a
 * running-editor bridge) assemble the server without the stdio CLI.
 */

export { createServer } from './server';
export type { ServerOptions, CreatedServer } from './server';
export { ProjectStore, computeRevision } from './project/ProjectStore';
export { ToolError } from './errors';
export { describeComponent } from './describe';
export { applyOperations, reconcileHierarchy } from './graph';
export type { ComponentFiles, UpdateOperation } from './graph';
export { validateCandidate, validateDeletion, validateOnDisk } from './validate';
export * as catalog from './catalog';
