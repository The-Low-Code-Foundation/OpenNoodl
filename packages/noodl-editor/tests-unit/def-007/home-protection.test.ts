/**
 * DEF-007 — deleting the project's home page asks first.
 *
 * 🧭 Richard, 2026-08-31: *"Can we at the same time make the app scream loudly when someone tries
 * to delete a home page? There's already the big error in the preview when no homepage has been
 * selected, but to stop people making the accidental deletion mistake."*
 *
 * 🔴 **WHAT THIS FILE IS ACTUALLY GUARDING.** Deleting the home *component* from the Components
 * panel was already refused (`ProjectModel.deleteComponentAllowed`). The canvas was not: the home
 * is a NODE, and selecting it and pressing Delete ran a module-scope listener in `projectmodel.ts`
 * that called `setRootNode(undefined)` with no dialog, no toast, and nothing written anywhere a
 * person looks. The panel's refusal made that worse rather than better, because it teaches that
 * the home is protected.
 */

import {
  homeDeletionMessage,
  homeInDeletion,
  type DeletedNodeView
} from '../../src/editor/src/models/homeprotection';

const home: DeletedNodeView = { id: 'root-1', label: 'App Root', typeName: 'Group' };
const sibling: DeletedNodeView = { id: 'n2', label: 'Sidebar', typeName: 'Group' };
const child: DeletedNodeView = { id: 'n3', typeName: 'Text' };

describe('homeInDeletion', () => {
  it('🔴 finds the home node in the removal set and names it', () => {
    const found = homeInDeletion([home, sibling], 'root-1', 'Home');
    expect(found).not.toBeNull();
    expect(found.nodeName).toBe('App Root');
    expect(found.componentName).toBe('Home');
  });

  it('says nothing when the home is not being deleted', () => {
    expect(homeInDeletion([sibling, child], 'root-1')).toBeNull();
    expect(homeDeletionMessage(null)).toBeNull();
  });

  it('🔴 finds a home node that is a DESCENDANT of the selection, not just a selected one', () => {
    // The reason this module takes a flattened set rather than the selection. `removeNode`
    // notifies `nodeRemoved` only for the node it was handed — its children are dropped from the
    // nodeMap in a `forEach` with no notification each — so `projectmodel.ts`'s listener is blind
    // to exactly this case, and the project would keep pointing at a node no longer in the graph.
    const flattened = [sibling, home, child];
    expect(homeInDeletion(flattened, 'root-1')).not.toBeNull();
  });

  it('🔴 a project with NO home is not warned about deleting one', () => {
    // Guarded before the scan: otherwise a view with no id matches `undefined` and the dialog
    // announces the loss of a home page that never existed.
    expect(homeInDeletion([home, sibling], undefined)).toBeNull();
    expect(homeInDeletion([home, sibling], '')).toBeNull();
    expect(homeInDeletion([{ id: undefined } as never], undefined)).toBeNull();
  });

  it('falls back to the type, then to a neutral phrase, when a node has no label', () => {
    expect(homeInDeletion([{ id: 'root-1', typeName: 'Group' }], 'root-1').nodeName).toBe('Group');
    expect(homeInDeletion([{ id: 'root-1' }], 'root-1').nodeName).toBe('this node');
  });
});

describe('homeDeletionMessage', () => {
  it('🔴 names the CONSEQUENCE, not just the fact, and gives the way back', () => {
    const message = homeDeletionMessage(homeInDeletion([home], 'root-1', 'Home'));

    // 🔴 The whole ask. "This is the home page" is a fact somebody can agree with and still not
    // understand; what stops the mistake is knowing the app stops opening.
    expect(message).toMatch(/no home|opens on/i);
    expect(message).toMatch(/preview/i);
    // 🔴 And the way out, because a dialog that only says what breaks leaves somebody who
    // genuinely meant it with nothing to do next.
    expect(message).toMatch(/make home/i);
    // It names the node, so it is about the thing they selected.
    expect(message).toContain('App Root');
    expect(message).toContain('Home');
  });

  it('reads correctly when the owning component is unknown', () => {
    const message = homeDeletionMessage(homeInDeletion([home], 'root-1'));
    expect(message).toContain('App Root');
    // ⚠️ No dangling "in “”" — the component clause is omitted rather than emptied.
    expect(message).not.toMatch(/in “”/);
  });
});
