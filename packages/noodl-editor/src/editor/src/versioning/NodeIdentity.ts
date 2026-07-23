/**
 * SUB-007: structural identity matching (design doc §2.2).
 *
 * Used ONLY by the diff engine to present delete+add pairs as a single
 * "recreated" change. The merge engine never calls this — node ids are the
 * sole identity signal for merging (see SUB-007-DESIGN.md for why).
 */

import { deepEqual } from './GraphSnapshot';
import { SnapshotNode } from './types';

export interface StructuralMatch {
  removed: SnapshotNode;
  added: SnapshotNode;
  score: number;
}

const SCORE_THRESHOLD = 0.65;
const PROXIMITY_RADIUS = 150;

function parameterSimilarity(a: SnapshotNode, b: SnapshotNode): number {
  const keysA = Object.keys(a.parameters);
  const keysB = Object.keys(b.parameters);
  if (keysA.length === 0 && keysB.length === 0) return 0.5; // both empty: weak signal
  let matching = 0;
  for (const key of keysA) {
    if (key in b.parameters && deepEqual(a.parameters[key], b.parameters[key])) matching++;
  }
  return matching / Math.max(keysA.length, keysB.length, 1);
}

function scorePair(removed: SnapshotNode, added: SnapshotNode): number {
  let score = 0;
  // Same parent identity (or both roots).
  if ((removed.parent ?? undefined) === (added.parent ?? undefined)) score += 0.3;
  // Label: explicit equal labels are strong; both-unlabeled is weak.
  if (removed.label !== undefined || added.label !== undefined) {
    if (removed.label === added.label) score += 0.25;
  } else {
    score += 0.1;
  }
  score += 0.3 * parameterSimilarity(removed, added);
  // Canvas proximity.
  if (removed.x !== undefined && added.x !== undefined && removed.y !== undefined && added.y !== undefined) {
    const distance = Math.abs(removed.x - added.x) + Math.abs(removed.y - added.y);
    if (distance < PROXIMITY_RADIUS) score += 0.15 * (1 - distance / PROXIMITY_RADIUS);
  }
  return score;
}

/**
 * Greedily match removed nodes to added nodes of the same type.
 * Returns matches with score >= threshold; each node is used at most once.
 */
export function matchRecreatedNodes(removed: SnapshotNode[], added: SnapshotNode[]): StructuralMatch[] {
  const candidates: StructuralMatch[] = [];
  for (const r of removed) {
    for (const a of added) {
      if (r.type !== a.type) continue; // hard gate
      const score = scorePair(r, a);
      if (score >= SCORE_THRESHOLD) candidates.push({ removed: r, added: a, score });
    }
  }
  // Highest score first; ties broken by id for determinism.
  candidates.sort(
    (x, y) => y.score - x.score || (x.removed.id < y.removed.id ? -1 : 1) || (x.added.id < y.added.id ? -1 : 1)
  );
  const usedRemoved = new Set<string>();
  const usedAdded = new Set<string>();
  const matches: StructuralMatch[] = [];
  for (const candidate of candidates) {
    if (usedRemoved.has(candidate.removed.id) || usedAdded.has(candidate.added.id)) continue;
    usedRemoved.add(candidate.removed.id);
    usedAdded.add(candidate.added.id);
    matches.push(candidate);
  }
  return matches;
}
