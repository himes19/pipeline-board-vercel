const { getSession, handleCors } = require('../lib/auth');
const { queryDB, executeDB } = require('../lib/db');

module.exports = async function handler(req, res) {
  if (handleCors(req, res)) return;
  const session = getSession(req);
  if (!session) { res.status(401).json({ error: 'No autorizado' }); return; }

  // GET — cargar análisis existente de un deal
  if (req.method === 'GET') {
    const { deal_name } = req.query;
    if (!deal_name) { res.status(400).json({ error: 'deal_name required' }); return; }
    try {
      const rows = await queryDB(`
        SELECT * FROM freeze_analysis
        WHERE deal_name = '${deal_name.replace(/'/g,"''")}'
        ORDER BY analyzed_at DESC LIMIT 1
      `);
      res.status(200).json({ ok: true, analysis: rows[0] || null });
    } catch(e) { res.status(500).json({ error: e.message }); }
    return;
  }

  // POST — guardar análisis de congelamiento
  if (req.method === 'POST') {
    const {
      deal_name, stage_at_freeze,
      ultimo_compromiso, compromiso_cumplido, ultimo_contacto_real,
      dolor_cuantificado, sabe_quien_decide, dm_sabe_proyecto,
      contacto_tiene_poder, urgencia_cliente,
      por_que_congelo, que_harias_diferente,
      decision, proxima_accion, proxima_fecha
    } = req.body || {};

    if (!deal_name) { res.status(400).json({ error: 'deal_name required' }); return; }

    const s  = v => v ? `'${String(v).replace(/'/g,"''")}'` : 'NULL';
    const sd = v => v ? `'${v}'` : 'NULL';

    try {
      await executeDB(`
        INSERT INTO freeze_analysis (
          deal_name, vendedor, stage_at_freeze,
          ultimo_compromiso, compromiso_cumplido, ultimo_contacto_real,
          dolor_cuantificado, sabe_quien_decide, dm_sabe_proyecto,
          contacto_tiene_poder, urgencia_cliente,
          por_que_congelo, que_harias_diferente,
          decision, proxima_accion, proxima_fecha
        ) VALUES (
          ${s(deal_name)}, ${s(session.name)}, ${s(stage_at_freeze)},
          ${s(ultimo_compromiso)}, ${s(compromiso_cumplido)}, ${sd(ultimo_contacto_real)},
          ${s(dolor_cuantificado)}, ${s(sabe_quien_decide)}, ${s(dm_sabe_proyecto)},
          ${s(contacto_tiene_poder)}, ${s(urgencia_cliente)},
          ${s(por_que_congelo)}, ${s(que_harias_diferente)},
          ${s(decision)}, ${s(proxima_accion)}, ${sd(proxima_fecha)}
        )
      `);

      // Si decidió pausar o marcar inactivo, actualizar freeze_status en entry_fields
      if (decision === 'pausar_90' || decision === 'inactivo') {
        const entryRows = await queryDB(`
          SELECT ef.entry_id as id FROM entry_fields ef
          JOIN fields f ON f.id = ef.field_id AND f.name = 'Deal Name'
          WHERE ef.value = '${deal_name.replace(/'/g,"''")}' LIMIT 1
        `);
        if (entryRows?.length) {
          const entryId = entryRows[0].id;
          const status = decision === 'pausar_90' ? 'pausado' : 'zombie';
          await executeDB(`
            INSERT INTO entry_fields (entry_id, field_id, value)
            VALUES ('${entryId}', 'e8615681-e021-40da-ac53-110b16f8c41c', '${status}')
            ON CONFLICT (entry_id, field_id) DO UPDATE SET value = '${status}'
          `);
        }
      }

      res.status(200).json({ ok: true });
    } catch(e) { res.status(500).json({ error: e.message }); }
    return;
  }

  res.status(405).json({ error: 'Method Not Allowed' });
};
