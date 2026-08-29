/**
 * QueryBuilder - Translates Parse-style queries to SQLite SQL
 *
 * Parse uses operators like $eq, $ne, $gt, $lt, $in, etc.
 * This translates them to SQL WHERE clauses.
 *
 * @module adapters/local-sql/QueryBuilder
 */

import {
  EARTH_RADIUS_KM,
  KM_PER_MILE,
  SQL_DISTANCE_KM,
  SQL_POINT_IN_POLYGON,
  SQL_REGEXP
} from './sqlFunctions';

/** The caller's row-level access context (BAK-003). */
export interface AclContext {
  access: 'read' | 'write';
  keys: string[];
}

/** A built statement: the SQL text and its bound parameters, in order. */
export interface BuiltQuery {
  sql: string;
  params: unknown[];
}

/** A value as it appears in a Parse-style payload — open JSON plus Parse's tagged objects. */
interface ParseTaggedValue {
  __type?: string;
  iso?: string;
  objectId?: string;
  className?: string;
  [extra: string]: unknown;
}

interface QueryOptionsBase {
  collection: string;
  where?: Record<string, unknown>;
  acl?: AclContext;
}

interface SelectOptions extends QueryOptionsBase {
  select?: string | string[];
  sort?: string | string[];
  limit?: number;
  skip?: number;
}

interface SearchOptions extends QueryOptionsBase {
  /** The raw search term; turned into an FTS5 MATCH string by {@link toFts5MatchQuery}. */
  search: string;
  sort?: string | string[];
  limit?: number;
  skip?: number;
}

/** One aggregate output column: exactly one of the operators is set. */
interface AggregateGroupConfig {
  avg?: string;
  sum?: string;
  max?: string;
  min?: string;
  distinct?: string;
}

/**
 * Reserved SQLite keywords that need to be escaped
 */
const RESERVED_WORDS = new Set([
  'order',
  'group',
  'select',
  'from',
  'where',
  'index',
  'table',
  'create',
  'drop',
  'alter',
  'delete',
  'insert',
  'update',
  'key',
  'primary',
  'foreign',
  'references',
  'null',
  'not',
  'and',
  'or',
  'in',
  'like',
  'between',
  'is',
  'exists',
  'case',
  'when',
  'then',
  'else',
  'end',
  'join',
  'inner',
  'outer',
  'left',
  'right',
  'on',
  'as',
  'asc',
  'desc',
  'limit',
  'offset',
  'union',
  'distinct',
  'all',
  'any',
  'some',
  'true',
  'false',
  'default',
  'values',
  'set',
  'into',
  'by',
  'having',
  'count',
  'sum',
  'avg',
  'min',
  'max'
]);

/**
 * Escape a table name for SQL
 */
export function escapeTable(name: string): string {
  // Sanitize: only allow alphanumeric and underscore
  const sanitized = name.replace(/[^a-zA-Z0-9_]/g, '');
  return `"${sanitized}"`;
}

/**
 * Escape a column name for SQL
 */
export function escapeColumn(name: string): string {
  // Sanitize: only allow alphanumeric and underscore
  const sanitized = name.replace(/[^a-zA-Z0-9_]/g, '');
  // Always quote to handle reserved words
  return `"${sanitized}"`;
}

/**
 * What the table actually has, for the one question SQL will not be asked
 * politely (DEF-014).
 *
 * A collection here is created on first use with **no user columns at all**
 * (`LocalSQLAdapter._ensureTable`), and its columns appear one at a time as
 * writes arrive (`create`/`save` → `SchemaManager.addColumn`). So on the day an
 * app is made, every property it filters on is a column that does not exist
 * yet — and `WHERE "pageId" = ?` against a table without a `pageId` is not an
 * empty result in SQLite, it is `no such column`, which the adapter surfaces as
 * an error and the HTTP layer as a 500. "Nothing has been written yet" is the
 * ordinary state of a new app, not a fault, and a query is entitled to say
 * *nothing matches* about it.
 *
 * `present` is read from `PRAGMA table_info` on the live connection at build
 * time — never from `_Schema`, which for an auto-created table records
 * `{"columns": []}` and therefore knows nothing the table does not. When it is
 * omitted the builder substitutes nothing and behaves exactly as it always has;
 * a caller that cannot see the schema must not guess that a column is missing.
 *
 * @see columnRef for the substitution and the semantics it is chosen to match.
 */
export interface ColumnScope {
  /** Column names the table has right now, as `PRAGMA table_info` reports them. */
  present: ReadonlySet<string>;
  /** Out-parameter: every name substituted, so the caller can report the typo case. */
  absent?: Set<string>;
}

/**
 * A column reference, or `NULL` when the table has no such column.
 *
 * **The rule, stated once: a column the table does not have behaves exactly
 * like a column it does have and no row has filled in.** That is not a
 * convenience choice — it is the only one that keeps every operator consistent
 * without writing a second set of semantics for absence. Substituting the SQL
 * literal `NULL` for the column reference reproduces the all-NULL column's
 * answer term by term: `= ?`, `!= ?`, `IN`, `NOT IN`, `>` and `LIKE` all
 * evaluate to NULL and match nothing; `IS NULL` (`$exists: false`) matches
 * every row; `IS NOT NULL` (`$exists: true`) matches none. Those are the
 * readings an all-NULL column gives today, and the equivalence is asserted as a
 * pair in the specs rather than reasoned about here.
 *
 * ⚠️ It is deliberately **not** "return no rows". An implementation that
 * short-circuits the whole query to empty gets `$exists: false` and `$ne`
 * backwards, and passes a test that only ever asks for the day-one case.
 */
export function columnRef(name: string, scope?: ColumnScope, tableAlias?: string): string {
  const escaped = escapeColumn(name);
  if (scope && !scope.present.has(escaped.slice(1, -1))) {
    scope.absent?.add(name);
    return 'NULL';
  }
  return tableAlias ? `${tableAlias}.${escaped}` : escaped;
}

/**
 * Build the row-level ACL predicate (BAK-003).
 *
 * A row is visible/writable when its ACL column is NULL (no ACL = public,
 * Parse semantics) or when any of the caller's principal keys ('*', a userId,
 * 'role:<name>') grants the requested access. The check runs IN SQL — never
 * post-filtered in JS — because count/limit/skip must operate on the visible
 * set, not the raw set. Principal keys are bound parameters, never
 * interpolated.
 *
 * @param tableName - Unescaped table name (for column qualification)
 * @param acl - Caller's access context
 * @param params - Parameter array to push principal keys to
 * @returns SQL predicate, or '' when acl is absent
 */
export function buildAclPredicate(tableName: string, acl: AclContext | undefined, params: unknown[]): string {
  if (!acl || !Array.isArray(acl.keys)) {
    return '';
  }
  const access = acl.access === 'write' ? 'write' : 'read';
  const aclCol = `${escapeTable(tableName)}."ACL"`;
  if (acl.keys.length === 0) {
    // No principal keys at all: only un-ACL'd (public) rows qualify.
    return `(${aclCol} IS NULL)`;
  }
  const placeholders = acl.keys.map(() => '?').join(', ');
  params.push(...acl.keys);
  return (
    `(${aclCol} IS NULL OR EXISTS (` +
    `SELECT 1 FROM json_each(${aclCol}) AS _acl_entry ` +
    `WHERE _acl_entry.key IN (${placeholders}) ` +
    `AND json_extract(_acl_entry.value, '$.${access}') = 1))`
  );
}

/**
 * Convert a Parse Date object to ISO string for SQLite
 */
function convertDateValue(value: unknown): unknown {
  const tagged = value as ParseTaggedValue | null | undefined;
  if (tagged && tagged.__type === 'Date' && tagged.iso) {
    return tagged.iso;
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  return value;
}

/**
 * Convert a Parse Pointer to its objectId
 */
function convertPointerValue(value: unknown): unknown {
  const tagged = value as ParseTaggedValue | null | undefined;
  if (tagged && tagged.__type === 'Pointer' && tagged.objectId) {
    return tagged.objectId;
  }
  return value;
}

/**
 * One bound value, on its way from a Parse-style `where` into a SQLite
 * parameter slot.
 *
 * 🔴 **The boolean leg is a defect fix, not a convenience** (SB-008 F18). The
 * write path has always folded booleans to 0/1 — `serializeValue`, below,
 * `// Handle booleans - SQLite uses 0/1` — and the read path never did, so a
 * value this driver had itself stored as `1` could not be asked for by the
 * literal it was written as. better-sqlite3 refuses to bind a JS boolean at
 * all, so the failure was not a wrong answer but a throw: *"Provided value
 * cannot be bound to SQLite parameter 1"*, surfaced as a **500** from
 * `/classes/:c` and as `query-records/query-failed` in a browser.
 *
 * Measured before the change, on one table, one route, three arms: `{flag:true}`
 * → 500, `{flag:1}` → 200 with the row, `{name:'yes'}` → 200 (the control that
 * says the route itself works). The second arm is what makes this the missing
 * conversion rather than a storage question — the data was already in the shape
 * the fix converts to.
 *
 * ⚠️ **Nothing that works today can regress**: every path this changes threw
 * before it, on every input, in every adapter mode. What it can change is a
 * caller that was *relying* on the 500, and there is none — the throw reaches
 * the wire as a generic server error.
 *
 * Applied at all four binding sites (direct equality, the comparison operators,
 * `$in`, `$nin`) rather than at one, because a boolean is legal in every one of
 * them and a half-converted operator set is the harder bug to find.
 */
function convertQueryValue(value: unknown): unknown {
  const converted = convertDateValue(convertPointerValue(value));
  if (typeof converted === 'boolean') return converted ? 1 : 0;
  return converted;
}

/**
 * Build a WHERE clause from a Parse-style query
 *
 * @param where - Parse-style query object
 * @param params - Array to push parameter values to
 * @param schema - Optional schema for type-aware conversion
 * @param scope - DEF-014: the table's real columns. A condition naming a
 *   column the table does not have compiles to `NULL`, which answers exactly as
 *   an all-NULL column would, instead of failing the whole statement with
 *   `no such column`. Omitted = no substitution (see {@link ColumnScope}).
 * @param tableAlias - BAK-008: when the caller is joining the
 *   collection's table against another (the FTS5 shadow table, whose columns
 *   are named after the indexed fields), unqualified column references like
 *   `"title" = ?` become ambiguous. Passing the escaped table name/alias here
 *   qualifies every column reference (`"table"."title" = ?`). Omitted by every
 *   pre-existing call site, so behavior there is unchanged.
 * @returns SQL WHERE clause (without "WHERE" keyword)
 */
export function buildWhereClause(
  where: Record<string, unknown> | undefined,
  params: unknown[],
  schema?: unknown,
  tableAlias?: string,
  scope?: ColumnScope
): string {
  if (!where || Object.keys(where).length === 0) {
    return '';
  }

  const conditions: string[] = [];

  for (const [key, condition] of Object.entries(where)) {
    // Handle logical operators
    if (key === '$and' && Array.isArray(condition)) {
      const subConditions = condition
        .map((sub) => buildWhereClause(sub as Record<string, unknown>, params, schema, tableAlias, scope))
        .filter((c) => c);
      if (subConditions.length > 0) {
        conditions.push(`(${subConditions.join(' AND ')})`);
      }
      continue;
    }

    if (key === '$or' && Array.isArray(condition)) {
      const subConditions = condition
        .map((sub) => buildWhereClause(sub as Record<string, unknown>, params, schema, tableAlias, scope))
        .filter((c) => c);
      if (subConditions.length > 0) {
        conditions.push(`(${subConditions.join(' OR ')})`);
      }
      continue;
    }

    // Handle $relatedTo - this is tricky with SQLite
    if (key === '$relatedTo') {
      // For relations, we need a subquery on the junction table
      const { object, key: relationKey } = condition as {
        object?: { objectId?: string; className?: string };
        key?: string;
      };
      if (object && object.objectId && object.className && relationKey) {
        const junctionTable = `_Join_${relationKey}_${object.className}`;
        const idCol = tableAlias ? `${tableAlias}."objectId"` : '"objectId"';
        conditions.push(`${idCol} IN (SELECT "relatedId" FROM ${escapeTable(junctionTable)} WHERE "owningId" = ?)`);
        params.push(object.objectId);
      }
      continue;
    }

    // Handle field conditions
    const col = columnRef(key, scope, tableAlias);

    if (typeof condition !== 'object' || condition === null) {
      // Direct equality
      conditions.push(`${col} = ?`);
      params.push(convertQueryValue(condition));
      continue;
    }

    // Handle Parse operators
    //
    // Two operators are *modifiers* rather than conditions: `$options` carries
    // the regex flags for `$regex`, and the three `$maxDistanceIn…` keys carry
    // the radius for `$nearSphere`. They sit beside the operator they modify in
    // the same condition object, so the whole object is passed down — reading
    // them as standalone operators is how a set of flags would become a
    // condition of its own.
    const siblings = condition as Record<string, unknown>;
    for (const [op, value] of Object.entries(condition)) {
      const sqlCondition = translateOperator(col, op, value, params, schema, siblings);
      if (sqlCondition) {
        conditions.push(sqlCondition);
      }
    }
  }

  return conditions.join(' AND ');
}

/** The three spellings Parse accepts for a `$nearSphere` radius, in kilometres. */
function maxDistanceKm(siblings: Record<string, unknown> | undefined): number | null {
  if (!siblings) return null;
  const miles = siblings.$maxDistanceInMiles;
  if (typeof miles === 'number') return miles * KM_PER_MILE;
  const km = siblings.$maxDistanceInKilometers;
  if (typeof km === 'number') return km;
  const radians = siblings.$maxDistanceInRadians;
  if (typeof radians === 'number') return radians * EARTH_RADIUS_KM;
  return null;
}

/**
 * Translate a single Parse operator to SQL
 *
 * @param col - Escaped column name
 * @param op - Parse operator ($eq, $ne, etc.)
 * @param value - Comparison value
 * @param params - Parameters array to push values to
 * @param schema - Optional schema
 * @param siblings - The whole condition object, for operators whose argument is
 *   split across sibling keys ($regex/$options, $nearSphere/$maxDistanceIn…).
 * @returns SQL condition or null
 */
function translateOperator(
  col: string,
  op: string,
  value: unknown,
  params: unknown[],
  schema?: unknown,
  siblings?: Record<string, unknown>
): string | null {
  // Convert special types
  const convertedValue = convertQueryValue(value);

  switch (op) {
    case '$eq':
      if (convertedValue === null) {
        return `${col} IS NULL`;
      }
      params.push(convertedValue);
      return `${col} = ?`;

    case '$ne':
      if (convertedValue === null) {
        return `${col} IS NOT NULL`;
      }
      params.push(convertedValue);
      return `${col} != ?`;

    case '$gt':
      params.push(convertedValue);
      return `${col} > ?`;

    case '$gte':
      params.push(convertedValue);
      return `${col} >= ?`;

    case '$lt':
      params.push(convertedValue);
      return `${col} < ?`;

    case '$lte':
      params.push(convertedValue);
      return `${col} <= ?`;

    case '$in': {
      if (!Array.isArray(value) || value.length === 0) {
        return '0'; // Always false
      }
      const inValues = value.map((v) => convertQueryValue(v));
      const placeholders = inValues.map(() => '?').join(', ');
      params.push(...inValues);
      return `${col} IN (${placeholders})`;
    }

    case '$nin': {
      if (!Array.isArray(value) || value.length === 0) {
        return '1'; // Always true (not in empty set)
      }
      const ninValues = value.map((v) => convertQueryValue(v));
      const ninPlaceholders = ninValues.map(() => '?').join(', ');
      params.push(...ninValues);
      return `${col} NOT IN (${ninPlaceholders})`;
    }

    case '$exists':
      return value ? `${col} IS NOT NULL` : `${col} IS NULL`;

    case '$regex':
      // BCN-003. This was `LIKE '%value%'`, with the code's own comment
      // conceding "only handles basic patterns" — so `^Ada$` searched for that
      // literal text, matched nothing, and reported no error. Anchors,
      // character classes and groups were all silently inert.
      //
      // SQLite still has no native REGEXP, but `node:sqlite` can call back into
      // JavaScript, so the pattern is now evaluated by the same engine the
      // user's browser would use. `$options` is read from the sibling key
      // rather than as an operator of its own.
      params.push(String(value), typeof siblings?.$options === 'string' ? siblings.$options : '');
      return `${SQL_REGEXP}(?, ?, ${col}) = 1`;

    case '$options':
      // A modifier on $regex, consumed above. Not a condition.
      return null;

    case '$text': {
      // Full text search - convert to LIKE
      const textValue = value as { $search?: string | { $term?: string } } | null | undefined;
      if (textValue && textValue.$search) {
        const term = typeof textValue.$search === 'string' ? textValue.$search : textValue.$search.$term || '';
        params.push(`%${term}%`);
        return `${col} LIKE ?`;
      }
      return null;
    }

    case 'contains':
    case '$contains':
      // Contains search - convert to LIKE with wildcards
      params.push(`%${convertedValue}%`);
      return `${col} LIKE ?`;

    // ── Geo ────────────────────────────────────────────────────────────────
    //
    // All three used to `console.warn` and return null, and a null condition is
    // simply not added to the WHERE clause — so a "within 5 km" query returned
    // every record in the collection and nothing in the app could tell. BCN-001
    // found it; Richard assigned it here on 2026-07-31.
    //
    // A GeoPoint is stored as its Parse tagged object, JSON-encoded in a TEXT
    // column, which is why the box test reads through `json_extract` and the
    // other two hand the raw column to a function. None of the three can use an
    // index — that is the cost, and it is what the descriptor now says out loud
    // rather than what it used to imply by saying nothing.

    case '$nearSphere': {
      const centre = value as { latitude?: number; longitude?: number } | null;
      if (!centre || typeof centre.latitude !== 'number' || typeof centre.longitude !== 'number') {
        return null;
      }
      const radiusKm = maxDistanceKm(siblings);
      if (radiusKm === null) {
        // Parse reads a bare `$nearSphere` as "sort by proximity" rather than
        // as a filter. Sorting is explicitly out of BCN-003's scope, so the
        // honest translation of the *filter* is the one that narrows nothing —
        // but it still excludes rows with no usable point, which is what the
        // distance comparison below would do anyway.
        params.push(centre.latitude, centre.longitude);
        return `${SQL_DISTANCE_KM}(${col}, ?, ?) IS NOT NULL`;
      }
      params.push(centre.latitude, centre.longitude, radiusKm);
      return `${SQL_DISTANCE_KM}(${col}, ?, ?) <= ?`;
    }

    case '$maxDistanceInMiles':
    case '$maxDistanceInKilometers':
    case '$maxDistanceInRadians':
      // Modifiers on $nearSphere, consumed above.
      return null;

    case '$within': {
      // `{$box: [southwest, northeast]}` — two opposite corners, so this is a
      // pair of ordinary range comparisons on the stored coordinates and the
      // only geo operator here that a plain index could ever help.
      const box = (value as { $box?: Array<{ latitude?: number; longitude?: number }> } | null)?.$box;
      if (!Array.isArray(box) || box.length !== 2) return null;
      const [southwest, northeast] = box;
      if (
        typeof southwest?.latitude !== 'number' ||
        typeof southwest?.longitude !== 'number' ||
        typeof northeast?.latitude !== 'number' ||
        typeof northeast?.longitude !== 'number'
      ) {
        return null;
      }
      params.push(
        Math.min(southwest.latitude, northeast.latitude),
        Math.max(southwest.latitude, northeast.latitude),
        Math.min(southwest.longitude, northeast.longitude),
        Math.max(southwest.longitude, northeast.longitude)
      );
      return (
        `json_extract(${col}, '$.latitude') BETWEEN ? AND ? ` +
        `AND json_extract(${col}, '$.longitude') BETWEEN ? AND ?`
      );
    }

    case '$geoWithin': {
      const polygon = (value as { $polygon?: unknown[] } | null)?.$polygon;
      if (!Array.isArray(polygon) || polygon.length < 3) return null;
      params.push(JSON.stringify(polygon));
      return `${SQL_POINT_IN_POLYGON}(${col}, ?) = 1`;
    }

    default:
      // Reaching here means the query asked for something this translator has
      // no branch for, and returning null would drop the condition and widen
      // the result set — the failure class BCN-003 exists to close. The filter
      // translators refuse an operator the descriptor does not declare, so an
      // unknown one arriving at the SQL layer is a defect rather than a user
      // error, and it should be loud.
      throw new Error(
        `The built-in backend received a filter operator it cannot translate: ${op}. ` +
          'Refusing rather than dropping it, because a dropped condition returns more rows than the filter asked for.'
      );
  }
}

/**
 * Build ORDER BY clause from Parse-style sort
 *
 * @param sort - Sort specification (e.g., 'name' or '-createdAt' for desc)
 * @param tableAlias - BAK-008: qualify column references (see buildWhereClause).
 * @param scope - DEF-014: sorting by a column the table does not have compiles
 *   to `ORDER BY NULL`, which is what sorting by an all-NULL column does — every
 *   row ties. Before this, a list page sorted by a property nothing had written
 *   yet failed the same way a filter on one did.
 * @returns SQL ORDER BY clause (without "ORDER BY" keyword)
 */
export function buildOrderClause(
  sort: string | string[] | undefined,
  tableAlias?: string,
  scope?: ColumnScope
): string {
  if (!sort) {
    return '';
  }

  const sortArray = Array.isArray(sort) ? sort : sort.split(',');

  const orders = sortArray.map((s) => {
    const trimmed = s.trim();
    const desc = trimmed.startsWith('-');
    const name = desc ? trimmed.substring(1) : trimmed;
    const col = columnRef(name, scope, tableAlias);
    return `${col} ${desc ? 'DESC' : 'ASC'}`;
  });

  return orders.join(', ');
}

/**
 * Build a SELECT query
 */
export function buildSelect(options: SelectOptions, schema?: unknown, scope?: ColumnScope): BuiltQuery {
  const params: unknown[] = [];
  const table = escapeTable(options.collection);

  // Build SELECT clause
  let selectClause = '*';
  if (options.select) {
    const selectArray = Array.isArray(options.select) ? options.select : options.select.split(',');
    // Always include the record key. DEBT-006: this said 'id', a column the
    // schema never creates — tables key on "objectId" (SchemaManager), which the
    // relation subquery in buildWhere already used.
    const fields = new Set(['objectId', ...selectArray.map((s) => s.trim())]);
    selectClause = Array.from(fields)
      .map((f) => {
        // DEF-014: `select` names columns too. An absent one is selected as an
        // explicit NULL under its own name, so the record carries the key with
        // no value — the same row an all-NULL column produces — rather than the
        // statement failing and the caller getting no record at all.
        const ref = columnRef(f, scope);
        return ref === 'NULL' ? `NULL as ${escapeColumn(f)}` : ref;
      })
      .join(', ');
  }

  let sql = `SELECT ${selectClause} FROM ${table}`;

  // Build WHERE clause (query filter AND row-level ACL predicate)
  const conditions: string[] = [];
  if (options.where) {
    const whereClause = buildWhereClause(options.where, params, schema, undefined, scope);
    if (whereClause) {
      conditions.push(whereClause);
    }
  }
  const aclClause = buildAclPredicate(options.collection, options.acl, params);
  if (aclClause) {
    conditions.push(aclClause);
  }
  if (conditions.length > 0) {
    sql += ` WHERE ${conditions.join(' AND ')}`;
  }

  // Build ORDER BY clause
  if (options.sort) {
    const orderClause = buildOrderClause(options.sort, undefined, scope);
    if (orderClause) {
      sql += ` ORDER BY ${orderClause}`;
    }
  }

  // Build LIMIT/OFFSET
  if (options.limit !== undefined) {
    sql += ' LIMIT ?';
    params.push(options.limit);
  }

  if (options.skip !== undefined && options.skip > 0) {
    sql += ' OFFSET ?';
    params.push(options.skip);
  }

  return { sql, params };
}

/**
 * Build a COUNT query
 */
export function buildCount(options: QueryOptionsBase, schema?: unknown, scope?: ColumnScope): BuiltQuery {
  const params: unknown[] = [];
  const table = escapeTable(options.collection);

  let sql = `SELECT COUNT(*) as count FROM ${table}`;

  const conditions: string[] = [];
  if (options.where) {
    const whereClause = buildWhereClause(options.where, params, schema, undefined, scope);
    if (whereClause) {
      conditions.push(whereClause);
    }
  }
  const aclClause = buildAclPredicate(options.collection, options.acl, params);
  if (aclClause) {
    conditions.push(aclClause);
  }
  if (conditions.length > 0) {
    sql += ` WHERE ${conditions.join(' AND ')}`;
  }

  return { sql, params };
}

/**
 * Build an INSERT query
 */
export function buildInsert(options: { collection: string; data: Record<string, unknown> }, id: string): BuiltQuery {
  const params: unknown[] = [];
  const table = escapeTable(options.collection);

  const now = new Date().toISOString();
  const data: Record<string, unknown> = {
    objectId: id,
    createdAt: now,
    updatedAt: now,
    ...options.data
  };

  // Remove protected fields
  delete data._createdAt;
  delete data._updatedAt;

  const columns: string[] = [];
  const placeholders: string[] = [];

  for (const [key, value] of Object.entries(data)) {
    columns.push(escapeColumn(key));
    placeholders.push('?');
    params.push(serializeValue(value));
  }

  const sql = `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${placeholders.join(', ')})`;

  return { sql, params };
}

/**
 * Build an UPDATE query
 */
export function buildUpdate(options: {
  collection: string;
  id?: string;
  objectId?: string;
  data: Record<string, unknown>;
  acl?: AclContext;
}): BuiltQuery {
  const params: unknown[] = [];
  const table = escapeTable(options.collection);

  const data = { ...options.data };

  // Add updatedAt
  data.updatedAt = new Date().toISOString();

  // Remove protected fields
  delete data.id;
  delete data.createdAt;
  delete data._createdAt;
  delete data._updatedAt;

  const setClause: string[] = [];

  for (const [key, value] of Object.entries(data)) {
    setClause.push(`${escapeColumn(key)} = ?`);
    params.push(serializeValue(value));
  }

  // Use id or objectId for backwards compatibility
  const recordId = options.id || options.objectId;
  params.push(recordId);

  let sql = `UPDATE ${table} SET ${setClause.join(', ')} WHERE "objectId" = ?`;

  // Row-level write check compiled into the statement itself: 0 rows changed
  // means not-found OR forbidden, indistinguishably (no read-then-write race,
  // no existence leak).
  const aclClause = buildAclPredicate(options.collection, options.acl, params);
  if (aclClause) {
    sql += ` AND ${aclClause}`;
  }

  return { sql, params };
}

/**
 * Build a DELETE query
 */
export function buildDelete(options: {
  collection: string;
  id?: string;
  objectId?: string;
  acl?: AclContext;
}): BuiltQuery {
  const table = escapeTable(options.collection);
  // Use id or objectId for backwards compatibility
  const recordId = options.id || options.objectId;
  const params: unknown[] = [recordId];
  let sql = `DELETE FROM ${table} WHERE "objectId" = ?`;
  const aclClause = buildAclPredicate(options.collection, options.acl, params);
  if (aclClause) {
    sql += ` AND ${aclClause}`;
  }
  return { sql, params };
}

/**
 * Build an INCREMENT query
 */
export function buildIncrement(options: {
  collection: string;
  id?: string;
  objectId?: string;
  properties: Record<string, number>;
  acl?: AclContext;
}): BuiltQuery {
  const params: unknown[] = [];
  const table = escapeTable(options.collection);

  const setClause: string[] = [];

  for (const [key, amount] of Object.entries(options.properties)) {
    const col = escapeColumn(key);
    setClause.push(`${col} = COALESCE(${col}, 0) + ?`);
    params.push(amount);
  }

  // Add updatedAt
  setClause.push('"updatedAt" = ?');
  params.push(new Date().toISOString());

  // Use id or objectId for backwards compatibility
  const recordId = options.id || options.objectId;
  params.push(recordId);

  let sql = `UPDATE ${table} SET ${setClause.join(', ')} WHERE "objectId" = ?`;

  const aclClause = buildAclPredicate(options.collection, options.acl, params);
  if (aclClause) {
    sql += ` AND ${aclClause}`;
  }

  return { sql, params };
}

/**
 * Turn a plain user-typed search phrase into a safe FTS5 MATCH query string
 * (BAK-008).
 *
 * FTS5's default query syntax is NOT a plain-text search box: bare `-` means
 * "exclude the next term", `:` prefixes a column filter, `*` is a prefix
 * wildcard, and unbalanced `"` is a syntax error — so an ordinary phrase like
 * "state-of-the-art" or someone's own literal `"quoted"` input would either
 * throw ("no such column: ...") or silently mean something the user never
 * intended. Wrapping each whitespace-separated chunk in its own double-quoted
 * FTS5 string literal makes every character inside it literal (no operators),
 * while still tokenizing normally within the quotes — the index and the query
 * use the same tokenizer, so a hyphenated word like "state-of-the-art" still
 * matches the same stored value it was split from. Multiple words remain an
 * implicit AND across independent phrases (unchanged, order-insensitive)
 * rather than becoming one big order-sensitive phrase.
 *
 * @param term - raw user input
 * @returns an FTS5 query string safe to bind as the MATCH RHS
 */
export function toFts5MatchQuery(term: string): string {
  return String(term)
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((tok) => `"${tok.replace(/"/g, '""')}"`)
    .join(' ');
}

/**
 * Build a search+filter+ACL SELECT joined against a collection's FTS5 shadow
 * table (BAK-008). MATCHes `options.search` (an FTS5 query string) against the
 * indexed fields, ANDs in the normal structured `where` and the row-level ACL
 * predicate (unchanged — reused verbatim, shared tests with BAK-003), and
 * ranks by BM25 (SQLite convention: lower/more-negative is a better match).
 * Also selects an auto-column snippet.
 *
 * Requires `<collection>_fts` to exist (SchemaManager.rebuildSearchIndex) —
 * callers should translate the resulting "no such table" SQL error into a
 * clear "search not enabled" message (see LocalSQLAdapter.search).
 */
export function buildSearchSelect(options: SearchOptions, schema?: unknown, scope?: ColumnScope): BuiltQuery {
  const params: unknown[] = [];
  const table = escapeTable(options.collection);
  const ftsTable = escapeTable(`${options.collection}_fts`);

  let sql =
    `SELECT ${table}.*, bm25(${ftsTable}) AS "_rank", ` +
    `snippet(${ftsTable}, -1, '<mark>', '</mark>', '…', 24) AS "_snippet" ` +
    `FROM ${table} JOIN ${ftsTable} ON ${ftsTable}.rowid = ${table}.rowid`;

  params.push(toFts5MatchQuery(options.search));
  const conditions = [`${ftsTable} MATCH ?`];

  if (options.where) {
    const whereClause = buildWhereClause(options.where, params, schema, table, scope);
    if (whereClause) conditions.push(whereClause);
  }
  const aclClause = buildAclPredicate(options.collection, options.acl, params);
  if (aclClause) conditions.push(aclClause);

  sql += ` WHERE ${conditions.join(' AND ')}`;

  if (options.sort) {
    const orderClause = buildOrderClause(options.sort, table, scope);
    if (orderClause) sql += ` ORDER BY ${orderClause}`;
  } else {
    // Default: best match first. bm25() is lower-is-better in SQLite.
    sql += ` ORDER BY "_rank" ASC`;
  }

  if (options.limit !== undefined) {
    sql += ' LIMIT ?';
    params.push(options.limit);
  }
  if (options.skip !== undefined && options.skip > 0) {
    sql += ' OFFSET ?';
    params.push(options.skip);
  }

  return { sql, params };
}

/**
 * Build a COUNT query for a search (BAK-008) — same MATCH + filter + ACL
 * predicate as buildSearchSelect, no ranking/snippet/order/limit.
 */
export function buildSearchCount(options: SearchOptions, schema?: unknown, scope?: ColumnScope): BuiltQuery {
  const params: unknown[] = [];
  const table = escapeTable(options.collection);
  const ftsTable = escapeTable(`${options.collection}_fts`);

  let sql = `SELECT COUNT(*) as count FROM ${table} JOIN ${ftsTable} ON ${ftsTable}.rowid = ${table}.rowid`;

  params.push(toFts5MatchQuery(options.search));
  const conditions = [`${ftsTable} MATCH ?`];

  if (options.where) {
    const whereClause = buildWhereClause(options.where, params, schema, table, scope);
    if (whereClause) conditions.push(whereClause);
  }
  const aclClause = buildAclPredicate(options.collection, options.acl, params);
  if (aclClause) conditions.push(aclClause);

  sql += ` WHERE ${conditions.join(' AND ')}`;

  return { sql, params };
}

/**
 * Build a DISTINCT query
 */
export function buildDistinct(
  options: QueryOptionsBase & { property: string },
  scope?: ColumnScope
): BuiltQuery {
  const params: unknown[] = [];
  const table = escapeTable(options.collection);
  // DEF-014: aliased, so an absent column still comes back under the name the
  // caller reads it by (LocalSQLAdapter.distinct indexes rows by property).
  const ref = columnRef(options.property, scope);
  const col = ref === 'NULL' ? `NULL as ${escapeColumn(options.property)}` : ref;

  let sql = `SELECT DISTINCT ${col} FROM ${table}`;

  const conditions: string[] = [];
  if (options.where) {
    const whereClause = buildWhereClause(options.where, params, undefined, undefined, scope);
    if (whereClause) {
      conditions.push(whereClause);
    }
  }
  const aclClause = buildAclPredicate(options.collection, options.acl, params);
  if (aclClause) {
    conditions.push(aclClause);
  }
  if (conditions.length > 0) {
    sql += ` WHERE ${conditions.join(' AND ')}`;
  }

  return { sql, params };
}

/**
 * Build an AGGREGATE query
 */
export function buildAggregate(
  options: QueryOptionsBase & { group: Record<string, AggregateGroupConfig>; limit?: number; skip?: number },
  scope?: ColumnScope
): BuiltQuery {
  const params: unknown[] = [];
  const table = escapeTable(options.collection);

  const selectParts: string[] = [];

  for (const [alias, groupConfig] of Object.entries(options.group)) {
    // DEF-014: an aggregate over a column nothing has written aggregates NULLs —
    // AVG/SUM/MAX/MIN answer null and COUNT(DISTINCT NULL) answers 0, which is
    // what the same aggregate over an all-NULL column already answers.
    if (groupConfig.avg !== undefined) {
      selectParts.push(`AVG(${columnRef(groupConfig.avg, scope)}) as ${escapeColumn(alias)}`);
    } else if (groupConfig.sum !== undefined) {
      selectParts.push(`SUM(${columnRef(groupConfig.sum, scope)}) as ${escapeColumn(alias)}`);
    } else if (groupConfig.max !== undefined) {
      selectParts.push(`MAX(${columnRef(groupConfig.max, scope)}) as ${escapeColumn(alias)}`);
    } else if (groupConfig.min !== undefined) {
      selectParts.push(`MIN(${columnRef(groupConfig.min, scope)}) as ${escapeColumn(alias)}`);
    } else if (groupConfig.distinct !== undefined) {
      // COUNT DISTINCT as alternative to $addToSet
      selectParts.push(`COUNT(DISTINCT ${columnRef(groupConfig.distinct, scope)}) as ${escapeColumn(alias)}`);
    }
  }

  if (selectParts.length === 0) {
    return { sql: `SELECT COUNT(*) as count FROM ${table}`, params: [] };
  }

  let sql = `SELECT ${selectParts.join(', ')} FROM ${table}`;

  const conditions: string[] = [];
  if (options.where) {
    const whereClause = buildWhereClause(options.where, params, undefined, undefined, scope);
    if (whereClause) {
      conditions.push(whereClause);
    }
  }
  const aclClause = buildAclPredicate(options.collection, options.acl, params);
  if (aclClause) {
    conditions.push(aclClause);
  }
  if (conditions.length > 0) {
    sql += ` WHERE ${conditions.join(' AND ')}`;
  }

  return { sql, params };
}

/**
 * Serialize a JavaScript value for SQLite storage
 */
export function serializeValue(value: unknown): unknown {
  if (value === null || value === undefined) {
    return null;
  }

  // Handle Parse types
  if (value && typeof value === 'object') {
    const tagged = value as ParseTaggedValue;
    // Date type
    if (tagged.__type === 'Date' && tagged.iso) {
      return tagged.iso;
    }
    // Pointer type - store just the objectId
    if (tagged.__type === 'Pointer' && tagged.objectId) {
      return tagged.objectId;
    }
    // File type - store as JSON
    if (tagged.__type === 'File') {
      return JSON.stringify(value);
    }
    // GeoPoint type - store as JSON
    if (tagged.__type === 'GeoPoint') {
      return JSON.stringify(value);
    }
    // Arrays and objects - store as JSON
    if (Array.isArray(value) || Object.keys(value).length > 0) {
      return JSON.stringify(value);
    }
  }

  // Handle Date objects
  if (value instanceof Date) {
    return value.toISOString();
  }

  // Handle booleans - SQLite uses 0/1
  if (typeof value === 'boolean') {
    return value ? 1 : 0;
  }

  return value;
}

/**
 * Deserialize a SQLite value back to JavaScript
 *
 * @param value
 * @param type - Expected type from schema
 */
export function deserializeValue(value: unknown, type?: string): unknown {
  if (value === null || value === undefined) {
    return null;
  }

  // Handle type-based deserialization
  if (type === 'Boolean') {
    return Boolean(value);
  }

  if (type === 'Date') {
    return value; // Keep as ISO string, let CloudStore handle Date objects
  }

  if (type === 'Object' || type === 'Array' || type === 'GeoPoint' || type === 'File') {
    if (typeof value === 'string') {
      try {
        return JSON.parse(value);
      } catch (e) {
        return value;
      }
    }
  }

  // Try to parse JSON strings that look like objects/arrays
  if (typeof value === 'string') {
    if ((value.startsWith('{') && value.endsWith('}')) || (value.startsWith('[') && value.endsWith(']'))) {
      try {
        return JSON.parse(value);
      } catch (e) {
        // Not valid JSON, return as-is
      }
    }
  }

  return value;
}
