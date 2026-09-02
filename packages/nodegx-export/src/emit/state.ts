/**
 * The app-state modules (EXP-002 step 5, shapes in EXP-002-STEP5-TARGET-OUTPUT.md §1–§2):
 *
 * - `src/stores/variables.ts` — every app-wide Variable as a `value()` export. One module for
 *   all of them, because the interpreter holds every Variable as one property of the shared
 *   `--ndl--global-variables` record; this file is that record made legible.
 * - `src/events.ts` — every event channel as a typed `channel()` export, the payload interface
 *   being the union of the matching senders' payload keys (exactly how the interpreter's
 *   receiver discovers its output ports).
 *
 * Doc comments carry the writer/sender lists — the one thing a reader of these files cannot
 * see. `@nodegx/core` enters the emitted package.json only because these files import it
 * (dependencies stay computed from the output, TARGET-OUTPUT §3).
 */

import { ChannelPlan, CollectionPlan, ProjectPlan, StorePlan, VariablePlan } from '../analyze/plan';

const GENERATED_STORES = '// @nodegx:generated (stores — provenance markers complete in EXP-007)\n';
const GENERATED_EVENTS = '// @nodegx:generated (events — provenance markers complete in EXP-007)\n';
const GENERATED_COLLECTIONS = '// @nodegx:generated (collections — provenance markers complete in EXP-007)\n';

export function emitStateModules(project: ProjectPlan): Record<string, string> {
  const files: Record<string, string> = {};
  if (project.variables.length > 0) {
    files['src/stores/variables.ts'] = storesModule(project.variables);
  }
  if (project.channels.length > 0) {
    files['src/events.ts'] = eventsModule(project.channels);
  }
  for (const store of project.stores) {
    if (store.deferred !== undefined) continue;
    files[`src/stores/${store.exportName}.ts`] = storeModule(store);
  }
  for (const collection of project.collections) {
    files[`src/collections/${collection.exportName}.ts`] = collectionModule(collection);
  }
  return files;
}

/**
 * One module per named client-side array (COLLECTIONS-TARGET §1): the item interface is the
 * union of statically-known inserted property sets, all optional; the contents start empty
 * (a named array starts empty in the runtime's table); the doc comment is the reader +
 * inserter list.
 */
function collectionModule(collection: CollectionPlan): string {
  const fields = collection.keys.map(
    (k) => `  ${propKey(k.key)}?: ${k.tsType === 'unknown' ? 'unknown' : k.tsType};`
  );
  const iface = `export interface ${collection.interfaceName} {${fields.length > 0 ? `\n${fields.join('\n')}\n` : ''}}`;

  const lines = [
    ...collection.readers.map(
      (r) => `Named by ${r.label !== undefined ? `"${r.label}" ` : ''}(Collection2 \`${r.nodeId}\` on /${r.componentPath}).`
    ),
    ...collection.inserters.map(
      (i) =>
        `Inserted by ${i.label !== undefined ? `"${i.label}" ` : ''}(NewModel \`${i.newModelId}\` → CollectionInsert \`${i.insertId}\` on /${i.componentPath}).`
    ),
    ...collection.mutators.map(
      (m) => `Emptied by ${m.label !== undefined ? `"${m.label}" ` : ''}(${m.nodeType} \`${m.nodeId}\` on /${m.componentPath}).`
    )
  ];
  const comment =
    lines.length === 0
      ? '/** No statically-known reader or inserter — the array exists because nodes name it. */'
      : lines.length === 1
        ? `/** ${lines[0]} */`
        : `/**\n${lines.map((line) => ` * ${line}`).join('\n')}\n */`;

  const declaration = `${comment}\nexport const ${collection.exportName} = collection<${collection.interfaceName}>([]);`;

  return (
    GENERATED_COLLECTIONS + `import { collection } from '@nodegx/core';\n\n` + iface + '\n\n' + declaration + '\n'
  );
}

/**
 * One module per named store (NAMED-STORES-TARGET §1): the state interface from the initial
 * state first and the writers second, the initial-state literal transcribed in shipped key
 * order, and the declarer/writer list as the doc comment.
 *
 * EXP-011 §47: a named **Object** is the same module. It has no initial state — `Model.get(id)`
 * starts `{}` — so every key is optional and typed over its Set Object Properties writers, and
 * the comment reads "Read by" where a Global Store's reads "Declared by".
 */
function storeModule(store: StorePlan): string {
  const fields = store.keys.map(
    (k) => `  ${propKey(k.key)}${k.required ? '' : '?'}: ${k.tsType === 'unknown' ? 'unknown' : k.tsType};`
  );
  const iface = `export interface ${store.interfaceName} {${fields.length > 0 ? `\n${fields.join('\n')}\n` : ''}}`;

  const initialKeys = store.keys.filter((k) => k.required);
  const initial =
    initialKeys.length === 0
      ? '{}'
      : `{\n${initialKeys.map((k) => `  ${propKey(k.key)}: ${tsLiteral(k.initial)}`).join(',\n')}\n}`;

  const declaration =
    `${declarersComment(store)}\n` +
    `export const ${store.exportName} = store<${store.interfaceName}>(${tsLiteral(store.name)}, ${initial});`;

  return (
    GENERATED_STORES + `import { store } from '@nodegx/core';\n\n` + iface + '\n\n' + declaration + '\n'
  );
}

function declarersComment(store: StorePlan): string {
  const verb = store.origin === 'object' ? 'Read by' : 'Declared by';
  const lines = [
    ...store.declarers.map(
      (d) => `${verb} ${d.label !== undefined ? `"${d.label}" ` : ''}(${d.nodeType} \`${d.nodeId}\` on /${d.componentPath}).`
    ),
    ...store.writers.map(
      (w) => `Written by ${w.label !== undefined ? `"${w.label}" ` : ''}(${w.nodeType} \`${w.nodeId}\` on /${w.componentPath}).`
    )
  ];
  if (lines.length === 0) {
    return store.origin === 'object'
      ? '/** No statically-known reader or writer — the object exists because nodes name it. */'
      : '/** No statically-known declarer — the store exists because Subscribe nodes name it. */';
  }
  if (lines.length === 1) return `/** ${lines[0]} */`;
  return `/**\n${lines.map((line) => ` * ${line}`).join('\n')}\n */`;
}

/** An object key as TS source: bare when it is a valid identifier, quoted otherwise. */
export function propKey(key: string): string {
  return /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(key) ? key : tsLiteral(key);
}

/**
 * A JSON value as a TS literal. Strings prefer single quotes (the emitted code's own style)
 * and fall back to the JSON form when quoting or control characters would need escapes.
 */
export function tsLiteral(value: unknown): string {
  if (typeof value === 'string') {
    // eslint-disable-next-line no-control-regex
    return /^[^'\\\u0000-\u001f]*$/.test(value) ? `'${value}'` : JSON.stringify(value);
  }
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (value === null) return 'null';
  return JSON.stringify(value);
}

function storesModule(variables: VariablePlan[]): string {
  const blocks = variables.map((variable) => {
    const tsType = variable.tsType === 'string' ? 'string | undefined' : 'unknown';
    return `${writersComment(variable)}\nexport const ${variable.exportName} = value<${tsType}>(undefined);`;
  });
  return GENERATED_STORES + `import { value } from '@nodegx/core';\n\n` + blocks.join('\n\n') + '\n';
}

function writersComment(variable: VariablePlan): string {
  if (variable.writers.length === 0) {
    return '/** No statically-known writer — reads stay undefined until EXP-003 translates the writing logic. */';
  }
  const lines = variable.writers.map(
    (w) => `Written by ${w.label !== undefined ? `"${w.label}" ` : ''}(${w.nodeType} \`${w.nodeId}\` on /${w.componentPath}).`
  );
  if (lines.length === 1) return `/** ${lines[0]} */`;
  return `/**\n${lines.map((line) => ` * ${line}`).join('\n')}\n */`;
}

function eventsModule(channels: ChannelPlan[]): string {
  const blocks = channels.map((channel) => {
    const parts: string[] = [];
    if (channel.payloadTypeName !== null) {
      const fields = channel.payload.map((p) => `  ${p.key}?: ${p.tsType === 'string' ? 'string' : 'unknown'};`);
      parts.push(`export interface ${channel.payloadTypeName} {\n${fields.join('\n')}\n}`);
    }
    const typeArg = channel.payloadTypeName !== null ? `<${channel.payloadTypeName}>` : '';
    parts.push(`${sendersComment(channel)}\nexport const ${channel.exportName} = channel${typeArg}('${channel.name}');`);
    return parts.join('\n\n');
  });
  return GENERATED_EVENTS + `import { channel } from '@nodegx/core';\n\n` + blocks.join('\n\n') + '\n';
}

function sendersComment(channel: ChannelPlan): string {
  if (channel.senders.length === 0) {
    return '/** No statically-known sender — nothing emits here until EXP-003 translates the sending logic. */';
  }
  const lines = channel.senders.map(
    (s) => `Sent by ${s.label !== undefined ? `"${s.label}" ` : ''}(Event Sender \`${s.nodeId}\` on /${s.componentPath}).`
  );
  if (lines.length === 1) return `/** ${lines[0]} */`;
  return `/**\n${lines.map((line) => ` * ${line}`).join('\n')}\n */`;
}
