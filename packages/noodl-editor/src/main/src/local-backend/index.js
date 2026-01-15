/**
 * Local Backend Module
 *
 * Provides a zero-configuration local backend for database operations.
 * Entry point for Phase 5 TASK-007B: Local Backend Server.
 *
 * Usage in main process:
 *   const { setupBackendIPC } = require('./local-backend');
 *   setupBackendIPC(); // Sets up IPC handlers
 *
 * Usage from renderer:
 *   await window.electronAPI.invoke('backend:list');
 *   await window.electronAPI.invoke('backend:create', 'My Backend');
 *   await window.electronAPI.invoke('backend:start', backendId);
 *
 * @module local-backend
 */

const { LocalBackendServer, generateObjectId } = require('./LocalBackendServer');
const { BackendManager, backendManager, setupBackendIPC } = require('./BackendManager');

module.exports = {
  // Classes
  LocalBackendServer,
  BackendManager,

  // Singleton instance
  backendManager,

  // Convenience functions
  setupBackendIPC,
  generateObjectId
};
