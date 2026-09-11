/**
 * FB-007 — the editor uploads the capture it already takes, and the mirror draws it.
 *
 * > *"Right now in community in the launcher, you can't see the screen capture on the bench
 * > posts, even though it says there is one. Also on the community web page, it has a section
 * > for the screen capture but says 1976 × 626 — image not yet hosted."*
 *
 * ───────────────────────────────────────────────────────────────────────────────
 * 🔴 THE TASK WAS THE 23rd *BUILD THE CALLER*, AND THAT SHAPES WHAT IS WORTH GRADING.
 *
 * Nothing was broken. The platform's E7 half — the object store, the server-issued key, the
 * HMAC grant, the intake, the authenticated image route — was built, driven against the real
 * bucket, and deployed. The editor took the capture and wrote it to the user's Documents
 * folder, because when that code was written there was nowhere to upload to. The two halves
 * had simply never been joined, and the string Richard read is `Attachment.tsx` truthfully
 * reporting an attachment with dimensions and no image.
 *
 * So the interesting properties are all about the JOIN, and three of them are security
 * properties that only exist at this seam:
 *
 *  1. 🔴 **THE EDITOR SENDS ONLY KEYS IT WAS GRANTED (AC2).** The platform mints an HMAC over
 *     `capture-grant:<key>:<accountId>` precisely because the obvious design — *upload returns
 *     a key, the composer puts that key in the payload* — lets anybody put ANY key in a
 *     payload, including one they watched somebody else receive, and the thread would render a
 *     stranger's screenshot under their name. The editor's side of that contract is that a
 *     reference has exactly one origin: {@link CommunityApiClient.uploadCapture}'s answer.
 *  2. 🔴 **A FAILED UPLOAD MUST NOT EAT THE QUESTION (AC3).** *"Capture hosting is not
 *     configured"* is a **supported state**, not a fault — `objectStoreConfig()` returns null on
 *     every deployment without Hetzner keys and the route answers 503. If that swallowed the
 *     post, the feature would be strictly worse than the behaviour it replaced.
 *  3. 🔴 **THE MIRROR'S URL CANNOT BE STEERED BY A PAYLOAD (AC4).** Drawing the image reverses
 *     NAT-008's *"this editor fetches no remote image"* — narrowly, by Richard's ruling of
 *     2026-08-24. What makes the narrow reversal sound is that the host is a compile-time
 *     constant and the path is built from the attachment's **id**, never from the key a sender
 *     supplied. That is a property worth a hostile row, not a comment.
 *
 * ───────────────────────────────────────────────────────────────────────────────
 * ⚠️ WHAT THIS FILE IS NOT. There is no DOM and no React in this runner, so the composer's
 * wiring is read as SOURCE, exactly as `uni-016/composer-sends-what-it-shows.test.ts`
 * established. Every such row carries a NEGATIVE CONTROL over a mutation of the real current
 * source — never a pasted snippet, which goes stale and convicts a file that no longer exists.
 *
 * 🔴 And source-reading is why the end-to-end claim is **driven separately over real HTTP**
 * (AC5, recorded in the task file). A `toContain` passes happily on dead code; session 16's own
 * spec had a row that called a refusal helper directly with the right string and therefore
 * tested that a function returns its argument rather than which argument the route passes.
 * The rule that came out of it — *to test a caller's CHOICE of argument, drive the caller* —
 * is why the rows below grade the three PURE seams by calling them, and read source only for
 * the two facts a pure call cannot reach: that the composer calls the upload at all, and that
 * it does so on the post path only.
 */

import {
  CommunityApiClient,
  type ThreadAttachment
} from '../../src/editor/src/models/community/communityapi';
import {
  withCaptureImage,
  type CaptureImageRef,
  type PostAttachment
} from '../../src/editor/src/models/community/nodeartifact';
import { attachmentImage } from '../../src/editor/src/models/community/threadview';
import { COMMUNITY_URL } from '../../src/editor/src/models/community/communityorigin';

import * as fs from 'fs';
import * as path from 'path';

type Call = { url: string; init: RequestInit };

/** A fetch that records what it was asked and answers what the row wants. */
function fetchStub(reply: { status: number; body?: unknown; throws?: unknown }) {
  const calls: Call[] = [];
  const impl = (async (url: string, init: RequestInit) => {
    calls.push({ url: String(url), init });
    if (reply.throws) throw reply.throws;
    return {
      status: reply.status,
      ok: reply.status >= 200 && reply.status < 300,
      json: async () => reply.body
    } as unknown as Response;
  }) as unknown as typeof fetch;
  return { calls, impl };
}

/** The eight bytes every PNG starts with, base64'd — a real one, so the length is real. */
const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const PNG_B64 = PNG_MAGIC.toString('base64');

const GRANTED: CaptureImageRef = {
  key: 'attachments/captures/abc123',
  grant: 'f00dcafe',
  bytes: 8,
  contentType: 'image/png'
};

function client(impl: typeof fetch, token: string | null = 'tok') {
  return new CommunityApiClient({ baseUrl: 'https://example.test', token, fetchImpl: impl });
}

function captureAttachment(payload: Record<string, unknown>, id = 'att-1'): ThreadAttachment {
  return {
    id,
    kind: 'capture',
    payload,
    note: null,
    facets: { nodeType: null, appVersion: null, os: null, warningCode: null, portsWithheld: 0 }
  };
}

// ─────────────────────────────────────────────────────────────────────────────
describe('AC2 — the upload is the only source of an image reference', () => {
  it('sends the raw PNG bytes to the captures route, not JSON', async () => {
    const { calls, impl } = fetchStub({ status: 200, body: GRANTED });
    const result = await client(impl).uploadCapture(PNG_B64);

    expect(result.outcome).toBe('ok');
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe('https://example.test/api/v1/bench/captures');
    expect((calls[0].init.headers as Record<string, string>)['content-type']).toBe('image/png');

    // 🔴 THE BODY IS THE BYTES. The platform sniffs the magic number rather than trusting the
    // header, so a body that had been JSON.stringify'd — which is what reusing `write()` would
    // have produced — is refused as "not a PNG": a message about the image that would in fact
    // have been about the transport.
    const body = calls[0].init.body as ArrayBuffer;
    expect(body).toBeInstanceOf(ArrayBuffer);
    expect(Buffer.from(new Uint8Array(body))).toEqual(PNG_MAGIC);
  });

  it('🔴 uploads exactly the capture, not the pool it was decoded into', async () => {
    // Node's `Buffer.from(string, 'base64')` returns a view into a SHARED 8 KB pool for small
    // allocations, so `buf.buffer` is a slab holding this capture and whatever else was
    // allocated near it. Uploading that would send the wrong length and other memory with it.
    // This row is what makes the copy in `uploadCapture` load-bearing rather than decorative.
    const { calls, impl } = fetchStub({ status: 200, body: GRANTED });
    await client(impl).uploadCapture(PNG_B64);
    expect((calls[0].init.body as ArrayBuffer).byteLength).toBe(PNG_MAGIC.byteLength);
  });

  it('carries the bearer when there is a token, and none when there is not', async () => {
    const withToken = fetchStub({ status: 200, body: GRANTED });
    await client(withToken.impl, 'tok').uploadCapture(PNG_B64);
    expect((withToken.calls[0].init.headers as Record<string, string>).authorization).toBe('Bearer tok');

    // ⚠️ The control, and it is the reason the row above is worth anything: "no authorization
    // header" and "a header the server rejected" are indistinguishable from the client's side
    // and have opposite fixes.
    const without = fetchStub({ status: 401, body: { error: 'sign in' } });
    await client(without.impl, null).uploadCapture(PNG_B64);
    expect((without.calls[0].init.headers as Record<string, string>).authorization).toBeUndefined();
  });

  it('returns the key AND the grant the platform issued', async () => {
    const { impl } = fetchStub({ status: 200, body: GRANTED });
    const result = await client(impl).uploadCapture(PNG_B64);
    expect(result).toEqual({ outcome: 'ok', value: GRANTED });
  });

  it('🔴 refuses a 200 that answered a key with no grant', async () => {
    // A proxy that dropped the field, or a half-deployed platform. Passing this on would put a
    // grantless reference in the payload and the WHOLE post would be refused with "the image
    // reference needs a key and a grant" — trading the picture for the question.
    const { impl } = fetchStub({ status: 200, body: { key: 'attachments/captures/x', bytes: 8 } });
    const result = await client(impl).uploadCapture(PNG_B64);
    expect(result.outcome).toBe('unreachable');
  });

  it('🔴 never invents a grant when the platform did not send one', async () => {
    // The mutation this guards against is the tempting "fill in a default" tidy-up. There is no
    // value a client could put here that the platform's HMAC would verify, so a defaulted grant
    // is a payload that is refused in full — and it would look, in the source, like robustness.
    const { impl } = fetchStub({ status: 200, body: { key: 'attachments/captures/x', bytes: 8 } });
    const result = await client(impl).uploadCapture(PNG_B64);
    expect(JSON.stringify(result)).not.toContain('grant":"');
  });

  it('a decoded-to-nothing capture is refused before the round trip', async () => {
    const { calls, impl } = fetchStub({ status: 200, body: GRANTED });
    const result = await client(impl).uploadCapture('');
    expect(result.outcome).toBe('unreachable');
    expect(calls).toHaveLength(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('AC2 — the reference lands on the capture attachment and nowhere else', () => {
  const excerpt: PostAttachment = { kind: 'node_excerpt', payload: { nodeType: 'For Each', ports: [] } };
  const capture: PostAttachment = { kind: 'capture', payload: { width: 1976, height: 626, bytes: 8 } };

  it('puts the whole reference on the capture payload', () => {
    const out = withCaptureImage([excerpt, capture], GRANTED);
    expect(out[1].payload.image).toEqual(GRANTED);
  });

  it('🔴 leaves every other kind alone', () => {
    // The platform verifies an image reference on EVERY kind, deliberately — "a graph_fragment
    // has no business carrying an image". An editor that attached one to the excerpt would have
    // its whole post refused rather than quietly dropping the picture.
    const out = withCaptureImage([excerpt, capture], GRANTED);
    expect(out[0].payload.image).toBeUndefined();
  });

  it('is total on the no-image case, which is the common path forever', () => {
    // No capture, an unticked capture, a failed upload, a deployment with no bucket.
    const attachments = [excerpt, capture];
    expect(withCaptureImage(attachments, null)).toBe(attachments);
    expect(withCaptureImage(attachments, undefined)).toBe(attachments);
  });

  it('does not mutate the attachments it was given', () => {
    const attachments = [excerpt, capture];
    withCaptureImage(attachments, GRANTED);
    expect(capture.payload.image).toBeUndefined();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('AC4 — the mirror draws the capture, and cannot be pointed anywhere else', () => {
  it('builds the src from OUR host and the attachment id', () => {
    const image = attachmentImage(captureAttachment({ width: 1976, height: 626, image: { key: 'attachments/captures/k' } }));
    expect(image?.src).toBe(`${COMMUNITY_URL}/api/v1/bench/attachments/att-1/image`);
    expect(image?.width).toBe(1976);
    expect(image?.height).toBe(626);
  });

  it('🔴 HOSTILE — a key naming another host does not steer the fetch', () => {
    // This is the row that makes the narrow NAT-008 reversal defensible. `peopleview.ts`
    // declines `avatarUrl` because it is "a string a STRANGER put on their profile"; the whole
    // argument for drawing a capture is that no payload contributes to the URL. If a sender
    // could put `https://evil.example/x` in `image.key` and have the editor fetch it, this
    // would be avatarUrl again wearing a different name.
    const image = attachmentImage(
      captureAttachment({ width: 10, height: 10, image: { key: 'https://evil.example/x.png' } })
    );
    expect(image?.src).toBe(`${COMMUNITY_URL}/api/v1/bench/attachments/att-1/image`);
    expect(image?.src).not.toContain('evil.example');
  });

  it('🔴 CONTROL — an attachment with no image draws none', () => {
    // Every capture posted before FB-007 shipped is in this state, and it stays a complete
    // attachment that renders its dimensions. Without this row the one above would pass on a
    // function that returned a src unconditionally.
    expect(attachmentImage(captureAttachment({ width: 1976, height: 626 }))).toBeNull();
    expect(attachmentImage(captureAttachment({ width: 1, height: 1, image: {} }))).toBeNull();
    expect(attachmentImage(captureAttachment({ width: 1, height: 1, image: null }))).toBeNull();
  });

  it('🔴 draws nothing for a kind that is not a capture, however furnished its payload', () => {
    const fragment: ThreadAttachment = {
      ...captureAttachment({ width: 1, height: 1, image: { key: 'attachments/captures/k' } }),
      kind: 'graph_fragment'
    };
    expect(attachmentImage(fragment)).toBeNull();
  });

  it('survives dimensions the sender did not send, rather than reserving a nonsense box', () => {
    const image = attachmentImage(captureAttachment({ image: { key: 'attachments/captures/k' } }));
    expect(image).not.toBeNull();
    expect(image?.width).toBeNull();
    expect(image?.height).toBeNull();
  });

  it('carries an alt that says what the picture is', () => {
    const image = attachmentImage(captureAttachment({ image: { key: 'attachments/captures/k' } }));
    expect(image?.alt).toBe('Screen capture attached to this question');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('AC1/AC3 — the composer, read as source', () => {
  const dialogPath = path.join(
    __dirname,
    '../../src/editor/src/views/DialogLayer/components/AskAboutNodeDialog/AskAboutNodeDialog.tsx'
  );
  /**
   * 🔴 COMMENTS STRIPPED, AND THE FIRST DRAFT OF THIS FILE PAID FOR NOT DOING IT. The row below
   * asserting the failure branch contains no `return` went red on the word *"Returning"* inside
   * the comment explaining why there is no return. A prose word is not a code path, and a
   * source-reading spec that cannot tell them apart grades the documentation.
   */
  const stripComments = (text: string) =>
    text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  const source = stripComments(fs.readFileSync(dialogPath, 'utf8'));

  it('CONTROL — the source loaded, and still contains the kind of thing the rows look for', () => {
    // 🔴 Every absence row below is indistinguishable from a pass if the file failed to load or
    // the path silently moved. This is the known-firing signal beside them.
    expect(source.length).toBeGreaterThan(2000);
    expect(source).toContain('async function postToBench');
    expect(source).toContain('async function handOff');
  });

  it('the post path uploads the capture and sends what came back', () => {
    expect(source).toContain('await client.uploadCapture(capture.data)');
    expect(source).toContain('withCaptureImage(artifacts, uploaded)');
  });

  it('NEGATIVE CONTROL — removing the upload is caught', () => {
    const mutated = source.replace('await client.uploadCapture(capture.data)', 'null');
    expect(mutated).not.toBe(source);
    expect(mutated).not.toContain('await client.uploadCapture(capture.data)');
  });

  it('🔴 AC3 — a failed upload does not return early, so the question still posts', () => {
    // The shape this asserts is that the failure branch assigns a SENTENCE and falls through to
    // `askQuestion`. A `return` in that branch is the defect: it would abandon a question
    // somebody had already written, over an attachment, on every deployment without a bucket.
    const failureBranch = source.slice(
      source.indexOf('const upload = await client.uploadCapture'),
      source.indexOf('const result = await client.askQuestion')
    );
    expect(failureBranch).not.toBe('');
    expect(failureBranch).toContain('imageMissed =');
    expect(failureBranch).not.toContain('return');
  });

  it('🔴 AC3 — the learner is told, on the SUCCESS state', () => {
    // "The question posted and the picture did not" is one outcome, not two. Held as a field on
    // `posted` rather than as a `failed` state, which would replace a success with a failure.
    expect(source).toContain("phase: 'posted'");
    expect(source).toContain('imageMissed');
    expect(source).toContain('{postState.imageMissed && <Text');
  });

  it('a refusal is passed through in the platform’s own words', () => {
    expect(source).toContain("upload.outcome === 'refused'");
    expect(source).toContain('${upload.detail}');
  });

  it('🔴 UNI-011 AC3 SURVIVES — the upload is on the post path, never on grab or hand-off', () => {
    // "Nothing leaves the machine before the user posts." `grabCapture` takes the picture and
    // `handOff` copies to the clipboard; an upload in either would send a screenshot of
    // somebody's project before they had decided to publish anything.
    const grab = source.slice(source.indexOf('async function grabCapture'), source.indexOf('async function handOff'));
    const handOff = source.slice(source.indexOf('async function handOff'), source.indexOf('async function beginSignIn'));
    expect(grab).not.toBe('');
    expect(handOff).not.toBe('');
    expect(grab).not.toContain('uploadCapture');
    expect(handOff).not.toContain('uploadCapture');
    expect(source.split('uploadCapture(capture.data)').length - 1).toBe(1);
  });

  it('🔴 the local copy survives on BOTH routes, and the reason has changed', () => {
    // `uni-016/composer-sends-what-it-shows.test.ts` asserts this count too, and used to argue
    // it as "the file on disk is the only copy of the picture there is". That reason is now
    // false. The new one is AC3: the local save is what the degraded post degrades TO, so
    // dropping it takes the fallback away at exactly the moment it is needed.
    expect(source.split('saveCaptureNextTo(capture.data)').length - 1).toBe(2);
  });

  it('🔴 the "drag it into your post" instruction is not given when the image is already in the post', () => {
    // FB-010's lesson, one task later: a sentence that outlived the behaviour it described.
    // Telling somebody to drag a file into a post that already has the image is telling them to
    // do the same thing twice.
    expect(source).toContain('`Capture saved to ${savedTo}.`');
    expect(source).toContain('drag it into your post');
    expect(source).toContain('postState.imageMissed === null');
  });
});
