/**
 * UNI-011 AC1, second half — *"no post body is ever rendered as HTML in the editor's own
 * renderer (proved by the chosen boundary's test, not by inspection)."*
 *
 * 🔴 THE CORPUS IS KNOWN-**BAD**, which the task file asks for by name: *"its tests must
 * include a known-bad corpus that the sanitiser is proved to reject, not only a known-good
 * corpus it is proved to pass. Two instruments that never disagree have not been checked."*
 * Every entry is a payload that would execute or exfiltrate if it reached `innerHTML` in a
 * node-integrated renderer.
 *
 * ⚠️ Two things in this file are here because a first draft of it got them wrong, and both
 * are recorded rather than quietly fixed:
 *
 *   1. **The criterion was a substring match**, which flagged an href that could not execute
 *      and would have had me "fix" working code — the fourth amendment's *a gate that rejects
 *      the correct answer is worse than no gate*. It is now the property that actually
 *      matters: **decode the URL the way an HTML parser would, then ask whether it names a
 *      scheme the allow-list refuses.** Both instruments are judged by the same rule, which
 *      is what makes comparing them mean anything.
 *   2. 🔴 **The strip regex contained a literal NUL byte** (`[\0- ]` typed as a raw control
 *      character), which makes git call a `.ts` file BINARY and makes grep skip it. It changed
 *      no verdict, which is exactly why it would have survived. *A measurement instrument has
 *      the same failure modes as the code it measures.*
 */
import { renderMarkdown } from '@noodl-models/lessonformat';
import {
  hrefsIn,
  parseInline,
  parsePostBody,
  type Block,
  type Inline
} from '@noodl-models/community/postbody';

type Case = {
  name: string;
  markdown: string;
  /** `link` payloads try to smuggle a URL; `markup` payloads try to smuggle an element. */
  shape: 'link' | 'markup';
};

const KNOWN_BAD: Case[] = [
  {
    name: 'a javascript: link',
    markdown: 'Try [this fix](javascript:require("child_process").exec("id")) — worked for me.',
    shape: 'link'
  },
  {
    name: 'javascript: split by a control character, which browsers strip',
    markdown: 'Try [this](java\tscript:alert(1)).',
    shape: 'link'
  },
  {
    name: 'uppercase scheme',
    markdown: 'Try [this](JaVaScRiPt:alert(1)).',
    shape: 'link'
  },
  { name: 'vbscript:', markdown: '[legacy](vbscript:msgbox(1))', shape: 'link' },
  {
    name: 'a data: URL carrying html',
    markdown: '[report](data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==)',
    shape: 'link'
  },
  {
    name: 'a file: URL reaching the local disk',
    markdown: '[open](file:///Users/someone/.ssh/id_rsa)',
    shape: 'link'
  },
  {
    name: 'an entity-encoded scheme — the case that found a real hole',
    markdown: '[x](&#106;avascript:alert(1))',
    shape: 'link'
  },
  {
    name: 'a hex entity-encoded scheme',
    markdown: '[x](&#x6a;avascript:alert(1))',
    shape: 'link'
  },
  {
    name: 'a doubly entity-encoded scheme',
    markdown: '[x](&amp;#106;avascript:alert(1))',
    shape: 'link'
  },
  {
    name: 'a bad link nested in a list item — a place a hand-written assertion forgets',
    markdown: '- step one\n- [step two](javascript:alert(1))\n- step three',
    shape: 'link'
  },
  {
    name: 'a bad link inside a heading',
    markdown: '# See [here](javascript:alert(1))',
    shape: 'link'
  },
  {
    name: 'raw script markup in the prose',
    markdown: 'Here is my code: <script>require("fs").readFileSync("/etc/passwd")</script>',
    shape: 'markup'
  },
  {
    name: 'an img with an inline handler',
    markdown: '<img src=x onerror="require(\'child_process\').exec(\'id\')">',
    shape: 'markup'
  },
  {
    name: 'markup that would close a wrapping tag if the output were a string',
    markdown: '</p><script>alert(1)</script><p>',
    shape: 'markup'
  },
  {
    name: 'an iframe pointed at the local filesystem',
    markdown: '<iframe src="file:///etc/passwd"></iframe>',
    shape: 'markup'
  }
];

/** What the allow-list permits. The same three `lessonformat` ships, deliberately not a fork. */
const PERMITTED_SCHEMES = /^(?:https?|mailto):/i;

const NAMED: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", colon: ':' };

function decodeOnce(value: string): string {
  return value
    .replace(/&#x([0-9a-f]+);?/gi, (_m, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);?/g, (_m, dec) => String.fromCodePoint(parseInt(dec, 10)))
    .replace(/&([a-z]+);/gi, (m, name) => NAMED[String(name).toLowerCase()] ?? m);
}

/**
 * 🔴 THE INSTRUMENT, and the one both designs are judged by.
 *
 * A URL is dangerous when — after the control characters a browser strips are removed, and
 * after HTML entity decoding of the kind an HTML parser performs — it names a scheme that is
 * not on the allow-list. A URL with no scheme at all is relative and cannot execute.
 *
 * 🔴 DECODED **ONCE**, and the number of rounds is not a detail — it is the difference
 * between measuring execution and measuring resemblance. An HTML parser decodes an attribute
 * value once, so `&amp;#106;avascript:` becomes `&#106;avascript:`, which names no scheme and
 * cannot execute. A draft of this function decoded to a fixed point *because stricter felt
 * safer*, and it reported three failures against escaped output that was correct — the fourth
 * amendment's *a gate that rejects the correct answer is worse than no gate*, walked into
 * while writing the gate. The refusal in `postbody.ts` may be stricter than reality; the
 * instrument that judges other people's code may not.
 */
function dangerousHrefs(hrefs: string[]): string[] {
  return hrefs.filter((href) => {
    const stripped = Array.from(String(href))
      .filter((ch) => ch.charCodeAt(0) > 0x20)
      .join('');
    const probe = decodeOnce(stripped);
    if (!/^[a-z][a-z0-9+.-]*:/i.test(probe)) return false; // relative
    return !PERMITTED_SCHEMES.test(probe);
  });
}

function everyString(blocks: Block[]): string[] {
  const out: string[] = [];
  const pushInline = (inlines: Inline[]) => {
    for (const inline of inlines) {
      out.push(inline.text);
      if (inline.kind === 'link') out.push(inline.href);
    }
  };
  for (const block of blocks) {
    if (block.kind === 'paragraph' || block.kind === 'heading') pushInline(block.inlines);
    else if (block.kind === 'list') block.items.forEach(pushInline);
    else out.push(block.text);
  }
  return out;
}

describe('UNI-011 — the post-body boundary', () => {
  describe('the known-bad corpus', () => {
    KNOWN_BAD.forEach(({ name, markdown }) => {
      it(`produces no live URL from: ${name}`, () => {
        expect(dangerousHrefs(hrefsIn(parsePostBody(markdown)))).toEqual([]);
      });
    });

    it('the corpus is not vacuous', () => {
      expect(KNOWN_BAD.length).toBeGreaterThanOrEqual(15);
      expect(KNOWN_BAD.filter((c) => c.shape === 'link').length).toBeGreaterThanOrEqual(9);
      expect(KNOWN_BAD.filter((c) => c.shape === 'markup').length).toBeGreaterThanOrEqual(4);

      // Fifteen payloads that all parsed to nothing would satisfy every assertion above.
      const producedNothing = KNOWN_BAD.filter(({ markdown }) => parsePostBody(markdown).length === 0);
      expect(producedNothing.map((c) => c.name)).toEqual([]);
    });
  });

  /**
   * 🔴 THE KNOWN-FIRING CONTROL. The parser somebody writes when they trust the markdown:
   * identical but for keeping the href verbatim. The assertion above must be what catches it.
   */
  it('the instrument DETECTS a parser that keeps the href verbatim', () => {
    const naive = (markdown: string): string[] => {
      const found: string[] = [];
      const re = /\[([^\]]*)\]\(([^)\s]*)\)/g;
      for (let m = re.exec(markdown); m; m = re.exec(markdown)) found.push(m[2]);
      return found;
    };

    const caught = KNOWN_BAD.filter(({ markdown }) => dangerousHrefs(naive(markdown)).length > 0);

    // Not "at least one": a control that fires on a single case leaves the rest untested.
    expect(caught.length).toBeGreaterThanOrEqual(9);
  });

  describe('the payload that survives is text, not markup', () => {
    it('script markup arrives as ordinary text in the model', () => {
      const blocks = parsePostBody('Here: <script>alert(1)</script>');

      // 🔴 The assertion that says why a MODEL is the boundary rather than an escaper. The
      // dangerous characters are still there — as text. A React text child is escaped by the
      // runtime because it is a child, not because anybody remembered to escape it.
      expect(everyString(blocks).join('')).toContain('<script>');
      expect(blocks[0].kind).toBe('paragraph');
    });

    it('no markup payload becomes a link at all', () => {
      for (const { markdown } of KNOWN_BAD.filter((c) => c.shape === 'markup')) {
        expect(hrefsIn(parsePostBody(markdown))).toEqual([]);
      }
    });

    it('no block in the model has a field that could hold markup', () => {
      const blocks = parsePostBody('# Title\n\ntext with [a link](https://example.com)\n\n- a\n- b');
      const keys = new Set<string>();
      const walk = (value: unknown) => {
        if (Array.isArray(value)) value.forEach(walk);
        else if (value && typeof value === 'object') {
          for (const [k, v] of Object.entries(value)) {
            keys.add(k);
            walk(v);
          }
        }
      };
      walk(blocks);

      expect([...keys].sort()).toEqual(['href', 'inlines', 'items', 'kind', 'level', 'ordered', 'text']);
      expect([...keys]).not.toContain('html');
    });
  });

  describe('good markdown still works', () => {
    it('keeps an https link', () => {
      expect(hrefsIn(parsePostBody('[docs](https://nodegx.io/docs)'))).toEqual(['https://nodegx.io/docs']);
    });

    it('keeps a mailto and a relative path', () => {
      expect(hrefsIn(parsePostBody('[mail](mailto:a@b.com) and [rel](/replays)'))).toEqual([
        'mailto:a@b.com',
        '/replays'
      ]);
    });

    it('keeps a query string containing an ampersand entity', () => {
      // ⚠️ The entity-decoding probe must not refuse this. Decoding only decides the SCHEME;
      // the emitted href is still the raw text, because markdown is not HTML.
      expect(hrefsIn(parsePostBody('[q](https://nodegx.io/s?a=1&amp;b=2)'))).toEqual([
        'https://nodegx.io/s?a=1&amp;b=2'
      ]);
    });

    it('a refused link keeps its words', () => {
      const blocks = parsePostBody('Try [this fix](javascript:alert(1)) now.');
      expect(everyString(blocks).join('')).toContain('this fix');
      expect(hrefsIn(blocks)).toEqual([]);
    });

    it('a code span is not re-read as markup', () => {
      const inlines = parseInline('use `**literal asterisks**` here');
      expect(inlines.find((i) => i.kind === 'code')?.text).toBe('**literal asterisks**');
      expect(inlines.some((i) => i.kind === 'strong')).toBe(false);
    });

    it('a fenced block swallows a link without making one', () => {
      const blocks = parsePostBody('```\n[x](javascript:alert(1))\n```');
      expect(blocks[0].kind).toBe('codeblock');
      expect(hrefsIn(blocks)).toEqual([]);
    });

    it('parses headings, lists and paragraphs', () => {
      const blocks = parsePostBody('## Heading\n\npara one\n\n1. first\n2. second');
      expect(blocks.map((b) => b.kind)).toEqual(['heading', 'paragraph', 'list']);
      expect(blocks[2].kind === 'list' && blocks[2].ordered).toBe(true);
    });
  });

  /**
   * ⚠️ MEASURED RATHER THAN ASSERTED, because this file's module header makes a claim about
   * shipped code and a claim about shipped code must not rest on a reading of it.
   *
   * `renderMarkdown` is the lesson renderer whose output reaches `dangerouslySetInnerHTML`,
   * and UNI-011's option B invites reusing it for post bodies. Judged by the same instrument
   * it **holds on every case in the corpus** — it escapes before it substitutes, and its hrefs
   * go through the same allow-list. So this is not a defect report, and calling it one would
   * be the over-claim this phase warns about as loudly as the under-claim.
   *
   * 🔴 What the comparison is for: it makes the difference between the two designs a
   * measurement rather than an opinion. The lesson renderer is safe because two passes run in
   * a particular order; the model is safe because it has nowhere to put markup. The first
   * property is one an edit can remove while every test here still passes — which is why the
   * boundary that ships for stranger-authored bodies is the other one.
   */
  describe('the lesson renderer, measured on the same corpus', () => {
    KNOWN_BAD.forEach(({ name, markdown }) => {
      it(`holds too: ${name}`, () => {
        const html = renderMarkdown(markdown);
        const hrefs = [...html.matchAll(/href="([^"]*)"/g)].map((m) => m[1]);

        expect(dangerousHrefs(hrefs)).toEqual([]);
        // No element from the input survives as an element: everything is escaped text.
        expect(html).not.toMatch(/<(script|img|iframe|svg|object|embed)\b/i);
      });
    });
  });
});
