// api/weekly_report.js
// Cron: Jueves 4:30am UTC — compara snapshot actual vs anterior y genera cambios

const { queryDB, executeDB } = require('../lib/db');

const STAGES_EXCLUIR = ["0 · Perdido", "13 · Ganado"];

module.exports = async function handler(req, res) {
  const cronAuth   = req.headers['authorization'] === `Bearer ${process.env.CRON_SECRET}`;
  const manualAuth = req.method === 'POST' && req.headers['x-admin-key'] === process.env.CRON_SECRET;
  if (!cronAuth && !manualAuth) return res.status(401).json({ error: 'No autorizado' });

  try {
    // Fecha del jueves actual
    const now = new Date();
    const day = now.getUTCDay();
    const diff = (4 - day + 7) % 7;
    const weekEnding = new Date(now);
    weekEnding.setUTCDate(now.getUTCDate() + (diff === 0 ? 0 : diff));
    const weekEndingStr = weekEnding.toISOString().slice(0, 10);

    // Fecha del jueves anterior
    const prevWeek = new Date(weekEnding);
    prevWeek.setUTCDate(prevWeek.getUTCDate() - 7);
    const prevWeekStr = prevWeek.toISOString().slice(0, 10);

    const stagesStr = STAGES_EXCLUIR.map(s => `'${s.replace(/'/g,"''")}'`).join(',');

    // Deals actuales con su stage actual y score
    const deals = await queryDB(`
      SELECT deal_name, stage, assigned_to, deal_score, temperatura,
             stage_change_date
      FROM deals
      WHERE stage NOT IN (${stagesStr})
    `);

    // Deals que cambiaron de stage esta semana (últimos 7 días)
    const stageChanges = deals.filter(d => {
      if (!d.stage_change_date) return false;
      const changed = new Date(d.stage_change_date);
      const diffDays = (now - changed) / (1000 * 60 * 60 * 24);
      return diffDays <= 7;
    });

    // Borrar cambios de esta semana y reinsertar (idempotente)
    await executeDB(`DELETE FROM weekly_changes WHERE week_ending = '${weekEndingStr}'`);

    let cambios = 0;
    for (const d of stageChanges) {
      const safeName = d.deal_name.replace(/'/g, "''");
      const safeVendedor = (d.assigned_to||'').replace(/'/g, "''");
      await executeDB(`
        INSERT INTO weekly_changes (week_ending, deal_name, vendedor, tipo_cambio, valor_anterior, valor_nuevo)
        VALUES ('${weekEndingStr}', '${safeName}', '${safeVendedor}', 'stage', 'anterior', '${d.stage.replace(/'/g,"''")}')
      `);
      cambios++;
    }

    return res.status(200).json({
      ok: true,
      week_ending: weekEndingStr,
      stage_changes: cambios,
      timestamp: new Date().toISOString(),
    });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
