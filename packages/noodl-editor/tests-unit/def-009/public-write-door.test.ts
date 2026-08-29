/**
 * DEF-009 (P76 F3) — a public write door with no rate limit produces a NAMED
 * diagnostic, and only then.
 *
 * AC3 is the spine of this file: the negative arms ARE the acceptance. A
 * warning that fires on every cloud function gets switched off within a week,
 * so every arm below is the firing shape with exactly one variable moved —
 * limit set, write removed, posture closed, policy invisible.
 *
 * The firing shape is `submitContactForm`'s: `call: "public"` in the shipped
 * site-builder policy, a Request node ticking `allowNoAuth`, a record write in
 * the graph, `rateLimit` absent. The negative-limit shape is members-area's
 * `claimAssociation`: `{ ratePerMinute: 5, burst: 5 }` — both real template
 * rows, cited in the module docblock.
 *
 * @module noodl-editor/tests-unit/def-009/public-write-door
 */
import { isBlockingForAuthoredOutput } from '@noodl-models/../validation/authoredCandidate';
import { CatalogIndex } from '@noodl-models/../validation/CatalogIndex';
import { defaultCatalog } from '@noodl-models/../validation/catalog';
import { DiagnosticCode } from '@noodl-models/../validation/diagnostics';
import { checkPublicWriteDoor, RECORD_WRITE_NODE_TYPES } from '@noodl-models/../validation/publicWriteDoor';

const CATALOG = new CatalogIndex(defaultCatalog());
const DOOR = '/#__cloud__/submitContactForm';

function publicWriteGraph(allowNoAuth = true, writeType = 'NewDbModelProperties') {
  return [
    { id: 'req', type: 'noodl.cloud.request', parameters: { allowNoAuth } },
    { id: 'save', type: writeType, parameters: { collectionName: 'ContactMessage' } },
    { id: 'res', type: 'noodl.cloud.response' }
  ];
}

describe('DEF-009 — the public write door with no limit is named', () => {
  it('fires on public + write + no policy file (null)', () => {
    const found = checkPublicWriteDoor(publicWriteGraph(), { component: DOOR, security: null, catalog: CATALOG });
    expect(found).toHaveLength(1);
    expect(found[0].code).toBe(DiagnosticCode.PublicWriteDoorUnlimited);
    // The message must name the mechanism — the whole defect is that nobody was
    // told there was one. Both settable surfaces, by name.
    expect(found[0].message).toContain('nodegx.security.json');
    expect(found[0].message).toContain('/admin/permissions/functions/submitContactForm');
    expect(found[0].location).toMatchObject({ nodeId: 'req', port: 'allowNoAuth' });
  });

  it('fires when the policy has an entry but no rateLimit — the shipped site-builder shape', () => {
    const found = checkPublicWriteDoor(publicWriteGraph(), {
      component: DOOR,
      security: { submitContactForm: { call: 'public' } },
      catalog: CATALOG
    });
    expect(found.map((d) => d.code)).toEqual([DiagnosticCode.PublicWriteDoorUnlimited]);
  });

  it('NEGATIVE — a rateLimit set is silence: the members-area shape', () => {
    const found = checkPublicWriteDoor(publicWriteGraph(), {
      component: DOOR,
      security: { submitContactForm: { call: 'public', rateLimit: { ratePerMinute: 5, burst: 5 } } },
      catalog: CATALOG
    });
    expect(found).toEqual([]);
  });

  it('a ZEROED rateLimit is not a limit — the backend treats it as absent, and so does this', () => {
    const found = checkPublicWriteDoor(publicWriteGraph(), {
      component: DOOR,
      security: { submitContactForm: { call: 'public', rateLimit: { ratePerMinute: 0 } } },
      catalog: CATALOG
    });
    expect(found).toHaveLength(1);
  });

  it('NEGATIVE — a public READ-ONLY function is silence', () => {
    const nodes = [
      { id: 'req', type: 'noodl.cloud.request', parameters: { allowNoAuth: true } },
      { id: 'q', type: 'DbCollection2', parameters: { collectionName: 'Page' } },
      { id: 'res', type: 'noodl.cloud.response' }
    ];
    expect(checkPublicWriteDoor(nodes, { component: DOOR, security: null, catalog: CATALOG })).toEqual([]);
  });

  it('NEGATIVE — an unticked Request is silence: the graph posture defaults closed', () => {
    expect(
      checkPublicWriteDoor(publicWriteGraph(false), { component: DOOR, security: null, catalog: CATALOG })
    ).toEqual([]);
  });

  it('NEGATIVE — a configured call posture that is not public closes the door before the graph runs', () => {
    const found = checkPublicWriteDoor(publicWriteGraph(), {
      component: DOOR,
      security: { submitContactForm: { call: 'role:admin' } },
      catalog: CATALOG
    });
    expect(found).toEqual([]);
  });

  it('NEGATIVE — security undefined means "do not check", never "no limit"', () => {
    // A caller that cannot read the project root cannot tell a limited door
    // from an unlimited one; firing here would warn about members-area's
    // claimAssociation, which IS limited — the false positive that kills rules.
    expect(checkPublicWriteDoor(publicWriteGraph(), { component: DOOR, catalog: CATALOG })).toEqual([]);
  });

  it('NEGATIVE — a browser component is silence, whatever it contains', () => {
    expect(
      checkPublicWriteDoor(publicWriteGraph(), { component: '/Pages/Home', security: null, catalog: CATALOG })
    ).toEqual([]);
  });

  it('every record-mutating type fires, not just the insert', () => {
    for (const writeType of RECORD_WRITE_NODE_TYPES) {
      const found = checkPublicWriteDoor(publicWriteGraph(true, writeType), {
        component: DOOR,
        security: null,
        catalog: CATALOG
      });
      expect(found.map((d) => d.code)).toEqual([DiagnosticCode.PublicWriteDoorUnlimited]);
    }
  });

  it('warns and never blocks — the limit may be configured later, or live on the backend', () => {
    const [d] = checkPublicWriteDoor(publicWriteGraph(), { component: DOOR, security: null, catalog: CATALOG });
    expect(d.severity).toBe('warning');
    expect(isBlockingForAuthoredOutput(d)).toBe(false);
  });
});
