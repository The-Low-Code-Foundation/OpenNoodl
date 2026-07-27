/**
 * AIX-012 — writing an agreed scope into a freshly created project.
 *
 * The rendering lives in `scope.ts` (pure, shared with the MCP server); this is
 * only the disk half, and it goes through AIX-009's `ProjectDocsModel` rather
 * than touching the filesystem itself. That buys the atomic temp-file writes,
 * the containment check on every path, and — the reason it matters here — the
 * optimistic-concurrency guard: the project is seconds old, but "seconds old"
 * is not "nobody else has it open", and a checkout or a second agent racing
 * this write should lose the write rather than the user's conversation.
 *
 * Failures are collected, not thrown. A user who has just spent five minutes
 * agreeing a scope must not lose the other three documents because one of them
 * could not be written — the caller reports what landed and what did not.
 *
 * @module AiAssistant/scoping/scopeDocs
 */

import type { ProjectDocsModel } from '../../ProjectDocs/ProjectDocsModel';
import type { AuthoringPlan } from '../authoring/plan';
import type { ProjectScope, ScopeTranscriptEntry } from './scope';
import { scopeDocuments } from './scope';

export interface WriteScopeDocsInput {
  scope: ProjectScope;
  transcript: readonly ScopeTranscriptEntry[];
  plan?: AuthoringPlan;
  /** Set when the user ended the conversation before agreeing a scope. */
  abandoned?: boolean;
  /** Injectable so specs can assert exact bytes. */
  at?: string;
}

export interface WriteScopeDocsResult {
  written: string[];
  failed: Array<{ path: string; message: string }>;
}

/**
 * Write BRIEF.md, ARCHITECTURE.md, CONVENTIONS.md and
 * decisions/000-initial-scope.md into a project's `docs/`.
 *
 * Order matters on failure, not on success: the scoping record goes last
 * because it is the largest and the only one that is purely a record. If the
 * disk fills, the three files the authoring loop reads on every turn are the
 * ones already on it.
 */
export async function writeScopeDocs(
  docs: ProjectDocsModel,
  input: WriteScopeDocsInput
): Promise<WriteScopeDocsResult> {
  const documents = scopeDocuments({
    scope: input.scope,
    transcript: input.transcript,
    plan: input.plan,
    abandoned: input.abandoned,
    at: input.at
  });

  const written: string[] = [];
  const failed: Array<{ path: string; message: string }> = [];

  for (const document of documents) {
    try {
      // `read` returns undefined for a file that is not there; `write` wants
      // `null` to mean "I expect this not to exist". For a project created
      // moments ago every one of these is a create, and passing the baseline we
      // actually observed is what makes that an assertion rather than a hope.
      const baseline = (await docs.read(document.path)) ?? null;
      await docs.write(document.path, document.content, { baseline });
      written.push(document.path);
    } catch (error) {
      failed.push({ path: document.path, message: error instanceof Error ? error.message : String(error) });
    }
  }

  return { written, failed };
}
