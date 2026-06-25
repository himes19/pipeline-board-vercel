const { getSession, handleCors } = require('../lib/auth');
const { queryDB } = require('../lib/db');
const { calcScoresFromDeal } = require('../lib/utils');
module.exports = async function handler(req, res) {
  if (handleCors(req, res)) return;
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method Not Allowed' }); return; }
  const session = getSession(req);
  if (!session) { res.status(401).json({ error: 'No autorizado' }); return; }
  try {
    const { deal_name } = req.body || {};
    if (!deal_name) { res.status(400).json({ error: 'deal_name required' }); return; }
    const safeName = deal_name.replace(/'/g, "''");
    const rows = await queryDB(`SELECT * FROM deals WHERE deal_name = '${safeName}'`);
    if (!rows || rows.length === 0) { res.status(404).json({ error: 'Deal not found' }); return; }
    const scores = calcScoresFromDeal(rows[0]);
    res.status(200).json({ ok: true, deal_name, scores });
  } catch (e) { res.status(400).json({ error: 'Bad request: ' + e.message }); }
};
