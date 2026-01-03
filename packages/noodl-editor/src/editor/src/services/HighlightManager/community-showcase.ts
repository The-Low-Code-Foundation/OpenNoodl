/**
 * 🎉 CANVAS HIGHLIGHTING API - COMMUNITY SHOWCASE
 *
 * Welcome back to Noodl! After a year of waiting, here's something special.
 *
 * USAGE:
 * 1. Open a component with nodes in the editor
 * 2. Open DevTools (View → Toggle Developer Tools)
 * 3. Paste this in the console:
 *
 *    noodlShowcase.start()
 *
 * Then sit back and enjoy! 🚀
 */

import { HighlightManager } from './HighlightManager';

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function getNodes() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const editor = (window as any).__nodeGraphEditor;
  if (!editor?.roots) return [];
  return editor.roots;
}

function log(emoji: string, msg: string) {
  console.log(`%c${emoji} ${msg}`, 'font-size: 14px; font-weight: bold;');
}

async function intro() {
  console.clear();
  log('🎬', 'NOODL CANVAS HIGHLIGHTING API');
  log('✨', "Worth the wait. Let's blow your mind.");
  await sleep(1500);
}

async function channelDemo() {
  const nodes = getNodes();
  if (nodes.length < 4) {
    log('⚠️', 'Need at least 4 nodes for full demo');
    return;
  }

  const channels = [
    { name: 'lineage', color: '#4A90D9', emoji: '🌊', label: 'Data Flow' },
    { name: 'impact', color: '#F5A623', emoji: '💥', label: 'Impact' },
    { name: 'selection', color: '#FFFFFF', emoji: '✨', label: 'Selection' },
    { name: 'warning', color: '#FF6B6B', emoji: '🔥', label: 'Warning' }
  ];

  for (let i = 0; i < channels.length; i++) {
    const ch = channels[i];
    log(ch.emoji, `Channel ${i + 1}: ${ch.label}`);

    HighlightManager.instance.highlightNodes([nodes[i].id], {
      channel: ch.name,
      color: ch.color,
      style: i % 2 === 0 ? 'glow' : 'pulse',
      label: ch.label
    });

    await sleep(800);
  }

  await sleep(2000);
  HighlightManager.instance.clearAll();
}

async function waveEffect() {
  const nodes = getNodes();
  if (nodes.length < 2) return;

  log('🌊', 'Wave Effect');
  const handles = [];

  for (let i = 0; i < Math.min(nodes.length, 8); i++) {
    handles.push(
      HighlightManager.instance.highlightNodes([nodes[i].id], {
        channel: 'lineage',
        color: `hsl(${i * 40}, 70%, 60%)`,
        style: 'glow'
      })
    );
    await sleep(150);
  }

  await sleep(1500);
  handles.forEach((h) => h.dismiss());
}

async function finale() {
  const nodes = getNodes();
  log('🎆', 'Grand Finale');

  const colors = ['#4A90D9', '#F5A623', '#9C27B0', '#FF6B6B'];
  const handles = [];

  nodes.forEach((node, i) => {
    handles.push(
      HighlightManager.instance.highlightNodes([node.id], {
        channel: 'impact',
        color: colors[i % colors.length],
        style: 'pulse'
      })
    );
  });

  await sleep(3000);

  log('✨', 'Fading out...');
  handles.forEach((h) => h.dismiss());
  await sleep(500);
}

async function start() {
  const nodes = getNodes();

  if (!nodes || nodes.length === 0) {
    console.error('❌ No nodes found. Open a component with nodes first!');
    return;
  }

  try {
    await intro();
    await channelDemo();
    await sleep(500);
    await waveEffect();
    await sleep(500);
    await finale();

    console.log('\n');
    log('🎉', 'Demo Complete!');
    log('📚', 'API Docs: Check HighlightManager.ts');
    log('💡', 'Try: HighlightManager.instance.highlightNodes([...])');
    log('🧹', 'Clear: HighlightManager.instance.clearAll()');
  } catch (error) {
    console.error('Demo error:', error);
  }
}

// Export for console access
export const noodlShowcase = {
  start,
  clear: () => HighlightManager.instance.clearAll()
};

// Make globally available
if (typeof window !== 'undefined') {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (window as any).noodlShowcase = noodlShowcase;
  console.log('✅ Showcase loaded! Run: noodlShowcase.start()');
}
