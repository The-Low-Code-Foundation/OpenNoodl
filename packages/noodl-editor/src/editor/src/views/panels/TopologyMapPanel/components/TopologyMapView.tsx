/**
 * TopologyMapView Component
 *
 * Main SVG visualization container for the folder-based topology map.
 * Handles rendering folder nodes, edges, pan/zoom, and user interaction.
 */

import React, { useState, useRef } from 'react';

import { Icon, IconName } from '@noodl-core-ui/components/common/Icon';

import { PositionedFolderGraph, FolderNode as FolderNodeType, TopologyViewState } from '../utils/topologyTypes';
import { ComponentNode, calculateComponentNodeHeight } from './ComponentNode';
import { FolderEdge } from './FolderEdge';
import { FolderNode } from './FolderNode';
import css from './TopologyMapView.module.scss';

export interface TopologyMapViewProps {
  graph: PositionedFolderGraph;
  viewState: TopologyViewState;
  selectedFolderId: string | null;
  onFolderClick?: (folder: FolderNodeType) => void;
  onFolderDoubleClick?: (folder: FolderNodeType) => void;
  isLegendOpen?: boolean;
  onLegendToggle?: () => void;
}

export function TopologyMapView({
  graph,
  viewState,
  selectedFolderId,
  onFolderClick,
  onFolderDoubleClick,
  isLegendOpen,
  onLegendToggle
}: TopologyMapViewProps) {
  const [scale, setScale] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const svgRef = useRef<SVGSVGElement>(null);

  // Handle mouse wheel for zoom
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

  // Folder lookup map for edges
  const folderMap = new Map<string, FolderNodeType>();
  graph.folders.forEach((folder) => {
    folderMap.set(folder.id, folder);
  });

  // Get expanded folder if in expanded mode
  const expandedFolder =
    viewState.mode === 'expanded' ? graph.folders.find((f) => f.id === viewState.expandedFolderId) : null;

  // Render expanded view (component-level)
  if (viewState.mode === 'expanded' && expandedFolder) {
    const components = expandedFolder.components;
    const componentsPerRow = 3;
    const nodeWidth = 180;
    const gap = 40;

    // Calculate component positions with dynamic heights
    const componentLayouts = components.map((component, i) => {
      const dynamicHeight = calculateComponentNodeHeight(component.name);
      const row = Math.floor(i / componentsPerRow);
      const col = i % componentsPerRow;

      // Calculate Y position based on previous rows' max heights
      let y = 50;
      for (let r = 0; r < row; r++) {
        const rowStart = r * componentsPerRow;
        const rowEnd = Math.min(rowStart + componentsPerRow, components.length);
        const rowComponents = components.slice(rowStart, rowEnd);
        const maxRowHeight = Math.max(...rowComponents.map((c) => calculateComponentNodeHeight(c.name)));
        y += maxRowHeight + gap;
      }

      const x = 50 + col * (nodeWidth + gap);

      return { component, x, y, height: dynamicHeight };
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
        </div>

        {/* SVG Canvas for expanded view */}
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
          <g transform={`translate(${pan.x}, ${pan.y}) scale(${scale})`}>
            {/* Render components in a grid with dynamic heights */}
            {componentLayouts.map((layout) => (
              <ComponentNode
                key={layout.component.fullName}
                component={layout.component}
                folderType={expandedFolder.type}
                x={layout.x}
                y={layout.y}
                width={nodeWidth}
                height={layout.height}
                isSelected={viewState.selectedComponentId === layout.component.fullName}
              />
            ))}
          </g>
        </svg>

        {/* Stats footer */}
        <div className={css['TopologyMapView__footer']}>📦 {components.length} components in this folder</div>
      </div>
    );
  }

  // Render overview (folder-level) - default view
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
              <span className={css['TopologyMapView__legendColor']} style={{ borderColor: '#3b82f6' }}></span>
              <span>📄 Pages (entry points)</span>
            </div>
            <div className={css['TopologyMapView__legendItem']}>
              <span className={css['TopologyMapView__legendColor']} style={{ borderColor: '#a855f7' }}></span>
              <span>📝 Features (domain logic)</span>
            </div>
            <div className={css['TopologyMapView__legendItem']}>
              <span className={css['TopologyMapView__legendColor']} style={{ borderColor: '#10b981' }}></span>
              <span>🔗 Integrations (external services)</span>
            </div>
            <div className={css['TopologyMapView__legendItem']}>
              <span className={css['TopologyMapView__legendColor']} style={{ borderColor: '#06b6d4' }}></span>
              <span>🎨 UI (shared components)</span>
            </div>
            <div className={css['TopologyMapView__legendItem']}>
              <span className={css['TopologyMapView__legendColor']} style={{ borderColor: '#6b7280' }}></span>
              <span>⚙️ Utilities (foundation)</span>
            </div>
            <div className={css['TopologyMapView__legendItem']}>
              <span
                className={css['TopologyMapView__legendColor']}
                style={{ borderColor: '#ca8a04', borderStyle: 'dashed' }}
              ></span>
              <span>⚠️ Orphans (unused)</span>
            </div>
            <div className={css['TopologyMapView__legendDivider']} />
            <div className={css['TopologyMapView__legendHint']}>
              <strong>Tip:</strong> Double-click a folder to expand and see its components
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
        <g transform={`translate(${pan.x}, ${pan.y}) scale(${scale})`}>
          {/* Render edges first (behind nodes) */}
          {graph.connections.map((connection, i) => {
            const fromFolder = folderMap.get(connection.from);
            const toFolder = folderMap.get(connection.to);
            if (!fromFolder || !toFolder) return null;

            return (
              <FolderEdge
                key={`${connection.from}-${connection.to}-${i}`}
                connection={connection}
                fromFolder={fromFolder}
                toFolder={toFolder}
              />
            );
          })}

          {/* Render top-level components (pages) */}
          {graph.topLevelComponents.map((topLevel) => (
            <ComponentNode
              key={topLevel.component.fullName}
              component={topLevel.component}
              folderType="page"
              x={topLevel.x!}
              y={topLevel.y!}
              width={topLevel.width!}
              height={topLevel.height!}
              isSelected={viewState.selectedComponentId === topLevel.component.fullName}
              isAppComponent={topLevel.isAppComponent}
            />
          ))}

          {/* Render folder nodes */}
          {graph.folders.map((folder) => (
            <FolderNode
              key={folder.id}
              folder={folder}
              isSelected={folder.id === selectedFolderId}
              onClick={onFolderClick}
              onDoubleClick={onFolderDoubleClick}
            />
          ))}

          {/* Render orphan indicator if there are orphans */}
          {graph.orphanComponents.length > 0 && (
            <g>
              <rect
                x={50}
                y={700}
                width={140}
                height={50}
                rx={8}
                fill="#422006"
                stroke="#ca8a04"
                strokeWidth={2}
                strokeDasharray="4"
                opacity={0.6}
              />
              <text x={120} y={720} textAnchor="middle" fill="#fcd34d" fontSize="13" fontWeight="600">
                ⚠️ Orphans
              </text>
              <text x={120} y={738} textAnchor="middle" fill="#ca8a04" fontSize="11">
                {graph.orphanComponents.length} unused
              </text>
            </g>
          )}
        </g>
      </svg>

      {/* Stats footer */}
      <div className={css['TopologyMapView__footer']}>
        📊 {graph.totalFolders} folders • {graph.totalComponents} components
        {graph.orphanComponents.length > 0 && ` • ⚠️ ${graph.orphanComponents.length} orphans`}
      </div>
    </div>
  );
}
