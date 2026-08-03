/**
 * AIB-005 — the editor says, unprompted, that a plan is waiting.
 *
 * > *"When I finished and clicked to build, it took me into the hello world app
 * > and didn't show anything about it building the app I'd asked for and the AI
 * > had defined. I went into the 'build' tab manually and saw that the plan was
 * > in there."*
 *
 * He found it. Nobody else will. The handover itself has worked since AIX-012;
 * what was missing was any announcement of it — `peekPendingScopePlan` decided
 * which scope tab opened *if the user found the panel themselves*, and nothing
 * on the canvas mentioned it at all.
 *
 * ## Why a strip and not a dialog, and why it does not build anything
 *
 * The wizard's own last screen promises *"the plan is saved with them and waits
 * for you — nothing is built now"*, and that promise is good: AIX-012's
 * reasoning that a conversation you cannot leave becomes an interrogation
 * applies just as well to a build you did not start. So this announces and
 * offers, exactly as `ProjectReviewBanner` does, and never runs anything.
 *
 * It does sit on the canvas, which `ProjectReviewBanner`'s header rules out for
 * itself — deliberately, and the two cases are not the same one. That banner is
 * an unsolicited offer to a user who did not ask for anything; this is the
 * continuation of something the user agreed to thirty seconds ago in the
 * previous screen, in a project that is otherwise an empty hello-world page.
 * Without it, the empty canvas reads as the plan having failed.
 *
 * @module noodl-editor/views/panels/AiAuthoringPanel/ScopePlanStrip
 */

import React, { useCallback, useEffect, useState } from 'react';

import { PlanSessionStore, PLAN_SESSION_CHANGED } from '@noodl-models/AiAssistant/authoring';
import { peekPendingScopePlan, takePendingScopePlan } from '@noodl-models/AiAssistant/scoping/pendingPlan';
import { ProjectModel } from '@noodl-models/projectmodel';
import { SidebarModel } from '@noodl-models/sidebar';

import { IconName } from '@noodl-core-ui/components/common/Icon';
import { PrimaryButton, PrimaryButtonSize, PrimaryButtonVariant } from '@noodl-core-ui/components/inputs/PrimaryButton';
import { HStack } from '@noodl-core-ui/components/layout/Stack';
import { Text, TextType } from '@noodl-core-ui/components/typography/Text';

import { AiAuthoringPanel_ID } from './AiAuthoringPanel';
import css from './ScopePlanStrip.module.scss';

export interface ScopePlanAnnouncement {
  /** How many operations the agreed plan has. */
  operations: number;
}

/**
 * The one predicate for "this project arrived with a plan it has never built".
 *
 * It consults two places because the handover genuinely lives in two, at
 * different times: the launcher hands it over in module state, and
 * `ProjectAuthoringView` moves it into `PlanSessionStore` the first time the
 * Build panel mounts (AIB-003, so a tab click can no longer destroy it). Either
 * may be the one holding it when this renders, depending on whether the panel
 * has opened yet — so the answer is derived here, once, rather than each caller
 * picking a source and being right half the time.
 *
 * Exported so the rule is specable without mounting React.
 */
export function scopePlanAnnouncement(projectId: string | undefined): ScopePlanAnnouncement | undefined {
  const session = PlanSessionStore.instance.get(projectId);
  if (session.announcementDismissed) return undefined;
  // Already taken into the session: announce until it is built, applied or
  // discarded — those are the three things that mean the user has seen it.
  if (session.origin === 'scoping' && session.plan && !session.run && !session.applied) {
    return { operations: session.plan.operations.length };
  }
  // Not taken yet — the Build panel has not mounted this session.
  const pending = peekPendingScopePlan(projectId);
  return pending ? { operations: pending.plan.operations.length } : undefined;
}

/** Re-evaluate whenever the store changes or the project does. */
function useScopePlanAnnouncement(): ScopePlanAnnouncement | undefined {
  const [announcement, setAnnouncement] = useState<ScopePlanAnnouncement | undefined>(() =>
    scopePlanAnnouncement(ProjectModel.instance?.id)
  );

  useEffect(() => {
    // PLAT-001's listener-context rule: a per-subscription token, never a shared
    // string group — see the note in ProjectReviewBanner for what sharing one
    // costs when two mounts of a thing are live at once.
    const context = {};
    PlanSessionStore.instance.on(
      PLAN_SESSION_CHANGED,
      () => setAnnouncement(scopePlanAnnouncement(ProjectModel.instance?.id)),
      context
    );
    return () => {
      PlanSessionStore.instance.off(context);
    };
  }, []);

  return announcement;
}

export function ScopePlanStrip() {
  const announcement = useScopePlanAnnouncement();

  const dismiss = useCallback(() => {
    const projectId = ProjectModel.instance?.id;
    const store = PlanSessionStore.instance;
    const session = store.get(projectId);

    /**
     * Take the launcher's handover into the session *before* silencing the
     * announcement, when the Build panel has not mounted yet.
     *
     * Found in live QA. Dismissing was one line — write `announcementDismissed`
     * and stop — and on the path that matters (the user lands, reads the strip,
     * says "not now", never opens the panel) the plan was still sitting in the
     * launcher's module state, which dies with the window. So "not now" quietly
     * meant "not ever", against a plan that had cost a ten-minute conversation.
     * That is exactly the loss this phase exists to stop, in the one control
     * whose whole promise is that it does not lose anything.
     */
    if (!session.plan && !session.run && !session.applied) {
      const pending = takePendingScopePlan(projectId);
      if (pending) {
        store.update(projectId, { plan: pending.plan, origin: 'scoping' });
      }
    }

    // Into the session, not component state: switching to a review document
    // unmounts the canvas, and an announcement that came back every time the
    // user looked at their own work would be worse than never showing it.
    // Dismissing the announcement is not discarding the plan — the plan is
    // untouched here, and Abandon is still the only thing that drops it.
    store.update(projectId, { announcementDismissed: true });
  }, []);

  const open = useCallback(() => {
    SidebarModel.instance.switch(AiAuthoringPanel_ID);
  }, []);

  if (!announcement) return null;

  return (
    <div className={css['Root']}>
      <HStack UNSAFE_style={{ alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <Text textType={TextType.Default}>
          Your plan is ready — {announcement.operations} operation
          {announcement.operations === 1 ? '' : 's'} to build.
        </Text>
        <Text textType={TextType.Shy}>Nothing has been built yet.</Text>
        <HStack UNSAFE_style={{ marginLeft: 'auto', gap: 6 }}>
          <PrimaryButton
            label="Open the plan"
            icon={IconName.MagicWand}
            size={PrimaryButtonSize.Small}
            isFitContent
            onClick={open}
          />
          <PrimaryButton
            label="Not now"
            size={PrimaryButtonSize.Small}
            variant={PrimaryButtonVariant.Ghost}
            isFitContent
            onClick={dismiss}
          />
        </HStack>
      </HStack>
    </div>
  );
}
