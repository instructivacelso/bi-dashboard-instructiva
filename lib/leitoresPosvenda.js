// Leitura e validação do fechamento diário do pós-venda (função pura, testável).
import { lerNumero } from './formato.js';
import { ErroValidacao, texto, opcao, data } from './leitores.js';
import { STATUS_FECHAMENTO_PV } from './posvenda.js';

const falha = (m) => { throw new ErroValidacao(m); };
const n0 = (fd, nome) => { const n = lerNumero(fd.get(nome)); if (n === null) return 0; if (!Number.isInteger(n) || n < 0) falha('Os números devem ser inteiros, zero ou mais.'); return n; };
const v0 = (fd, nome) => { const n = lerNumero(fd.get(nome)); if (n === null) return 0; if (n < 0) falha('Os valores não podem ser negativos.'); return Math.round(n * 100) / 100; };
const semSecao = (fd, nome) => fd.get(nome) !== 'sim';

// ctx = { hoje, janelaDias }
export function lerFechamentoPosvenda(fd, ctx) {
  const dataRef = data(fd, 'data_ref', 'Data do registro');
  const min = somar(ctx.hoje, -ctx.janelaDias);
  if (dataRef > ctx.hoje) falha('A data não pode ser no futuro.');
  if (dataRef < min) falha(`Só é possível registrar até ${ctx.janelaDias} dias atrás. Para datas mais antigas, fale com o gerente.`);

  const r = {
    data_ref: dataRef,
    unidade: String(fd.get('unidade') || '').trim().slice(0, 120) || null,
    status: opcao(fd, 'status', 'Status', Object.keys(STATUS_FECHAMENTO_PV)),
    justificativa_data: dataRef !== ctx.hoje ? texto(fd, 'justificativa_data', 'Justificativa do registro em outra data', 300) : null,
  };

  r.sem_onboarding = semSecao(fd, 'onb_houve');
  for (const k of ['novos_alunos', 'onboarding_concluidos']) r[k] = r.sem_onboarding ? 0 : n0(fd, k);
  if (!r.sem_onboarding && r.onboarding_concluidos > r.novos_alunos) falha('Onboardings concluídos não podem passar dos novos alunos.');

  r.sem_acompanhamento = semSecao(fd, 'acomp_houve');
  for (const k of ['contatos', 'alunos_risco']) r[k] = r.sem_acompanhamento ? 0 : n0(fd, k);

  r.sem_renovacoes = semSecao(fd, 'renov_houve');
  r.renov_vencendo = r.sem_renovacoes ? 0 : n0(fd, 'renov_vencendo');
  r.renov_feitas = r.sem_renovacoes ? 0 : n0(fd, 'renov_feitas');
  r.renov_valor = r.sem_renovacoes ? 0 : v0(fd, 'renov_valor');
  if (!r.sem_renovacoes && r.renov_vencendo > 0 && r.renov_feitas > r.renov_vencendo) falha('As renovações feitas não podem passar das que estavam vencendo.');

  r.sem_cancelamentos = semSecao(fd, 'cancel_houve');
  r.cancelamentos = r.sem_cancelamentos ? 0 : n0(fd, 'cancelamentos');
  r.cancel_motivo = !r.sem_cancelamentos && r.cancelamentos > 0 ? texto(fd, 'cancel_motivo', 'Principal motivo de cancelamento', 200) : null;

  r.sem_upsell = semSecao(fd, 'upsell_houve');
  r.upsell_ofertas = r.sem_upsell ? 0 : n0(fd, 'upsell_ofertas');
  r.upsell_vendas = r.sem_upsell ? 0 : n0(fd, 'upsell_vendas');
  r.upsell_valor = r.sem_upsell ? 0 : v0(fd, 'upsell_valor');
  if (!r.sem_upsell && r.upsell_vendas > r.upsell_ofertas && r.upsell_ofertas > 0) falha('As vendas de upsell não podem passar das ofertas.');

  r.sem_satisfacao = semSecao(fd, 'nps_houve');
  for (const k of ['nps_respostas', 'nps_promotores', 'nps_neutros', 'nps_detratores']) r[k] = r.sem_satisfacao ? 0 : n0(fd, k);
  if (!r.sem_satisfacao && r.nps_promotores + r.nps_neutros + r.nps_detratores > r.nps_respostas) falha('A soma de promotores, neutros e detratores não pode passar do total de respostas.');

  r.sem_inadimplencia = semSecao(fd, 'inad_houve');
  r.inad_alunos = r.sem_inadimplencia ? 0 : n0(fd, 'inad_alunos');
  r.inad_valor = r.sem_inadimplencia ? 0 : v0(fd, 'inad_valor');

  r.risco = String(fd.get('risco') || '').trim().slice(0, 400) || null;
  r.plano = String(fd.get('plano') || '').trim().slice(0, 400) || null;
  if (r.risco && !r.plano) falha('Descreva o plano de ação para o risco apontado.');
  r.prazo = r.plano ? data(fd, 'prazo', 'Prazo do plano') : null;
  r.observacao = String(fd.get('observacao') || '').trim().slice(0, 400) || null;
  return r;
}

function somar(iso, n) { const d = new Date(`${iso}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); }
