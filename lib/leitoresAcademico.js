// Leitura e validação do formulário diário do professor (função pura, testável).
import { lerNumero } from './formato.js';
import { ErroValidacao, texto, data } from './leitores.js';

const falha = (m) => { throw new ErroValidacao(m); };
const i0 = (fd, nome) => { const n = lerNumero(fd.get(nome)); if (n === null) return 0; if (!Number.isInteger(n) || n < 0) falha('Os números devem ser inteiros, zero ou mais.'); return n; };
const v0 = (fd, nome) => { const n = lerNumero(fd.get(nome)); if (n === null) return 0; if (n < 0) falha('Os valores não podem ser negativos.'); return Math.round(n * 100) / 100; };
const houve = (fd, nome) => fd.get(nome) === 'sim';

// ctx = { hoje, janelaDias }
export function lerDiarioProfessor(fd, ctx) {
  const dataRef = data(fd, 'data_ref', 'Data do registro');
  const min = somar(ctx.hoje, -ctx.janelaDias);
  if (dataRef > ctx.hoje) falha('A data não pode ser no futuro.');
  if (dataRef < min) falha(`Só é possível registrar até ${ctx.janelaDias} dias atrás. Para datas mais antigas, fale com a coordenação.`);
  const horas = v0(fd, 'horas');
  if (horas <= 0 || horas > 24) falha('Informe as horas trabalhadas no dia (entre 0 e 24).');

  const r = {
    data_ref: dataRef, horas,
    unidade: String(fd.get('unidade') || '').trim().slice(0, 120) || null,
    entrega_principal: texto(fd, 'entrega_principal', 'Principal entrega do dia', 300),
    dificuldade: String(fd.get('dificuldade') || '').trim().slice(0, 300) || null,
    prioridade: String(fd.get('prioridade') || '').trim().slice(0, 300) || null,
    observacao: String(fd.get('observacao') || '').trim().slice(0, 400) || null,
    atividades: [],
  };
  const bloco = (chave, campos, apos) => {
    if (houve(fd, `${chave}_houve`)) { r.atividades.push(chave); for (const [k, tipo] of campos) r[k] = tipo === 'v' ? v0(fd, k) : i0(fd, k); if (apos) apos(); }
    else for (const [k] of campos) r[k] = 0;
  };

  bloco('gravacao', [['grav_aulas', 'i'], ['grav_minutos', 'v'], ['grav_tempo', 'v'], ['grav_publicadas', 'i'], ['grav_regravadas', 'i']], () => {
    if (r.grav_regravadas > r.grav_aulas + r.grav_publicadas) falha('As regravações não podem passar do total de aulas.');
  });
  bloco('criativos', [['criativos_produzidos', 'i'], ['criativos_aprovados', 'i'], ['criativos_publicados', 'i'], ['criativos_refacao', 'i']], () => {
    if (r.criativos_aprovados > r.criativos_produzidos) falha('Criativos aprovados não podem passar dos produzidos.');
  });
  bloco('materiais', [['mat_paginas_novas', 'i'], ['mat_paginas_revisadas', 'i'], ['mat_exercicios', 'i'], ['mat_concluidos', 'i']]);
  bloco('suporte', [['sup_alunos', 'i'], ['sup_chamados', 'i'], ['sup_resolvidos', 'i'], ['sup_primeiro', 'i'], ['sup_pendentes', 'i']], () => {
    if (r.sup_resolvidos > r.sup_chamados) falha('Chamados resolvidos não podem passar dos recebidos.');
  });
  bloco('lives', [['live_realizadas', 'i'], ['live_inscritos', 'i'], ['live_presentes', 'i'], ['live_leads', 'i'], ['live_vendas', 'i'], ['live_receita', 'v']], () => {
    if (r.live_presentes > r.live_inscritos && r.live_inscritos > 0) falha('Presentes não podem passar dos inscritos.');
  });
  bloco('vendas', [['vnd_leads', 'i'], ['vnd_followups', 'i'], ['vnd_qtd', 'i'], ['vnd_valor', 'v'], ['vnd_pix', 'v'], ['vnd_cartao', 'v'], ['vnd_boleto', 'v']]);

  if (houve(fd, 'planejamento_houve')) { r.atividades.push('planejamento'); r.plan_reunioes = i0(fd, 'plan_reunioes'); r.plan_decisao = texto(fd, 'plan_decisao', 'Decisão ou próxima ação da reunião', 300); }
  else { r.plan_reunioes = 0; r.plan_decisao = null; }

  if (!r.atividades.length) falha('Marque pelo menos uma atividade realizada no dia.');
  r.justificativa_data = dataRef !== ctx.hoje ? texto(fd, 'justificativa_data', 'Justificativa do registro em outra data', 300) : null;
  return r;
}

function somar(iso, n) { const d = new Date(`${iso}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); }
