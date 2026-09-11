/**
 * STYLE-001: Default design tokens for new Noodl projects.
 *
 * 🔴 **The tokens themselves now live in `@nodegx/project-contract/tokens`** (HLS-001). They are
 * read by `@nodegx/export` as well as by the editor, and the exporter cannot reach into the
 * editor's source tree by relative path and still be a package anyone can install. This file is
 * the editor's name for them, so every existing import keeps working, and there is exactly one
 * copy of the vocabulary.
 *
 * Add or change a token in that file, not here.
 */
export { DEFAULT_TOKENS, buildDefaultTokenMap } from '@nodegx/project-contract/tokens';
