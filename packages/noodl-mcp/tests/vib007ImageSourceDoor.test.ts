/**
 * VIB-007 / register **V33** — the picture with no source, through the real door.
 *
 * The unit spec (`noodl-editor/tests-unit/vib-007/imageSource.test.ts`) pins the predicate. This
 * pins the three things it cannot see: that the predicate reaches the door an authoring model
 * knocks on, that it arrives as a **warning that does not block** (which is a decision — see
 * register V42 — and not an accident of wiring), and that the two corpus shapes with identical
 * empty strings get opposite answers *at the door* and not only in a unit.
 *
 * ⚠️ **A warning is easy to wire up wrong in the direction that looks fine.** A check whose
 * findings are dropped somewhere between `authoredPreconditionDiagnostics` and the response reads
 * exactly like a clean component. So the accept arm asserts the diagnostic is PRESENT, not merely
 * that the write succeeded.
 */
import * as fs from 'fs';

import { call, connect, copyFixture, TestSession } from './helpers';
import type { CreateComponentResponse } from '../src/tools/responses';

/** `ui-image-scrim-band`'s pre-repair shape: a band named for its image, with no image. */
const UNSOURCED_BAND = [
  { id: 'page', type: 'Page', parameters: { title: 'Band', urlPath: 'band' } },
  {
    id: 'band',
    type: 'Group',
    parent: 'page',
    parameters: { width: { value: 100, unit: '%' }, sizeMode: 'explicit', height: { value: 520, unit: 'px' }, backgroundImage: '' }
  }
];

/** `ui-card-grid-repeater`'s shape: the identical empty string, filled per row by a connection. */
const FED_CARD = [
  { id: 'card', type: 'Group' },
  { id: 'photo', type: 'Image', parent: 'card', parameters: { src: '' } },
  { id: 'card_inputs', type: 'Component Inputs', ports: [{ name: 'image', plug: 'output', type: '*' }] }
];

const FEED = [{ fromId: 'card_inputs', fromProperty: 'image', toId: 'photo', toProperty: 'src' }];

describe('V33 — an image parameter that is empty and unfed, at the door', () => {
  let dir: string;
  let session: TestSession;

  beforeEach(async () => {
    dir = copyFixture();
    session = await connect(dir);
  });

  afterEach(async () => {
    await session.close();
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('reports the unsourced band as a warning, and the write still lands', async () => {
    const res = await call<CreateComponentResponse>(session, 'create_component', {
      path: 'Pages/Band',
      nodes: UNSOURCED_BAND,
      visual_roots: ['page']
    });

    // 🔴 Not a rejection, on purpose. An agent that places an element in one call and points its
    // picture at a file in the next is momentarily in this state.
    expect(res.isError).toBe(false);

    const found = (res.data.validation.diagnostics ?? []).find((d) => d.code === 'unsourced-image');
    expect(found).toBeDefined();
    expect(found!.severity).toBe('warning');
    expect(found!.location.port).toBe('backgroundImage');
    // The repair has to name somewhere a picture can actually come from; "add an image" is the
    // advice this phase keeps finding was already in the doctrine and changed nothing.
    expect(found!.suggestion).toContain('starter-imagery');
  });

  it('says nothing about the identical empty string when a connection fills it', async () => {
    const res = await call<CreateComponentResponse>(session, 'create_component', {
      path: 'Components/ProductCard',
      nodes: FED_CARD,
      visual_roots: ['card'],
      connections: FEED
    });

    expect(res.isError).toBe(false);
    expect(JSON.stringify(res.data)).not.toContain('unsourced-image');
  });
});
