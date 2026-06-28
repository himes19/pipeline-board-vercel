const { getSession, handleCors } = require('../lib/auth');
const { queryDB, executeDB } = require('../lib/db');

module.exports = async function handler(req, res) {
  if (handleCors(req, res)) return;
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method Not Allowed' }); return; }
  const session = getSession(req);
  if (!session) { res.status(401).json({ error: 'No autorizado' }); return; }

  try {
    const { sql, write } = req.body || {};
    if (!sql || typeof sql !== 'string') { res.status(400).json({ error: 'Missing or invalid "sql" field' }); return; }

    const trimmed = sql.trim().toUpperCase();
    const firstWord = trimmed.split(/\s+/)[0];

    // Modo escritura (write: true) — solo admin/gerente
    if (write || ['INSERT','UPDATE'].includes(firstWord)) {
      if (session.role !== 'admin' && session.role !== 'gerente') {
        res.status(403).json({ error: 'Acceso denegado: requiere admin o gerente' }); return;
      }
      const forbidden = ['DELETE','DROP','ALTER','TRUNCATE'];
      for (const word of forbidden) {
        if (trimmed.includes(word)) { res.status(403).json({ error: 'Forbidden keyword: ' + word }); return; }
      }
      await executeDB(sql);
      return res.status(200).json({ success: true });
    }

    // Modo lectura — solo SELECT
    if (!trimmed.startsWith('SELECT')) { res.status(403).json({ error: 'Only SELECT queries are allowed' }); return; }

    // Vendedor enforcement
    if (session.role === 'vendedor' && session.seller) {
      const sqlUpper = sql.toUpperCase();
      const sellerUpper = session.seller.toUpperCase();
      if (/\bDEALS\b/.test(sqlUpper) && !sqlUpper.includes("ASSIGNED_TO = '" + sellerUpper + "'")) {
        res.status(403).json({ error: 'Acceso restringido: solo puedes ver tus propios deals' }); return;
      }
    }

    const rows = await queryDB(sql);
    res.status(200).json({ rows });
  } catch (e) { res.status(500).json({ error: 'Query error: ' + e.message }); }
};
