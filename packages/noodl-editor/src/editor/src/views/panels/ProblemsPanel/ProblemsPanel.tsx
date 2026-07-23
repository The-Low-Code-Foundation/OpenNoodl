/**
 * SUB-006 — Problems panel
 *
 * Surfaces semantic-validation diagnostics for the open project and lets the
 * user click a problem to jump to the offending node. Data comes from
 * `ProjectValidationService` (which re-validates on every graph/project change);
 * this component only renders and navigates.
 *
 * @module noodl-editor/views/panels/ProblemsPanel/ProblemsPanel
 */

import { NodeGraphContextTmp } from '@noodl-contexts/NodeGraphContext/NodeGraphContext';
import { useModernModel } from '@noodl-hooks/useModel';
import React, { useEffect, useMemo } from 'react';

import { ProjectModel } from '@noodl-models/projectmodel';

import { FeedbackType } from '@noodl-constants/FeedbackType';
import { Icon, IconName, IconSize } from '@noodl-core-ui/components/common/Icon';
import { IconButton, IconButtonVariant } from '@noodl-core-ui/components/inputs/IconButton';
import { Box } from '@noodl-core-ui/components/layout/Box';
import { ListItem } from '@noodl-core-ui/components/layout/ListItem';
import { ScrollArea } from '@noodl-core-ui/components/layout/ScrollArea';
import { HStack } from '@noodl-core-ui/components/layout/Stack';
import { BasePanel } from '@noodl-core-ui/components/sidebar/BasePanel';
import { ExperimentalFlag } from '@noodl-core-ui/components/sidebar/ExperimentalFlag';
import { Section, SectionVariant } from '@noodl-core-ui/components/sidebar/Section';
import { Text, TextType } from '@noodl-core-ui/components/typography/Text';

import { Diagnostic, Severity, sortDiagnostics } from '../../../validation/diagnostics';
import { ProjectValidationEvent, ProjectValidationService } from './ProjectValidationService';

// ── Severity → presentation ────────────────────────────────────────────────────

const SEVERITY_ICON: Record<Severity, IconName> = {
  error: IconName.WarningCircleFilled,
  warning: IconName.WarningTriangle,
  info: IconName.CircleOpen
};

const SEVERITY_VARIANT: Record<Severity, FeedbackType | TextType> = {
  error: FeedbackType.Danger,
  warning: FeedbackType.Notice,
  info: TextType.Secondary
};

// ── Navigation ──────────────────────────────────────────────────────────────────

function navigateTo(diagnostic: Diagnostic): void {
  const project = ProjectModel.instance;
  if (!project) return;
  const component = project.getComponentWithName(diagnostic.location.component);
  if (!component) return;

  const args: { node?: { id: string }; pushHistory: boolean } = { pushHistory: true };
  if (diagnostic.location.nodeId) {
    args.node = { id: diagnostic.location.nodeId };
  }
  // @ts-expect-error switchToComponent accepts a { id } stand-in for the node.
  NodeGraphContextTmp.nodeGraph.switchToComponent(component, args);
}

// ── Row ──────────────────────────────────────────────────────────────────────────

function diagnosticText(d: Diagnostic): string {
  let text = d.message;
  if (d.suggestion) text += `  — did you mean “${d.suggestion}”?`;
  return text;
}

function DiagnosticRow({ diagnostic }: { diagnostic: Diagnostic }) {
  const loc = diagnostic.location;
  const secondary = [loc.nodeType && `${loc.nodeType}`, loc.nodeId && `#${loc.nodeId}`, loc.port && `${loc.plug ?? 'port'}: ${loc.port}`]
    .filter(Boolean)
    .join('  ·  ');

  return (
    <ListItem
      icon={SEVERITY_ICON[diagnostic.severity]}
      iconVariant={SEVERITY_VARIANT[diagnostic.severity]}
      text={diagnosticText(diagnostic)}
      gutter={2}
      onClick={() => navigateTo(diagnostic)}
    >
      {secondary ? (
        <Box hasLeftSpacing={4}>
          <Text textType={TextType.Shy}>{secondary}</Text>
        </Box>
      ) : null}
    </ListItem>
  );
}

// ── Panel ──────────────────────────────────────────────────────────────────────

export function ProblemsPanel() {
  const service = useModernModel(ProjectValidationService.instance, [ProjectValidationEvent.Changed]);

  useEffect(() => {
    service.start();
  }, []);

  const report = service.report;

  const grouped = useMemo(() => {
    if (!report) return [];
    const byComponent = new Map<string, Diagnostic[]>();
    for (const d of sortDiagnostics(report.diagnostics)) {
      const list = byComponent.get(d.location.component) ?? [];
      list.push(d);
      byComponent.set(d.location.component, list);
    }
    return [...byComponent.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1));
  }, [report]);

  const summary = report?.summary;

  return (
    <BasePanel title="Problems" isFill>
      <ExperimentalFlag />
      <Section variant={SectionVariant.PanelShy} hasGutter>
        <HStack UNSAFE_style={{ justifyContent: 'space-between', alignItems: 'center' }}>
          <Text textType={TextType.Secondary}>
            {summary
              ? `${summary.errors} error${summary.errors === 1 ? '' : 's'} · ` +
                `${summary.warnings} warning${summary.warnings === 1 ? '' : 's'}`
              : 'No project open'}
          </Text>
          <IconButton
            variant={IconButtonVariant.Transparent}
            icon={IconName.Refresh}
            size={IconSize.Small}
            onClick={() => service.revalidateNow()}
          />
        </HStack>
      </Section>

      <ScrollArea>
        <Box hasYSpacing UNSAFE_style={{ width: '100%' }}>
          {report && report.diagnostics.length === 0 && (
            <Box hasXSpacing hasYSpacing>
              <HStack UNSAFE_style={{ alignItems: 'center', gap: 8 }}>
                <Icon icon={IconName.Check} variant={FeedbackType.Success} size={IconSize.Small} />
                <Text textType={TextType.Secondary}>No problems found.</Text>
              </HStack>
            </Box>
          )}

          {grouped.map(([component, diagnostics]) => (
            <Section key={component} title={component} variant={SectionVariant.Panel} hasGutter>
              {diagnostics.map((d, i) => (
                <DiagnosticRow key={`${component}:${i}`} diagnostic={d} />
              ))}
            </Section>
          ))}
        </Box>
      </ScrollArea>
    </BasePanel>
  );
}
