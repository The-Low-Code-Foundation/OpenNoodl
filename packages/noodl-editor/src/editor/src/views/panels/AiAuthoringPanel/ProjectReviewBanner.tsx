/**
 * AIX-010 — the recommendation surface.
 *
 * A project with no `docs/CONVENTIONS.md` gets the assistant's context docs for
 * free if someone spends ten minutes correcting a draft — but nobody discovers
 * that from a panel they have no reason to open. So it is offered, once, in two
 * places.
 *
 * The rules exist so this does not become the thing everyone learns to scroll
 * past, and each is load-bearing:
 *
 *  - **Two surfaces only** — the Build panel and the Docs panel. Never the
 *    canvas, never a modal, never on project open.
 *  - **Dismissal is permanent and per project**, in editor settings rather than
 *    project files: it is this person's preference on this machine, not a fact
 *    about the project their colleagues share.
 *  - **It never auto-runs.** The banner offers; the user starts it.
 *  - **Neutral, not amber.** Phase 23's palette law is that red means danger and
 *    amber means warning. A project without docs is not in trouble.
 *
 * @module noodl-editor/views/panels/AiAuthoringPanel/ProjectReviewBanner
 */

import React, { useCallback, useEffect, useState } from 'react';

import { dismissReviewBanner, isReviewBannerDismissed } from '@noodl-models/AiAssistant/review';
import { currentProjectDocsModel, DOCS_CHANGED, ProjectDocsModel } from '@noodl-models/ProjectDocs';
import { ProjectModel } from '@noodl-models/projectmodel';

import { EventDispatcher } from '../../../../../shared/utils/EventDispatcher';

import { IconName } from '@noodl-core-ui/components/common/Icon';
import { PrimaryButton, PrimaryButtonSize, PrimaryButtonVariant } from '@noodl-core-ui/components/inputs/PrimaryButton';
import { HStack, VStack } from '@noodl-core-ui/components/layout/Stack';
import { Text, TextType } from '@noodl-core-ui/components/typography/Text';

import css from './ProjectReviewBanner.module.scss';

/**
 * Subscribe one banner to everything that can change its answer.
 *
 * ## Why this is a function and not four lines inside the effect
 *
 * It used to be, with a module-level `const EVENT_GROUP = 'project-review-banner'`
 * as the listener group — and both `EventDispatcher.off(group)` and
 * `Model.off(group)` splice **every** listener whose group is `===` that value,
 * out of one global registry. The banner is mounted twice (the Build panel and
 * the Docs panel) and this editor's sidebar panels are hidden rather than
 * unmounted, so both instances are live at once. Whichever unmounted first took
 * the other's subscriptions with it, and the survivor then never heard
 * `DOCS_CHANGED` or `ProjectModel.instanceHasChanged` again — meaning it went on
 * offering to draft docs for a project that had just accepted them, which is
 * precisely the claim in this module's header ("retires the banner on its own,
 * with nothing having to remember to").
 *
 * The group is now a per-subscription token: the PLAT-001 listener-context rule,
 * the same `const context = {}` idiom `useCanvasThemeGeneration` uses. Two
 * subscribers can no longer see each other.
 *
 * Exported so that rule is specable without mounting React — see
 * `tests/ai/project-review-banner.test.ts`.
 */
export function subscribeReviewVisibility(evaluate: () => void): () => void {
  const context = {};

  EventDispatcher.instance.on(['ProjectModel.instanceHasChanged', 'ProjectModel.importComplete'], evaluate, context);

  const docs = currentProjectDocsModel();
  docs?.on(DOCS_CHANGED, evaluate, context);

  return () => {
    EventDispatcher.instance.off(context);
    docs?.off(context);
  };
}

/**
 * Whether the offer should be shown at all.
 *
 * Two conditions, both re-evaluated when the project changes or a doc is
 * written: the project has no `docs/CONVENTIONS.md` (`hasDocs()`, AIX-009's
 * single predicate), and this user has not dismissed it here. Accepting the
 * drafted CONVENTIONS.md therefore retires the banner on its own, with nothing
 * having to remember to.
 */
export function useShouldOfferReview(): boolean {
  const [visible, setVisible] = useState(false);

  const evaluate = useCallback(() => {
    const project = ProjectModel.instance;
    if (!project) {
      setVisible(false);
      return;
    }
    if (isReviewBannerDismissed(project)) {
      setVisible(false);
      return;
    }
    const docs = currentProjectDocsModel() ?? ProjectDocsModel.forProject(project);
    setVisible(Boolean(docs) && !docs!.hasDocs());
  }, []);

  useEffect(() => {
    evaluate();
    return subscribeReviewVisibility(evaluate);
  }, [evaluate]);

  return visible;
}

export interface ProjectReviewBannerProps {
  /** Start the review. The banner never does this by itself. */
  onStart: () => void;
  /** Hidden while a review is already running from the other surface. */
  isBusy?: boolean;
}

export function ProjectReviewBanner({ onStart, isBusy }: ProjectReviewBannerProps) {
  const shouldOffer = useShouldOfferReview();
  const [dismissed, setDismissed] = useState(false);

  if (!shouldOffer || dismissed) return null;

  return (
    <div className={css['Root']}>
      <VStack UNSAFE_style={{ gap: 6 }}>
        {/*
          BLD-008 item 7 — a suggestion, not an interrupt.

          What was here described the whole feature in three lines before
          offering it, which is what made it an interrupt rather than a
          suggestion: a paragraph at the top of a panel is something you have to
          read past. The sentence is now one line and it says the thing that
          actually decides the click — that the agent asks first — because
          "correct these three documents" and "answer six questions" are
          different offers and only one of them is true after this task.
        */}
        <Text textType={TextType.Shy}>
          This project has no AI context docs. I'll ask you a few things first, then draft them.
        </Text>
        {/*
          Wraps because the two labels do not fit side by side in the panel this
          banner lives in. Found by mounting it: at the Docs panel's width the
          dismiss button hangs past the right edge, and the panel is resizable
          down to 240px, where the primary button alone does not fit a row. A
          banner whose "no thanks" is the half you cannot reach is worse than no
          banner — it reads as an offer you are not allowed to decline.

          ⚠️ `height: 'auto'` — `Stack` puts `height: 100%` on any row that does
          not declare one, and this row's parent is a block. See C5 in
          `AiAuthoringPanel`'s header for the full measurement.
        */}
        <HStack UNSAFE_style={{ height: 'auto', gap: 6, flexWrap: 'wrap' }}>
          <PrimaryButton
            label={isBusy ? 'Reviewing…' : 'Write the project docs'}
            icon={IconName.MagicWand}
            size={PrimaryButtonSize.Small}
            isDisabled={isBusy}
            isFitContent
            onClick={onStart}
          />
          <PrimaryButton
            label="Not for this project"
            size={PrimaryButtonSize.Small}
            variant={PrimaryButtonVariant.Ghost}
            isFitContent
            onClick={() => {
              dismissReviewBanner(ProjectModel.instance);
              setDismissed(true);
            }}
          />
        </HStack>
      </VStack>
    </div>
  );
}
