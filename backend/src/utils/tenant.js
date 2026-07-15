const db = require('../config/database');

function tenantFilter(workspaceId, alias = null) {
  const col = alias ? `${alias}.workspace_id` : 'workspace_id';
  return `${col} = ${workspaceId}`;
}

function tenantParam(workspaceId) {
  return workspaceId;
}

async function verifyTenantAccess(userId, workspaceId, leadId = null) {
  const userCheck = await db.query(
    'SELECT workspace_id FROM users WHERE id = $1 AND status = $2',
    [userId, 'active']
  );
  if (userCheck.rows.length === 0 || userCheck.rows[0].workspace_id !== workspaceId) {
    return false;
  }

  if (leadId) {
    const leadCheck = await db.query(
      'SELECT workspace_id FROM leads WHERE id = $1',
      [leadId]
    );
    if (leadCheck.rows.length === 0 || leadCheck.rows[0].workspace_id !== workspaceId) {
      return false;
    }
  }

  return true;
}

function buildWhereClause(baseConditions, workspaceId) {
  const conditions = [`workspace_id = $${baseConditions.params.length + 1}`];
  baseConditions.params.push(workspaceId);
  return conditions.join(' AND ');
}

function addCondition(conditions, params, clause, value) {
  conditions.push(clause.replace('$$', `$${params.length + 1}`));
  params.push(value);
}

module.exports = { tenantFilter, tenantParam, verifyTenantAccess, buildWhereClause, addCondition };
