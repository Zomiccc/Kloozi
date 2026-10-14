const db = require('../config/database');

// Demo workspaces (the "magic link" sandbox) must never send real messages.
// Every sender asks isDemoWorkspace() and only records a simulated send.
const cache = new Map();
const TTL = 60000;

async function isDemoWorkspace(workspaceId) {
  if (!workspaceId) return false;
  const hit = cache.get(workspaceId);
  if (hit && Date.now() - hit.at < TTL) return hit.demo;
  const r = await db.query("SELECT settings->>'demo' = 'true' AS demo FROM workspaces WHERE id = $1", [workspaceId]);
  const demo = !!r.rows[0]?.demo;
  cache.set(workspaceId, { demo, at: Date.now() });
  return demo;
}

module.exports = { isDemoWorkspace };
