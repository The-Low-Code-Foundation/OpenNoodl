/**
 * Execution History Module — WF-006
 *
 * Entry point for the main process. Mirrors the `local-backend` module's
 * `setupBackendIPC()` convenience export.
 *
 * Usage in main.js:
 *   const { setupExecutionHistoryIPC } = require('./src/execution-history');
 *   setupExecutionHistoryIPC(); // opens the store + registers IPC handlers
 */

import { ipcMain } from 'electron';

import { executionHistoryManager, ExecutionHistoryManager } from './ExecutionHistoryManager';
import type { ExecutionHistoryStatus } from './ExecutionHistoryManager';

export { executionHistoryManager, ExecutionHistoryManager };
export type { ExecutionHistoryStatus };

export function setupExecutionHistoryIPC(): ExecutionHistoryStatus {
  const status = executionHistoryManager.init();
  executionHistoryManager.registerIpcHandlers(ipcMain);
  return status;
}
