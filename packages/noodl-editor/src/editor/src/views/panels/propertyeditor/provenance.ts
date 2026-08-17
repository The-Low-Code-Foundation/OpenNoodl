/**
 * CN-006b AC2 — where a node type came from, for the property panel header.
 *
 * ⚠️ **Its own file, and deliberately import-free.** `utils.ts` next door reaches
 * for `NodeGraphContextTmp`, an editor singleton that cannot be constructed under
 * plain-Node jest — putting this beside it made the whole thing ungradeable
 * without a renderer, which for a function whose entire job is a two-branch
 * decision is the wrong trade. Same reasoning `nodeDocs.ts` states for itself.
 */

/** What the header needs to know about where a node type came from. */
export interface NodeProvenance {
  /** The kit's `manifest.json` name. Absent for every built-in. */
  kitName?: string;
  /**
   * The kit author's own sentence about the node, when they wrote one.
   *
   * 🔴 **Prose, never a URL, and never both.** `docs` is one field over two
   * vocabularies: a shipped node's is a docs URL, a kit node's is the sentence
   * from its `ReactNodeDefinition`. Measured on the payload a real viewer sent —
   * both kit types carry prose, and none of the 175 built-ins carries the field
   * at all. This is only ever populated for a kit node, so a caller cannot
   * accidentally put a built-in's URL through a text renderer or the reverse.
   */
  kitDocs?: string;
}

/**
 * Where a node type came from, for the property panel header.
 *
 * A built-in returns `{}` — there is nothing to attribute, and that emptiness is
 * what AC2's "a built-in shows no provenance row" is built on. ⚠️ P1 forbids a
 * *capability* difference, not an attribution: nothing here may gate, warn or
 * demote, and a caller that renders this as anything but a byline has broken the
 * ruling rather than implemented it.
 */
export function getNodeProvenance(model: TSFixme): NodeProvenance {
  const type = model?.type;
  // One guard, not two. `&& type.module` was here as well and mutation showed it
  // could be deleted with every test still green — `!kitName` already rejects the
  // empty string, so the extra clause was a second spelling of the same rule and
  // nothing could ever have graded it.
  const kitName = typeof type?.module === 'string' ? type.module : undefined;
  if (!kitName) return {};

  const docs = typeof type.docs === 'string' ? type.docs.trim() : '';
  return docs ? { kitName, kitDocs: docs } : { kitName };
}
