const { getSession, handleCors } = require('../lib/auth');
const { queryDB, executeDB } = require('../lib/db');

module.exports = async function handler(req, res) {
  if (handleCors(req, res)) return;
  const session = getSession(req);
  if (!session) { res.status(401).json({ error: 'No autorizado' }); return; }

  // GET — cargar checks de un deal
  if (req.method === 'GET') {
    const dealName = req.query.deal_name;
    if (!dealName) { res.status(400).json({ error: 'deal_name required' }); return; }
    try {
      const rows = await queryDB(
        `SELECT item_id, checked FROM playbook_checks WHERE deal_name = '${dealName.replace(/'/g,"''")}'`
      );
      const checks = {};
      rows.forEach(r => { checks[r.item_id] = r.checked; });
      res.status(200).json({ ok: true, checks });
    } catch (e) { res.status(500).json({ error: e.message }); }
    return;
  }

  // POST — guardar un check
  if (req.method === 'POST') {
    const { deal_name, item_id, checked } = req.body || {};
    if (!deal_name || !item_id || checked === undefined) {
      res.status(400).json({ error: 'deal_name, item_id y checked son requeridos' }); return;
    }
    try {
      await executeDB(`
        INSERT INTO playbook_checks (deal_name, item_id, checked, updated_by, updated_at)
        VALUES ('${deal_name.replace(/'/g,"''")}', '${item_id}', ${!!checked}, '${(session.name||'').replace(/'/g,"''")}', NOW())
        ON CONFLICT (deal_name, item_id)
        DO UPDATE SET checked = ${!!checked}, updated_by = '${(session.name||'').replace(/'/g,"''")}', updated_at = NOW()
      `);
      res.status(200).json({ ok: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
    return;
  }

  res.status(405).json({ error: 'Method Not Allowed' });
};
