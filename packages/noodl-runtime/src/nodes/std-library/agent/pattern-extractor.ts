/**
 * Pattern Extractor node (AGENT-007).
 *
 * Pulls values out of text with a regular expression — the "45" in
 * `Processing... 45% complete`, a tool name out of a status line, a field out of a
 * structured log. Streaming backends emit plenty of text that is not JSON, and the
 * alternative in a visual graph is a Function node, i.e. writing code.
 *
 * A bad pattern is a result, not a throw: `error` and the `notFound`/`failure`
 * signals report it, because a graph has nowhere to catch an exception.
 *
 * @module noodl-runtime
 * @since 2.0.0
 */

import type { NodeDefinitionOptions, NodeInstance } from '@noodl/types';

import { extractPattern } from './stream-parsers';

interface ExtractorInternal {
  text: string;
  pattern: string;
  flags: string;
  extractAll: boolean;
  match: string | null;
  matches: string[];
  groups: string[];
  namedGroups: Record<string, string>;
  error: string;
}

function internalOf(node: NodeInstance): ExtractorInternal {
  return node._internal as unknown as ExtractorInternal;
}

const PatternExtractorNode: NodeDefinitionOptions = {
  name: 'net.noodl.PatternExtractor',
  displayNodeName: 'Pattern Extractor',
  shortDesc: 'Extracts matches and capture groups from text with a regular expression.',
  // 'Data' rather than 'String Manipulation': this exists to serve streams, and the
  // AGENT-007 family is only discoverable if it sits together in the palette.
  category: 'Data',
  color: 'data',
  docs: 'https://docs.noodl.net/nodes/data/pattern-extractor',
  searchTags: ['regex', 'regexp', 'pattern', 'extract', 'match', 'parse', 'capture', 'group', 'stream'],

  initialize(this: NodeInstance) {
    const internal = internalOf(this);
    internal.text = '';
    internal.pattern = '';
    internal.flags = '';
    internal.extractAll = false;
    internal.match = null;
    internal.matches = [];
    internal.groups = [];
    internal.namedGroups = {};
    internal.error = '';
  },

  getInspectInfo(this: NodeInstance) {
    const internal = internalOf(this);
    if (internal.error) return { type: 'text', value: internal.error };
    return {
      type: 'value',
      value: {
        pattern: internal.pattern,
        match: internal.match,
        matches: internal.matches.length,
        groups: internal.groups
      }
    };
  },

  inputs: {
    text: {
      type: 'string',
      displayName: 'Text',
      group: 'Data',
      set(this: NodeInstance, value: unknown) {
        internalOf(this).text = value === undefined || value === null ? '' : String(value);
      }
    },

    pattern: {
      type: 'string',
      displayName: 'Pattern',
      group: 'Pattern',
      tooltip: 'A JavaScript regular expression, without the surrounding slashes. Capture groups appear on Groups.',
      set(this: NodeInstance, value: string) {
        internalOf(this).pattern = value === undefined || value === null ? '' : String(value);
      }
    },

    flags: {
      type: 'string',
      displayName: 'Flags',
      group: 'Pattern',
      tooltip: 'Regex flags: i (ignore case), m (multiline), s (dot matches newline), u (unicode). g is controlled by Extract All.',
      set(this: NodeInstance, value: string) {
        internalOf(this).flags = value === undefined || value === null ? '' : String(value);
      }
    },

    extractAll: {
      type: 'boolean',
      default: false,
      displayName: 'Extract All',
      group: 'Pattern',
      set(this: NodeInstance, value: boolean) {
        internalOf(this).extractAll = !!value;
      }
    },

    extract: {
      displayName: 'Extract',
      group: 'Actions',
      valueChangedToTrue(this: NodeInstance) {
        (this as any).doExtract();
      }
    }
  },

  outputs: {
    match: {
      type: 'string',
      displayName: 'Match',
      group: 'Data',
      get(this: NodeInstance) {
        return internalOf(this).match === null ? '' : internalOf(this).match;
      }
    },
    matches: {
      type: 'array',
      displayName: 'Matches',
      group: 'Data',
      get(this: NodeInstance) {
        return internalOf(this).matches;
      }
    },
    groups: {
      type: 'array',
      displayName: 'Groups',
      group: 'Data',
      // Capture groups of the first match. An optional group that did not
      // participate becomes an empty string rather than a hole in the array.
      get(this: NodeInstance) {
        return internalOf(this).groups;
      }
    },
    firstGroup: {
      type: 'string',
      displayName: 'First Group',
      group: 'Data',
      // Convenience for the common one-group case, e.g. the number in "(\d+)%".
      get(this: NodeInstance) {
        const groups = internalOf(this).groups;
        return groups.length > 0 ? groups[0] : '';
      }
    },
    namedGroups: {
      type: 'object',
      displayName: 'Named Groups',
      group: 'Data',
      get(this: NodeInstance) {
        return internalOf(this).namedGroups;
      }
    },
    matchCount: {
      type: 'number',
      displayName: 'Match Count',
      group: 'Status',
      get(this: NodeInstance) {
        return internalOf(this).matches.length;
      }
    },
    error: {
      type: 'string',
      displayName: 'Error',
      group: 'Status',
      get(this: NodeInstance) {
        return internalOf(this).error;
      }
    },

    found: { type: 'signal', displayName: 'Found', group: 'Events' },
    notFound: { type: 'signal', displayName: 'Not Found', group: 'Events' },
    failure: { type: 'signal', displayName: 'Failure', group: 'Events' }
  },

  methods: {
    doExtract(this: NodeInstance) {
      const internal = internalOf(this);
      const result = extractPattern(internal.text, internal.pattern, {
        all: internal.extractAll,
        flags: internal.flags
      });

      internal.match = result.match;
      internal.matches = result.matches;
      internal.groups = result.groups;
      internal.namedGroups = result.namedGroups;
      internal.error = result.ok ? '' : result.error || 'Invalid pattern';

      this.flagOutputDirty('match');
      this.flagOutputDirty('matches');
      this.flagOutputDirty('groups');
      this.flagOutputDirty('firstGroup');
      this.flagOutputDirty('namedGroups');
      this.flagOutputDirty('matchCount');
      this.flagOutputDirty('error');

      if (!result.ok) {
        // An unusable pattern is distinct from "no match": one is a bug to fix, the
        // other is a normal outcome, and collapsing them hides broken patterns.
        this.sendSignalOnOutput('failure');
        return;
      }
      this.sendSignalOnOutput(result.match === null ? 'notFound' : 'found');
    }
  }
};

export = {
  node: PatternExtractorNode
};
