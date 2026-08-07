/**
 * Per-port help for the connection popup.
 *
 * ALPHA-006 §1: this used to fetch the node's markdown page over HTTP and scrape
 * `##input:<name>##` / `##output:<name>##` marker pairs out of it, keyed on the
 * lower-cased *display* name with a longest-first regexp fallback for wildcard
 * markers. It now reads the enriched catalog that ships in the binary, keyed on
 * the port's canonical `name` — which is what the popup already has in hand, and
 * what the port actually declares.
 *
 * The name survives the rewrite because the call site does; there is no parsing
 * left in it. See `@noodl-utils/nodeDocs` for why the catalog and not a page.
 */

import { getPortDocs, type NodePortDocs } from '@noodl-utils/nodeDocs';

export type { NodePortDocs };

class DocsParser {
  /**
   * Documentation for a node type's ports, keyed by canonical port name.
   *
   * Still takes a callback rather than returning, because the popup's hover
   * handler was written against one and a synchronous read is a strict
   * improvement on an awaited one — the callback simply fires immediately.
   */
  getDocsForType(type: { name?: string } | undefined, cb: (docs: NodePortDocs) => void) {
    cb(getPortDocs(type?.name));
  }

  /** Same lookup, for call sites that would rather just have the value. */
  getDocs(type: { name?: string } | undefined): NodePortDocs {
    return getPortDocs(type?.name);
  }
}

const docsParser = new DocsParser();
export { docsParser };
