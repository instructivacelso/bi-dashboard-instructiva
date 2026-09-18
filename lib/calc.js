// Cálculos do Marketing. Todas as funções tratam ausência de dados e divisão por zero,
// devolvendo null (a interface mostra "sem dados").

export function dividir(a, b) {
  if (a === null || a === undefined || b === null || b === undefined) return null;
  const na = Number(a), nb = Number(b);
  if (!Number.isFinite(na) || !Number.isFinite(nb) || nb === 0) return null;
  return na / nb;
}

export function soma(lista, campo) {
  return lista.reduce((t, r) => t + (Number(r[campo]) || 0), 0);
}

// Quebra = 1 - taxa (null se a taxa não existe)
export const quebra = (taxa) => (taxa === null || taxa === undefined ? null : 1 - taxa);

// Variação percentual em relação ao dia anterior
export function variacao(atual, anterior) {
  if (atual === null || atual === undefined || anterior === null || anterior === undefined) return null;
  return dividir(Number(atual) - Number(anterior), anterior);
}

// Indicadores de tráfego. entradasPagina vem do formulário de WhatsApp (mesmo lançamento e data)
export function calcTrafego({ valor_gasto, impressoes, cliques, visitas, cadastros, orcamento_dia }, entradasPagina = null) {
  const carregamento = dividir(visitas, cliques);
  const convPagina = dividir(cadastros, visitas);
  const cadGrupo = entradasPagina === null ? null : dividir(entradasPagina, cadastros);
  const paginaGrupo = entradasPagina === null ? null : dividir(entradasPagina, visitas);
  return {
    ctr: dividir(cliques, impressoes),
    cpc: dividir(valor_gasto, cliques),
    cpl: dividir(valor_gasto, cadastros),
    custoVisita: dividir(valor_gasto, visitas),
    conversaoPagina: convPagina,
    taxaCarregamento: carregamento,
    quebraCliquePagina: quebra(carregamento),
    quebraPaginaCadastro: quebra(convPagina),
    conversaoCadastroGrupo: cadGrupo,
    quebraCadastroGrupo: quebra(cadGrupo),
    conversaoPaginaGrupo: paginaGrupo,
    quebraPaginaGrupo: quebra(paginaGrupo),
    usoOrcamento: dividir(valor_gasto, orcamento_dia),
    diferencaOrcamento: orcamento_dia === null || orcamento_dia === undefined || valor_gasto === null || valor_gasto === undefined ? null : Number(orcamento_dia) - Number(valor_gasto),
  };
}

// Indicadores de um registro de WhatsApp. totalAnterior = total nos grupos no registro anterior
export function calcWhatsapp({ convites_api, convites_entregues, entradas_api, entradas_pagina, entradas_organico, saidas, total_grupos, custo_disparos }, totalAnterior = null) {
  const entradas = (Number(entradas_api) || 0) + (Number(entradas_pagina) || 0) + (Number(entradas_organico) || 0);
  return {
    entradasTotais: entradas,
    taxaEntrega: dividir(convites_entregues, convites_api),
    conversaoConvites: dividir(entradas_api, convites_api),
    custoPorEntradaApi: custo_disparos ? dividir(custo_disparos, entradas_api) : null,
    saldo: entradas - (Number(saidas) || 0),
    taxaSaida: total_grupos === null || total_grupos === undefined ? null : dividir(saidas, Number(total_grupos) + (Number(saidas) || 0)),
    crescimento: totalAnterior === null || totalAnterior === undefined || total_grupos === null || total_grupos === undefined ? null : Number(total_grupos) - Number(totalAnterior),
  };
}

// Indicadores da live. cadastrados = cadastros acumulados do lançamento
export function calcLive({ participantes_unicos, pessoas_pitch, cliques_oferta, lista_reserva, checkouts_iniciados }, cadastrados = null) {
  return {
    presenca: cadastrados === null ? null : dividir(participantes_unicos, cadastrados),
    retencaoPitch: dividir(pessoas_pitch, participantes_unicos),
    taxaClique: dividir(cliques_oferta, pessoas_pitch),
    conversaoLista: dividir(lista_reserva, participantes_unicos),
    conversaoPitchLista: dividir(lista_reserva, pessoas_pitch),
    conversaoCheckout: dividir(checkouts_iniciados, participantes_unicos),
  };
}

// Saúde da automação = etapas funcionando ÷ 9 etapas monitoradas
export const ETAPAS_TOTAL = 9;
export function saudeAutomacao(registro, campos) {
  if (!registro) return null;
  const vistos = campos.filter((c) => registro[c] !== null && registro[c] !== undefined);
  if (!vistos.length) return null;
  return vistos.filter((c) => registro[c] === true).length / ETAPAS_TOTAL;
}

// t = totais acumulados do período
export function indicadoresMarketing(t) {
  const carregamento = dividir(t.visitas, t.cliques);
  const convPagina = dividir(t.cadastros, t.visitas);
  const cadGrupo = dividir(t.entradasPagina, t.cadastros);
  const pagGrupo = dividir(t.entradasPagina, t.visitas);
  return {
    ctr: dividir(t.cliques, t.impressoes),
    cpc: dividir(t.investimento, t.cliques),
    cpl: dividir(t.investimento, t.cadastros),
    custoVisita: dividir(t.investimento, t.visitas),
    conversaoPagina: convPagina,
    taxaCarregamento: carregamento,
    quebraCliquePagina: quebra(carregamento),
    quebraPaginaCadastro: quebra(convPagina),
    conversaoCadastroGrupo: cadGrupo,
    quebraCadastroGrupo: quebra(cadGrupo),
    conversaoPaginaGrupo: pagGrupo,
    quebraPaginaGrupo: quebra(pagGrupo),
    taxaEntrega: dividir(t.convitesEntregues, t.convites),
    conversaoApi: dividir(t.entradasApi, t.convites),
    entradaWhatsapp: dividir(t.grupos, t.cadastros),
    comparecimentoLive: dividir(t.live, t.grupos),
    retencaoPitch: dividir(t.pitch, t.live),
    conversaoLista: dividir(t.lista, t.live),
    conversaoPitchLista: dividir(t.lista, t.pitch),
    conversaoCheckout: dividir(t.checkouts, t.live),
    conversaoVendas: dividir(t.vendas, t.lista),
    conversaoGeral: dividir(t.vendas, t.cadastros),
    cac: dividir(t.investimento, t.vendas),
    roas: dividir(t.faturamento, t.investimento),
    usoOrcamento: dividir(t.investimento, t.orcamentoPrevisto),
    conclusaoEntregas: dividir(t.entregasConcluidas, t.entregasPlanejadas),
    naoEntraramWhatsapp: t.cadastros != null && t.grupos != null ? Math.max(t.cadastros - t.grupos, 0) : null,
  };
}

// Semáforo. sentido "maior": quanto maior melhor (cadastros, ROAS).
// sentido "menor": quanto menor melhor (CPL, CAC).
export function semaforo(valor, meta, sentido = 'maior') {
  if (valor === null || valor === undefined || !meta) return 'neutro';
  if (sentido === 'maior') {
    const r = valor / meta;
    return r >= 1 ? 'verde' : r >= 0.8 ? 'amarelo' : 'vermelho';
  }
  const r = valor / meta;
  return r <= 1 ? 'verde' : r <= 1.2 ? 'amarelo' : 'vermelho';
}

// Etapas do funil. metas = { cadastros, grupos, live, lista, vendas, faturamento } (somadas dos lançamentos filtrados)
export function montarFunil(t, metas = {}) {
  const etapas = [
    { chave: 'visitas', nome: 'Visitas na página', valor: t.visitas },
    { chave: 'cadastros', nome: 'Cadastros', valor: t.cadastros, meta: metas.cadastros },
    { chave: 'grupos', nome: 'Pessoas nos grupos', valor: t.grupos, meta: metas.grupos },
    { chave: 'live', nome: 'Participantes da live', valor: t.live, meta: metas.live },
    { chave: 'lista', nome: 'Lista de reserva', valor: t.lista, meta: metas.lista },
  ];
  if (t.vendas !== null && t.vendas !== undefined) etapas.push({ chave: 'vendas', nome: 'Vendas', valor: t.vendas, meta: metas.vendas });
  for (let i = 1; i < etapas.length; i++) {
    const e = etapas[i], ant = etapas[i - 1];
    e.conversao = dividir(e.valor, ant.valor);
    // Taxa esperada pelas metas (ex.: meta de grupos / meta de cadastros)
    e.conversaoMeta = ant.meta && e.meta ? dividir(e.meta, ant.meta) : null;
    e.eficiencia = e.conversao !== null && e.conversaoMeta ? e.conversao / e.conversaoMeta : null;
  }
  // Gargalo: a passagem com pior desempenho frente ao planejado (abaixo de 100%)
  let gargalo = null;
  for (const e of etapas) {
    if (e.eficiencia !== null && e.eficiencia !== undefined && e.eficiencia < 1 && (!gargalo || e.eficiencia < gargalo.eficiencia)) gargalo = e;
  }
  if (gargalo) gargalo.gargalo = true;
  return { etapas, gargalo };
}
