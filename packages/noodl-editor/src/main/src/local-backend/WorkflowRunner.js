/**
 * WorkflowRunner
 *
 * Manages CloudRunner instances for executing visual workflows.
 * This integrates the noodl-viewer-cloud CloudRunner with the LocalBackendServer,
 * providing database access to workflow nodes via the LocalSQLAdapter.
 *
 * @module local-backend/WorkflowRunner
 */

const fs = require('fs').promises;
const path = require('path');
const EventEmitter = require('events');

// WF-006: log every function execution to the shared execution-history store.
// Both are plain-CommonJS-reachable from a .ts file compiled into the same
// main-process webpack bundle (ts-loader, transpileOnly) — see
// ../execution-history/ExecutionHistoryManager.ts for why a fresh logger is
// created per run rather than one shared instance being reused.
const { executionHistoryManager } = require('../execution-history/ExecutionHistoryManager');
const { scrubRequestForLogging } = require('../execution-history/scrub');

/**
 * Safe console.log wrapper to prevent EPIPE errors
 */
function safeLog(...args) {
  try {
    console.log('[WorkflowRunner]', ...args);
  } catch (e) {
    // Ignore EPIPE errors
  }
}

/**
 * WorkflowRunner class
 *
 * Loads and executes visual workflows using the CloudRunner from noodl-viewer-cloud.
 * Workflows are JSON exports from the editor that contain cloud function components.
 */
class WorkflowRunner {
  /**
   * @param {Object} options
   * @param {string} options.workflowsPath - Path to workflows directory
   * @param {Object} options.adapter - LocalSQLAdapter instance for database access
   * @param {boolean} [options.enableDebugInspectors=false] - Enable debug inspectors
   * @param {string} [options.backendId] - Owning backend's ID (WF-006 execution metadata)
   * @param {string} [options.backendName] - Owning backend's display name (WF-006 execution metadata)
   */
  constructor(options) {
    this.workflowsPath = options.workflowsPath;
    this.adapter = options.adapter;
    this.enableDebugInspectors = options.enableDebugInspectors || false;
    this.backendId = options.backendId || null;
    this.backendName = options.backendName || null;

    this.cloudRunner = null;
    this.loadedWorkflows = new Map(); // name -> export data
    this.events = new EventEmitter();
    this.isInitialized = false;
  }

  /**
   * Initialize the CloudRunner instance
   */
  async initialize() {
    if (this.isInitialized) {
      return;
    }

    try {
      // Dynamically import CloudRunner from noodl-viewer-cloud
      // This package may not be available in all builds, so we handle the error gracefully
      const viewerCloudPath = this.findViewerCloudPath();

      if (viewerCloudPath) {
        const { CloudRunner } = require(viewerCloudPath);

        this.cloudRunner = new CloudRunner({
          enableDebugInspectors: this.enableDebugInspectors,
          connectToEditor: false // We're running standalone
        });

        // Inject our adapter into the runtime context
        // This allows workflow nodes to access the database
        this.injectAdapterIntoContext();

        safeLog('CloudRunner initialized');
        this.isInitialized = true;
      } else {
        safeLog('noodl-viewer-cloud not found, workflows disabled');
      }
    } catch (error) {
      safeLog('Failed to initialize CloudRunner:', error.message);
      // Don't throw - workflow support is optional
    }
  }

  /**
   * Find the path to noodl-viewer-cloud package
   */
  findViewerCloudPath() {
    const possiblePaths = [
      // Development: relative path from editor
      path.resolve(__dirname, '..', '..', '..', '..', '..', 'noodl-viewer-cloud', 'src', 'index.ts'),
      // Built: node_modules
      '@noodl/viewer-cloud',
      // Alternative built path
      path.resolve(__dirname, '..', '..', '..', '..', '..', 'noodl-viewer-cloud', 'dist', 'index.js')
    ];

    for (const p of possiblePaths) {
      try {
        require.resolve(p);
        return p;
      } catch (e) {
        // Path not available, try next
      }
    }

    return null;
  }

  /**
   * Inject the LocalSQLAdapter into the CloudRunner context
   * This allows workflow nodes to perform database operations
   */
  injectAdapterIntoContext() {
    if (!this.cloudRunner) return;

    // Access the runtime context and inject our adapter
    // The runtime has a context property that nodes can access
    const runtime = this.cloudRunner.runtime;

    if (runtime && runtime.context) {
      // Add a method to get the local adapter
      runtime.context.getLocalAdapter = () => this.adapter;

      // Also inject into Services if needed
      if (!runtime.Services) {
        runtime.Services = {};
      }
      runtime.Services.LocalBackend = {
        getAdapter: () => this.adapter
      };

      safeLog('Adapter injected into runtime context');
    }
  }

  /**
   * Load all workflows from the workflows directory
   */
  async loadWorkflows() {
    if (!this.cloudRunner) {
      safeLog('CloudRunner not initialized, skipping workflow load');
      return;
    }

    try {
      // Ensure directory exists
      await fs.mkdir(this.workflowsPath, { recursive: true });

      const files = await fs.readdir(this.workflowsPath);
      const workflowFiles = files.filter((f) => f.endsWith('.workflow.json'));

      safeLog(`Found ${workflowFiles.length} workflow files`);

      // Load each workflow
      for (const file of workflowFiles) {
        try {
          const filePath = path.join(this.workflowsPath, file);
          const content = await fs.readFile(filePath, 'utf-8');
          const exportData = JSON.parse(content);

          // Extract workflow name from file (without .workflow.json)
          const workflowName = file.replace('.workflow.json', '');

          // Store for later reference
          this.loadedWorkflows.set(workflowName, exportData);

          // Load into CloudRunner
          await this.cloudRunner.load(exportData);

          safeLog(`Loaded workflow: ${workflowName}`);
        } catch (e) {
          safeLog(`Failed to load workflow ${file}:`, e.message);
        }
      }

      this.events.emit('workflowsLoaded', {
        count: this.loadedWorkflows.size,
        names: Array.from(this.loadedWorkflows.keys())
      });
    } catch (error) {
      if (error.code === 'ENOENT') {
        safeLog('Workflows directory does not exist yet');
      } else {
        safeLog('Error loading workflows:', error.message);
      }
    }
  }

  /**
   * Load or update a single workflow
   * @param {string} name - Workflow name (without .workflow.json extension)
   * @param {Object} exportData - The workflow export data
   */
  async loadWorkflow(name, exportData) {
    if (!this.cloudRunner) {
      return { success: false, error: 'CloudRunner not initialized' };
    }

    try {
      // Save to file
      const filePath = path.join(this.workflowsPath, `${name}.workflow.json`);
      await fs.mkdir(this.workflowsPath, { recursive: true });
      await fs.writeFile(filePath, JSON.stringify(exportData, null, 2));

      // Update in-memory
      this.loadedWorkflows.set(name, exportData);

      // Reload into CloudRunner
      await this.cloudRunner.load(exportData);

      safeLog(`Workflow updated: ${name}`);
      this.events.emit('workflowUpdated', { name });

      return { success: true };
    } catch (error) {
      safeLog(`Failed to update workflow ${name}:`, error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * Delete a workflow
   * @param {string} name - Workflow name
   */
  async deleteWorkflow(name) {
    try {
      const filePath = path.join(this.workflowsPath, `${name}.workflow.json`);
      await fs.unlink(filePath);
      this.loadedWorkflows.delete(name);

      safeLog(`Workflow deleted: ${name}`);
      this.events.emit('workflowDeleted', { name });

      return { success: true };
    } catch (error) {
      safeLog(`Failed to delete workflow ${name}:`, error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * Reload all workflows (hot reload)
   */
  async reloadWorkflows() {
    // Clear existing workflows
    this.loadedWorkflows.clear();

    // Re-initialize CloudRunner
    if (this.cloudRunner) {
      // Create new instance to clear state
      const viewerCloudPath = this.findViewerCloudPath();
      if (viewerCloudPath) {
        const { CloudRunner } = require(viewerCloudPath);
        this.cloudRunner = new CloudRunner({
          enableDebugInspectors: this.enableDebugInspectors,
          connectToEditor: false
        });
        this.injectAdapterIntoContext();
      }
    }

    // Load all workflows again
    await this.loadWorkflows();

    safeLog('Workflows reloaded');
    this.events.emit('workflowsReloaded', {
      count: this.loadedWorkflows.size
    });

    return { success: true, count: this.loadedWorkflows.size };
  }

  /**
   * Execute a workflow/cloud function
   * @param {string} functionName - Name of the function to execute
   * @param {Object} request - Request object with body and headers
   * @returns {Promise<{statusCode: number, body: string}>}
   */
  async run(functionName, request) {
    if (!this.cloudRunner) {
      return {
        statusCode: 501,
        body: JSON.stringify({ error: 'Workflows not enabled (CloudRunner not available)' })
      };
    }

    // Check if we have this function loaded
    if (!this.hasFunction(functionName)) {
      return {
        statusCode: 404,
        body: JSON.stringify({ error: `Function '${functionName}' not found` })
      };
    }

    const startTime = Date.now();

    // WF-006: a fresh logger per run (see ExecutionHistoryManager.ts for why),
    // backed by the one shared store. `createLogger()` returns null if the
    // store never initialized — a missing history entry must never block a
    // real function execution, so every logger call below is guarded.
    const logger = executionHistoryManager.createLogger();
    if (logger) {
      logger.startExecution({
        workflowId: functionName,
        workflowName: functionName,
        triggerType: 'webhook',
        triggerData: scrubRequestForLogging(request || {}),
        metadata: {
          backendId: this.backendId,
          backendName: this.backendName
        }
      });
    }

    try {
      safeLog(`Executing function: ${functionName}`);

      // Execute via CloudRunner
      const response = await this.cloudRunner.run(functionName, request);

      const duration = Date.now() - startTime;
      safeLog(`Function ${functionName} completed in ${duration}ms`);

      const success = response.statusCode >= 200 && response.statusCode < 300;
      if (logger) {
        logger.completeExecution(success, success ? undefined : new Error(`HTTP ${response.statusCode}`));
      }

      // Emit execution event for logging/debugging
      this.events.emit('functionExecuted', {
        functionName,
        duration,
        statusCode: response.statusCode,
        success
      });

      return response;
    } catch (error) {
      const duration = Date.now() - startTime;
      safeLog(`Function ${functionName} failed after ${duration}ms:`, error.message);

      if (logger) {
        logger.completeExecution(false, error);
      }

      this.events.emit('functionExecuted', {
        functionName,
        duration,
        statusCode: 500,
        success: false,
        error: error.message
      });

      return {
        statusCode: 500,
        body: JSON.stringify({ error: error.message })
      };
    }
  }

  /**
   * Check if a function is available
   * @param {string} functionName
   */
  hasFunction(functionName) {
    // CloudRunner looks for components starting with /#__cloud__/
    // Check if any loaded workflow has this component
    for (const [, exportData] of this.loadedWorkflows) {
      if (exportData.components) {
        const fullName = `/#__cloud__/${functionName}`;
        if (exportData.components.some((c) => c.name === fullName)) {
          return true;
        }
      }
    }
    return false;
  }

  /**
   * Get list of available functions
   */
  getAvailableFunctions() {
    const functions = [];

    for (const [workflowName, exportData] of this.loadedWorkflows) {
      if (exportData.components) {
        for (const component of exportData.components) {
          if (component.name.startsWith('/#__cloud__/')) {
            functions.push({
              name: component.name.replace('/#__cloud__/', ''),
              workflow: workflowName
            });
          }
        }
      }
    }

    return functions;
  }

  /**
   * Get status information
   */
  getStatus() {
    return {
      initialized: this.isInitialized,
      cloudRunnerAvailable: !!this.cloudRunner,
      workflowCount: this.loadedWorkflows.size,
      functions: this.getAvailableFunctions()
    };
  }

  /**
   * Subscribe to events
   */
  on(event, handler) {
    this.events.on(event, handler);
  }

  off(event, handler) {
    this.events.off(event, handler);
  }
}

module.exports = { WorkflowRunner };
