const { queryDB, executeDB } = require('../lib/db');

const FIELD_DEAL_SCORE  = '38b24a2e-c656-45f3-aa0f-bed6ca2f5b56';
const FIELD_DEAL_NAME   = 'aa797617-3ac4-4469-af73-cb4233c2d689';
const FIELD_TEMPERATURA = 'f457c08e-50c2-4c98-973a-fa1fd52f905c';
const FIELD_STAGE_CHANGED_AT = '55946434-2043-40cf-8cd2-75c285d6386d';
const OBJECT_DEAL       = 'e9f17fa1-bdd2-4bcc-9798-458ae301ec2c';

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

function calcTemperatura(stageChangedAt) {
  if (!stageChangedAt) return 'Frío';
  const changed = new Date(stageChangedAt);
  const now = new Date();
  const dias = Math.floor((now - changed) / (1000 * 60 * 60 * 24));
  if (dias <= 7)  return 'Caliente';
  if (dias <= 14) return 'Tibio';
  return 'Frío';
}

async function upsertField(entryId, fieldId, value) {
  const existing = await queryDB(
    `SELECT entry_id FROM entry_fields WHERE entry_id = '${entryId}' AND field_id = '${fieldId}' LIMIT 1`
  );
  if (existing && existing.length > 0) {
    await executeDB(`UPDATE entry_fields SET value = '${value}' WHERE entry_id = '${entryId}' AND field_id = '${fieldId}'`);
  } else {
    await executeDB(`INSERT INTO entry_fields (entry_id, field_id, value) VALUES ('${entryId}', '${fieldId}', '${value}')`);
  }
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
        d.tipo_cliente_score       AS tc,
        d.stage_changed_at
      FROM deals d
      JOIN entries e ON e.object_id = '${OBJECT_DEAL}'
      JOIN entry_fields ef_name
        ON ef_name.entry_id = e.id
       AND ef_name.field_id  = '${FIELD_DEAL_NAME}'
       AND ef_name.value     = d.deal_name
      WHERE d.stage NOT IN (${stages})
    `);

    let scores_actualizados = 0, temps_actualizadas = 0, sinScore = 0;
    const resultados = [];

    for (const row of rows) {
      // Calcular y guardar deal_score
      const score = calcScore(row.nc, row.ep, row.sbc, row.tc);
      if (score !== null) {
        await upsertField(row.entry_id, FIELD_DEAL_SCORE, String(score));
        scores_actualizados++;
        resultados.push({ deal: row.deal_name, score });
      } else {
        sinScore++;
      }

      // Calcular y guardar temperatura
      const temp = calcTemperatura(row.stage_changed_at);
      await upsertField(row.entry_id, FIELD_TEMPERATURA, temp);
      temps_actualizadas++;
    }

    resultados.sort((a, b) => b.score - a.score);
    console.log(`[rescore_daily] ✓ scores: ${scores_actualizados} | temps: ${temps_actualizadas} | sin_score: ${sinScore}`);

    return res.status(200).json({
      ok: true,
      scores_actualizados,
      temps_actualizadas,
      sin_subscores: sinScore,
      top5: resultados.slice(0, 5),
      timestamp: new Date().toISOString(),
    });

  } catch (err) {
    console.error('[rescore_daily] Error:', err.message);
    return res.status(500).json({ error: err.message });
  }
};
