/**
 * @noodl/nodegx-backend — public API.
 *
 * Standalone NodeGX backend service (WF-004). Runs headless with no Electron,
 * both as a child process the editor spawns and as a deployable Node service.
 *
 * The runnable artifact is `dist/cli.js` — a single esbuild bundle embedding
 * the adapter stack (@noodl/runtime) and the cloud runtime + execution history
 * (noodl-viewer-cloud/src via the `@cloud-runtime` alias). See scripts/build.js.
 *
 * @module nodegx-backend
 */

export { BackendService, StartedService } from './service';
export { createAdapter, PersistenceHandle, LocalBackendPersistenceError } from './persistence/createAdapter';
export { AdapterFacade } from './persistence/AdapterFacade';
export { BackendServiceOptions, resolveOptions, requiresAuth, generateAuthToken } from './config';
export { HttpServer, ListenInfo } from './server/HttpServer';
export { WorkflowRunner } from './workflow/WorkflowRunner';
export { ExecutionHistory } from './execution/ExecutionStore';
export { main as cli } from './cli';
