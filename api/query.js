const { getSession, handleCors } = require('../lib/auth');
const { queryDB } = require('../lib/db');
module.exports = async function handler(req, res) {
  if (handleCors(req, res)) return;
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method Not Allowed' }); return; }
  const session = getSession(req);
  if (!session) { res.status(401).json({ error: 'No autorizado' }); return; }
  try {
    const { sql } = req.body || {};
    if (!sql || typeof sql !== 'string') { res.status(400).json({ error: 'Missing or invalid "sql" field' }); return; }
    const trimmed = sql.trim().toUpperCase();
    if (!trimmed.startsWith('SELECT')) { res.status(403).json({ error: 'Only SELECT queries are allowed' }); return; }
    if (session.role === 'vendedor' && session.seller) {
      const sqlUpper = sql.toUpperCase();
      const sellerUpper = session.seller.toUpperCase();
      const touchesDeals = /\bDEALS\b/.test(sqlUpper);
      const touchesInteraction = /\bV_INTERACTION\b/.test(sqlUpper);
      if (touchesDeals && !sqlUpper.includes("ASSIGNED_TO = '" + sellerUpper + "'")) { res.status(403).json({ error: 'Acceso restringido: solo puedes ver tus propios deals' }); return; }
      if (touchesInteraction && !sqlUpper.includes("SELLER = '" + sellerUpper + "'")) { res.status(403).json({ error: 'Acceso restringido: solo puedes ver tus propias interacciones' }); return; }
    }
    const rows = await queryDB(sql);
    res.status(200).json({ rows });
  } catch (e) { res.status(500).json({ error: 'Query error: ' + e.message }); }
};
