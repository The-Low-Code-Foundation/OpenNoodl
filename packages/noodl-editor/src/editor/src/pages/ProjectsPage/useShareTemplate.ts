import { useCallback, useMemo, useState } from 'react';

import { filesystem } from '@noodl/platform';

import type {
  ShareTemplateDraft,
  ShareTemplateModalProps,
  ShareTemplateResult
} from '@noodl-core-ui/preview/launcher/Launcher/components/ShareTemplateModal';

import { CommunityApiClient } from '../../models/community/communityapi';
import { readCommunitySession } from '../../models/community/communitysession';
import { SHAREABLE_LICENCES, shareAsTemplate } from '../../models/template/shareAsTemplate';
import {
  SHAREABLE_CATEGORIES,
  describeShareOutcome,
  draftForProject,
  draftProblems,
  problemFor,
  whySendIsOff,
  type DraftField
} from '../../models/template/shareTemplateForm';

/**
 * FB-005 T5 — the launcher's half of "Share as template".
 *
 * ## 🔴 This is the CALLER `shareAsTemplate` did not have
 *
 * The seam, the client method, the table, the route and the promotion script all shipped in
 * session 45 with nothing in the product able to reach them — recorded in `FB-005-SCOPE.md` §4d as
 * this phase's own *build the caller* finding, left open deliberately. This hook and the kebab
 * entry beside it are that half. ⚠️ **`useProjectTemplates` was the same shape of fix in the other
 * direction** — `templateRegistry.list()` had zero callers until T3 gave it one.
 *
 * ## The split, and why the hook holds no rules
 *
 * `shareTemplateForm.ts` owns every decision (what is sendable, what each outcome says) because a
 * plain-Node runner can load it and cannot load a dialog that draws `Modal`. What is left here is
 * genuinely launcher-shaped: a session token, a real filesystem, and the fact that a share reads a
 * directory that belongs to a project row.
 *
 * ⚠️ **The token, for the reason `repullFromPlatform` states**: D15 answers 404 to an org-owned
 * minor, so an anonymous client would report the whole surface as absent to somebody who has an
 * account. `submitTemplate` is a *checked write capability* on the platform, so this cannot be
 * signed out and work.
 */

/** What the launcher needs to open the dialog: a project row's name and its directory on disk. */
export interface ShareTemplateTarget {
  projectId: string;
  projectName: string;
  projectDir: string;
}

export interface ShareTemplateHostState {
  /** Props for `ShareTemplateModal`, or `null` when nothing is being shared. */
  modal: ShareTemplateModalProps | null;
  /** Open the dialog against one project. */
  open: (target: ShareTemplateTarget) => void;
}

export function useShareTemplate(input: { baseUrl: string; isSignedIn: boolean }): ShareTemplateHostState {
  const [target, setTarget] = useState<ShareTemplateTarget | null>(null);
  const [draft, setDraft] = useState<ShareTemplateDraft | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [result, setResult] = useState<ShareTemplateResult | null>(null);
  /**
   * 🔴 **Which fields have been TOUCHED, and it is not a style preference.** `draftProblems`
   * answers *may this be sent*, and an untouched empty summary is a problem by that measure — so
   * a dialog that drew every problem on open would greet somebody with five red lines about
   * fields they have not reached yet. The problems still disable the button; this decides which
   * of them are drawn.
   *
   * ⚠️ A failed send marks every field touched, so the second press explains itself.
   */
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  const open = useCallback((next: ShareTemplateTarget) => {
    setTarget(next);
    setDraft(draftForProject(next.projectName));
    setResult(null);
    setTouched({});
    setIsSending(false);
  }, []);

  const close = useCallback(() => {
    setTarget(null);
    setDraft(null);
    setResult(null);
    setIsSending(false);
  }, []);

  const onChange = useCallback(
    (next: ShareTemplateDraft) => {
      // ⚠️ **Two plain setters, and NOT `setTouched` inside `setDraft`'s updater.** An updater
      // must be pure — React may invoke it more than once and discard its result — so a state
      // change scheduled from inside one is a side effect in the one place that forbids them.
      if (draft) {
        // Only the fields that actually changed become touched; assigning the whole draft would
        // mark all five the moment anybody typed one character.
        const changed = (Object.keys(next) as DraftField[]).filter((field) => next[field] !== draft[field]);
        if (changed.length > 0) {
          setTouched((was) => {
            const now = { ...was };
            for (const field of changed) now[field] = true;
            return now;
          });
        }
      }
      setDraft(next);
    },
    [draft]
  );

  const onSend = useCallback(() => {
    if (!target || !draft) return;
    setTouched({ slug: true, title: true, summary: true, category: true, licence: true });
    if (draftProblems(draft).length > 0) return;

    setIsSending(true);
    setResult(null);
    readCommunitySession()
      .then((session) =>
        shareAsTemplate(
          {
            fs: filesystem,
            sink: new CommunityApiClient({ baseUrl: input.baseUrl, token: session?.token ?? null })
          },
          {
            projectDir: target.projectDir,
            proposedSlug: draft.slug.trim(),
            title: draft.title.trim(),
            summary: draft.summary.trim(),
            category: draft.category,
            attestedLicence: draft.licence
          }
        )
      )
      .then((outcome) => setResult(describeShareOutcome(outcome)))
      .catch((error: unknown) =>
        // ⚠️ `shareAsTemplate` returns rather than throws on every outcome it knows about, so
        // reaching here means a disk that could not be read — not a refusal. It is still shown:
        // a dialog that spins forever is the failure this catch exists to prevent.
        setResult({
          tone: 'refused',
          headline: 'Could not read this project',
          detail: error instanceof Error ? error.message : String(error),
          withheld: []
        })
      )
      .finally(() => setIsSending(false));
  }, [target, draft, input.baseUrl]);

  const modal = useMemo<ShareTemplateModalProps | null>(() => {
    if (!target || !draft) return null;

    const problems = draftProblems(draft);
    const shown: Partial<Record<DraftField, string>> = {};
    for (const field of ['title', 'slug', 'summary', 'category', 'licence'] as DraftField[]) {
      const message = touched[field] ? problemFor(problems, field) : null;
      if (message) shown[field] = message;
    }

    return {
      isVisible: true,
      projectName: target.projectName,
      draft,
      onChange,
      categories: SHAREABLE_CATEGORIES,
      // ⚠️ Passed through rather than re-declared in `noodl-core-ui`: the vocabulary is closed and
      // a copy in a component nothing grades is exactly where a fourth one would rot.
      licences: SHAREABLE_LICENCES.map((l) => ({ value: l.value, label: l.label })),
      problems: shown,
      sendDisabledBecause: whySendIsOff({ draft, isSignedIn: input.isSignedIn, isSending }),
      isSending,
      result,
      onSend,
      onClose: close
    };
  }, [target, draft, touched, isSending, result, input.isSignedIn, onChange, onSend, close]);

  return { modal, open };
}
