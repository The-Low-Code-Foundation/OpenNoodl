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

import type { NodeDefinitionOptions } from '@noodl/types';

import type { ExtractorInternal, PatternExtractorNodeInstance } from './node-instances';
import { extractPattern } from './stream-parsers';

function internalOf(node: PatternExtractorNodeInstance): ExtractorInternal {
  return node._internal;
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

  initialize(this: PatternExtractorNodeInstance) {
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

  getInspectInfo(this: PatternExtractorNodeInstance) {
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
      description: 'The text to search',
      group: 'Data',
      set(this: PatternExtractorNodeInstance, value: unknown) {
        internalOf(this).text = value === undefined || value === null ? '' : String(value);
      }
    },

    pattern: {
      type: 'string',
      displayName: 'Pattern',
      description: 'A JavaScript regular expression without the surrounding slashes; capture groups appear on Groups',
      group: 'Pattern',
      tooltip: 'A JavaScript regular expression, without the surrounding slashes. Capture groups appear on Groups.',
      set(this: PatternExtractorNodeInstance, value: string) {
        internalOf(this).pattern = value === undefined || value === null ? '' : String(value);
      }
    },

    flags: {
      type: 'string',
      displayName: 'Flags',
      description: 'Regex flags i, m, s, u and y; g is controlled by Extract All and a g written here is ignored',
      group: 'Pattern',
      tooltip:
        'Regex flags: i (ignore case), m (multiline), s (dot matches newline), u (unicode). g is controlled by Extract All.',
      set(this: PatternExtractorNodeInstance, value: string) {
        internalOf(this).flags = value === undefined || value === null ? '' : String(value);
      }
    },

    extractAll: {
      type: 'boolean',
      default: false,
      displayName: 'Extract All',
      description: 'Collects every match into Matches instead of stopping at the first one',
      group: 'Pattern',
      set(this: PatternExtractorNodeInstance, value: boolean) {
        internalOf(this).extractAll = !!value;
      }
    },

    extract: {
      displayName: 'Extract',
      description: 'Runs Pattern over Text and reports what it found',
      group: 'Actions',
      valueChangedToTrue(this: PatternExtractorNodeInstance) {
        this.doExtract();
      }
    }
  },

  outputs: {
    match: {
      type: 'string',
      displayName: 'Match',
      description: 'The first match, or blank when nothing matched',
      group: 'Data',
      get(this: PatternExtractorNodeInstance) {
        return internalOf(this).match === null ? '' : internalOf(this).match;
      }
    },
    matches: {
      type: 'array',
      displayName: 'Matches',
      description: 'Every match when Extract All is on, otherwise just the first',
      group: 'Data',
      get(this: PatternExtractorNodeInstance) {
        return internalOf(this).matches;
      }
    },
    groups: {
      type: 'array',
      displayName: 'Groups',
      description:
        'Capture groups of the first match; an optional group that did not participate is a blank string, not a hole',
      group: 'Data',
      // Capture groups of the first match. An optional group that did not
      // participate becomes an empty string rather than a hole in the array.
      get(this: PatternExtractorNodeInstance) {
        return internalOf(this).groups;
      }
    },
    firstGroup: {
      type: 'string',
      displayName: 'First Group',
      description: 'The first capture group of the first match, which is the whole answer for a pattern like (\\d+)%',
      group: 'Data',
      // Convenience for the common one-group case, e.g. the number in "(\d+)%".
      get(this: PatternExtractorNodeInstance) {
        const groups = internalOf(this).groups;
        return groups.length > 0 ? groups[0] : '';
      }
    },
    namedGroups: {
      type: 'object',
      displayName: 'Named Groups',
      description: 'Named capture groups of the first match, keyed by name',
      group: 'Data',
      get(this: PatternExtractorNodeInstance) {
        return internalOf(this).namedGroups;
      }
    },
    matchCount: {
      type: 'number',
      displayName: 'Match Count',
      description: 'How many matches were found, which is at most one unless Extract All is on',
      group: 'Status',
      get(this: PatternExtractorNodeInstance) {
        return internalOf(this).matches.length;
      }
    },
    error: {
      type: 'string',
      displayName: 'Error',
      description: 'Why the pattern could not be used: it is blank, or it is not a valid regular expression',
      group: 'Status',
      get(this: PatternExtractorNodeInstance) {
        return internalOf(this).error;
      }
    },

    found: {
      type: 'signal',
      displayName: 'Found',
      description: 'Fires when the pattern ran and matched at least once',
      group: 'Events'
    },
    notFound: {
      type: 'signal',
      displayName: 'Not Found',
      description: 'Fires when the pattern ran and matched nothing, which is an ordinary outcome rather than a mistake',
      group: 'Events'
    },
    failure: {
      type: 'signal',
      displayName: 'Failure',
      description: 'Fires when the pattern itself is unusable, which is a bug to fix rather than a result',
      group: 'Events'
    }
  },

  methods: {
    doExtract(this: PatternExtractorNodeInstance) {
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
