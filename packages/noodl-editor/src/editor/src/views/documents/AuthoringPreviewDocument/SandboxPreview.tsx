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
import css from './SandboxPreview.module.scss';

export interface SandboxPreviewProps {
  /** The staged candidate. Absent while the agent is still writing one. */
  files?: ComponentFiles;
  /** Sample data the authoring model supplied with the candidate. */
  sampleData?: AgentSampleData;
  /** Bumped by the session on every new submission, so a refine re-renders. */
  revision: number;
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

export function SandboxPreview({ files, sampleData, revision }: SandboxPreviewProps) {
  const sessionId = useMemo(() => guid(), []);
  const clientId = `sandbox-${sessionId}`;
  const webviewRef = useRef<Electron.WebviewTag>(null);

  const [useSampleData, setUseSampleData] = useState(true);
  const [result, setResult] = useState<SandboxExport | undefined>(undefined);

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
    setResult(buildSandboxExport({ project: ProjectModel.instance, files, sampleData, useSampleData }));
  }, [files, sampleData, revision, useSampleData]);

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
  const src = `${viewerOrigin()}/?noodl-sandbox=${sessionId}&noodl-sandbox-data=${useSampleData ? 'sample' : 'real'}`;

  const message = !files
    ? 'Nothing staged yet — the preview appears as soon as the agent submits.'
    : result?.unrenderable;

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
