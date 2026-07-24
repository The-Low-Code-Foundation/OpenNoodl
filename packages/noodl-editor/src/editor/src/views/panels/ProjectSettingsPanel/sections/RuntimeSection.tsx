import React, { useState } from 'react';

import { ProjectModel } from '@noodl-models/projectmodel';

import { Box } from '@noodl-core-ui/components/layout/Box';
import { PropertyPanelRow } from '@noodl-core-ui/components/property-panel/PropertyPanelInput';
import { PropertyPanelSelectInput } from '@noodl-core-ui/components/property-panel/PropertyPanelSelectInput';
import { CollapsableSection } from '@noodl-core-ui/components/sidebar/CollapsableSection';
import { Text, TextType } from '@noodl-core-ui/components/typography/Text';

import { EventDispatcher } from '../../../../../../shared/utils/EventDispatcher';
import { scanForLegacyPatterns } from '../../../../models/migration';
import type { LegacyPatternScan } from '../../../../models/migration';

/**
 * Per-project runtime React selection (RUN-001 slice 4).
 *
 * One setting drives everything: the editor preview, folder deploys and
 * noodl-preview all read `project.runtimeVersion` and serve the matching
 * vendored React pair. Absent marker = the default React 18.3.1 pair,
 * byte-identical to what every project has shipped with since Dec 2025.
 *
 * Opting into React 19 runs a quick scan of the project's script files for
 * APIs React 19 removed relative to 18 (findDOMNode, ReactDOM.render, string
 * refs, legacy context, …). Findings are informational — the preview is the
 * real test — so the switch is never blocked.
 */

const RUNTIME_OPTIONS = [
  { label: 'React 18.3 (default)', value: 'default' },
  { label: 'React 19', value: 'react19' }
];

export function RuntimeSection() {
  const [selected, setSelected] = useState<string>(
    ProjectModel.instance.runtimeVersion === 'react19' ? 'react19' : 'default'
  );
  const [scan, setScan] = useState<LegacyPatternScan | null>(null);
  const [isScanning, setIsScanning] = useState(false);

  async function handleChange(value: string | number) {
    if (value === selected) return;
    setSelected(String(value));
    setScan(null);

    if (value === 'react19') {
      ProjectModel.instance.setRuntimeVersion('react19');

      // Informational compatibility scan — never blocks the switch.
      const projectDir = ProjectModel.instance._retainedProjectDirectory;
      if (projectDir) {
        setIsScanning(true);
        try {
          setScan(await scanForLegacyPatterns(projectDir));
        } catch (error) {
          console.error('[RuntimeSection] compatibility scan failed:', error);
        } finally {
          setIsScanning(false);
        }
      }
    } else {
      // Clear the marker entirely: absent means the default pair.
      ProjectModel.instance.setRuntimeVersion(undefined);
    }

    // Reload the preview so it picks up the newly selected React pair.
    EventDispatcher.instance.emit('viewer-refresh');
  }

  const findings = scan?.files ?? [];

  return (
    <CollapsableSection title="Runtime" hasGutter hasVisibleOverflow>
      <Box hasBottomSpacing>
        <Text>The React version powering the preview and all new deploys of this project.</Text>
      </Box>

      <PropertyPanelRow label="React version">
        <PropertyPanelSelectInput value={selected} properties={{ options: RUNTIME_OPTIONS }} onChange={handleChange} />
      </PropertyPanelRow>

      <Box hasTopSpacing>
        <Text textType={TextType.Secondary}>
          Already-deployed apps keep the React they were deployed with until you redeploy.
        </Text>
      </Box>

      {isScanning && (
        <Box hasTopSpacing>
          <Text textType={TextType.Secondary}>Scanning project scripts for React 19 compatibility…</Text>
        </Box>
      )}

      {scan && findings.length === 0 && (
        <Box hasTopSpacing>
          <Text textType={TextType.Secondary}>
            Compatibility scan: no APIs removed in React 19 found in project script files.
          </Text>
        </Box>
      )}

      {findings.length > 0 && (
        <Box hasTopSpacing>
          <Text hasBottomSpacing>
            Compatibility scan found {findings.length} use{findings.length === 1 ? '' : 's'} of APIs removed in React
            19. The preview is the real test — check these if something breaks:
          </Text>
          {findings.slice(0, 20).map((finding, i) => (
            <Text key={i} textType={TextType.Secondary}>
              {finding.pattern} — {finding.path.replace(ProjectModel.instance._retainedProjectDirectory + '/', '')}:
              {finding.line}
            </Text>
          ))}
          {findings.length > 20 && (
            <Text textType={TextType.Secondary}>…and {findings.length - 20} more (see DevTools console).</Text>
          )}
        </Box>
      )}
    </CollapsableSection>
  );
}
