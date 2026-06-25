const crypto = require('crypto');
const { getSession, handleCors } = require('../lib/auth');
const { executeDB } = require('../lib/db');
const { DEAL_FIELD_MAP, STAGE_FIELD_ID, DEALS_OBJECT_ID } = require('../lib/utils');
module.exports = async function handler(req, res) {
  if (handleCors(req, res)) return;
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method Not Allowed' }); return; }
  const session = getSession(req);
  if (!session) { res.status(401).json({ error: 'No autorizado' }); return; }
  try {
    const { deal_name, assigned_to, stage, primary_contact, company, fields: extraFields } = req.body || {};
    if (!deal_name) { res.status(400).json({ error: 'deal_name required' }); return; }
    const entryId = crypto.randomUUID();
    const safeName = deal_name.replace(/'/g, "''");
    const stageKey = stage || '1 · Discovery Call';
    await executeDB(`INSERT INTO entries (id, object_id, created_at, updated_at) VALUES ('${entryId}', '${DEALS_OBJECT_ID}', now(), now())`);
    const fieldInserts = [];
    fieldInserts.push(`('${crypto.randomUUID()}','${entryId}','${DEAL_FIELD_MAP.deal_name}','${safeName}')`);
    fieldInserts.push(`('${crypto.randomUUID()}','${entryId}','${STAGE_FIELD_ID}','${stageKey.replace(/'/g, "''")}')`);
    if (assigned_to) fieldInserts.push(`('${crypto.randomUUID()}','${entryId}','${DEAL_FIELD_MAP.assigned_to}','${assigned_to.replace(/'/g, "''")}')`);
    if (primary_contact) fieldInserts.push(`('${crypto.randomUUID()}','${entryId}','${DEAL_FIELD_MAP.primary_contact}','${primary_contact.replace(/'/g, "''")}')`);
    if (company) fieldInserts.push(`('${crypto.randomUUID()}','${entryId}','${DEAL_FIELD_MAP.company}','${company.replace(/'/g, "''")}')`);
    if (extraFields && typeof extraFields === 'object') {
      for (const [k, v] of Object.entries(extraFields)) {
        const fid = DEAL_FIELD_MAP[k];
        if (fid && v) fieldInserts.push(`('${crypto.randomUUID()}','${entryId}','${fid}','${String(v).replace(/'/g, "''")}')`);
      }
    }
    if (fieldInserts.length > 0) {
      try {
        await executeDB(`INSERT INTO entry_fields (id, entry_id, field_id, value) VALUES ${fieldInserts.join(',')}`);
        res.status(200).json({ ok: true, deal_name, entry_id: entryId });
      } catch (err2) {
        res.status(200).json({ ok: true, deal_name, entry_id: entryId, warning: 'Fields partially saved: ' + err2.message });
      }
    } else {
      res.status(200).json({ ok: true, deal_name, entry_id: entryId });
    }
  } catch (e) { res.status(500).json({ error: 'DB create error: ' + e.message }); }
};
