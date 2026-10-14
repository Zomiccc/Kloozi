const db = require('../config/database');
const logger = require('../utils/logger');

// ─── Segment engine ────────────────────────────────────────────────────────
// A segment = { match_type: 'all'|'any', conditions: [{field, operator, value}] }
// Conditions compile to parameterized SQL against `leads` + aggregates from
// `lead_activities` / `emails` / `content_tracking` — evaluated fresh on every
// query, so membership is always current (dynamic, never a snapshot).

const NUMERIC_OPS = {
  gt: '>', gte: '>=', lt: '<', lte: '<=', eq: '=', neq: '<>',
};

/**
 * Compile a conditions array into { whereSql, params } scoped to a workspace.
 * The caller must prefix with the workspace filter and pass its param first.
 */
function compileConditions(conditions, matchType, startIdx) {
  const clauses = [];
  const params = [];
  let idx = startIdx;

  // Replace every ? in order — conditions may carry multiple placeholders.
  const push = (sql, ...values) => {
    clauses.push(sql.replace(/\?/g, () => `$${idx++}`));
    if (values.length > 0) params.push(...values);
  };

  for (const cond of conditions || []) {
    if (!cond || !cond.field || cond.value === undefined || cond.value === null || cond.value === '') continue;
    const v = cond.value;
    const op = cond.operator || 'eq';

    switch (cond.field) {
      case 'stage':
        if (op === 'in') push(`LOWER(l.stage) = ANY(?)`, (Array.isArray(v) ? v : [v]).map((x) => String(x).toLowerCase()));
        else if (op === 'neq') push(`LOWER(COALESCE(l.stage, '')) <> LOWER(?)`, String(v));
        else push(`LOWER(l.stage) = LOWER(?)`, String(v));
        break;

      case 'source':
        if (op === 'in') push(`l.lead_source = ANY(?)`, Array.isArray(v) ? v : [v]);
        else if (op === 'neq') push(`l.lead_source <> ?`, v);
        else push(`l.lead_source = ?`, v);
        break;

      case 'city':
        if (op === 'not_contains') push(`(l.city IS NULL OR l.city NOT ILIKE ?)`, `%${v}%`);
        else push(`l.city ILIKE ?`, `%${v}%`);
        break;

      case 'budget': {
        const sqlOp = NUMERIC_OPS[op];
        if (!sqlOp) break;
        push(`l.budget IS NOT NULL AND l.budget ${sqlOp} ?`, Number(v));
        break;
      }

      case 'score': {
        const sqlOp = NUMERIC_OPS[op] || '>=';
        push(`l.score ${sqlOp} ?`, Number(v));
        break;
      }

      case 'tags_any':
        push(`l.tags ?| ?::text[]`, Array.isArray(v) ? v : [v]);
        break;

      case 'tags_all':
        push(`l.tags @> ?::jsonb`, JSON.stringify(Array.isArray(v) ? v : [v]));
        break;

      case 'assigned_to':
        push(`l.assigned_to = ?`, v);
        break;

      case 'created_within_days':
        push(`l.created_at >= NOW() - (? || ' days')::interval`, String(Math.max(0, Number(v))));
        break;

      case 'inactive_days':
        // No activity in the last N days (or ever inactive since creation)
        push(`COALESCE(l.last_activity_at, l.updated_at, l.created_at) < NOW() - (? || ' days')::interval`, String(Math.max(0, Number(v))));
        break;

      case 'active_within_days':
        push(`COALESCE(l.last_activity_at, l.updated_at, l.created_at) >= NOW() - (? || ' days')::interval`, String(Math.max(0, Number(v))));
        break;

      case 'unsubscribed':
        push(`l.is_unsubscribed = ?`, Boolean(v && v !== 'false'));
        break;

      case 'email_sent_count': {
        const sqlOp = NUMERIC_OPS[op] || '>=' ;
        push(`(SELECT COUNT(*) FROM emails e WHERE e.lead_id = l.id AND e.workspace_id = l.workspace_id) ${sqlOp} ?`, Number(v));
        break;
      }

      case 'email_opened': {
        if (op === 'eq' && (v === true || v === 'true')) {
          push(`EXISTS (SELECT 1 FROM emails e WHERE e.lead_id = l.id AND e.workspace_id = l.workspace_id AND e.opened_at IS NOT NULL)`, undefined);
        } else {
          push(`NOT EXISTS (SELECT 1 FROM emails e WHERE e.lead_id = l.id AND e.workspace_id = l.workspace_id AND e.opened_at IS NOT NULL)`, undefined);
        }
        break;
      }

      case 'email_open_count': {
        const sqlOp = NUMERIC_OPS[op] || '>=';
        push(`(SELECT COALESCE(SUM(e.open_count),0) FROM emails e WHERE e.lead_id = l.id AND e.workspace_id = l.workspace_id AND e.opened_at IS NOT NULL) ${sqlOp} ?`, Number(v));
        break;
      }

      case 'email_clicked': {
        if (op === 'eq' && (v === true || v === 'true')) {
          push(`EXISTS (SELECT 1 FROM emails e WHERE e.lead_id = l.id AND e.workspace_id = l.workspace_id AND e.clicked_at IS NOT NULL)`, undefined);
        } else {
          push(`NOT EXISTS (SELECT 1 FROM emails e WHERE e.lead_id = l.id AND e.workspace_id = l.workspace_id AND e.clicked_at IS NOT NULL)`, undefined);
        }
        break;
      }

      case 'email_replied_within_days': {
        const days = String(Math.max(0, Number(v)));
        push(
          `(EXISTS (
             SELECT 1 FROM emails e
             WHERE e.lead_id = l.id AND e.workspace_id = l.workspace_id
               AND e.replied_at >= NOW() - (? || ' days')::interval
           ) OR EXISTS (
             SELECT 1 FROM lead_activities a
             WHERE a.lead_id = l.id AND a.workspace_id = l.workspace_id
               AND a.type = 'email_replied'
               AND a.created_at >= NOW() - (? || ' days')::interval
           ))`,
          days, days
        );
        break;
      }

      case 'opened_but_no_reply':
        // Opened at least one email but never replied to anything recently
        push(
          `EXISTS (SELECT 1 FROM emails e WHERE e.lead_id = l.id AND e.workspace_id = l.workspace_id AND e.opened_at IS NOT NULL)
           AND NOT EXISTS (
             SELECT 1 FROM emails e WHERE e.lead_id = l.id AND e.workspace_id = l.workspace_id AND e.replied_at IS NOT NULL
           ) AND NOT EXISTS (
             SELECT 1 FROM lead_activities a WHERE a.lead_id = l.id AND a.workspace_id = l.workspace_id AND a.type = 'email_replied'
           )`,
          undefined
        );
        break;

      default:
        // Unknown fields are ignored rather than erroring — keeps old segments valid
        logger.warn(`Unknown segment field ignored: ${cond.field}`);
        break;
    }
  }

  const joiner = matchType === 'any' ? ' OR ' : ' AND ';
  const whereSql = clauses.length ? `(${clauses.join(joiner)})` : '';
  return { whereSql, params, nextIdx: idx };
}

/**
 * Evaluate a segment definition for a workspace.
 * Returns { count, leads } ordered by most-recently-active first.
 */
async function evaluateSegment(workspaceId, { match_type, conditions }, { limit = 500, offset = 0 } = {}) {
  const { whereSql, params } = compileConditions(conditions, match_type || 'all', 2);
  const extra = `${whereSql ? 'AND ' : ''}${whereSql}`;

  const countRes = await db.query(
    `SELECT COUNT(*)::int AS count FROM leads l WHERE l.workspace_id = $1 ${extra}`,
    [workspaceId, ...params]
  );

  const rowsRes = await db.query(
    `SELECT l.* FROM leads l
     WHERE l.workspace_id = $1 ${extra}
     ORDER BY COALESCE(l.last_activity_at, l.created_at) DESC
     LIMIT ${Number(limit)} OFFSET ${Number(offset)}`,
    [workspaceId, ...params]
  );

  return { count: countRes.rows[0].count, leads: rowsRes.rows };
}

/** Just the member ids (used by flow triggers + campaign audiences). */
async function getSegmentMemberIds(workspaceId, segmentId) {
  const segRes = await db.query(
    'SELECT * FROM segments WHERE id = $1 AND workspace_id = $2',
    [segmentId, workspaceId]
  );
  if (segRes.rows.length === 0) return [];
  const seg = segRes.rows[0];
  const { whereSql, params } = compileConditions(seg.conditions, seg.match_type, 2);
  const res = await db.query(
    `SELECT l.id FROM leads l WHERE l.workspace_id = $1 ${whereSql ? 'AND ' : ''}${whereSql}`,
    [workspaceId, ...params]
  );
  return res.rows.map((r) => r.id);
}

module.exports = { compileConditions, evaluateSegment, getSegmentMemberIds };
