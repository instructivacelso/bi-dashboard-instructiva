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
  const atribuidos = await q(
    `SELECT DISTINCT ${CAMPOS_LANC} FROM launches l
       LEFT JOIN products p ON p.id=l.product_id
       LEFT JOIN launch_user_assignments a ON a.launch_id=l.id
      WHERE a.user_id=$1 OR l.gerente_id=$1
      ORDER BY l.id DESC`,
    [u.id]
  );
  if (atribuidos.length) return atribuidos;
  // Sem atribuição específica: vê todos os lançamentos (a restrição é opcional, feita no cadastro do lançamento)
  return q(`SELECT ${CAMPOS_LANC} FROM launches l LEFT JOIN products p ON p.id=l.product_id WHERE l.status <> 'cancelado' ORDER BY l.id DESC`);
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

// Plataformas de tráfego da pessoa no lançamento (padrão: Meta Ads)
export async function plataformasDo(userId, launchId) {
  const r = await q1('SELECT plataformas FROM launch_user_assignments WHERE user_id=$1 AND launch_id=$2', [userId, launchId]);
  return r?.plataformas?.length ? r.plataformas : ['Meta Ads'];
}

// Formulários do dia para o usuário, com status pendente/concluído e horário do último envio
export async function tarefasDoDia(u, hoje) {
  const forms = formulariosDo(u);
  if (!forms.length) return [];
  const lancs = await lancamentosDoUsuario(u);
  const tarefas = [];
  for (const form of forms) {
    const f = FORMULARIOS[form];
    const aplicaveis = lancs.filter((l) => formularioAplicavel(form, l, hoje));
    if (!aplicaveis.length) {
      tarefas.push({ form, titulo: f.titulo, lancamento: null, concluido: false, aguardando: true, registroId: null, ultimoEnvio: null, detalhe: null });
      continue;
    }
    const feitos = await q(
      `SELECT id, launch_id, updated_at ${form === 'trafego' ? ', plataforma' : ''} FROM ${f.tabela} WHERE data_ref=$1 ${f.porUsuario ? 'AND created_by=$2' : ''}`,
      f.porUsuario ? [hoje, u.id] : [hoje]
    );
    for (const l of aplicaveis) {
      const doLanc = feitos.filter((x) => x.launch_id === l.id);
      let concluido = doLanc.length > 0;
      let detalhe = null;
      if (form === 'trafego') {
        const pls = await plataformasDo(u.id, l.id);
        const feitas = pls.filter((p) => doLanc.some((x) => x.plataforma === p)).length;
        concluido = feitas === pls.length;
        if (pls.length > 1) detalhe = `${feitas} de ${pls.length} plataformas`;
      }
      const ultimo = doLanc.reduce((m, x) => (!m || x.updated_at > m ? x.updated_at : m), null);
      tarefas.push({ form, titulo: f.titulo, lancamento: l, concluido, registroId: doLanc[0]?.id || null, ultimoEnvio: ultimo, detalhe });
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
    for (const t of tarefas) if (!t.aguardando) lista.push({ usuario: u.nome, usuarioId: u.id, ...t });
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
        `SELECT i.*, l.nome AS lancamento, c.nome AS autor, r.nome AS responsavel FROM automation_incidents i
           JOIN launches l ON l.id=i.launch_id JOIN users c ON c.id=i.created_by LEFT JOIN users r ON r.id=i.responsavel_id
          WHERE i.status <> 'resolvido'
          ORDER BY CASE i.prioridade WHEN 'critica' THEN 0 WHEN 'alta' THEN 1 WHEN 'media' THEN 2 ELSE 3 END, i.id DESC`
      )
    : [];
  return { acoes, incidentes };
}

// ---------------- Histórico ----------------
const RESUMOS = {
  trafego: `t.plataforma || ' · gasto R$ ' || t.valor_gasto || ' · ' || t.cadastros || ' cadastros'`,
  whatsapp: `(t.entradas_api + COALESCE(t.entradas_pagina,0) + t.entradas_organico) || ' entradas · ' || t.total_grupos || ' nos grupos'`,
  automacao: `CASE WHEN t.houve_problema THEN 'Com falha' ELSE 'Tudo funcionando' END`,
  editor: `COALESCE(t.titulo, t.tipo_entrega) || ' · ' || t.quantidade || COALESCE('/' || t.quantidade_planejada, '') || ' · ' || replace(t.situacao,'_',' ')`,
  live: `t.participantes_unicos || ' na live · ' || t.lista_reserva || ' na lista'`,
  gerente: `'Situação ' || t.situacao || COALESCE(' · gargalo: ' || NULLIF(t.gargalo,'nenhum'), '')`,
};

export async function historico({ autorId = null, launchIds = null, form = null, desde = null, ate = null, status = null, limite = 300 }) {
  const params = [];
  const cond = [];
  if (autorId) { params.push(autorId); cond.push(`t.created_by = $${params.length}`); }
  if (launchIds) { params.push(launchIds); cond.push(`t.launch_id = ANY($${params.length})`); }
  if (desde) { params.push(desde); cond.push(`t.data_ref >= $${params.length}`); }
  if (ate) { params.push(ate); cond.push(`t.data_ref <= $${params.length}`); }
  if (status === 'editado') cond.push('t.updated_by IS NOT NULL');
  if (status === 'enviado') cond.push('t.updated_by IS NULL');
  const where = cond.length ? 'WHERE ' + cond.join(' AND ') : '';
  const partes = Object.entries(FORMULARIOS)
    .filter(([chave]) => !form || form === chave)
    .map(([chave, f]) =>
      `SELECT '${chave}' AS form, t.id, t.data_ref, t.launch_id, l.nome AS lancamento, ${RESUMOS[chave]} AS resumo,
              t.created_by, c.nome AS autor, t.created_at, t.updated_at, t.updated_by
         FROM ${f.tabela} t JOIN launches l ON l.id=t.launch_id JOIN users c ON c.id=t.created_by ${where}`
    );
  return q(`${partes.join(' UNION ALL ')} ORDER BY data_ref DESC, created_at DESC LIMIT ${Number(limite)}`, params);
}

// ---------------- Dashboard do Marketing ----------------
const CAMPOS_ETAPAS = ['pagina_ok', 'formulario_ok', 'whatsapp_ok', 'checkout_ok', 'obrigado_ok', 'boas_vindas_ok', 'conta_ok', 'grupo_ok', 'orientacao_ok'];

export async function dashboardMarketing({ desde, ate, launchIds, responsavelId }) {
  const P = [desde, ate, launchIds];
  const fr = responsavelId ? ` AND created_by=${Number(responsavelId)}` : '';
  const periodo = `data_ref BETWEEN $1 AND $2 AND launch_id = ANY($3) ${fr}`;
  const n = (v) => (v === null || v === undefined ? null : Number(v));

  const [traf, trafDia, trafAnt, whats, grupos, live, com, editor, autos, gerentes] = await Promise.all([
    q1(`SELECT SUM(orcamento_dia) orc, SUM(valor_gasto) gasto, SUM(impressoes) imp, SUM(cliques) cli, SUM(visitas) vis, SUM(cadastros) cad,
               AVG(tempo_carregamento) tempo, COUNT(*)::int n FROM traffic_daily_entries WHERE ${periodo}`, P),
    q1(`SELECT SUM(orcamento_dia) orc, SUM(valor_gasto) gasto, COUNT(*)::int n FROM traffic_daily_entries WHERE data_ref=$1 AND launch_id = ANY($2) ${fr}`, [ate, launchIds]),
    q1(`SELECT SUM(valor_gasto) gasto, COUNT(*)::int n FROM traffic_daily_entries WHERE data_ref=($1::date - 1) AND launch_id = ANY($2) ${fr}`, [ate, launchIds]),
    q1(`SELECT SUM(convites_api) conv, SUM(convites_entregues) entreg, SUM(entradas_api) api, SUM(entradas_pagina) pag, SUM(entradas_organico) org,
               SUM(saidas) sai, SUM(custo_disparos) custo, COUNT(*)::int n FROM whatsapp_daily_entries WHERE ${periodo}`, P),
    q1(`SELECT SUM(total_grupos) total, SUM(grupos_ativos) ativos, COUNT(*)::int n FROM (
          SELECT DISTINCT ON (launch_id) launch_id, total_grupos, grupos_ativos FROM whatsapp_daily_entries WHERE ${periodo}
           ORDER BY launch_id, data_ref DESC, updated_at DESC) x`, P),
    q1(`SELECT SUM(participantes_unicos) part, SUM(pessoas_pitch) pitch, SUM(cliques_oferta) cli, SUM(lista_reserva) lista,
               SUM(checkouts_iniciados) chk, COUNT(*)::int n FROM live_results WHERE ${periodo}`, P),
    q1(`SELECT SUM(vendas) vendas, SUM(faturamento) fat, COUNT(*)::int n FROM commercial_launch_results WHERE data_ref BETWEEN $1 AND $2 AND launch_id = ANY($3)`, P),
    q1(`SELECT SUM(quantidade_planejada) plan, SUM(quantidade) conc, COUNT(*) FILTER (WHERE situacao='atrasado')::int atrasadas, COUNT(*)::int n
          FROM editor_daily_entries WHERE ${periodo}`, P),
    q(`SELECT DISTINCT ON (launch_id) * FROM automation_daily_entries WHERE ${periodo} ORDER BY launch_id, data_ref DESC, updated_at DESC`, P),
    q(`SELECT DISTINCT ON (m.launch_id) m.*, l.nome lancamento FROM manager_daily_closings m JOIN launches l ON l.id=m.launch_id
        WHERE m.data_ref BETWEEN $1 AND $2 AND m.launch_id = ANY($3) ORDER BY m.launch_id, m.data_ref DESC`, P),
  ]);

  const temT = traf.n > 0, temW = whats.n > 0, temL = live.n > 0, temC = com.n > 0;
  const totais = {
    orcamentoPrevisto: temT ? n(traf.orc) : null, investimento: temT ? n(traf.gasto) : null,
    impressoes: temT ? n(traf.imp) : null, cliques: temT ? n(traf.cli) : null, visitas: temT ? n(traf.vis) : null,
    cadastros: temT ? n(traf.cad) : null, tempoCarregamento: temT ? n(traf.tempo) : null,
    orcamentoDia: trafDia.n ? n(trafDia.orc) : null, investimentoDia: trafDia.n ? n(trafDia.gasto) : null,
    investimentoOntem: trafAnt.n ? n(trafAnt.gasto) : null,
    convites: temW ? n(whats.conv) : null, convitesEntregues: temW ? n(whats.entreg) : null,
    entradasApi: temW ? n(whats.api) : null, entradasPagina: temW ? n(whats.pag) : null, entradasOrganico: temW ? n(whats.org) : null,
    saidas: temW ? n(whats.sai) : null, custoDisparos: temW ? n(whats.custo) : null,
    grupos: grupos.n ? n(grupos.total) : null, gruposAtivos: grupos.n ? n(grupos.ativos) : null,
    live: temL ? n(live.part) : null, pitch: temL ? n(live.pitch) : null, cliquesOferta: temL ? n(live.cli) : null,
    lista: temL ? n(live.lista) : null, checkouts: temL ? n(live.chk) : null,
    vendas: temC ? n(com.vendas) : null, faturamento: temC ? n(com.fat) : null,
    entregasPlanejadas: editor.n ? n(editor.plan) : null, entregasConcluidas: editor.n ? n(editor.conc) : null,
    entregasAtrasadas: editor.n ? editor.atrasadas : null,
  };
  totais.saldoGrupos = temW ? (totais.entradasApi + totais.entradasPagina + totais.entradasOrganico - totais.saidas) : null;

  // Automação: etapas funcionando no último fechamento de cada lançamento
  let etapasOk = 0, etapasVistas = 0;
  for (const a of autos) for (const c of CAMPOS_ETAPAS) if (a[c] !== null) { etapasVistas++; if (a[c]) etapasOk++; }
  totais.saudeAutomacao = etapasVistas ? etapasOk / etapasVistas : null;

  const lancs = launchIds.length
    ? await q(`SELECT l.*, p.nome produto, g.nome gerente FROM launches l LEFT JOIN products p ON p.id=l.product_id LEFT JOIN users g ON g.id=l.gerente_id WHERE l.id = ANY($1) AND l.status <> 'cancelado' ORDER BY l.id DESC`, [launchIds])
    : [];
  const somaMeta = (c) => { const v = lancs.filter((l) => l[c] != null); return v.length ? v.reduce((t, l) => t + Number(l[c]), 0) : null; };
  const metas = {
    cadastros: somaMeta('meta_cadastros'), grupos: somaMeta('meta_grupos'), live: somaMeta('meta_live'),
    lista: somaMeta('meta_lista'), vendas: somaMeta('meta_vendas'), faturamento: somaMeta('meta_faturamento'), orcamento: somaMeta('orcamento'),
    cplMax: lancs.length === 1 ? lancs[0].cpl_max : null, cacMax: lancs.length === 1 ? lancs[0].cac_max : null, roasMin: lancs.length === 1 ? lancs[0].roas_min : null,
  };

  const indicadores = indicadoresMarketing(totais);
  const funil = montarFunil(totais, metas);

  const serieRows = await q(
    `SELECT data_ref, SUM(valor_gasto) investimento, SUM(cadastros) cadastros FROM traffic_daily_entries WHERE ${periodo} GROUP BY data_ref ORDER BY data_ref`, P);
  const porDia = Object.fromEntries(serieRows.map((r) => [r.data_ref, r]));
  const serie = diasEntre(desde, ate).map((d) => {
    const r = porDia[d];
    return { data: d, investimento: r ? n(r.investimento) : null, cadastros: r ? n(r.cadastros) : null, cpl: r ? dividir(r.investimento, r.cadastros) : null };
  });

  const porLancamento = launchIds.length
    ? await q(
        `SELECT l.id, l.nome, l.status, l.meta_cadastros, l.cpl_max, l.orcamento, COALESCE(t.gasto,0) gasto, COALESCE(t.cad,0) cadastros,
                m.situacao, m.data_ref AS situacao_data
           FROM launches l
           LEFT JOIN (SELECT launch_id, SUM(valor_gasto) gasto, SUM(cadastros) cad FROM traffic_daily_entries WHERE data_ref BETWEEN $1 AND $2 GROUP BY launch_id) t ON t.launch_id=l.id
           LEFT JOIN LATERAL (SELECT situacao, data_ref FROM manager_daily_closings WHERE launch_id=l.id ORDER BY data_ref DESC LIMIT 1) m ON true
          WHERE l.id = ANY($3) AND l.status <> 'cancelado' ORDER BY l.id DESC`, P)
    : [];

  return { totais, metas, indicadores, funil, serie, porLancamento, gerentes, lancamentos: lancs };
}

export async function responsaveisMarketing() {
  return q(
    `SELECT DISTINCT u.id, u.nome FROM users u JOIN user_department_assignments a ON a.user_id=u.id
       JOIN departments d ON d.id=a.department_id WHERE d.slug='marketing' AND u.ativo ORDER BY u.nome`
  );
}
