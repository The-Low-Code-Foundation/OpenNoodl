import React, { useState } from 'react';

// Folder-level data
const folders = [
  { id: 'pages', name: 'Pages', icon: '📄', count: 5, x: 80, y: 100, color: 'blue' },
  { id: 'swapcard', name: '#Swapcard', icon: '🔗', count: 8, x: 230, y: 50, color: 'orange' },
  { id: 'forms', name: '#Forms', icon: '📝', count: 15, x: 230, y: 170, color: 'purple' },
  { id: 'directus', name: '#Directus', icon: '🗄️', count: 45, x: 400, y: 50, color: 'green' },
  { id: 'ui', name: '#UI', icon: '🎨', count: 32, x: 400, y: 170, color: 'cyan' },
  { id: 'global', name: '#Global', icon: '⚙️', count: 18, x: 520, y: 280, color: 'gray' },
];

const folderConnections = [
  { from: 'pages', to: 'directus', count: 34 },
  { from: 'pages', to: 'ui', count: 28 },
  { from: 'pages', to: 'forms', count: 8 },
  { from: 'pages', to: 'swapcard', count: 15 },
  { from: 'pages', to: 'global', count: 12 },
  { from: 'forms', to: 'directus', count: 22 },
  { from: 'forms', to: 'ui', count: 18 },
  { from: 'swapcard', to: 'ui', count: 6 },
  { from: 'swapcard', to: 'global', count: 3 },
  { from: 'directus', to: 'global', count: 8 },
  { from: 'ui', to: 'global', count: 5 },
];

// Component-level data for #Directus folder
const directusComponents = [
  { id: 'auth', name: 'DirectusAuth', usedBy: 12, uses: ['global-logger'], x: 60, y: 60 },
  { id: 'query', name: 'DirectusQuery', usedBy: 28, uses: ['auth', 'error'], x: 180, y: 40 },
  { id: 'mutation', name: 'DirectusMutation', usedBy: 18, uses: ['auth', 'error'], x: 180, y: 110 },
  { id: 'upload', name: 'DirectusUpload', usedBy: 8, uses: ['auth'], x: 300, y: 60 },
  { id: 'list', name: 'DirectusList', usedBy: 15, uses: ['query'], x: 300, y: 130 },
  { id: 'item', name: 'DirectusItem', usedBy: 22, uses: ['query', 'mutation'], x: 420, y: 80 },
  { id: 'error', name: 'DirectusError', usedBy: 3, uses: [], x: 60, y: 130 },
  { id: 'file', name: 'DirectusFile', usedBy: 6, uses: ['upload'], x: 420, y: 150 },
];

const directusInternalConnections = [
  { from: 'query', to: 'auth' },
  { from: 'mutation', to: 'auth' },
  { from: 'upload', to: 'auth' },
  { from: 'query', to: 'error' },
  { from: 'mutation', to: 'error' },
  { from: 'list', to: 'query' },
  { from: 'item', to: 'query' },
  { from: 'item', to: 'mutation' },
  { from: 'file', to: 'upload' },
];

// External connections (from components in other folders TO directus components)
const directusExternalConnections = [
  { fromFolder: 'pages', toComponent: 'query', count: 18 },
  { fromFolder: 'pages', toComponent: 'mutation', count: 8 },
  { fromFolder: 'pages', toComponent: 'list', count: 5 },
  { fromFolder: 'pages', toComponent: 'auth', count: 3 },
  { fromFolder: 'forms', toComponent: 'query', count: 12 },
  { fromFolder: 'forms', toComponent: 'mutation', count: 10 },
];

const colorClasses = {
  blue: { bg: 'bg-blue-900', border: 'border-blue-500', text: 'text-blue-200', light: 'bg-blue-800' },
  orange: { bg: 'bg-orange-900', border: 'border-orange-500', text: 'text-orange-200', light: 'bg-orange-800' },
  purple: { bg: 'bg-purple-900', border: 'border-purple-500', text: 'text-purple-200', light: 'bg-purple-800' },
  green: { bg: 'bg-green-900', border: 'border-green-500', text: 'text-green-200', light: 'bg-green-800' },
  cyan: { bg: 'bg-cyan-900', border: 'border-cyan-500', text: 'text-cyan-200', light: 'bg-cyan-800' },
  gray: { bg: 'bg-gray-700', border: 'border-gray-500', text: 'text-gray-200', light: 'bg-gray-600' },
};

// State 1: Folder-level overview
function FolderOverview({ onExpandFolder, onSelectFolder, selectedFolder }) {
  return (
    <svg viewBox="0 0 620 350" className="w-full h-full">
      {/* Connection lines */}
      {folderConnections.map((conn, i) => {
        const from = folders.find(f => f.id === conn.from);
        const to = folders.find(f => f.id === conn.to);
        const opacity = Math.min(0.7, 0.2 + conn.count / 50);
        const strokeWidth = Math.max(1, Math.min(4, conn.count / 10));
        return (
          <line
            key={i}
            x1={from.x + 50}
            y1={from.y + 30}
            x2={to.x + 50}
            y2={to.y + 30}
            stroke="#4B5563"
            strokeWidth={strokeWidth}
            opacity={opacity}
          />
        );
      })}

      {/* Folder nodes */}
      {folders.map(folder => {
        const colors = colorClasses[folder.color];
        const isSelected = selectedFolder === folder.id;
        return (
          <g 
            key={folder.id} 
            className="cursor-pointer"
            onClick={() => onSelectFolder(folder.id)}
            onDoubleClick={() => onExpandFolder(folder.id)}
          >
            <rect
              x={folder.x}
              y={folder.y}
              width={100}
              height={60}
              rx={8}
              className={`${isSelected ? 'fill-blue-800' : 'fill-gray-800'} transition-colors`}
              stroke={isSelected ? '#3B82F6' : '#4B5563'}
              strokeWidth={isSelected ? 3 : 2}
            />
            <text
              x={folder.x + 50}
              y={folder.y + 25}
              textAnchor="middle"
              fill="white"
              fontSize="13"
              fontWeight="bold"
            >
              {folder.icon} {folder.name.replace('#', '')}
            </text>
            <text
              x={folder.x + 50}
              y={folder.y + 45}
              textAnchor="middle"
              fill="#9CA3AF"
              fontSize="11"
            >
              {folder.count} components
            </text>
            
            {/* Expand indicator */}
            <circle
              cx={folder.x + 88}
              cy={folder.y + 12}
              r={8}
              fill="#374151"
              stroke="#6B7280"
            />
            <text
              x={folder.x + 88}
              y={folder.y + 16}
              textAnchor="middle"
              fill="#9CA3AF"
              fontSize="10"
            >
              +
            </text>
          </g>
        );
      })}

      {/* Orphans indicator */}
      <g className="cursor-pointer opacity-60">
        <rect x="40" y="280" width="100" height="40" rx="6" fill="#422006" stroke="#CA8A04" strokeWidth="2" strokeDasharray="4" />
        <text x="90" y="305" textAnchor="middle" fill="#FCD34D" fontSize="11">⚠️ 68 Orphans</text>
      </g>

      {/* Instructions */}
      <text x="310" y="340" textAnchor="middle" fill="#6B7280" fontSize="10">
        Click to select • Double-click to expand • Right-click for options
      </text>
    </svg>
  );
}

// State 2: Expanded folder showing components
function ExpandedFolderView({ folderId, onBack, onSelectComponent, selectedComponent, onOpenXray }) {
  const folder = folders.find(f => f.id === folderId);
  const colors = colorClasses[folder.color];
  
  // For this mockup, we only have detailed data for Directus
  const components = folderId === 'directus' ? directusComponents : [];
  const internalConns = folderId === 'directus' ? directusInternalConnections : [];
  const externalConns = folderId === 'directus' ? directusExternalConnections : [];

  return (
    <svg viewBox="0 0 620 400" className="w-full h-full">
      {/* Background box for the expanded folder */}
      <rect
        x="30"
        y="60"
        width="480"
        height="220"
        rx="12"
        fill="#0a1a0a"
        stroke="#10B981"
        strokeWidth="2"
        strokeDasharray="4"
      />
      <text x="50" y="85" fill="#10B981" fontSize="12" fontWeight="bold">
        🗄️ #Directus (45 components - showing key 8)
      </text>

      {/* External folders (collapsed, on the left) */}
      <g className="cursor-pointer opacity-70 hover:opacity-100" onClick={onBack}>
        <rect x="30" y="300" width="70" height="40" rx="6" fill="#1E3A8A" stroke="#3B82F6" strokeWidth="2" />
        <text x="65" y="325" textAnchor="middle" fill="white" fontSize="10">📄 Pages</text>
      </g>
      <g className="cursor-pointer opacity-70 hover:opacity-100" onClick={onBack}>
        <rect x="110" y="300" width="70" height="40" rx="6" fill="#581C87" stroke="#A855F7" strokeWidth="2" />
        <text x="145" y="325" textAnchor="middle" fill="white" fontSize="10">📝 Forms</text>
      </g>

      {/* External folder on the right */}
      <g className="cursor-pointer opacity-70 hover:opacity-100" onClick={onBack}>
        <rect x="530" y="150" width="70" height="40" rx="6" fill="#374151" stroke="#6B7280" strokeWidth="2" />
        <text x="565" y="175" textAnchor="middle" fill="white" fontSize="10">⚙️ Global</text>
      </g>

      {/* External connection lines */}
      {externalConns.map((conn, i) => {
        const toComp = directusComponents.find(c => c.id === conn.toComponent);
        const fromY = conn.fromFolder === 'pages' ? 300 : 300;
        const fromX = conn.fromFolder === 'pages' ? 65 : 145;
        return (
          <path
            key={i}
            d={`M ${fromX} ${fromY} Q ${fromX} ${toComp.y + 100}, ${toComp.x + 50} ${toComp.y + 100}`}
            stroke={conn.fromFolder === 'pages' ? '#3B82F6' : '#A855F7'}
            strokeWidth={Math.max(1, conn.count / 8)}
            fill="none"
            opacity="0.4"
          />
        );
      })}

      {/* Internal connections */}
      {internalConns.map((conn, i) => {
        const from = directusComponents.find(c => c.id === conn.from);
        const to = directusComponents.find(c => c.id === conn.to);
        return (
          <line
            key={i}
            x1={from.x + 50}
            y1={from.y + 85}
            x2={to.x + 50}
            y2={to.y + 85}
            stroke="#10B981"
            strokeWidth="1.5"
            opacity="0.5"
          />
        );
      })}

      {/* Component nodes */}
      {components.map(comp => {
        const isSelected = selectedComponent === comp.id;
        return (
          <g 
            key={comp.id}
            className="cursor-pointer"
            onClick={() => onSelectComponent(comp.id)}
            onDoubleClick={() => onOpenXray(comp)}
          >
            <rect
              x={comp.x}
              y={comp.y + 60}
              width={100}
              height={50}
              rx={6}
              fill={isSelected ? '#065F46' : '#064E3B'}
              stroke={isSelected ? '#34D399' : '#10B981'}
              strokeWidth={isSelected ? 2 : 1}
            />
            <text
              x={comp.x + 50}
              y={comp.y + 82}
              textAnchor="middle"
              fill="white"
              fontSize="11"
              fontWeight="500"
            >
              {comp.name.replace('Directus', '')}
            </text>
            <text
              x={comp.x + 50}
              y={comp.y + 98}
              textAnchor="middle"
              fill="#6EE7B7"
              fontSize="9"
            >
              ×{comp.usedBy} uses
            </text>
          </g>
        );
      })}

      {/* Connection to Global */}
      <line x1="480" y1="175" x2="530" y2="170" stroke="#6B7280" strokeWidth="1" opacity="0.4" />

      {/* Legend / instructions */}
      <text x="310" y="385" textAnchor="middle" fill="#6B7280" fontSize="10">
        Double-click component to open in X-Ray • Click outside folder to go back
      </text>
    </svg>
  );
}

// Component detail panel (appears when component selected)
function ComponentDetailPanel({ component, onOpenXray, onClose }) {
  if (!component) return null;
  
  const comp = directusComponents.find(c => c.id === component);
  if (!comp) return null;

  return (
    <div className="absolute right-4 top-16 w-64 bg-gray-800 border border-gray-600 rounded-lg shadow-xl overflow-hidden">
      <div className="p-3 bg-green-900/50 border-b border-gray-600 flex items-center justify-between">
        <div className="font-semibold text-green-200">{comp.name}</div>
        <button onClick={onClose} className="text-gray-400 hover:text-white">×</button>
      </div>
      
      <div className="p-3 space-y-3 text-sm">
        <div>
          <div className="text-gray-400 text-xs uppercase mb-1">Used by</div>
          <div className="text-white">{comp.usedBy} components</div>
          <div className="text-xs text-gray-500 mt-1">
            Pages (18×), Forms (12×)...
          </div>
        </div>
        
        <div>
          <div className="text-gray-400 text-xs uppercase mb-1">Uses</div>
          <div className="flex flex-wrap gap-1">
            {comp.uses.length > 0 ? comp.uses.map(u => (
              <span key={u} className="px-2 py-0.5 bg-gray-700 rounded text-xs">{u}</span>
            )) : <span className="text-gray-500 text-xs">No dependencies</span>}
          </div>
        </div>

        <div className="pt-2 border-t border-gray-700 flex gap-2">
          <button 
            onClick={() => onOpenXray(comp)}
            className="flex-1 px-3 py-2 bg-blue-600 hover:bg-blue-500 rounded text-xs font-medium"
          >
            Open in X-Ray →
          </button>
          <button className="px-3 py-2 bg-gray-700 hover:bg-gray-600 rounded text-xs">
            Go to Canvas
          </button>
        </div>
      </div>
    </div>
  );
}

// Folder detail panel
function FolderDetailPanel({ folder, onExpand, onClose }) {
  if (!folder) return null;
  
  const f = folders.find(fo => fo.id === folder);
  if (!f) return null;

  const incomingConns = folderConnections.filter(c => c.to === folder);
  const outgoingConns = folderConnections.filter(c => c.from === folder);

  return (
    <div className="absolute right-4 top-16 w-64 bg-gray-800 border border-gray-600 rounded-lg shadow-xl overflow-hidden">
      <div className={`p-3 ${colorClasses[f.color].bg} border-b border-gray-600 flex items-center justify-between`}>
        <div className={`font-semibold ${colorClasses[f.color].text}`}>{f.icon} {f.name}</div>
        <button onClick={onClose} className="text-gray-400 hover:text-white">×</button>
      </div>
      
      <div className="p-3 space-y-3 text-sm">
        <div className="flex justify-between">
          <span className="text-gray-400">Components</span>
          <span className="text-white font-medium">{f.count}</span>
        </div>
        
        <div>
          <div className="text-gray-400 text-xs uppercase mb-1">Incoming ({incomingConns.reduce((a, c) => a + c.count, 0)})</div>
          <div className="space-y-1">
            {incomingConns.slice(0, 3).map(c => {
              const fromFolder = folders.find(fo => fo.id === c.from);
              return (
                <div key={c.from} className="flex justify-between text-xs">
                  <span className="text-gray-300">← {fromFolder.name}</span>
                  <span className="text-gray-500">{c.count}×</span>
                </div>
              );
            })}
          </div>
        </div>

        <div>
          <div className="text-gray-400 text-xs uppercase mb-1">Outgoing ({outgoingConns.reduce((a, c) => a + c.count, 0)})</div>
          <div className="space-y-1">
            {outgoingConns.slice(0, 3).map(c => {
              const toFolder = folders.find(fo => fo.id === c.to);
              return (
                <div key={c.to} className="flex justify-between text-xs">
                  <span className="text-gray-300">→ {toFolder.name}</span>
                  <span className="text-gray-500">{c.count}×</span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="pt-2 border-t border-gray-700">
          <button 
            onClick={onExpand}
            className="w-full px-3 py-2 bg-blue-600 hover:bg-blue-500 rounded text-xs font-medium"
          >
            Expand to see components →
          </button>
        </div>
      </div>
    </div>
  );
}

// X-Ray modal preview (just to show the handoff)
function XrayPreviewModal({ component, onClose }) {
  return (
    <div className="absolute inset-0 bg-black/80 flex items-center justify-center z-50">
      <div className="bg-gray-800 rounded-lg shadow-2xl w-96 overflow-hidden">
        <div className="p-4 bg-blue-900 border-b border-gray-600 flex items-center justify-between">
          <div>
            <div className="text-xs text-blue-300 uppercase">X-Ray View</div>
            <div className="font-semibold text-white">{component.name}</div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white text-xl">×</button>
        </div>
        
        <div className="p-4 space-y-4">
          {/* Mock X-ray content */}
          <div className="bg-gray-900 rounded p-3">
            <div className="text-xs text-gray-400 uppercase mb-2">Inputs</div>
            <div className="flex flex-wrap gap-2">
              <span className="px-2 py-1 bg-cyan-900 text-cyan-200 rounded text-xs">collectionName</span>
              <span className="px-2 py-1 bg-cyan-900 text-cyan-200 rounded text-xs">filter</span>
              <span className="px-2 py-1 bg-cyan-900 text-cyan-200 rounded text-xs">limit</span>
            </div>
          </div>
          
          <div className="bg-gray-900 rounded p-3">
            <div className="text-xs text-gray-400 uppercase mb-2">Outputs</div>
            <div className="flex flex-wrap gap-2">
              <span className="px-2 py-1 bg-green-900 text-green-200 rounded text-xs">data</span>
              <span className="px-2 py-1 bg-green-900 text-green-200 rounded text-xs">loading</span>
              <span className="px-2 py-1 bg-red-900 text-red-200 rounded text-xs">error</span>
            </div>
          </div>

          <div className="bg-gray-900 rounded p-3">
            <div className="text-xs text-gray-400 uppercase mb-2">Internal Nodes</div>
            <div className="text-sm text-gray-300">12 nodes (3 REST, 4 Logic, 5 Data)</div>
          </div>

          <div className="text-xs text-gray-500 text-center pt-2">
            This is a preview — full X-Ray would open in sidebar panel
          </div>
        </div>
      </div>
    </div>
  );
}

// Main component with state management
export default function TopologyDrilldown() {
  const [view, setView] = useState('folders'); // 'folders' | 'expanded'
  const [expandedFolder, setExpandedFolder] = useState(null);
  const [selectedFolder, setSelectedFolder] = useState(null);
  const [selectedComponent, setSelectedComponent] = useState(null);
  const [xrayComponent, setXrayComponent] = useState(null);

  const handleExpandFolder = (folderId) => {
    setExpandedFolder(folderId);
    setView('expanded');
    setSelectedFolder(null);
  };

  const handleBack = () => {
    setView('folders');
    setExpandedFolder(null);
    setSelectedComponent(null);
  };

  const handleOpenXray = (component) => {
    setXrayComponent(component);
  };

  return (
    <div className="w-full h-screen flex flex-col bg-gray-900 text-gray-100">
      {/* Header */}
      <div className="p-4 border-b border-gray-700 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h1 className="font-semibold text-lg">Project Topology</h1>
          {view === 'expanded' && (
            <button 
              onClick={handleBack}
              className="flex items-center gap-1 px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded text-sm"
            >
              ← Back to overview
            </button>
          )}
        </div>
        <div className="flex items-center gap-3">
          <div className="text-sm text-gray-400">
            {view === 'folders' ? '6 folders • 123 components' : `#Directus • 45 components`}
          </div>
          <div className="flex gap-1 bg-gray-800 rounded p-1">
            <button className="px-2 py-1 bg-gray-700 rounded text-xs">Fit</button>
            <button className="px-2 py-1 hover:bg-gray-700 rounded text-xs">+</button>
            <button className="px-2 py-1 hover:bg-gray-700 rounded text-xs">−</button>
          </div>
        </div>
      </div>

      {/* Breadcrumb */}
      <div className="px-4 py-2 bg-gray-800/50 border-b border-gray-700 text-sm">
        <span 
          className="text-blue-400 hover:underline cursor-pointer"
          onClick={handleBack}
        >
          App
        </span>
        {view === 'expanded' && (
          <>
            <span className="text-gray-500 mx-2">›</span>
            <span className="text-green-400">#Directus</span>
          </>
        )}
        {selectedComponent && (
          <>
            <span className="text-gray-500 mx-2">›</span>
            <span className="text-white">{directusComponents.find(c => c.id === selectedComponent)?.name}</span>
          </>
        )}
      </div>

      {/* Main canvas area */}
      <div className="flex-1 relative overflow-hidden">
        {view === 'folders' ? (
          <FolderOverview
            onExpandFolder={handleExpandFolder}
            onSelectFolder={setSelectedFolder}
            selectedFolder={selectedFolder}
          />
        ) : (
          <ExpandedFolderView
            folderId={expandedFolder}
            onBack={handleBack}
            onSelectComponent={setSelectedComponent}
            selectedComponent={selectedComponent}
            onOpenXray={handleOpenXray}
          />
        )}

        {/* Detail panels */}
        {view === 'folders' && selectedFolder && (
          <FolderDetailPanel
            folder={selectedFolder}
            onExpand={() => handleExpandFolder(selectedFolder)}
            onClose={() => setSelectedFolder(null)}
          />
        )}
        
        {view === 'expanded' && selectedComponent && (
          <ComponentDetailPanel
            component={selectedComponent}
            onOpenXray={handleOpenXray}
            onClose={() => setSelectedComponent(null)}
          />
        )}

        {/* X-Ray modal */}
        {xrayComponent && (
          <XrayPreviewModal
            component={xrayComponent}
            onClose={() => setXrayComponent(null)}
          />
        )}
      </div>

      {/* Footer status */}
      <div className="px-4 py-2 bg-gray-800 border-t border-gray-700 text-xs text-gray-500 flex justify-between">
        <div>
          {view === 'folders' 
            ? 'Double-click folder to expand • Click for details • 68 orphan components not shown'
            : 'Double-click component for X-Ray • External connections shown from Pages & Forms'
          }
        </div>
        <div className="flex gap-4">
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-blue-500"></span> Pages
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-purple-500"></span> Forms
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-green-500"></span> Internal
          </span>
        </div>
      </div>
    </div>
  );
}
