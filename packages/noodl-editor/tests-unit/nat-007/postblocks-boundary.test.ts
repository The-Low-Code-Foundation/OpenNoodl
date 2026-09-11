/**
 * NAT-007 AC3 — the boundary a post body crosses to reach the editor's renderer.
 *
 * ## 🔴 What is on trial here is a CAST that was never written
 *
 * The platform parses markdown at its own boundary and puts `Block[]` on the wire, so the natural
 * client is `payload.blocks as Block[]` and the natural argument is *"it was already sanitised"*.
 * That argument depends on the far side's parser version, on its allow-list agreeing with this
 * one, and on nobody adding a block kind — three properties this editor cannot check at runtime
 * and TypeScript cannot check at all.
 *
 * So `readPostBlocks` validates, and these tests are about what it does with the four payloads a
 * cast would have waved through: a kind this editor cannot draw, an href its own allow-list
 * refuses, an inline shape it does not know, and something that is not a body at all.
 *
 * @module noodl-editor/tests-unit/nat-007/postblocks-boundary
 */
import { readFileSync } from 'fs';
import { join } from 'path';

import { readThreadDetail } from '@noodl-models/community/communityapi';
import { hrefsInPost, parsePostBody, readPostBlocks } from '@noodl-models/community/postbody';

import { stripComments } from '../support/renderElements';

const SRC = join(__dirname, '../../src/editor/src');
const CORE_UI = join(__dirname, '../../../noodl-core-ui/src');

describe('a block kind this editor cannot draw', () => {
  it('becomes a named marker rather than being dropped', () => {
    const blocks = readPostBlocks([
      { kind: 'paragraph', inlines: [{ kind: 'text', text: 'before' }] },
      { kind: 'table', rows: [['a', 'b']] },
      { kind: 'paragraph', inlines: [{ kind: 'text', text: 'after' }] }
    ]);

    // 🔴 THREE blocks, not two. A reader who is shown "before" and "after" with nothing between
    // them is reading a post with a hole in it that neither end can see.
    expect(blocks.map((b) => b.kind)).toEqual(['paragraph', 'unsupported', 'paragraph']);
    expect(blocks[1]).toEqual({ kind: 'unsupported', label: 'table' });
  });

  it('never carries the content it could not draw', () => {
    const blocks = readPostBlocks([{ kind: 'html', raw: '<img src=x onerror=alert(1)>' }]);
    // The marker holds a label and nothing else — a marker that quoted its block would BE the
    // pass-through it exists to replace.
    expect(blocks).toEqual([{ kind: 'unsupported', label: 'html' }]);
    expect(JSON.stringify(blocks)).not.toContain('onerror');
  });

  it('sanitises and caps the label, because the kind is a wire string', () => {
    const blocks = readPostBlocks([
      { kind: '<script>alert(1)</script>' },
      { kind: 'x'.repeat(400) },
      { kind: '' },
      { kind: 42 }
    ]);
    expect(blocks[0]).toEqual({ kind: 'unsupported', label: 'scriptalert1script' });
    expect((blocks[1] as { label: string }).label.length).toBe(40);
    expect(blocks[2]).toEqual({ kind: 'unsupported', label: 'unknown' });
    expect(blocks[3]).toEqual({ kind: 'unsupported', label: '42' });
  });
});

describe('an href, re-checked against this editor’s own allow-list', () => {
  /**
   * 🔴 The known-bad corpus, aimed at the WIRE path rather than the markdown one.
   * `uni-011/postbody.test.ts` already runs these through `parsePostBody`. The point here is that
   * the *other* door — a body the platform parsed — gets the same answer, because a boundary that
   * only guards one of its two entrances is a convention.
   */
  const HOSTILE = [
    'javascript:alert(1)',
    'JaVaScRiPt:alert(1)',
    '&#106;avascript:alert(1)',
    '&#x6a;avascript:alert(1)',
    ' javascript:alert(1)',
    'data:text/html;base64,PHNjcmlwdD4=',
    'vbscript:msgbox(1)'
  ];

  it.each(HOSTILE)('refuses %s and keeps the words', (href) => {
    const blocks = readPostBlocks([
      { kind: 'paragraph', inlines: [{ kind: 'link', text: 'click me', href }] }
    ]);

    expect(hrefsInPost(blocks)).toEqual([]);
    // ⚠️ The label survives as text. Deleting it would leave a hole in somebody's sentence, and
    // `parseInline` already made this choice for the markdown path — one rule, both doors.
    expect(blocks).toEqual([{ kind: 'paragraph', inlines: [{ kind: 'text', text: 'click me' }] }]);
  });

  it('keeps an ordinary link', () => {
    const blocks = readPostBlocks([
      { kind: 'paragraph', inlines: [{ kind: 'link', text: 'the docs', href: 'https://nodegx.io/docs' }] }
    ]);
    expect(hrefsInPost(blocks)).toEqual(['https://nodegx.io/docs']);
  });

  /**
   * 🔴 THE CONTROL. Every assertion above is an absence, and an absence passes just as well when
   * the reader returned nothing at all — a `readPostBlocks` that always answered `[]` would be
   * green on all seven. This one requires the same call to produce something.
   */
  it('control: the refusals above are not a reader that returns nothing', () => {
    const blocks = readPostBlocks([
      { kind: 'paragraph', inlines: [{ kind: 'link', text: 'bad', href: 'javascript:alert(1)' }] },
      { kind: 'paragraph', inlines: [{ kind: 'link', text: 'good', href: 'https://nodegx.io' }] }
    ]);
    expect(blocks).toHaveLength(2);
    expect(hrefsInPost(blocks)).toEqual(['https://nodegx.io']);
  });
});

describe('shapes the wire can produce and the parser cannot', () => {
  it('keeps the words of an inline kind it does not know', () => {
    const blocks = readPostBlocks([
      { kind: 'paragraph', inlines: [{ kind: 'strikethrough', text: 'gone' }] }
    ]);
    // ⚠️ Deliberately NOT an `unsupported` marker: a future `strikethrough` is one sentence
    // rendered without its line through it, which is legible and complete. A missing BLOCK is a
    // missing paragraph. The two rules differ on purpose — see `readInlines`.
    expect(blocks).toEqual([{ kind: 'paragraph', inlines: [{ kind: 'text', text: 'gone' }] }]);
  });

  it('drops an inline with no text to keep', () => {
    const blocks = readPostBlocks([
      { kind: 'paragraph', inlines: [{ kind: 'image', src: 'https://x/y.png' }, { kind: 'text', text: 'ok' }] }
    ]);
    expect(blocks).toEqual([{ kind: 'paragraph', inlines: [{ kind: 'text', text: 'ok' }] }]);
  });

  it('clamps a heading level rather than deleting its words', () => {
    const blocks = readPostBlocks([
      { kind: 'heading', level: 7, inlines: [{ kind: 'text', text: 'deep' }] },
      { kind: 'heading', level: 0, inlines: [{ kind: 'text', text: 'shallow' }] },
      { kind: 'heading', level: 'two', inlines: [{ kind: 'text', text: 'odd' }] }
    ]);
    expect(blocks.map((b) => (b as { level: number }).level)).toEqual([4, 1, 3]);
    expect(blocks.every((b) => b.kind === 'heading')).toBe(true);
  });

  it('answers [] for anything that is not a list of blocks', () => {
    expect(readPostBlocks(null)).toEqual([]);
    expect(readPostBlocks('<p>hi</p>')).toEqual([]);
    expect(readPostBlocks({ blocks: [] })).toEqual([]);
    expect(readPostBlocks([null, 'x', 7])).toEqual([]);
  });

  it('a codeblock with no text is empty, not missing', () => {
    expect(readPostBlocks([{ kind: 'codeblock' }])).toEqual([{ kind: 'codeblock', text: '' }]);
  });

  it('control: the parser’s own output survives the reader unchanged', () => {
    // 🔴 The two halves of the model must agree. If `readPostBlocks` rejected what
    // `parsePostBody` produces, every assertion above would still pass and the editor would
    // render nothing for every real post.
    const parsed = parsePostBody('# Title\n\nSome **bold** and `code`.\n\n- one\n- two\n\n```\nx = 1\n```');
    expect(parsed.length).toBeGreaterThan(0);
    expect(readPostBlocks(JSON.parse(JSON.stringify(parsed)))).toEqual(parsed);
  });
});

describe('a thread payload, validated rather than cast', () => {
  const OK = {
    id: 'abc',
    section: 'help',
    title: 'Why does my For Each render one row?',
    authorHandle: 'rosborne',
    createdAt: '2026-08-16T10:00:00.000Z',
    replyCount: 1,
    accepted: false,
    acceptedPostId: null,
    firstReplyMinutes: 41,
    question: { id: 'p1', authorHandle: 'rosborne', blocks: [], createdAt: '', accepted: false, attachments: [] },
    answers: [{ id: 'p2', authorHandle: 'ada', blocks: [], createdAt: '', accepted: false, attachments: [] }]
  };

  it('reads a whole thread', () => {
    const detail = readThreadDetail(OK);
    expect(detail?.id).toBe('abc');
    expect(detail?.answers.map((a) => a.id)).toEqual(['p2']);
  });

  it('refuses a payload with no readable question', () => {
    // ⚠️ Not "a thread with an empty question" — the platform returns null rather than serve a
    // thread whose opening post moderation hid, so this shape is one we did not understand.
    expect(readThreadDetail({ ...OK, question: null })).toBeNull();
    expect(readThreadDetail({ ...OK, question: { authorHandle: 'x' } })).toBeNull();
    expect(readThreadDetail(null)).toBeNull();
    expect(readThreadDetail('a thread')).toBeNull();
  });

  it('drops an unreadable answer without losing the readable ones', () => {
    const detail = readThreadDetail({ ...OK, answers: [null, OK.answers[0], { authorHandle: 'no id' }] });
    expect(detail?.answers.map((a) => a.id)).toEqual(['p2']);
  });

  it('reads blocks through the boundary, not around it', () => {
    const detail = readThreadDetail({
      ...OK,
      question: { ...OK.question, blocks: [{ kind: 'html', raw: '<script>' }] }
    });
    expect(detail?.question.blocks).toEqual([{ kind: 'unsupported', label: 'html' }]);
  });

  it('keeps Postgres’s own timestamp spelling for the formatters to decide about', () => {
    // The NAT-006 finding: a `Date` column arrives as `2026-08-19 18:58:53.754123+00` on some
    // pooled connections. `communityMeta` already takes both spellings and returns null for
    // neither; normalising here would put a second decision beside that one.
    const detail = readThreadDetail({ ...OK, createdAt: '2026-08-19 18:58:53.754123+00' });
    expect(detail?.createdAt).toBe('2026-08-19 18:58:53.754123+00');
  });

  it('falls back to the number of answers it can see when replyCount is unreadable', () => {
    expect(readThreadDetail({ ...OK, replyCount: 'lots' })?.replyCount).toBe(1);
  });
});

describe('the sink is closed, in every file this task added', () => {
  const FILES = [
    join(SRC, 'models/community/postbody.ts'),
    join(SRC, 'models/community/communityapi.ts'),
    join(SRC, 'models/community/threadview.ts'),
    join(SRC, 'hooks/useCommunityThread.ts'),
    join(SRC, 'views/panels/CommunityPanel/CommunityPanel.tsx'),
    join(CORE_UI, 'components/community/CommunityPostBody.tsx'),
    join(CORE_UI, 'components/community/CommunityThreadView.tsx'),
    join(CORE_UI, 'components/community/postBlocks.ts'),
    join(CORE_UI, 'preview/launcher/Launcher/views/Community.tsx')
  ];

  it.each(FILES)('%s has no dangerouslySetInnerHTML', (file) => {
    // 🔴 COMMENTS STRIPPED. NAT-005's version of this check went red on the sentence "No
    // `dangerouslySetInnerHTML`, ever" in a module note. The dangerous direction is the other
    // one: a file that both uses the construct and documents the prohibition reads identically
    // to a checker that cannot tell prose from code, and the prose is what makes it look
    // reviewed.
    expect(stripComments(readFileSync(file, 'utf8'))).not.toContain('dangerouslySetInnerHTML');
  });

  it('control: the check can see one', () => {
    expect(stripComments('const x = { dangerouslySetInnerHTML: { __html: y } };')).toContain(
      'dangerouslySetInnerHTML'
    );
  });
});
