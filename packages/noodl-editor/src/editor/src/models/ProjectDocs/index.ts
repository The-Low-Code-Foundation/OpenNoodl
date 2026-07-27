/**
 * AIX-009 — Project context documents.
 *
 * A project's `docs/` folder: owned by the human, tracked by git, read by the
 * AI before it authors anything, and (via phase 26's ignore mechanism) never
 * shipped to production.
 *
 * NOTE for headless consumers: import `./docsText` or `./currentDocs` directly
 * rather than this barrel — the barrel pulls `ProjectModel` and the platform
 * filesystem, which the authoring measurement bundle cannot have. Same rule as
 * the `StyleTokensModel/StyleVocabulary` submodule.
 *
 * @module ProjectDocs
 */

export {
  assertInsideDocs,
  DocPathError,
  DOCS_DIR,
  DOC_ARCHITECTURE,
  DOC_BRIEF,
  DOC_CAPS,
  DOC_CONVENTIONS,
  DOC_DECISIONS_DIR,
  isKnownDocPath,
  KNOWN_DOCS,
  normalizeDocPath,
  renderDocForPrompt,
  truncateDoc
} from './docsText';
export type { KnownDoc, KnownDocKind, ProjectDocsContent, TruncatedDoc } from './docsText';

export { DOC_TEMPLATES } from './templates';

export { DOCS_CHANGED, DocsConflictError, ProjectDocsModel } from './ProjectDocsModel';
export type { DocEntry } from './ProjectDocsModel';

export { DOC_PROPOSALS_CHANGED, DocProposalStore, proposeDocChange } from './DocProposals';
export type { DocProposal } from './DocProposals';

export { currentProjectDocs, setProjectDocsProvider } from './currentDocs';
export type { ProjectDocsProvider } from './currentDocs';

export { currentProjectDocsModel, installProjectDocs } from './install';
