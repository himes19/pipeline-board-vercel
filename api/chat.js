const https = require('https');
const { getSession, handleCors } = require('../lib/auth');
const { queryDB } = require('../lib/db');

const DENCH_CLOUD_URL = process.env.DENCH_CLOUD_URL || 'https://gateway.merseoriginals.com/v1/chat/completions';
const DENCH_CLOUD_KEY = process.env.DENCH_CLOUD_KEY || 'dench_d6d03990-9b39-4a74-91b0-70aa629eb6c0.ab50fe07c28c40359ac58af068f7de5ae3422ea3-ea47-4dd0-873f-4b04284f6969';
const AI_MODEL = process.env.AI_MODEL || 'claude-sonnet-4.6';

function calcScore(d) {
  const nc = parseInt(d.nivel_contacto_score) || 0;
  const ep = parseInt(d.etapa_proceso_score) || 0;
  const bc = parseInt(d.solidez_bc_score) || 0;
  const tc = parseInt(d.tipo_cliente_score) || 0;
  if (!nc || !ep || !bc || !tc) return null;
  return Math.round((nc / 3 * 0.15 + ep / 3 * 0.20 + bc / 3 * 0.35 + tc / 3 * 0.30) * 100);
}

function callAI(payload) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(payload);
    const url = new URL(DENCH_CLOUD_URL);
    const aiReq = https.request({
      hostname: url.hostname, port: url.port || 443, path: url.pathname, method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + DENCH_CLOUD_KEY, 'Content-Length': Buffer.byteLength(data) },
    }, (aiRes) => {
      let body = '';
      aiRes.on('data', chunk => body += chunk);
      aiRes.on('end', () => { try { resolve(JSON.parse(body)); } catch (e) { reject(new Error('AI parse error: ' + e.message)); } });
    });
    aiReq.on('error', reject);
    aiReq.write(data);
    aiReq.end();
  });
}

module.exports = async function handler(req, res) {
  if (handleCors(req, res)) return;
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method Not Allowed' }); return; }
  const session = getSession(req);
  if (!session) { res.status(401).json({ error: 'No autorizado' }); return; }
  try {
    const { message, history } = req.body || {};
    if (!message || typeof message !== 'string') { res.status(400).json({ error: 'message required' }); return; }
    const deals = await queryDB(
      `SELECT deal_name, stage, assigned_to, CAST(deal_value_usd AS DOUBLE PRECISION) as deal_value_usd, nivel_contacto_score, etapa_proceso_score, solidez_bc_score, tipo_cliente_score, CAST(primary_contact AS VARCHAR) as primary_contact, CAST(next_action AS VARCHAR) as next_action, CAST(next_followup_date AS VARCHAR) as next_followup_date, CAST(pain_signals AS VARCHAR) as pain_signals, CAST(last_interaction_date AS VARCHAR) as last_interaction_date, CAST(stage_notes AS VARCHAR) as stage_notes, CAST(last_interaction_notes AS VARCHAR) as last_interaction_notes, CAST(initial_contact AS VARCHAR) as initial_contact, CAST(current_contact AS VARCHAR) as current_contact, CAST(champion AS VARCHAR) as champion, CAST(decision_maker AS VARCHAR) as decision_maker, CAST(stakeholders AS VARCHAR) as stakeholders, CAST(priority AS VARCHAR) as priority, CAST(contact_level AS VARCHAR) as contact_level, CAST(deliverables AS VARCHAR) as deliverables, CAST(stage_entered_at AS VARCHAR) as stage_entered_at, CAST(stage_status AS VARCHAR) as stage_status FROM deals WHERE stage NOT IN ('0 · Perdido', '13 · Ganado') ORDER BY deal_name`
    );
    const allText = message + ' ' + (history || []).slice(-4).map(m => m.content || '').join(' ');
    const mentionedDeals = deals.map(d => d.deal_name).filter(n => allText.toUpperCase().includes(n.toUpperCase()));
    let detailContext = '';
    if (mentionedDeals.length > 0 && mentionedDeals.length <= 5) {
      for (const dealName of mentionedDeals) {
        const safeName = dealName.replace(/'/g, "''");
        let interactions = [];
        try {
          interactions = await queryDB(`SELECT CAST("Summary" AS VARCHAR) as summary, CAST("Date" AS VARCHAR) as date, CAST("Type" AS VARCHAR) as type, CAST("Seller" AS VARCHAR) as seller, CAST("Notes" AS VARCHAR) as notes, CAST("Outcome" AS VARCHAR) as outcome, CAST("Who We Talked To" AS VARCHAR) as who_we_talked_to, CAST("What We Learned" AS VARCHAR) as what_we_learned, CAST("Commitment Made" AS VARCHAR) as commitment_made, CAST("Our Commitment" AS VARCHAR) as our_commitment, CAST("Sentiment" AS VARCHAR) as sentiment, CAST("Transcript" AS VARCHAR) as transcript FROM v_interaction WHERE "Deal" = '${safeName}' ORDER BY "Date" DESC LIMIT 10`);
        } catch (e) { /* ignore */ }
        detailContext += `\n\n=== DETALLE: ${dealName} ===`;
        if (interactions.length > 0) {
          detailContext += `\nInteracciones (${interactions.length}):`;
          interactions.forEach(i => {
            detailContext += `\n  - ${i.date || '?'} | ${i.type || '?'} | ${i.seller || '?'} | ${i.summary || ''}`;
            if (i.who_we_talked_to) detailContext += `\n    Con: ${i.who_we_talked_to}`;
            if (i.what_we_learned) detailContext += `\n    Aprendimos: ${i.what_we_learned}`;
            if (i.commitment_made) detailContext += `\n    Compromiso cliente: ${i.commitment_made}`;
            if (i.our_commitment) detailContext += `\n    Nuestro compromiso: ${i.our_commitment}`;
            if (i.outcome) detailContext += `\n    Resultado: ${i.outcome}`;
            if (i.sentiment) detailContext += `\n    Sentimiento: ${i.sentiment}`;
          });
        }
        detailContext += `\n=== FIN DETALLE ===`;
      }
    }
    let crmContext = `\n\n=== PIPELINE CRM DATA (${deals.length} deals activos) ===\n`;
    deals.forEach(d => {
      const score = calcScore(d);
      const scoreStr = score !== null ? `Score: ${score}% (NC:${d.nivel_contacto_score} EP:${d.etapa_proceso_score} BC:${d.solidez_bc_score} TC:${d.tipo_cliente_score})` : 'Score: sin evaluar';
      crmContext += `\n• ${d.deal_name} | Etapa: ${d.stage} | Vendedor: ${d.assigned_to || '—'} | Valor: $${d.deal_value_usd || 0} | ${scoreStr} | Contacto: ${d.primary_contact || '—'} | Próxima acción: ${d.next_action || '—'} | Follow-up: ${d.next_followup_date || '—'}`;
    });
    crmContext += detailContext;
    crmContext += `\n=== FIN CRM DATA ===\n`;

    const systemPrompt = `Eres el Sales Manager AI de PulseVolt. Eres un estratega comercial especializado en ventas B2B de infraestructura energética (Battery Energy Storage Systems / BESS). Piensas como un top-tier sales operator.

## Proceso de venta PulseVolt (8 etapas)
1. Discovery Call — entender eventos de calidad de energía e impacto operativo
2. Propuesta Preliminar — presentar concepto, casos de uso y beneficios potenciales
3. Reunión con Producción — cuantificar pérdidas por paros, tiempos de recuperación
4. Reunión con Calidad — cuantificar scrap, retrabajos y costos asociados a eventos eléctricos
5. Reunión con Finanzas — validar costos, criterios de inversión e incentivos fiscales
6. Reunión Técnica / Pre-Ingeniería — revisar cargas críticas, histórico eléctrico, dimensionar solución
7. Desarrollo del Business Case — consolidar ahorros, ROI, payback, beneficios fiscales
8. Presentación Ejecutiva — presentar caso de negocio a Gerencia y Dirección para decisión

## Stages en el sistema
Para editar stage usa exactamente: "1 · Discovery Call", "2 · Propuesta Preliminar", "3 · Reunión con Producción", "4 · Reunión con Calidad", "5 · Reunión con Finanzas", "6 · Reunión Técnica / Pre-Ingeniería", "7 · Desarrollo del Business Case", "8 · Presentación Ejecutiva", "13 · Ganado", "0 · Perdido"

## Filosofía comercial
- NO vender producto → vender hipótesis de valor
- Cuantificar el dolor del cliente mejor que ellos mismos
- Extraer siempre: costo por paro, frecuencia, scrap, horas hombre, pérdida anual
- Sin dolor cuantificado = no empujar

## Deal Scoring (0-100%)
- Nivel de Contacto (15%): 1=solo técnico, 2=gerencial, 3=decision maker
- Etapa del Proceso (20%): 1=etapas 1-2, 2=etapas 3-6, 3=etapas 7-8
- Business Case (35%): 1=sin datos, 2=datos parciales, 3=validado con datos reales
- Tipo de Cliente (30%): 1=baja criticidad, 2=manufactura general, 3=auto/electrónica/pharma

## Reglas
- Responde en español, corto y directo. Sin filler.
- Tienes opiniones fuertes y las expresas.
- Acciones via comentarios HTML: <!-- ACTION: {"action":"edit_deal","deal_name":"NOMBRE","field":"stage","value":"2 · Propuesta Preliminar"} -->

## REGLA CRÍTICA: Eliminar deals requiere TRIPLE CONFIRMACIÓN
Nunca ejecutes delete_deal sin 3 confirmaciones explícitas del usuario.

${crmContext}`;

    const messages = [{ role: 'system', content: systemPrompt }];
    (history || []).slice(-20).forEach(m => { if (m.role && m.content) messages.push({ role: m.role, content: m.content }); });
    messages.push({ role: 'user', content: message });
    const aiData = await callAI({ model: AI_MODEL, messages, max_tokens: 1500, stream: false });
    const aiMessage = aiData.choices?.[0]?.message?.content || 'Error: no response from AI';
    res.status(200).json({ ok: true, message: aiMessage });
  } catch (e) { res.status(500).json({ ok: false, error: 'Chat error: ' + e.message }); }
};
