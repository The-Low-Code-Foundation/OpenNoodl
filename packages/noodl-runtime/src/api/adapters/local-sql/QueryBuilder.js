/**
 * QueryBuilder - Translates Parse-style queries to SQLite SQL
 *
 * Parse uses operators like $eq, $ne, $gt, $lt, $in, etc.
 * This translates them to SQL WHERE clauses.
 *
 * @module adapters/local-sql/QueryBuilder
 */

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
 * @param {string} name
 * @returns {string}
 */
function escapeTable(name) {
  // Sanitize: only allow alphanumeric and underscore
  const sanitized = name.replace(/[^a-zA-Z0-9_]/g, '');
  return `"${sanitized}"`;
}

/**
 * Escape a column name for SQL
 * @param {string} name
 * @returns {string}
 */
function escapeColumn(name) {
  // Sanitize: only allow alphanumeric and underscore
  const sanitized = name.replace(/[^a-zA-Z0-9_]/g, '');
  // Always quote to handle reserved words
  return `"${sanitized}"`;
}

/**
 * Convert a Parse Date object to ISO string for SQLite
 * @param {Object|Date|string} value
 * @returns {string}
 */
function convertDateValue(value) {
  if (value && value.__type === 'Date' && value.iso) {
    return value.iso;
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  return value;
}

/**
 * Convert a Parse Pointer to its objectId
 * @param {Object|string} value
 * @returns {string}
 */
function convertPointerValue(value) {
  if (value && value.__type === 'Pointer' && value.objectId) {
    return value.objectId;
  }
  return value;
}

/**
 * Build a WHERE clause from a Parse-style query
 *
 * @param {Object} where - Parse-style query object
 * @param {Array} params - Array to push parameter values to
 * @param {Object} [schema] - Optional schema for type-aware conversion
 * @returns {string} SQL WHERE clause (without "WHERE" keyword)
 */
function buildWhereClause(where, params, schema) {
  if (!where || Object.keys(where).length === 0) {
    return '';
  }

  const conditions = [];

  for (const [key, condition] of Object.entries(where)) {
    // Handle logical operators
    if (key === '$and' && Array.isArray(condition)) {
      const subConditions = condition.map((sub) => buildWhereClause(sub, params, schema)).filter((c) => c);
      if (subConditions.length > 0) {
        conditions.push(`(${subConditions.join(' AND ')})`);
      }
      continue;
    }

    if (key === '$or' && Array.isArray(condition)) {
      const subConditions = condition.map((sub) => buildWhereClause(sub, params, schema)).filter((c) => c);
      if (subConditions.length > 0) {
        conditions.push(`(${subConditions.join(' OR ')})`);
      }
      continue;
    }

    // Handle $relatedTo - this is tricky with SQLite
    if (key === '$relatedTo') {
      // For relations, we need a subquery on the junction table
      const { object, key: relationKey } = condition;
      if (object && object.objectId && object.className && relationKey) {
        const junctionTable = `_Join_${relationKey}_${object.className}`;
        conditions.push(`"objectId" IN (SELECT "relatedId" FROM ${escapeTable(junctionTable)} WHERE "owningId" = ?)`);
        params.push(object.objectId);
      }
      continue;
    }

    // Handle field conditions
    const col = escapeColumn(key);

    if (typeof condition !== 'object' || condition === null) {
      // Direct equality
      conditions.push(`${col} = ?`);
      params.push(convertDateValue(convertPointerValue(condition)));
      continue;
    }

    // Handle Parse operators
    for (const [op, value] of Object.entries(condition)) {
      const sqlCondition = translateOperator(col, op, value, params, schema);
      if (sqlCondition) {
        conditions.push(sqlCondition);
      }
    }
  }

  return conditions.join(' AND ');
}

/**
 * Translate a single Parse operator to SQL
 *
 * @param {string} col - Escaped column name
 * @param {string} op - Parse operator ($eq, $ne, etc.)
 * @param {*} value - Comparison value
 * @param {Array} params - Parameters array to push values to
 * @param {Object} [schema] - Optional schema
 * @returns {string|null} SQL condition or null
 */
function translateOperator(col, op, value, params, schema) {
  // Convert special types
  const convertedValue = convertDateValue(convertPointerValue(value));

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

    case '$in':
      if (!Array.isArray(value) || value.length === 0) {
        return '0'; // Always false
      }
      const inValues = value.map((v) => convertDateValue(convertPointerValue(v)));
      const placeholders = inValues.map(() => '?').join(', ');
      params.push(...inValues);
      return `${col} IN (${placeholders})`;

    case '$nin':
      if (!Array.isArray(value) || value.length === 0) {
        return '1'; // Always true (not in empty set)
      }
      const ninValues = value.map((v) => convertDateValue(convertPointerValue(v)));
      const ninPlaceholders = ninValues.map(() => '?').join(', ');
      params.push(...ninValues);
      return `${col} NOT IN (${ninPlaceholders})`;

    case '$exists':
      return value ? `${col} IS NOT NULL` : `${col} IS NULL`;

    case '$regex':
      // SQLite doesn't have native regex, use LIKE with % wildcards
      // This is a simplification - only handles basic patterns
      params.push(`%${value}%`);
      return `${col} LIKE ?`;

    case '$options':
      // This is used with $regex, ignore here
      return null;

    case '$text':
      // Full text search - convert to LIKE
      if (value && value.$search) {
        const term = typeof value.$search === 'string' ? value.$search : value.$search.$term || '';
        params.push(`%${term}%`);
        return `${col} LIKE ?`;
      }
      return null;

    case 'contains':
    case '$contains':
      // Contains search - convert to LIKE with wildcards
      params.push(`%${convertedValue}%`);
      return `${col} LIKE ?`;

    // Geo queries - not fully supported in SQLite without extensions
    case '$nearSphere':
    case '$within':
    case '$geoWithin':
      console.warn(`Geo query operator ${op} not supported in SQLite adapter`);
      return null;

    default:
      console.warn(`Unknown query operator: ${op}`);
      return null;
  }
}

/**
 * Build ORDER BY clause from Parse-style sort
 *
 * @param {string|string[]} sort - Sort specification (e.g., 'name' or '-createdAt' for desc)
 * @returns {string} SQL ORDER BY clause (without "ORDER BY" keyword)
 */
function buildOrderClause(sort) {
  if (!sort) {
    return '';
  }

  const sortArray = Array.isArray(sort) ? sort : sort.split(',');

  const orders = sortArray.map((s) => {
    const trimmed = s.trim();
    if (trimmed.startsWith('-')) {
      return `${escapeColumn(trimmed.substring(1))} DESC`;
    }
    return `${escapeColumn(trimmed)} ASC`;
  });

  return orders.join(', ');
}

/**
 * Build a SELECT query
 *
 * @param {Object} options - Query options
 * @param {string} options.collection - Collection name
 * @param {Object} [options.where] - Parse-style query filter
 * @param {string|string[]} [options.select] - Fields to select
 * @param {string|string[]} [options.sort] - Sort order
 * @param {number} [options.limit] - Max records
 * @param {number} [options.skip] - Records to skip
 * @param {Object} [schema] - Optional schema
 * @returns {{ sql: string, params: Array }}
 */
function buildSelect(options, schema) {
  const params = [];
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
      .map((f) => escapeColumn(f))
      .join(', ');
  }

  let sql = `SELECT ${selectClause} FROM ${table}`;

  // Build WHERE clause
  if (options.where) {
    const whereClause = buildWhereClause(options.where, params, schema);
    if (whereClause) {
      sql += ` WHERE ${whereClause}`;
    }
  }

  // Build ORDER BY clause
  if (options.sort) {
    const orderClause = buildOrderClause(options.sort);
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
 *
 * @param {Object} options
 * @param {string} options.collection
 * @param {Object} [options.where]
 * @param {Object} [schema]
 * @returns {{ sql: string, params: Array }}
 */
function buildCount(options, schema) {
  const params = [];
  const table = escapeTable(options.collection);

  let sql = `SELECT COUNT(*) as count FROM ${table}`;

  if (options.where) {
    const whereClause = buildWhereClause(options.where, params, schema);
    if (whereClause) {
      sql += ` WHERE ${whereClause}`;
    }
  }

  return { sql, params };
}

/**
 * Build an INSERT query
 *
 * @param {Object} options
 * @param {string} options.collection
 * @param {Object} options.data
 * @param {string} objectId
 * @returns {{ sql: string, params: Array }}
 */
function buildInsert(options, id) {
  const params = [];
  const table = escapeTable(options.collection);

  const now = new Date().toISOString();
  const data = {
    objectId: id,
    createdAt: now,
    updatedAt: now,
    ...options.data
  };

  // Remove protected fields
  delete data._createdAt;
  delete data._updatedAt;

  const columns = [];
  const placeholders = [];

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
 *
 * @param {Object} options
 * @param {string} options.collection
 * @param {string} options.id - Record ID
 * @param {Object} options.data
 * @returns {{ sql: string, params: Array }}
 */
function buildUpdate(options) {
  const params = [];
  const table = escapeTable(options.collection);

  const data = { ...options.data };

  // Add updatedAt
  data.updatedAt = new Date().toISOString();

  // Remove protected fields
  delete data.id;
  delete data.createdAt;
  delete data._createdAt;
  delete data._updatedAt;

  const setClause = [];

  for (const [key, value] of Object.entries(data)) {
    setClause.push(`${escapeColumn(key)} = ?`);
    params.push(serializeValue(value));
  }

  // Use id or objectId for backwards compatibility
  const recordId = options.id || options.objectId;
  params.push(recordId);

  const sql = `UPDATE ${table} SET ${setClause.join(', ')} WHERE "objectId" = ?`;

  return { sql, params };
}

/**
 * Build a DELETE query
 *
 * @param {Object} options
 * @param {string} options.collection
 * @param {string} options.id - Record ID
 * @returns {{ sql: string, params: Array }}
 */
function buildDelete(options) {
  const table = escapeTable(options.collection);
  // Use id or objectId for backwards compatibility
  const recordId = options.id || options.objectId;
  const sql = `DELETE FROM ${table} WHERE "objectId" = ?`;
  return { sql, params: [recordId] };
}

/**
 * Build an INCREMENT query
 *
 * @param {Object} options
 * @param {string} options.collection
 * @param {string} options.id - Record ID
 * @param {Object<string, number>} options.properties
 * @returns {{ sql: string, params: Array }}
 */
function buildIncrement(options) {
  const params = [];
  const table = escapeTable(options.collection);

  const setClause = [];

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

  const sql = `UPDATE ${table} SET ${setClause.join(', ')} WHERE "objectId" = ?`;

  return { sql, params };
}

/**
 * Build a DISTINCT query
 *
 * @param {Object} options
 * @param {string} options.collection
 * @param {string} options.property
 * @param {Object} [options.where]
 * @returns {{ sql: string, params: Array }}
 */
function buildDistinct(options) {
  const params = [];
  const table = escapeTable(options.collection);
  const col = escapeColumn(options.property);

  let sql = `SELECT DISTINCT ${col} FROM ${table}`;

  if (options.where) {
    const whereClause = buildWhereClause(options.where, params);
    if (whereClause) {
      sql += ` WHERE ${whereClause}`;
    }
  }

  return { sql, params };
}

/**
 * Build an AGGREGATE query
 *
 * @param {Object} options
 * @param {string} options.collection
 * @param {Object} [options.where]
 * @param {Object} options.group - Grouping config with avg/sum/max/min/distinct
 * @param {number} [options.limit]
 * @param {number} [options.skip]
 * @returns {{ sql: string, params: Array }}
 */
function buildAggregate(options) {
  const params = [];
  const table = escapeTable(options.collection);

  const selectParts = [];

  for (const [alias, groupConfig] of Object.entries(options.group)) {
    if (groupConfig.avg !== undefined) {
      selectParts.push(`AVG(${escapeColumn(groupConfig.avg)}) as ${escapeColumn(alias)}`);
    } else if (groupConfig.sum !== undefined) {
      selectParts.push(`SUM(${escapeColumn(groupConfig.sum)}) as ${escapeColumn(alias)}`);
    } else if (groupConfig.max !== undefined) {
      selectParts.push(`MAX(${escapeColumn(groupConfig.max)}) as ${escapeColumn(alias)}`);
    } else if (groupConfig.min !== undefined) {
      selectParts.push(`MIN(${escapeColumn(groupConfig.min)}) as ${escapeColumn(alias)}`);
    } else if (groupConfig.distinct !== undefined) {
      // COUNT DISTINCT as alternative to $addToSet
      selectParts.push(`COUNT(DISTINCT ${escapeColumn(groupConfig.distinct)}) as ${escapeColumn(alias)}`);
    }
  }

  if (selectParts.length === 0) {
    return { sql: `SELECT COUNT(*) as count FROM ${table}`, params: [] };
  }

  let sql = `SELECT ${selectParts.join(', ')} FROM ${table}`;

  if (options.where) {
    const whereClause = buildWhereClause(options.where, params);
    if (whereClause) {
      sql += ` WHERE ${whereClause}`;
    }
  }

  return { sql, params };
}

/**
 * Serialize a JavaScript value for SQLite storage
 *
 * @param {*} value
 * @returns {*}
 */
function serializeValue(value) {
  if (value === null || value === undefined) {
    return null;
  }

  // Handle Parse types
  if (value && typeof value === 'object') {
    // Date type
    if (value.__type === 'Date' && value.iso) {
      return value.iso;
    }
    // Pointer type - store just the objectId
    if (value.__type === 'Pointer' && value.objectId) {
      return value.objectId;
    }
    // File type - store as JSON
    if (value.__type === 'File') {
      return JSON.stringify(value);
    }
    // GeoPoint type - store as JSON
    if (value.__type === 'GeoPoint') {
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
 * @param {*} value
 * @param {string} [type] - Expected type from schema
 * @returns {*}
 */
function deserializeValue(value, type) {
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

module.exports = {
  escapeTable,
  escapeColumn,
  buildWhereClause,
  buildOrderClause,
  buildSelect,
  buildCount,
  buildInsert,
  buildUpdate,
  buildDelete,
  buildIncrement,
  buildDistinct,
  buildAggregate,
  serializeValue,
  deserializeValue
};
