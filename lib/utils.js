const INDUSTRY_SCORE_3 = ['adient','advics','aptiv','avante','bombardier','borgwarner','bosch','copeland','danfoss','daystar','draxton','edscha','fresenius','gentherm','ghsp','harman','howmet','hwaseung','iac','kemet','leggett','littelfuse','mitsubishi','musashi','nasg','nemak','nexteer','nissan','nidec','op mobility','pirelli','polaris','ramos arizpe','regal','robert bosch','rockwell','ronal','safran','seohan','skf','universal scientific','vitesco','voss','vuteq'];
const INDUSTRY_SCORE_2 = ['baglass','celay','gepp','givaudan','glass','loreal','mabe','metalor','metrocolor','minghua','nova steel','o\'neal','oneal','papel','pentair','poligof','printea','printpack','reynera','ssi','steelcase','us pipe','vidriera'];

function classifyIndustry(name) {
  if (!name) return 1;
  const lower = name.toLowerCase();
  if (INDUSTRY_SCORE_3.some(k => lower.includes(k))) return 3;
  if (INDUSTRY_SCORE_2.some(k => lower.includes(k))) return 2;
  return 1;
}

function calcScoresFromDeal(deal) {
  let nc = 1;
  const cl = deal.contact_level || '';
  if (cl.includes('3')) nc = 3;
  else if (cl.includes('2')) nc = 2;
  let ep = 1;
  const stage = deal.stage || '';
  if (stage.includes('7') || stage.includes('9') || stage.includes('11') || stage.includes('13')) ep = 3;
  else if (stage.includes('2') || stage.includes('3') || stage.includes('5')) ep = 2;
  const pain = deal.pain_signals || '';
  if (pain.toLowerCase().includes('congelado') && ep > 1) ep -= 1;
  let bc = 1;
  const val = parseFloat(deal.deal_value_usd);
  if (val && val > 100) bc = 2;
  const tc = classifyIndustry(deal.deal_name);
  return { nivel_contacto: nc, etapa_proceso: ep, solidez_bc: bc, tipo_cliente: tc };
}

const DEAL_FIELD_MAP = {
  'deal_name':             'aa797617-3ac4-4469-af73-cb4233c2d689',
  'next_action':           '27f3cda3-4781-455b-98e6-574d29cf3efd',
  'next_followup_date':    '6e6aabca-f191-4aaa-b31e-6f4901f9bab0',
  'deal_value_usd':        'a765cc6c-37c5-4b3f-a4c7-d0ea98764a2c',
  'primary_contact':       'df0a52a4-5811-4c0f-8c24-edaaa8cfaa0d',
  'priority':              '9932a45b-568c-47e9-ad2f-0930b66fe973',
  'pain_signals':          '764d1c24-3d74-4199-a4ba-3c023cca5609',
  'nivel_contacto_score':  'a0a18c2d-706c-438b-8c19-8165f91f81bd',
  'etapa_proceso_score':   '982235fc-c40d-4757-87f2-f3d04226be6a',
  'solidez_bc_score':      '8062fa32-bc81-45fc-a774-d2e47e451b62',
  'tipo_cliente_score':    '9b560523-3178-4791-922a-2c90c13f0e1e',
  'assigned_to':           '1ef2318b-fe6f-407e-918c-2f8ad378a00f',
  'company':               'e0371d56-1c6d-482f-883a-926ce360a816',
  'close_date':            '7cf1377a-9cb4-476b-9d15-9e9f399ac227',
  'probability_pct':       '767e2d34-6614-430b-972e-7bc4fb0388bf',
  'stage_notes':           '8139fb5e-c12b-473f-b82b-fac03d8d66f9',
  'last_interaction_notes':'6ceafecf-2089-4e6c-920a-43dd490b4040',
  'initial_contact':       'dcde4211-4199-4965-959b-63a0811b16b4',
  'current_contact':       '8b07b33d-6585-4555-a4a7-ffb000d3ba57',
  'champion':              '985ca98f-e8bd-481d-a780-468d2cb2dca1',
  'decision_maker':        '597fcada-be99-4680-8dc7-68395a6aa917',
  'stakeholders':          'd8c08a68-9b9a-4d9f-a624-f5edc470db15',
};

const STAGE_STATUS_MAP = {
  '0 · Perdido':                           '6aea9045-09b0-4c6f-b644-fc29e9e85700',
  '1 · Discovery Call':                    '04ce746a-6f53-4c2d-abd4-28d0cd7faa48',
  '2 · Propuesta Inicial':                 '6d52c04c-00dc-4078-b363-1c2850c274be',
  '3 · Business Case — Dir. General':      'f254452a-95e6-4faf-8ec9-b15f7e41c212',
  '4 · Junta Técnica — Afinar Propuesta':  'd0a1fe0b-01a8-485b-b1cd-d587cead9a9a',
  '5 · Juntas Intermedias — Ops/Finanzas': '8278d2ee-b2e6-4468-adaf-95a359bafb0c',
  '6 · Junta Técnica — Propuesta Final':   'c6198929-736c-4307-8571-0b44bbdb8eb2',
  '7 · Business Case / Propuesta Final':   '3c6f7342-0206-4280-aa14-2589cd46e20b',
  '8 · Visita Técnica':                    '24abf462-ef5b-4d18-be03-24e433057a18',
  '9 · Cotización Final a Finanzas':       'e421e7fe-449a-4624-8d9a-ffbf467d8150',
  '10 · Contratos Enviados':               '9733e738-909a-4e2d-b40a-df755da58399',
  '11 · Cambios en Contrato':              '82af64d0-c599-421b-97f6-81d337e612aa',
  '12 · Alta de Proveedor':                '2d41368f-2bdf-4491-9fdd-af941d979029',
  '13 · Ganado':                           'bc5d4d43-77dd-4211-a6b6-041895e497b0',
};

const STAGE_FIELD_ID = 'f5d3458d-fbae-4dc2-a4ae-5fd6289f9e0e';
const DEALS_OBJECT_ID = 'e9f17fa1-bdd2-4bcc-9798-458ae301ec2c';

function readBody(req) {
  return new Promise((resolve, reject) => {
    if (req.body !== undefined) {
      resolve(typeof req.body === 'string' ? req.body : JSON.stringify(req.body));
      return;
    }
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => resolve(body));
    req.on('error', reject);
  });
}

module.exports = {
  INDUSTRY_SCORE_3, INDUSTRY_SCORE_2, classifyIndustry, calcScoresFromDeal,
  DEAL_FIELD_MAP, STAGE_STATUS_MAP, STAGE_FIELD_ID, DEALS_OBJECT_ID, readBody,
};
