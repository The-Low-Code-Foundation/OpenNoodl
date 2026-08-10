/**
 * BLD-006 — a thread on disk, and the rules for reading one back.
 *
 * BLD-001 made a conversation survive an accept by moving finished turns into a
 * `history` array. This is the half that makes it survive the process, and it
 * is the same split AIB-003 slice 4 used one directory over: the *decisions*
 * — what a thread is called, which lines are trustworthy, what "recent" means —
 * are pure functions here, and `ThreadSidecar` is the only thing that touches a
 * filesystem. That is what lets the format be pinned in a plain-Node runner
 * (`tests-unit/bld-006/`) rather than only inside an Electron renderer.
 *
 * ## Why JSONL, and what "append-only" means here
 *
 * One record per line: a header, then one line per turn, in the order they
 * happened. It is a debugging surface as much as a feature — `tail -1` is the
 * last thing the agent did, and a half-written last line costs that one turn
 * rather than the file.
 *
 * ⚠️ **The task said append-only and the platform has no append.**
 * `IFileSystem` offers `writeFile` / `writeFileOverride` / `readFile` and
 * nothing else ([filesystem/common.ts:29-33]), so the sidecar rewrites the
 * whole file from the in-memory thread. The *content* is still append-only —
 * lines are only ever added, never rewritten — which is the property the format
 * was chosen for. Implementing a true append on top of read-modify-write would
 * buy nothing but a second copy of the thread to disagree with the first.
 *
 * ## What is durable, and what is not
 *
 * **A retired turn.** A live turn is derived every render from whichever
 * session is producing it, and those sessions already have their own
 * durability story — `PlanSessionStore` persists an unapplied build, and an
 * `AuthoringSession` deliberately does not survive a restart because a
 * half-finished model turn cannot be resumed (see `planSessionSnapshot`'s
 * header: *a restart is a stop*). Writing a line per render for a turn that is
 * still changing would mean rewriting it on every token, and the record it
 * eventually settled on would be the only one anybody wanted.
 *
 * @module AiAssistant/thread/threadRecord
 */

import type { Turn } from './types';

/**
 * Bumped when a change would make an older file restore *wrongly* rather than
 * merely incompletely. Same rule as `PLAN_SNAPSHOT_VERSION` with one
 * difference that matters: a plan snapshot is scratch and gets dropped, whereas
 * a thread is the user's record of what they asked for. A version we cannot
 * read is **kept on disk and not listed**, never deleted.
 */
export const THREAD_FILE_VERSION = 1;

/** How many characters of the first request become the thread's name. */
export const TITLE_MAX = 48;

/** A conversation, as the panel and the disk both see it. */
export interface ThreadRecord {
  id: string;
  /** Derived from the first request. Empty until there is one. */
  title: string;
  /** Epoch ms. */
  createdAt: number;
  /** Epoch ms of the last appended turn — what the switcher sorts on. */
  updatedAt: number;
  turns: Turn[];
}

export function emptyThread(id: string, createdAt: number): ThreadRecord {
  return { id, title: '', createdAt, updatedAt: createdAt, turns: [] };
}

/**
 * The name of a thread, from the first thing the user asked for.
 *
 * Derived rather than stored-and-editable because a thread is identified by
 * what it was for, and the user already said that in their first sentence.
 * Cut on a word boundary when there is one near the limit — a title ending
 * mid-word reads as a bug in a way an ellipsis after a whole word does not.
 *
 * ⚠️ Turns with no `request` are skipped, not treated as untitled. The first
 * turn of a thread can be one the agent opened itself (a restored plan, the
 * launcher's handover), and taking its emptiness as the title would leave a
 * conversation the user very much did name showing as "Untitled".
 */
export function threadTitle(turns: readonly Turn[]): string {
  const first = turns.find((turn) => typeof turn.request === 'string' && turn.request.trim().length > 0);
  if (!first?.request) return '';

  const text = first.request.trim().replace(/\s+/g, ' ');
  if (text.length <= TITLE_MAX) return text;

  const cut = text.slice(0, TITLE_MAX);
  const lastSpace = cut.lastIndexOf(' ');
  // Only honour a word boundary in the last third; a request whose first word
  // is longer than the limit would otherwise produce an empty title.
  const stem = lastSpace > TITLE_MAX * 0.6 ? cut.slice(0, lastSpace) : cut;
  return `${stem.trimEnd()}…`;
}

/** What the switcher shows for a thread with no request in it yet. */
export const UNTITLED = 'New thread';

export function threadLabel(thread: Pick<ThreadRecord, 'title'>): string {
  return thread.title || UNTITLED;
}

/**
 * When a thread was last touched, in words.
 *
 * `now` is a parameter for the reason every time-dependent thing in this phase
 * takes one: BLD-004's clock outlived what it measured precisely because it
 * read the wall clock at the point of use, and a formatter that cannot be
 * handed a time cannot be graded at a boundary.
 */
export function threadWhen(updatedAt: number, now: number): string {
  const seconds = Math.max(0, Math.round((now - updatedAt) / 1000));
  if (seconds < 60) return 'just now';

  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;

  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;

  const days = Math.round(hours / 24);
  if (days === 1) return 'yesterday';
  if (days < 7) return `${days} days ago`;
  return new Date(updatedAt).toLocaleDateString();
}

// ── The file ─────────────────────────────────────────────────────────────────

/** The first line: what this file is, and what the thread is called. */
interface HeaderLine {
  record: 'thread';
  version: number;
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
}

/** Every other line: one turn, verbatim, with a tag so the line self-describes. */
interface TurnLine extends Turn {
  record: 'turn';
}

/**
 * The thread as the file's text.
 *
 * A trailing newline, so appending by hand — or by a shell — produces a valid
 * file rather than two records welded onto one line.
 */
export function serialiseThread(thread: ThreadRecord): string {
  const header: HeaderLine = {
    record: 'thread',
    version: THREAD_FILE_VERSION,
    id: thread.id,
    title: thread.title,
    createdAt: thread.createdAt,
    updatedAt: thread.updatedAt
  };
  const lines = [JSON.stringify(header), ...thread.turns.map((turn) => JSON.stringify({ record: 'turn', ...turn }))];
  return `${lines.join('\n')}\n`;
}

/**
 * A thread read back off disk, or `null` if this is not one.
 *
 * `.nodegx/` is a directory people can open and hand-edit, and a half-written
 * last line is the normal consequence of the crash this exists to survive. The
 * rule is `parsePlanSessionSnapshot`'s: take what is well formed, drop the
 * rest, never throw. **A bad line costs one turn, not the file** — which is the
 * whole reason the format is line-oriented rather than one big JSON object.
 *
 * A turn with no `id` is dropped rather than given one: ids are what
 * `renderOutcome` matches to decide where a live control may mount (see
 * `liveTurns` — *the prefix is the liveness*), and inventing one here could
 * mint a `component-…` that a retired turn must never carry.
 */
export function parseThreadFile(text: string): ThreadRecord | null {
  const lines = text.split(/\r?\n/).filter((line) => line.trim().length > 0);
  if (lines.length === 0) return null;

  const header = parseLine(lines[0]) as Partial<HeaderLine> | null;
  if (!header || header.record !== 'thread') return null;
  if (header.version !== THREAD_FILE_VERSION) return null;
  if (typeof header.id !== 'string' || header.id.length === 0) return null;

  const turns: Turn[] = [];
  for (const line of lines.slice(1)) {
    const parsed = parseLine(line) as Partial<TurnLine> | null;
    if (!parsed || parsed.record !== 'turn') continue;
    const turn = toTurn(parsed);
    if (turn) turns.push(turn);
  }

  const createdAt = typeof header.createdAt === 'number' ? header.createdAt : 0;
  return {
    id: header.id,
    // Re-derived rather than trusted: the title is a function of the turns, and
    // a stored one that disagrees with them (a hand-edit, a dropped first line)
    // would name the thread after a request that is no longer in it.
    title: threadTitle(turns) || (typeof header.title === 'string' ? header.title : ''),
    createdAt,
    updatedAt: typeof header.updatedAt === 'number' ? header.updatedAt : createdAt,
    turns
  };
}

function parseLine(line: string): unknown {
  try {
    return JSON.parse(line);
  } catch {
    return null;
  }
}

/**
 * One line as a turn, or nothing.
 *
 * ⚠️ Activities are filtered to the ones that carry a `kind`, and nothing more
 * is checked. `ActivityRow` switches on `kind` and renders nothing for an
 * unknown one, so a record written by a newer editor degrades to a gap in a
 * historical turn — which is the right failure for a read-only record, and a
 * much better one than refusing to open the conversation.
 */
function toTurn(line: Partial<TurnLine>): Turn | null {
  if (typeof line.id !== 'string' || line.id.length === 0) return null;

  const activities = Array.isArray(line.activities)
    ? line.activities.filter((activity) => Boolean(activity) && typeof (activity as { kind?: unknown }).kind === 'string')
    : [];

  return {
    id: line.id,
    ...(typeof line.request === 'string' ? { request: line.request } : {}),
    ...(line.intent === 'component' || line.intent === 'plan' || line.intent === 'docs' ? { intent: line.intent } : {}),
    activities,
    ...(line.outcome && typeof line.outcome === 'object' ? { outcome: line.outcome } : {}),
    // BLD-011 — the record of what rode along. Filtered on the two fields the
    // row actually renders, on the same "take what is well formed" rule as the
    // activities above: a hand-edited entry missing its label costs one chip,
    // not the turn.
    ...(Array.isArray(line.references)
      ? {
          references: line.references.filter(
            (ref) =>
              Boolean(ref) &&
              typeof (ref as { kind?: unknown }).kind === 'string' &&
              typeof (ref as { label?: unknown }).label === 'string'
          )
        }
      : {})
    // `busy` is deliberately never restored. A frozen turn that still claims to
    // be running is how a thread grows a spinner that never stops, and a file
    // is by definition frozen — `freezeTurns` strips it on the way in, and this
    // refuses to put it back if a hand-edited file offers one.
  };
}

/** Newest first — the order the switcher lists them in. */
export function byRecency(threads: readonly ThreadRecord[]): ThreadRecord[] {
  return [...threads].sort((a, b) => b.updatedAt - a.updatedAt);
}

/**
 * Whether a thread is worth a file at all.
 *
 * An empty thread is what pressing "New thread" produces, and writing one would
 * mean every stray click leaves a file to be listed, and re-listed, forever.
 * The first appended turn is what makes it real.
 */
export function isWorthWriting(thread: ThreadRecord): boolean {
  return thread.turns.length > 0;
}
