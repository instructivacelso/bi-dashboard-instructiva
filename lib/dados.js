import { q, q1 } from './db.js';
import { FORMULARIOS, formularioAplicavel } from './formularios.js';
import { formulariosDo, vePainelEmpresa, gerenteDe, ehSuperadmin } from './perm.js';
import { indicadoresMarketing, montarFunil, dividir } from './calc.js';
import { diasEntre } from './datas.js';

const CAMPOS_LANC = `l.id, l.nome, l.status, l.data_live, l.live_liberada, l.product_id, l.gerente_id,
  l.meta_cadastros, l.meta_grupos, l.meta_live, l.meta_lista, l.meta_vendas, l.meta_faturamento,
  l.cpl_max, l.cac_max, l.roas_min, l.orcamento, p.nome AS produto`;

// Lançamentos em que o usuário trabalha (atribuído ou gerente responsável)
export async function lancamentosDoUsuario(u) {
  if (ehSuperadmin(u)) {
    return q(`SELECT ${CAMPOS_LANC} FROM launches l LEFT JOIN products p ON p.id=l.product_id ORDER BY l.id DESC`);
  }
  return q(
    `SELECT DISTINCT ${CAMPOS_LANC} FROM launches l
       LEFT JOIN products p ON p.id=l.product_id
       LEFT JOIN launch_user_assignments a ON a.launch_id=l.id
      WHERE a.user_id=$1 OR l.gerente_id=$1
      ORDER BY l.id DESC`,
    [u.id]
  );
}

// Lançamentos que o usuário pode consultar (dashboards, histórico, filtros)
export async function lancamentosVisiveis(u) {
  if (vePainelEmpresa(u) || gerenteDe(u, 'marketing')) {
    return q(`SELECT ${CAMPOS_LANC} FROM launches l LEFT JOIN products p ON p.id=l.product_id ORDER BY l.id DESC`);
  }
  return lancamentosDoUsuario(u);
}

export async function idsAtribuidos(u) {
  return (await lancamentosDoUsuario(u)).map((l) => l.id);
}

// Formulários do dia para o usuário, com status pendente/concluído
export async function tarefasDoDia(u, hoje) {
  const forms = formulariosDo(u);
  if (!forms.length) return [];
  const lancs = await lancamentosDoUsuario(u);
  const tarefas = [];
  for (const form of forms) {
    const f = FORMULARIOS[form];
    const aplicaveis = lancs.filter((l) => formularioAplicavel(form, l, hoje));
    if (!aplicaveis.length) continue;
    const feitos = await q(
      `SELECT id, launch_id FROM ${f.tabela} WHERE data_ref=$1 ${f.porUsuario ? 'AND created_by=$2' : ''}`,
      f.porUsuario ? [hoje, u.id] : [hoje]
    );
    for (const l of aplicaveis) {
      const r = feitos.find((x) => x.launch_id === l.id);
      tarefas.push({ form, titulo: f.titulo, lancamento: l, concluido: !!r, registroId: r?.id || null });
    }
  }
  return tarefas;
}

// Pendências de toda a equipe de um setor (para gerente/diretoria)
export async function pendenciasEquipe(hoje, setor = 'marketing') {
  const { carregarUsuario } = await import('./auth.js');
  const ids = await q(
    `SELECT DISTINCT u.id FROM users u
       JOIN user_department_assignments a ON a.user_id=u.id
       JOIN departments d ON d.id=a.department_id
      WHERE u.ativo AND d.slug=$1 ORDER BY u.id`,
    [setor]
  );
  const lista = [];
  for (const { id } of ids) {
    const u = await carregarUsuario(id);
    if (!u) continue;
    const tarefas = await tarefasDoDia(u, hoje);
    for (const t of tarefas) lista.push({ usuario: u.nome, usuarioId: u.id, ...t });
  }
  return lista;
}

export async function problemasAbertos(u) {
  const acoes = await q(
    `SELECT a.*, l.nome AS lancamento, r.nome AS responsavel FROM action_items a
       LEFT JOIN launches l ON l.id=a.launch_id LEFT JOIN users r ON r.id=a.responsavel_id
      WHERE a.status IN ('aberta','em_andamento') AND ($1::int IS NULL OR a.responsavel_id=$1)
      ORDER BY a.prazo NULLS LAST, a.id DESC LIMIT 50`,
    [vePainelEmpresa(u) || gerenteDe(u, 'marketing') ? null : u.id]
  );
  const veIncidentes = vePainelEmpresa(u) || gerenteDe(u, 'marketing') || formulariosDo(u).includes('automacao');
  const incidentes = veIncidentes
    ? await q(
        `SELECT i.*, l.nome AS lancamento, c.nome AS autor FROM automation_incidents i
           JOIN launches l ON l.id=i.launch_id JOIN users c ON c.id=i.created_by
          WHERE i.status='aberto'
          ORDER BY CASE i.prioridade WHEN 'critica' THEN 0 WHEN 'alta' THEN 1 WHEN 'media' THEN 2 ELSE 3 END, i.id DESC`
      )
    : [];
  return { acoes, incidentes };
}

// ---------------- Histórico ----------------
const RESUMOS = {
  trafego: `'Gasto R$ ' || t.valor_gasto || ' · ' || t.visitas || ' visitas · ' || t.cadastros || ' cadastros'`,
  whatsapp: `(t.entradas_api + t.entradas_organico) || ' entradas · ' || t.total_grupos || ' nos grupos'`,
  automacao: `CASE WHEN t.captacao_ok AND t.checkout_ok AND t.onboarding_ok AND NOT t.houve_problema THEN 'Tudo funcionando' ELSE 'Com problema' END`,
  editor: `t.quantidade || ' ' || t.tipo_entrega || ' · ' || replace(t.situacao,'_',' ')`,
  live: `t.participantes_unicos || ' na live · ' || t.lista_reserva || ' na lista'`,
  gerente: `'Situação ' || t.situacao || COALESCE(' · ' || t.gargalo, '')`,
};

export async function historico({ autorId = null, launchIds = null, form = null, limite = 200 }) {
  const params = [];
  const cond = [];
  if (autorId) { params.push(autorId); cond.push(`t.created_by = $${params.length}`); }
  if (launchIds) { params.push(launchIds); cond.push(`t.launch_id = ANY($${params.length})`); }
  const where = cond.length ? 'WHERE ' + cond.join(' AND ') : '';
  const partes = Object.entries(FORMULARIOS)
    .filter(([chave]) => !form || form === chave)
    .map(([chave, f]) =>
      `SELECT '${chave}' AS form, t.id, t.data_ref, t.launch_id, l.nome AS lancamento, ${RESUMOS[chave]} AS resumo,
              t.created_by, c.nome AS autor, t.updated_at, t.updated_by
         FROM ${f.tabela} t JOIN launches l ON l.id=t.launch_id JOIN users c ON c.id=t.created_by ${where}`
    );
  return q(`${partes.join(' UNION ALL ')} ORDER BY data_ref DESC, updated_at DESC LIMIT ${Number(limite)}`, params);
}

// ---------------- Dashboard do Marketing ----------------
export async function dashboardMarketing({ desde, ate, launchIds, responsavelId }) {
  const pRange = [desde, ate, launchIds];
  const filtroResp = responsavelId ? ` AND created_by=${Number(responsavelId)}` : '';

  const traf = await q1(
    `SELECT COALESCE(SUM(valor_gasto),0) investimento, COALESCE(SUM(visitas),0) visitas, COALESCE(SUM(cadastros),0) cadastros, COUNT(*)::int n
       FROM traffic_daily_entries WHERE data_ref BETWEEN $1 AND $2 AND launch_id = ANY($3) ${filtroResp}`,
    pRange
  );
  const whats = await q1(
    `SELECT COALESCE(SUM(convites_api),0) convites, COALESCE(SUM(entradas_api),0) entradas_api,
            COALESCE(SUM(entradas_organico),0) entradas_organico, COALESCE(SUM(custo_disparos),0) custo_disparos, COUNT(*)::int n
       FROM whatsapp_daily_entries WHERE data_ref BETWEEN $1 AND $2 AND launch_id = ANY($3) ${filtroResp}`,
    pRange
  );
  // Pessoas nos grupos: último total informado de cada lançamento no período
  const grupos = await q1(
    `SELECT COALESCE(SUM(total_grupos),0) total, COUNT(*)::int n FROM (
       SELECT DISTINCT ON (launch_id) launch_id, total_grupos FROM whatsapp_daily_entries
        WHERE data_ref BETWEEN $1 AND $2 AND launch_id = ANY($3) ${filtroResp}
        ORDER BY launch_id, data_ref DESC, updated_at DESC) x`,
    pRange
  );
  const live = await q1(
    `SELECT COALESCE(SUM(participantes_unicos),0) live, COALESCE(SUM(lista_reserva),0) lista, COUNT(*)::int n
       FROM live_results WHERE data_ref BETWEEN $1 AND $2 AND launch_id = ANY($3) ${filtroResp}`,
    pRange
  );
  const com = await q1(
    `SELECT COALESCE(SUM(vendas),0) vendas, COALESCE(SUM(faturamento),0) faturamento, COUNT(*)::int n
       FROM commercial_launch_results WHERE data_ref BETWEEN $1 AND $2 AND launch_id = ANY($3)`,
    pRange
  );

  const totais = {
    investimento: Number(traf.investimento), visitas: Number(traf.visitas), cadastros: Number(traf.cadastros),
    grupos: grupos.n ? Number(grupos.total) : null,
    live: live.n ? Number(live.live) : null, lista: live.n ? Number(live.lista) : null,
    vendas: com.n ? Number(com.vendas) : null, faturamento: com.n ? Number(com.faturamento) : null,
    custoDisparos: Number(whats.custo_disparos),
    convites: Number(whats.convites), entradasApi: Number(whats.entradas_api), entradasOrganico: Number(whats.entradas_organico),
    semTrafego: traf.n === 0,
  };
  if (totais.semTrafego) { totais.investimento = null; totais.visitas = null; totais.cadastros = null; }

  const lancs = launchIds.length
    ? await q(`SELECT l.*, p.nome produto, g.nome gerente FROM launches l LEFT JOIN products p ON p.id=l.product_id LEFT JOIN users g ON g.id=l.gerente_id WHERE l.id = ANY($1) AND l.status <> 'cancelado' ORDER BY l.id DESC`, [launchIds])
    : [];
  const somaMeta = (c) => {
    const v = lancs.filter((l) => l[c] != null);
    return v.length ? v.reduce((t, l) => t + Number(l[c]), 0) : null;
  };
  const metas = {
    cadastros: somaMeta('meta_cadastros'), grupos: somaMeta('meta_grupos'), live: somaMeta('meta_live'),
    lista: somaMeta('meta_lista'), vendas: somaMeta('meta_vendas'), faturamento: somaMeta('meta_faturamento'),
    orcamento: somaMeta('orcamento'),
    cplMax: lancs.length === 1 ? lancs[0].cpl_max : null,
    cacMax: lancs.length === 1 ? lancs[0].cac_max : null,
    roasMin: lancs.length === 1 ? lancs[0].roas_min : null,
  };

  const indicadores = indicadoresMarketing(totais);
  const funil = montarFunil(totais, metas);

  // Série diária
  const serieRows = await q(
    `SELECT data_ref, SUM(valor_gasto) investimento, SUM(cadastros) cadastros, SUM(visitas) visitas
       FROM traffic_daily_entries WHERE data_ref BETWEEN $1 AND $2 AND launch_id = ANY($3) ${filtroResp}
      GROUP BY data_ref ORDER BY data_ref`,
    pRange
  );
  const porDia = Object.fromEntries(serieRows.map((r) => [r.data_ref, r]));
  const serie = diasEntre(desde, ate).map((d) => {
    const r = porDia[d];
    return {
      data: d,
      investimento: r ? Number(r.investimento) : null,
      cadastros: r ? Number(r.cadastros) : null,
      cpl: r ? dividir(r.investimento, r.cadastros) : null,
    };
  });

  // Situação por lançamento
  const porLancamento = launchIds.length
    ? await q(
        `SELECT l.id, l.nome, l.status, l.meta_cadastros, l.cpl_max, l.orcamento,
                COALESCE(t.gasto,0) gasto, COALESCE(t.cad,0) cadastros,
                m.situacao, m.data_ref AS situacao_data
           FROM launches l
           LEFT JOIN (SELECT launch_id, SUM(valor_gasto) gasto, SUM(cadastros) cad FROM traffic_daily_entries
                       WHERE data_ref BETWEEN $1 AND $2 GROUP BY launch_id) t ON t.launch_id=l.id
           LEFT JOIN LATERAL (SELECT situacao, data_ref FROM manager_daily_closings WHERE launch_id=l.id ORDER BY data_ref DESC LIMIT 1) m ON true
          WHERE l.id = ANY($3) AND l.status <> 'cancelado' ORDER BY l.id DESC`,
        pRange
      )
    : [];

  const fechamentos = await q(
    `SELECT m.*, l.nome lancamento, r.nome responsavel, c.nome autor FROM manager_daily_closings m
       JOIN launches l ON l.id=m.launch_id LEFT JOIN users r ON r.id=m.responsavel_id JOIN users c ON c.id=m.created_by
      WHERE m.data_ref BETWEEN $1 AND $2 AND m.launch_id = ANY($3) AND m.situacao <> 'verde'
      ORDER BY m.data_ref DESC LIMIT 10`,
    pRange
  );

  return { totais, metas, indicadores, funil, serie, porLancamento, fechamentos, lancamentos: lancs };
}

export async function responsaveisMarketing() {
  return q(
    `SELECT DISTINCT u.id, u.nome FROM users u JOIN user_department_assignments a ON a.user_id=u.id
       JOIN departments d ON d.id=a.department_id WHERE d.slug='marketing' AND u.ativo ORDER BY u.nome`
  );
}
