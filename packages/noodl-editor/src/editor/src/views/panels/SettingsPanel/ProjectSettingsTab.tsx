import Path from 'path';
import { useEventListener } from '@noodl-hooks/useEventListener';
import { useTriggerRerenderState } from '@noodl-hooks/useTriggerRerender';
import React, { useCallback, useEffect, useState } from 'react';

import { ProjectModel } from '@noodl-models/projectmodel';

import { IconName } from '@noodl-core-ui/components/common/Icon';
import { PrimaryButton, PrimaryButtonSize, PrimaryButtonVariant } from '@noodl-core-ui/components/inputs/PrimaryButton';
import { Section } from '@noodl-core-ui/components/sidebar/Section';

import View from '../../../../../shared/ListenableView';
import { Frame } from '../../common/Frame';
import { Ports } from '../propertyeditor/DataTypes/Ports';
import { HTML_TITLE_PORT, ProjectSettingsModel } from './ProjectSettingsModel';
import { DeploySection } from './sections/DeploySection';
import { IdentitySection } from './sections/IdentitySection';
import { PWASection } from './sections/PWASection';
import { RuntimeSection } from './sections/RuntimeSection';
import { SEOSection } from './sections/SEOSection';
import { SitemapSection } from './sections/SitemapSection';
import { VariablesSection } from './sections/VariablesSection';

/**
 * PNL-008 — everything scoped to *this project*, in one tab.
 *
 * The old App Setup panel's four sections (identity, SEO, PWA, variables) are
 * now the first four groups here, ahead of the legacy port view and the runtime
 * / sitemap / deploy sections that were already in Project Settings. Order is
 * the spec's: identity first because it is what people come for, deploy last
 * because it is the exit.
 *
 * ## Why this returns a fragment
 *
 * It renders as *direct children* of `BasePanel`'s scrolling `.ChildrenContainer`
 * rather than inside a wrapper of its own, and that is load-bearing twice over:
 *
 *   - `BasePanel.module.scss` pins every direct child of a scroll container with
 *     `flex: 0 0 auto` (PNL-001). A wrapper would take that rule instead and the
 *     sections inside it would go back to squeezing.
 *   - `Ports.renderGroups()` reaches `this.el.parentElement.parentElement` to
 *     save and restore its scroll position — a hardcoded two-level walk from the
 *     legacy view to the scroller. `Frame` is level one; the scroll container has
 *     to be level two. Any wrapper between them silently breaks scroll
 *     restoration on every re-render of the legacy ports.
 */
export function ProjectSettingsTab() {
  const [propertyView, setPropertyView] = useState<View | null>(null);
  const [renderIndex, triggerRerender] = useTriggerRerenderState();
  const [, forceUpdate] = useState(0);

  // Metadata changes (appConfig) come over the global dispatcher…
  useEventListener(
    ProjectModel.instance,
    'ProjectModel.metadataChanged',
    useCallback((data: { key: string }) => {
      if (data.key === 'appConfig') {
        forceUpdate((prev) => prev + 1);
      }
    }, [])
  );

  // …and `settings` changes come off the project model itself, which is a
  // different channel entirely. The browser-title row reads the second one.
  useEffect(() => {
    const group = {};
    ProjectModel.instance.on('settingsChanged', () => forceUpdate((prev) => prev + 1), group);
    return () => {
      ProjectModel.instance.off(group);
    };
  }, []);

  useEffect(() => {
    const settingsModel = new ProjectSettingsModel();

    const view = new Ports({
      model: settingsModel
    });
    view.render();

    setPropertyView(view);

    settingsModel.on('settingsChanged', () => {
      triggerRerender();
    });

    return function () {
      settingsModel.dispose();
    };
  }, []);

  function onOpenProjectFolderClicked() {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const shell = require('@electron/remote').shell;
    shell.showItemInFolder(Path.normalize(ProjectModel.instance._retainedProjectDirectory + '/project.json'));
  }

  const config = ProjectModel.instance.getAppConfig();
  const browserTitle: string = ProjectModel.instance.settings?.[HTML_TITLE_PORT] || '';

  const updateIdentity = useCallback((updates: Partial<typeof config.identity>) => {
    const currentConfig = ProjectModel.instance.getAppConfig();

    /*
     * PNL-008 / F15. The two fields stay distinct, but they stop drifting apart
     * by accident: while the browser title is unset or still equal to the old
     * app name, renaming the app carries it along. Once someone types a
     * different browser title the two are diverged on purpose and this stops
     * touching it — the slug-follows-title rule, applied to a page title.
     *
     * Deliberately done here and not in the build: `html-processor.ts` and the
     * main process's `web-server.js` both read `settings.htmlTitle` and neither
     * can see `metadata.appConfig` (there is no IPC surface for project
     * metadata), so a build-time fallback would need a new IPC channel and would
     * still leave the panel showing an empty field. Writing the value through is
     * one line and changes no consumer.
     */
    if (typeof updates.appName === 'string') {
      const previousName = currentConfig.identity?.appName || '';
      const currentTitle: string = ProjectModel.instance.settings?.[HTML_TITLE_PORT] || '';
      if (!currentTitle || currentTitle === previousName) {
        ProjectModel.instance.setSetting(HTML_TITLE_PORT, updates.appName);
      }
    }

    ProjectModel.instance.updateAppConfig({
      identity: { ...currentConfig.identity, ...updates }
    });
  }, []);

  const updateBrowserTitle = useCallback((value: string) => {
    ProjectModel.instance.setSetting(HTML_TITLE_PORT, value);
  }, []);

  const updateSEO = useCallback((updates: Partial<typeof config.seo>) => {
    const currentConfig = ProjectModel.instance.getAppConfig();
    ProjectModel.instance.updateAppConfig({
      seo: { ...currentConfig.seo, ...updates }
    });
  }, []);

  const updatePWA = useCallback((updates: Partial<NonNullable<typeof config.pwa>>) => {
    const currentConfig = ProjectModel.instance.getAppConfig();
    ProjectModel.instance.updateAppConfig({
      pwa: { ...(currentConfig.pwa || {}), ...updates } as NonNullable<typeof config.pwa>
    });
  }, []);

  const updateVariables = useCallback((variables: typeof config.variables) => {
    // Defer the update to avoid re-render race condition
    setTimeout(() => {
      ProjectModel.instance.updateAppConfig({
        variables
      });
    }, 0);
  }, []);

  return (
    <>
      <IdentitySection
        identity={config.identity}
        onChange={updateIdentity}
        browserTitle={browserTitle}
        onBrowserTitleChange={updateBrowserTitle}
      />

      <SEOSection seo={config.seo} identity={config.identity} onChange={updateSEO} />

      <PWASection pwa={config.pwa} onChange={updatePWA} />

      <VariablesSection variables={config.variables} onChange={updateVariables} />

      {/*
        The legacy imperative ports view — head code, navigation, and whatever
        settings the project's modules contribute. It stays one contiguous block
        with its own group headers rather than being interleaved with the React
        sections around it: it renders its own `PropertyGroups` tree and there is
        no seam to interleave at.

        `isContentSize` is PNL-008's fix for the hazard PNL-004 flagged. `Frame`
        defaults to `height: 100%`, which — as a `flex: 0 0 auto` child of the
        scroll container — pinned this block to the full panel height however
        little was in it, leaving a tall gap before Runtime. It now takes its
        content's height and the full panel width.
      */}
      <Frame instance={propertyView} refresh={renderIndex} isContentSize isFitWidth />

      <RuntimeSection />
      <SitemapSection />
      <DeploySection />

      <Section hasGutter hasVisibleOverflow>
        <PrimaryButton
          icon={IconName.FolderOpen}
          size={PrimaryButtonSize.Small}
          label="Open project folder"
          variant={PrimaryButtonVariant.MutedOnLowBg}
          onClick={onOpenProjectFolderClicked}
          isGrowing
        />
      </Section>
    </>
  );
}
