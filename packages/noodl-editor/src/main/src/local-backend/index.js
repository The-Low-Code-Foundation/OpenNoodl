/**
 * Local Backend Module
 *
 * The editor-side half of the local backend: lifecycle management (create/
 * start/stop/delete) and the IPC surface the Backend Services panel and Data
 * Browser call. The backend itself — HTTP server, adapter stack, workflow
 * runner, execution store — runs in a supervised `nodegx-backend` child
 * process since WF-004 (see `packages/nodegx-backend`); the old in-process
 * `LocalBackendServer`/`WorkflowRunner` are gone.
 *
 * Usage in main process:
 *   const { setupBackendIPC, backendManager } = require('./local-backend');
 *   setupBackendIPC(); // Sets up IPC handlers
 *
 * Usage from renderer:
 *   await window.electronAPI.invoke('backend:list');
 *   await window.electronAPI.invoke('backend:create', 'My Backend');
 *   await window.electronAPI.invoke('backend:start', backendId);
 *
 * @module local-backend
 */

const { BackendManager, backendManager, setupBackendIPC } = require('./BackendManager');
const { ServiceSupervisor, resolveServiceEntry } = require('./ServiceSupervisor');

module.exports = {
  // Classes
  BackendManager,
  ServiceSupervisor,

  // Singleton instance
  backendManager,

  // Convenience functions
  setupBackendIPC,
  resolveServiceEntry
};
