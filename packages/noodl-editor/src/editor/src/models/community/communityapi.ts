/**
 * UNI-011 — the editor's client for the platform API (`nodegx-community`, `/api/v1`).
 *
 * 🔴 D14 made this a MIRROR, and the load-bearing consequence is negative: **this client
 * decides nothing.** Not who may see the community (D15), not where the entry point goes
 * (D16), not which threads are visible. It transports and it types. D15's ruling says why in
 * terms of this exact file: *"a mirror's natural implementation renders whatever the API
 * returns — so an editor build that decides for itself is one release away from disagreeing
 * with the web."*
 *
 * That is asserted rather than promised. `tests-unit/uni-011/communityapi.test.ts` feeds this
 * client a payload whose `entryPoint` **contradicts its own components** and requires the
 * client to follow the payload: a client that recomputed D16 would say `browser`, and this one
 * says what it was told. Same shape for D15's `absent`.
 *
 * ⚠️ **Editor-outbound only, and there is no socket here on purpose.** README surface 3 and
 * D14 consequence 3: the mirror *pulls* on its own schedule and the platform never connects
 * in. An unread count is a poll result. This module owns no timer — `poll()` takes the clock
 * from its caller — because a module that starts its own interval is one an editor cannot
 * stop without knowing about it.
 */
import type { PostAttachment } from './nodeartifact';
import { parsePostBody, type Block } from './postbody';

// ───────────────────────────────────────────────────────────────────────────────
// The payloads, mirroring `nodegx-community/src/lib` — the API's types, not ours
// ───────────────────────────────────────────────────────────────────────────────

export type Capabilities = Record<string, boolean>;

export type CommunityVisibility =
  | { surface: 'absent'; reason: string }
  | { surface: 'present'; capabilities: Capabilities };

export type MeResponse = {
  viewer: { handle: string; kind: 'individual' | 'org_minor' } | null;
  community: CommunityVisibility;
};

export type ComponentReading<T> = { value: T; required: T; met: boolean };

export type ThresholdResponse = {
  met: boolean;
  entryPoint: 'in-editor-mirror' | 'browser';
  threads: ComponentReading<number>;
  consecutiveWeeksWithCall: ComponentReading<number>;
  medianFirstReply: {
    medianHours: number | null;
    requiredBelowHours: number;
    n: number;
    unreplied: number;
    minimumSample: number;
    met: boolean;
    note?: string;
  };
  /**
   * 🔴 **REMOVED FROM THE PLATFORM BY D19 AND STILL DECLARED HERE UNTIL 2026-08-19.** Optional
   * so the type stops lying about a live route: `src/lib/mirror.ts:123` records the field going
   * with the branch that produced it. ⚠️ Nothing reads it; it is kept optional rather than
   * deleted only so an older platform's payload still parses.
   */
  source?: { forum: 'absent' | 'present' };
};

export type MirrorReplay = {
  slug: string;
  title: string;
  heldOn: string;
  videoUrl: string | null;
  description: string | null;
};

export type MirrorArticle = { slug: string; title: string; summary: string | null; kind: string };

export type CommunityHome = {
  replays: MirrorReplay[];
  articles: MirrorArticle[];
  threshold: ThresholdResponse;
  standing: { points: number; badges: unknown[] } | null;
};

export type ForumThread = {
  id: string;
  externalId: string;
  title: string;
  createdAt: string;
  firstReplyMinutes: number | null;
};

/**
 * 🔴 **THE `{forum: 'absent'}` ARM IS GONE, 2026-08-19, and it was found by driving rather than
 * by reading.**
 *
 * The arm existed because `forum_threads` used to be written only by the Discourse webhook
 * receiver, so an empty table meant *"nobody has bought a forum"* rather than *"nobody has
 * posted"* — two facts that want opposite renderings. **D19 removed the situation**: we own the
 * Bench, an empty Bench is empty, and the platform deleted the branch *and* a spec now asserts
 * it is absent from its source (`src/lib/mirror.ts:45,60`).
 *
 * ⚠️ **This editor went on declaring the union for a day after the platform stopped producing
 * it**, and nothing caught it: a discriminated union whose discriminant never arrives makes
 * every consumer fall into its `else`, which rendered the right thing for the wrong reason. It
 * surfaced only when the live route was curled during the slice-3 drive.
 *
 * 🔴 **This is D15's "the two clients drift" warning, arriving in the type layer rather than the
 * rule layer** — and the type layer has no test that fails, because both sides compile.
 */
export type ForumState = { threads: ForumThread[] };

export type MemberAssignment = {
  id: string;
  orgSlug: string;
  orgName: string;
  title: string;
  instructions: string | null;
  lessonSource: 'curated' | 'org_shelf';
  lessonRef: string;
  dueAt: string | null;
  state: 'in_progress' | 'submitted' | 'graded' | null;
  score: number | null;
  complete: boolean | null;
  feedback: string | null;
};

/**
 * 🔴 A community read is one of three outcomes and `absent` is not an error.
 *
 * A client that modelled the 404 as a failure would retry it, log it, or show a "could not
 * reach the community" banner — and a pupil whose school switched the community off would get
 * an error message about a surface D15 says must not appear to them at all. *Absent means
 * absent* is a property of the client's type, not of its rendering.
 */
export type Read<T> =
  | { outcome: 'ok'; value: T }
  | { outcome: 'absent' }
  | { outcome: 'unreachable'; status: number | null; detail: string };

/**
 * What a write can come back as. 🔴 FIVE outcomes, not three, and see `askQuestion` for why
 * `unauthenticated` and `refused` are not folded into the read's `unreachable`.
 */
export type Write<T> =
  | { outcome: 'ok'; value: T }
  /** No credential, or an expired one. The caller's own fix, and an ordinary fact. */
  | { outcome: 'unauthenticated' }
  /** D15 says this surface does not exist for you. ⚠️ Not an error, and not narrated. */
  | { outcome: 'absent' }
  /** The platform refused the content, in its own words. Safe to show; it chose them. */
  | { outcome: 'refused'; detail: string }
  | { outcome: 'unreachable'; status: number | null; detail: string };

/** `POST /api/v1/bench/threads`, 201. */
export type AskAccepted = { threadId: string; postId: string; pointsAwarded: number };

/** `POST /api/v1/bench/threads/:id/posts`, 201. */
export type AnswerAccepted = { postId: string; pointsAwarded: number };

export type ClientOptions = {
  /**
   * Where the platform lives — `community.nodegx.io`.
   *
   * ⚠️ **`.io`, not `.dev`**: the whole phase said `.dev` until 2026-08-17 and nobody checked it
   * against the registrar. It **resolves** (A → nexus-1, `49.12.102.195`) and **nothing serves it
   * yet** — the platform is deployed nowhere. See UNI-001.
   */
  baseUrl: string;
  /** The session token, when there is one. Reading works without it (D14 consequence 4). */
  token?: string | null;
  /** Injected so the suite needs no network and no editor. */
  fetchImpl?: typeof fetch;
};

export class CommunityApiClient {
  private readonly baseUrl: string;
  private readonly token: string | null;
  private readonly doFetch: typeof fetch;

  constructor(options: ClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/+$/, '');
    this.token = options.token ?? null;
    // 🔴 **`.bind(globalThis)`, AND THE BIND IS THE WHOLE FIX.** A bare `globalThis.fetch`
    // reference loses its receiver, so `this.doFetch(...)` calls it with `this` === the client
    // and the browser throws `TypeError: Failed to execute 'fetch' on 'Window': Illegal
    // invocation`. Every read fails; the panel renders three "could not reach the community"
    // rows against a platform that is up and answering 200.
    //
    // ⚠️ **The precise rule, because "fetch needs a receiver" is not quite it:** WebIDL
    // substitutes the global only when `this` is **undefined**. A bare `fetch(...)` call is
    // therefore fine, and a *method* call on any other object is not — which is why
    // `communitysignin.ts` works untouched: it holds its fetch in a local `const` and calls it
    // bare. Two call shapes, one reference, opposite outcomes.
    //
    // ⚠️ **Unreached by every spec in this repo BY CONSTRUCTION** — they all inject `fetchImpl`,
    // which is the branch that exists so the suite needs no network. The default branch had
    // therefore never executed anywhere: `AskAboutNodeDialog` hands off to the browser rather
    // than posting, so until the community panel this client had **never made a real request**.
    // *Build the caller*, ninth instance in this phase, and the first where the thing with no
    // caller was the transport itself. Found by driving, on 2026-08-19, not by reading.
    const fallbackFetch = (globalThis as { fetch?: typeof fetch }).fetch;
    this.doFetch = options.fetchImpl ?? (fallbackFetch ? fallbackFetch.bind(globalThis) : (fallbackFetch as typeof fetch));
  }

  private async get<T>(path: string): Promise<Read<T>> {
    const headers: Record<string, string> = { accept: 'application/json' };
    // ⚠️ A bearer header rather than a cookie: this is not a browser and has no jar scoped to
    // the platform's origin. The platform accepts both against the same `sessions` row.
    if (this.token) headers.authorization = `Bearer ${this.token}`;

    let response: Response;
    try {
      response = await this.doFetch(`${this.baseUrl}${path}`, { headers, method: 'GET' });
    } catch (err) {
      return { outcome: 'unreachable', status: null, detail: String(err) };
    }

    if (response.status === 404) return { outcome: 'absent' };
    if (!response.ok) {
      return { outcome: 'unreachable', status: response.status, detail: `HTTP ${response.status}` };
    }
    try {
      return { outcome: 'ok', value: (await response.json()) as T };
    } catch (err) {
      return { outcome: 'unreachable', status: response.status, detail: `bad JSON: ${String(err)}` };
    }
  }

  /**
   * UNI-016 — ask a question, with its structure intact.
   *
   * 🔴 THE FIRST WRITE THIS CLIENT HAS EVER MADE, and the header's *"it transports and it
   * types"* still holds: the decisions — what to bucket, which ports to publish, whether a
   * capture is attached — were all made before the payload got here. What is new is only
   * that the payload is a document rather than a string.
   *
   * ⚠️ A write is NOT a `Read<T>` with a different name, and the difference is the 401.
   * `Read`'s three outcomes are `ok | absent | unreachable`, and `absent` means D15 says
   * this surface does not exist for you — a fact about *permission*. Signed-out is a fact
   * about *this attempt*, the caller can fix it, and folding it into `unreachable` would
   * make the composer tell somebody their network was down when they simply are not signed
   * in. Hence {@link Write}, with `unauthenticated` as its own outcome.
   *
   * 🔴 A 404 here stays `absent` and MUST NOT become an error either: `apiviewer.ts` returns
   * the same 404 the read gets when D15 refuses an org-minor, deliberately, so *"a pupil is
   * not told a door exists."* A client that reported "posting failed" would narrate the door.
   */
  askQuestion(input: {
    section: string;
    title: string;
    body: string;
    attachments?: PostAttachment[];
  }): Promise<Write<AskAccepted>> {
    return this.post<AskAccepted>('/api/v1/bench/threads', input);
  }

  /** UNI-016 — answer, on the same terms. An answer may carry a graph of its own. */
  answer(
    threadId: string,
    input: { body: string; attachments?: PostAttachment[] }
  ): Promise<Write<AnswerAccepted>> {
    return this.post<AnswerAccepted>(`/api/v1/bench/threads/${encodeURIComponent(threadId)}/posts`, input);
  }

  /**
   * ⚠️ Not a `get()` with a method parameter. The two differ in more than the verb — a body,
   * a content type, a distinct outcome union and a 401 branch — and threading four
   * conditionals through one function to save a dozen lines is how the read path acquires a
   * bug that only the write path can trigger.
   */
  private async post<T>(path: string, body: unknown): Promise<Write<T>> {
    const headers: Record<string, string> = {
      accept: 'application/json',
      'content-type': 'application/json'
    };
    if (this.token) headers.authorization = `Bearer ${this.token}`;

    let response: Response;
    try {
      response = await this.doFetch(`${this.baseUrl}${path}`, {
        headers,
        method: 'POST',
        body: JSON.stringify(body)
      });
    } catch (err) {
      return { outcome: 'unreachable', status: null, detail: String(err) };
    }

    if (response.status === 401) return { outcome: 'unauthenticated' };
    if (response.status === 404) return { outcome: 'absent' };
    if (response.status === 400 || response.status === 403) {
      // 🔴 The platform's own words, and it chooses them for this. `bench-http.ts` maps every
      // refusal through one table precisely so that a caller *"learns THAT it was refused,
      // and for the rules that are about their own input, enough to fix it"* — while never
      // learning that D15 exists. Substituting our own sentence here would either lose the
      // actionable half or re-invent the half that was withheld on purpose.
      const detail = await response
        .json()
        .then((payload: { error?: string }) => payload?.error ?? `HTTP ${response.status}`)
        .catch(() => `HTTP ${response.status}`);
      return { outcome: 'refused', detail };
    }
    if (!response.ok) {
      return { outcome: 'unreachable', status: response.status, detail: `HTTP ${response.status}` };
    }
    try {
      return { outcome: 'ok', value: (await response.json()) as T };
    } catch (err) {
      return { outcome: 'unreachable', status: response.status, detail: `bad JSON: ${String(err)}` };
    }
  }

  me(): Promise<Read<MeResponse>> {
    return this.get<MeResponse>('/api/v1/me');
  }

  home(): Promise<Read<CommunityHome>> {
    return this.get<CommunityHome>('/api/v1/community/home');
  }

  threads(): Promise<Read<ForumState>> {
    return this.get<ForumState>('/api/v1/community/threads');
  }

  threshold(): Promise<Read<ThresholdResponse>> {
    return this.get<ThresholdResponse>('/api/v1/community/threshold');
  }

  assignments(): Promise<Read<{ assignments: MemberAssignment[] }>> {
    return this.get<{ assignments: MemberAssignment[] }>('/api/v1/me/assignments');
  }
}

/**
 * Where the entry point goes.
 *
 * 🔴 IT READS THE FIELD. There is no arithmetic here, no `>= 30`, and no copy of D16's
 * constants — and the spec proves that by handing it a payload whose components are all unmet
 * while `entryPoint` says `in-editor-mirror`, and requiring the mirror. A client that
 * recomputed would disagree with the web the first time D16 is re-ruled, and D16 says out
 * loud that its numbers are *"a floor, not a target, and cheap to re-rule."*
 *
 * ⚠️ The `unreachable` and `absent` cases both fall back to the browser, and that is D16's
 * own posture rather than a defensive default: *the entry point exists either way and always
 * goes somewhere real.* An editor that cannot reach the platform still has a working link to
 * a website.
 */
/**
 * 🔴 **RETIRED AS A GATE, 2026-08-19 (D21). It is kept, and it is called by nothing.**
 *
 * D16 said the editor surfaces the community only past a threshold and otherwise opens the
 * browser; this function was that decision, in code. **D21 reverses D16** — the community panel
 * ships unconditionally — so there is nothing left for the return value to decide.
 *
 * ⚠️ **It was already called by nothing, and that is the finding rather than a tidy-up note.**
 * On 2026-08-19 the only callers of this function were its own three specs. *Build the caller*,
 * eighth instance in this phase, and the first where the uncalled function was a **ruling's
 * enforcement** — so D16 did not gate the surface, it substituted for building one.
 *
 * ✅ **Not deleted**, deliberately. The specs beneath it prove the client follows the API's
 * `entryPoint` rather than recomputing the threshold, which is D15's rule and is still live: the
 * panel now shows all three components as a **readout**, and a client that recomputed them would
 * disagree with the web the first time the numbers move. Retiring a check needs a higher bar than
 * adding one, and "its ruling was reversed" clears the bar for the *gate*, not for the *parse*.
 */
export function entryPointFor(reading: Read<ThresholdResponse>): 'in-editor-mirror' | 'browser' {
  return reading.outcome === 'ok' ? reading.value.entryPoint : 'browser';
}

/**
 * The composed home, with every stranger-authored body already through the boundary.
 *
 * ⚠️ Today the API's list payloads carry no body at all — deliberately, so nothing has to be
 * sanitised on this path. This function exists for the surface that fetches ONE body, and it
 * is the only door: a view calls this and receives `Block[]`, which has nowhere to put markup.
 */
export function asPostBody(markdown: string | null | undefined): Block[] {
  return parsePostBody(markdown);
}

/**
 * A poll, with the caller owning the clock.
 *
 * Returns a stop function. ⚠️ Nothing in this module calls it — the caller schedules the pull,
 * which is what makes "editor-outbound only" checkable rather than promised: there is no
 * inbound connection to open because there is no connection this module holds.
 */
export function poll<T>(
  read: () => Promise<Read<T>>,
  onResult: (value: Read<T>) => void,
  options: { everyMs: number; setIntervalImpl?: typeof setInterval; clearIntervalImpl?: typeof clearInterval }
): () => void {
  const setIntervalFn = options.setIntervalImpl ?? setInterval;
  const clearIntervalFn = options.clearIntervalImpl ?? clearInterval;
  const handle = setIntervalFn(() => {
    void read().then(onResult);
  }, options.everyMs);
  return () => clearIntervalFn(handle as unknown as Parameters<typeof clearInterval>[0]);
}
