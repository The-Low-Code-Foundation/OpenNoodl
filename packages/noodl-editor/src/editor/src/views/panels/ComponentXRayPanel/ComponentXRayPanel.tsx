/**
 * Component X-Ray Panel
 *
 * Shows comprehensive information about the currently active component:
 * - Usage locations
 * - Component interface (inputs/outputs)
 * - Internal structure
 * - External dependencies
 * - Internal state
 */

import { NodeGraphContextTmp } from '@noodl-contexts/NodeGraphContext/NodeGraphContext';
import React, { useCallback, useState } from 'react';

import { ComponentModel } from '@noodl-models/componentmodel';
import { NodeGraphNode } from '@noodl-models/nodegraphmodel';

import { Icon, IconName } from '@noodl-core-ui/components/common/Icon';
import { BasePanel } from '@noodl-core-ui/components/sidebar/BasePanel';

import { HighlightManager } from '../../../services/HighlightManager';
import css from './ComponentXRayPanel.module.scss';
import { useComponentXRay } from './hooks/useComponentXRay';

export function ComponentXRayPanel() {
  const xrayData = useComponentXRay();

  // Collapsible section state
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({
    usedIn: false,
    interface: false,
    contains: false,
    dependencies: false,
    state: false
  });

  // Selected category for highlighting
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const toggleSection = useCallback((section: string) => {
    setCollapsed((prev) => ({ ...prev, [section]: !prev[section] }));
  }, []);

  // Get the current component for node selection
  const currentComponent = NodeGraphContextTmp.nodeGraph?.activeComponent;

  // Navigation: Switch to a component and optionally select a node
  const navigateToComponent = useCallback((component: ComponentModel, nodeToSelect?: NodeGraphNode) => {
    NodeGraphContextTmp.switchToComponent(component, {
      node: nodeToSelect,
      pushHistory: true
    });
  }, []);

  // Node selection: Select a node in the current component by finding it
  const selectNodeById = useCallback(
    (nodeId: string) => {
      if (currentComponent?.graph) {
        const node = currentComponent.graph.findNodeWithId(nodeId);
        if (node) {
          NodeGraphContextTmp.switchToComponent(currentComponent, {
            node: node,
            pushHistory: false
          });
        }
      }
    },
    [currentComponent]
  );

  // Highlight nodes: Highlight multiple nodes in a category with toggle
  const highlightCategory = useCallback(
    (category: string, nodeIds: string[]) => {
      if (nodeIds.length === 0) return;

      if (selectedCategory === category) {
        // Clicking same category - toggle OFF
        HighlightManager.instance.clearChannel('selection');
        setSelectedCategory(null);
      } else {
        // New category - switch highlights
        HighlightManager.instance.clearChannel('selection');
        HighlightManager.instance.highlightNodes(nodeIds, {
          channel: 'selection',
          label: `${category} nodes`,
          persistent: false
        });
        setSelectedCategory(category);
      }
    },
    [selectedCategory]
  );

  if (!xrayData) {
    return (
      <BasePanel title="Component X-Ray" isFill UNSAFE_content_style={{ paddingInline: 0, paddingTop: 0 }}>
        <div className={css['EmptyState']}>
          <Icon icon={IconName.Search} />
          <h3>No Component Selected</h3>
          <p>Select a component to view its X-Ray analysis</p>
        </div>
      </BasePanel>
    );
  }

  return (
    /* PNL-005: the panel's own 16px header carried both the panel's name (a 14px
       uppercase `h2`, unlike any other panel) and the subject component's name.
       The former is the shared `PanelHeader`; the latter stays, as a subject band
       at the top of the content, because it is data and not chrome. */
    <BasePanel title="Component X-Ray" isFill UNSAFE_content_style={{ paddingInline: 0, paddingTop: 0 }}>
      <div className={css['Header']}>
        <div className={css['ComponentName']}>
          <Icon icon={IconName.Component} />
          <span>{xrayData.componentFullName}</span>
        </div>
      </div>

      {/* Content - scrollable */}
      <div className={css['Content']}>
        {/* Summary Stats */}
        <div className={css['SummaryStats']}>
          <div className={css['Stat']}>
            <span className={css['StatLabel']}>Total Nodes</span>
            <span className={css['StatValue']}>{xrayData.totalNodes}</span>
          </div>
          <div className={css['Stat']}>
            <span className={css['StatLabel']}>Used In</span>
            <span className={css['StatValue']}>{xrayData.usedIn.length} places</span>
          </div>
          <div className={css['Stat']}>
            <span className={css['StatLabel']}>Inputs</span>
            <span className={css['StatValue']}>{xrayData.inputs.length}</span>
          </div>
          <div className={css['Stat']}>
            <span className={css['StatLabel']}>Outputs</span>
            <span className={css['StatValue']}>{xrayData.outputs.length}</span>
          </div>
        </div>

        {/* Used In Section */}
        {xrayData.usedIn.length > 0 && (
          <div className={css['Section']}>
            <h3 className={css['SectionTitle']} onClick={() => toggleSection('usedIn')}>
              <Icon icon={collapsed.usedIn ? IconName.CaretRight : IconName.CaretDown} />
              <Icon icon={IconName.Navigate} />
              Used In ({xrayData.usedIn.length})
            </h3>
            {!collapsed.usedIn && (
              <div className={css['SectionContent']}>
                {xrayData.usedIn.map((usage, idx) => {
                  // Find the node instance in the parent component
                  const instanceNode = usage.component.graph.findNodeWithId(usage.instanceNodeIds[0]);
                  return (
                    <div
                      key={idx}
                      className={css['UsageItem']}
                      onClick={() => navigateToComponent(usage.component, instanceNode)}
                    >
                      <Icon icon={IconName.Component} />
                      <span>{usage.component.fullName}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Interface Section */}
        {(xrayData.inputs.length > 0 || xrayData.outputs.length > 0) && (
          <div className={css['Section']}>
            <h3 className={css['SectionTitle']} onClick={() => toggleSection('interface')}>
              <Icon icon={collapsed.interface ? IconName.CaretRight : IconName.CaretDown} />
              <Icon icon={IconName.Setting} />
              Interface
            </h3>
            {!collapsed.interface && (
              <div className={css['InterfaceGrid']}>
                {/* Inputs */}
                <div className={css['InterfaceColumn']}>
                  <h4>Inputs ({xrayData.inputs.length})</h4>
                  {xrayData.inputs.map((input, idx) => (
                    <div key={idx} className={css['PortItem']}>
                      <span className={css['PortName']}>{input.name}</span>
                      <span className={css['PortType']}>{input.type}</span>
                    </div>
                  ))}
                </div>

                {/* Outputs */}
                <div className={css['InterfaceColumn']}>
                  <h4>Outputs ({xrayData.outputs.length})</h4>
                  {xrayData.outputs.map((output, idx) => (
                    <div key={idx} className={css['PortItem']}>
                      <span className={css['PortName']}>{output.name}</span>
                      <span className={css['PortType']}>{output.type}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* No Interface Message */}
        {xrayData.inputs.length === 0 && xrayData.outputs.length === 0 && (
          <div className={css['Section']}>
            <h3 className={css['SectionTitle']} onClick={() => toggleSection('interface')}>
              <Icon icon={collapsed.interface ? IconName.CaretRight : IconName.CaretDown} />
              <Icon icon={IconName.Setting} />
              Interface
            </h3>
            {!collapsed.interface && <div className={css['NoData']}>This component has no defined interface</div>}
          </div>
        )}

        {/* Contains Section */}
        <div className={css['Section']}>
          <h3 className={css['SectionTitle']} onClick={() => toggleSection('contains')}>
            <Icon icon={collapsed.contains ? IconName.CaretRight : IconName.CaretDown} />
            <Icon icon={IconName.Component} />
            Contains
          </h3>
          {!collapsed.contains && (
            <div className={css['SectionContent']}>
              {/* Subcomponents */}
              {xrayData.subcomponents.length > 0 && (
                <div className={css['Subsection']}>
                  <h4>Subcomponents ({xrayData.subcomponents.length})</h4>
                  {xrayData.subcomponents.map((sub, idx) => (
                    <div
                      key={idx}
                      className={css['SubcomponentItem']}
                      onClick={() => navigateToComponent(sub.component)}
                    >
                      <Icon icon={IconName.Component} />
                      <span>{sub.fullName}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Node Breakdown */}
              {xrayData.nodeBreakdown.length > 0 && (
                <div className={css['Subsection']}>
                  <h4>Node Breakdown</h4>
                  {xrayData.nodeBreakdown.map((breakdown, idx) => (
                    <div
                      key={idx}
                      className={`${css['BreakdownItem']} ${
                        selectedCategory === breakdown.category ? css['active'] : ''
                      }`}
                      onClick={() => highlightCategory(breakdown.category, breakdown.nodeIds)}
                    >
                      <span className={css['CategoryName']}>{breakdown.category}</span>
                      <span className={css['CategoryCount']}>{breakdown.count}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* External Dependencies */}
        {(xrayData.restCalls.length > 0 ||
          xrayData.eventsSent.length > 0 ||
          xrayData.eventsReceived.length > 0 ||
          xrayData.functions.length > 0) && (
          <div className={css['Section']}>
            <h3 className={css['SectionTitle']} onClick={() => toggleSection('dependencies')}>
              <Icon icon={collapsed.dependencies ? IconName.CaretRight : IconName.CaretDown} />
              <Icon icon={IconName.CloudData} />
              External Dependencies
            </h3>
            {!collapsed.dependencies && (
              <div className={css['SectionContent']}>
                {/* REST Calls */}
                {xrayData.restCalls.length > 0 && (
                  <div className={css['Subsection']}>
                    <h4>REST Calls ({xrayData.restCalls.length})</h4>
                    {xrayData.restCalls.map((rest, idx) => (
                      <div key={idx} className={css['DependencyItem']} onClick={() => selectNodeById(rest.nodeId)}>
                        <span className={css['Method']}>{rest.method}</span>
                        <span className={css['Endpoint']}>{rest.endpoint}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Events Sent */}
                {xrayData.eventsSent.length > 0 && (
                  <div className={css['Subsection']}>
                    <h4>Events Sent ({xrayData.eventsSent.length})</h4>
                    {xrayData.eventsSent.map((event, idx) => (
                      <div key={idx} className={css['EventItem']} onClick={() => selectNodeById(event.nodeId)}>
                        <span>{event.eventName}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Events Received */}
                {xrayData.eventsReceived.length > 0 && (
                  <div className={css['Subsection']}>
                    <h4>Events Received ({xrayData.eventsReceived.length})</h4>
                    {xrayData.eventsReceived.map((event, idx) => (
                      <div key={idx} className={css['EventItem']} onClick={() => selectNodeById(event.nodeId)}>
                        <span>{event.eventName}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Functions */}
                {xrayData.functions.length > 0 && (
                  <div className={css['Subsection']}>
                    <h4>Functions ({xrayData.functions.length})</h4>
                    {xrayData.functions.map((func, idx) => (
                      <div key={idx} className={css['FunctionItem']} onClick={() => selectNodeById(func.nodeId)}>
                        <span>{func.nodeLabel}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Internal State */}
        {xrayData.stateNodes.length > 0 && (
          <div className={css['Section']}>
            <h3 className={css['SectionTitle']} onClick={() => toggleSection('state')}>
              <Icon icon={collapsed.state ? IconName.CaretRight : IconName.CaretDown} />
              <Icon icon={IconName.CloudData} />
              Internal State ({xrayData.stateNodes.length})
            </h3>
            {!collapsed.state && (
              <div className={css['SectionContent']}>
                {xrayData.stateNodes.map((state, idx) => (
                  <div key={idx} className={css['StateItem']} onClick={() => selectNodeById(state.nodeId)}>
                    <span className={css['StateType']}>{state.nodeType}</span>
                    <span className={css['StateName']}>{state.name}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </BasePanel>
  );
}
