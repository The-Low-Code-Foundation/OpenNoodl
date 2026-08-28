/**
 * TemplateStep — FB-005 T3, the picker `templateRegistry.list()` was built for.
 * FB-005 T4 adds the way to narrow it: category pills and a search box.
 *
 * ## 🔴 This is the first caller `list()` has ever had
 *
 * FB-005's sweep found a complete template mechanism — a registry, an interface, four providers —
 * reached by nobody: *"`templateRegistry.list()` has zero callers, so there is no picker and there
 * never was one."* This screen is the picker. The host supplies the rows, because core-ui cannot
 * import editor models; what lives here is only what a picker is.
 *
 * ## ⚠️ Loading, empty and failed are three different screens, and one of them is not an error
 *
 * A shelf that is genuinely empty and a shelf that could not be read say opposite things, and the
 * one thing neither may do is render as the other. `TemplateRegistry.list` swallows a provider's
 * failure and returns the rest, so a community outage arrives here as **a shorter list**, not as
 * an error — which is why the host reports `partial` separately and this screen says so out loud.
 * Silently drawing a one-row shelf as though that were the whole shelf is the failure this note
 * exists to prevent.
 *
 * ## 🔴 T4 ADDS A FOURTH SCREEN, AND IT IS NOT THE THIRD ONE
 *
 * *"There are no templates"* and *"nothing here matches what you typed"* are opposite facts with
 * opposite fixes — one is ours to fix and the other is fixed by pressing Clear — and a filtered
 * list that renders the empty-shelf sentence tells somebody their shelf is broken when it is
 * their query that is narrow. `isFilterActive` is what tells the two apart, and it is asked
 * against the filter rather than against the row count, because a filter that happens to match
 * everything is still a filter.
 */
import React from 'react';

import { useWizardContext } from '../WizardContext';
import css from './TemplateStep.module.scss';
import {
  EMPTY_TEMPLATE_FILTER,
  categoryLabel,
  filterTemplates,
  isFilterActive,
  type TemplateFilter
} from './templateFilter';

/** One row on the shelf. Deliberately `TemplateItem`'s shape, without importing the editor's type. */
export interface TemplateChoice {
  /** The install URL — `embedded://hello-world`, `community://…`. Also the row's identity. */
  url: string;
  title: string;
  description: string;
  category: string;
  /** Where the row came from, for the badge. `undefined` draws no badge. */
  origin?: string;
  /**
   * SBR-001 — whether creating from this row should also attach a local
   * backend. Derived by the provider (see `TemplateItem.needsBackend`), carried
   * here so the host can act on it at confirm time. `undefined` means the
   * provider could not say, and is read as "no".
   */
  needsBackend?: boolean;
}

/**
 * 🔴 **THERE IS NO `fileCount` HERE, AND ITS ABSENCE IS A DECISION.** The platform sends one and
 * it would look good on a card — but the rows reach this screen through `TemplateItem`, which the
 * *embedded* provider also fills and which has no such field. An optional field only one of two
 * sources can ever populate is T2's rejected `installable` in mirror image: a client eventually
 * branches on it, and the branch is about which provider answered rather than about the template.
 * Widening `TemplateItem` is the honest way to add it. ⚠️ T4 did **not** do it: a size on a card
 * is not a way to narrow a shelf, and widening the type on both providers is its own change.
 */

export interface TemplateGalleryState {
  items: readonly TemplateChoice[];
  isLoading: boolean;
  /**
   * 🔴 **A sentence, not a code**, and it is about the *community* half only: the embedded
   * templates are compiled into this editor and cannot fail to list. So this is drawn beside a
   * list that still has rows in it, never instead of one.
   */
  partial?: string;
  onRetry?: () => void;
}

export interface TemplateStepProps {
  templates?: TemplateGalleryState;
}

/**
 * 🔴 **SPLIT OUT OF `TemplateStep` SO IT CAN BE GRADED, and the split is a precedent rather than
 * a convenience.** `views/Community.tsx` does the same thing for the same reason: this repo's
 * plain-Node runner evaluates a React element tree by *calling* function components, so anything
 * that reads context throws there — and a spec that could not render this component would be
 * reduced to grepping the source, which passes just as happily on code nothing renders.
 *
 * Everything this screen decides is here. `TemplateStep` is the two lines that read the wizard's
 * state.
 *
 * 🔴 **STILL HOOK-FREE AFTER T4, WHICH IS WHY THE FILTER IS A PROP AND NOT A `useState`.** The
 * runner in `tests-unit/support/renderElements.ts` calls function components directly, with
 * React's dispatcher null — *any* hook throws there. So the filter state is owned by the caller
 * (`TemplateStep`, which reads context and is therefore ungradeable anyway), and this component
 * derives rows and pills from it in one pure call. That is also what lets a spec assert a pill's
 * count against the list beside it from a single render.
 *
 * ⚠️ `filter` and `onFilterChange` are **optional**, and omitting them draws the unfiltered shelf
 * exactly as T3 did. `TemplateStepBody` is named in phase 76's SB-007 as a piece to reuse on the
 * launcher's Templates tab; a required prop added here would have broken that call site before it
 * was written.
 */
export function TemplateStepBody({
  gallery,
  selectedUrl,
  onSelect,
  filter = EMPTY_TEMPLATE_FILTER,
  onFilterChange
}: {
  gallery: TemplateGalleryState;
  selectedUrl: string;
  onSelect: (url: string) => void;
  filter?: TemplateFilter;
  onFilterChange?: (next: TemplateFilter) => void;
}) {
  // 🔴 ONE CALL. Rows and pill counts come out of the same pass over the same predicate — see
  // `templateFilter.ts`. A second traversal to count the pills is exactly where the number on a
  // pill stops meaning the rows behind it.
  const { rows, categories } = filterTemplates(gallery.items, filter);

  const filtering = isFilterActive(filter);
  const clear = () => onFilterChange?.(EMPTY_TEMPLATE_FILTER);

  // A row can be chosen and then filtered out from under the choice. The wizard still holds it —
  // Review will name it and Create will install it — so the one thing this screen must not do is
  // go quiet about a selection that is still in force.
  const selectionHidden =
    selectedUrl.length > 0 &&
    gallery.items.some((item) => item.url === selectedUrl) &&
    !rows.some((item) => item.url === selectedUrl);

  return (
    <div className={css['TemplateStep']}>
      <p className={css['TemplateStep-hint']}>
        Start from a project that is already built. You can change anything in it afterwards.
      </p>

      {gallery.partial && (
        <div className={css['TemplateStep-notice']} role="status">
          <span>{gallery.partial}</span>
          {gallery.onRetry && (
            <button className={css['TemplateStep-retry']} type="button" onClick={gallery.onRetry}>
              Try again
            </button>
          )}
        </div>
      )}

      {gallery.isLoading && gallery.items.length === 0 ? (
        <p className={css['TemplateStep-status']}>Looking for templates…</p>
      ) : gallery.items.length === 0 ? (
        <p className={css['TemplateStep-status']}>
          There are no templates to start from right now. Go back and pick another way to start.
        </p>
      ) : (
        <>
          {onFilterChange && (
            <div className={css['TemplateFilter']}>
              <input
                className={css['TemplateFilter-search']}
                type="search"
                value={filter.query}
                placeholder="Search templates"
                aria-label="Search templates"
                onChange={(e) => onFilterChange({ ...filter, query: e.target.value })}
              />
              <div className={css['TemplateFilter-facets']} role="group" aria-label="Filter by category">
                {categories.map((facet) => (
                  <button
                    key={facet.value ?? '*'}
                    type="button"
                    className={`${css['TemplateFilter-pill']} ${
                      facet.active ? css['TemplateFilter-pill--active'] : ''
                    }`}
                    aria-pressed={facet.active}
                    onClick={() => onFilterChange({ ...filter, category: facet.active ? null : facet.value })}
                  >
                    {/* 🔴 The count is INSIDE the pill's label, not a coloured dot beside it. FB-002
                        shipped a selected pill at 1.16:1 against its panel — a state carried only
                        by fill is a state somebody cannot see. Here the active pill says so in
                        text, and the border carries it as well as the background. */}
                    {facet.label} ({facet.count}){facet.active ? ' ✓' : ''}
                  </button>
                ))}
              </div>
            </div>
          )}

          {selectionHidden && (
            <div className={css['TemplateStep-notice']} role="status">
              <span>The template you chose is not in this list. It is still selected.</span>
              {onFilterChange && (
                <button className={css['TemplateStep-retry']} type="button" onClick={clear}>
                  Show it
                </button>
              )}
            </div>
          )}

          {rows.length === 0 ? (
            // 🔴 NOT the empty-shelf sentence. See the module header — one of these is our fault
            // and the other is one button away from being fixed by the person reading it.
            <p className={css['TemplateStep-status']}>
              No templates match {filtering ? 'that search' : 'this list'}.{' '}
              {onFilterChange && (
                <button className={css['TemplateStep-retry']} type="button" onClick={clear}>
                  Clear filters
                </button>
              )}
            </p>
          ) : (
            <ul className={css['TemplateList']}>
              {rows.map((item) => {
                const isSelected = selectedUrl === item.url;
                return (
                  <li key={item.url}>
                    <button
                      type="button"
                      className={`${css['TemplateCard']} ${isSelected ? css['TemplateCard--selected'] : ''}`}
                      // ⚠️ `aria-pressed` and not `aria-selected`: these are toggle buttons in a list,
                      // not options in a listbox, and a role the markup does not have is worse than none.
                      aria-pressed={isSelected}
                      onClick={() => onSelect(item.url)}
                    >
                      <span className={css['TemplateCard-head']}>
                        <span className={css['TemplateCard-title']}>{item.title}</span>
                        {/* 🔴 The selected state is carried by the BORDER as well as the fill.
                            FB-002 shipped a selected pill at 1.16:1 against its panel — every label
                            passing AA while *which one is on* did not. A check mark is the same
                            decision made in text, which no contrast ratio can take away. */}
                        {isSelected && <span className={css['TemplateCard-check']}>✓ Selected</span>}
                      </span>
                      <span className={css['TemplateCard-description']}>{item.description}</span>
                      <span className={css['TemplateCard-meta']}>
                        {/* 🔴 The LABEL, not the slug. The category vocabulary was ruled to the
                            platform's on 2026-08-26 — `starter`, `data-app` — which is right for a
                            CHECK constraint and wrong for a card: from that ruling until T4 this
                            drew the literal string `starter` at a person. */}
                        {item.category && <span className={css['TemplateCard-tag']}>{categoryLabel(item.category)}</span>}
                        {item.origin && <span className={css['TemplateCard-tag']}>{item.origin}</span>}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )}
    </div>
  );
}

export function TemplateStep({ templates }: TemplateStepProps) {
  const { state, update } = useWizardContext();

  // ⚠️ Local, not in `WizardState`, and the reason is what the wizard's state IS: the answers the
  // creation is built from. A search box is how somebody looked for the answer, not the answer —
  // putting it in `WizardState` would carry it into `ReviewStep`'s props and into every literal
  // that has to construct one. Re-opening the picker starts from the whole shelf, which is also
  // what re-opening the wizard already does to the listing itself.
  const [filter, setFilter] = React.useState<TemplateFilter>(EMPTY_TEMPLATE_FILTER);

  // Omitted means the host has not told us — treated as still loading rather than as an empty
  // shelf, because "there are no templates" is a claim, and this component cannot make it.
  const gallery: TemplateGalleryState = templates ?? { items: [], isLoading: true };

  return (
    <TemplateStepBody
      gallery={gallery}
      selectedUrl={state.selectedTemplateUrl}
      onSelect={(url) => update({ selectedTemplateUrl: url })}
      filter={filter}
      onFilterChange={setFilter}
    />
  );
}
