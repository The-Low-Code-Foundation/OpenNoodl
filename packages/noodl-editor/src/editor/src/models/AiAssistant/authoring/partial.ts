/**
 * AIX-002 — The Authoring Loop: partial-submission scanner
 *
 * Live canvas rendering needs the forming graph *while* `submit_component`'s
 * arguments are still streaming. Providers hand us the accumulated (invalid,
 * unterminated) JSON text per fragment; this scanner walks it once, character
 * by character, and yields every element of the top-level `"nodes"` and
 * `"connections"` arrays as soon as its closing brace arrives.
 *
 * The scanner is resumable: `update()` consumes only the unread tail, so
 * feeding it fragment-by-fragment costs the same as one pass over the final
 * text, and feeding it char-by-char is spec-asserted to yield exactly the
 * one-shot result. It is also deliberately forgiving — an element that fails
 * `JSON.parse` (a truncation bug, a stray comma) is skipped, never thrown,
 * because a preview must degrade to "fewer nodes shown", not to an error.
 * The validation gate, not this scanner, decides what the submission is worth.
 *
 * @module AiAssistant/authoring/partial
 */

import type { ConnectionV2 } from '../../../schemas';
import type { SubmittedNode } from './types';

export interface PartialPayload {
  /** Complete elements of the `nodes` array, in stream order. */
  nodes: SubmittedNode[];
  /** Complete elements of the `connections` array, in stream order. */
  connections: ConnectionV2[];
}

/** Which top-level arrays the scanner captures elements from. */
type CaptureKey = 'nodes' | 'connections' | null;

export class PartialPayloadScanner {
  private text = '';
  private position = 0;

  // Tokenizer state, persisted across update() calls.
  private inString = false;
  private escaped = false;
  /** Container stack; true = object, false = array. Depth 0 = outside the args object. */
  private readonly stack: boolean[] = [];
  /** The string currently being read, when it might be an object key. */
  private keyBuffer = '';
  /** Whether the current string is in key position of the enclosing object. */
  private readingKey = false;
  /** Whether the next value at depth 1 belongs to a captured array. */
  private pendingCapture: CaptureKey = null;
  /** Non-null while inside a captured array (its stack depth). */
  private captureKey: CaptureKey = null;
  private captureDepth = 0;
  /** Start offset of the element currently being captured, -1 between elements. */
  private elementStart = -1;

  private readonly found: PartialPayload = { nodes: [], connections: [] };

  /**
   * Consume the unread tail of the accumulated arguments text and return the
   * complete payload so far. `argsText` must extend what was passed before —
   * the scanner never re-reads. Returns `changed` when new elements completed.
   */
  update(argsText: string): PartialPayload & { changed: boolean } {
    this.text = argsText;
    const before = this.found.nodes.length + this.found.connections.length;

    while (this.position < this.text.length) {
      const ch = this.text[this.position];

      if (this.inString) {
        if (this.escaped) {
          this.escaped = false;
        } else if (ch === '\\') {
          this.escaped = true;
        } else if (ch === '"') {
          this.inString = false;
          if (this.readingKey) {
            // Only keys of the *root* object can start a captured array.
            this.pendingCapture =
              this.stack.length === 1 && (this.keyBuffer === 'nodes' || this.keyBuffer === 'connections')
                ? (this.keyBuffer as CaptureKey)
                : null;
          }
        } else if (this.readingKey) {
          this.keyBuffer += ch;
        }
        this.position++;
        continue;
      }

      switch (ch) {
        case '"': {
          this.inString = true;
          this.escaped = false;
          // A string opening while its container is an object and no value is
          // pending is a key. Values after ':' clear readingKey below.
          if (this.readingKey) this.keyBuffer = '';
          this.position++;
          continue;
        }
        case ':':
          this.readingKey = false;
          break;
        case ',':
          if (this.stack[this.stack.length - 1] === true) this.readingKey = true;
          break;
        case '{':
        case '[': {
          const isObject = ch === '{';
          this.stack.push(isObject);
          this.readingKey = isObject;
          if (this.pendingCapture && ch === '[') {
            // Entering the captured array itself.
            this.captureKey = this.pendingCapture;
            this.captureDepth = this.stack.length;
            this.pendingCapture = null;
          } else if (this.captureKey && this.stack.length === this.captureDepth + 1 && this.elementStart === -1) {
            // First container of a new element directly inside the captured array.
            this.elementStart = this.position;
          }
          this.pendingCapture = null;
          break;
        }
        case '}':
        case ']': {
          if (this.captureKey && this.elementStart !== -1 && this.stack.length === this.captureDepth + 1) {
            this.captureElement(this.text.slice(this.elementStart, this.position + 1));
            this.elementStart = -1;
          }
          if (this.captureKey && this.stack.length === this.captureDepth && ch === ']') {
            this.captureKey = null;
          }
          this.stack.pop();
          this.readingKey = false;
          break;
        }
        default:
          break;
      }
      this.position++;
    }

    const after = this.found.nodes.length + this.found.connections.length;
    return { nodes: [...this.found.nodes], connections: [...this.found.connections], changed: after > before };
  }

  private captureElement(json: string): void {
    let element: unknown;
    try {
      element = JSON.parse(json);
    } catch {
      return; // Skip, never throw — the gate judges the real submission.
    }
    if (typeof element !== 'object' || element === null) return;

    if (this.captureKey === 'nodes') {
      const node = element as SubmittedNode;
      if (typeof node.type === 'string' && node.type.length > 0) this.found.nodes.push(node);
    } else if (this.captureKey === 'connections') {
      const conn = element as ConnectionV2;
      if (
        typeof conn.fromId === 'string' &&
        typeof conn.fromProperty === 'string' &&
        typeof conn.toId === 'string' &&
        typeof conn.toProperty === 'string'
      ) {
        this.found.connections.push(conn);
      }
    }
  }
}
