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
