/**
 * REL-013 — the Templates tab, wired to the shelf the create wizard already reads.
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 * ## 🔴 THIS TAB WAS REACHABLE AND EMPTY-BY-CONSTRUCTION FOR ITS WHOLE LIFE
 *
 * Until this row it rendered one hardcoded sentence — *"Project templates will be displayed
 * here. This feature is coming soon!"* — and imported no registry at all. `views/Projects.tsx`
 * has linked here since POL-002 (`setActivePageId('templates')` on the first-launch welcome), so
 * the very first thing a new user was offered was a promise with nothing behind it.
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 * ## 🔴 ONE SHELF, TWO SURFACES — AND THE ROWS ARRIVE AS PROPS
 *
 * `noodl-core-ui` may not import `noodl-editor`, so `useProjectTemplates` cannot be called here.
 * The rows arrive through `LauncherContext.templates`, the same `TemplateGalleryState` the create
 * wizard's picker is handed — supplied by **one** `useProjectTemplates` instance in
 * `ProjectsPage`. ⚠️ A second instance would double every community request and let two surfaces
 * show two different lists; the gate that keeps it to one is `shouldFetchTemplates`.
 *
 * ⚠️ **This file must never install, create or fetch anything.** Choosing a row calls
 * `onUseTemplate`, which opens the create wizard already on `'template'` mode with that URL — so
 * creation stays on the one route `handleCreateProjectConfirm` owns, the route that reads
 * `needsBackend` off the chosen row (SBR-001). A create path from here that skipped it would
 * re-enter that defect by a new door.
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 * ## 🔴 ZERO ROWS IS STILL REACHABLE HERE, AND IT MUST READ AS AN ANSWER
 *
 * As of 0.2.2 this tab draws **one** row: the site builder, unheld on 2026-09-05 once Richard
 * ruled it passable. `hello-world` stays held (`HELD_TEMPLATE_IDS` — registered so
 * `resolveTemplateUrl`'s fallback still works, unoffered because it is the blank project rather
 * than a template choice), and nothing is published on the platform yet.
 *
 * ⚠️ **A bare shelf is no longer the shipped state, and none of the reasoning below relaxes.**
 * It is now reached by a build whose embedded provider answers with nothing rather than by
 * design, which is a *worse* thing to draw wrongly, not a rarer one: empty is not a transient
 * state to be papered over with a spinner, because a spinner that never resolves and a panel that
 * failed to draw look identical to the person in front of them, and both read as *broken*.
 *
 * 🔴 **AN EMPTY SHELF AND AN UNREADABLE SHELF ARE OPPOSITE FACTS AND THEY GET OPPOSITE SCREENS.**
 * `galleryFromListing` reports a provider that could not answer as `partial` *beside* whatever
 * rows arrived — so zero rows **with** a `partial` means "could not be read" (retry), and zero
 * rows **without** one means "nothing published yet" (nothing to retry, nothing wrong). Folding
 * them together would tell somebody their shelf is broken when it is merely bare, or tell them
 * the shelf is bare when the community is down.
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 * ## ⚠️ NO THUMBNAILS. THE ROW IS A TITLE, A CATEGORY AND A SENTENCE.
 *
 * `PlatformTemplateProvider` ships `iconURL: ''` deliberately — there is no thumbnail column on
 * the platform and there is no plan for one. A card designed around an image that is never coming
 * is a card that looks broken on every row it ever draws.
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 * ## 🔴 THE FILTER IS THE WIZARD'S, NOT A SECOND ONE
 *
 * `filterTemplates` is imported, not re-implemented. Its own header states the rule: a facet's
 * count comes from the same pass as the rows behind it, and *"a second matcher beside this one is
 * how a pill's count stops meaning the rows behind it"* — which is exactly what
 * `ProjectCreationWizard/index.ts` exported it for.
 *
 * ⚠️ **`TemplatesTabBody` is HOOK-FREE, and that is not style.** `tests-unit/support/
 * renderElements` evaluates a React element tree by *calling* function components with React's
 * dispatcher null, so any hook throws there. `views/Community.tsx` and `TemplateStepBody` split
 * the same way for the same reason: the alternative is a spec reduced to grepping this file's
 * source, which passes just as happily on code nothing renders.
 *
 * @module noodl-core-ui/preview/launcher
 */

import React from 'react';

import { LauncherButton, LauncherButtonVariant } from '@noodl-core-ui/preview/launcher/Launcher/components/LauncherButton';
import { LauncherPage } from '@noodl-core-ui/preview/launcher/Launcher/components/LauncherPage';
// 🔴 THE DEEP PATHS, NOT THE PACKAGE INDEX, AND IT IS NOT A STYLE CHOICE.
// `components/ProjectCreationWizard/index.ts` re-exports the wizard COMPONENT, which drags in
// `TextInput`, `Markdown` and `PresetSelector`. `tests-unit`'s plain-Node runner cannot load
// anything that reaches webpack's `require.context` (see `support/renderElements`), so importing
// the index here would make this tab ungradeable — and the fallback, grepping this file's source,
// passes just as happily on code nothing renders. Naming the two leaf modules keeps the whole
// wizard out of the runner while still using the wizard's own filter.
import type { TemplateGalleryState } from '@noodl-core-ui/preview/launcher/Launcher/components/ProjectCreationWizard/steps/TemplateStep';
import {
  EMPTY_TEMPLATE_FILTER,
  categoryLabel,
  filterTemplates,
  isFilterActive,
  type TemplateFilter
} from '@noodl-core-ui/preview/launcher/Launcher/components/ProjectCreationWizard/steps/templateFilter';
import { useLauncherContext } from '@noodl-core-ui/preview/launcher/Launcher/LauncherContext';

import css from './Templates.module.scss';

export interface TemplatesTabBodyProps {
  /**
   * The shelf, as the host read it.
   *
   * 🔴 **`undefined` means NOBODY WIRED THIS**, which is not one of the shelf's own states and
   * must not be folded into any of them — `LauncherContext.communityMirror` and `learnerPath`
   * make the same distinction for the same reason. It happens in Storybook and in any build with
   * no host hook, and the tab then says so rather than claiming an empty shelf on no evidence.
   */
  gallery?: TemplateGalleryState;
  /** Start a project from this row. The host opens the create wizard on it — see the header. */
  onUseTemplate?: (templateUrl: string) => void;
  /** The launcher's ordinary "new project" route, offered where the shelf has nothing on it. */
  onCreateProject?: () => void;
  filter?: TemplateFilter;
  onFilterChange?: (next: TemplateFilter) => void;
}

/**
 * Everything this screen decides, as a pure function of its props. See the module header for why
 * it carries no hooks.
 */
export function TemplatesTabBody({
  gallery,
  onUseTemplate,
  onCreateProject,
  filter = EMPTY_TEMPLATE_FILTER,
  onFilterChange
}: TemplatesTabBodyProps) {
  if (!gallery) {
    return (
      <LauncherPage title="Templates">
        <p className={css['TemplatesTab-status']}>
          Templates are not available in this build.
        </p>
      </LauncherPage>
    );
  }

  const isLoading = gallery.isLoading && gallery.items.length === 0;
  const isEmpty = !gallery.isLoading && gallery.items.length === 0;
  // 🔴 See the header: zero rows plus a `partial` is a shelf that could not be READ. Only zero
  // rows with nothing to report is a shelf that is genuinely bare.
  const isUnreadable = isEmpty && Boolean(gallery.partial);

  // ONE call — rows and pill counts out of the same pass over the same predicate.
  const { rows, categories } = filterTemplates(gallery.items, filter);
  const filtering = isFilterActive(filter);
  const clear = () => onFilterChange?.(EMPTY_TEMPLATE_FILTER);

  return (
    <LauncherPage title="Templates">
      <div className={css['TemplatesTab']}>
        <p className={css['TemplatesTab-hint']}>
          A template is a project that is already built. Start from one and change anything in it
          afterwards.
        </p>

        {/* The short-shelf notice, drawn BESIDE rows whenever there are any. With no rows at all
            it is the whole screen instead — see `isUnreadable` below. */}
        {gallery.partial && !isEmpty && (
          <div className={css['TemplatesTab-notice']} role="status">
            <span>{gallery.partial}</span>
            {gallery.onRetry && (
              <button className={css['TemplatesTab-retry']} type="button" onClick={gallery.onRetry}>
                Try again
              </button>
            )}
          </div>
        )}

        {isLoading ? (
          <p className={css['TemplatesTab-status']}>Looking for templates…</p>
        ) : isUnreadable ? (
          <div className={css['TemplatesTab-empty']} role="status">
            <h2 className={css['TemplatesTab-emptyTitle']}>Templates could not be loaded</h2>
            {/* The host's sentence, not ours: it names WHICH source went quiet. */}
            <p className={css['TemplatesTab-emptyBody']}>{gallery.partial}</p>
            <div className={css['TemplatesTab-emptyActions']}>
              {gallery.onRetry && <LauncherButton label="Try again" onClick={gallery.onRetry} />}
              {onCreateProject && (
                <LauncherButton
                  label="New project"
                  variant={LauncherButtonVariant.Ghost}
                  onClick={onCreateProject}
                />
              )}
            </div>
          </div>
        ) : isEmpty ? (
          /* 🔴 AC4 — THE SHIPPED STATE. Every word here is chosen so that a bare shelf reads as an
             answer rather than as a failure: it says what a template is, that there are none yet,
             that more are coming, and it hands over the thing you came here to do anyway. */
          <div className={css['TemplatesTab-empty']} role="status">
            <h2 className={css['TemplatesTab-emptyTitle']}>No templates published yet</h2>
            <p className={css['TemplatesTab-emptyBody']}>
              Nothing has gone wrong — the shelf is simply bare for this release. As templates are
              published they show up here, and starting a project from one is a single click.
            </p>
            <div className={css['TemplatesTab-emptyActions']}>
              {onCreateProject && <LauncherButton label="New project" onClick={onCreateProject} />}
              {gallery.onRetry && (
                <LauncherButton
                  label="Check again"
                  variant={LauncherButtonVariant.Ghost}
                  onClick={gallery.onRetry}
                />
              )}
            </div>
          </div>
        ) : (
          <>
            {onFilterChange && (
              <div className={css['TemplatesTab-filter']}>
                <input
                  className={css['TemplatesTab-search']}
                  type="search"
                  value={filter.query}
                  placeholder="Search templates"
                  aria-label="Search templates"
                  onChange={(e) => onFilterChange({ ...filter, query: e.target.value })}
                />
                <div className={css['TemplatesTab-facets']} role="group" aria-label="Filter by category">
                  {categories.map((facet) => (
                    <button
                      key={facet.value ?? '*'}
                      type="button"
                      className={`${css['TemplatesTab-pill']} ${
                        facet.active ? css['TemplatesTab-pill--active'] : ''
                      }`}
                      aria-pressed={facet.active}
                      onClick={() => onFilterChange({ ...filter, category: facet.active ? null : facet.value })}
                    >
                      {/* The count is INSIDE the label and the active pill says so in text —
                          FB-002 shipped a selected pill at 1.16:1 and a state carried only by
                          fill is a state somebody cannot see. */}
                      {facet.label} ({facet.count}){facet.active ? ' ✓' : ''}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {rows.length === 0 ? (
              // 🔴 NOT the empty-shelf sentence. "There are no templates" is our fault; "nothing
              // here matches what you typed" is one button away from being fixed by the reader.
              <p className={css['TemplatesTab-status']}>
                No templates match {filtering ? 'that search' : 'this list'}.{' '}
                {onFilterChange && (
                  <button className={css['TemplatesTab-retry']} type="button" onClick={clear}>
                    Clear filters
                  </button>
                )}
              </p>
            ) : (
              <ul className={css['TemplateList']}>
                {rows.map((item) => (
                  <li key={item.url}>
                    {/* ⚠️ NO `aria-pressed`. In the wizard this card is a toggle that records a
                        choice; here it is the button that starts the creation, and a state the
                        markup does not have is worse than none. */}
                    <button
                      type="button"
                      className={css['TemplateCard']}
                      onClick={() => onUseTemplate?.(item.url)}
                    >
                      <span className={css['TemplateCard-head']}>
                        <span className={css['TemplateCard-title']}>{item.title}</span>
                        <span className={css['TemplateCard-action']}>Use this template →</span>
                      </span>
                      <span className={css['TemplateCard-description']}>{item.description}</span>
                      <span className={css['TemplateCard-meta']}>
                        {/* 🔴 The LABEL, not the slug — the category vocabulary is the platform's
                            (`starter`, `data-app`), which is right for a CHECK constraint and
                            wrong for a card. */}
                        {item.category && (
                          <span className={css['TemplateCard-tag']}>{categoryLabel(item.category)}</span>
                        )}
                        {item.origin && <span className={css['TemplateCard-tag']}>{item.origin}</span>}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </div>
    </LauncherPage>
  );
}

/**
 * The tab as the launcher composes it: two reads off the context, and the filter's own state.
 *
 * ⚠️ The filter is local rather than in the context for `TemplateStep`'s reason — how somebody
 * looked for a template is not a fact about the launcher, and leaving the tab starts from the
 * whole shelf again.
 */
export function Templates() {
  const { templates, onUseTemplate, onCreateProject } = useLauncherContext();
  const [filter, setFilter] = React.useState<TemplateFilter>(EMPTY_TEMPLATE_FILTER);

  return (
    <TemplatesTabBody
      gallery={templates}
      onUseTemplate={onUseTemplate}
      onCreateProject={onCreateProject}
      filter={filter}
      onFilterChange={setFilter}
    />
  );
}
