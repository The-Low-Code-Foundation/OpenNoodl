/**
 * BCN-010 — the capability facts an external agent gets.
 *
 * The editor shows a gate as a dimmed port or a marked node. An agent authoring
 * through MCP has no property panel, so `get_node_type` carries the same facts;
 * without them the one surface that cannot see the gate is the one most likely
 * to write a graph that quietly does not work.
 */

import { getNodeTypeDetail } from '../src/catalog';

function detail(typeName: string) {
  const d = getNodeTypeDetail(typeName) as { capability?: Record<string, unknown> };
  return d.capability;
}

describe('capability facts on get_node_type', () => {
  it('carries the key AND the per-backend sentence for a node-level gate', () => {
    const c = detail('net.noodl.user.RequestMagicLink') as
      | { key?: string; notOn?: Record<string, string> }
      | undefined;

    expect(c?.key).toBe('auth.magicLink');
    // The sentence, not the state — an agent relaying "Directus has no
    // magic-link login" to a user is worth more than relaying `unsupported`.
    expect(c?.notOn?.directus).toContain('no magic-link login');
    // Supabase can, so it must NOT appear.
    expect(c?.notOn?.supabase).toBeUndefined();
  });

  it('carries port-level gates', () => {
    const c = detail('DbCollection2') as { ports?: Record<string, string> } | undefined;
    expect(c?.ports?.realtime).toBe('realtime.subscribe');
  });

  it('says nothing at all about a node that binds nothing', () => {
    expect(detail('Text')).toBeUndefined();
  });

  it('omits `custom`, whose descriptor is a floor the user declares rather than a fact', () => {
    const c = detail('noodl.cloud.aggregate') as { notOn?: Record<string, string> } | undefined;
    expect(Object.keys(c?.notOn ?? {})).not.toContain('custom');
    expect(c?.notOn?.pocketbase).toContain("can't total or average");
  });
});
