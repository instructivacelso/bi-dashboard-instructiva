// Leitura e validação do fechamento diário do RH (função pura, testável).
import { lerNumero } from './formato.js';
import { ErroValidacao, texto, opcao, data } from './leitores.js';
import { STATUS_FECHAMENTO_RH } from './rh.js';

const falha = (m) => { throw new ErroValidacao(m); };
const n0 = (fd, nome) => { const n = lerNumero(fd.get(nome)); if (n === null) return 0; if (!Number.isInteger(n) || n < 0) falha('Os números devem ser inteiros, zero ou mais.'); return n; };
const d0 = (fd, nome) => { const n = lerNumero(fd.get(nome)); if (n === null) return 0; if (n < 0) falha('As horas não podem ser negativas.'); return Math.round(n * 100) / 100; };
// "Houve X hoje?" — quando responde "nao", a seção fica sem ocorrência (zerada)
const semSecao = (fd, nome) => fd.get(nome) !== 'sim';

// ctx = { hoje, janelaDias, usuarios:Set }
export function lerFechamentoRh(fd, ctx) {
  const dataRef = data(fd, 'data_ref', 'Data do registro');
  const min = somar(ctx.hoje, -ctx.janelaDias);
  if (dataRef > ctx.hoje) falha('A data não pode ser no futuro.');
  if (dataRef < min) falha(`Só é possível registrar até ${ctx.janelaDias} dias atrás. Para datas mais antigas, fale com o gerente.`);

  const r = {
    data_ref: dataRef,
    unidade: String(fd.get('unidade') || '').trim().slice(0, 120) || null,
    status: opcao(fd, 'status', 'Status', Object.keys(STATUS_FECHAMENTO_RH)),
    justificativa_data: dataRef !== ctx.hoje ? texto(fd, 'justificativa_data', 'Justificativa do registro em outra data', 300) : null,
  };

  r.sem_movimentacao = semSecao(fd, 'mov_houve');
  const mov = ['admissoes', 'deslig_vol', 'deslig_invol', 'transferencias', 'promocoes', 'exp_inicio', 'exp_fim'];
  for (const k of mov) r[k] = r.sem_movimentacao ? 0 : n0(fd, k);

  r.sem_ponto = semSecao(fd, 'ponto_houve');
  const ponto = ['presentes', 'faltas_just', 'faltas_injust', 'atrasos', 'saidas_antec', 'pendencias_ponto'];
  for (const k of ponto) r[k] = r.sem_ponto ? 0 : n0(fd, k);
  r.horas_extras = r.sem_ponto ? 0 : d0(fd, 'horas_extras');

  r.sem_ocorrencias = semSecao(fd, 'ocorr_houve');
  for (const k of ['solicitacoes', 'solic_resolvidas', 'solic_pendentes', 'conflitos']) r[k] = r.sem_ocorrencias ? 0 : n0(fd, k);
  if (!r.sem_ocorrencias && r.solic_resolvidas > r.solicitacoes) falha('As solicitações resolvidas não podem passar do total recebido.');

  r.sem_recrutamento = semSecao(fd, 'recrut_houve');
  for (const k of ['vagas_abertas', 'candidatos', 'entrevistas', 'aprovados', 'propostas', 'contratacoes']) r[k] = r.sem_recrutamento ? 0 : n0(fd, k);

  r.sem_treinamentos = semSecao(fd, 'treino_houve');
  for (const k of ['integracoes', 'treinamentos', 'treino_participantes', 'treino_ausentes']) r[k] = r.sem_treinamentos ? 0 : n0(fd, k);

  // Riscos (opcional, mas se marcar "precisa da diretoria" exige plano)
  r.risco = String(fd.get('risco') || '').trim().slice(0, 400) || null;
  r.precisa_diretoria = fd.get('precisa_diretoria') === 'sim';
  r.plano = String(fd.get('plano') || '').trim().slice(0, 400) || null;
  if ((r.precisa_diretoria || r.risco) && !r.plano) falha('Descreva o plano de ação para o risco apontado.');
  if (r.plano) {
    r.prazo = data(fd, 'prazo', 'Prazo do plano');
    const resp = lerNumero(fd.get('responsavel_id'));
    r.responsavel_id = resp && ctx.usuarios.has(resp) ? resp : null;
  } else { r.prazo = null; r.responsavel_id = null; }
  r.observacao = String(fd.get('observacao') || '').trim().slice(0, 400) || null;
  return r;
}

function somar(iso, n) { const d = new Date(`${iso}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); }
