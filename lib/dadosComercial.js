import { q, q1 } from './db.js';
import { CIDADES, totaisVendas, rankingEquilibrado } from './comercial.js';
import { dividir } from './calc.js';
import { somarDias, diasEntre } from './datas.js';

export async function configuracao(chave, padrao) {
  const r = await q1('SELECT valor FROM configuracoes WHERE chave=$1', [chave]);
  return r ? r.valor : padrao;
}

export const produtosAtivos = () => q('SELECT id, nome, categoria FROM products WHERE ativo ORDER BY nome');

export async function departamento(slug) {
  return q1('SELECT id, slug, nome FROM departments WHERE slug=$1', [slug]);
}

export async function vendedoresDe(slugs) {
  if (!slugs.length) return [];
  return q(
    `SELECT DISTINCT x.id, x.nome, d.slug AS cidade, g.meta_diaria, g.meta_semanal, g.meta_mensal
       FROM users x
       JOIN user_department_assignments a ON a.user_id = x.id
       JOIN departments d ON d.id = a.department_id
       JOIN subdepartments s ON s.id = a.subdepartment_id AND s.formulario = 'vendedor'
       LEFT JOIN seller_goals g ON g.user_id = x.id
      WHERE x.ativo AND d.slug = ANY($1)
      ORDER BY x.nome`,
    [slugs]
  );
}

export async function fechamentoVendedor(userId, dataRef) {
  const f = await q1('SELECT * FROM seller_daily_closings WHERE user_id=$1 AND data_ref=$2', [userId, dataRef]);
  const vendas = f ? await q('SELECT * FROM sales WHERE closing_id=$1 ORDER BY id', [f.id]) : [];
  return { f, vendas };
}

// Último fechamento antes da data (o "dia anterior" do vendedor)
export async function anteriorVendedor(userId, dataRef) {
  const f = await q1('SELECT * FROM seller_daily_closings WHERE user_id=$1 AND data_ref < $2 ORDER BY data_ref DESC LIMIT 1', [userId, dataRef]);
  const vendas = f ? await q('SELECT * FROM sales WHERE user_id=$1 AND data_ref=$2', [userId, f.data_ref]) : [];
  return { f, vendas };
}

// Faturamento do vendedor no dia, semana (seg-dom) e mês
export async function faturamentoPeriodos(userIds, dataRef) {
  const d = new Date(`${dataRef}T12:00:00Z`);
  const dow = (d.getUTCDay() + 6) % 7;
  const inicioSemana = somarDias(dataRef, -dow);
  const inicioMes = `${dataRef.slice(0, 8)}01`;
  const r = await q1(
    `SELECT COALESCE(SUM(valor) FILTER (WHERE data_ref=$2),0) dia,
            COALESCE(SUM(valor) FILTER (WHERE data_ref BETWEEN $3 AND $2),0) semana,
            COALESCE(SUM(valor) FILTER (WHERE data_ref BETWEEN $4 AND $2),0) mes
       FROM sales WHERE user_id = ANY($1) AND status <> 'cancelada'`,
    [userIds, dataRef, inicioSemana, inicioMes]
  );
  return { dia: Number(r.dia), semana: Number(r.semana), mes: Number(r.mes) };
}

// Consolidado do Comercial para um conjunto de cidades e período
export async function painelComercial({ cidades, desde, ate, vendedorId = null, funil = null, produto = null, pagamento = null, status = null }) {
  const vendedores = (await vendedoresDe(cidades)).filter((v) => !vendedorId || v.id === vendedorId);
  const ids = vendedores.map((v) => v.id);
  if (!ids.length) return { vendedores: [], linhas: [], totais: null, vazio: true };

  const filtrosVenda = [];
  const pv = [ids, desde, ate];
  if (funil) { pv.push(funil); filtrosVenda.push(`AND funil=$${pv.length}`); }
  if (produto) { pv.push(produto); filtrosVenda.push(`AND product_id=$${pv.length}`); }
  if (pagamento) { pv.push(pagamento); filtrosVenda.push(`AND forma_pagamento=$${pv.length}`); }
  if (status) { pv.push(status); filtrosVenda.push(`AND status=$${pv.length}`); }

  const [fech, ultimos, vendas, porProduto, serieRows] = await Promise.all([
    q(`SELECT user_id, COUNT(*)::int dias, SUM(leads_recebidos)::int leads, SUM(ligacoes)::int ligacoes, SUM(followups)::int followups,
              SUM(agendamentos)::int agendamentos, COUNT(*) FILTER (WHERE pontualidade='atrasado')::int atrasados
         FROM seller_daily_closings WHERE user_id = ANY($1) AND data_ref BETWEEN $2 AND $3 GROUP BY user_id`, [ids, desde, ate]),
    // Pipeline é estoque: vale o último fechamento de cada vendedor no período
    q(`SELECT DISTINCT ON (user_id) user_id, data_ref, pipeline_qtd, pipeline_valor, negociacao_qtd, negociacao_valor, fechamento_qtd, fechamento_valor
         FROM seller_daily_closings WHERE user_id = ANY($1) AND data_ref BETWEEN $2 AND $3 ORDER BY user_id, data_ref DESC`, [ids, desde, ate]),
    q(`SELECT s.*, p.nome produto FROM sales s JOIN products p ON p.id=s.product_id
        WHERE s.user_id = ANY($1) AND s.data_ref BETWEEN $2 AND $3 ${filtrosVenda.join(' ')} ORDER BY s.data_ref`, pv),
    Promise.resolve(null),
    q(`SELECT data_ref, SUM(valor) total, COUNT(*)::int qtd FROM sales WHERE user_id = ANY($1) AND data_ref BETWEEN $2 AND $3 AND status <> 'cancelada' ${filtrosVenda.join(' ')} GROUP BY data_ref`, pv),
  ]);
  void porProduto;

  const dias = diasEntre(desde, ate);
  const diasUteisPeriodo = dias.filter((d) => { const w = new Date(`${d}T12:00:00Z`).getUTCDay(); return w !== 0 && w !== 6; }).length || 1;

  const linhas = vendedores.map((v) => {
    const f = fech.find((x) => x.user_id === v.id) || {};
    const u = ultimos.find((x) => x.user_id === v.id) || {};
    const tv = totaisVendas(vendas.filter((s) => s.user_id === v.id));
    const metaPeriodo = v.meta_diaria ? Number(v.meta_diaria) * diasUteisPeriodo : null;
    return {
      id: v.id, nome: v.nome, cidade: v.cidade, meta_diaria: v.meta_diaria, meta_mensal: v.meta_mensal,
      diasEnviados: f.dias || 0, atrasados: f.atrasados || 0,
      leads: f.leads || 0, ligacoes: f.ligacoes || 0, followups: f.followups || 0, agendamentos: f.agendamentos || 0,
      atividade: (f.ligacoes || 0) + (f.followups || 0),
      pipeline_qtd: u.pipeline_qtd ?? null, pipeline_valor: u.pipeline_valor ?? null,
      negociacao_qtd: u.negociacao_qtd ?? null, negociacao_valor: u.negociacao_valor ?? null,
      fechamento_qtd: u.fechamento_qtd ?? null, fechamento_valor: u.fechamento_valor ?? null,
      vendas: tv.qtd, faturamento: tv.total, ticketMedio: tv.ticketMedio,
      conversao: dividir(tv.qtd, f.leads),
      metaPeriodo, pctMeta: dividir(tv.total, metaPeriodo),
    };
  });

  const tv = totaisVendas(vendas);
  const soma = (k) => linhas.reduce((t, l) => t + (Number(l[k]) || 0), 0);
  const metaPeriodo = linhas.some((l) => l.metaPeriodo) ? soma('metaPeriodo') : null;
  const agrupa = (chave) => {
    const m = {};
    for (const s of vendas) {
      if (s.status === 'cancelada') continue;
      const k = s[chave];
      m[k] ||= { chave: k, qtd: 0, total: 0 };
      m[k].qtd++; m[k].total += Number(s.valor);
    }
    return Object.values(m).sort((a, b) => b.total - a.total);
  };
  const porCidade = Object.keys(CIDADES).filter((c) => cidades.includes(c)).map((c) => {
    const ls = linhas.filter((l) => l.cidade === c);
    const t = totaisVendas(vendas.filter((s) => ls.some((l) => l.id === s.user_id)));
    const leads = ls.reduce((a, l) => a + l.leads, 0);
    const meta = ls.some((l) => l.metaPeriodo) ? ls.reduce((a, l) => a + (l.metaPeriodo || 0), 0) : null;
    return { cidade: c, nome: CIDADES[c], vendedores: ls.length, ...t, leads, conversao: dividir(t.qtd, leads), meta, pctMeta: dividir(t.total, meta),
      pipeline: ls.reduce((a, l) => a + (Number(l.pipeline_valor) || 0), 0), atividade: ls.reduce((a, l) => a + l.atividade, 0) };
  });
  const serieMap = Object.fromEntries(serieRows.map((r) => [r.data_ref, r]));
  const serie = dias.map((d) => ({ data: d, total: serieMap[d] ? Number(serieMap[d].total) : null }));

  return {
    vendedores, linhas: rankingEquilibrado(linhas), vendas,
    totais: {
      ...tv, leads: soma('leads'), ligacoes: soma('ligacoes'), followups: soma('followups'), agendamentos: soma('agendamentos'),
      pipeline_qtd: soma('pipeline_qtd'), pipeline_valor: soma('pipeline_valor'), negociacao_qtd: soma('negociacao_qtd'),
      negociacao_valor: soma('negociacao_valor'), fechamento_qtd: soma('fechamento_qtd'), fechamento_valor: soma('fechamento_valor'),
      conversao: dividir(tv.qtd, soma('leads')), metaPeriodo, pctMeta: dividir(tv.total, metaPeriodo),
    },
    porFunil: agrupa('funil'), porProduto: agrupa('produto'), porPagamento: agrupa('forma_pagamento'), porCidade, serie,
  };
}

// Quem já enviou o fechamento hoje (vendedores das cidades)
export async function pendenciasComercial(cidades, dataRef) {
  const vend = await vendedoresDe(cidades);
  if (!vend.length) return [];
  const feitos = await q('SELECT user_id, pontualidade, created_at FROM seller_daily_closings WHERE data_ref=$1 AND user_id = ANY($2)', [dataRef, vend.map((v) => v.id)]);
  return vend.map((v) => {
    const f = feitos.find((x) => x.user_id === v.id);
    return { ...v, enviado: !!f, pontualidade: f?.pontualidade || null, enviadoEm: f?.created_at || null };
  });
}
