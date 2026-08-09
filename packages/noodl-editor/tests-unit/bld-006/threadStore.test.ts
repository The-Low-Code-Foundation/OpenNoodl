/**
 * BLD-006 — who owns the conversation, and what may destroy it.
 *
 * The panel is React and this runner has no DOM, so what is graded here is the
 * thing the panel was getting wrong before the store existed: `history` was
 * `useState` inside a sidebar panel that is *usually* only hidden. The rules
 * that matter are ownership and destruction, exactly as `aib-003`'s store spec
 * argues one directory over.
 */

import { isWorthWriting, type ThreadRecord } from '../../src/editor/src/models/AiAssistant/thread/threadRecord';
import { ThreadStore, THREADS_CHANGED } from '../../src/editor/src/models/AiAssistant/thread/ThreadStore';
import type { Turn } from '../../src/editor/src/models/AiAssistant/thread/types';

const PROJECT = 'project-a';

function turn(id: string, request?: string): Turn {
  return { id, ...(request ? { request } : {}), activities: [] };
}

/** A persistence stand-in that records every save. */
function recorder() {
  const saved: ThreadRecord[] = [];
  return { saved, save: (_projectId: string | undefined, thread: ThreadRecord) => saved.push(thread) };
}

let store: ThreadStore;
beforeEach(() => {
  // A fresh store per spec: the singleton is the production wiring, not a
  // constraint on the class.
  store = new ThreadStore();
});

describe('the current thread', () => {
  it('exists before anything has been said', () => {
    const state = store.get(PROJECT);
    expect(state.threads).toHaveLength(1);
    expect(store.current(PROJECT).id).toBe(state.currentId);
  });

  it('keeps every project apart', () => {
    store.append(PROJECT, [turn('a', 'Add a basket')]);
    store.append('project-b', [turn('b', 'Write the docs')]);
    expect(store.current(PROJECT).title).toBe('Add a basket');
    expect(store.current('project-b').title).toBe('Write the docs');
    expect(store.get(PROJECT).threads).toHaveLength(1);
  });

  it('gives an unsaved project a thread of its own', () => {
    store.append(undefined, [turn('a', 'Unsaved')]);
    expect(store.current(undefined).title).toBe('Unsaved');
  });
});

describe('appending', () => {
  it('accumulates and names the thread from the first request', () => {
    store.append(PROJECT, [turn('a', 'Add a basket popup')]);
    store.append(PROJECT, [turn('b', 'Now make it dismissible')]);
    const current = store.current(PROJECT);
    expect(current.turns.map((t) => t.id)).toEqual(['a', 'b']);
    expect(current.title).toBe('Add a basket popup');
  });

  it('does not re-key the turns it is handed', () => {
    // The `history-N-` prefix IS the liveness: re-numbering here would be
    // indistinguishable from a live id on the next launch, and a restored turn
    // would mount an Accept button for a session that no longer exists.
    store.append(PROJECT, [turn('history-0-component-0'), turn('accepted-0')]);
    expect(store.current(PROJECT).turns.map((t) => t.id)).toEqual(['history-0-component-0', 'accepted-0']);
  });

  it('appending nothing does not touch the thread', () => {
    const before = store.current(PROJECT).updatedAt;
    const persistence = recorder();
    store.attachPersistence(persistence);
    store.append(PROJECT, []);
    expect(store.current(PROJECT).updatedAt).toBe(before);
    expect(persistence.saved).toHaveLength(0);
  });

  it('tells its subscribers', () => {
    const seen: string[] = [];
    store.on(THREADS_CHANGED, () => seen.push(store.current(PROJECT).title), {});
    store.append(PROJECT, [turn('a', 'Add a basket')]);
    expect(seen).toEqual(['Add a basket']);
  });

  it('persists the thread, and only once it has something in it', () => {
    const persistence = recorder();
    store.attachPersistence(persistence);
    store.newThread(PROJECT);
    expect(persistence.saved).toHaveLength(0);
    store.append(PROJECT, [turn('a', 'Add a basket')]);
    expect(persistence.saved).toHaveLength(1);
    expect(isWorthWriting(persistence.saved[0])).toBe(true);
  });

  it('works with no persistence attached at all', () => {
    // The property that keeps this gradeable: no filesystem, no Electron.
    expect(() => store.append(PROJECT, [turn('a', 'Add a basket')])).not.toThrow();
  });
});

describe('starting a new one', () => {
  it('switches to it and keeps what came before', () => {
    store.append(PROJECT, [turn('a', 'First')]);
    const fresh = store.newThread(PROJECT);
    expect(store.get(PROJECT).currentId).toBe(fresh.id);
    expect(store.get(PROJECT).threads).toHaveLength(2);
    expect(store.current(PROJECT).turns).toHaveLength(0);
  });

  it('does not leave a pile of blanks behind', () => {
    store.newThread(PROJECT);
    store.newThread(PROJECT);
    store.newThread(PROJECT);
    expect(store.get(PROJECT).threads).toHaveLength(1);
  });

  it('mints ids that do not collide inside one millisecond', () => {
    const ids = new Set([store.newThread(PROJECT).id, store.newThread(PROJECT).id, store.newThread(PROJECT).id]);
    expect(ids.size).toBe(3);
  });
});

describe('switching', () => {
  it('reaches three threads individually', () => {
    store.append(PROJECT, [turn('a', 'One')]);
    const first = store.current(PROJECT).id;
    store.newThread(PROJECT);
    store.append(PROJECT, [turn('b', 'Two')]);
    const second = store.current(PROJECT).id;
    store.newThread(PROJECT);
    store.append(PROJECT, [turn('c', 'Three')]);

    store.select(PROJECT, first);
    expect(store.current(PROJECT).title).toBe('One');
    store.select(PROJECT, second);
    expect(store.current(PROJECT).title).toBe('Two');
  });

  it('destroys nothing — a switch is navigation', () => {
    store.append(PROJECT, [turn('a', 'One')]);
    const first = store.current(PROJECT).id;
    store.newThread(PROJECT);
    store.select(PROJECT, first);
    expect(store.current(PROJECT).turns).toHaveLength(1);
    expect(store.get(PROJECT).threads).toHaveLength(2);
  });

  it('ignores an id it does not have rather than clearing', () => {
    store.append(PROJECT, [turn('a', 'One')]);
    const before = store.get(PROJECT).currentId;
    store.select(PROJECT, 'no-such-thread');
    expect(store.get(PROJECT).currentId).toBe(before);
  });
});

describe('coming back from disk', () => {
  const saved: ThreadRecord = {
    id: 'saved-1',
    title: 'Yesterday',
    createdAt: 10,
    updatedAt: 20,
    turns: [turn('history-0', 'Yesterday')]
  };

  it('opens on the newest restored conversation when nothing has been typed', () => {
    store.get(PROJECT);
    store.restore(PROJECT, [saved]);
    expect(store.current(PROJECT).id).toBe('saved-1');
  });

  it('does not yank a user who has already started talking', () => {
    // The panel can mount and take a request before a slow disk answers.
    store.append(PROJECT, [turn('a', 'Something new')]);
    const inFlight = store.current(PROJECT).id;
    store.restore(PROJECT, [saved]);
    expect(store.current(PROJECT).id).toBe(inFlight);
    expect(store.get(PROJECT).threads).toHaveLength(2);
  });

  it('⚠️ prunes the blank it minted before the read came back', () => {
    // Found by driving a restart, not by a spec: every spec above seeds a
    // thread that has something in it, which is the one case where there is
    // nothing to prune. On screen it was an empty "New thread" sitting above
    // three real conversations, on every launch.
    store.get(PROJECT);
    store.restore(PROJECT, [saved]);
    expect(store.get(PROJECT).threads.map((t) => t.title)).toEqual(['Yesterday']);
  });

  it('keeps the blank when it is the one being shown', () => {
    // Someone who has typed nothing yet still has a conversation open.
    store.append(PROJECT, [turn('a', 'Something new')]);
    const blank = store.newThread(PROJECT);
    store.restore(PROJECT, [saved]);
    expect(store.get(PROJECT).currentId).toBe(blank.id);
    expect(store.get(PROJECT).threads.map((t) => t.id)).toContain(blank.id);
  });

  it('never loses what is already in memory', () => {
    store.append(PROJECT, [turn('a', 'Something new')]);
    store.restore(PROJECT, [saved]);
    expect(store.get(PROJECT).threads.map((t) => t.title).sort()).toEqual(['Something new', 'Yesterday']);
  });

  it('ignores a thread it already has', () => {
    store.restore(PROJECT, [saved]);
    store.restore(PROJECT, [saved]);
    expect(store.get(PROJECT).threads.filter((t) => t.id === 'saved-1')).toHaveLength(1);
  });

  it('does not write back what it just read', () => {
    const persistence = recorder();
    store.attachPersistence(persistence);
    store.restore(PROJECT, [saved]);
    expect(persistence.saved).toHaveLength(0);
  });

  it('asks the disk once, even when two mounts race it', async () => {
    let reads = 0;
    const check = async () => {
      reads++;
    };
    await Promise.all([store.consultSavedThreads(PROJECT, check), store.consultSavedThreads(PROJECT, check)]);
    await store.consultSavedThreads(PROJECT, check);
    expect(reads).toBe(1);
  });

  it('counts a failed read as asked', async () => {
    // Retrying on every render would mean a project with one unreadable file
    // re-reading its directory forever.
    let reads = 0;
    const failing = async () => {
      reads++;
      throw new Error('unreadable');
    };
    await store.consultSavedThreads(PROJECT, failing);
    await store.consultSavedThreads(PROJECT, failing);
    expect(reads).toBe(1);
  });
});
