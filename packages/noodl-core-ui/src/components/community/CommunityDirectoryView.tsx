/**
 * NAT-008 AC1 — the directory: who is here, and a way to find one of them.
 *
 * ## 🔴 The search box is the riskiest control on this surface, and not for a UI reason
 *
 * *"A search box that returns the unfiltered list looks like a working search box."* That is
 * this task's own trap, and it is a **measured** failure mode in this codebase rather than a
 * caution — four platform endpoints were found ignoring their keyword, and
 * `GET /api/v1/community/people` is a fifth: measured on 2026-08-20, `?q=ada` over three people
 * returns all three, and so does `?q=zzzzzzzz`. See `communityapi.readDirectory` for the table
 * and for the control that makes it mean something.
 *
 * So the narrowing happens in the host, over rows, and the host's filter is graded directly by a
 * spec that includes **a query which must return nothing** — because a filter that always
 * returns everything and a filter that is never called are the same screen.
 *
 * ## ⚠️ The label names the fields, so it does not promise more than it does
 *
 * `searchLabel` is required and the host supplies the web page's own words. A box labelled
 * "Search" over a filter that only reads names is a control that lies quietly; naming the four
 * fields is what the platform does and it costs nothing to copy.
 *
 * ## 🔴 `boundLine` is not decoration
 *
 * The endpoint pages — 50 by default, 100 at most — so a client that filtered *the page it was
 * given* would be searching part of the directory and drawing the result as though it were the
 * whole. `readDirectory` follows `nextOffset` to the end and reports whether it got there; when
 * it did not, this line says so. **A bounded query reports its bound.**
 *
 * @module noodl-core-ui/components/community/CommunityDirectoryView
 */

import React from 'react';

import { FilterPill } from './CommunityFilterPill';
import { CommunityDensity } from './CommunityRow';
import { CommunityPersonRow, type CommunityPersonRowView } from './CommunityPersonRow';
import { CommunitySectionBody, type CommunitySectionState } from './CommunitySectionBody';
import css from './Community.module.scss';

/**
 * One filter toggle.
 *
 * ⚠️ The count travels with it, and it is the count of rows *this toggle returns* — the same
 * rule `facets.ts` makes true by construction on the web: *"the number on a pill is not related
 * to what clicking it gives you, it IS what clicking it gives you"*. The host computes both from
 * one function; two producers of one number is where they drift.
 */
export type CommunityFilterPill = {
  key: string;
  label: string;
  count: number;
  active: boolean;
};

export type CommunityDirectoryView = {
  section: CommunitySectionState<CommunityPersonRowView>;
  /** `11 people`, or `2 of 11 people` when a search or a filter is narrowing. */
  summary: string | null;
  /** 🔴 Non-null when this is only part of the directory. See the module note. */
  boundLine: string | null;
  /** 🔴 Required and per-state: quiet-community and nothing-matches are different sentences. */
  emptyLine: string;
  searchLabel: string;
  query: string;
  filters: CommunityFilterPill[];
};

export interface CommunityDirectoryViewProps {
  view: CommunityDirectoryView;
  density?: CommunityDensity;
  onQueryChange: (query: string) => void;
  onToggleFilter: (key: string) => void;
  onOpenPerson: (handle: string) => void;
  onRetry: () => void;
}

export function CommunityDirectoryView({
  view,
  density = CommunityDensity.Page,
  onQueryChange,
  onToggleFilter,
  onOpenPerson,
  onRetry
}: CommunityDirectoryViewProps) {
  /**
   * 🔴 **The id carries the density, and that is a correctness fix rather than a nicety.** A
   * `<label htmlFor>` binds by **document-unique id**: two directories mounted at once — the
   * launcher tab and the editor's rail live in the *same* `BrowserWindow` — would give both boxes
   * the same id, and every browser resolves that to the **first** one. Clicking the rail's label
   * would then focus the launcher's field, and a screen reader would read one box's name twice.
   *
   * ⚠️ Not `useId()`, deliberately: this component is graded by walking its element tree with no
   * renderer, and **any** hook throws there. The two densities are the two mount points, so they
   * are a sufficient key — and a spec asserts the ids differ rather than trusting that.
   */
  const searchId = `community-directory-search-${density}`;

  return (
    <div className={`${css['Directory']} ${css[`is-density-${density}`]}`}>
      <div className={css['SearchRow']}>
        {/* ⚠️ A real `<label>` rather than a placeholder. A placeholder disappears the moment
            somebody types, which is exactly when a person needs to be reminded what the box
            searches — and it is not an accessible name. */}
        <label className={css['SearchLabel']} htmlFor={searchId}>
          {view.searchLabel}
        </label>
        <input
          id={searchId}
          className={css['SearchInput']}
          type="search"
          value={view.query}
          onChange={(event) => onQueryChange(event.target.value)}
        />
      </div>

      {view.filters.length > 0 && (
        <div className={css['ChipRow']}>
          {view.filters.map((filter) => (
            <FilterPill key={filter.key} filter={filter} onSelect={onToggleFilter} />
          ))}
        </div>
      )}

      {view.summary && <p className={css['DirectorySummary']}>{view.summary}</p>}
      {/* 🔴 Drawn above the rows, not below them: a reader who stops scrolling at row eight
          would never see a footnote saying the list is partial. */}
      {view.boundLine && <p className={css['DirectoryBound']}>{view.boundLine}</p>}

      <CommunitySectionBody state={view.section} emptyLine={view.emptyLine} onRetry={onRetry} density={density}>
        {(people) =>
          people.map((person) => (
            <CommunityPersonRow
              key={person.handle}
              person={person}
              density={density}
              onClick={() => onOpenPerson(person.handle)}
            />
          ))
        }
      </CommunitySectionBody>
    </div>
  );
}
