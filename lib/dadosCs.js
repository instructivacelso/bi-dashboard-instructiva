import { q, q1 } from './db.js';
import { healthScore, nps, csat } from './cscx.js';
import { dividir } from './calc.js';
import { hoje } from './datas.js';

const TZ = `'America/Sao_Paulo'`;
const entre = (col) => `${col} >= ($1::date)::timestamp AT TIME ZONE ${TZ} AND ${col} < (($2::date + 1))::timestamp AT TIME ZONE ${TZ}`;

export const regraAtiva = () => q1('SELECT * FROM cs_health_rules WHERE ativa ORDER BY versao DESC LIMIT 1');

async function contexto(db, csAlunoId) {
  const r = (sql) => db.query(sql, [csAlunoId]).then((x) => x.rows[0]);
  const [pesq, recl, canc, cont] = await Promise.all([
    r(`SELECT escala, nota FROM cs_registros WHERE cs_aluno_id=$1 AND tipo='pesquisa' ORDER BY created_at DESC LIMIT 1`),
    r(`SELECT COUNT(*)::int n FROM cs_registros WHERE cs_aluno_id=$1 AND tipo='voz' AND subtipo='reclamacao' AND status <> 'resolvida'`),
    r(`SELECT COUNT(*)::int n FROM cs_registros WHERE cs_aluno_id=$1 AND tipo='cancelamento' AND status IN ('solicitado','em_retencao')`),
    r(`SELECT status FROM cs_registros WHERE cs_aluno_id=$1 AND tipo='contato' ORDER BY created_at DESC LIMIT 1`),
  ]);
  return { ultimaPesquisa: pesq || null, reclamacoesAbertas: recl.n, cancelamentoAberto: canc.n > 0, ultimoContato: cont?.status || null };
}

// Recalcula e guarda o health score (com a versão da regra) — usar dentro de uma transação
export async function recalcularHealth(db, csAlunoId) {
  const regra = (await db.query('SELECT * FROM cs_health_rules WHERE ativa ORDER BY versao DESC LIMIT 1')).rows[0];
  const aluno = (await db.query('SELECT * FROM cs_alunos WHERE id=$1', [csAlunoId])).rows[0];
  if (!aluno || !regra) return null;
  const h = healthScore(aluno, await contexto(db, csAlunoId), regra, hoje());
  await db.query('UPDATE cs_alunos SET health_score=$1, faixa=$2, regra_versao=$3, health_em=now() WHERE id=$4', [h.score, h.faixa, regra.versao, csAlunoId]);
  await db.query('INSERT INTO cs_health_history (cs_aluno_id, score, faixa, regra_versao, componentes) VALUES ($1,$2,$3,$4,$5)', [csAlunoId, h.score, h.faixa, regra.versao, JSON.stringify(h.componentes)]);
  return h;
}

export async function equipeCs() {
  return q(`SELECT DISTINCT x.id, x.nome FROM users x JOIN user_department_assignments a ON a.user_id=x.id JOIN departments d ON d.id=a.department_id WHERE x.ativo AND d.slug='cscx' ORDER BY x.nome`);
}

export async function carteira(u, veTudo, f = {}) {
  const cond = []; const p = [];
  if (!veTudo) { p.push(u.id); cond.push(`c.responsavel_id=$${p.length}`); }
  if (f.faixa) { p.push(f.faixa); cond.push(`c.faixa=$${p.length}`); }
  if (f.matricula) { p.push(f.matricula); cond.push(`c.matricula=$${p.length}`); }
  if (f.produto) { p.push(f.produto); cond.push(`c.product_id=$${p.length}`); }
  if (f.responsavel) { p.push(f.responsavel); cond.push(`c.responsavel_id=$${p.length}`); }
  if (f.busca) { p.push(`%${f.busca}%`); cond.push(`(s.nome ILIKE $${p.length} OR s.email ILIKE $${p.length} OR s.telefone ILIKE $${p.length})`); }
  return q(
    `SELECT c.*, s.nome, s.email, s.telefone, pr.nome produto, r.nome responsavel FROM cs_alunos c JOIN students s ON s.id=c.student_id
       LEFT JOIN products pr ON pr.id=c.product_id LEFT JOIN users r ON r.id=c.responsavel_id
      ${cond.length ? 'WHERE ' + cond.join(' AND ') : ''}
      ORDER BY CASE c.faixa WHEN 'critico' THEN 0 WHEN 'risco' THEN 1 WHEN 'atencao' THEN 2 ELSE 3 END, c.health_score NULLS FIRST, s.nome LIMIT 500`, p);
}

export async function alunoCompleto(id) {
  const a = await q1(`SELECT c.*, s.nome, s.email, s.telefone, pr.nome produto, r.nome responsavel FROM cs_alunos c JOIN students s ON s.id=c.student_id
                       LEFT JOIN products pr ON pr.id=c.product_id LEFT JOIN users r ON r.id=c.responsavel_id WHERE c.id=$1`, [id]);
  if (!a) return null;
  a.registros = await q('SELECT g.*, x.nome autor FROM cs_registros g LEFT JOIN users x ON x.id=g.created_by WHERE g.cs_aluno_id=$1 ORDER BY g.created_at DESC', [id]);
  a.historico = await q('SELECT score, faixa, regra_versao, created_at FROM cs_health_history WHERE cs_aluno_id=$1 ORDER BY created_at DESC LIMIT 10', [id]);
  return a;
}

// Números consolidados (base agora + movimentos no período)
export async function numerosCs(desde, ate) {
  const p = [desde, ate];
  const [base, porCurso, onb, eng, faixas, cursoRisco, pesq, voz, vozCat, canc, oport, promotores] = await Promise.all([
    q1(`SELECT COUNT(*) FILTER (WHERE matricula='ativa')::int ativos, COUNT(*) FILTER (WHERE matricula='suspensa')::int suspensos,
               COUNT(*) FILTER (WHERE matricula='cancelada')::int cancelados, COUNT(*) FILTER (WHERE matricula='concluida')::int concluidos,
               COUNT(*) FILTER (WHERE ${entre('created_at')})::int novos, COUNT(*)::int total FROM cs_alunos`, p),
    q(`SELECT COALESCE(pr.nome,'Sem curso') chave, COUNT(*)::int n FROM cs_alunos c LEFT JOIN products pr ON pr.id=c.product_id WHERE c.matricula='ativa' GROUP BY 1 ORDER BY n DESC LIMIT 8`),
    q1(`SELECT COUNT(*)::int compras, COUNT(*) FILTER (WHERE boas_vindas)::int boas_vindas, COUNT(*) FILTER (WHERE acesso_liberado_em IS NOT NULL)::int liberados,
               COUNT(*) FILTER (WHERE orientado)::int orientados, COUNT(*) FILTER (WHERE entrou_grupo)::int no_grupo, COUNT(*) FILTER (WHERE primeiro_acesso_em IS NOT NULL)::int acessaram,
               COUNT(*) FILTER (WHERE iniciou_curso)::int iniciaram, AVG(acesso_liberado_em - compra_em) dias_acesso
          FROM cs_alunos WHERE compra_em BETWEEN $1 AND $2`, p),
    q1(`SELECT COUNT(*) FILTER (WHERE matricula='ativa' AND ultimo_acesso >= $2::date - 7)::int engajados,
               COUNT(*) FILTER (WHERE matricula='ativa' AND (ultimo_acesso IS NULL OR ultimo_acesso < $2::date - 15))::int inativos,
               COUNT(*) FILTER (WHERE matricula='ativa' AND primeiro_acesso_em IS NULL)::int nunca_acessaram,
               AVG(progresso) FILTER (WHERE matricula='ativa') progresso_medio, COUNT(*) FILTER (WHERE progresso >= 100 OR matricula='concluida')::int concluiram,
               COUNT(*) FILTER (WHERE matricula='ativa' AND progresso >= 50)::int progredindo
          FROM cs_alunos WHERE $1::date IS NOT NULL`, p),
    q(`SELECT faixa, COUNT(*)::int n, COALESCE(SUM(valor_contrato),0) valor, AVG(health_score) media FROM cs_alunos WHERE matricula='ativa' GROUP BY faixa`),
    q(`SELECT COALESCE(pr.nome,'Sem curso') chave, COUNT(*)::int n FROM cs_alunos c LEFT JOIN products pr ON pr.id=c.product_id WHERE c.matricula='ativa' AND c.faixa IN ('risco','critico') GROUP BY 1 ORDER BY n DESC LIMIT 5`),
    q(`SELECT escala, nota, categoria FROM cs_registros WHERE tipo='pesquisa' AND ${entre('created_at')}`, p),
    q1(`SELECT COUNT(*) FILTER (WHERE subtipo='reclamacao')::int reclamacoes, COUNT(*) FILTER (WHERE subtipo='elogio')::int elogios, COUNT(*) FILTER (WHERE subtipo='sugestao')::int sugestoes,
               COUNT(*) FILTER (WHERE gravidade='grave')::int graves, COUNT(*) FILTER (WHERE status <> 'resolvida' AND subtipo='reclamacao')::int abertas, COUNT(*) FILTER (WHERE voz_cliente)::int voz_cliente
          FROM cs_registros WHERE tipo='voz' AND ${entre('created_at')}`, p),
    q(`SELECT COALESCE(categoria,'Sem etapa') chave, COUNT(*)::int n FROM cs_registros WHERE tipo='voz' AND subtipo='reclamacao' AND ${entre('created_at')} GROUP BY 1 ORDER BY n DESC LIMIT 5`, p),
    q1(`SELECT COUNT(*) FILTER (WHERE subtipo='cancelamento')::int pedidos_cancelamento, COUNT(*) FILTER (WHERE subtipo='reembolso')::int pedidos_reembolso,
               COUNT(*) FILTER (WHERE status IN ('em_retencao','recuperado','concluido'))::int trabalhados, COUNT(*) FILTER (WHERE status='recuperado')::int recuperados,
               COUNT(*) FILTER (WHERE status='concluido')::int concluidos, COALESCE(SUM(valor) FILTER (WHERE status='recuperado'),0) preservada,
               COALESCE(SUM(valor) FILTER (WHERE status='concluido'),0) perdida, COUNT(*) FILTER (WHERE status IN ('solicitado','em_retencao'))::int abertos
          FROM cs_registros WHERE tipo='cancelamento' AND ${entre('created_at')}`, p),
    q1(`SELECT COUNT(*) FILTER (WHERE subtipo='indicacao')::int indicacao, COUNT(*) FILTER (WHERE subtipo='renovacao')::int renovacao, COUNT(*) FILTER (WHERE subtipo='upsell')::int upsell,
               COUNT(*) FILTER (WHERE subtipo='crosssell')::int crosssell, COUNT(*) FILTER (WHERE status IN ('encaminhada','convertida'))::int encaminhadas,
               COUNT(*) FILTER (WHERE subtipo='indicacao' AND status IN ('encaminhada','convertida'))::int para_indicacao,
               COUNT(*) FILTER (WHERE status='convertida')::int convertidas, COALESCE(SUM(valor) FILTER (WHERE status='convertida'),0) receita
          FROM cs_registros WHERE tipo='oportunidade' AND ${entre('created_at')}`, p),
    q1(`SELECT COUNT(DISTINCT cs_aluno_id)::int n FROM cs_registros WHERE tipo='pesquisa' AND escala='nps' AND nota >= 9 AND ${entre('created_at')}`, p),
  ]);
  const notasNps = pesq.filter((x) => x.escala === 'nps').map((x) => x.nota);
  const notasCsat = pesq.filter((x) => x.escala === 'csat').map((x) => x.nota);
  const notasCes = pesq.filter((x) => x.escala === 'ces').map((x) => x.nota);
  const fx = Object.fromEntries(faixas.map((f) => [f.faixa || 'sem', f]));
  const ativos = base.ativos;
  return {
    ...base, porCurso,
    onboarding: { ...onb, dias_acesso: onb.dias_acesso !== null ? Number(onb.dias_acesso) : null, taxaAtivacao: dividir(onb.iniciaram, onb.compras), taxaPrimeiroAcesso: dividir(onb.acessaram, onb.liberados), onboardingConcluido: dividir(onb.orientados, onb.compras) },
    engajamento: { ...eng, progresso_medio: eng.progresso_medio !== null ? Number(eng.progresso_medio) : null, taxaEngajamento: dividir(eng.engajados, ativos), taxaInatividade: dividir(eng.inativos, ativos) },
    health: {
      saudavel: fx.saudavel?.n || 0, atencao: fx.atencao?.n || 0, risco: fx.risco?.n || 0, critico: fx.critico?.n || 0, semCalculo: fx.sem?.n || 0,
      valorEmRisco: Number(fx.risco?.valor || 0) + Number(fx.critico?.valor || 0),
      media: faixas.length ? faixas.reduce((s, f) => s + Number(f.media || 0) * f.n, 0) / Math.max(faixas.reduce((s, f) => s + (f.media !== null ? f.n : 0), 0), 1) : null,
      cursosRisco: cursoRisco,
    },
    satisfacao: { respostas: pesq.length, ...nps(notasNps), csat: csat(notasCsat), ces: notasCes.length ? notasCes.reduce((s, n) => s + n, 0) / notasCes.length : null },
    voz: { ...voz, taxaReclamacao: dividir(voz.reclamacoes, ativos), categorias: vozCat },
    retencao: { ...canc, preservada: Number(canc.preservada), perdida: Number(canc.perdida), taxaRecuperacao: dividir(canc.recuperados, canc.trabalhados), taxaCancelamento: dividir(canc.concluidos, ativos) },
    expansao: { ...oport, receita: Number(oport.receita), promotores: promotores.n, conversaoIndicacao: dividir(oport.para_indicacao, promotores.n), conversaoExpansao: dividir(oport.convertidas, oport.encaminhadas) },
  };
}

export async function desempenhoCs(desde, ate) {
  return q(
    `SELECT x.id, x.nome,
            (SELECT COUNT(*) FROM cs_alunos c WHERE c.responsavel_id=x.id AND c.matricula='ativa')::int carteira,
            (SELECT COUNT(*) FROM cs_alunos c WHERE c.responsavel_id=x.id AND c.faixa IN ('risco','critico') AND c.matricula='ativa')::int em_risco,
            COUNT(g.id) FILTER (WHERE g.tipo='contato')::int contatos,
            COUNT(g.id) FILTER (WHERE g.tipo='cancelamento' AND g.status='recuperado')::int recuperados,
            COALESCE(SUM(g.valor) FILTER (WHERE g.tipo='cancelamento' AND g.status='recuperado'),0) preservada,
            COUNT(g.id) FILTER (WHERE g.tipo='voz' AND g.status='resolvida')::int resolvidos,
            COUNT(g.id) FILTER (WHERE g.tipo='oportunidade' AND g.status IN ('encaminhada','convertida'))::int oportunidades,
            (SELECT COUNT(*) FROM cs_registros v JOIN cs_alunos c ON c.id=v.cs_aluno_id WHERE c.responsavel_id=x.id AND v.tipo='voz' AND v.status <> 'resolvida' AND v.subtipo='reclamacao')::int pendencias,
            (SELECT AVG(nota) FROM cs_registros v JOIN cs_alunos c ON c.id=v.cs_aluno_id WHERE c.responsavel_id=x.id AND v.tipo='pesquisa' AND v.escala='nps') nps_carteira
       FROM users x JOIN user_department_assignments a ON a.user_id=x.id JOIN departments d ON d.id=a.department_id AND d.slug='cscx'
       LEFT JOIN cs_registros g ON g.created_by=x.id AND ${entre('g.created_at')}
      WHERE x.ativo AND NOT a.gerente GROUP BY x.id, x.nome ORDER BY recuperados DESC, contatos DESC`, [desde, ate]);
}
