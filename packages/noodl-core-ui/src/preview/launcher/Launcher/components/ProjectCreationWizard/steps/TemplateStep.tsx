/**
 * TemplateStep — FB-005 T3, the picker `templateRegistry.list()` was built for.
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
 */
import React from 'react';

import { useWizardContext } from '../WizardContext';
import css from './TemplateStep.module.scss';

/** One row on the shelf. Deliberately `TemplateItem`'s shape, without importing the editor's type. */
export interface TemplateChoice {
  /** The install URL — `embedded://hello-world`, `community://…`. Also the row's identity. */
  url: string;
  title: string;
  description: string;
  category: string;
  /** Where the row came from, for the badge. `undefined` draws no badge. */
  origin?: string;
}

/**
 * 🔴 **THERE IS NO `fileCount` HERE, AND ITS ABSENCE IS A DECISION.** The platform sends one and
 * it would look good on a card — but the rows reach this screen through `TemplateItem`, which the
 * *embedded* provider also fills and which has no such field. An optional field only one of two
 * sources can ever populate is T2's rejected `installable` in mirror image: a client eventually
 * branches on it, and the branch is about which provider answered rather than about the template.
 * Widening `TemplateItem` is the honest way to add it, and that is T4's business, not this
 * screen's.
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
 */
export function TemplateStepBody({
  gallery,
  selectedUrl,
  onSelect
}: {
  gallery: TemplateGalleryState;
  selectedUrl: string;
  onSelect: (url: string) => void;
}) {
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
        <ul className={css['TemplateList']}>
          {gallery.items.map((item) => {
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
                    {item.category && <span className={css['TemplateCard-tag']}>{item.category}</span>}
                    {item.origin && <span className={css['TemplateCard-tag']}>{item.origin}</span>}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export function TemplateStep({ templates }: TemplateStepProps) {
  const { state, update } = useWizardContext();

  // Omitted means the host has not told us — treated as still loading rather than as an empty
  // shelf, because "there are no templates" is a claim, and this component cannot make it.
  const gallery: TemplateGalleryState = templates ?? { items: [], isLoading: true };

  return (
    <TemplateStepBody
      gallery={gallery}
      selectedUrl={state.selectedTemplateUrl}
      onSelect={(url) => update({ selectedTemplateUrl: url })}
    />
  );
}
