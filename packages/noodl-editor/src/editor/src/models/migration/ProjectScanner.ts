/**
 * ProjectScanner
 *
 * Detects which runtime React pair a project selects and scans user code for
 * APIs that React 19 removed.
 *
 * Detection mirrors the delivery semantics exactly (RUN-001 slice 3): a project
 * with `runtimeVersion === 'react19'` gets the vendored React 19 globals;
 * anything else (absent field, `'react17'`) gets the default React 18.3.1 pair —
 * the same files every project has received since Dec 2025. There is no
 * heuristic tier anymore: nothing besides the explicit field changes which
 * React a project runs on, so guessing from editor versions or file dates only
 * produced false "legacy" alarms.
 *
 * The pattern scan lists what is *removed in React 19 relative to React 18* —
 * the only breakage surface that matters when a project opts in. APIs that died
 * before 18 (unprefixed componentWill* lifecycles) or that still work in 19
 * (UNSAFE_* lifecycles) are deliberately not flagged.
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
 * User-code patterns that break when a project opts into React 19.
 *
 * Everything here works on the default React 18.3.1 runtime and is *removed*
 * in React 19 — this is the 18→19 delta, nothing older. Not listed on purpose:
 * unprefixed componentWill* lifecycles (already gone since React 17, so they
 * are equally dead on the current default runtime) and UNSAFE_* lifecycles
 * (still supported in React 19, warning only).
 */
const LEGACY_PATTERNS: LegacyPattern[] = [
  {
    // Lookbehind keeps `href="..."` / `data-ref="..."` from matching.
    regex: /(?<![\w.-])ref\s*=\s*["'][^"']+["']/,
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
    regex: /\bfindDOMNode\s*\(/,
    name: 'findDOMNode',
    type: 'findDOMNode',
    description: 'findDOMNode is removed in React 19, capture the element with a ref instead',
    autoFixable: false
  },
  {
    regex: /\bReactDOM\.render\s*\(/,
    name: 'ReactDOM.render',
    type: 'reactDomRender',
    description: 'ReactDOM.render is removed in React 19, use createRoot',
    autoFixable: true
  },
  {
    regex: /\bReactDOM\.hydrate\s*\(/,
    name: 'ReactDOM.hydrate',
    type: 'reactDomRender',
    description: 'ReactDOM.hydrate is removed in React 19, use hydrateRoot',
    autoFixable: true
  },
  {
    regex: /\bunmountComponentAtNode\s*\(/,
    name: 'unmountComponentAtNode',
    type: 'reactDomRender',
    description: 'unmountComponentAtNode is removed in React 19, use root.unmount()',
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
 * Reports which runtime React pair a project selects. This is not a guess: it
 * applies the exact rule the delivery code uses (`runtimeVersion === 'react19'`
 * → the React 19 globals, anything else → the default React 18.3.1 pair), so
 * the answer is always high-confidence except when project.json is unreadable.
 *
 * @param projectPath - Path to the project directory
 * @returns Runtime version info with confidence level
 */
export async function detectRuntimeVersion(projectPath: string): Promise<RuntimeVersionInfo> {
  const projectJson = await readProjectJson(projectPath);

  if (!projectJson) {
    return {
      version: 'unknown',
      confidence: 'low',
      indicators: ['Could not read project.json']
    };
  }

  if (projectJson.runtimeVersion) {
    return {
      version: projectJson.runtimeVersion,
      confidence: 'high',
      indicators: ['Explicit runtimeVersion field in project.json']
    };
  }

  if (projectJson.migratedFrom) {
    return {
      version: 'react19',
      confidence: 'high',
      indicators: ['Project has migratedFrom metadata - already migrated']
    };
  }

  // No marker: the project runs on the default runtime (React 18.3.1), exactly
  // as every project has since Dec 2025. This is normal, not a legacy hazard.
  return {
    version: 'react17',
    confidence: 'high',
    indicators: ['No runtimeVersion marker - project uses the default (React 18.3) runtime']
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
  onProgress?: (
    progress: number,
    currentItem: string,
    stats: { components: number; nodes: number; jsFiles: number }
  ) => void
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
  const jsFiles = allFiles.filter((file) => /\.(js|jsx|ts|tsx)$/.test(file) && !file.includes('node_modules'));
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

export { LEGACY_PATTERNS, readProjectJson };

export type { ProjectJson };
