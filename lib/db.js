const { Pool } = require('pg');
let pool;
function getPool() {
  if (!pool) {
    pool = new Pool({
      connectionString: process.env.PG_URL,
      max: 5,
      ssl: { rejectUnauthorized: false },
    });
  }
  return pool;
}
function sanitizeRow(row) {
  const out = {};
  for (const [k, v] of Object.entries(row)) {
    out[k] = typeof v === 'bigint' ? Number(v) : v;
  }
  return out;
}
async function queryDB(sql) {
  const p = getPool();
  const result = await p.query(sql);
  return result.rows.map(sanitizeRow);
}
async function executeDB(sql) {
  const p = getPool();
  await p.query(sql);
}
module.exports = { getPool, sanitizeRow, queryDB, executeDB };
