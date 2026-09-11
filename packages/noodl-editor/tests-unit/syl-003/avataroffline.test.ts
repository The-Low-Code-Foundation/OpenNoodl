/**
 * SYL-003 AC2 — with the network gone, the avatar picker still works.
 *
 * 🔴 **Read by inspection this claim is worthless**, and SYL-003 says so in as many words: an
 * offline claim verified by reading the code is the claim this repo has been burnt by. So the real
 * library is loaded in a child process whose network primitives have been replaced with throwing
 * stubs BEFORE the import, and the avatar has to come out anyway.
 *
 * The poison cannot be trusted on its own either — a stub that silently failed to install would let
 * a network call through and still show a passing test. So one child does nothing but call
 * `fetch` under the same poison and is required to die of it. That is the known-firing signal the
 * absence is asserted beside; without it "no network was reached" and "nothing was measured" are
 * the same picture.
 *
 * This is also the only place the ESM library is exercised at all: `avatarstyles.ts` cannot be
 * imported by this CommonJS runner, so a child process is both the honest instrument and the only
 * available one.
 */
import { spawnSync } from 'child_process';
import path from 'path';

/** Run from the editor package, so Node resolves `@dicebear/*` up into the hoisted node_modules. */
const CWD = path.resolve(__dirname, '../..');

/** Replaces every way out of the process with a throw. Prepended to each child script. */
const POISON = `
import net from 'node:net';
import dns from 'node:dns';
import http from 'node:http';
import https from 'node:https';
import tls from 'node:tls';

const boom = (what) => () => { throw new Error('NETWORK REACHED: ' + what); };

globalThis.fetch = boom('fetch');
globalThis.XMLHttpRequest = function () { throw new Error('NETWORK REACHED: XMLHttpRequest'); };
net.Socket.prototype.connect = boom('net.Socket.connect');
net.connect = boom('net.connect');
net.createConnection = boom('net.createConnection');
tls.connect = boom('tls.connect');
dns.lookup = boom('dns.lookup');
dns.resolve = boom('dns.resolve');
dns.promises.lookup = boom('dns.promises.lookup');
http.request = boom('http.request');
http.get = boom('http.get');
https.request = boom('https.request');
https.get = boom('https.get');
`;

function runOffline(script: string) {
  return spawnSync(process.execPath, ['--input-type=module', '-e', POISON + script], {
    cwd: CWD,
    encoding: 'utf8',
    timeout: 60000
  });
}

describe('SYL-003 AC2 — the picker works with the network off', () => {
  /**
   * The control. If this ever passes, the poison above stopped being installed and every other
   * assertion in this file became a reading of nothing.
   */
  it('CONTROL — the poison is armed: reaching the network in this child is fatal', () => {
    const control = runOffline(`
      await fetch('https://dicebear.com/');
      process.stdout.write('REACHED THE NETWORK');
    `);

    expect(control.stdout).not.toContain('REACHED THE NETWORK');
    expect(control.stderr).toContain('NETWORK REACHED: fetch');
  });

  it('generates a real avatar for every shipped style with no network at all', () => {
    const child = runOffline(`
      const { createAvatar } = await import('@dicebear/core');
      const ids = ['thumbs','open-peeps','lorelei','notionists','pixel-art','shapes','rings','identicon','glass','adventurer','fun-emoji','croodles','big-smile','micah','personas','toon-head'];
      const out = [];
      for (const id of ids) {
        const style = await import('@dicebear/' + id);
        const svg = createAvatar(style, { seed: 'Nibbles', size: 128 }).toString();
        out.push(id + ':' + (svg.startsWith('<svg') ? svg.length : 'NOT-AN-SVG'));
      }
      process.stdout.write(JSON.stringify(out));
    `);

    expect(child.stderr).toBe('');
    expect(child.status).toBe(0);

    const rendered: string[] = JSON.parse(child.stdout);
    expect(rendered).toHaveLength(16);
    rendered.forEach((entry) => {
      const [id, size] = entry.split(':');
      expect(`${id}: ${size}`).not.toContain('NOT-AN-SVG');
      // A real drawing, not an empty root element — the smallest style here is well over 500 bytes.
      expect(Number(size)).toBeGreaterThan(400);
    });
  });

  /**
   * 🔴 AC1's determinism, measured on the real library rather than on `avatarSeed`'s arithmetic.
   * The same word must give the same creature in a later process, or the picture an author picked
   * yesterday is not the one they get today.
   */
  it('is deterministic across processes, and different seeds give different pictures', () => {
    const script = `
      const { createAvatar } = await import('@dicebear/core');
      const thumbs = await import('@dicebear/thumbs');
      const draw = (seed) => createAvatar(thumbs, { seed, size: 128 }).toString();
      process.stdout.write(JSON.stringify([draw('Nibbles'), draw('Nibbles'), draw('Nibbles 2')]));
    `;

    const first = runOffline(script);
    const second = runOffline(script);
    expect(first.status).toBe(0);
    expect(second.status).toBe(0);

    const [a, b, other] = JSON.parse(first.stdout);
    const [laterRun] = JSON.parse(second.stdout);

    expect(a).toBe(b);
    expect(a).toBe(laterRun);
    expect(other).not.toBe(a);
  });

  /**
   * The output has to survive being written to `assets/` and read back by an `<img>`, which is the
   * one thing a byte count cannot tell you. A remote reference would also make the offline claim
   * false at RENDER time even though generation never touched the network.
   */
  it('produces self-contained SVG — no scripts, no external references', () => {
    const child = runOffline(`
      const { createAvatar } = await import('@dicebear/core');
      const ids = ['thumbs','open-peeps','lorelei','notionists','pixel-art','shapes','rings','identicon','glass','adventurer','fun-emoji','croodles','big-smile','micah','personas','toon-head'];
      const bad = [];
      for (const id of ids) {
        const style = await import('@dicebear/' + id);
        const svg = createAvatar(style, { seed: 'Nibbles', size: 128 }).toString();
        if (/<script/i.test(svg)) bad.push(id + ':script');
        if (/<image\\b/i.test(svg)) bad.push(id + ':image-tag');
        if (/(?:xlink:)?href\\s*=\\s*["']https?:/i.test(svg)) bad.push(id + ':external-href');
        if (!/xmlns="http:\\/\\/www\\.w3\\.org\\/2000\\/svg"/.test(svg)) bad.push(id + ':no-xmlns');
        if (!/viewBox=/.test(svg)) bad.push(id + ':no-viewbox');
      }
      process.stdout.write(JSON.stringify(bad));
    `);

    expect(child.stderr).toBe('');
    expect(JSON.parse(child.stdout)).toEqual([]);
  });
});
