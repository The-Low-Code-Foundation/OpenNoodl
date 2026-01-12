/**
 * Code Diff Utilities
 *
 * Computes line-based diffs between code snippets for history visualization.
 * Uses a simplified Myers diff algorithm.
 *
 * @module code-editor/utils
 */

export type DiffLineType = 'unchanged' | 'added' | 'removed' | 'modified';

export interface DiffLine {
  type: DiffLineType;
  lineNumber: number;
  content: string;
  oldContent?: string; // For modified lines
  newContent?: string; // For modified lines
}

export interface DiffResult {
  lines: DiffLine[];
  additions: number;
  deletions: number;
  modifications: number;
}

export interface DiffSummary {
  additions: number;
  deletions: number;
  modifications: number;
  description: string;
}

/**
 * Compute a diff between two code snippets
 */
export function computeDiff(oldCode: string, newCode: string): DiffResult {
  const oldLines = oldCode.split('\n');
  const newLines = newCode.split('\n');

  const diff = simpleDiff(oldLines, newLines);

  return {
    lines: diff,
    additions: diff.filter((l) => l.type === 'added').length,
    deletions: diff.filter((l) => l.type === 'removed').length,
    modifications: diff.filter((l) => l.type === 'modified').length
  };
}

/**
 * Get a human-readable summary of changes
 */
export function getDiffSummary(diff: DiffResult): DiffSummary {
  const { additions, deletions, modifications } = diff;

  let description = '';

  const parts: string[] = [];
  if (additions > 0) {
    parts.push(`+${additions} line${additions === 1 ? '' : 's'}`);
  }
  if (deletions > 0) {
    parts.push(`-${deletions} line${deletions === 1 ? '' : 's'}`);
  }
  if (modifications > 0) {
    parts.push(`~${modifications} modified`);
  }

  if (parts.length === 0) {
    description = 'No changes';
  } else if (additions + deletions + modifications > 10) {
    description = 'Major refactor';
  } else if (modifications > additions && modifications > deletions) {
    description = 'Modified: ' + parts.join(', ');
  } else {
    description = 'Changed: ' + parts.join(', ');
  }

  return {
    additions,
    deletions,
    modifications,
    description
  };
}

/**
 * Simplified diff algorithm
 * Uses Longest Common Subsequence (LCS) approach
 */
function simpleDiff(oldLines: string[], newLines: string[]): DiffLine[] {
  const result: DiffLine[] = [];

  // Compute LCS matrix
  const lcs = computeLCS(oldLines, newLines);

  // Backtrack through LCS to build diff (builds in reverse)
  let i = oldLines.length;
  let j = newLines.length;

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && oldLines[i - 1] === newLines[j - 1]) {
      // Lines are identical
      result.unshift({
        type: 'unchanged',
        lineNumber: 0, // Will assign later
        content: oldLines[i - 1]
      });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || lcs[i][j - 1] >= lcs[i - 1][j])) {
      // Line added in new version
      result.unshift({
        type: 'added',
        lineNumber: 0, // Will assign later
        content: newLines[j - 1]
      });
      j--;
    } else if (i > 0 && (j === 0 || lcs[i][j - 1] < lcs[i - 1][j])) {
      // Line removed from old version
      result.unshift({
        type: 'removed',
        lineNumber: 0, // Will assign later
        content: oldLines[i - 1]
      });
      i--;
    }
  }

  // Post-process to detect modifications (adjacent add/remove pairs)
  const processed = detectModifications(result);

  // Assign sequential line numbers (ascending order)
  let lineNumber = 1;
  processed.forEach((line) => {
    line.lineNumber = lineNumber++;
  });

  return processed;
}

/**
 * Detect modified lines (pairs of removed + added lines)
 */
function detectModifications(lines: DiffLine[]): DiffLine[] {
  const result: DiffLine[] = [];

  for (let i = 0; i < lines.length; i++) {
    const current = lines[i];
    const next = lines[i + 1];

    // Check if we have a removed line followed by an added line
    if (current.type === 'removed' && next && next.type === 'added') {
      // This is likely a modification
      const similarity = calculateSimilarity(current.content, next.content);

      // If lines are somewhat similar (>30% similar), treat as modification
      if (similarity > 0.3) {
        result.push({
          type: 'modified',
          lineNumber: current.lineNumber,
          content: next.content,
          oldContent: current.content,
          newContent: next.content
        });
        i++; // Skip next line (we processed it)
        continue;
      }
    }

    result.push(current);
  }

  return result;
}

/**
 * Compute Longest Common Subsequence (LCS) matrix
 */
function computeLCS(a: string[], b: string[]): number[][] {
  const m = a.length;
  const n = b.length;
  const lcs: number[][] = Array(m + 1)
    .fill(null)
    .map(() => Array(n + 1).fill(0));

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) {
        lcs[i][j] = lcs[i - 1][j - 1] + 1;
      } else {
        lcs[i][j] = Math.max(lcs[i - 1][j], lcs[i][j - 1]);
      }
    }
  }

  return lcs;
}

/**
 * Calculate similarity between two strings (0 to 1)
 * Uses simple character overlap metric
 */
function calculateSimilarity(a: string, b: string): number {
  if (a === b) return 1;
  if (a.length === 0 || b.length === 0) return 0;

  // Count matching characters (case insensitive, ignoring whitespace)
  const aNorm = a.toLowerCase().replace(/\s+/g, '');
  const bNorm = b.toLowerCase().replace(/\s+/g, '');

  const shorter = aNorm.length < bNorm.length ? aNorm : bNorm;
  const longer = aNorm.length >= bNorm.length ? aNorm : bNorm;

  let matches = 0;
  for (let i = 0; i < shorter.length; i++) {
    if (longer.includes(shorter[i])) {
      matches++;
    }
  }

  return matches / longer.length;
}

/**
 * Format diff for display - returns context-aware subset of lines
 * Shows changes with 3 lines of context before/after
 */
export function getContextualDiff(diff: DiffResult, contextLines = 3): DiffLine[] {
  const { lines } = diff;

  // Find all changed lines
  const changedIndices = lines
    .map((line, index) => (line.type !== 'unchanged' ? index : -1))
    .filter((index) => index !== -1);

  if (changedIndices.length === 0) {
    // No changes, return first few lines
    return lines.slice(0, Math.min(10, lines.length));
  }

  // Determine ranges to include (changes + context)
  const ranges: Array<[number, number]> = [];
  for (const index of changedIndices) {
    const start = Math.max(0, index - contextLines);
    const end = Math.min(lines.length - 1, index + contextLines);

    // Merge overlapping ranges
    if (ranges.length > 0) {
      const lastRange = ranges[ranges.length - 1];
      if (start <= lastRange[1] + 1) {
        lastRange[1] = Math.max(lastRange[1], end);
        continue;
      }
    }

    ranges.push([start, end]);
  }

  // Extract lines from ranges
  const result: DiffLine[] = [];
  for (let i = 0; i < ranges.length; i++) {
    const [start, end] = ranges[i];

    // Add separator if not first range
    if (i > 0 && start - ranges[i - 1][1] > 1) {
      result.push({
        type: 'unchanged',
        lineNumber: -1,
        content: '...'
      });
    }

    result.push(...lines.slice(start, end + 1));
  }

  return result;
}
