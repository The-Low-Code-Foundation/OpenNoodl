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
