const fs = require('fs');
const path = require('path');
const logger = require('../utils/logger');

const dbPath = path.resolve(__dirname, '../../crm_final.json');

let tables = {};
try {
  if (fs.existsSync(dbPath)) {
    tables = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
  }
} catch (err) {
  logger.warn('Could not load existing DB file, starting fresh');
}

function save() {
  try {
    fs.writeFileSync(dbPath, JSON.stringify(tables, null, 2));
  } catch (err) {
    logger.error('Failed to save DB:', err.message);
  }
}

function parseWhere(sql) {
  const conditions = [];
  const whereMatch = sql.match(/WHERE\s+(.+?)(?:\s+(?:ORDER|GROUP|LIMIT|RETURNING|ON|$))/is);
  if (!whereMatch) return conditions;

  let whereClause = whereMatch[1].trim();
  whereClause = whereClause.replace(/AND/gi, '&&&&');
  const parts = whereClause.split('&&&&');

  for (const part of parts) {
    const trimmed = part.trim();
    if (!trimmed) continue;

    let m;
    if (m = trimmed.match(/^(\w+)\s+=\s+\?/)) {
      conditions.push({ column: m[1], op: '=', paramIndex: conditions.length });
    } else if (m = trimmed.match(/^(\w+)\s+!=\s+\?/)) {
      conditions.push({ column: m[1], op: '!=', paramIndex: conditions.length });
    } else if (m = trimmed.match(/^(\w+)\s+>\s+\?/)) {
      conditions.push({ column: m[1], op: '>', paramIndex: conditions.length });
    } else if (m = trimmed.match(/^(\w+)\s+<\s+\?/)) {
      conditions.push({ column: m[1], op: '<', paramIndex: conditions.length });
    } else if (m = trimmed.match(/^(\w+)\s+>=\s+\?/)) {
      conditions.push({ column: m[1], op: '>=', paramIndex: conditions.length });
    } else if (m = trimmed.match(/^(\w+)\s+<=\s+\?/)) {
      conditions.push({ column: m[1], op: '<=', paramIndex: conditions.length });
    } else if (m = trimmed.match(/^(\w+)\s+LIKE\s+\?/i)) {
      conditions.push({ column: m[1], op: 'LIKE', paramIndex: conditions.length });
    } else if (m = trimmed.match(/^(\w+)\s+IN\s+\(([^)]+)\)/i)) {
      conditions.push({ column: m[1], op: 'IN', raw: m[2].trim() });
    } else if (m = trimmed.match(/^(\w+)\s+IS\s+NULL/i)) {
      conditions.push({ column: m[1], op: 'IS NULL' });
    } else if (m = trimmed.match(/^(\w+)\s+IS\s+NOT\s+NULL/i)) {
      conditions.push({ column: m[1], op: 'IS NOT NULL' });
    } else if (m = trimmed.match(/^NOT\s+EXISTS\s*\(/i)) {
      conditions.push({ column: '__noop__', op: 'noop' });
    } else if (m = trimmed.match(/^EXISTS\s*\(/i)) {
      conditions.push({ column: '__noop__', op: 'noop' });
    } else {
      conditions.push({ column: '__noop__', op: 'noop' });
    }
  }
  return conditions;
}

function getOrderBy(sql) {
  const m = sql.match(/ORDER\s+BY\s+(\w+)\s+(ASC|DESC)/i);
  return m ? { column: m[1], dir: (m[2] || 'ASC').toUpperCase() } : null;
}

function getLimit(sql) {
  const m = sql.match(/LIMIT\s+(\d+)/i);
  return m ? parseInt(m[1]) : null;
}

function getOffset(sql) {
  const m = sql.match(/OFFSET\s+(\d+)/i);
  return m ? parseInt(m[1]) : null;
}

function getTableFromInsert(sql) {
  const m = sql.match(/INSERT\s+(?:OR\s+IGNORE\s+)?INTO\s+(\w+)/i);
  return m ? m[1] : null;
}

function getColumnsFromInsert(sql) {
  const m = sql.match(/INSERT\s+(?:OR\s+IGNORE\s+)?INTO\s+\w+\s*\(([^)]+)\)/i);
  if (!m) return null;
  return m[1].split(',').map(c => c.trim());
}

function getTableFromSelect(sql) {
  const m = sql.match(/FROM\s+(\w+)/i);
  return m ? m[1] : null;
}

function getSelectColumns(sql) {
  const m = sql.match(/SELECT\s+(.+?)\s+FROM/i);
  if (!m) return ['*'];
  const cols = m[1].trim();
  if (cols === '*') return ['*'];
  return cols.split(',').map(c => {
    const parts = c.trim().split(/\s+as\s+/i);
    return { expr: parts[0].trim(), alias: parts[1] ? parts[1].trim() : parts[0].trim() };
  });
}

function getSetClause(sql) {
  const m = sql.match(/SET\s+(.+?)(?:\s+WHERE|$)/is);
  if (!m) return [];
  const sets = m[1].split(',').map(s => s.trim());
  return sets.map(s => {
    const sm = s.match(/(\w+)\s*=\s*\?/);
    return sm ? { column: sm[1], paramIndex: 0 } : null;
  }).filter(Boolean);
}

function getJoinInfo(sql) {
  const m = sql.match(/JOIN\s+(\w+)\s+ON\s+(\w+)\.(\w+)\s*=\s*(\w+)\.(\w+)/i);
  if (!m) return null;
  return { table: m[1], leftTable: m[2], leftCol: m[3], rightTable: m[4], rightCol: m[5] };
}

function query(text, params = []) {
  try {
    const trimmed = text.trim().toUpperCase();

    if (trimmed.startsWith('CREATE TABLE')) {
      const tableMatch = text.match(/CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(\w+)/i);
      if (tableMatch) {
        const tableName = tableMatch[1];
        if (!tables[tableName]) {
          tables[tableName] = { _schema: text, _data: [] };
          save();
        }
      }
      return { rows: [], rowCount: 0 };
    }

    if (trimmed.startsWith('CREATE INDEX') || trimmed.startsWith('PRAGMA')) {
      return { rows: [], rowCount: 0 };
    }

    if (trimmed.startsWith('INSERT')) {
      const tableName = getTableFromInsert(text);
      if (!tableName) throw new Error('Cannot parse INSERT table');
      if (!tables[tableName]) tables[tableName] = { _schema: '', _data: [] };

      const columns = getColumnsFromInsert(text);
      const isIgnore = /INSERT\s+OR\s+IGNORE/i.test(text);

      if (columns) {
        const row = {};
        columns.forEach((col, i) => {
          row[col] = params[i] !== undefined ? params[i] : null;
        });

        if (isIgnore) {
          const existing = tables[tableName]._data.find(r => r.id === row.id);
          if (existing) return { rows: [], rowCount: 0 };
        }

        tables[tableName]._data.push(row);
        save();
        return { rows: [row], rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    }

    if (trimmed.startsWith('UPDATE')) {
      const tableMatch = text.match(/UPDATE\s+(\w+)/i);
      if (!tableMatch) throw new Error('Cannot parse UPDATE table');
      const tableName = tableMatch[1];
      if (!tables[tableName]) return { rows: [], rowCount: 0 };

      const sets = getSetClause(text);
      const conditions = parseWhere(text);
      let updatedCount = 0;

      tables[tableName]._data.forEach(row => {
        let matches = true;
        for (const cond of conditions) {
          if (cond.op === 'noop') continue;
          if (cond.op === '=') {
            if (row[cond.column] !== params[cond.paramIndex]) matches = false;
          } else if (cond.op === '!=') {
            if (row[cond.column] === params[cond.paramIndex]) matches = false;
          } else if (cond.op === '>') {
            if (!(Number(row[cond.column]) > Number(params[cond.paramIndex]))) matches = false;
          } else if (cond.op === '<') {
            if (!(Number(row[cond.column]) < Number(params[cond.paramIndex]))) matches = false;
          } else if (cond.op === 'LIKE') {
            const pattern = String(params[cond.paramIndex] || '').replace(/%/g, '.*').replace(/_/g, '.');
            if (!new RegExp(pattern, 'i').test(String(row[cond.column] || ''))) matches = false;
          }
        }

        if (matches) {
          sets.forEach((s, i) => {
            row[s.column] = params[i];
          });
          updatedCount++;
        }
      });

      save();
      return { rows: [], rowCount: updatedCount };
    }

    if (trimmed.startsWith('DELETE')) {
      const tableMatch = text.match(/DELETE\s+FROM\s+(\w+)/i);
      if (!tableMatch) throw new Error('Cannot parse DELETE table');
      const tableName = tableMatch[1];
      if (!tables[tableName]) return { rows: [], rowCount: 0 };

      const conditions = parseWhere(text);
      const before = tables[tableName]._data.length;
      tables[tableName]._data = tables[tableName]._data.filter(row => {
        for (const cond of conditions) {
          if (cond.op === 'noop') continue;
          if (cond.op === '=') {
            if (row[cond.column] === params[cond.paramIndex]) return false;
          }
        }
        return true;
      });
      save();
      return { rows: [], rowCount: before - tables[tableName]._data.length };
    }

    if (trimmed.startsWith('SELECT') || trimmed.startsWith('WITH')) {
      const tableName = getTableFromSelect(text);
      if (!tableName || !tables[tableName]) return { rows: [], rowCount: 0 };

      let data = [...tables[tableName]._data];
      const conditions = parseWhere(text);
      const joinInfo = getJoinInfo(text);

      if (joinInfo && tables[joinInfo.table]) {
        const joined = [];
        for (const row of data) {
          const matchRow = tables[joinInfo.table]._data.find(jr =>
            jr[joinInfo.rightCol] === row[joinInfo.leftCol]
          );
          if (matchRow) {
            joined.push({ ...row, ...Object.keys(matchRow).reduce((acc, k) => {
              acc[k] = matchRow[k];
              return acc;
            }, {}) });
          }
        }
        data = joined;
      }

      if (conditions.length > 0) {
        data = data.filter(row => {
          return conditions.every(cond => {
            if (cond.op === 'noop') return true;
            if (cond.op === '=') return row[cond.column] === params[cond.paramIndex];
            if (cond.op === '!=') return row[cond.column] !== params[cond.paramIndex];
            if (cond.op === '>') return Number(row[cond.column]) > Number(params[cond.paramIndex]);
            if (cond.op === '<') return Number(row[cond.column]) < Number(params[cond.paramIndex]);
            if (cond.op === '>=') return Number(row[cond.column]) >= Number(params[cond.paramIndex]);
            if (cond.op === '<=') return Number(row[cond.column]) <= Number(params[cond.paramIndex]);
            if (cond.op === 'LIKE') {
              const pattern = String(params[cond.paramIndex] || '').replace(/%/g, '.*').replace(/_/g, '.');
              return new RegExp(pattern, 'i').test(String(row[cond.column] || ''));
            }
            if (cond.op === 'IS NULL') return row[cond.column] == null;
            if (cond.op === 'IS NOT NULL') return row[cond.column] != null;
            return true;
          });
        });
      }

      const orderBy = getOrderBy(text);
      if (orderBy) {
        data.sort((a, b) => {
          const av = a[orderBy.column];
          const bv = b[orderBy.column];
          if (av < bv) return orderBy.dir === 'ASC' ? -1 : 1;
          if (av > bv) return orderBy.dir === 'ASC' ? 1 : -1;
          return 0;
        });
      }

      const limit = getLimit(text);
      const offset = getOffset(text);
      if (offset) data = data.slice(offset);
      if (limit) data = data.slice(0, limit);

      return { rows: data, rowCount: data.length };
    }

    return { rows: [], rowCount: 0 };
  } catch (err) {
    logger.error('DB query error:', { text: text.substring(0, 200), error: err.message });
    throw err;
  }
}

function getClient() {
  return { query: (text, params = []) => query(text, params), release: () => {} };
}

function transaction(callback) {
  const client = { query: (text, params = []) => query(text, params), release: () => {} };
  return callback(client);
}

module.exports = { query, getClient, transaction };
