/**
 * REL-019 §2 — the shelf's order comes from `spine.json`, and from nothing else.
 *
 * Richard, 2026-09-06: *"The learning tab has the lessons 'en vrac' without any numbering or
 * ordering. The first lesson is actually the LAST lesson of the spine."*
 *
 * 🔴 The load-bearing arm here is the REAL FILE. A chain walked over a fixture proves the
 * walker; a chain walked over `project-examples/lessons/spine.json` proves the launcher will
 * number the eight bundles that actually ship, in the order SYL-002 ruled. If somebody adds a
 * ninth lesson to the file this test does not need to change — that is the point of reading
 * rather than declaring.
 *
 * @module noodl-editor/tests-unit/rel-019/lesson-chain
 */
import { readFileSync } from 'fs';
import { join } from 'path';

import { EMPTY_CHAIN, chainFromSpine, readShippedChain, SPINE_FILENAME } from '../../src/editor/src/models/lessonchain';

const SPINE_ON_DISK = join(__dirname, '../../../../project-examples/lessons', SPINE_FILENAME);

describe('chainFromSpine — the walker', () => {
  const fixture = {
    format: 'nodegx-lesson-chain@1',
    lessons: {
      c: { needs: 'b' },
      a: { needs: null },
      extra: { needs: null, standalone: true },
      b: { needs: 'a' }
    }
  };

  it('walks from the head along `needs`, whatever order the file lists them in', () => {
    expect(chainFromSpine(fixture)).toEqual({ spine: ['a', 'b', 'c'], standalone: ['extra'] });
  });

  it('keeps a standalone lesson out of the chain even though it has no predecessor', () => {
    // Two lessons with `needs: null`; only the one WITHOUT `standalone` is a head.
    expect(chainFromSpine(fixture).spine).not.toContain('extra');
  });

  it('is empty, not a throw, for the shapes a broken artefact can carry', () => {
    expect(chainFromSpine(undefined)).toEqual(EMPTY_CHAIN);
    expect(chainFromSpine(null)).toEqual(EMPTY_CHAIN);
    expect(chainFromSpine('spine.json')).toEqual(EMPTY_CHAIN);
    expect(chainFromSpine({ lessons: [] })).toEqual(EMPTY_CHAIN);
    expect(chainFromSpine({ lessons: { a: null } })).toEqual(EMPTY_CHAIN);
  });

  it('terminates on a cycle and drops what the head cannot reach', () => {
    const cyclic = { lessons: { a: { needs: null }, b: { needs: 'a' }, x: { needs: 'y' }, y: { needs: 'x' } } };
    expect(chainFromSpine(cyclic).spine).toEqual(['a', 'b']);
  });
});

describe('readShippedChain — through the seed’s filesystem port', () => {
  it('reads <root>/spine.json and walks it', () => {
    const seen: string[] = [];
    const fs = {
      join: (...parts: string[]) => parts.join('/'),
      readJsonFile: (p: string) => {
        seen.push(p);
        return { lessons: { one: { needs: null }, two: { needs: 'one' } } };
      }
    };
    expect(readShippedChain(fs, '/Resources/lessons')).toEqual({ spine: ['one', 'two'], standalone: [] });
    expect(seen).toEqual(['/Resources/lessons/spine.json']);
  });

  it('is the empty chain with no root, and reads nothing', () => {
    const fs = {
      join: (...parts: string[]) => parts.join('/'),
      readJsonFile: () => {
        throw new Error('must not be called');
      }
    };
    expect(readShippedChain(fs, null)).toEqual(EMPTY_CHAIN);
  });
});

describe('the spine that ships', () => {
  const chain = chainFromSpine(JSON.parse(readFileSync(SPINE_ON_DISK, 'utf8')));

  it('is the eight lessons SYL-002 ruled, in that order', () => {
    expect(chain.spine).toEqual([
      'your-creature-on-screen',
      'it-breaks-on-a-phone',
      'poke-it',
      'it-forgets-you',
      'show-what-it-feels',
      'moods',
      'it-gets-demanding',
      'snacks'
    ]);
  });

  it('keeps `log-a-thing` beside the spine, not in it', () => {
    expect(chain.standalone).toEqual(['log-a-thing']);
  });

  it('names every bundle directory that ships, so no shipped lesson goes unnumbered', () => {
    // The chain is a claim about the artefact; this pins it to the directories on disk.
    const { readdirSync } = require('fs') as typeof import('fs');
    const dirs = readdirSync(join(SPINE_ON_DISK, '..'), { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name)
      .sort();
    expect([...chain.spine, ...chain.standalone].sort()).toEqual(dirs);
  });
});
