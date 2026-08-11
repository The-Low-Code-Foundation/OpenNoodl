/**
 * Typed tool failures. Tools catch these and return a structured error payload
 * (with `isError: true`) so the calling agent can react to the `code` rather
 * than parse prose.
 */
export class ToolError extends Error {
  constructor(
    public readonly code:
      | 'not-found'
      | 'already-exists'
      | 'conflict'
      | 'invalid-argument'
      | 'validation-failed'
      | 'not-a-v2-project'
      // BST-001 — this server started with no project directory. Distinct from
      // `not-found`, which means a project was named and is not there: this one
      // means none was ever named, and the fix is a different call entirely.
      | 'no-project'
      | 'read-only'
      | 'no-backend'
      | 'backend-error'
      | 'io-error',
    message: string,
    public readonly data?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'ToolError';
  }
}
