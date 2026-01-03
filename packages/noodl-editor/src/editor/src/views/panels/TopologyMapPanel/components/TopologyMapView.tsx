/**
 * TopologyMapView Component
 *
 * Main SVG visualization container for the topology map.
 * Handles rendering nodes, edges, pan/zoom, and user interaction.
 */

import React, { useState, useRef } from 'react';

import { Icon, IconName } from '@noodl-core-ui/components/common/Icon';

import { PositionedTopologyGraph, TopologyNode as TopologyNodeType } from '../utils/topologyTypes';
import { TopologyEdge, TopologyEdgeMarkerDef } from './TopologyEdge';
import css from './TopologyMapView.module.scss';
import { TopologyNode } from './TopologyNode';

export interface TopologyMapViewProps {
  graph: PositionedTopologyGraph;
  onNodeClick?: (node: TopologyNodeType) => void;
  onNodeHover?: (node: TopologyNodeType | null) => void;
  isLegendOpen?: boolean;
  onLegendToggle?: () => void;
}

export function TopologyMapView({
  graph,
  onNodeClick,
  onNodeHover,
  isLegendOpen,
  onLegendToggle
}: TopologyMapViewProps) {
  const [scale, setScale] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const svgRef = useRef<SVGSVGElement>(null);

  // Handle mouse wheel for zoom (zoom to cursor position)
  const handleWheel = (e: React.WheelEvent<SVGSVGElement>) => {
    e.preventDefault();

    if (!svgRef.current) return;

    const svg = svgRef.current;
    const rect = svg.getBoundingClientRect();

    // Get mouse position relative to SVG
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    // Calculate zoom delta
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    const newScale = Math.max(0.1, Math.min(3, scale * delta));

    // Calculate new pan to keep mouse position stable
    // Formula: new_pan = mouse_pos - (mouse_pos - old_pan) * (new_scale / old_scale)
    const scaleRatio = newScale / scale;
    const newPan = {
      x: mouseX - (mouseX - pan.x) * scaleRatio,
      y: mouseY - (mouseY - pan.y) * scaleRatio
    };

    setScale(newScale);
    setPan(newPan);
  };

  // Handle panning
  const handleMouseDown = (e: React.MouseEvent<SVGSVGElement>) => {
    if (e.button === 0 && e.target === svgRef.current) {
      // Only start panning if clicking on the background
      setIsPanning(true);
      setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
    }
  };

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (isPanning) {
      setPan({
        x: e.clientX - panStart.x,
        y: e.clientY - panStart.y
      });
    }
  };

  const handleMouseUp = () => {
    setIsPanning(false);
  };

  const handleMouseLeave = () => {
    setIsPanning(false);
  };

  // Fit to view
  const fitToView = () => {
    if (!svgRef.current) return;

    const svg = svgRef.current;
    const bbox = svg.getBoundingClientRect();
    const graphWidth = graph.bounds.width;
    const graphHeight = graph.bounds.height;

    // Calculate scale to fit
    const scaleX = (bbox.width - 80) / graphWidth;
    const scaleY = (bbox.height - 80) / graphHeight;
    const newScale = Math.min(scaleX, scaleY, 1);

    // Center the graph
    const newPan = {
      x: (bbox.width - graphWidth * newScale) / 2 - graph.bounds.x * newScale,
      y: (bbox.height - graphHeight * newScale) / 2 - graph.bounds.y * newScale
    };

    setScale(newScale);
    setPan(newPan);
  };

  // Node lookup map for edges
  const nodeMap = new Map<string, TopologyNodeType>();
  graph.nodes.forEach((node) => {
    nodeMap.set(node.fullName, node);
  });

  return (
    <div className={css['TopologyMapView']}>
      {/* Controls */}
      <div className={css['TopologyMapView__controls']}>
        <button onClick={fitToView} className={css['TopologyMapView__button']} title="Fit to view">
          Fit
        </button>
        <button
          onClick={() => setScale((prev) => Math.min(3, prev * 1.2))}
          className={css['TopologyMapView__button']}
          title="Zoom in"
        >
          +
        </button>
        <button
          onClick={() => setScale((prev) => Math.max(0.1, prev / 1.2))}
          className={css['TopologyMapView__button']}
          title="Zoom out"
        >
          −
        </button>
        <span className={css['TopologyMapView__zoom']}>{Math.round(scale * 100)}%</span>

        {/* Legend toggle button */}
        <button
          onClick={onLegendToggle}
          className={css['TopologyMapView__button']}
          title="Show legend"
          style={{ marginLeft: '8px' }}
        >
          <Icon icon={IconName.Question} />
        </button>
      </div>

      {/* Floating Legend */}
      {isLegendOpen && (
        <div className={css['TopologyMapView__legend']}>
          <div className={css['TopologyMapView__legendHeader']}>
            <h3>Legend</h3>
            <button onClick={onLegendToggle} className={css['TopologyMapView__legendClose']}>
              ×
            </button>
          </div>
          <div className={css['TopologyMapView__legendContent']}>
            <div className={css['TopologyMapView__legendItem']}>
              <span
                className={css['TopologyMapView__legendColor']}
                style={{ borderColor: 'var(--theme-color-primary)', boxShadow: '0 0 8px var(--theme-color-primary)' }}
              ></span>
              <span>Current Component (blue glow)</span>
            </div>
            <div className={css['TopologyMapView__legendItem']}>
              <span
                className={css['TopologyMapView__legendColor']}
                style={{ borderColor: 'var(--theme-color-primary)', borderWidth: '2.5px' }}
              ></span>
              <span>Page Component (blue border + shadow)</span>
            </div>
            <div className={css['TopologyMapView__legendItem']}>
              <span className={css['TopologyMapView__legendColor']} style={{ borderColor: '#f5a623' }}></span>
              <span>Shared Component (orange/gold border)</span>
            </div>
            <div className={css['TopologyMapView__legendItem']}>
              <span
                className={css['TopologyMapView__legendColor']}
                style={{ borderColor: 'var(--theme-color-warning)', borderStyle: 'dashed' }}
              ></span>
              <span>Orphan Component (yellow dashed - unused)</span>
            </div>
            <div className={css['TopologyMapView__legendItem']}>
              <span className={css['TopologyMapView__legendBadge']}>×3</span>
              <span>Usage count badge</span>
            </div>
          </div>
        </div>
      )}

      {/* SVG Canvas */}
      <svg
        ref={svgRef}
        className={css['TopologyMapView__svg']}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
        style={{
          cursor: isPanning ? 'grabbing' : 'grab'
        }}
      >
        <TopologyEdgeMarkerDef />

        <g transform={`translate(${pan.x}, ${pan.y}) scale(${scale})`}>
          {/* Render edges first (behind nodes) */}
          {graph.edges.map((edge, i) => (
            <TopologyEdge
              key={`${edge.from}-${edge.to}-${i}`}
              edge={edge}
              fromNode={nodeMap.get(edge.from)}
              toNode={nodeMap.get(edge.to)}
            />
          ))}

          {/* Render nodes */}
          {graph.nodes.map((node) => (
            <TopologyNode
              key={node.fullName}
              node={node}
              onClick={(n) => onNodeClick?.(n)}
              onMouseEnter={(n) => onNodeHover?.(n)}
              onMouseLeave={() => onNodeHover?.(null)}
            />
          ))}
        </g>
      </svg>

      {/* Stats footer */}
      <div className={css['TopologyMapView__footer']}>
        📊 {graph.totalNodes} components total | {graph.counts.pages} pages | {graph.counts.shared} shared
        {graph.counts.orphans > 0 && ` | ⚠️ ${graph.counts.orphans} orphans`}
      </div>
    </div>
  );
}
