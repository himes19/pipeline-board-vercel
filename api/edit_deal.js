const crypto = require('crypto');
const { getSession, handleCors } = require('../lib/auth');
const { queryDB, executeDB } = require('../lib/db');
const { DEAL_FIELD_MAP, STAGE_STATUS_MAP, STAGE_FIELD_ID } = require('../lib/utils');
module.exports = async function handler(req, res) {
  if (handleCors(req, res)) return;
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method Not Allowed' }); return; }
  const session = getSession(req);
  if (!session) { res.status(401).json({ error: 'No autorizado' }); return; }
  try {
    const { deal_name, field, value } = req.body || {};
    if (!deal_name || !field || value === undefined) { res.status(400).json({ error: 'deal_name, field, and value required' }); return; }
    const safeDealName = deal_name.replace(/'/g, "''");
    const safeValue = String(value).replace(/'/g, "''");
    const entryRows = await queryDB(`SELECT ef.entry_id as id FROM entry_fields ef JOIN fields f ON f.id = ef.field_id AND f.name = 'Deal Name' WHERE ef.value = '${safeDealName}' LIMIT 1`);
    if (!entryRows || entryRows.length === 0) { res.status(404).json({ error: 'Deal not found: ' + deal_name }); return; }
    const entryId = entryRows[0].id;
    if (field === 'stage') {
      if (!STAGE_STATUS_MAP[value]) { res.status(400).json({ error: 'Unknown stage: ' + value }); return; }
      const existing = await queryDB(`SELECT id FROM entry_fields WHERE entry_id = '${entryId}' AND field_id = '${STAGE_FIELD_ID}' LIMIT 1`);
      if (existing && existing.length > 0) {
        await executeDB(`UPDATE entry_fields SET value = '${safeValue}' WHERE entry_id = '${entryId}' AND field_id = '${STAGE_FIELD_ID}'`);
      } else {
        await executeDB(`INSERT INTO entry_fields (id, entry_id, field_id, value) VALUES ('${crypto.randomUUID()}', '${entryId}', '${STAGE_FIELD_ID}', '${safeValue}')`);
      }
      res.status(200).json({ ok: true, deal_name, field, value }); return;
    }
    if (field === 'deal_name') {
      await executeDB(`UPDATE entry_fields SET value = '${safeValue}' WHERE entry_id = '${entryId}' AND field_id = '${DEAL_FIELD_MAP['deal_name']}'`);
      res.status(200).json({ ok: true, deal_name, field, value }); return;
    }
    const fieldId = DEAL_FIELD_MAP[field];
    if (!fieldId) { res.status(400).json({ error: 'Unknown field: ' + field }); return; }
    const existing = await queryDB(`SELECT id FROM entry_fields WHERE entry_id = '${entryId}' AND field_id = '${fieldId}' LIMIT 1`);
    if (existing && existing.length > 0) {
      await executeDB(`UPDATE entry_fields SET value = '${safeValue}' WHERE entry_id = '${entryId}' AND field_id = '${fieldId}'`);
    } else {
      await executeDB(`INSERT INTO entry_fields (id, entry_id, field_id, value) VALUES ('${crypto.randomUUID()}', '${entryId}', '${fieldId}', '${safeValue}')`);
    }
    res.status(200).json({ ok: true, deal_name, field, value });
  } catch (e) { res.status(500).json({ error: 'Server error: ' + e.message }); }
};
