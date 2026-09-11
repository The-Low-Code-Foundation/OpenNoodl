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
  DEFAULT_DOC_CAP,
  describeDoc,
  docBody,
  docCap,
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
  parseDocFrontMatter,
  renderDocForPrompt,
  resolveInjection,
  truncateDoc
} from './docsText';
export type {
  DiscoveredDoc,
  DocDescriptor,
  DocFrontMatter,
  DocInjection,
  KnownDoc,
  KnownDocKind,
  ParsedDoc,
  ProjectDocsContent,
  TruncatedDoc
} from './docsText';

export { DOC_TEMPLATES, newDocTemplate } from './templates';

export { DOCS_CHANGED, DocsConflictError, ProjectDocsModel } from './ProjectDocsModel';
export type { DocEntry } from './ProjectDocsModel';

export { DOC_PROPOSALS_CHANGED, DocProposalStore, proposeDocChange } from './DocProposals';
export type { DocProposal } from './DocProposals';

// AIX-011 criterion 7 — the plan transaction's doc write path.
export { createPlanDocWriter } from './PlanDocWriter';

export { currentProjectDocs, setProjectDocsProvider } from './currentDocs';
export type { ProjectDocsProvider } from './currentDocs';

export { currentProjectDocsModel, installProjectDocs } from './install';
