/**
 * TUT-001 — which backends the panel shows, and which go behind the finder.
 *
 * The Backend Services panel rendered every backend on the machine, flat, forever. A machine that
 * has run ten AI-built projects and five tutorials showed fifteen cards, of which one mattered —
 * and phase 73 adds a database per tutorial on top of that, so the list only gets worse.
 *
 * This module is the whole rule, and it is **presentation only**. It adds no persistence and no
 * new field: every fact it reads is already computed by the panel or already stored on the
 * backend metadata. Nothing here touches `findReusableBackend`, ownership, or provisioning.
 *
 * ## Why it is a separate, pure module
 *
 * The panel calls hooks, so it cannot be evaluated by `tests-unit`'s runner. A rule that lives in
 * the render is a rule that can only be graded by reading the source as text — blind to a rename,
 * and unable to tell a filter that excludes the right rows from one that returns everything. The
 * partition is a plain function of plain data, so the fixture can carry fifteen backends and the
 * assertion can be a count.
 *
 * ## 🔴 The two shapes of `createdAt`, which are not the same shape
 *
 * `LocalBackendMetadata.createdAt` is an **ISO8601 string** (`BackendManager.js`) and
 * `BackendConfig.createdAt` is typed **`Date`**. Both arrive here, and a `Date`-typed field is not
 * reliably a `Date` at runtime either — the platform paid for the inverse of this assumption in
 * NAT-006, where a `Date`-typed column came back as a raw string on some pooled connections. So
 * every read of it goes through {@link toEpoch}, which takes either and answers `null` for
 * anything it cannot place, and no comparison in this file assumes a method exists.
 *
 * @module BackendServicesPanel/backendVisibility
 * @since 1.2.0
 */

/** Which of the panel's two card shapes draws this backend. */
export type BackendKind = 'local' | 'external';

/**
 * One backend, reduced to the facts the visibility rule needs.
 *
 * The panel builds these from `LocalBackendInfo` and `BackendConfig`; nothing here knows about
 * either type, which is what keeps the rule gradeable without the editor around it.
 */
export interface VisibilityCandidate {
  id: string;
  name: string;
  kind: BackendKind;
  /** ISO8601 string (local) or `Date` (external). Read only through {@link toEpoch}. */
  createdAt?: string | Date | null;
  /** Local backends only — whether the process is up right now. */
  running?: boolean;
  /**
   * Projects that own this backend, stamped at creation (AAQ-002/F4).
   *
   * 🔴 **Empty is the common case, not an edge case**: every backend made by hand in this panel,
   * and every backend created before that stamp existed, has none. An empty list means *owned by
   * nobody*, and {@link partitionBackends} deliberately refuses to promote such a backend into the
   * attached position — the same reason `findReusableBackend` stopped matching on name alone.
   */
  projectIds?: string[];
  /** Names of known local projects pointing here. Advisory; drives the finder's project filter. */
  projectNames?: string[];
}

export interface VisibilityInput {
  candidates: VisibilityCandidate[];
  /** The project's one converged active backend id. May name the endpoint, which is no card. */
  activeBackendId?: string;
  /** The local backend the project's endpoint resolves to, when it resolves to one of ours. */
  boundLocalBackendId?: string;
  /** The open project's id, matched against `projectIds` for "previously attached". */
  openProjectId?: string;
  /**
   * A backend created in this panel a moment ago, which nothing else can vouch for yet.
   *
   * 🔴 Without this, making a backend by hand would file it straight into the finder: it is not
   * the endpoint (nothing points at it until it is started), it is not active, and its
   * `projectIds` is empty because a hand-made backend is owned by nobody. The user would press
   * Create and watch their backend fail to appear.
   *
   * This is **panel state, not ownership** — it lives for as long as the panel is mounted and is
   * written nowhere. Stamping `projectIds` instead would be the ownership change this task is
   * explicitly not making, and it would feed `findReusableBackend` a claim the user never made.
   *
   * 🔴 **It is the LOWEST tier, not the highest, and that ordering is the whole correctness of the
   * summary line.** Ranked first, creating a backend while the project is bound to another would
   * draw the new one and hide the bound one — and the line above it would read *"1 attached"* about
   * a backend nothing is attached to, while the backend the running app actually talks to sat in
   * the finder. Ranked last, it only ever fills an empty attached slot, which is the case that
   * matters (a fresh project, or a new tutorial) and the only one in which it cannot lie. When
   * something IS already attached, the new backend is simply the newest row at the top of the
   * finder, which the summary line points at.
   */
  justCreatedBackendId?: string;
}

export interface VisibilitySummary {
  /** 0 or 1 — see {@link BackendVisibility.attached}. */
  attachedCount: number;
  otherCount: number;
  /** How many of the hidden ones are running. This is the number R1 turns on. */
  otherRunningCount: number;
}

export interface BackendVisibility {
  /**
   * The one backend that gets a card in the panel, or none.
   *
   * At most one, always: "the one that's currently attached or was previously attached" is a
   * single answer, and two cards claiming it is the defect BCN-009 step 2 already fixed once.
   */
  attached: VisibilityCandidate[];
  /** Everything else, newest first. Reachable only through the finder. */
  others: VisibilityCandidate[];
  summary: VisibilitySummary;
}

/**
 * Epoch milliseconds for either shape of `createdAt`, or `null` when there is no usable date.
 *
 * `null` is a real answer and callers must handle it: an external backend deserialized from
 * project metadata can arrive with no date at all, and treating "unknown" as epoch 0 would sort it
 * to the bottom silently and — worse — make it pass a "created before X" filter it was never
 * measured against.
 */
export function toEpoch(value: string | Date | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  const ms = value instanceof Date ? value.getTime() : Date.parse(String(value));
  return Number.isFinite(ms) ? ms : null;
}

/** Newest first, with undated backends last and their relative order preserved. */
function byNewestFirst(a: VisibilityCandidate, b: VisibilityCandidate): number {
  const ea = toEpoch(a.createdAt);
  const eb = toEpoch(b.createdAt);
  if (ea === null && eb === null) return 0;
  if (ea === null) return 1;
  if (eb === null) return -1;
  return eb - ea;
}

/**
 * Split the machine's backends into the one this project is about and the rest.
 *
 * Attachment is decided in four tiers, most specific first:
 *
 * 1. **The project's endpoint points at it** (`boundLocalBackendId`) — the strongest claim there
 *    is, because it is what the running app will talk to.
 * 2. **It is the active backend** (`activeBackendId`) — the converged selection. An id naming the
 *    endpoint rather than a card matches nothing here, which is correct: the endpoint has its own
 *    section.
 * 3. **It was previously attached** — the open project's id is in its `projectIds`. Richard's
 *    *"or was previously attached"*, resolved through the stamp that already exists rather than
 *    through a new field. Newest wins when several qualify.
 * 4. **It was just created in this panel** (`justCreatedBackendId`) — session state, so that
 *    pressing Create shows you what you made. **Last on purpose**: see
 *    {@link VisibilityInput.justCreatedBackendId}.
 *
 * 🔴 There is no fifth tier. A backend with an empty `projectIds` is owned by nobody and stays in
 * the finder however lonely the panel looks without it — promoting one would put a card for
 * somebody else's datastore in front of a learner, which is the shape of the defect
 * `findReusableBackend` was tightened to prevent.
 */
export function partitionBackends(input: VisibilityInput): BackendVisibility {
  const { candidates, activeBackendId, boundLocalBackendId, openProjectId, justCreatedBackendId } = input;

  const tier = (c: VisibilityCandidate): number => {
    if (boundLocalBackendId && c.id === boundLocalBackendId) return 1;
    if (activeBackendId && c.id === activeBackendId) return 2;
    if (openProjectId && (c.projectIds ?? []).includes(openProjectId)) return 3;
    if (justCreatedBackendId && c.id === justCreatedBackendId) return 4;
    return Number.POSITIVE_INFINITY;
  };

  let attached: VisibilityCandidate | undefined;
  let attachedTier = Number.POSITIVE_INFINITY;
  for (const candidate of candidates) {
    const t = tier(candidate);
    if (t === Number.POSITIVE_INFINITY) continue;
    if (t < attachedTier || (t === attachedTier && attached && byNewestFirst(candidate, attached) < 0)) {
      attached = candidate;
      attachedTier = t;
    }
  }

  const others = candidates.filter((c) => c !== attached).sort(byNewestFirst);

  return {
    attached: attached ? [attached] : [],
    others,
    summary: {
      attachedCount: attached ? 1 : 0,
      otherCount: others.length,
      otherRunningCount: others.filter((c) => c.running === true).length
    }
  };
}

/** What the finder filters on. Every field is optional; an empty query excludes nothing. */
export interface FinderQuery {
  /** Case-insensitive substring of the backend's name. */
  name?: string;
  /** Inclusive lower bound, `YYYY-MM-DD` or a full ISO timestamp. */
  createdFrom?: string;
  /** Inclusive upper bound. A bare `YYYY-MM-DD` includes the whole of that day. */
  createdTo?: string;
  /** Case-insensitive substring of an owning project's name. */
  project?: string;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** A bare `YYYY-MM-DD` upper bound means the end of that day, not its first millisecond. */
function upperBoundEpoch(value: string): number | null {
  const base = toEpoch(value);
  if (base === null) return null;
  return /^\d{4}-\d{2}-\d{2}$/.test(value.trim()) ? base + DAY_MS - 1 : base;
}

/**
 * The rows of `others` that match every clause of the query.
 *
 * 🔴 **An undated backend is excluded by any date bound, not admitted by it.** "Unknown" is not
 * "inside the range": a filter that quietly keeps the rows it could not measure is a filter that
 * returns everything for exactly the backends whose provenance is weakest, and the whole point of
 * this task is that a list which shows everything shows nothing.
 */
export function filterFinderRows(rows: VisibilityCandidate[], query: FinderQuery): VisibilityCandidate[] {
  const name = query.name?.trim().toLowerCase();
  const project = query.project?.trim().toLowerCase();
  const from = query.createdFrom?.trim() ? toEpoch(query.createdFrom.trim()) : null;
  const to = query.createdTo?.trim() ? upperBoundEpoch(query.createdTo.trim()) : null;
  const hasDateBound = Boolean(query.createdFrom?.trim() || query.createdTo?.trim());

  return rows.filter((row) => {
    if (name && !row.name.toLowerCase().includes(name)) return false;

    if (project && !(row.projectNames ?? []).some((n) => n.toLowerCase().includes(project))) return false;

    if (hasDateBound) {
      const created = toEpoch(row.createdAt);
      if (created === null) return false;
      if (from !== null && created < from) return false;
      if (to !== null && created > to) return false;
    }

    return true;
  });
}

/**
 * The collapsed panel's one honest line — **R1's answer**.
 *
 * 🔴 `ProjectBackendLifecycle` stops only the backends it started itself; one that was already
 * running when the project opened is *adopted*, and adopted backends are deliberately never
 * stopped. This panel is therefore the only place a hand-started backend can be stopped, so a
 * collapsed list must not be able to conceal a running process. A bare count would: *"14 others"*
 * reads as inert. The running tally is what makes hiding them safe, and the finder it opens draws
 * the same `LocalBackendCard` with the same Stop button — two interactions from here to stopped.
 */
export function describeCollapsedSummary(
  summary: VisibilitySummary,
  options?: {
    /**
     * The Cloud Services Endpoint card is on screen above this line.
     *
     * 🔴 The endpoint is a backend the project IS attached to, but it is **not a candidate** —
     * `activeBackendId` names `ENDPOINT_BACKEND_ID`, which matches no card, so the partition
     * correctly reports zero attached. Without this flag the line under a live Parse endpoint
     * would read *"No backend attached"* while the card saying otherwise sat directly above it.
     */
    endpointCardVisible?: boolean;
  }
): string {
  const isAttached = summary.attachedCount === 1 || options?.endpointCardVisible === true;
  const parts: string[] = [isAttached ? '1 attached' : 'No backend attached'];

  if (summary.otherCount > 0) {
    const others = `${summary.otherCount} other${summary.otherCount === 1 ? '' : 's'}`;
    parts.push(summary.otherRunningCount > 0 ? `${others}, ${summary.otherRunningCount} running` : others);
  }

  return parts.join(' · ');
}
