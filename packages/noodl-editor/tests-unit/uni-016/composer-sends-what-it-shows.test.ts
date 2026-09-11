/**
 * UNI-016 — the composer posts the string it showed, and keeps the browser route.
 *
 * ───────────────────────────────────────────────────────────────────────────────
 * 🔴 WHAT THIS FILE IS, AND WHAT IT IS NOT. READ BOTH BEFORE COUNTING IT AS EVIDENCE.
 *
 * There is **no DOM in this runner and no React in it** — `base-dialog/measuring-copy.test.ts`
 * establishes both the limitation and the response to it, and this file follows that
 * precedent exactly. This is **not** a rendered dialog, not a click, and not a drive. It reads
 * `AskAboutNodeDialog.tsx` as source and holds the properties the rendered behaviour is a
 * consequence of.
 *
 * ⚠️ **What is therefore NOT proved anywhere:** that clicking the button posts. The payload is
 * graded in `nodeartifact.test.ts`, the transport in `communitywrite.test.ts`, and the
 * platform's end over real HTTP in `uni015-bench-http.test.ts` — but the wire between the
 * button and the client is read, not run. Driving it needs a session token no issuer can mint
 * and a platform that is deployed nowhere. **Recorded as a gap rather than counted as met.**
 *
 * ───────────────────────────────────────────────────────────────────────────────
 * THE TWO PROPERTIES, AND WHY THEY ARE WORTH READING SOURCE FOR
 *
 * 1. 🔴 **THE STRING SHOWN IS THE STRING SENT.** UNI-011 AC2's criterion, and
 *    `nodequestion.ts` states the reasoning three times: *"two paths that agree today are the
 *    arrangement that stops agreeing, and the failure is a user who reviewed one thing and
 *    published another."* Until this task the composer had one consumer — the clipboard — and
 *    the property was nearly free. It now has **two**, and the tempting shape is a POST that
 *    rebuilds a title from the node type, or trims the body, or appends a footer. So: the
 *    `<pre>` renders `question.title`/`question.body`, and the POST must pass those same two
 *    expressions and nothing derived from them.
 *
 * 2. **AC5 — the browser hand-off survives.** *"The signed-out browser hand-off still works,
 *    unchanged — asserted, because the tempting cleanup is to delete it."* Until this session
 *    AC5 was true only trivially, because nothing in the editor had been touched. It is not
 *    trivial any more: this is the commit that adds the thing it would be deleted in favour of.
 *
 * 🔴 Every assertion below is *"this source contains X"*, and a matcher pointed at the wrong
 * region satisfies all of them by finding nothing. So each carries a NEGATIVE CONTROL run over
 * a mutated copy of the real current source — never a pasted snippet, which is the version
 * that goes stale and convicts a file that no longer exists.
 */
import * as fs from 'fs';
import * as path from 'path';

const DIALOG = path.join(
  __dirname,
  '../../src/editor/src/views/DialogLayer/components/AskAboutNodeDialog/AskAboutNodeDialog.tsx'
);

const source = fs.readFileSync(DIALOG, 'utf8');

/** The arguments of the `askQuestion({...})` call, as written. */
function askQuestionCall(text: string): string {
  const start = text.indexOf('client.askQuestion({');
  if (start < 0) return '';
  // Balanced-brace scan from the opening `{` of the argument object. A regex stops at the
  // first `}`, which here is `attachments`' own nesting.
  const open = text.indexOf('{', start);
  let depth = 0;
  for (let i = open; i < text.length; i += 1) {
    if (text[i] === '{') depth += 1;
    if (text[i] === '}') {
      depth -= 1;
      if (depth === 0) return text.slice(open, i + 1);
    }
  }
  return '';
}

/** The `<pre className={css['Payload']}>` block — what the user reads before committing. */
function previewBlock(text: string): string {
  const start = text.indexOf("<pre className={css['Payload']}>");
  if (start < 0) return '';
  const end = text.indexOf('</pre>', start);
  return end < 0 ? '' : text.slice(start, end);
}

describe('property 1 — the string shown is the string sent', () => {
  it('the preview renders question.title and question.body', () => {
    const preview = previewBlock(source);
    expect(preview).toContain('{question.title}');
    expect(preview).toContain('{question.body}');
  });

  it('the POST passes those same two expressions', () => {
    const call = askQuestionCall(source);
    expect(call).not.toBe('');
    expect(call).toContain('title: question.title');
    expect(call).toContain('body: question.body');
  });

  /**
   * 🔴 NEGATIVE CONTROL. Derived from the real current source by the one edit that would
   * actually be made — a title recomposed at the point of posting. The reader above must
   * convict it, or it is matching nothing and would pass on any file.
   */
  it('NEGATIVE CONTROL — a POST that recomposes the title is caught', () => {
    const mutated = source.replace('title: question.title', "title: `${focus.typename} problem`");
    expect(mutated).not.toBe(source);
    expect(askQuestionCall(mutated)).not.toContain('title: question.title');
  });

  it('NEGATIVE CONTROL — a POST that trims or decorates the body is caught', () => {
    const mutated = source.replace('body: question.body', 'body: question.body.trim() + FOOTER');
    expect(mutated).not.toBe(source);
    // ⚠️ `toContain` alone would still match `body: question.body` inside the longer
    // expression, which is exactly the false pass this control exists to expose. The property
    // is that the argument IS the expression, so the match must be anchored to its terminator.
    expect(askQuestionCall(source)).toContain('body: question.body,');
    expect(askQuestionCall(mutated)).not.toContain('body: question.body,');
  });

  /**
   * 🔴 **FB-007 RE-AIMED THIS ROW, AND THE DISTINCTION IT NOW DRAWS IS THE WHOLE PROPERTY.**
   *
   * It used to read `attachments: artifacts` — a literal, which went red the moment the post
   * path gained the upload. The honest question that raised is whether
   * `withCaptureImage(artifacts, uploaded)` is the *"second derivation here"* the row exists to
   * forbid. It is not, and the reason is worth writing down rather than asserting past:
   *
   * - It is **not a rebuild**. `artifacts` is still the single `buildNodeArtifacts` call, and
   *   the transform is a named shared function in the same module, graded in `fb-007/`.
   * - It **cannot touch what was shown**. It adds one field to the capture payload, and that
   *   field is the server's own answer to the upload — a value that did not and could not
   *   exist when the composer drew the preview.
   * - It is **total on null**, so every path with no picture sends byte-identical attachments.
   *
   * ⚠️ The row is therefore tightened rather than loosened. A weaker `toContain('artifacts')`
   * would pass on `attachments: rebuildFrom(artifacts)`, which is precisely the defect — so the
   * expectation is the exact whole expression, with a control proving a rebuild is caught.
   */
  it('the attachments come from the shared builder, not from a second derivation here', () => {
    const call = askQuestionCall(source);
    expect(call).toContain('attachments: withCaptureImage(artifacts, uploaded)');
    // And `artifacts` is `buildNodeArtifacts` over the composed type and the ticked set —
    // `nodeartifact.ts` is where that is graded, and this is the line that routes to it.
    expect(source).toContain('buildNodeArtifacts({ nodeType: question.nodeType');
    // 🔴 Exactly ONE call to the builder. Two would be the rebuild this row forbids, and it is
    // the shape FB-007 could most easily have taken — passing the image ref into a second
    // `buildNodeArtifacts` at post time, which would silently show one payload and send another.
    expect(source.split('buildNodeArtifacts(').length - 1).toBe(1);
  });

  it('NEGATIVE CONTROL — a POST that rebuilds the attachments is caught', () => {
    const mutated = source.replace(
      'attachments: withCaptureImage(artifacts, uploaded)',
      'attachments: buildNodeArtifacts({ nodeType: focus.typename, environment, attachment })'
    );
    expect(mutated).not.toBe(source);
    expect(askQuestionCall(mutated)).not.toContain('attachments: withCaptureImage(artifacts, uploaded)');
    expect(mutated.split('buildNodeArtifacts(').length - 1).toBe(2);
  });
});

describe('property 2 — AC5, the browser hand-off survives', () => {
  it('handOff still copies the composed text and opens the community', () => {
    expect(source).toContain('async function handOff()');
    expect(source).toContain('navigator.clipboard.writeText');
    expect(source).toContain('platform.openExternal(COMMUNITY_URL)');
  });

  it('the hand-off button is rendered unconditionally — it is not inside the signed-in branch', () => {
    // 🔴 The failure this catches is the plausible one: wrapping the existing button in
    // `{!session && ...}` while adding the new one. That reads as tidy and deletes D16's entry
    // point for everybody who IS signed in — including as the escape hatch
    // `describeWriteFailure` explicitly sends them to by name.
    const label = source.indexOf("label={handedOff ? 'Copied — opened in your browser'");
    expect(label).toBeGreaterThan(-1);

    const guard = source.indexOf('{session && (');
    expect(guard).toBeGreaterThan(-1);
    // The signed-in block closes before the hand-off button begins.
    const guardCloses = source.indexOf('            )}', guard);
    expect(guardCloses).toBeGreaterThan(-1);
    expect(guardCloses).toBeLessThan(label);
  });

  it('NEGATIVE CONTROL — deleting the hand-off is caught', () => {
    const mutated = source.replace('platform.openExternal(COMMUNITY_URL)', '// removed');
    expect(mutated).not.toBe(source);
    expect(mutated).not.toContain('platform.openExternal(COMMUNITY_URL)');
  });

  it('the signed-out composer has no POST button to press', () => {
    // `session` is `null` when signed out and `undefined` while the store is being read, and
    // `{session && ...}` renders neither — which is the whole reason the third state exists.
    expect(source).toContain('{session && (');
    expect(source).toContain("useState<CommunitySession | null | undefined>(undefined)");
  });
});

describe('the capture is still written to disk on both routes', () => {
  /**
   * ⚠️ Not a nicety — and **FB-007 CHANGED THE REASON WITHOUT CHANGING THE ROW**, which is why
   * this comment is rewritten rather than the assertion deleted.
   *
   * It used to be that a `capture` attachment carried dimensions and consent and **no image**,
   * because blob storage was owned by no task, so the PNG in the asker's Documents folder was
   * the only copy of the picture that existed. It is not any more: the post path uploads it.
   *
   * 🔴 The count still has to be two, for a reason that is now AC3's. The upload can fail — and
   * *"capture hosting is not configured"* is a **supported state** on any deployment without a
   * bucket, not a fault — and the question posts anyway when it does. The local copy is what
   * that degraded post degrades **to**. Dropping it here would take the fallback away at
   * exactly the moment it is needed, which is a worse version of the bug this row was
   * originally written to prevent.
   */
  it('saveCaptureNextTo is called on the post path as well as the hand-off path', () => {
    const occurrences = source.split('saveCaptureNextTo(capture.data)').length - 1;
    expect(occurrences).toBe(2);
  });
});
