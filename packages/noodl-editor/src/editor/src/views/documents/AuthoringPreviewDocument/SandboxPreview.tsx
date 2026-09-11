/**
 * AIX-008 — The rendered half of the authoring surface
 *
 * A second viewer window, fed the staged candidate instead of the project. It
 * is a real runtime — clickable, typing works — running against sample data, so
 * the user is never asked to accept work they have only seen as a graph.
 *
 * Three things make this safe to point at unaccepted work:
 *
 * - the export is *spliced*, never applied: `buildSandboxExport` composes the
 *   project's export with the candidate as root and adds nothing to
 *   `ProjectModel`, so reject stays the absence of a call;
 * - the window registers as `sandbox-<id>`, which is the only reason the editor
 *   feeds it something different from the live preview panel;
 * - it runs in its own Electron partition, so the fake session it signs into
 *   cannot touch the session the real preview is using.
 *
 * BEN-004 moved the plumbing and the toolbar into `views/SandboxSurface`, where
 * the component bench uses the same two. Nothing about this document's
 * behaviour changed; it now has a sibling, and the phase's standing constraint
 * is that the two share a substrate rather than a resemblance.
 *
 * @module noodl-editor/views/documents/AuthoringPreviewDocument/SandboxPreview
 */

import React, { useEffect, useState } from 'react';

import {
  buildSandboxExport,
  type AgentSampleData,
  type ComponentFiles,
  type SandboxExport
} from '@noodl-models/AiAssistant/authoring';
import { ProjectModel } from '@noodl-models/projectmodel';

import { Text, TextType } from '@noodl-core-ui/components/typography/Text';

import {
  SandboxToolbar,
  SANDBOX_PARTITION,
  SANDBOX_WEBVIEW_ATTRIBUTES,
  useSandboxViewer
} from '../../SandboxSurface';
import { SandboxDataEditor } from './SandboxDataEditor';
import css from './SandboxPreview.module.scss';

export interface SandboxPreviewProps {
  /** The staged candidate. Absent while the agent is still writing one. */
  files?: ComponentFiles;
  /**
   * AIB-004: other staged candidates from the same plan, spliced in beside this
   * one so a page that instantiates a sibling operation's component renders.
   * Must be referentially stable — it is an effect dependency.
   */
  siblings?: ComponentFiles[];
  /** Sample data the authoring model supplied with the candidate. */
  sampleData?: AgentSampleData;
  /** Bumped by the session on every new submission, so a refine re-renders. */
  revision: number;
  /**
   * AIB-004: where to look instead, appended when there is nothing to render.
   * The graph is *beside* this preview in the single-component loop and behind
   * a view toggle in a plan review, and the empty state has to say which.
   */
  unrenderableHint?: string;
}

export function SandboxPreview({ files, siblings, sampleData, revision, unrenderableHint }: SandboxPreviewProps) {
  const [useSampleData, setUseSampleData] = useState(true);
  /**
   * POL-008 — signed in by default.
   *
   * The `User` node's `authenticated` output is literally
   * `this._internal.model !== undefined`, so a seeded session makes it **true in
   * every preview** and the signed-out branch of a graph stops being something
   * the preview can show. Before this it was the other way round — signed-out
   * was the only state reachable — which is the reported defect. Both are states
   * worth seeing, so it is a toggle; the default is the one a profile page needs
   * with no clicks.
   *
   * Preview state, never project state. Nothing here is written anywhere.
   */
  const [signedIn, setSignedIn] = useState(true);
  const [result, setResult] = useState<SandboxExport | undefined>(undefined);
  /**
   * BEN-006 — the records the user typed, layered above the agent's.
   *
   * Preview state under the same rule as `signedIn`, and for the same reason:
   * nothing about what someone wanted to *look at* belongs in `project.json`.
   * If it should survive, it survives as a scenario (BEN-005) — one explicit
   * save, one storage mechanism, not two.
   */
  const [userData, setUserData] = useState<AgentSampleData | undefined>(undefined);
  const [dataOpen, setDataOpen] = useState(false);

  const viewer = useSandboxViewer({ json: result?.json, useSampleData, signedIn });

  // Build eagerly rather than on connect: the empty state ("nothing visual to
  // render") should appear immediately, not once a window has booted.
  useEffect(() => {
    if (!files || !ProjectModel.instance) {
      setResult(undefined);
      return;
    }
    setResult(
      buildSandboxExport({
        project: ProjectModel.instance,
        files,
        siblings,
        sampleData,
        userData,
        useSampleData,
        signedIn
      })
    );
  }, [files, siblings, sampleData, userData, revision, useSampleData, signedIn]);

  const message = !files
    ? 'Nothing staged yet — the preview appears as soon as the agent submits.'
    : result?.unrenderable
      ? [result.unrenderable, unrenderableHint].filter(Boolean).join(' ')
      : undefined;

  return (
    <div className={css.Root}>
      <SandboxToolbar
        summary={result?.summary}
        notice={result?.notice}
        useSampleData={useSampleData}
        onUseSampleDataChange={setUseSampleData}
        signedIn={signedIn}
        onSignedInChange={setSignedIn}
        hasDataset={Boolean(result?.dataset)}
        dataOpen={dataOpen}
        onDataOpenChange={setDataOpen}
      />

      {/*
        Kept mounted across the reload an Apply causes. The dataset rides in the
        export's metadata, so a data change is a changed export and the runtime
        calls `location.reload()` — an unexplained white flash with the panel
        gone reads as a crash, which is a bug report rather than a feature.
      */}
      {useSampleData && dataOpen && result?.dataset && (
        <SandboxDataEditor
          dataset={result.dataset}
          userData={userData}
          onApply={setUserData}
          onClose={() => setDataOpen(false)}
        />
      )}

      <div className={css.Stage}>
        {message ? (
          <div className={css.Empty}>
            <Text textType={TextType.Secondary}>{message}</Text>
          </div>
        ) : (
          <webview
            className={css.Webview}
            ref={viewer.attachWebview}
            partition={SANDBOX_PARTITION}
            src={viewer.src}
            {...SANDBOX_WEBVIEW_ATTRIBUTES}
          />
        )}
      </div>
    </div>
  );
}
