// api/snapshot_weekly.js
// Cron: Jueves 4:00am UTC (10pm México) — toma snapshot del pipeline actual

const { queryDB, executeDB } = require('../lib/db');

const VENDEDORES = ['Jorge H', 'Alberto Rivera', 'Carlos Cruz', 'MAURICIO LIRA MORIN', 'Horacio Garcia', 'Alejandro'];
const STAGES_EXCLUIR = ["0 · Perdido", "13 · Ganado"];

module.exports = async function handler(req, res) {
  const cronAuth   = req.headers['authorization'] === `Bearer ${process.env.CRON_SECRET}`;
  const manualAuth = req.method === 'POST' && req.headers['x-admin-key'] === process.env.CRON_SECRET;
  if (!cronAuth && !manualAuth) return res.status(401).json({ error: 'No autorizado' });

  try {
    const stagesStr = STAGES_EXCLUIR.map(s => `'${s.replace(/'/g,"''")}'`).join(',');

    const now = new Date();
    const day = now.getUTCDay();
    const diff = (4 - day + 7) % 7;
    const weekEnding = new Date(now);
    weekEnding.setUTCDate(now.getUTCDate() + (diff === 0 ? 0 : diff));
    const weekEndingStr = weekEnding.toISOString().slice(0, 10);

    const deals = await queryDB(`
      SELECT deal_name, stage, assigned_to,
        CAST(deal_value_usd AS DOUBLE PRECISION) as deal_value_usd,
        deal_score, temperatura
      FROM deals
      WHERE stage NOT IN (${stagesStr})
    `);

    let insertados = 0;

    for (const vendedor of VENDEDORES) {
      const ds = deals.filter(d => d.assigned_to === vendedor);
      if (!ds.length) continue;

      const total      = ds.length;
      const discovery  = ds.filter(d => d.stage === '1 · Discovery Call').length;
      const propuesta  = ds.filter(d => d.stage === '2 · Propuesta Preliminar').length;
      const produccion = ds.filter(d => d.stage === '3 · Reunión con Producción').length;
      const calidad    = ds.filter(d => d.stage === '4 · Reunión con Calidad').length;
      const finanzas   = ds.filter(d => d.stage === '5 · Reunión con Finanzas').length;
      const tecnica    = ds.filter(d => d.stage === '6 · Reunión Técnica / Pre-Ingeniería').length;
      const bc         = ds.filter(d => d.stage === '7 · Desarrollo del Business Case').length;
      const ejecutiva  = ds.filter(d => d.stage === '8 · Presentación Ejecutiva').length;
      const caliente   = ds.filter(d => d.temperatura === 'Caliente').length;
      const tibio      = ds.filter(d => d.temperatura === 'Tibio').length;
      const frio       = ds.filter(d => d.temperatura === 'Frío').length;
      const scored     = ds.filter(d => d.deal_score);
      const avgScore   = scored.length ? scored.reduce((a,d) => a + parseFloat(d.deal_score||0), 0) / scored.length : 0;
      const pipeline   = ds.reduce((a,d) => a + parseFloat(d.deal_value_usd||0), 0);

      await executeDB(`
        INSERT INTO weekly_snapshots_v2
          (week_ending, vendedor, deals_total, deals_discovery, deals_propuesta,
           deals_produccion, deals_calidad, deals_finanzas, deals_tecnica,
           deals_bc, deals_ejecutiva, avg_score, temp_caliente, temp_tibio,
           temp_frio, pipeline_value_usd)
        VALUES (
          '${weekEndingStr}', '${vendedor.replace(/'/g,"''")}',
          ${total}, ${discovery}, ${propuesta}, ${produccion}, ${calidad},
          ${finanzas}, ${tecnica}, ${bc}, ${ejecutiva},
          ${avgScore.toFixed(2)}, ${caliente}, ${tibio}, ${frio}, ${pipeline.toFixed(2)}
        )
        ON CONFLICT (week_ending, vendedor) DO UPDATE SET
          deals_total = EXCLUDED.deals_total,
          deals_discovery = EXCLUDED.deals_discovery,
          deals_propuesta = EXCLUDED.deals_propuesta,
          deals_produccion = EXCLUDED.deals_produccion,
          deals_calidad = EXCLUDED.deals_calidad,
          deals_finanzas = EXCLUDED.deals_finanzas,
          deals_tecnica = EXCLUDED.deals_tecnica,
          deals_bc = EXCLUDED.deals_bc,
          deals_ejecutiva = EXCLUDED.deals_ejecutiva,
          avg_score = EXCLUDED.avg_score,
          temp_caliente = EXCLUDED.temp_caliente,
          temp_tibio = EXCLUDED.temp_tibio,
          temp_frio = EXCLUDED.temp_frio,
          pipeline_value_usd = EXCLUDED.pipeline_value_usd,
          snapshot_at = NOW()
      `);
      insertados++;
    }

    return res.status(200).json({ ok: true, week_ending: weekEndingStr, vendedores: insertados });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
