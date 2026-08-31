/**
 * VIB-007 — the render that rules register **V22**.
 *
 * 🔴 **A ruling, not a gate** (README §3). The question is a runtime one and no amount of reading the
 * corpus answers it: **when a `For Each` draws a component whose `Component Inputs` node declares no
 * ports, does the item's property reach the port anyway?** 14 shipped examples are built on the
 * assumption that it does, and `catalog:examples` passes all 67 strict.
 *
 * ⚠️ **Two arms, one page, one differing field.** `/Rows/Declared` and `/Rows/Undeclared` differ only
 * in the `ports` array on their `Component Inputs` node (asserted below, from disk). Arm A is the
 * known-firing signal: without it, "arm B shows no value" is indistinguishable from "the repeater
 * never ran", "`Static Data` did not parse", or "the harness served the wrong page".
 *
 * Run it:
 *
 *     npx jest --config packages/nodegx-backend/jest.config.js \
 *       --testMatch '**\/tests/**\/*.look.ts' --runTestsByPath \
 *       packages/nodegx-backend/tests/vib007-v22.look.ts
 */
import { judge, today } from './helpers/judge';

import * as fs from 'fs';
import * as path from 'path';

jest.setTimeout(1800000);

const REPO = path.join(__dirname, '..', '..', '..');
const PROJECT_DIR = path.join(REPO, 'dev-docs', 'tasks', 'phase-81-the-look-is-the-product', 'demo', 'vib-007-v22');
const DATE = today();

type Node = { id: string; type: string; parameters?: Record<string, unknown>; ports?: { name: string; plug: string }[] };

const nodesOf = (compPath: string): Node[] =>
  JSON.parse(fs.readFileSync(path.join(PROJECT_DIR, 'components', compPath, 'nodes.json'), 'utf-8')).nodes ?? [];

const connsOf = (compPath: string) =>
  JSON.parse(fs.readFileSync(path.join(PROJECT_DIR, 'components', compPath, 'connections.json'), 'utf-8')).connections ?? [];

describe('VIB-007 — V22 ruled by a render: does an undeclared component port deliver?', () => {
  it('is a fair experiment — the two arms differ in the ports array and nothing else', () => {
    const a = nodesOf('Rows/Declared');
    const b = nodesOf('Rows/Undeclared');

    const ai = a.find((n) => n.type === 'Component Inputs')!;
    const bi = b.find((n) => n.type === 'Component Inputs')!;
    expect(ai.ports).toEqual([{ name: 'label', plug: 'output', type: '*' }]);
    expect(bi.ports).toBeUndefined();

    // Same connection out of the Component Inputs node in both arms — the shape the 14 corpus
    // examples ship. Without this, arm B would be testing "no wire" rather than "no port".
    for (const comp of ['Rows/Declared', 'Rows/Undeclared']) {
      expect(connsOf(comp)).toEqual([
        { fromId: 'row_inputs', fromProperty: 'label', toId: 'label_text', toProperty: 'text' }
      ]);
    }

    // Everything else identical but the placeholder word, which is the discriminator itself.
    const strip = (ns: Node[]) =>
      JSON.stringify(
        ns
          .filter((n) => n.type !== 'Component Inputs')
          .map((n) => ({ ...n, parameters: { ...n.parameters, text: undefined } }))
      );
    expect(strip(a)).toEqual(strip(b));
  });

  it('feeds both arms three items through a For Each — the same wiring on both', () => {
    const page = nodesOf('Pages/Home');
    for (const [rep, data, template] of [
      ['a_repeater', 'a_data', '/Rows/Declared'],
      ['b_repeater', 'b_data', '/Rows/Undeclared']
    ]) {
      expect(page.find((n) => n.id === rep)?.parameters?.template).toBe(template);
      expect(JSON.parse(String(page.find((n) => n.id === data)?.parameters?.json))).toHaveLength(3);
    }
    expect(connsOf('Pages/Home')).toHaveLength(2);
  });

  it('photographs both arms at all four widths, and reads what each row actually says', async () => {
    const run = await judge({
      task: 'vib-007',
      subject: 'v22',
      state: 'door',
      projectDir: PROJECT_DIR,
      date: DATE,
      pages: [{ label: 'v22', url: '/', as: 'declared vs undeclared component ports, under a For Each' }]
    });

    expect(run.shots.length).toBe(4);

    // 🔴 The ruling itself, read from the rendered text rather than from the graph.
    //
    // ⚠️ `(?<!NOT-)` is not decoration. The first version of this counted `/DELIVERED-B/g`, which
    // matches inside `NOT-DELIVERED-B`, and reported `delivered=3 placeholder=3` on a page where
    // nothing was delivered at all — a substring reading as a word, and it read as the OPPOSITE
    // ruling. The negative lookbehind is what makes the two arms distinguishable.
    for (const shot of run.shots) {
      const txt = fs.readFileSync(
        path.join(REPO, path.dirname(shot.fullPng), path.basename(shot.fullPng).replace(/-full\.png$/, '.txt')),
        'utf-8'
      );
      const count = (s: string) => (txt.match(new RegExp(s, 'g')) ?? []).length;
      const delivered = (arm: string) => count(`(?<!NOT-)DELIVERED-${arm}`);
      const placeholder = (arm: string) => count(`NOT-DELIVERED-${arm}`);

      // eslint-disable-next-line no-console
      console.log(
        `V22 ${shot.viewport.id.padEnd(8)} ` +
          `A: delivered=${delivered('A')} placeholder=${placeholder('A')} | ` +
          `B: delivered=${delivered('B')} placeholder=${placeholder('B')}`
      );

      // 🔴 ARM A IS THE CONTROL AND IT IS ASSERTED FIRST. If it ever reads 0 the experiment has
      // died — the repeater did not run, the Static Data did not parse, the harness served the
      // wrong page — and arm B's zero would mean nothing at all.
      expect(delivered('A')).toBe(3);
      expect(placeholder('A')).toBe(0);

      // THE RULING, 2026-08-31: an undeclared port delivers NOTHING. The repeater still draws the
      // right NUMBER of rows — that is what makes it insidious — and every one shows the
      // component's own placeholder instead of its record's value.
      expect(delivered('B')).toBe(0);
      expect(placeholder('B')).toBe(3);
    }

    // eslint-disable-next-line no-console
    console.log('VIB-007 V22 MANIFEST ' + run.outDir + ' md5=' + run.artefactMd5 + ' head=' + run.headSha);
    for (const s of run.shots) {
      // eslint-disable-next-line no-console
      console.log(
        `  ${s.viewport.id.padEnd(8)} ${String(s.viewport.width).padStart(4)}x${String(s.viewport.height).padStart(4)} ` +
          `contentBottom=${s.contentBottom} canScroll=${s.canScroll} unreachablePx=${s.unreachablePx} textChars=${s.textChars} ` +
          `errors=${s.errors.length}`
      );
    }
  });
});
