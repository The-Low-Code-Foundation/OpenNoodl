/**
 * ProjectScanner
 *
 * Handles detection of project runtime versions and scanning for legacy React patterns
 * that need migration. Uses a 5-tier detection system with confidence levels.
 *
 * @module noodl-editor/models/migration
 * @since 1.2.0
 */

import { filesystem } from '@noodl/platform';

import {
  RuntimeVersionInfo,
  RuntimeVersion,
  LegacyPatternScan,
  LegacyPattern,
  MigrationScan,
  ComponentMigrationInfo,
  MigrationIssue
} from './types';

// =============================================================================
// Constants
// =============================================================================

/**
 * OpenNoodl version number that introduced React 19
 * Projects created with this version or later use React 19
 */
const REACT19_MIN_VERSION = '1.2.0';

/**
 * Date when OpenNoodl fork was created
 * Projects before this date are assumed to be legacy React 17
 */
const OPENNOODL_FORK_DATE = new Date('2024-01-01');

/**
 * Patterns to detect legacy React code that needs migration
 */
const LEGACY_PATTERNS: LegacyPattern[] = [
  {
    regex: /componentWillMount\s*\(/,
    name: 'componentWillMount',
    type: 'componentWillMount',
    description: 'componentWillMount lifecycle method (removed in React 19)',
    autoFixable: false
  },
  {
    regex: /componentWillReceiveProps\s*\(/,
    name: 'componentWillReceiveProps',
    type: 'componentWillReceiveProps',
    description: 'componentWillReceiveProps lifecycle method (removed in React 19)',
    autoFixable: false
  },
  {
    regex: /componentWillUpdate\s*\(/,
    name: 'componentWillUpdate',
    type: 'componentWillUpdate',
    description: 'componentWillUpdate lifecycle method (removed in React 19)',
    autoFixable: false
  },
  {
    regex: /UNSAFE_componentWillMount/,
    name: 'UNSAFE_componentWillMount',
    type: 'unsafeLifecycle',
    description: 'UNSAFE_componentWillMount lifecycle method (removed in React 19)',
    autoFixable: false
  },
  {
    regex: /UNSAFE_componentWillReceiveProps/,
    name: 'UNSAFE_componentWillReceiveProps',
    type: 'unsafeLifecycle',
    description: 'UNSAFE_componentWillReceiveProps lifecycle method (removed in React 19)',
    autoFixable: false
  },
  {
    regex: /UNSAFE_componentWillUpdate/,
    name: 'UNSAFE_componentWillUpdate',
    type: 'unsafeLifecycle',
    description: 'UNSAFE_componentWillUpdate lifecycle method (removed in React 19)',
    autoFixable: false
  },
  {
    regex: /ref\s*=\s*["'][^"']+["']/,
    name: 'String ref',
    type: 'stringRef',
    description: 'String refs are removed in React 19, use createRef() or useRef()',
    autoFixable: true
  },
  {
    regex: /contextTypes\s*=/,
    name: 'Legacy contextTypes',
    type: 'legacyContext',
    description: 'Legacy contextTypes API is removed in React 19',
    autoFixable: false
  },
  {
    regex: /childContextTypes\s*=/,
    name: 'Legacy childContextTypes',
    type: 'legacyContext',
    description: 'Legacy childContextTypes API is removed in React 19',
    autoFixable: false
  },
  {
    regex: /getChildContext\s*\(/,
    name: 'getChildContext',
    type: 'legacyContext',
    description: 'getChildContext method is removed in React 19',
    autoFixable: false
  },
  {
    regex: /React\.createFactory/,
    name: 'createFactory',
    type: 'createFactory',
    description: 'React.createFactory is removed in React 19',
    autoFixable: true
  },
  {
    regex: /ReactDOM\.findDOMNode/,
    name: 'findDOMNode',
    type: 'findDOMNode',
    description: 'ReactDOM.findDOMNode is removed in React 19',
    autoFixable: false
  },
  {
    regex: /ReactDOM\.render\s*\(/,
    name: 'ReactDOM.render',
    type: 'reactDomRender',
    description: 'ReactDOM.render is removed in React 19, use createRoot',
    autoFixable: true
  }
];

// =============================================================================
// Project JSON Types
// =============================================================================

interface ProjectJson {
  name?: string;
  version?: string;
  editorVersion?: string;
  runtimeVersion?: RuntimeVersion;
  migratedFrom?: {
    version: 'react17';
    date: string;
    originalPath: string;
    aiAssisted: boolean;
  };
  createdAt?: string;
  components?: Array<{
    id: string;
    name: string;
    graph?: unknown;
  }>;
  metadata?: Record<string, unknown>;
  settings?: Record<string, unknown>;
}

// =============================================================================
// Version Detection
// =============================================================================

/**
 * Compares two semantic version strings
 * @returns -1 if a < b, 0 if a == b, 1 if a > b
 */
function compareVersions(a: string, b: string): number {
  const partsA = a.split('.').map(Number);
  const partsB = b.split('.').map(Number);

  for (let i = 0; i < Math.max(partsA.length, partsB.length); i++) {
    const numA = partsA[i] || 0;
    const numB = partsB[i] || 0;
    if (numA < numB) return -1;
    if (numA > numB) return 1;
  }
  return 0;
}

/**
 * Reads the project.json file from a project directory
 */
async function readProjectJson(projectPath: string): Promise<ProjectJson | null> {
  try {
    const projectJsonPath = `${projectPath}/project.json`;
    const content = await filesystem.readJson(projectJsonPath);
    return content as ProjectJson;
  } catch (error) {
    console.warn(`Could not read project.json from ${projectPath}:`, error);
    return null;
  }
}

/**
 * Gets the creation date of a project from filesystem metadata
 * Note: The IFileSystem interface doesn't expose birthtime, so this returns null
 * and relies on other detection methods. Could be enhanced in platform-electron.
 */
async function getProjectCreationDate(_projectPath: string): Promise<Date | null> {
  // IFileSystem doesn't have stat or birthtime access
  // This would need platform-specific implementation
  return null;
}

/**
 * Detects the runtime version of a project using a 5-tier detection system.
 *
 * Detection order:
 * 1. Explicit runtimeVersion field in project.json (highest confidence)
 * 2. migratedFrom metadata (indicates already migrated)
 * 3. Editor version number comparison
 * 4. Legacy code pattern scanning
 * 5. Project creation date heuristic (lowest confidence)
 *
 * @param projectPath - Path to the project directory
 * @returns Runtime version info with confidence level
 */
export async function detectRuntimeVersion(projectPath: string): Promise<RuntimeVersionInfo> {
  const indicators: string[] = [];

  // Read project.json
  const projectJson = await readProjectJson(projectPath);

  if (!projectJson) {
    return {
      version: 'unknown',
      confidence: 'low',
      indicators: ['Could not read project.json']
    };
  }

  // ==========================================================================
  // Check 1: Explicit runtimeVersion field (most reliable)
  // ==========================================================================
  if (projectJson.runtimeVersion) {
    return {
      version: projectJson.runtimeVersion,
      confidence: 'high',
      indicators: ['Explicit runtimeVersion field in project.json']
    };
  }

  // ==========================================================================
  // Check 2: Look for migratedFrom field (indicates already migrated)
  // ==========================================================================
  if (projectJson.migratedFrom) {
    return {
      version: 'react19',
      confidence: 'high',
      indicators: ['Project has migratedFrom metadata - already migrated']
    };
  }

  // ==========================================================================
  // Check 3: Check editor version number
  // OpenNoodl 1.2+ = React 19, earlier = React 17
  // ==========================================================================
  const editorVersion = projectJson.editorVersion || projectJson.version;
  if (editorVersion && typeof editorVersion === 'string') {
    // Clean up version string (remove 'v' prefix if present)
    const cleanVersion = editorVersion.replace(/^v/, '');

    // Check if it's a valid semver-like string
    if (/^\d+\.\d+/.test(cleanVersion)) {
      const comparison = compareVersions(cleanVersion, REACT19_MIN_VERSION);

      if (comparison >= 0) {
        indicators.push(`Editor version ${editorVersion} >= ${REACT19_MIN_VERSION}`);
        return {
          version: 'react19',
          confidence: 'high',
          indicators
        };
      } else {
        indicators.push(`Editor version ${editorVersion} < ${REACT19_MIN_VERSION}`);
        return {
          version: 'react17',
          confidence: 'high',
          indicators
        };
      }
    }
  }

  // ==========================================================================
  // Check 4: Heuristic - scan for React 17 specific patterns in custom code
  // ==========================================================================
  const legacyPatterns = await scanForLegacyPatterns(projectPath);
  if (legacyPatterns.found) {
    indicators.push(`Found legacy React patterns: ${legacyPatterns.patterns.join(', ')}`);
    return {
      version: 'react17',
      confidence: 'medium',
      indicators
    };
  }

  // ==========================================================================
  // Check 5: Project creation date heuristic
  // Projects created before OpenNoodl fork are assumed React 17
  // ==========================================================================
  const createdAt = projectJson.createdAt
    ? new Date(projectJson.createdAt)
    : await getProjectCreationDate(projectPath);

  if (createdAt && createdAt < OPENNOODL_FORK_DATE) {
    indicators.push(`Project created ${createdAt.toISOString()} (before OpenNoodl fork)`);
    return {
      version: 'react17',
      confidence: 'medium',
      indicators
    };
  }

  // ==========================================================================
  // Default: Assume React 17 for older projects without explicit markers
  // Any project without runtimeVersion, migratedFrom, or a recent editorVersion
  // is most likely a legacy project from before OpenNoodl
  // ==========================================================================
  return {
    version: 'react17',
    confidence: 'low',
    indicators: ['No React 19 markers found - assuming legacy React 17 project']
  };
}

// =============================================================================
// Legacy Pattern Scanning
// =============================================================================

/**
 * Scans a project directory for legacy React patterns in JavaScript files.
 * Looks for componentWillMount, string refs, legacy context, etc.
 *
 * @param projectPath - Path to the project directory
 * @returns Object containing found patterns and file locations
 */
export async function scanForLegacyPatterns(projectPath: string): Promise<LegacyPatternScan> {
  const result: LegacyPatternScan = {
    found: false,
    patterns: [],
    files: []
  };

  try {
    // List all files in the project directory
    const allFiles = await listFilesRecursively(projectPath);

    // Filter to JS/JSX/TS/TSX files, excluding node_modules
    const jsFiles = allFiles.filter((file) => {
      const isJsFile = /\.(js|jsx|ts|tsx)$/.test(file);
      const isNotNodeModules = !file.includes('node_modules');
      return isJsFile && isNotNodeModules;
    });

    // Scan each file for legacy patterns
    for (const file of jsFiles) {
      try {
        const content = await filesystem.readFile(file);
        const lines = content.split('\n');

        for (const pattern of LEGACY_PATTERNS) {
          lines.forEach((line, index) => {
            if (pattern.regex.test(line)) {
              result.found = true;

              if (!result.patterns.includes(pattern.name)) {
                result.patterns.push(pattern.name);
              }

              result.files.push({
                path: file,
                line: index + 1,
                pattern: pattern.name,
                content: line.trim()
              });
            }
          });
        }
      } catch (readError) {
        // Skip files we can't read
        console.warn(`Could not read file ${file}:`, readError);
      }
    }
  } catch (error) {
    console.error('Error scanning for legacy patterns:', error);
  }

  return result;
}

/**
 * Recursively lists all files in a directory
 */
async function listFilesRecursively(dirPath: string): Promise<string[]> {
  const files: string[] = [];

  try {
    const entries = await filesystem.listDirectory(dirPath);

    for (const entry of entries) {
      if (entry.isDirectory) {
        // Skip node_modules and hidden directories
        if (entry.name.startsWith('.') || entry.name === 'node_modules') {
          continue;
        }
        const subFiles = await listFilesRecursively(entry.fullPath);
        files.push(...subFiles);
      } else {
        files.push(entry.fullPath);
      }
    }
  } catch (error) {
    console.warn(`Could not list directory ${dirPath}:`, error);
  }

  return files;
}

// =============================================================================
// Full Project Scan
// =============================================================================

/**
 * Counter for generating unique issue IDs
 */
let issueIdCounter = 0;

/**
 * Generates a unique issue ID
 */
function generateIssueId(): string {
  return `issue-${Date.now()}-${++issueIdCounter}`;
}

/**
 * Performs a full migration scan of a project.
 * Analyzes all components and JS files for migration needs.
 *
 * @param projectPath - Path to the project directory
 * @param onProgress - Optional callback for progress updates
 * @returns Full migration scan results
 */
export async function scanProjectForMigration(
  projectPath: string,
  onProgress?: (progress: number, currentItem: string, stats: { components: number; nodes: number; jsFiles: number }) => void
): Promise<MigrationScan> {
  const projectJson = await readProjectJson(projectPath);

  const stats = {
    components: 0,
    nodes: 0,
    jsFiles: 0
  };

  const categories: MigrationScan['categories'] = {
    automatic: [],
    simpleFixes: [],
    needsReview: []
  };

  // Count components from project.json
  if (projectJson?.components) {
    stats.components = projectJson.components.length;

    // Count total nodes across all components
    projectJson.components.forEach((component) => {
      if (component.graph && typeof component.graph === 'object') {
        const graph = component.graph as { roots?: Array<{ children?: unknown[] }> };
        if (graph.roots) {
          stats.nodes += countNodesInRoots(graph.roots);
        }
      }
    });
  }

  // Scan JavaScript files for issues
  const allFiles = await listFilesRecursively(projectPath);
  const jsFiles = allFiles.filter(
    (file) => /\.(js|jsx|ts|tsx)$/.test(file) && !file.includes('node_modules')
  );
  stats.jsFiles = jsFiles.length;

  // Group issues by file/component
  const fileIssues: Map<string, MigrationIssue[]> = new Map();

  for (let i = 0; i < jsFiles.length; i++) {
    const file = jsFiles[i];
    const relativePath = file.replace(projectPath, '').replace(/^\//, '');

    onProgress?.((i / jsFiles.length) * 100, relativePath, stats);

    try {
      const content = await filesystem.readFile(file);
      const lines = content.split('\n');
      const issues: MigrationIssue[] = [];

      for (const pattern of LEGACY_PATTERNS) {
        lines.forEach((line, lineIndex) => {
          if (pattern.regex.test(line)) {
            issues.push({
              id: generateIssueId(),
              type: pattern.type,
              description: pattern.description,
              location: {
                file: relativePath,
                line: lineIndex + 1
              },
              autoFixable: pattern.autoFixable,
              fix: pattern.autoFixable
                ? { type: 'automatic', description: `Auto-fix ${pattern.name}` }
                : { type: 'ai-required', description: `AI assistance needed for ${pattern.name}` }
            });
          }
        });
      }

      if (issues.length > 0) {
        fileIssues.set(relativePath, issues);
      }
    } catch {
      // Skip files we can't read
    }
  }

  // Categorize files by issue severity
  for (const [filePath, issues] of fileIssues.entries()) {
    const hasAutoFixableOnly = issues.every((issue) => issue.autoFixable);
    const estimatedCost = estimateAICost(issues.length);

    const componentInfo: ComponentMigrationInfo = {
      id: filePath.replace(/[^a-zA-Z0-9]/g, '-'),
      name: filePath.split('/').pop() || filePath,
      path: filePath,
      issues,
      estimatedCost: hasAutoFixableOnly ? 0 : estimatedCost
    };

    if (hasAutoFixableOnly) {
      categories.simpleFixes.push(componentInfo);
    } else {
      categories.needsReview.push(componentInfo);
    }
  }

  // All components without issues are automatic
  if (projectJson?.components) {
    const filesWithIssues = new Set(fileIssues.keys());

    projectJson.components.forEach((component) => {
      // Check if this component has any JS with issues
      // For now, assume all components without explicit issues are automatic
      const componentPath = component.name.replace(/\//g, '-');

      if (!filesWithIssues.has(componentPath)) {
        categories.automatic.push({
          id: component.id,
          name: component.name,
          path: component.name,
          issues: [],
          estimatedCost: 0
        });
      }
    });
  }

  return {
    completedAt: new Date().toISOString(),
    totalComponents: stats.components,
    totalNodes: stats.nodes,
    customJsFiles: stats.jsFiles,
    categories
  };
}

/**
 * Counts nodes in a graph roots array
 */
function countNodesInRoots(roots: Array<{ children?: unknown[] }>): number {
  let count = 0;

  function countRecursive(nodes: unknown[]): void {
    for (const node of nodes) {
      count++;
      if (node && typeof node === 'object' && 'children' in node) {
        const children = (node as { children?: unknown[] }).children;
        if (Array.isArray(children)) {
          countRecursive(children);
        }
      }
    }
  }

  countRecursive(roots);
  return count;
}

/**
 * Estimates AI cost for migrating issues
 * Based on ~$0.01 per simple issue, ~$0.05 per complex issue
 */
function estimateAICost(issueCount: number): number {
  // Rough estimate: $0.03 per issue on average
  return issueCount * 0.03;
}

// =============================================================================
// Exports
// =============================================================================

export {
  LEGACY_PATTERNS,
  REACT19_MIN_VERSION,
  OPENNOODL_FORK_DATE,
  readProjectJson,
  compareVersions
};

export type { ProjectJson };
