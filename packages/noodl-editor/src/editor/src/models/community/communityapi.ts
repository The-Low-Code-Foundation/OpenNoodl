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
  source: { forum: 'absent' | 'present' };
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

export type ForumState =
  | { forum: 'absent'; reason: string }
  | { forum: 'present'; threads: ForumThread[] };

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

export type ClientOptions = {
  /** Where the platform lives. ⚠️ `community.nodegx.dev` is UNREGISTERED — see UNI-001. */
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
    this.doFetch = options.fetchImpl ?? ((globalThis as { fetch?: typeof fetch }).fetch as typeof fetch);
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
