/**
 * FB-002 AC3 — the Bench, with the answered questions out of the way.
 *
 * ## 🔴 Why this is a component and not a prop on `CommunitySection`
 *
 * `CommunitySection` is the shared vocabulary: replays and tutorials draw through it too. A
 * filter added *there* would land on all three, and two of them have nothing to filter — a
 * control that appears above a list it cannot narrow is worse than no control, because it
 * reads as broken rather than as absent.
 *
 * So this is the same arrangement NAT-008 already chose for the directory: a list-specific
 * composite that renders the **shared** {@link CommunitySectionBody} inside it, with its own
 * controls above the rows. See `CommunityDirectoryView`, which this deliberately mirrors down
 * to the class names — a second set of pill styles is a second thing to keep in step.
 *
 * ## ⚠️ The pills are single-select, and one of them is always on
 *
 * That is the web Bench's shape (`lists.ts`, `BENCH_SPEC`'s `state` dimension: `multi: false`,
 * `fallback: 'waiting'`, and **no `all`**), and FB-002 AC4 asks the two surfaces to agree. So
 * there is no "everything" pill here either: the archive is one click away, not zero, and that
 * is the whole of Richard's *"relegated to an 'answered' filter"*.
 *
 * 🔴 **The counts come from the host in the same call that produced the rows.** A pill's number
 * is not related to what clicking it gives you, it **is** what clicking it gives you — the rule
 * `facets.ts` makes true by construction on the web and `mirrorview.composeBench` makes true
 * here. Two producers of one number is where they drift.
 *
 * ## 🔴 `boundLine` is not decoration
 *
 * `GET /api/v1/community/threads` mirrors the **100 newest** threads (`mirror.ts`,
 * `listThreads(sql, { limit: 100 })`) and sends no total. So this filter runs over part of the
 * Bench whenever the Bench is bigger than that, and a "Waiting for an answer" list that finds
 * nothing because the waiting questions are all older than the window looks exactly like a
 * community that has answered everything. When the host cannot rule that out, it says so, and
 * this draws it **above** the rows — a reader who stops scrolling at row eight never sees a
 * footnote.
 *
 * @module noodl-core-ui/components/community/CommunityBenchView
 */

import React from 'react';

import type { CommunityFilterPill } from './CommunityDirectoryView';
import { FilterPill } from './CommunityFilterPill';
import { CommunityDensity, CommunityRow } from './CommunityRow';
import { CommunitySectionBody, type CommunitySectionState } from './CommunitySectionBody';
import { metaLine, relativeTime, replyLatency } from './communityMeta';
import css from './Community.module.scss';

/**
 * One thread, as the Bench list draws it.
 *
 * ⚠️ **`accepted` is declared and the other three fields on the wire are not**, and that is a
 * decision rather than an oversight — see `communityapi.ForumThread`, which this mirrors and
 * which has been burned twice by fields that outlived the code drawing them.
 */
export type CommunityBenchRow = {
  id: string;
  title: string;
  createdAt: string;
  firstReplyMinutes: number | null;
  /**
   * FIX-025 bug 7 — declared because `replyLatency` now draws it, which is the bar the note
   * above sets. It is `firstReplyMinutes`'s companion and not its duplicate: this counts the
   * asker's own follow-ups and that one does not, so the pair is what separates "nobody has
   * answered" from "only the asker has".
   */
  replyCount: number;
  accepted: boolean;
};

export type CommunityBenchView = {
  section: CommunitySectionState<CommunityBenchRow>;
  /** `12 questions`, or `3 of 12 questions` when a pill is narrowing. */
  summary: string | null;
  /** 🔴 Non-null when this is only part of the Bench. See the module note. */
  boundLine: string | null;
  /** 🔴 Required and per-state — "nobody has asked" and "nothing is waiting" are opposite news. */
  emptyLine: string;
  filters: CommunityFilterPill[];
};

export interface CommunityBenchViewProps {
  view: CommunityBenchView;
  density?: CommunityDensity;
  onSelectFilter: (key: string) => void;
  onOpenThread: (threadId: string) => void;
  onRetry: () => void;
}

export function CommunityBenchView({
  view,
  density = CommunityDensity.Page,
  onSelectFilter,
  onOpenThread,
  onRetry
}: CommunityBenchViewProps) {
  return (
    <div className={`${css['Bench']} ${css[`is-density-${density}`]}`}>
      {view.filters.length > 0 && (
        /* ⚠️ A named group rather than bare buttons: two pills whose labels are "Solved" and
           "Waiting for an answer" say what they select and not what they are selecting *from*,
           and the pills are the only chrome here — there is no facet legend to read it off. */
        <div className={css['ChipRow']} role="group" aria-label="Show questions">
          {view.filters.map((filter) => (
            <FilterPill
              key={filter.key}
              filter={filter}
              dataTest={`community-bench-filter-${filter.key}`}
              onSelect={onSelectFilter}
            />
          ))}
        </div>
      )}

      {view.summary && <p className={css['DirectorySummary']}>{view.summary}</p>}
      {view.boundLine && <p className={css['DirectoryBound']}>{view.boundLine}</p>}

      <CommunitySectionBody state={view.section} emptyLine={view.emptyLine} onRetry={onRetry} density={density}>
        {(threads) =>
          threads.map((thread) => (
            <CommunityRow
              key={thread.id}
              density={density}
              title={thread.title}
              /* 🔴 `firstReplyMinutes === null` is still the row the health readout counts as
                 `unreplied`, and still speaks. Unchanged by FB-002: the filter is about an
                 *accepted answer*, which is not the same fact. ⚠️ FIX-025 bug 7: it takes
                 `replyCount` too, because null minutes means "nobody ELSE has answered" and on
                 a thread the asker answered themselves the old sentence contradicted the row. */
              meta={metaLine([
                relativeTime(thread.createdAt),
                replyLatency(thread.firstReplyMinutes, thread.replyCount)
              ])}
              onClick={() => onOpenThread(thread.id)}
            />
          ))
        }
      </CommunitySectionBody>
    </div>
  );
}
