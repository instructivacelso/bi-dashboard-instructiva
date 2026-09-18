import { q, q1 } from './db.js';
import { somarDias } from './datas.js';
import { dividir } from './calc.js';
import {
  consolidarSaldos, resultadoCaixaDia, inadimplencia, aReceberPorJanela, projecaoCaixa, cobertura, capitalDeGiro,
} from './financeiro.js';

const TZ = `'America/Sao_Paulo'`;
const entre = (col) => `${col} >= ($1::date)::timestamp AT TIME ZONE ${TZ} AND ${col} < (($2::date + 1))::timestamp AT TIME ZONE ${TZ}`;

// ---------- Cadastros ----------
export const contas = () => q('SELECT * FROM fin_accounts ORDER BY ativo DESC, ordem, nome');
export const contasAtivas = () => q('SELECT * FROM fin_accounts WHERE ativo ORDER BY ordem, nome');
export const categorias = () => q('SELECT * FROM fin_categories ORDER BY ativo DESC, natureza, nome');
export const categoriasAtivas = () => q('SELECT * FROM fin_categories WHERE ativo ORDER BY natureza, nome');
export const centrosCusto = () => q('SELECT * FROM fin_cost_centers ORDER BY ativo DESC, nome');
export const fornecedores = () => q('SELECT * FROM fin_suppliers ORDER BY ativo DESC, nome');
export const recorrentes = () => q('SELECT r.*, c.nome categoria FROM fin_recurring r LEFT JOIN fin_categories c ON c.id=r.category_id ORDER BY r.ativo DESC, r.dia_vencimento');

export async function configFinanceiro() {
  const cfg = await q(`SELECT chave, valor FROM configuracoes WHERE chave LIKE 'financeiro_%'`);
  const m = Object.fromEntries(cfg.map((c) => [c.chave, c.valor]));
  return {
    limite: m.financeiro_horario_limite || '19:00',
    probBoleto: Number(m.financeiro_prob_boleto ?? 80) / 100,
    probInad: Number(m.financeiro_prob_inadimplencia ?? 30) / 100,
  };
}

// ---------- Vendas do dia (Comercial + Indicação), sem redigitar ----------
export async function vendasDoDia(dia) {
  const [com, ind] = await Promise.all([
    q1(`SELECT COUNT(*)::int qtd, COALESCE(SUM(valor),0) valor,
               COALESCE(SUM(valor) FILTER (WHERE forma_pagamento='pix'),0) pix,
               COALESCE(SUM(valor) FILTER (WHERE forma_pagamento='cartao'),0) cartao,
               COALESCE(SUM(valor) FILTER (WHERE forma_pagamento='boleto'),0) boleto
          FROM sales WHERE data_ref=$1 AND status <> 'cancelada'`, [dia]),
    q1(`SELECT COUNT(*)::int qtd, COALESCE(SUM(venda_valor),0) valor,
               COALESCE(SUM(venda_valor) FILTER (WHERE venda_pagamento='pix'),0) pix,
               COALESCE(SUM(venda_valor) FILTER (WHERE venda_pagamento='cartao'),0) cartao,
               COALESCE(SUM(venda_valor) FILTER (WHERE venda_pagamento='boleto'),0) boleto
          FROM referrals WHERE etapa='venda' AND venda_status <> 'cancelada' AND ${entre('venda_em')}`, [dia, dia]),
  ]);
  const n = (x) => Number(x || 0);
  const porProduto = await q(
    `SELECT nome, SUM(qtd)::int qtd, SUM(valor) valor FROM (
        SELECT pr.nome, COUNT(*)::int qtd, SUM(s.valor) valor FROM sales s JOIN products pr ON pr.id=s.product_id WHERE s.data_ref=$1 AND s.status<>'cancelada' GROUP BY pr.nome
        UNION ALL
        SELECT pr.nome, COUNT(*)::int qtd, SUM(r.venda_valor) valor FROM referrals r JOIN products pr ON pr.id=r.venda_product_id WHERE r.etapa='venda' AND r.venda_status<>'cancelada' AND ${entre('r.venda_em')} GROUP BY pr.nome
     ) t GROUP BY nome ORDER BY valor DESC NULLS LAST`, [dia, dia]);
  return {
    qtd: n(com.qtd) + n(ind.qtd), valor: n(com.valor) + n(ind.valor),
    pix: n(com.pix) + n(ind.pix), cartao: n(com.cartao) + n(ind.cartao), boleto: n(com.boleto) + n(ind.boleto),
    comercial: { qtd: n(com.qtd), valor: n(com.valor) }, indicacao: { qtd: n(ind.qtd), valor: n(ind.valor) },
    porProduto: porProduto.map((p) => ({ ...p, valor: n(p.valor) })),
  };
}

// ---------- Contas a pagar por janela (bloco 7) ----------
export async function obrigacoesPorJanela(dia) {
  const rows = await q(
    `SELECT vencimento, COALESCE(SUM(valor_previsto),0) v FROM fin_payments
       WHERE status IN ('previsto','aprovado','vencido','renegociado') AND vencimento IS NOT NULL AND vencimento > $1 GROUP BY vencimento`, [dia]);
  const janela = { sete: 0, trinta: 0, sessenta: 0, noventa: 0 };
  const d7 = somarDias(dia, 7), d30 = somarDias(dia, 30), d60 = somarDias(dia, 60), d90 = somarDias(dia, 90);
  for (const r of rows) {
    const v = Number(r.v), venc = String(r.vencimento).slice(0, 10);
    if (venc <= d7) janela.sete += v; else if (venc <= d30) janela.trinta += v; else if (venc <= d60) janela.sessenta += v; else if (venc <= d90) janela.noventa += v;
  }
  const recs = await q('SELECT valor, dia_vencimento FROM fin_recurring WHERE ativo');
  const diaNum = Number(dia.slice(8, 10));
  for (const r of recs) {
    const v = Number(r.valor);
    const proxNoMes = r.dia_vencimento >= diaNum ? r.dia_vencimento - diaNum : r.dia_vencimento - diaNum + 30;
    if (proxNoMes <= 7) janela.sete += v; else janela.trinta += v;
    janela.sessenta += v; janela.noventa += v; // recorre nos meses seguintes
  }
  const vencido = await q1(`SELECT COALESCE(SUM(valor_previsto),0) v, COUNT(*)::int n FROM fin_payments WHERE status IN ('previsto','aprovado','vencido') AND vencimento IS NOT NULL AND vencimento <= $1`, [dia]);
  return { ...janela, vencido: Number(vencido.v), vencidoQtd: vencido.n };
}

// ---------- Fechamento de um dia (cabeçalho + filhos) ----------
export async function fechamentoDoDia(dia) {
  const c = await q1('SELECT * FROM fin_daily_closings WHERE data_ref=$1', [dia]);
  if (!c) return null;
  const [saldos, entradas, pagamentos] = await Promise.all([
    q('SELECT b.*, a.nome conta FROM fin_closing_balances b JOIN fin_accounts a ON a.id=b.account_id WHERE b.closing_id=$1 ORDER BY a.ordem, a.nome', [c.id]),
    q('SELECT e.*, p.nome produto, a.nome conta FROM fin_entries e LEFT JOIN products p ON p.id=e.product_id LEFT JOIN fin_accounts a ON a.id=e.account_id WHERE e.closing_id=$1 ORDER BY e.id', [c.id]),
    q(`SELECT pg.*, f.nome fornecedor, cc.nome centro, cat.nome categoria FROM fin_payments pg
         LEFT JOIN fin_suppliers f ON f.id=pg.supplier_id LEFT JOIN fin_cost_centers cc ON cc.id=pg.cost_center_id LEFT JOIN fin_categories cat ON cat.id=pg.category_id
        WHERE pg.closing_id=$1 ORDER BY pg.id`, [c.id]),
  ]);
  return { ...c, saldos, entradas, pagamentos };
}

export const ultimoFechamento = (dia) => q1('SELECT * FROM fin_daily_closings WHERE data_ref <= $1 ORDER BY data_ref DESC LIMIT 1', [dia]);

// ---------- Números para painel e dashboard ----------
export async function numerosFinanceiro(dia) {
  const cfg = await configFinanceiro();
  const fech = await q1('SELECT * FROM fin_daily_closings WHERE data_ref=$1', [dia]);
  const base = fech || (await ultimoFechamento(dia)) || {};
  const [saldos, entradasDia, saidasDia, aPagarHoje, vendas, obrig] = await Promise.all([
    base.id ? q('SELECT * FROM fin_closing_balances WHERE closing_id=$1', [base.id]) : [],
    fech ? q1('SELECT COALESCE(SUM(valor_liquido),0) v FROM fin_entries WHERE closing_id=$1', [fech.id]) : { v: 0 },
    q1(`SELECT COALESCE(SUM(valor_pago),0) v FROM fin_payments WHERE pago_em=$1 AND status='pago'`, [dia]),
    q1(`SELECT COALESCE(SUM(valor_previsto),0) v, COUNT(*)::int n FROM fin_payments WHERE vencimento=$1 AND status IN ('previsto','aprovado','vencido','renegociado')`, [dia]),
    vendasDoDia(dia), obrigacoesPorJanela(dia),
  ]);
  const saldo = consolidarSaldos(saldos);
  const entradas = Number(entradasDia.v || 0), saidas = Number(saidasDia.v || 0);
  const receber = aReceberPorJanela(base);
  const inad = inadimplencia({ ...base, recebido30: receber.trinta });
  const proj = projecaoCaixa({
    disponivel: saldo.disponivel,
    aReceber: { sete: receber.sete, trinta: receber.trinta, sessenta: receber.sessenta, noventa: receber.noventa },
    boletoPorJanela: {}, inadRecuperavel: inad.vencido,
    aPagar: { sete: obrig.sete, trinta: obrig.trinta, sessenta: obrig.sessenta, noventa: obrig.noventa },
    probBoleto: cfg.probBoleto, probInad: cfg.probInad,
  });
  const receb30 = receber.sete + receber.trinta;
  const pag30 = obrig.sete + obrig.trinta;
  return {
    temFechamento: !!fech, statusFechamento: fech?.status || null, dataBase: base.data_ref || null,
    saldo, disponivel: saldo.disponivel, entradas, saidas, resultadoDia: resultadoCaixaDia(entradas, saidas),
    aPagarHoje: Number(aPagarHoje.v || 0), aPagarHojeQtd: aPagarHoje.n || 0,
    vendas, receber, inad, obrig, proj,
    cobertura30: cobertura(saldo.disponivel, receb30, pag30),
    capitalGiro: capitalDeGiro(pag30, receb30, saldo.disponivel),
    contasComSaldo: saldos.length,
  };
}

// ---------- Etapa 2: resultado do mês ----------
import { montarDRE, pontoEquilibrio, cac, margemProduto, ratearPorReceita } from './financeiro.js';

// Receita das vendas num período (Comercial + Indicação), total, por produto e por pagamento
export async function receitaPeriodo(desde, ate) {
  const [tot, prod] = await Promise.all([
    q1(`SELECT
          (SELECT COALESCE(SUM(valor),0) FROM sales WHERE data_ref BETWEEN $1 AND $2 AND status<>'cancelada')
        + (SELECT COALESCE(SUM(venda_valor),0) FROM referrals WHERE etapa='venda' AND venda_status<>'cancelada' AND venda_em::date BETWEEN $1 AND $2) receita,
          (SELECT COUNT(*) FROM sales WHERE data_ref BETWEEN $1 AND $2 AND status<>'cancelada')
        + (SELECT COUNT(*) FROM referrals WHERE etapa='venda' AND venda_status<>'cancelada' AND venda_em::date BETWEEN $1 AND $2) qtd`, [desde, ate]),
    q(`SELECT id, nome, SUM(receita) receita, SUM(qtd)::int qtd FROM (
          SELECT pr.id, pr.nome, COALESCE(SUM(s.valor),0) receita, COUNT(*) qtd FROM sales s JOIN products pr ON pr.id=s.product_id WHERE s.data_ref BETWEEN $1 AND $2 AND s.status<>'cancelada' GROUP BY pr.id, pr.nome
          UNION ALL
          SELECT pr.id, pr.nome, COALESCE(SUM(r.venda_valor),0) receita, COUNT(*) qtd FROM referrals r JOIN products pr ON pr.id=r.venda_product_id WHERE r.etapa='venda' AND r.venda_status<>'cancelada' AND r.venda_em::date BETWEEN $1 AND $2 GROUP BY pr.id, pr.nome
       ) t GROUP BY id, nome ORDER BY receita DESC`, [desde, ate]),
  ]);
  return { total: Number(tot.receita || 0), qtd: Number(tot.qtd || 0), porProduto: prod.map((p) => ({ ...p, receita: Number(p.receita) })) };
}

export async function resultadoMes(desde, ate) {
  const cfg = await q1(`SELECT valor FROM configuracoes WHERE chave='financeiro_meta_margem'`);
  const metaMargem = Number(cfg?.valor ?? 30) / 100;
  const [receita, taxas, pagGrupo, pagProduto, mkt, mktProduto, ajGrupo, ajProduto] = await Promise.all([
    receitaPeriodo(desde, ate),
    q1(`SELECT COALESCE(SUM(taxa),0) v FROM fin_entries WHERE data_ref BETWEEN $1 AND $2`, [desde, ate]),
    q(`SELECT COALESCE(cat.grupo,'outra') grupo, COALESCE(SUM(p.valor_previsto),0) v FROM fin_payments p LEFT JOIN fin_categories cat ON cat.id=p.category_id
        WHERE COALESCE(p.vencimento,p.data_ref) BETWEEN $1 AND $2 AND p.status<>'cancelado' GROUP BY 1`, [desde, ate]),
    q(`SELECT p.product_id, COALESCE(SUM(p.valor_previsto),0) v FROM fin_payments p LEFT JOIN fin_categories cat ON cat.id=p.category_id
        WHERE COALESCE(p.vencimento,p.data_ref) BETWEEN $1 AND $2 AND p.status<>'cancelado' AND p.product_id IS NOT NULL
          AND COALESCE(cat.natureza,'saida')='saida' GROUP BY p.product_id`, [desde, ate]),
    q1(`SELECT (SELECT COALESCE(SUM(valor_gasto),0) FROM traffic_daily_entries WHERE data_ref BETWEEN $1 AND $2)
             + (SELECT COALESCE(SUM(custo_disparos),0) FROM whatsapp_daily_entries WHERE data_ref BETWEEN $1 AND $2) v`, [desde, ate]),
    q(`SELECT l.product_id, SUM(v) v FROM (
          SELECT t.launch_id, SUM(t.valor_gasto) v FROM traffic_daily_entries t WHERE t.data_ref BETWEEN $1 AND $2 GROUP BY t.launch_id
          UNION ALL
          SELECT w.launch_id, SUM(COALESCE(w.custo_disparos,0)) v FROM whatsapp_daily_entries w WHERE w.data_ref BETWEEN $1 AND $2 GROUP BY w.launch_id
       ) s JOIN launches l ON l.id=s.launch_id WHERE l.product_id IS NOT NULL GROUP BY l.product_id`, [desde, ate]),
    q(`SELECT grupo, tipo, COALESCE(SUM(valor),0) v FROM fin_adjustments WHERE competencia BETWEEN $1 AND $2 GROUP BY grupo, tipo`, [desde, ate]),
    q(`SELECT product_id, COALESCE(SUM(valor),0) v FROM fin_adjustments WHERE competencia BETWEEN $1 AND $2 AND product_id IS NOT NULL GROUP BY product_id`, [desde, ate]),
  ]);
  const g = (rows, k) => Number(rows.find((r) => r.grupo === k)?.v || 0);
  const somaGrupos = (rows, ks) => ks.reduce((s, k) => s + g(rows, k), 0);
  const marketingTotal = Number(mkt.v || 0) + g(pagGrupo, 'marketing');
  const dre = montarDRE({
    receitaBruta: receita.total, taxas: Number(taxas.v || 0),
    impostos: g(pagGrupo, 'imposto') + somaGrupos(ajGrupo, ['imposto']),
    custosVariaveis: g(pagGrupo, 'custo_variavel') + g(ajGrupo, 'custo_variavel'),
    marketing: marketingTotal,
    custosFixos: g(pagGrupo, 'custo_fixo') + g(ajGrupo, 'custo_fixo'),
    pessoal: g(pagGrupo, 'pessoal') + g(ajGrupo, 'pessoal'),
    depreciacao: somaGrupos(ajGrupo, ['depreciacao']),
    juros: g(pagGrupo, 'juros') + g(pagGrupo, 'divida') + somaGrupos(ajGrupo, ['juros']),
  });
  dre.equilibrio = pontoEquilibrio(dre.fixos, dre.margemPct);
  dre.metaMargem = metaMargem;
  // CAC total (marketing + comercial ÷ vendas). Comercial = grupo pessoal atribuído ao comercial não é isolado aqui; usamos marketing como base.
  dre.cac = cac(marketingTotal, receita.qtd);

  // Custo por produto: direto (pagamentos + ajustes marcados) + marketing do produto + rateio dos indiretos
  const dirPay = Object.fromEntries(pagProduto.map((r) => [r.product_id, Number(r.v)]));
  const dirAdj = Object.fromEntries(ajProduto.map((r) => [r.product_id, Number(r.v)]));
  const dirMkt = Object.fromEntries(mktProduto.map((r) => [r.product_id, Number(r.v)]));
  const direto = (id) => (dirPay[id] || 0) + (dirAdj[id] || 0) + (dirMkt[id] || 0);
  const custosOperacionais = dre.variaveis + dre.fixos; // sem impostos, juros e depreciação
  const somaDireto = receita.porProduto.reduce((s, p) => s + direto(p.id), 0);
  const indireto = Math.max(0, custosOperacionais - somaDireto);
  const rateios = Object.fromEntries(ratearPorReceita(indireto, receita.porProduto.map((p) => ({ id: p.id, receita: p.receita }))).map((r) => [r.id, r.rateio]));
  const produtos = receita.porProduto.map((p) => {
    const custo = Math.round((direto(p.id) + (rateios[p.id] || 0)) * 100) / 100;
    const m = margemProduto(p.receita, custo);
    return { ...p, marketing: dirMkt[p.id] || 0, custoDireto: direto(p.id), rateio: rateios[p.id] || 0, custo, margem: m.margem, margemPct: m.pct, cac: cac(dirMkt[p.id] || 0, p.qtd), ticket: dividir(p.receita, p.qtd) };
  });
  return { desde, ate, receita, dre, marketingTotal, produtos };
}

export const ajustesDoMes = (desde, ate) => q(`SELECT a.*, p.nome produto, u.nome autor FROM fin_adjustments a LEFT JOIN products p ON p.id=a.product_id LEFT JOIN users u ON u.id=a.created_by WHERE a.competencia BETWEEN $1 AND $2 ORDER BY a.created_at DESC`, [desde, ate]);

// ---------- Etapa 3: posição patrimonial ----------
import { saldoDevedorTotal, parcelaMensalTotal, jurosMes, patrimonioTotal, patrimonioLiquido, grauEndividamento, capitalLiquido } from './financeiro.js';

export const listaDividas = () => q('SELECT * FROM fin_debts ORDER BY (status IN (\'quitada\')), proximo_vencimento NULLS LAST, credor');
export const listaAtivos = () => q('SELECT * FROM fin_assets ORDER BY valor_atual DESC');
export const listaConsorcios = () => q('SELECT * FROM fin_consortia ORDER BY (status <> \'ativo\'), administradora');
export const movimentosCapital = (desde, ate) => q('SELECT m.*, u.nome autor FROM fin_capital_movements m LEFT JOIN users u ON u.id=m.created_by WHERE ($1::date IS NULL OR m.data BETWEEN $1 AND $2) ORDER BY m.data DESC, m.id DESC', [desde ?? null, ate ?? null]);

export async function posicaoPatrimonial(desde = null, ate = null) {
  const cfg = await q(`SELECT chave, valor FROM configuracoes WHERE chave IN ('financeiro_alcada_diretoria','financeiro_meta_reducao_divida')`);
  const m = Object.fromEntries(cfg.map((c) => [c.chave, Number(c.valor)]));
  const [dividas, ativos, consorcios, movimentos, alcada] = await Promise.all([
    listaDividas(), listaAtivos(), listaConsorcios(), movimentosCapital(desde, ate),
    q(`SELECT p.id, p.descricao, p.valor_previsto, COALESCE(cat.nome,'') categoria FROM fin_payments p LEFT JOIN fin_categories cat ON cat.id=p.category_id
        WHERE p.status IN ('previsto','aguardando') AND p.valor_previsto > $1 AND $1 > 0 ORDER BY p.valor_previsto DESC LIMIT 20`, [m.financeiro_alcada_diretoria || 0]),
  ]);
  const saldoDivida = saldoDevedorTotal(dividas);
  const meta = m.financeiro_meta_reducao_divida || 0;
  return {
    dividas, ativos, consorcios, movimentos,
    saldoDivida, parcelaMensal: parcelaMensalTotal(dividas, consorcios), jurosMes: jurosMes(dividas),
    patrimonioTotal: patrimonioTotal(ativos), patrimonioLiquido: patrimonioLiquido(ativos, dividas),
    grauEndividamento: grauEndividamento(dividas, ativos),
    capitalLiquido: capitalLiquido(movimentos),
    alcada: m.financeiro_alcada_diretoria || 0, pagamentosAcimaAlcada: alcada,
    metaReducao: meta, faltaParaMeta: meta > 0 ? Math.max(0, saldoDivida - meta) : null,
    consorciosContemplados: consorcios.filter((c) => c.contemplado || c.status === 'contemplado').length,
    valorConsorcios: Math.round(consorcios.filter((c) => c.status === 'ativo').reduce((s, c) => s + Number(c.valor_carta || 0), 0) * 100) / 100,
  };
}
