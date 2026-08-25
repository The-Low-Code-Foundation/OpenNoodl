/**
 * TUT-004 — the tutorials list, and installing one without leaving the editor.
 *
 * ## 🔴 The hook owns the STATE. `tutorialsview` owns the DECISIONS.
 *
 * `useCommunityPeople` states the split this follows: what the person has done is React state and
 * belongs to the surface; what that means is a pure function a spec can call. Everything here is
 * a `useState` and a call — which row is busy, which are installed, what the last attempt said.
 * Every sentence and every button label comes from `composeTutorials`.
 *
 * ## ⚠️ One action, and the scorecard still shown before the bundle lands
 *
 * AC1 wants one action; AC3 wants what the harness checked shown *before* the files land, not
 * after. Those look opposed and are not: the row's click starts the install, and the `confirm`
 * hook — which runs after the scorecard and before the write — records the line so it is on
 * screen by the time anything is on disk. What AC3 forbids is a surface that installs silently
 * and then reports; a surface that says what it checked, as it checks it, is the thing being
 * asked for.
 *
 * 🔴 **A refused bundle is reported and nothing is written**, which is `lessonplatforminstall`'s
 * guarantee rather than this file's — the note here is only the sentence.
 *
 * @module noodl-editor/hooks/useTutorialInstall
 */

import { useCallback, useEffect, useMemo, useState } from 'react';

import { CommunityApiClient, type Paged, type Read, type TutorialSummary } from '@noodl-models/community/communityapi';
import { COMMUNITY_URL } from '@noodl-models/community/communityorigin';
import { readCommunitySession, type CommunitySession } from '@noodl-models/community/communitysession';
import { composeTutorials, noteForOutcome, type TutorialsView } from '@noodl-models/community/tutorialsview';
import { LearningFolderModel } from '@noodl-models/learningfolder';
import { installTutorialFromPlatform, slugFromBundleUrl } from '@noodl-models/lessonplatforminstall';
import type { PlatformInstallDeps } from '@noodl-models/lessonplatforminstall';
import { stagingFs, stagingRoot } from '@noodl-models/lessonplatformstaging';

export type TutorialsPane = {
  view: TutorialsView;
  /** The one action. A no-op for a row that is busy or already installed. */
  onInstall: (slug: string) => void;
  onRetry: () => void;
};

/** Which tutorials are already in the Learning folder, by the slug their source url names. */
function installedSlugs(register: LearningFolderModel): Set<string> {
  const out = new Set<string>();
  for (const entry of register.list()) {
    if (entry.source.kind !== 'platform') continue;
    const slug = slugFromBundleUrl(entry.source.url);
    if (slug) out.add(slug);
  }
  return out;
}

export function useTutorialInstall(): TutorialsPane {
  const [read, setRead] = useState<Read<Paged<TutorialSummary>> | null>(null);
  const [busySlug, setBusySlug] = useState<string | null>(null);
  const [installed, setInstalled] = useState<ReadonlySet<string>>(new Set<string>());
  const [notes, setNotes] = useState<ReadonlyMap<string, string>>(new Map());
  const [nonce, setNonce] = useState(0);
  // ⚠️ `readCommunitySession` is ASYNC — it reads the editor's JSON store. `useCommunityPeople`
  // does the same two-step for the same reason.
  const [session, setSession] = useState<CommunitySession | null | undefined>(undefined);

  useEffect(() => {
    let live = true;
    void readCommunitySession().then((found) => {
      if (live) setSession(found);
    });
    return () => {
      live = false;
    };
  }, [nonce]);

  const client = useMemo(
    // 🔴 The token matters even though this surface reads signed out: D15 refuses an org-minor by
    // answering 404, and it can only do that if it knows who is asking. A client built without
    // the session would show a pupil tutorials their school has switched off.
    () => new CommunityApiClient({ baseUrl: COMMUNITY_URL, token: session?.token ?? null }),
    [session]
  );

  useEffect(() => {
    if (session === undefined) return; // still reading the store — `read` stays null, view stays loading
    let live = true;
    setRead(null);
    client.tutorials().then((next) => {
      if (!live) return;
      setRead(next);
      try {
        setInstalled(installedSlugs(LearningFolderModel.instance));
      } catch {
        // A register we cannot read means we cannot say a lesson is installed. Offering to
        // install one that already is, is recoverable; claiming one is when it is not, is not.
      }
    });
    return () => {
      live = false;
    };
  }, [client, session, nonce]);

  const note = useCallback((slug: string, sentence: string | null) => {
    setNotes((previous) => {
      const next = new Map(previous);
      if (sentence === null) next.delete(slug);
      else next.set(slug, sentence);
      return next;
    });
  }, []);

  const onInstall = useCallback(
    (slug: string) => {
      if (busySlug !== null || installed.has(slug)) return;
      setBusySlug(slug);
      note(slug, null);

      const register = LearningFolderModel.instance;
      const deps: PlatformInstallDeps = {
        register,
        source: client,
        fs: stagingFs(),
        stagingRoot: stagingRoot()
      };

      installTutorialFromPlatform(
        {
          slug,
          // 🔴 AC3. This runs after the scorecard and BEFORE anything is written, so the line is
          // on screen by the time the files land. Always proceeds — the panel is not asking.
          confirm: (preview) => {
            note(slug, `Checking… ${preview.checked}`);
            return true;
          }
        },
        deps
      )
        .then((outcome) => {
          note(slug, noteForOutcome(outcome));
          if (outcome.result === 'installed') {
            setInstalled((previous) => new Set([...previous, slug]));
          }
        })
        .catch((err: unknown) => {
          // `installTutorialFromPlatform` is written not to throw; if it does, the row still has
          // to say something rather than staying on "Installing…" forever.
          note(slug, `The install did not finish: ${err instanceof Error ? err.message : String(err)}`);
        })
        .finally(() => setBusySlug(null));
    },
    [busySlug, client, installed, note]
  );

  const view = useMemo(
    () => composeTutorials(read, { busySlug, installedSlugs: installed, notes }),
    [read, busySlug, installed, notes]
  );

  return { view, onInstall, onRetry: () => setNonce((n) => n + 1) };
}
