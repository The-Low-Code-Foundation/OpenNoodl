/**
 * CED-001 (B2) — removing code history from node metadata.
 *
 * Until this task, every save of a Function/Expression/Script/JSON port appended a
 * full copy of the code to `metadata.codeHistory_<parameter>` on the node, capped at
 * 20 copies. Those arrays serialised with the graph, so they bloated `project.json`,
 * churned git on every save, handed the SUB-007 merge driver twenty code blobs per
 * node to reconcile, and shipped to production with the deploy.
 *
 * History now lives in a sidecar file — see {@link CodeHistoryStore}. This strips the
 * keys projects in the wild are already carrying, on the way in from disk, so the
 * next write of the project drops them for good.
 *
 * @module models/CodeHistory
 */

/** Prefix of the metadata keys the old store wrote, one per code parameter. */
export const CODE_HISTORY_METADATA_PREFIX = 'codeHistory_';

/**
 * Node metadata without any legacy `codeHistory_*` entries.
 *
 * Returns the argument untouched when there is nothing to strip, so the overwhelmingly
 * common case — every project saved after this task — allocates nothing.
 */
export function stripCodeHistoryMetadata(
  metadata: Record<string, unknown> | undefined
): Record<string, unknown> | undefined {
  if (!metadata) {
    return undefined;
  }

  const keys = Object.keys(metadata).filter((key) => key.startsWith(CODE_HISTORY_METADATA_PREFIX));
  if (keys.length === 0) {
    return metadata;
  }

  const stripped = { ...metadata };
  for (const key of keys) {
    delete stripped[key];
  }

  // A node whose only metadata was history should not keep an empty object around —
  // that would be a `"metadata": {}` where there used to be no key at all.
  return Object.keys(stripped).length === 0 ? undefined : stripped;
}
