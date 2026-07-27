import React, { useEffect, useState } from 'react';
import { filesystem } from '@noodl/platform';

import { ProjectModel } from '@noodl-models/projectmodel';
import { getCloudServices } from '@noodl-models/projectmodel.editor';
import {
  IGNORE_FILE_NAME,
  previewProjectFileExclusions,
  ProjectCopyReport
} from '@noodl-utils/compilation/build/copy';
import { createEditorCompilation } from '@noodl-utils/compilation/compilation.editor';

import { PrimaryButton } from '@noodl-core-ui/components/inputs/PrimaryButton';
import { Select } from '@noodl-core-ui/components/inputs/Select';
import { TextButton, TextButtonSize } from '@noodl-core-ui/components/inputs/TextButton';
import { PopupSection } from '@noodl-core-ui/components/popups/PopupSection';
import { Text } from '@noodl-core-ui/components/typography/Text';
import { TextType } from '@noodl-core-ui/components/typography/Text/Text';

import PopupLayer from '../../../popuplayer';
import { ToastLayer } from '../../../ToastLayer/ToastLayer';

type RenderingMode = 'csr' | 'ssr' | 'ssg';

const RENDERING_MODE_OPTIONS = [
  { label: 'Client-side rendering (default)', value: 'csr' },
  { label: 'Server-side rendering (SSR)', value: 'ssr' },
  { label: 'Static pre-rendering (SSG)', value: 'ssg' }
];

const RENDERING_MODE_HINTS: Record<RenderingMode, string> = {
  csr: 'A static folder rendered in the browser. Host it anywhere that serves files.',
  ssr: 'A Node server that renders each page — with SEO tags and data — before sending it. In the folder, run: npm install && npm run build && npm start',
  ssg: 'Pre-renders every page to static HTML at build time. In the folder, run: npm install && npm run build:ssg && npm run ssg — then host the dist/ output anywhere.'
};

function getSavedRenderingMode(): RenderingMode {
  // getSettings() — not .settings — a project saved without a settings block loads with settings undefined
  const saved = ProjectModel.instance.getSettings()['deployRenderingMode'];
  return saved === 'ssr' || saved === 'ssg' ? saved : 'csr';
}

/**
 * DEP-008 criterion 5: what will not be deployed, stated before the user picks
 * a folder rather than only in the console afterwards. A creator must be able to
 * tell "my asset is missing" from "my asset was ignored" without reading source.
 */
function ExcludedFilesSection() {
  const [report, setReport] = useState<ProjectCopyReport | null>(null);
  const [failed, setFailed] = useState(false);
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    let cancelled = false;

    previewProjectFileExclusions(ProjectModel.instance?._retainedProjectDirectory)
      .then((result) => {
        if (!cancelled) setReport(result);
      })
      .catch((error) => {
        console.error('Failed to preview deploy exclusions', error);
        if (!cancelled) setFailed(true);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  if (failed) return null;
  if (!report) {
    return (
      <Text hasBottomSpacing textType={TextType.Shy}>
        Checking which project files will be deployed…
      </Text>
    );
  }

  const ignoreFileHint = report.hasIgnoreFile
    ? `Rules come from the defaults plus your ${IGNORE_FILE_NAME}.`
    : `No ${IGNORE_FILE_NAME} in this project — default rules only. Add one to exclude more, or a "!" line to re-include a default.`;

  if (report.excluded.length === 0) {
    return (
      <Text hasBottomSpacing textType={TextType.Shy} testId="deploy-exclusions-summary">
        {report.copiedCount} project file{report.copiedCount === 1 ? '' : 's'} will be deployed; none excluded.{' '}
        {ignoreFileHint}
      </Text>
    );
  }

  return (
    <>
      <Text hasBottomSpacing textType={TextType.Shy} testId="deploy-exclusions-summary">
        {report.copiedCount} project file{report.copiedCount === 1 ? '' : 's'} will be deployed. {report.excluded.length}{' '}
        will not: {report.excludedByRule.map((r) => `${r.rule} (${r.count})`).join(', ')}. {ignoreFileHint}
      </Text>

      <TextButton
        label={showDetails ? 'Hide excluded files' : 'Show excluded files'}
        size={TextButtonSize.Small}
        onClick={() => setShowDetails((value) => !value)}
        testId="deploy-exclusions-toggle"
      />

      {showDetails && (
        <div
          style={{ maxHeight: 160, overflowY: 'auto', marginTop: 8, marginBottom: 8 }}
          data-test="deploy-exclusions-list"
        >
          {report.excluded.map((file) => (
            <Text key={`${file.source}:${file.rule}:${file.path}`} textType={TextType.Shy}>
              {file.path} — {file.rule}
              {file.reason ? ` (${file.reason})` : ''}
            </Text>
          ))}
        </div>
      )}
    </>
  );
}

export function DeployToFolderTab() {
  // WF-007: the project's own cloudservices pointer (set via the Backend
  // Services panel — local backend auto-set or a manually entered external
  // endpoint) is baked into the export directly. There is no more "pick from
  // a list of pre-registered Cloud Services environments" step — that list,
  // and the master-key deploy pass it fed, were retired with CloudServicePanel.
  const cloudServices = ProjectModel.instance ? getCloudServices(ProjectModel.instance) : undefined;

  const [renderingMode, setRenderingMode] = useState<RenderingMode>(getSavedRenderingMode);

  function onRenderingModeChanged(value: string) {
    const mode: RenderingMode = value === 'ssr' || value === 'ssg' ? value : 'csr';
    setRenderingMode(mode);
    ProjectModel.instance.setSetting('deployRenderingMode', mode);
  }

  function onPickFolderClicked() {
    const activityId = 'deploying-project';

    filesystem
      .openDialog({
        allowCreateDirectory: true
      })
      .then((direntry) => {
        const compilation = createEditorCompilation(ProjectModel.instance)
          .addProjectBuildScripts()
          .addBuildScript({
            async onPreBuild() {
              ToastLayer.showActivity('Deploying', activityId);
            },
            async onPostBuild({ status }) {
              ToastLayer.hideActivity(activityId);
              // The success toast is raised by the caller instead, so it can
              // carry the DEP-008 exclusion count from the deploy result.
              if (status !== 'success') {
                ToastLayer.showError('Deploy failed.');
              }
            }
          });

        const environment =
          cloudServices && cloudServices.endpoint
            ? {
                id: cloudServices.id,
                appId: cloudServices.appId,
                url: cloudServices.endpoint,
                type: cloudServices.type
              }
            : undefined;

        // SSR and SSG share one deployment layout (the server at the root, the
        // browser app in public/) — which mode runs is decided by the npm script
        // the user starts. See static/ssr/README.md, deployed with the folder.
        const runtimeType = renderingMode === 'csr' ? undefined : 'ssr';

        // NOTE: Fire-n-forget
        compilation
          .deployToFolder(direntry, {
            environment,
            runtimeType
          })
          .then((result) => {
            // DEP-008 criterion 5: the count is in the toast, the per-path list
            // with its rule is in the console (see deployer.ts logCopyReport).
            const excluded = result?.copyReport?.excluded.length ?? 0;
            const stale = result?.copyReport?.staleExclusions.length ?? 0;

            if (stale > 0) {
              // A path that is excluded now but exists in the output folder was
              // put there by an earlier deploy, and is still being served.
              ToastLayer.showError(
                `Deploy successful, but ${stale} excluded path${stale === 1 ? '' : 's'} already existed in the output folder ` +
                  'from an earlier deploy and were left in place. Delete them by hand — see the console.'
              );
              return;
            }

            ToastLayer.showSuccess(
              excluded === 0
                ? 'Deploy successful!'
                : `Deploy successful! ${excluded} project file${excluded === 1 ? '' : 's'} excluded — see the console for the list.`
            );
          })
          .catch(() => {
            // onPostBuild already surfaced the failure.
          });
      });

    PopupLayer.instance.hidePopup();
  }

  return (
    <>
      <PopupSection>
        <Text hasBottomSpacing textType={TextType.DefaultContrast}>
          Deploy your frontend to a local folder
        </Text>

        <Text hasBottomSpacing textType={TextType.Shy}>
          Runtime: {ProjectModel.instance.runtimeVersion === 'react19' ? 'React 19' : 'React 18.3 (default)'} — change
          it under Project Settings → Runtime.
        </Text>

        <Select
          options={RENDERING_MODE_OPTIONS}
          onChange={(value: string) => onRenderingModeChanged(value)}
          value={renderingMode}
          label="Rendering mode"
          hasBottomSpacing
          testId="deploy-rendering-mode-select"
        />

        <Text hasBottomSpacing textType={TextType.Shy}>
          {RENDERING_MODE_HINTS[renderingMode]}
        </Text>

        <Text hasBottomSpacing textType={TextType.Shy}>
          {cloudServices?.endpoint
            ? `Connected cloud services: ${cloudServices.endpoint}`
            : 'No cloud services connected — set one in the Backend Services panel.'}
        </Text>

        <ExcludedFilesSection />

        <PrimaryButton label="Pick folder" onClick={onPickFolderClicked} />
      </PopupSection>
    </>
  );
}
