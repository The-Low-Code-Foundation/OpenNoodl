import React, { useState } from 'react';
import { filesystem } from '@noodl/platform';

import { ProjectModel } from '@noodl-models/projectmodel';
import { getCloudServices } from '@noodl-models/projectmodel.editor';
import { createEditorCompilation } from '@noodl-utils/compilation/compilation.editor';

import { PrimaryButton } from '@noodl-core-ui/components/inputs/PrimaryButton';
import { Select } from '@noodl-core-ui/components/inputs/Select';
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
              if (status === 'success') {
                ToastLayer.showSuccess('Deploy successful!');
              } else {
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
        compilation.deployToFolder(direntry, {
          environment,
          runtimeType
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

        <PrimaryButton label="Pick folder" onClick={onPickFolderClicked} />
      </PopupSection>
    </>
  );
}
