/**
 * AIX-008 — the sandbox store: querying and mutating sample data.
 *
 * The bias under test is "never strand the graph": an unknown class still
 * yields records, an unrecognised query operator does not filter everything
 * out, and writes succeed so a form that saves looks like a form that saves.
 */

import { matchesWhere, SandboxStore } from '../src/sandbox/store';
import type { SandboxDataset, SandboxRecord } from '../src/sandbox/types';

function dataset(): SandboxDataset {
  return {
    classes: {
      Books: {
        fields: ['title', 'author', 'year'],
        records: [
          { objectId: 'a', id: 'a', title: 'Piranesi', author: 'Clarke', year: 2020 },
          { objectId: 'b', id: 'b', title: 'Solaris', author: 'Lem', year: 1961 },
          { objectId: 'c', id: 'c', title: 'Kindred', author: 'Butler', year: 1979 }
        ] as SandboxRecord[]
      }
    },
    user: { objectId: 'sandbox-user', id: 'sandbox-user', username: 'sample.user@example.com' }
  };
}

describe('AIX-008 sandbox store', () => {
  it('serves the records the editor supplied', () => {
    const store = new SandboxStore(dataset());
    expect(store.query('Books').results.map((r) => r.title)).toEqual(['Piranesi', 'Solaris', 'Kindred']);
  });

  it('invents records for a class the editor did not predict', () => {
    const store = new SandboxStore(dataset());
    const { results } = store.query('Invoices');
    expect(results.length).toBe(5);
    expect(results.every((r) => typeof r.objectId === 'string')).toBe(true);
  });

  it('filters, orders, skips and limits', () => {
    const store = new SandboxStore(dataset());

    expect(store.query('Books', { where: { author: 'Lem' } }).results.map((r) => r.title)).toEqual(['Solaris']);
    expect(store.query('Books', { where: { year: { $gte: 1979 } } }).results.length).toBe(2);
    expect(store.query('Books', { order: 'year' }).results.map((r) => r.year)).toEqual([1961, 1979, 2020]);
    expect(store.query('Books', { order: '-year' }).results.map((r) => r.year)).toEqual([2020, 1979, 1961]);
    expect(store.query('Books', { skip: 1, limit: 1 }).results.map((r) => r.title)).toEqual(['Solaris']);
  });

  it('reports the total match count independently of the page returned', () => {
    const store = new SandboxStore(dataset());
    const result = store.query('Books', { limit: 1 });
    expect(result.results.length).toBe(1);
    expect(result.count).toBe(3);
  });

  it('treats an unknown operator as "no constraint" rather than "no results"', () => {
    const store = new SandboxStore(dataset());
    expect(store.query('Books', { where: { author: { $relatedTo: 'whatever' } } }).results.length).toBe(3);
  });

  it('supports $or, $in and $exists', () => {
    const store = new SandboxStore(dataset());
    expect(store.query('Books', { where: { $or: [{ author: 'Lem' }, { author: 'Butler' }] } }).count).toBe(2);
    expect(store.query('Books', { where: { author: { $in: ['Clarke'] } } }).count).toBe(1);
    expect(store.query('Books', { where: { missing: { $exists: true } } }).count).toBe(0);
  });

  it('creates, updates and deletes for the life of the preview', () => {
    const store = new SandboxStore(dataset());

    const created = store.create('Books', { title: 'New Book' });
    expect(store.query('Books').count).toBe(4);
    expect(store.get('Books', created.objectId)?.title).toBe('New Book');

    store.update('Books', created.objectId, { title: 'Renamed' });
    expect(store.get('Books', created.objectId)?.title).toBe('Renamed');

    expect(store.remove('Books', created.objectId)).toBe(true);
    expect(store.query('Books').count).toBe(3);
  });

  it('matches a bare where clause against missing fields without throwing', () => {
    const record = { objectId: 'x', id: 'x' } as SandboxRecord;
    expect(matchesWhere(record, undefined)).toBe(true);
    expect(matchesWhere(record, { anything: 'value' })).toBe(false);
    expect(matchesWhere(record, { anything: { $exists: false } })).toBe(true);
  });
});
