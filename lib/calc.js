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

// Indicadores de um registro diário de tráfego
export function calcTrafego({ valor_gasto, visitas, cadastros }) {
  return {
    cpl: dividir(valor_gasto, cadastros),
    custoVisita: dividir(valor_gasto, visitas),
    conversaoPagina: dividir(cadastros, visitas),
  };
}

// Indicadores de um registro diário de WhatsApp
export function calcWhatsapp({ convites_api, entradas_api, entradas_organico, custo_disparos }) {
  const entradas = (Number(entradas_api) || 0) + (Number(entradas_organico) || 0);
  return {
    entradasTotais: entradas,
    conversaoConvites: dividir(entradas_api, convites_api),
    custoPorEntradaApi: custo_disparos ? dividir(custo_disparos, entradas_api) : null,
  };
}

// Crescimento diário a partir da série de "total atual nos grupos" (ordenada por data)
export function crescimentoGrupos(serie) {
  return serie.map((p, i) => ({ ...p, crescimento: i === 0 ? null : p.total - serie[i - 1].total }));
}

// t = totais acumulados do período
export function indicadoresMarketing(t) {
  return {
    cpl: dividir(t.investimento, t.cadastros),
    conversaoPagina: dividir(t.cadastros, t.visitas),
    entradaWhatsapp: dividir(t.grupos, t.cadastros),
    comparecimentoLive: dividir(t.live, t.grupos),
    conversaoLista: dividir(t.lista, t.live),
    conversaoVendas: dividir(t.vendas, t.lista),
    conversaoGeral: dividir(t.vendas, t.cadastros),
    cac: dividir(t.investimento, t.vendas),
    roas: dividir(t.faturamento, t.investimento),
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
    { chave: 'vendas', nome: 'Vendas', valor: t.vendas, meta: metas.vendas },
  ];
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
