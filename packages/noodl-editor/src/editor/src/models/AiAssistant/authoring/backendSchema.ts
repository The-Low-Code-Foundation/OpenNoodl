/**
 * AAQ-002 slice 4 — the collections the agent is allowed to write against.
 *
 * ## The defect
 *
 * `AuthoringContextBuilder` had no backend block at all, so an agent authoring a
 * Create Record node wrote `prop-<field>` parameters from **the scope's prose**.
 * Sometimes that matched the collection that got provisioned and sometimes it
 * did not, and nothing in between told anyone which.
 *
 * The strongest argument for this block is not the model's failure but a human's:
 * during the AAQ-002 live pass, a careful reader with the source open set
 * `collection` on a Record node, because that is `resolveSchemaPortContext`'s own
 * default — while the Record family passes `collectionParam: 'collectionName'`.
 * Setting `collection` is completely inert and nothing diagnoses it. If reading
 * the code gets the *parameter name* wrong, guessing the *field names* from prose
 * was never going to come out right.
 *
 * ## Two sources, and why both are needed
 *
 * At authoring time a wizard-built project usually has **no backend yet** — the
 * provision is an operation in the same plan, and it applies at Apply, after
 * every authoring turn has finished. So the plan's own `PlanProvisionSpec` is the
 * only description of the collections that exists while the graph is being
 * written. A project that already has a backend has the opposite: a cached schema
 * and no provision. A run can have either, and a re-run of a plan against a
 * project it already provisioned has both.
 *
 * Pure, and separate from the reader that gathers those two, for the reason
 * `review/backendSummary.ts` gives about itself: the reading of singletons stays
 * on the Electron side, the judgement stays specable.
 *
 * @module AiAssistant/authoring/backendSchema
 */

/** One collection as the agent is shown it. */
export interface SchemaCollectionInfo {
  name: string;
  fields: { name: string; type: string }[];
}

/** How many collections and fields a prompt block will show before summarising. */
const MAX_COLLECTIONS = 30;
const MAX_FIELDS = 40;

/**
 * The union of what a plan will create and what the project already has.
 *
 * The **planned** side wins on a name collision, because it is the newer
 * statement of intent: a provision that adds a column to an existing collection
 * has already been approved by the user in the plan review, and by the time the
 * graph runs it will be true. Fields are merged rather than replaced, so a
 * collection that exists with five columns and is being given a sixth is shown
 * with all six.
 *
 * Matching is **case-insensitive on both names**, for the reason
 * `planSchemaReconciliation` documents: SQLite identifiers are, so `Age` and
 * `age` are one column and listing both would invite the agent to write a
 * parameter for a port that will never exist.
 */
export function mergeSchemaCollections(
  planned: readonly SchemaCollectionInfo[] = [],
  cached: readonly SchemaCollectionInfo[] = []
): SchemaCollectionInfo[] {
  const merged = new Map<string, SchemaCollectionInfo>();

  const take = (collections: readonly SchemaCollectionInfo[], plannedWins: boolean) => {
    for (const collection of collections) {
      const name = collection?.name?.trim();
      if (!name) continue;
      const key = name.toLowerCase();
      const existing = merged.get(key);
      if (!existing) {
        merged.set(key, { name, fields: [...(collection.fields ?? [])] });
        continue;
      }
      for (const field of collection.fields ?? []) {
        const at = existing.fields.findIndex((f) => f.name.toLowerCase() === field.name.toLowerCase());
        if (at === -1) existing.fields.push(field);
        else if (plannedWins) existing.fields[at] = field;
      }
    }
  };

  take(cached, false);
  take(planned, true);

  return [...merged.values()];
}

/**
 * The collections, as a prompt block — or `undefined` when there are none.
 *
 * Absent means omitted, following `libraryOverview`'s convention: a project with
 * no backend pays zero prompt bytes for this and sends a byte-identical turn to
 * before, which matters because the opening turn is AIX-007's cache-stable prefix.
 *
 * ⚠️ The block names the parameter — `collectionName`, not `collection` — and the
 * `prop-` prefix, because both are runtime-discovered ports that the node catalog
 * does not declare. `checkParameterValues` skips dynamic-port nodes entirely, so
 * a wrong name here is not caught by the gate: telling the agent is the whole
 * defence, not a convenience.
 */
export function renderBackendSchema(collections: readonly SchemaCollectionInfo[]): string | undefined {
  if (collections.length === 0) return undefined;

  const lines = [
    "This project's backend holds these collections. Use them for every data node — do not invent " +
      'collection or field names:'
  ];

  for (const collection of collections.slice(0, MAX_COLLECTIONS)) {
    const fields = collection.fields ?? [];
    const shown = fields.slice(0, MAX_FIELDS);
    const rendered = shown.map((f) => `${f.name} (${f.type})`).join(', ');
    const more = fields.length > shown.length ? `, … ${fields.length - shown.length} more` : '';
    lines.push(`- ${collection.name}: ${rendered || 'no fields declared yet'}${more}`);
  }
  if (collections.length > MAX_COLLECTIONS) {
    lines.push(`… ${collections.length - MAX_COLLECTIONS} more collections omitted`);
  }

  lines.push(
    '',
    'On Create Record / Query Records / Update Record and the rest of the Record family, the collection is set ' +
      'with the `collectionName` parameter — NOT `collection`, which is silently ignored. Each field of the ' +
      'chosen collection becomes an input port named `prop-<field>`, e.g. `prop-name`. Every objectId, createdAt ' +
      'and updatedAt is supplied by the backend; never write them.'
  );

  return lines.join('\n');
}
