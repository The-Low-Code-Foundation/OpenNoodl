/**
 * ERG-003 criterion 6 — "existing projects' list values still load".
 *
 * Argued, that is a claim about code. Measured, it is this: every value actually
 * stored at a list-shaped port in every `project.json` in the repo, decoded
 * through the codec and encoded back, must come out identical. The repo's own
 * projects are the compatibility target the policy keeps
 * (COMPATIBILITY-POLICY.md point 3), and this is the whole corpus of them.
 *
 * It also pins the encodings themselves: if anyone changes how a `stringlist` is
 * stored, this fails with the file and node that proves it, rather than the
 * change looking clean because no unit test happened to use that shape.
 */

import * as fs from 'fs';
import * as path from 'path';

import {
  decodeForEditor,
  encodeFromEditor,
  listPortTypeFor,
  type ListPortType
} from '@noodl-core-ui/components/json-editor/utils/listValueCodec';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const catalog = require('../../../noodl-types/src/node-catalog.json');

const REPO_ROOT = path.resolve(__dirname, '../../../..');

/** nodeTypeName -> portName -> list port type, inputs only. */
const portTypes = new Map<string, Record<string, ListPortType>>();
for (const node of catalog.nodes as TSFixmeNode[]) {
  const map: Record<string, ListPortType> = {};
  for (const port of node.inputs || []) {
    const t = port.type as { editAsType?: unknown } | undefined;
    const eff = t && typeof t === 'object' && t.editAsType ? t.editAsType : port.type;
    const listType = listPortTypeFor(eff);
    if (listType) map[port.name] = listType;
  }
  if (Object.keys(map).length) portTypes.set(node.typeName, map);
}

interface TSFixmeNode {
  typeName: string;
  inputs?: { name: string; type?: unknown }[];
}

interface GraphNode {
  type?: string;
  parameters?: Record<string, unknown>;
  children?: GraphNode[];
}

function findProjectFiles(dir: string, out: string[] = []): string[] {
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const entry of entries) {
    if (entry.name === 'node_modules' || entry.name === '.git') continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) findProjectFiles(full, out);
    else if (entry.name === 'project.json') out.push(full);
  }
  return out;
}

interface StoredValue {
  where: string;
  portType: ListPortType;
  value: unknown;
}

function collectStoredValues(): StoredValue[] {
  const found: StoredValue[] = [];

  for (const file of findProjectFiles(REPO_ROOT)) {
    let project: { components?: { name: string; graph?: { roots?: GraphNode[] } }[] };
    try {
      project = JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch {
      continue; // not a Noodl project
    }

    const walk = (node: GraphNode, component: string) => {
      const map = node.type ? portTypes.get(node.type) : undefined;
      if (map) {
        for (const [key, value] of Object.entries(node.parameters || {})) {
          if (map[key] && value !== undefined) {
            found.push({
              where: `${path.relative(REPO_ROOT, file)} :: ${component} :: ${node.type}.${key}`,
              portType: map[key],
              value
            });
          }
        }
      }
      (node.children || []).forEach((child) => walk(child, component));
    };

    for (const component of project.components || []) {
      for (const root of component.graph?.roots || []) walk(root, component.name);
    }
  }

  return found;
}

const stored = collectStoredValues();

describe('ERG-003 criterion 6 — every list value stored in the repo still loads', () => {
  it('found a corpus worth checking', () => {
    // A sweep returning zero looks the same whether it is clean or broken.
    expect(stored.length).toBeGreaterThan(400);
  });

  it('covers both formats that actually appear', () => {
    const byType = stored.reduce<Record<string, number>>((acc, s) => {
      acc[s.portType] = (acc[s.portType] || 0) + 1;
      return acc;
    }, {});
    // Measured 2026-08-02: 423 stringlist, 55 proplist, and no array/object
    // value stored anywhere in the repo. The last part is why array/object
    // behaviour had to be derived from the code path instead.
    expect(byType.stringlist).toBeGreaterThan(400);
    expect(byType.proplist).toBeGreaterThan(50);
  });

  it('decodes every one of them without falling back to "unreadable"', () => {
    const failures = stored
      .filter((s) => decodeForEditor(s.portType, s.value).unparseable)
      .map((s) => `${s.where} = ${JSON.stringify(s.value)}`);
    expect(failures).toEqual([]);
  });

  it('round-trips every one of them byte-identically', () => {
    const failures: string[] = [];

    for (const item of stored) {
      const decoded = decodeForEditor(item.portType, item.value);
      const encoded = encodeFromEditor(item.portType, decoded.json, item.value);

      if (!encoded.ok) {
        failures.push(`${item.where}: refused on re-encode — ${encoded.error}`);
        continue;
      }

      // An empty list legitimately normalises to `undefined` ("use the default"),
      // which is what the panel has always written.
      const expected = Array.isArray(item.value) && item.value.length === 0 ? undefined : item.value;

      if (JSON.stringify(encoded.value) !== JSON.stringify(expected)) {
        failures.push(`${item.where}: ${JSON.stringify(item.value)} -> ${JSON.stringify(encoded.value)}`);
      }
    }

    expect(failures).toEqual([]);
  });
});
