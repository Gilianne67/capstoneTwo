/**
 * Runs the subset of aggregation stages used by admin analytics.
 * Tests use this on fixture documents. Production uses MongoDB.
 */

const { formatInManila } = require('./adminAnalyticsPeriod');

const getPath = (doc, path) => {
  if (!path) return undefined;
  const parts = String(path).split('.');
  let current = doc;
  for (const part of parts) {
    if (current == null) return undefined;
    current = current[part];
  }
  return current;
};

const timeOf = (value) => {
  if (value instanceof Date) return value.getTime();
  if (typeof value === 'string' && !Number.isNaN(Date.parse(value))) {
    return Date.parse(value);
  }
  return null;
};

const sameValue = (left, right) => {
  if (left instanceof Date || right instanceof Date) {
    const leftTime = timeOf(left);
    const rightTime = timeOf(right);
    return leftTime !== null && leftTime === rightTime;
  }
  if (left == null || right == null) return left === right;
  if (typeof left === 'object' || typeof right === 'object') {
    return String(left) === String(right);
  }
  return left === right;
};

const compare = (left, right) => {
  const leftTime = timeOf(left);
  const rightTime = timeOf(right);
  if (leftTime !== null && rightTime !== null) return leftTime - rightTime;
  if (typeof left === 'number' && typeof right === 'number') return left - right;
  return String(left ?? '').localeCompare(String(right ?? ''));
};

const inList = (actual, list) => {
  if (!Array.isArray(list)) return false;
  if (Array.isArray(actual)) {
    return actual.some((item) => list.some((candidate) => sameValue(item, candidate)));
  }
  return list.some((candidate) => sameValue(actual, candidate));
};

const equalsOrContains = (actual, expected) => {
  if (Array.isArray(actual)) {
    return actual.some((item) => sameValue(item, expected));
  }
  return sameValue(actual, expected);
};

const matches = (doc, filter) => {
  if (!filter || typeof filter !== 'object' || Array.isArray(filter)) return true;
  return Object.entries(filter).every(([key, expected]) => {
    if (key === '$or') return expected.some((clause) => matches(doc, clause));
    if (key === '$and') return expected.every((clause) => matches(doc, clause));
    const actual = getPath(doc, key);
    if (
      expected &&
      typeof expected === 'object' &&
      !Array.isArray(expected) &&
      !(expected instanceof Date)
    ) {
      return Object.entries(expected).every(([operator, operand]) => {
        if (operator === '$gte') return actual != null && compare(actual, operand) >= 0;
        if (operator === '$gt') return actual != null && compare(actual, operand) > 0;
        if (operator === '$lte') return actual != null && compare(actual, operand) <= 0;
        if (operator === '$lt') return actual != null && compare(actual, operand) < 0;
        if (operator === '$eq') return sameValue(actual, operand);
        if (operator === '$ne') return !sameValue(actual, operand);
        if (operator === '$in') return inList(actual, operand);
        if (operator === '$nin') return !inList(actual, operand);
        if (operator === '$exists') {
          const present = actual !== undefined && actual !== null;
          return operand ? present : !present;
        }
        if (operator === '$size') return Array.isArray(actual) && actual.length === operand;
        throw new Error(`Unsupported match operator ${operator}`);
      });
    }
    return equalsOrContains(actual, expected);
  });
};

const evaluate = (expr, doc) => {
  if (Array.isArray(expr)) return expr.map((item) => evaluate(item, doc));
  if (expr instanceof Date || expr === null || typeof expr !== 'object') {
    if (typeof expr === 'string' && expr.startsWith('$') && !expr.startsWith('$$')) {
      return getPath(doc, expr.slice(1));
    }
    return expr;
  }

  const keys = Object.keys(expr);
  if (keys.length === 1 && keys[0].startsWith('$')) {
    return applyOperator(keys[0], expr[keys[0]], doc);
  }

  const objectValue = {};
  keys.forEach((key) => {
    objectValue[key] = evaluate(expr[key], doc);
  });
  return objectValue;
};

const truthy = (value) => value !== null && value !== undefined && value !== false && value !== 0 && value !== '';

function applyOperator(operator, arg, doc) {
  if (operator === '$eq') return sameValue(evaluate(arg[0], doc), evaluate(arg[1], doc));
  if (operator === '$ne') return !sameValue(evaluate(arg[0], doc), evaluate(arg[1], doc));
  if (operator === '$gt') return compare(evaluate(arg[0], doc), evaluate(arg[1], doc)) > 0;
  if (operator === '$gte') return compare(evaluate(arg[0], doc), evaluate(arg[1], doc)) >= 0;
  if (operator === '$lt') return compare(evaluate(arg[0], doc), evaluate(arg[1], doc)) < 0;
  if (operator === '$lte') return compare(evaluate(arg[0], doc), evaluate(arg[1], doc)) <= 0;
  if (operator === '$and') return arg.every((item) => truthy(evaluate(item, doc)));
  if (operator === '$or') return arg.some((item) => truthy(evaluate(item, doc)));
  if (operator === '$not') return !truthy(evaluate(arg[0], doc));
  if (operator === '$in') return inList(evaluate(arg[0], doc), evaluate(arg[1], doc));
  if (operator === '$cond') {
    return truthy(evaluate(arg[0], doc)) ? evaluate(arg[1], doc) : evaluate(arg[2], doc);
  }
  if (operator === '$ifNull') {
    const value = evaluate(arg[0], doc);
    return value === null || value === undefined ? evaluate(arg[1], doc) : value;
  }
  if (operator === '$trim') {
    const input = evaluate(arg.input, doc);
    return input == null ? '' : String(input).trim();
  }
  if (operator === '$size') {
    const value = evaluate(arg, doc);
    return Array.isArray(value) ? value.length : 0;
  }
  if (operator === '$arrayElemAt') {
    const list = evaluate(arg[0], doc);
    const index = evaluate(arg[1], doc);
    return Array.isArray(list) ? list[index] : null;
  }
  if (operator === '$dateToString') {
    if (arg.timezone !== 'Asia/Manila') {
      throw new Error('Admin analytics dates must use Asia/Manila.');
    }
    const date = evaluate(arg.date, doc);
    const parsed = date instanceof Date ? date : new Date(date);
    return formatInManila(parsed, arg.format);
  }
  if (operator === '$switch') {
    for (const branch of arg.branches) {
      if (truthy(evaluate(branch.case, doc))) return evaluate(branch.then, doc);
    }
    return evaluate(arg.default, doc);
  }
  if (operator === '$literal') return arg;
  throw new Error(`Unsupported expression ${operator}`);
}

const stable = (value) => {
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => `${key}:${stable(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
};

const addFields = (doc, spec) => {
  const next = { ...doc };
  Object.entries(spec).forEach(([key, expr]) => {
    next[key] = evaluate(expr, doc);
  });
  return next;
};

const groupDocs = (docs, spec) => {
  const groups = new Map();
  docs.forEach((doc) => {
    const id = evaluate(spec._id, doc);
    const key = stable(id);
    if (!groups.has(key)) {
      groups.set(key, { _id: id, values: {}, seen: {} });
    }
    const row = groups.get(key);
    Object.entries(spec).forEach(([field, expr]) => {
      if (field === '_id') return;
      const operator = Object.keys(expr)[0];
      if (operator === '$sum') {
        const addend = evaluate(expr.$sum, doc);
        row.values[field] = (row.values[field] || 0) + (typeof addend === 'number' ? addend : 0);
        return;
      }
      if (operator === '$first') {
        if (!row.seen[field]) {
          row.values[field] = evaluate(expr.$first, doc);
          row.seen[field] = true;
        }
        return;
      }
      throw new Error(`Unsupported accumulator ${operator}`);
    });
  });
  return [...groups.values()].map((row) => ({ _id: row._id, ...row.values }));
};

const unwind = (docs, spec) => {
  const path = typeof spec === 'string' ? spec : spec.path;
  const field = String(path || '').replace(/^\$/, '');
  const preserve = typeof spec === 'object' && spec.preserveNullAndEmptyArrays === true;
  const rows = [];
  docs.forEach((doc) => {
    const value = getPath(doc, field);
    if (Array.isArray(value) && value.length > 0) {
      value.forEach((item) => {
        rows.push({ ...doc, [field]: item });
      });
      return;
    }
    if (preserve) rows.push({ ...doc, [field]: null });
  });
  return rows;
};

const lookup = (docs, spec, collections) => {
  const foreign = collections[spec.from];
  if (!Array.isArray(foreign)) {
    throw new Error(`Analytics lookup collection "${spec.from}" is not available.`);
  }
  return docs.map((doc) => {
    const local = getPath(doc, spec.localField);
    const matched = foreign.filter((item) => sameValue(getPath(item, spec.foreignField), local));
    return { ...doc, [spec.as]: matched };
  });
};

const sortDocs = (docs, spec) => {
  const fields = Object.entries(spec);
  return [...docs].sort((left, right) => {
    for (const [field, direction] of fields) {
      const compared = compare(left[field], right[field]);
      if (compared !== 0) return compared * (direction < 0 ? -1 : 1);
    }
    return 0;
  });
};

const executeAggregate = (input, pipeline, collections = {}) => {
  let docs = (Array.isArray(input) ? input : []).map((doc) => ({ ...doc }));

  for (const stage of pipeline) {
    const key = Object.keys(stage)[0];
    if (key === '$match') {
      docs = docs.filter((doc) => matches(doc, stage.$match));
    } else if (key === '$addFields' || key === '$set') {
      docs = docs.map((doc) => addFields(doc, stage[key]));
    } else if (key === '$group') {
      docs = groupDocs(docs, stage.$group);
    } else if (key === '$unwind') {
      docs = unwind(docs, stage.$unwind);
    } else if (key === '$lookup') {
      docs = lookup(docs, stage.$lookup, collections);
    } else if (key === '$sort') {
      docs = sortDocs(docs, stage.$sort);
    } else if (key === '$skip') {
      docs = docs.slice(Number(stage.$skip) || 0);
    } else if (key === '$limit') {
      docs = docs.slice(0, Number(stage.$limit));
    } else if (key === '$count') {
      docs = [{ [stage.$count]: docs.length }];
    } else if (key === '$facet') {
      const facet = {};
      Object.entries(stage.$facet).forEach(([name, subpipeline]) => {
        facet[name] = executeAggregate(docs, subpipeline, collections);
      });
      docs = [facet];
    } else {
      throw new Error(`Unsupported aggregation stage ${key}`);
    }
  }

  return docs;
};

module.exports = {
  executeAggregate,
  matches,
};
