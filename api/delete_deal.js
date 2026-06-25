const { getSession, handleCors } = require('../lib/auth');
const { queryDB, executeDB } = require('../lib/db');
module.exports = async function handler(req, res) {
  if (handleCors(req, res)) return;
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method Not Allowed' }); return; }
  const session = getSession(req);
  if (!session) { res.status(401).json({ error: 'No autorizado' }); return; }
  try {
    const { deal_name } = req.body || {};
    if (!deal_name) { res.status(400).json({ error: 'deal_name required' }); return; }
    const safeName = deal_name.replace(/'/g, "''");
    const rows = await queryDB(`SELECT ef.entry_id as id FROM entry_fields ef JOIN fields f ON f.id = ef.field_id AND f.name = 'Deal Name' WHERE ef.value = '${safeName}' LIMIT 1`);
    if (!rows || rows.length === 0) { res.status(404).json({ error: 'Deal not found' }); return; }
    const entryId = rows[0].id;
    await executeDB(`DELETE FROM entry_fields WHERE entry_id = '${entryId}'`);
    await executeDB(`DELETE FROM entries WHERE id = '${entryId}'`);
    res.status(200).json({ ok: true, deal_name, deleted_entry_id: entryId });
  } catch (e) { res.status(500).json({ error: 'DB error: ' + e.message }); }
};
