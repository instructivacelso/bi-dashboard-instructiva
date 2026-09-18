// Leitura e validação dos formulários do Marketing (funções puras, testáveis).
// fd: objeto com get(nome) e getAll(nome), como FormData.
// Cada formulário tem 10 campos obrigatórios (sem contar data, usuário, setor e os condicionais).
// Condicionais, quando aparecem, também são obrigatórios.

import { lerNumero } from './formato.js';
import {
  ETAPAS_AUTOMACAO_ROTULOS, ETAPAS_MONITORADAS, PLATAFORMAS_TRAFEGO, PLATAFORMAS_LIVE, TIPOS_ENTREGA,
  SITUACAO_EDITOR, PRIORIDADE_EDITOR, PRIORIDADES, SEMAFORO_OPCOES, GARGALOS,
} from './formularios.js';

export class ErroValidacao extends Error {}
const falha = (m) => { throw new ErroValidacao(m); };

export const texto = (fd, nome, rotulo, max = 400) => {
  const v = String(fd.get(nome) ?? '').trim();
  if (!v) falha(`Preencha: ${rotulo}.`);
  if (v.length > max) falha(`${rotulo}: use no máximo ${max} caracteres.`);
  return v;
};
export const inteiro = (fd, nome, rotulo) => {
  const bruto = fd.get(nome);
  if (bruto === null || bruto === undefined || String(bruto).trim() === '') falha(`Preencha: ${rotulo}. Se não houve, informe 0.`);
  const n = lerNumero(bruto);
  if (n === null || !Number.isInteger(n) || n < 0) falha(`${rotulo} precisa ser um número inteiro, zero ou maior.`);
  return n;
};
export const decimal = (fd, nome, rotulo) => {
  const bruto = fd.get(nome);
  if (bruto === null || bruto === undefined || String(bruto).trim() === '') falha(`Preencha: ${rotulo}. Se não houve, informe 0.`);
  const n = lerNumero(bruto);
  if (n === null || n < 0) falha(`${rotulo} precisa ser um valor zero ou maior.`);
  return Math.round(n * 100) / 100;
};
export const opcao = (fd, nome, rotulo, opcoes) => {
  const v = String(fd.get(nome) || '');
  if (!opcoes.includes(v)) falha(`Escolha: ${rotulo}.`);
  return v;
};
export const simNao = (fd, nome, rotulo) => opcao(fd, nome, rotulo, ['sim', 'nao']) === 'sim';
export const data = (fd, nome, rotulo) => {
  const v = String(fd.get(nome) || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) falha(`Preencha: ${rotulo}.`);
  return v;
};
export const hora = (fd, nome, rotulo) => {
  const v = String(fd.get(nome) || '').trim();
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(v)) falha(`Preencha: ${rotulo} (formato 00:00).`);
  return v;
};

// ---------- Tráfego: uma linha por plataforma ----------
export function lerTrafego(fd) {
  const plataformas = fd.getAll('plataforma').map(String);
  if (!plataformas.length) falha('Nenhuma plataforma atribuída a você neste lançamento.');
  const vistas = new Set();
  return plataformas.map((pl, i) => {
    if (!PLATAFORMAS_TRAFEGO.includes(pl)) falha('Plataforma inválida.');
    if (vistas.has(pl)) falha(`A plataforma ${pl} apareceu duas vezes.`);
    vistas.add(pl);
    const p = (c) => `p${i}_${c}`;
    const r = {
      plataforma: pl,
      orcamento_dia: decimal(fd, p('orcamento_dia'), `${pl}: orçamento previsto para o dia`),
      valor_gasto: decimal(fd, p('valor_gasto'), `${pl}: valor gasto no dia`),
      impressoes: inteiro(fd, p('impressoes'), `${pl}: impressões`),
      cliques: inteiro(fd, p('cliques'), `${pl}: cliques no link`),
      visitas: inteiro(fd, p('visitas'), `${pl}: visitas na página`),
      cadastros: inteiro(fd, p('cadastros'), `${pl}: cadastros concluídos`),
      tempo_carregamento: decimal(fd, p('tempo_carregamento'), `${pl}: tempo médio de carregamento`),
      houve_problema: simNao(fd, p('houve_problema'), `${pl}: houve algum problema?`),
    };
    if (r.cliques > r.impressoes) falha(`${pl}: os cliques não podem ser maiores que as impressões.`);
    r.problema_descricao = r.houve_problema ? texto(fd, p('problema_descricao'), `${pl}: descrição do problema`, 300) : null;
    r.problema_acao = r.houve_problema ? texto(fd, p('problema_acao'), `${pl}: ação que está sendo realizada`, 300) : null;
    return r;
  });
}

// ---------- WhatsApp, API e orgânico ----------
export function lerWhatsapp(fd) {
  const r = {
    grupos_ativos: inteiro(fd, 'grupos_ativos', 'Grupos ativos do lançamento'),
    convites_api: inteiro(fd, 'convites_api', 'Convites enviados via API'),
    convites_entregues: inteiro(fd, 'convites_entregues', 'Convites entregues via API'),
    entradas_api: inteiro(fd, 'entradas_api', 'Entraram por API'),
    entradas_pagina: inteiro(fd, 'entradas_pagina', 'Entraram pelo link da página de captação'),
    entradas_organico: inteiro(fd, 'entradas_organico', 'Entraram pelo orgânico'),
    saidas: inteiro(fd, 'saidas', 'Saíram dos grupos'),
    total_grupos: inteiro(fd, 'total_grupos', 'Total atual nos grupos'),
    custo_disparos: decimal(fd, 'custo_disparos', 'Valor gasto com disparos'),
    houve_problema: fd.get('houve_problema') === 'sim',
  };
  if (r.convites_entregues > r.convites_api) falha('Convites entregues não podem ser mais que os enviados.');
  r.problema_descricao = r.houve_problema ? texto(fd, 'problema_descricao', 'Descrição do problema', 300) : null;
  r.problema_acao = r.houve_problema ? texto(fd, 'problema_acao', 'Ação realizada ou necessária', 300) : null;
  return r;
}

// ---------- Automação e onboarding ----------
export function lerAutomacao(fd) {
  const r = {};
  for (const e of ETAPAS_MONITORADAS) r[e.campo] = opcao(fd, e.campo, e.rotulo, ['ok', 'falha']) === 'ok';
  const falhas = ETAPAS_MONITORADAS.filter((e) => !r[e.campo]).length;
  r.houve_problema = falhas > 0;
  // Colunas antigas mantidas coerentes
  r.captacao_ok = r.pagina_ok && r.formulario_ok && r.whatsapp_ok;
  r.onboarding_ok = r.boas_vindas_ok && r.conta_ok && r.grupo_ok && r.orientacao_ok;
  let incidente = null;
  if (r.houve_problema) {
    incidente = {
      etapa: opcao(fd, 'etapa', 'Etapa afetada', Object.keys(ETAPAS_AUTOMACAO_ROTULOS)),
      afetados: inteiro(fd, 'afetados', 'Quantidade estimada de pessoas afetadas'),
      descricao: texto(fd, 'incidente_descricao', 'Descrição curta do problema'),
      prioridade: opcao(fd, 'prioridade', 'Prioridade', Object.keys(PRIORIDADES)),
      previsao_solucao: data(fd, 'previsao_solucao', 'Previsão de solução'),
    };
  }
  return { dados: r, incidente };
}

// ---------- Editor de vídeos e criativos ----------
export function lerEditor(fd) {
  const r = {
    tipo_entrega: opcao(fd, 'tipo_entrega', 'Tipo de entrega', Object.keys(TIPOS_ENTREGA)),
    titulo: texto(fd, 'titulo', 'Nome ou título da entrega', 200),
    solicitante: texto(fd, 'solicitante', 'Solicitante da entrega', 120),
    prioridade: opcao(fd, 'prioridade', 'Prioridade', Object.keys(PRIORIDADE_EDITOR)),
    quantidade_planejada: inteiro(fd, 'quantidade_planejada', 'Quantidade planejada'),
    quantidade: inteiro(fd, 'quantidade', 'Quantidade concluída no dia'),
    situacao: opcao(fd, 'situacao', 'Status', Object.keys(SITUACAO_EDITOR)),
    prazo: data(fd, 'prazo', 'Prazo previsto de entrega'),
    entrega: texto(fd, 'entrega', 'Link da entrega ou da pasta do projeto', 500),
  };
  r.motivo_atraso = r.situacao === 'atrasado' ? texto(fd, 'motivo_atraso', 'Motivo do atraso', 300) : null;
  return r;
}

// ---------- Resultado da live ----------
export function lerLive(fd) {
  const r = {
    plataforma: opcao(fd, 'plataforma', 'Plataforma da live', Object.keys(PLATAFORMAS_LIVE)),
    horario_previsto: hora(fd, 'horario_previsto', 'Horário previsto de início'),
    horario_real: hora(fd, 'horario_real', 'Horário real de início'),
    participantes_unicos: inteiro(fd, 'participantes_unicos', 'Pessoas únicas que participaram'),
    pessoas_pitch: inteiro(fd, 'pessoas_pitch', 'Pessoas presentes no pitch'),
    cliques_oferta: inteiro(fd, 'cliques_oferta', 'Cliques no link da oferta'),
    lista_reserva: inteiro(fd, 'lista_reserva', 'Pessoas na lista de reserva'),
    checkouts_iniciados: inteiro(fd, 'checkouts_iniciados', 'Checkouts iniciados'),
    problema_tecnico: simNao(fd, 'problema_tecnico', 'Houve problema técnico?'),
  };
  if (r.pessoas_pitch > r.participantes_unicos) falha('Pessoas no pitch não podem ser mais que os participantes únicos.');
  r.observacao = r.problema_tecnico ? texto(fd, 'observacao', 'Descrição do problema técnico', 300) : null;
  return r;
}

// ---------- Fechamento do gerente ----------
// ctx = { userId, hoje }. "rapido" = confirmação de operação dentro do esperado (tudo verde).
export function lerGerente(fd, ctx) {
  const cores = Object.keys(SEMAFORO_OPCOES);
  if (fd.get('rapido') === 'sim') {
    return {
      situacao: 'verde', sit_trafego: 'verde', sit_pagina: 'verde', sit_grupos: 'verde', sit_automacao: 'verde',
      gargalo: 'nenhum', acao: 'Operação dentro do esperado', responsavel_id: ctx.userId, prazo: ctx.hoje,
    };
  }
  const r = {
    situacao: opcao(fd, 'situacao', 'Situação do dia', cores),
    sit_trafego: opcao(fd, 'sit_trafego', 'Situação do tráfego', cores),
    sit_pagina: opcao(fd, 'sit_pagina', 'Situação da página e captação', cores),
    sit_grupos: opcao(fd, 'sit_grupos', 'Situação dos grupos e WhatsApp', cores),
    sit_automacao: opcao(fd, 'sit_automacao', 'Situação das automações e onboarding', cores),
    gargalo: opcao(fd, 'gargalo', 'Principal gargalo', Object.keys(GARGALOS)),
    acao: texto(fd, 'acao', 'Ação que será tomada', 300),
    prazo: data(fd, 'prazo', 'Prazo da ação'),
  };
  const resp = lerNumero(fd.get('responsavel_id'));
  if (!resp) falha('Escolha o responsável pela ação.');
  r.responsavel_id = resp;
  return r;
}

export const LEITORES = { trafego: lerTrafego, whatsapp: lerWhatsapp, automacao: lerAutomacao, editor: lerEditor, live: lerLive, gerente: lerGerente };
