/**
 * SUB-007: graph-native diff & merge.
 * Design: dev-docs/tasks/phase-13-format-ai-substrate/SUB-007-DESIGN.md
 */

export * from './types';
export {
  fromLegacyComponent,
  fromV2Files,
  toLegacyComponent,
  toV2Files,
  cloneSnapshot,
  nodesSoftEqual,
  connectionKey,
  deepEqual
} from './GraphSnapshot';
export type { V2ComponentFiles } from './GraphSnapshot';
export { diffGraphs, diffProjectSnapshots, paramDeltas, nodeRef } from './GraphDiff';
export type { DiffOptions } from './GraphDiff';
export { matchRecreatedNodes } from './NodeIdentity';
export { mergeGraphs, mergeProjectSnapshots, applyResolution, resolveAll } from './GraphMerge';
export type { ProjectMergeResult } from './GraphMerge';
export {
  formatChange,
  formatComponentDiff,
  formatConflict,
  catalogDisplayNames,
  nodeName
} from './DiffFormatter';
export type { DisplayNameProvider, FormatOptions } from './DiffFormatter';
