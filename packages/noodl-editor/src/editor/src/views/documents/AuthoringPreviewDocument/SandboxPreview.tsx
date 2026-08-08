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
 * @module noodl-editor/views/documents/AuthoringPreviewDocument/SandboxPreview
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';

import {
  buildSandboxExport,
  type AgentSampleData,
  type ComponentFiles,
  type SandboxExport
} from '@noodl-models/AiAssistant/authoring';
import { ProjectModel } from '@noodl-models/projectmodel';

import { guid } from '@noodl-utils/utils';

import { PreviewTokenInjector } from '../../../services/PreviewTokenInjector';

import { FeedbackType } from '@noodl-constants/FeedbackType';

import { Icon, IconName, IconSize } from '@noodl-core-ui/components/common/Icon';
import { PrimaryButton, PrimaryButtonSize, PrimaryButtonVariant } from '@noodl-core-ui/components/inputs/PrimaryButton';
import { Text, TextType } from '@noodl-core-ui/components/typography/Text';

import { ViewerConnection } from '../../../ViewerConnection';
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

/** Its own storage jar: the sandbox signs in as a fake user and must not leak that. */
const PARTITION = 'persist:nodegx-authoring-sandbox';

/**
 * Same webview settings the live preview uses. Passed as a spread because the
 * React typings declare these as booleans and HTML attributes are strings.
 */
const WEBVIEW_ATTRIBUTES: Record<string, string> = {
  disablewebsecurity: 'true',
  webpreferences: 'allowRunningInsecureContent'
};

function viewerOrigin(): string {
  const protocol = process.env.ssl ? 'https://' : 'http://';
  const port = process.env.NOODLPORT || 8574;
  return `${protocol}localhost:${port}`;
}

export function SandboxPreview({ files, siblings, sampleData, revision, unrenderableHint }: SandboxPreviewProps) {
  const sessionId = useMemo(() => guid(), []);
  const clientId = `sandbox-${sessionId}`;
  const webviewRef = useRef<Electron.WebviewTag>(null);

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

  // The provider is called whenever the client (re)connects, which is not when
  // this component renders — it reads the latest build through a ref.
  const latest = useRef<SandboxExport | undefined>(undefined);
  latest.current = result;

  useEffect(() => {
    ViewerConnection.instance.registerSandboxExport(clientId, () => latest.current?.json);
    return () => ViewerConnection.instance.unregisterSandboxExport(clientId);
  }, [clientId]);

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

  useEffect(() => {
    if (result?.json) ViewerConnection.instance.exportSandbox(clientId);
  }, [clientId, result]);

  // Design tokens live in the editor, not the export: without this the preview
  // renders every `var(--token)` unresolved, which is exactly the styling
  // AIX-006 taught the agent to write.
  useEffect(() => {
    const webview = webviewRef.current;
    if (!webview) return;

    const onReady = () => PreviewTokenInjector.instance.notifyDomReady(webview);
    webview.addEventListener('dom-ready', onReady);
    return () => {
      webview.removeEventListener('dom-ready', onReady);
      PreviewTokenInjector.instance.clearWebview(webview);
    };
  }, [webviewRef.current]);

  // The network shim is installed from the URL before the runtime exists, so
  // switching data sources reloads the window rather than toggling in place.
  //
  // ⚠️ The auth state rides in the URL for the same reason, and it must: the
  // session is read once, in `UserService`'s constructor, and that service is a
  // singleton that is never rebuilt. Clearing the key under a running preview
  // would change storage and change nothing on screen.
  const src =
    `${viewerOrigin()}/?noodl-sandbox=${sessionId}` +
    `&noodl-sandbox-data=${useSampleData ? 'sample' : 'real'}` +
    `&noodl-sandbox-auth=${signedIn ? 'in' : 'out'}`;

  const message = !files
    ? 'Nothing staged yet — the preview appears as soon as the agent submits.'
    : result?.unrenderable
      ? [result.unrenderable, unrenderableHint].filter(Boolean).join(' ')
      : undefined;

  return (
    <div className={css.Root}>
      <div className={css.Bar}>
        <Icon icon={IconName.Play} size={IconSize.Small} />
        <div className={css.Summary}>
          <Text textType={TextType.Secondary}>{result?.summary ?? 'Preview'}</Text>
        </div>
        {/*
          A class whose field shape could not be inferred renders as blank rows
          under a heading that claims results — indistinguishable, to the user,
          from a component that does not work. Saying so is the same rule the
          logic-only candidate follows, applied to the data instead of the graph.
        */}
        {result?.notice ? (
          <div className={css.Notice} title={result.notice}>
            <Icon icon={IconName.WarningTriangle} size={IconSize.Small} />
            <Text textType={FeedbackType.Notice}>Fields unknown</Text>
          </div>
        ) : null}
        {/*
          POL-008: one button, not a second pair. It is a toggle between two
          states of the same thing, and it only exists while the sandbox is
          serving sample data — "signed out" against a real backend is whatever
          the real backend says, and offering to change it there would be a
          claim this preview cannot honour.
        */}
        {useSampleData && (
          <PrimaryButton
            label={signedIn ? 'Sign out' : 'Sign in'}
            size={PrimaryButtonSize.Small}
            variant={PrimaryButtonVariant.MutedOnLowBg}
            onClick={() => setSignedIn((current) => !current)}
          />
        )}
        {/*
          BEN-006 — the same gating `Sign out` uses, and for the same reason:
          offering to edit the data against a real backend would be a claim this
          preview cannot honour. There is nothing to edit until the export has
          been built, either.
        */}
        {useSampleData && result?.dataset && (
          <PrimaryButton
            label="Data"
            size={PrimaryButtonSize.Small}
            variant={dataOpen ? undefined : PrimaryButtonVariant.MutedOnLowBg}
            onClick={() => setDataOpen((current) => !current)}
          />
        )}
        <div className={css.Modes}>
          <PrimaryButton
            label="Sample data"
            size={PrimaryButtonSize.Small}
            variant={useSampleData ? undefined : PrimaryButtonVariant.MutedOnLowBg}
            onClick={() => setUseSampleData(true)}
          />
          <PrimaryButton
            label="Real backend"
            size={PrimaryButtonSize.Small}
            variant={useSampleData ? PrimaryButtonVariant.MutedOnLowBg : undefined}
            onClick={() => setUseSampleData(false)}
          />
        </div>
      </div>

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
          <webview className={css.Webview} ref={webviewRef} partition={PARTITION} src={src} {...WEBVIEW_ATTRIBUTES} />
        )}
      </div>
    </div>
  );
}
