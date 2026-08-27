/**
 * Class and symbol naming (EXP-002 step 4, rules from EXP-002-TARGET-OUTPUT.md §1–§2):
 *
 * - Class names come from the author's node ids, camelCased. Editor dedup suffixes (`card-3`,
 *   `body-2`) are stripped when no other class in the component claims the base name — v2 ids
 *   are author-chosen and semantic, so this is authoring intent carrying through.
 * - Nodes with byte-identical style declaration sets merge into one class. The merged name is
 *   the ids' longest common camelCase-word suffix when one exists (`nameLabel`/`emailLabel`… →
 *   `label`); failing that their longest common word prefix (`fieldName`/`fieldEmail`… →
 *   `field`, the target's own example); failing both, the alphabetically first id. Determinism
 *   needs a stated tiebreak, so it is stated here.
 * - Machine-generated ids (UUIDs) carry no intent: those nodes name from their authored label,
 *   or fall back to their style role.
 * - Collisions resolve first-wins in tree order with numeric suffixes (D5).
 */

export interface ClassCandidate {
  /** Node ids sharing one merged class, in tree (pre-order) encounter order. */
  nodeIds: string[];
  /** Fallback when every id is machine-generated: authored label of the first node, if any. */
  label?: string;
  /** Style role of the first node — the last-resort name (`page`, `text`, `group`). */
  role: string;
}

/**
 * Assigns one class name per candidate group, in the given order (first-wins for collisions).
 * Returns names parallel to the input array.
 */
export function assignClassNames(groups: ClassCandidate[]): string[] {
  // First pass: the name each group would take with dedup suffixes stripped.
  const stripped = groups.map((group) => baseName(group, true));
  // A stripped suffix stays stripped only while unambiguous: if two groups land on the same
  // base, both keep their full ids instead.
  const counts = new Map<string, number>();
  for (const name of stripped) counts.set(name, (counts.get(name) ?? 0) + 1);

  const used = new Set<string>();
  return groups.map((group, i) => {
    let name = counts.get(stripped[i])! > 1 ? baseName(group, false) : stripped[i];
    if (used.has(name)) {
      let counter = 2;
      while (used.has(`${name}${counter}`)) counter++;
      name = `${name}${counter}`;
    }
    used.add(name);
    return name;
  });
}

function baseName(group: ClassCandidate, stripSuffix: boolean): string {
  const authored = group.nodeIds.filter((id) => !isMachineId(id));
  if (authored.length === 0) {
    return group.label ? lowerFirst(camelCase(group.label)) : group.role;
  }
  if (authored.length === 1) {
    const id = stripSuffix ? stripDedupSuffix(authored[0]) : authored[0];
    return lowerFirst(camelCase(id));
  }
  const words = authored.map((id) => camelWords(camelCase(stripDedupSuffix(id))));
  const suffix = commonAffix(words, 'suffix');
  if (suffix.length > 0) return lowerFirst(suffix.join(''));
  const prefix = commonAffix(words, 'prefix');
  if (prefix.length > 0) return lowerFirst(prefix.join(''));
  const first = [...authored].sort()[0];
  return lowerFirst(camelCase(stripDedupSuffix(first)));
}

/**
 * Splits one identical-style group into merge subgroups. Byte-identical declarations alone are
 * not intent: `sectionHead` can collide with the field wrappers by accident. Ids merge only when
 * they share naming vocabulary — a common first camel word (`fieldName`/`fieldEmail` → `field`)
 * or a common last one (`nameLabel`/`emailLabel` → `label`). The partition (by-first vs by-last)
 * that yields fewer classes wins; ties prefer the suffix. Ids sharing neither keep their own
 * class — duplicate CSS is honest, a stolen name is not. Machine-generated ids never merge.
 */
export function partitionMergeGroup(nodeIds: string[]): string[][] {
  const authored = nodeIds.filter((id) => !isMachineId(id));
  const machine = nodeIds.filter((id) => isMachineId(id));
  if (authored.length < 2) {
    return [...(authored.length > 0 ? [authored] : []), ...machine.map((id) => [id])];
  }
  const words = new Map(authored.map((id) => [id, camelWords(camelCase(stripDedupSuffix(id)))]));
  const byWord = (pick: (w: string[]) => string): string[][] => {
    const buckets = new Map<string, string[]>();
    for (const id of authored) {
      const key = pick(words.get(id)!);
      buckets.set(key, [...(buckets.get(key) ?? []), id]);
    }
    return [...buckets.values()];
  };
  const byFirst = byWord((w) => w[0]);
  const byLast = byWord((w) => w[w.length - 1]);
  const chosen = byFirst.length < byLast.length ? byFirst : byLast;
  return [...chosen, ...machine.map((id) => [id])];
}

/** `card-3` → `card`: the editor's id-collision counter, not authoring intent. */
export function stripDedupSuffix(id: string): string {
  const stripped = id.replace(/-\d+$/, '');
  return stripped.length > 0 ? stripped : id;
}

export function camelCase(text: string): string {
  const words = text.split(/[^A-Za-z0-9]+/).filter((w) => w.length > 0);
  if (words.length === 0) return 'node';
  const joined = words
    .map((word, i) => (i === 0 ? word : word.charAt(0).toUpperCase() + word.slice(1)))
    .join('');
  return /^[0-9]/.test(joined) ? `n${joined}` : joined;
}

export function pascalCase(text: string): string {
  const camel = camelCase(text);
  return camel.charAt(0).toUpperCase() + camel.slice(1);
}

export function lowerFirst(text: string): string {
  return text.charAt(0).toLowerCase() + text.slice(1);
}

/** UUID-shaped ids carry no authoring intent. */
export function isMachineId(id: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
}

/** Splits a camelCase identifier into its words: `nameLabel` → [`name`, `Label`]. */
function camelWords(identifier: string): string[] {
  return identifier.split(/(?=[A-Z])/).filter((w) => w.length > 0);
}

function commonAffix(wordLists: string[][], direction: 'prefix' | 'suffix'): string[] {
  const shortest = Math.min(...wordLists.map((w) => w.length));
  const affix: string[] = [];
  for (let i = 0; i < shortest; i++) {
    const pick = (words: string[]) => (direction === 'prefix' ? words[i] : words[words.length - 1 - i]);
    const candidate = pick(wordLists[0]);
    if (!wordLists.every((words) => pick(words) === candidate)) break;
    if (direction === 'prefix') affix.push(candidate);
    else affix.unshift(candidate);
  }
  // A shared affix that swallows an entire id means the ids differ only by the editor's dedup
  // counter — that is identity, not grouping vocabulary; still a valid merged name.
  return affix;
}
