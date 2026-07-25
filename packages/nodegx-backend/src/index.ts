/**
 * @noodl/nodegx-backend — public API.
 *
 * Standalone NodeGX backend service (WF-004). Runs headless with no Electron,
 * both as a child process the editor spawns and as a deployable Node service.
 *
 * Front-half status: the package boundary, entry point, config/auth policy, and
 * the (verified) persistence + engine seam are real. The HTTP surface,
 * WorkflowRunner, and ExecutionStore are labelled placeholders whose relocation
 * is deferred to the second half of WF-004 / WF-006. See NOTES.md.
 *
 * @module nodegx-backend
 */

export { BackendService, StartedService } from './service';
export { createAdapter, PersistenceHandle, LocalBackendPersistenceError } from './persistence/createAdapter';
export {
  BackendServiceOptions,
  resolveOptions,
  requiresAuth,
  generateAuthToken
} from './config';
export { HttpServer } from './server/HttpServer';
export { WorkflowRunner } from './workflow/WorkflowRunner';
export { ExecutionStore } from './execution/ExecutionStore';
export { main as cli } from './cli';
