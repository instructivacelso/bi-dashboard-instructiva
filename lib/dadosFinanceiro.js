import { q, q1 } from './db.js';
import { somarDias } from './datas.js';
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
