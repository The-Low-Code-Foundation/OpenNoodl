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

/**
 * A component input port name is user text — `Align X`, `Margin Bottom`, `Alternate text` are
 * all real corpus port names — and a TypeScript identifier is not. `tsFieldKey`, the static-data
 * field emitter and `recordDataObject` all guard the same way by quoting the key, but a prop
 * cannot be quoted: it has to be a *binding* identifier in the destructuring, and a JSX
 * attribute name at every call site. So the props path maps rather than quotes.
 *
 * The mapping is a pure function of the plan's own prop list, which is how parent and child
 * agree without threading anything between them (the s10 rule): the caller resolves the child's
 * attribute name by running `propIdentifiers` over the *child's* plan, exactly as the child does.
 */
const TS_IDENTIFIER = /^[A-Za-z_$][A-Za-z0-9_$]*$/;

/**
 * Words that are identifier-shaped but cannot be bound. Uncontroversially reserved plus the
 * strict-mode set, because emitted modules are strict. None appears in the corpus; they are here
 * because a name that parses as an identifier and still fails to bind is the same defect wearing
 * a different hat, and the sanitiser is the one place that knows.
 */
const RESERVED_WORDS = new Set([
  'await', 'break', 'case', 'catch', 'class', 'const', 'continue', 'debugger', 'default',
  'delete', 'do', 'else', 'enum', 'export', 'extends', 'false', 'finally', 'for', 'function',
  'if', 'implements', 'import', 'in', 'instanceof', 'interface', 'let', 'new', 'null', 'package',
  'private', 'protected', 'public', 'return', 'static', 'super', 'switch', 'this', 'throw',
  'true', 'try', 'typeof', 'var', 'void', 'while', 'with', 'yield'
]);

/**
 * Whether a bindable-looking identifier is in fact reserved (EXP-011 §45). The state allocator
 * asks it: a checkbox labelled "Private" minted `const [private, setPrivate]`, which is a syntax
 * error in a strict module — the fixture's own typecheck found it, and the sanitiser above had
 * the list all along.
 */
export const isReservedWord = (name: string): boolean => RESERVED_WORDS.has(name);

/**
 * One port name → the identifier it prints as, before per-component collision resolution.
 * A name that is already a bindable identifier is returned untouched — the emitted interface is
 * the author's vocabulary wherever it legally can be.
 */
export function propIdentifier(name: string): string {
  if (TS_IDENTIFIER.test(name) && !RESERVED_WORDS.has(name)) return name;
  const words = name.split(/[^A-Za-z0-9_$]+/).filter((w) => w.length > 0);
  const joined = words.map((w, i) => (i === 0 ? w : w.charAt(0).toUpperCase() + w.slice(1))).join('');
  // A name with nothing identifier-shaped in it at all, or one starting with a digit: `prop` is
  // the last resort, and the numeric pass below makes it unique.
  const base = joined.length === 0 || /^[0-9]/.test(joined) ? `prop${joined.charAt(0).toUpperCase()}${joined.slice(1)}` : joined;
  return RESERVED_WORDS.has(base) ? `${base}Prop` : base;
}

/**
 * Port name → emitted prop identifier, for every declared input prop of one component.
 *
 * Two passes, and the order is the point: a port that is *already* an identifier keeps its name,
 * so a sanitised sibling yields to it rather than stealing it. The generated callback props
 * (`onXChanged`, `onClose`) share the destructuring, so they reserve first.
 */
export function propIdentifiers(plan: {
  props: ReadonlyArray<{ name: string }>;
  outputProps: ReadonlyArray<{ prop: string }>;
  liftedOutputProps: ReadonlyArray<{ prop: string }>;
  closesPopup?: boolean;
}): Map<string, string> {
  const taken = new Set<string>([
    ...plan.outputProps.map((o) => o.prop),
    ...plan.liftedOutputProps.map((l) => l.prop),
    ...(plan.closesPopup === true ? ['onClose'] : [])
  ]);
  const idents = new Map<string, string>();
  for (const prop of plan.props) {
    if (idents.has(prop.name)) continue;
    if (propIdentifier(prop.name) === prop.name && !taken.has(prop.name)) {
      idents.set(prop.name, prop.name);
      taken.add(prop.name);
    }
  }
  for (const prop of plan.props) {
    if (idents.has(prop.name)) continue;
    let ident = propIdentifier(prop.name);
    if (taken.has(ident)) {
      let counter = 2;
      while (taken.has(`${ident}${counter}`)) counter++;
      ident = `${ident}${counter}`;
    }
    idents.set(prop.name, ident);
    taken.add(ident);
  }
  return idents;
}

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
