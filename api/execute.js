const { getSession, handleCors } = require('../lib/auth');
const { executeDB } = require('../lib/db');
module.exports = async function handler(req, res) {
  if (handleCors(req, res)) return;
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method Not Allowed' }); return; }
  const session = getSession(req);
  if (!session) { res.status(401).json({ error: 'No autorizado' }); return; }
  if (session.role !== 'admin' && session.role !== 'gerente') {
    res.status(403).json({ error: 'Acceso denegado: requiere admin o gerente' }); return;
  }
  try {
    const { sql } = req.body || {};
    if (!sql || typeof sql !== 'string') { res.status(400).json({ error: 'Missing or invalid "sql" field' }); return; }
    const trimmed = sql.trim().toUpperCase();
    const allowed = ['INSERT', 'UPDATE'];
    const forbidden = ['DELETE', 'DROP', 'ALTER', 'TRUNCATE'];
    const firstWord = trimmed.split(/\s+/)[0];
    if (!allowed.includes(firstWord)) { res.status(403).json({ error: 'Only INSERT/UPDATE queries are allowed' }); return; }
    for (const word of forbidden) {
      if (trimmed.includes(word)) { res.status(403).json({ error: 'Query contains forbidden keyword: ' + word }); return; }
    }
    await executeDB(sql);
    res.status(200).json({ success: true });
  } catch (e) {
    res.status(500).json({ error: 'Execute error: ' + e.message });
  }
};
