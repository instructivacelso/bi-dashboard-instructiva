import { q, q1 } from './db.js';
import { consolidarProdutividade, ETAPAS_CONTEUDO } from './academico.js';
import { dividir } from './calc.js';

export const professores = () => q(`SELECT t.*, u.nome login, g.nome gestor FROM academic_teachers t LEFT JOIN users u ON u.id=t.user_id LEFT JOIN users g ON g.id=t.gestor_id ORDER BY t.ativo DESC, t.nome`);
export const professor = (id) => q1('SELECT * FROM academic_teachers WHERE id=$1', [id]);

export async function numerosAcademico(desde, ate, userId = null) {
  const p = userId ? [desde, ate, userId] : [desde, ate];
  const filtroU = userId ? 'AND f.user_id=$3' : '';
  const [diarios, porProf, pipeline, prazos, profs] = await Promise.all([
    q(`SELECT * FROM academic_daily_forms f WHERE f.data_ref BETWEEN $1 AND $2 ${filtroU}`, p),
    q(`SELECT f.user_id, u.nome, COUNT(*)::int dias,
              SUM(f.horas) horas, SUM(f.grav_aulas)::int aulas, SUM(f.criativos_produzidos)::int criativos, SUM(f.mat_paginas_novas)::int paginas,
              SUM(f.live_realizadas)::int lives, SUM(f.vnd_qtd)::int vendas, SUM(f.vnd_valor) receita, SUM(f.sup_chamados)::int chamados
         FROM academic_daily_forms f JOIN users u ON u.id=f.user_id WHERE f.data_ref BETWEEN $1 AND $2 ${filtroU} GROUP BY f.user_id, u.nome ORDER BY horas DESC NULLS LAST`, p),
    q(`SELECT etapa, COUNT(*)::int n FROM academic_content WHERE etapa <> 'arquivado' GROUP BY etapa`),
    q1(`SELECT COUNT(*) FILTER (WHERE prazo IS NOT NULL AND prazo < CURRENT_DATE AND etapa NOT IN ('publicacao','arquivado'))::int atrasados,
               COUNT(*) FILTER (WHERE prazo BETWEEN CURRENT_DATE AND CURRENT_DATE + 3 AND etapa NOT IN ('publicacao','arquivado'))::int proximos FROM academic_content`),
    q1(`SELECT COUNT(*) FILTER (WHERE status='ativo')::int ativos, COUNT(*)::int total FROM academic_teachers`),
  ]);
  const cons = consolidarProdutividade(diarios);
  const board = Object.fromEntries(Object.keys(ETAPAS_CONTEUDO).map((e) => [e, 0]));
  for (const r of pipeline) board[r.etapa] = r.n;
  const emProducao = Object.entries(board).filter(([e]) => e !== 'arquivado').reduce((s, [, n]) => s + n, 0);
  return {
    diasComEnvio: diarios.length, professoresAtivos: profs.ativos, professoresTotal: profs.total,
    cons, board, emProducao, atrasados: prazos.atrasados, proximos: prazos.proximos,
    porProfessor: porProf.map((x) => ({ ...x, horas: Number(x.horas || 0), receita: Number(x.receita || 0), conversao: dividir(x.vendas, x.chamados) })),
  };
}

export const pipelineBoard = () => q(`SELECT c.*, p.nome produto, u.nome responsavel FROM academic_content c LEFT JOIN products p ON p.id=c.product_id LEFT JOIN users u ON u.id=c.responsavel_id WHERE c.etapa <> 'arquivado' ORDER BY c.prioridade DESC, c.prazo NULLS LAST, c.id`);
export const diarioProfessorDoDia = (userId, dia) => q1('SELECT * FROM academic_daily_forms WHERE user_id=$1 AND data_ref=$2', [userId, dia]);
export const metasProfessor = (userId) => q1('SELECT * FROM academic_goals WHERE user_id=$1', [userId]);

// ---------- Etapa 2: qualidade, marketing por professor, pontuação ----------
import { resumoQualidade, resultadoMarketing, pontuacao } from './academico.js';

const qualidadeLinhas = (desde, ate, userId = null) => q(
  `SELECT a.*, (a.created_at AT TIME ZONE 'America/Sao_Paulo')::date::text AS dia, c.titulo, c.responsavel_id FROM academic_quality a JOIN academic_content c ON c.id=a.content_id
    WHERE a.created_at::date BETWEEN $1 AND $2 ${userId ? 'AND c.responsavel_id=$3' : ''} ORDER BY a.created_at, a.id`,
  userId ? [desde, ate, userId] : [desde, ate]);

export async function qualidadePeriodo(desde, ate, userId = null) {
  const linhas = await qualidadeLinhas(desde, ate, userId);
  return { ...resumoQualidade(linhas), linhas: [...linhas].reverse() };
}

export const conteudosParaAvaliar = () => q(`SELECT c.*, p.nome produto, u.nome responsavel FROM academic_content c LEFT JOIN products p ON p.id=c.product_id LEFT JOIN users u ON u.id=c.responsavel_id
  WHERE c.etapa IN ('revisao','ajustes','aprovacao') ORDER BY c.prazo NULLS LAST, c.id`);

// Resultados de marketing dos lançamentos em que o professor aparece (pelo nome cadastrado no lançamento)
export async function marketingDoProfessor(nome, desde, ate) {
  if (!nome) return resultadoMarketing();
  const r = await q1(`
    WITH l AS (SELECT id, product_id FROM launches WHERE professor IS NOT NULL AND lower(professor) LIKE '%' || lower($1) || '%')
    SELECT (SELECT COALESCE(SUM(t.valor_gasto),0) FROM traffic_daily_entries t WHERE t.launch_id IN (SELECT id FROM l) AND t.data_ref BETWEEN $2 AND $3)
         + (SELECT COALESCE(SUM(w.custo_disparos),0) FROM whatsapp_daily_entries w WHERE w.launch_id IN (SELECT id FROM l) AND w.data_ref BETWEEN $2 AND $3) investimento,
           (SELECT COALESCE(SUM(t.cadastros),0) FROM traffic_daily_entries t WHERE t.launch_id IN (SELECT id FROM l) AND t.data_ref BETWEEN $2 AND $3) leads,
           (SELECT COALESCE(SUM(s.valor),0) FROM sales s WHERE s.product_id IN (SELECT product_id FROM l WHERE product_id IS NOT NULL) AND s.status<>'cancelada' AND s.data_ref BETWEEN $2 AND $3) receita`,
    [nome, desde, ate]);
  return resultadoMarketing({ investimento: Number(r.investimento), leads: Number(r.leads), receita: Number(r.receita) });
}

export const pesosPontuacao = async () => Object.fromEntries((await q('SELECT chave, peso FROM academic_weights')).map((r) => [r.chave, Number(r.peso)]));
export const pontuacaoAtiva = async () => (await q1(`SELECT valor FROM configuracoes WHERE chave='academico_pontuacao_ativa'`))?.valor === 'true';

// Pontuação por professor no período (usa os diários consolidados + qualidade)
export async function pontuacaoPorProfessor(desde, ate) {
  const [pesos, linhas] = await Promise.all([pesosPontuacao(), q(`SELECT DISTINCT f.user_id, u.nome FROM academic_daily_forms f JOIN users u ON u.id=f.user_id WHERE f.data_ref BETWEEN $1 AND $2 ORDER BY u.nome`, [desde, ate])]);
  const out = [];
  for (const l of linhas) {
    const [n, qual] = await Promise.all([numerosAcademico(desde, ate, l.user_id), qualidadePeriodo(desde, ate, l.user_id)]);
    out.push({ user_id: l.user_id, nome: l.nome, ...pontuacao(n.cons, pesos, qual), qualidade: qual.notaMedia });
  }
  return out.sort((a, b) => b.total - a.total);
}
