/**
 * STYLE-001: TokenResolver
 *
 * Resolves CSS custom property references to their actual values.
 * Handles chained references like --space-xs -> var(--space-1) -> 4px
 * Includes caching to avoid repeated resolution on the same token map.
 */

import { StyleTokenRecord } from './TokenCategories';

const VAR_REGEX = /^var\((--[\w-]+)\)$/;
const MAX_DEPTH = 10; // Prevent infinite loops from circular references

export class TokenResolver {
  private cache = new Map<string, string>();
  private tokens: Map<string, StyleTokenRecord>;

  constructor(tokens: Map<string, StyleTokenRecord>) {
    this.tokens = tokens;
  }

  /**
   * Update the token map (e.g. when a token is added/modified).
   * Clears the cache since resolved values may have changed.
   */
  updateTokens(tokens: Map<string, StyleTokenRecord>): void {
    this.tokens = tokens;
    this.invalidate();
  }

  /**
   * Resolve a token name to its final CSS value, following var() references.
   *
   * @example
   * resolver.resolve('--space-xs') // → "4px"  (via var(--space-1) → 4px)
   * resolver.resolve('--primary')  // → "#3b82f6"
   * resolver.resolve('--missing')  // → undefined
   */
  resolve(tokenName: string, depth = 0): string | undefined {
    if (depth > MAX_DEPTH) {
      console.warn(`[TokenResolver] Max reference depth exceeded for "${tokenName}" - possible circular reference`);
      return undefined;
    }

    if (this.cache.has(tokenName)) {
      return this.cache.get(tokenName);
    }

    const token = this.tokens.get(tokenName);
    if (!token) return undefined;

    const resolved = this._resolveValue(token.value, depth);
    if (resolved !== undefined) {
      this.cache.set(tokenName, resolved);
    }
    return resolved;
  }

  /**
   * Resolve a raw value — handles both direct values and var() references.
   */
  private _resolveValue(value: string, depth: number): string | undefined {
    const match = VAR_REGEX.exec(value.trim());
    if (match) {
      // It's a reference — resolve it recursively
      return this.resolve(match[1], depth + 1);
    }
    // Direct value (hex, px, etc.)
    return value;
  }

  /**
   * Check if a value is a var() reference.
   */
  static isReference(value: string): boolean {
    return VAR_REGEX.test(value.trim());
  }

  /**
   * Extract the referenced token name from a var() value.
   * Returns null if not a var() reference.
   */
  static extractReference(value: string): string | null {
    const match = VAR_REGEX.exec(value.trim());
    return match ? match[1] : null;
  }

  /**
   * Invalidate the cache for a specific token (or all tokens).
   */
  invalidate(tokenName?: string): void {
    if (tokenName) {
      this.cache.delete(tokenName);
      // Also invalidate any tokens that reference this one
      for (const [name, token] of this.tokens) {
        const ref = TokenResolver.extractReference(token.value);
        if (ref === tokenName) {
          this.cache.delete(name);
        }
      }
    } else {
      this.cache.clear();
    }
  }

  /**
   * Generate CSS :root { ... } block from the full token map.
   * Resolves semantic tokens that reference palettes inline.
   */
  generateCss(tokens: Map<string, StyleTokenRecord>): string {
    const lines: string[] = [];
    for (const [, token] of tokens) {
      lines.push(`  ${token.name}: ${token.value};`);
    }
    return `:root {\n${lines.join('\n')}\n}`;
  }
}
