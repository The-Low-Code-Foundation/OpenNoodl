/**
 * Test/Demo functions for the Highlighting API
 *
 * This file provides helper functions to test the canvas highlighting system.
 * Open Electron DevTools (View → Toggle Developer Tools) and run these in the console:
 *
 * Usage from Console:
 * ```
 * // Import the test helpers
 * const { testHighlightManager } = require('./services/HighlightManager/test-highlights');
 *
 * // Run basic tests
 * testHighlightManager.testBasicHighlight();
 * testHighlightManager.testMultipleNodes();
 * testHighlightManager.testAnimatedPulse();
 * testHighlightManager.clearAll();
 * ```
 */

import { HighlightManager } from './index';

/**
 * Test highlighting the first visible node
 */
export function testBasicHighlight() {
  console.log('🔍 Testing basic node highlight...');

  // Get the active NodeGraphEditor instance
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const editor = (window as any).__nodeGraphEditor;
  if (!editor) {
    console.error('❌ No active NodeGraphEditor found. Open a component first.');
    return;
  }

  // Get the first node
  const firstNode = editor.roots[0];
  if (!firstNode) {
    console.error('❌ No nodes found in the current component.');
    return;
  }

  console.log(`✅ Highlighting node: ${firstNode.id}`);

  // Create a highlight
  const handle = HighlightManager.instance.highlightNodes([firstNode.id], {
    channel: 'impact',
    color: '#00FF00',
    style: 'glow',
    label: 'Test Highlight'
  });

  console.log('✅ Highlight created! You should see a green glow around the first node.');
  console.log('💡 Clear it with: testHighlightManager.clearAll()');

  return handle;
}

/**
 * Test highlighting multiple nodes
 */
export function testMultipleNodes() {
  console.log('🔍 Testing multiple node highlights...');

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const editor = (window as any).__nodeGraphEditor;
  if (!editor) {
    console.error('❌ No active NodeGraphEditor found.');
    return;
  }

  // Get first 3 nodes
  const nodeIds = editor.roots.slice(0, 3).map((n) => n.id);
  if (nodeIds.length === 0) {
    console.error('❌ No nodes found.');
    return;
  }

  console.log(`✅ Highlighting ${nodeIds.length} nodes`);

  const handle = HighlightManager.instance.highlightNodes(nodeIds, {
    channel: 'selection',
    color: '#FFA500',
    style: 'solid',
    label: 'Multi-Select Test'
  });

  console.log('✅ Multiple nodes highlighted in orange!');
  return handle;
}

/**
 * Test animated pulse highlight
 */
export function testAnimatedPulse() {
  console.log('🔍 Testing animated pulse...');

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const editor = (window as any).__nodeGraphEditor;
  if (!editor || !editor.roots[0]) {
    console.error('❌ No active editor or nodes found.');
    return;
  }

  const firstNode = editor.roots[0];
  console.log(`✅ Creating pulsing highlight on: ${firstNode.id}`);

  const handle = HighlightManager.instance.highlightNodes([firstNode.id], {
    channel: 'warning',
    color: '#FF0000',
    style: 'pulse',
    label: 'Warning!'
  });

  console.log('✅ Pulsing red highlight created!');
  return handle;
}

/**
 * Test highlighting a connection (requires 2 connected nodes)
 */
export function testConnection() {
  console.log('🔍 Testing connection highlight...');

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const editor = (window as any).__nodeGraphEditor;
  if (!editor) {
    console.error('❌ No active NodeGraphEditor found.');
    return;
  }

  // Find the first connection
  const firstConnection = editor.connections[0];
  if (!firstConnection) {
    console.error('❌ No connections found. Create some connected nodes first.');
    return;
  }

  const fromNode = firstConnection.fromNode;
  const toNode = firstConnection.toNode;

  if (!fromNode || !toNode) {
    console.error('❌ Connection has invalid nodes.');
    return;
  }

  console.log(`✅ Highlighting connection: ${fromNode.id} → ${toNode.id}`);

  const handle = HighlightManager.instance.highlightConnections(
    [
      {
        fromNodeId: fromNode.id,
        fromPort: 'out', // Add required port fields
        toNodeId: toNode.id,
        toPort: 'in'
      }
    ],
    {
      channel: 'lineage',
      color: '#00FFFF',
      style: 'solid'
    }
  );

  console.log('✅ Connection highlighted in cyan!');
  return handle;
}

/**
 * Test highlighting a path (chain of connected nodes)
 */
export function testPath() {
  console.log('🔍 Testing path highlight...');

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const editor = (window as any).__nodeGraphEditor;
  if (!editor) {
    console.error('❌ No active NodeGraphEditor found.');
    return;
  }

  // Get first 3 nodes (simulating a path)
  const nodeIds = editor.roots.slice(0, 3).map((n) => n.id);
  if (nodeIds.length < 2) {
    console.error('❌ Need at least 2 nodes for a path test.');
    return;
  }

  console.log(`✅ Highlighting path through ${nodeIds.length} nodes`);

  const handle = HighlightManager.instance.highlightPath(
    {
      nodes: nodeIds,
      connections: [], // Empty for this test
      crossesComponents: false
    },
    {
      channel: 'lineage',
      color: '#9C27B0',
      style: 'glow',
      label: 'Execution Path'
    }
  );

  console.log('✅ Path highlighted in purple!');
  return handle;
}

/**
 * Clear all highlights
 */
export function clearAll() {
  console.log('🧹 Clearing all highlights...');
  HighlightManager.instance.clearAll();
  console.log('✅ All highlights cleared!');
}

/**
 * Clear specific channel
 */
export function clearChannel(channel: string) {
  console.log(`🧹 Clearing channel: ${channel}`);
  HighlightManager.instance.clearChannel(channel);
  console.log('✅ Channel cleared!');
}

/**
 * Run a full demo sequence
 */
export async function runDemoSequence() {
  console.log('🎬 Running highlight demo sequence...');

  // Test 1: Basic highlight
  console.log('\n1️⃣ Basic single node highlight');
  testBasicHighlight();
  await sleep(2000);

  clearAll();
  await sleep(500);

  // Test 2: Multiple nodes
  console.log('\n2️⃣ Multiple node highlight');
  testMultipleNodes();
  await sleep(2000);

  clearAll();
  await sleep(500);

  // Test 3: Animated pulse
  console.log('\n3️⃣ Animated pulse');
  testAnimatedPulse();
  await sleep(3000);

  clearAll();
  await sleep(500);

  // Test 4: Connection (if available)
  console.log('\n4️⃣ Connection highlight');
  try {
    testConnection();
    await sleep(2000);
  } catch (e) {
    console.warn('⚠️ Connection test skipped (no connections available)');
  }

  clearAll();
  console.log('\n✅ Demo sequence complete!');
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Export all test functions
export const testHighlightManager = {
  testBasicHighlight,
  testMultipleNodes,
  testAnimatedPulse,
  testConnection,
  testPath,
  clearAll,
  clearChannel,
  runDemoSequence
};

// Make available in window for console access
if (typeof window !== 'undefined') {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (window as any).testHighlightManager = testHighlightManager;
  console.log('✅ Highlight test utilities loaded!');
  console.log('💡 Try: window.testHighlightManager.testBasicHighlight()');
}
