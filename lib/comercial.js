// Regras do módulo Comercial (funções puras, testáveis)
import { dividir } from './calc.js';

export const CIDADES = { 'comercial-jesuitas': 'Jesuítas', 'comercial-toledo': 'Toledo' };
export const FUNIS = { lancamento: 'Lançamento', formulario: 'Formulário', indicacao: 'Indicação', outbound: 'Outbound' };
export const OPERACOES = { inbound: 'Inbound', outbound: 'Outbound', lancamento: 'Lançamento', formulario: 'Formulário', indicacao: 'Indicação' };
export const PAGAMENTOS = { cartao: 'Cartão', pix: 'PIX', boleto: 'Boleto' };
export const STATUS_VENDA = { aprovada: 'Aprovada', boleto_gerado: 'Boleto gerado', aguardando: 'Aguardando pagamento', pago: 'Pago', cancelada: 'Cancelada' };
export const STATUS_VENDA_INICIAL = ['aprovada', 'boleto_gerado', 'aguardando'];
export const MOTIVOS_SEM_VENDA = {
  poucos_leads: 'Poucos leads', leads_frios: 'Leads frios ou fora do perfil', preco: 'Preço', sem_resposta: 'Leads não responderam',
  vai_pensar: 'Cliente vai pensar', pagamento: 'Condição de pagamento', concorrencia: 'Concorrência', outro: 'Outro',
};
export const DIFICULDADES = {
  sem_dificuldade: 'Sem dificuldade relevante', preco: 'Preço', tempo: 'Falta de tempo do cliente', confianca: 'Falta de confiança',
  sem_resposta: 'Leads não respondem', pagamento: 'Condição de pagamento', produto: 'Dúvida sobre o curso', concorrencia: 'Concorrência', outro: 'Outro',
};
export const CLASSIFICACAO_CONVERSAO = { acima: 'Acima da meta', dentro: 'Dentro da meta', abaixo: 'Abaixo da meta', critica: 'Crítica' };
export const TEMAS_REUNIAO = {
  meta: 'Meta do dia', pipeline: 'Pipeline', followup: 'Follow-up', objecoes: 'Objeções', produto: 'Produto', funil: 'Funil',
  motivacao: 'Motivação', processos: 'Processos', treinamento: 'Treinamento', outro: 'Outro',
};
export const TIPOS_MOTIVACAO = {
  reconhecimento: 'Reconhecimento', premiacao: 'Premiação', dinamica: 'Dinâmica rápida', treinamento: 'Treinamento', roleplay: 'Role-play',
  escuta: 'Escuta de ligação', caso_sucesso: 'Caso de sucesso', alinhamento: 'Alinhamento individual', outro: 'Outro',
};
export const TIPOS_FEEDBACK = { reconhecimento: 'Reconhecimento', correcao: 'Correção', desenvolvimento: 'Desenvolvimento', alinhamento: 'Alinhamento' };
export const GARGALOS_COMERCIAL = {
  falta_leads: 'Falta de leads', qualidade_leads: 'Baixa qualidade dos leads', primeiro_contato: 'Demora no primeiro contato',
  poucas_ligacoes: 'Baixo volume de ligações', followup: 'Falta de follow-up', agendamentos: 'Poucos agendamentos', conversao: 'Baixa conversão',
  preco: 'Preço', pagamento: 'Condição de pagamento', oferta: 'Produto ou oferta', argumentacao: 'Argumentação', processo: 'Processo',
  crm: 'Sistema ou CRM', whatsapp: 'WhatsApp/API', checkout: 'Checkout', outro: 'Outro',
};
export const ETAPAS_FUNIL = { lead: 'Chegada do lead', contato: 'Primeiro contato', negociacao: 'Negociação', fechamento: 'Fechamento', pagamento: 'Pagamento' };
export const PRIORIDADES = { baixa: 'Baixa', media: 'Média', alta: 'Alta', critica: 'Crítica' };

// ---------- Permissões por cidade ----------
// Retorna os slugs das cidades que o usuário pode ver no Comercial.
export function cidadesVisiveis(u) {
  if (!u) return [];
  if (['superadmin', 'diretoria'].includes(u.papel)) return Object.keys(CIDADES);
  if (u.lotacoes.some((l) => l.setor === 'comercial-diretoria')) return Object.keys(CIDADES);
  return [...new Set(u.lotacoes.filter((l) => CIDADES[l.setor] && l.gerente).map((l) => l.setor))];
}
export const veDashboardComercial = (u) => cidadesVisiveis(u).length > 0 || cidadeDoVendedor(u) !== null;
export const ehDiretorComercial = (u) => ['superadmin', 'diretoria'].includes(u?.papel) || !!u?.lotacoes.some((l) => l.setor === 'comercial-diretoria');

// Cidade do vendedor vem do cadastro (não é escolhida no formulário)
export function cidadeDoVendedor(u) {
  const l = u?.lotacoes?.find((x) => CIDADES[x.setor] && x.formulario === 'vendedor');
  return l ? l.setor : null;
}
export function cidadeDoGerente(u) {
  const l = u?.lotacoes?.find((x) => CIDADES[x.setor] && x.formulario === 'gerente_comercial');
  return l ? l.setor : null;
}

// ---------- Cálculos ----------
export function totaisVendas(vendas) {
  const t = { qtd: 0, total: 0, cartao: 0, pix: 0, boleto: 0, qtdCartao: 0, qtdPix: 0, qtdBoleto: 0, aprovado: 0, recebido: 0 };
  for (const v of vendas) {
    if (v.status === 'cancelada') continue;
    const valor = Number(v.valor) || 0;
    t.qtd++; t.total += valor;
    if (v.forma_pagamento === 'cartao') { t.cartao += valor; t.qtdCartao++; }
    if (v.forma_pagamento === 'pix') { t.pix += valor; t.qtdPix++; }
    if (v.forma_pagamento === 'boleto') { t.boleto += valor; t.qtdBoleto++; }
    if (['aprovada', 'pago'].includes(v.status)) t.aprovado += valor;
    // Boleto só vira receita recebida quando pago; cartão/PIX aprovados contam como recebidos
    if (v.status === 'pago' || (v.status === 'aprovada' && v.forma_pagamento !== 'boleto')) t.recebido += valor;
  }
  t.ticketMedio = dividir(t.total, t.qtd);
  t.pctCartao = dividir(t.cartao, t.total);
  t.pctPix = dividir(t.pix, t.total);
  t.pctBoleto = dividir(t.boleto, t.total);
  return t;
}

export function indicadoresVendedor(f, vendas, metas = {}) {
  const tv = totaisVendas(vendas);
  return {
    ...tv,
    conversao: dividir(tv.qtd, f.leads_recebidos),
    pipelineMedio: dividir(f.pipeline_valor, f.pipeline_qtd),
    ticketNegociacao: dividir(f.negociacao_valor, f.negociacao_qtd),
    ticketFechamento: dividir(f.fechamento_valor, f.fechamento_qtd),
    produtividade: (Number(f.ligacoes) || 0) + (Number(f.followups) || 0),
    metaDiaria: dividir(tv.total, metas.meta_diaria),
    coberturaMeta: dividir(f.pipeline_valor, metas.meta_mensal),
  };
}

// Regras da pipeline: devolve a lista de inconsistências que exigem justificativa
export function inconsistenciasPipeline(f, anterior, vendasHoje = 0) {
  const r = [];
  if (Number(f.fechamento_qtd) > Number(f.negociacao_qtd)) r.push('Há mais leads em fechamento do que em negociação.');
  if (Number(f.fechamento_valor) > Number(f.pipeline_valor)) r.push('O valor em fechamento é maior que o valor total da pipeline.');
  if (Number(f.negociacao_valor) > Number(f.pipeline_valor)) r.push('O valor em negociação é maior que o valor total da pipeline.');
  if (anterior && Number(anterior.pipeline_valor) > 0) {
    const queda = (Number(anterior.pipeline_valor) - Number(f.pipeline_valor)) / Number(anterior.pipeline_valor);
    if (queda >= 0.5 && Number(vendasHoje) < (Number(anterior.pipeline_valor) - Number(f.pipeline_valor)) * 0.5) {
      r.push('A pipeline caiu mais da metade em relação ao dia anterior sem vendas que expliquem a queda.');
    }
  }
  return r;
}

// Pontualidade: comparado ao horário-limite (HH:MM) no fuso de Brasília
export function pontualidade(agora, limite = '19:00') {
  const hm = new Intl.DateTimeFormat('en-GB', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit', hour12: false }).format(agora);
  return hm <= limite ? 'no_prazo' : 'atrasado';
}

// Dias úteis (seg-sex) entre duas datas ISO, inclusive
export function diasUteis(desde, ate) {
  let n = 0;
  for (let d = new Date(`${desde}T12:00:00Z`); d <= new Date(`${ate}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + 1)) {
    const w = d.getUTCDay();
    if (w !== 0 && w !== 6) n++;
  }
  return n;
}

// Projeção do mês = média por dia útil decorrido × dias úteis do mês
export function projecaoMensal(faturadoMes, hojeISO) {
  const inicio = `${hojeISO.slice(0, 8)}01`;
  const d = new Date(`${inicio}T12:00:00Z`); d.setUTCMonth(d.getUTCMonth() + 1); d.setUTCDate(0);
  const fim = d.toISOString().slice(0, 10);
  const decorridos = diasUteis(inicio, hojeISO);
  const total = diasUteis(inicio, fim);
  return decorridos ? (faturadoMes / decorridos) * total : null;
}

// Ranking equilibrado: não olha só faturamento.
// Pesos: % da meta 35%, conversão 25%, atividade 20%, pipeline em fechamento 20% (cada um normalizado pelo maior do time)
export function rankingEquilibrado(linhas) {
  const max = (k) => Math.max(...linhas.map((l) => Number(l[k]) || 0), 0);
  const mMeta = max('pctMeta'), mConv = max('conversao'), mAtiv = max('atividade'), mFech = max('fechamento_valor');
  const n = (v, m) => (m > 0 ? (Number(v) || 0) / m : 0);
  return linhas
    .map((l) => ({ ...l, pontuacao: 0.35 * n(l.pctMeta, mMeta) + 0.25 * n(l.conversao, mConv) + 0.2 * n(l.atividade, mAtiv) + 0.2 * n(l.fechamento_valor, mFech) }))
    .sort((a, b) => b.pontuacao - a.pontuacao);
}
