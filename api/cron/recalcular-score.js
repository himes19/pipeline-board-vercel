// api/cron/recalcular-score.js
// Vercel Cron Job — corre diariamente a las 4am UTC (11pm hora México)
//
// Fórmula (cuadro de evaluación PulseVolt):
//   nivel_contacto_score  peso 10%  → '1'=33.33%, '2'=66.67%, '3'=100%
//   etapa_proceso_score   peso 15%  → igual
//   solidez_bc_score      peso 30%  → igual
//   tipo_cliente_score    peso 45%  → igual
//   deal_score = round(suma_ponderada * 100, 1)

const { queryDB, executeDB } = require('../../lib/db');

const FIELD_DEAL_SCORE = '38b24a2e-c656-45f3-aa0f-bed6ca2f5b56';
const FIELD_DEAL_NAME  = 'aa797617-3ac4-4469-af73-cb4233c2d689';
const OBJECT_DEAL      = 'e9f17fa1-bdd2-4bcc-9798-458ae301ec2c';

const PESOS  = { nc: 0.10, ep: 0.15, sbc: 0.30, tc: 0.45 };
const TO_PCT = { '1': 33.33, '2': 66.67, '3': 100.0 };

const STAGES_EXCLUIR = ["0 · Perdido", "13 · Ganado"];

function calcScore(nc, ep, sbc, tc) {
  const vals = { nc, ep, sbc, tc };
  let total = 0, pesoAcum = 0;
  for (const [k, v] of Object.entries(vals)) {
    if (v && TO_PCT[v] !== undefined) {
      total    += (TO_PCT[v] / 100) * PESOS[k];
      pesoAcum += PESOS[k];
    }
  }
  if (pesoAcum === 0) return null;
  return Math.round((total / pesoAcum) * 100 * 10) / 10;
}

module.exports = async function handler(req, res) {
  const cronAuth   = req.headers['authorization'] === `Bearer ${process.env.CRON_SECRET}`;
  const manualAuth = req.method === 'POST' && req.headers['x-admin-key'] === process.env.CRON_SECRET;

  if (!cronAuth && !manualAuth) {
    return res.status(401).json({ error: 'No autorizado' });
  }

  try {
    const stages = STAGES_EXCLUIR.map(s => `'${s.replace(/'/g, "''")}'`).join(',');

    const rows = await queryDB(`
      SELECT
        e.id                       AS entry_id,
        d.deal_name,
        d.stage,
        d.nivel_contacto_score     AS nc,
        d.etapa_proceso_score      AS ep,
        d.solidez_bc_score         AS sbc,
        d.tipo_cliente_score       AS tc
      FROM deals d
      JOIN entries e
        ON e.object_id = '${OBJECT_DEAL}'
      JOIN entry_fields ef_name
        ON ef_name.entry_id = e.id
       AND ef_name.field_id  = '${FIELD_DEAL_NAME}'
       AND ef_name.value     = d.deal_name
      WHERE d.stage NOT IN (${stages})
        AND (
          d.nivel_contacto_score IS NOT NULL OR
          d.etapa_proceso_score  IS NOT NULL OR
          d.solidez_bc_score     IS NOT NULL OR
          d.tipo_cliente_score   IS NOT NULL
        )
    `);

    let actualizados = 0, sinScore = 0;
    const resultados = [];

    for (const row of rows) {
      const score = calcScore(row.nc, row.ep, row.sbc, row.tc);
      if (score === null) { sinScore++; continue; }

      await executeDB(`
        INSERT INTO entry_fields (entry_id, field_id, value, updated_at)
        VALUES ('${row.entry_id}', '${FIELD_DEAL_SCORE}', '${score}', NOW())
        ON CONFLICT (entry_id, field_id)
        DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()
      `);

      actualizados++;
      resultados.push({ deal: row.deal_name, score });
    }

    resultados.sort((a, b) => b.score - a.score);
    console.log(`[recalcular-score] ✓ ${actualizados} actualizados | ${sinScore} sin sub-scores`);

    return res.status(200).json({
      ok: true,
      actualizados,
      sin_subscores: sinScore,
      top5: resultados.slice(0, 5),
      timestamp: new Date().toISOString(),
    });

  } catch (err) {
    console.error('[recalcular-score] Error:', err.message);
    return res.status(500).json({ error: err.message });
  }
};
