import { q, q1 } from './db.js';
import { ABERTOS, situacaoSla, dentroSla, minutos, indicadoresSuporte, backlogFinal, rankingSuporte } from './suporte.js';
import { dividir } from './calc.js';

const TZ = `'America/Sao_Paulo'`;
// Início e fim do dia de referência no fuso de Brasília
const INI = (p) => `(${p}::date)::timestamp AT TIME ZONE ${TZ}`;
const FIM = (p) => `((${p}::date + 1))::timestamp AT TIME ZONE ${TZ}`;

export const regrasSla = () => q('SELECT * FROM support_sla ORDER BY CASE prioridade WHEN \'critica\' THEN 0 WHEN \'alta\' THEN 1 WHEN \'normal\' THEN 2 ELSE 3 END');

export async function atendentes() {
  return q(
    `SELECT DISTINCT x.id, x.nome, bool_or(a.gerente) OVER (PARTITION BY x.id) gerente FROM users x
       JOIN user_department_assignments a ON a.user_id=x.id JOIN departments d ON d.id=a.department_id
      WHERE x.ativo AND d.slug='suporte' ORDER BY x.nome`
  );
}

// Números do dia para um conjunto de atendentes (null = equipe toda)
export async function numerosSuporte(userIds, dia) {
  const filtroT = userIds ? 'AND t.responsavel_id = ANY($2)' : '';
  const filtroE = userIds ? 'AND e.user_id = ANY($2)' : '';
  const p = userIds ? [dia, userIds] : [dia];
  const um = (sql) => q1(sql, p);

  const [novos, herdados, reabertos, trab, prim, atualiz, resol, encer, confirmaram, abertosAgora, sla, cat, enc, encSetor, retornos, criticos, aval] = await Promise.all([
    um(`SELECT COUNT(*)::int n FROM support_tickets t WHERE t.aberto_em >= ${INI('$1')} AND t.aberto_em < ${FIM('$1')} ${filtroT}`),
    um(`SELECT COUNT(*)::int n FROM support_tickets t WHERE t.aberto_em < ${INI('$1')} ${filtroT}
          AND (t.status = ANY('{${ABERTOS.join(',')}}') OR COALESCE(t.encerrado_em, t.resolvido_em) >= ${INI('$1')})`),
    um(`SELECT COUNT(*)::int n FROM support_ticket_events e JOIN support_tickets t ON t.id=e.ticket_id WHERE e.evento='reaberto' AND e.created_at >= ${INI('$1')} AND e.created_at < ${FIM('$1')} ${filtroT}`),
    um(`SELECT COUNT(DISTINCT e.ticket_id)::int n FROM support_ticket_events e WHERE e.created_at >= ${INI('$1')} AND e.created_at < ${FIM('$1')} ${filtroE}`),
    um(`SELECT COUNT(*)::int n FROM support_ticket_events e WHERE e.evento='primeira_resposta' AND e.created_at >= ${INI('$1')} AND e.created_at < ${FIM('$1')} ${filtroE}`),
    um(`SELECT COUNT(*)::int n FROM support_ticket_events e WHERE e.created_at >= ${INI('$1')} AND e.created_at < ${FIM('$1')} ${filtroE}`),
    um(`SELECT COUNT(DISTINCT e.ticket_id)::int n FROM support_ticket_events e WHERE e.evento='resolvido' AND e.created_at >= ${INI('$1')} AND e.created_at < ${FIM('$1')} ${filtroE}`),
    um(`SELECT COUNT(DISTINCT e.ticket_id)::int n FROM support_ticket_events e WHERE e.evento='encerrado' AND e.created_at >= ${INI('$1')} AND e.created_at < ${FIM('$1')} ${filtroE}`),
    um(`SELECT COUNT(*)::int n FROM support_tickets t WHERE t.aluno_confirmou AND t.resolvido_em >= ${INI('$1')} AND t.resolvido_em < ${FIM('$1')} ${filtroT}`),
    q(`SELECT t.* FROM support_tickets t WHERE t.status = ANY('{${ABERTOS.join(',')}}') ${userIds ? 'AND t.responsavel_id = ANY($1)' : ''} ORDER BY t.aberto_em`, userIds ? [userIds] : []),
    q(`SELECT t.* FROM support_tickets t WHERE t.resolvido_em >= ${INI('$1')} AND t.resolvido_em < ${FIM('$1')} ${filtroT}`, p),
    q(`SELECT t.categoria, COUNT(DISTINCT t.id)::int n FROM support_ticket_events e JOIN support_tickets t ON t.id=e.ticket_id
        WHERE e.created_at >= ${INI('$1')} AND e.created_at < ${FIM('$1')} ${filtroE} GROUP BY t.categoria ORDER BY n DESC`, p),
    um(`SELECT COUNT(*)::int n FROM support_ticket_events e WHERE e.evento='encaminhado' AND e.created_at >= ${INI('$1')} AND e.created_at < ${FIM('$1')} ${filtroE}`),
    q(`SELECT e.para setor, COUNT(*)::int n FROM support_ticket_events e WHERE e.evento='encaminhado' AND e.created_at >= ${INI('$1')} AND e.created_at < ${FIM('$1')} ${filtroE} GROUP BY e.para ORDER BY n DESC`, p),
    um(`SELECT COUNT(*)::int n FROM support_ticket_events e WHERE e.evento='retorno' AND e.created_at >= ${INI('$1')} AND e.created_at < ${FIM('$1')} ${filtroE}`),
    um(`SELECT COUNT(*)::int n FROM support_tickets t WHERE t.prioridade='critica' AND t.status = ANY('{${ABERTOS.join(',')}}') ${userIds ? 'AND t.responsavel_id = ANY($2)' : ''} AND $1::date IS NOT NULL`),
    um(`SELECT COUNT(*) FILTER (WHERE satisfacao >= 4)::int pos, COUNT(*) FILTER (WHERE satisfacao <= 2)::int neg, AVG(satisfacao) media, COUNT(satisfacao)::int n
          FROM support_tickets t WHERE t.resolvido_em >= ${INI('$1')} AND t.resolvido_em < ${FIM('$1')} ${filtroT}`),
  ]);

  const agora = new Date();
  const vencidos = abertosAgora.filter((t) => situacaoSla(t, agora) === 'vencido');
  const tempos1 = sla.map((t) => minutos(t.aberto_em, t.primeira_resposta_em)).filter((x) => x !== null);
  const tempos2 = sla.map((t) => minutos(t.aberto_em, t.resolvido_em)).filter((x) => x !== null);
  const media = (a) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : null);
  const noPrazo = sla.filter(dentroSla).length;
  const aguardandoSetor = abertosAgora.filter((t) => t.status === 'aguardando_setor');
  const n = {
    novos: novos.n, herdados: herdados.n, reabertos: reabertos.n, disponivel: novos.n + herdados.n,
    trabalhados: trab.n, primeirasRespostas: prim.n, atualizacoes: atualiz.n,
    resolvidos: resol.n, encerrados: encer.n, confirmaram: confirmaram.n,
    backlogInicial: herdados.n, backlogFinal: abertosAgora.length,
    backlogCalculado: backlogFinal(herdados.n, novos.n, resol.n + encer.n),
    aguardandoAluno: abertosAgora.filter((t) => t.status === 'aguardando_aluno').length,
    aguardandoSetor: aguardandoSetor.length, vencidos: vencidos.length, criticosAbertos: criticos.n,
    semAtualizacao: abertosAgora.filter((t) => (agora - new Date(t.updated_at)) / 3600000 > 24).length,
    tempoPrimeiraResposta: media(tempos1), tempoSolucao: media(tempos2), noPrazo, foraPrazo: sla.length - noPrazo,
    maisAntigo: abertosAgora[0] ? { protocolo: abertosAgora[0].protocolo, aberto_em: abertosAgora[0].aberto_em } : null,
    porCategoria: cat, encaminhados: enc.n, encaminhadosPorSetor: encSetor, retornos: retornos.n,
    tempoAguardandoSetor: media(aguardandoSetor.map((t) => minutos(t.enc_em || t.updated_at, agora))),
    avalPositivas: aval.pos, avalNegativas: aval.neg, satisfacaoMedia: aval.media ? Number(aval.media) : null, avaliacoes: aval.n,
  };
  return { ...n, ...indicadoresSuporte({ trabalhados: n.trabalhados, resolvidos: n.resolvidos, reabertos: n.reabertos, concluidos: sla.length, dentroPrazo: noPrazo, encaminhados: n.encaminhados, positivas: n.avalPositivas, negativas: n.avalNegativas }) };
}

// Uma linha por atendente, com desempenho contextual
export async function desempenhoAtendentes(dia) {
  const lista = (await atendentes()).filter((a) => !a.gerente);
  const linhas = [];
  for (const a of lista) {
    const n = await numerosSuporte([a.id], dia);
    const criticos = (await q1(`SELECT COUNT(DISTINCT e.ticket_id)::int n FROM support_ticket_events e JOIN support_tickets t ON t.id=e.ticket_id
                                 WHERE t.prioridade IN ('alta','critica') AND e.user_id=$2 AND e.created_at >= ${INI('$1')} AND e.created_at < ${FIM('$1')}`, [dia, a.id])).n;
    const fech = await q1('SELECT turno, pontualidade FROM support_daily_closings WHERE user_id=$1 AND data_ref=$2', [a.id, dia]);
    linhas.push({ id: a.id, nome: a.nome, ...n, criticos, sla: dividir(n.noPrazo, n.noPrazo + n.foraPrazo), fechamento: fech });
  }
  return rankingSuporte(linhas);
}

export async function filaTickets(u, veTudo, f = {}) {
  const cond = [];
  const p = [];
  if (!veTudo) { p.push(u.id); cond.push(`(t.responsavel_id=$${p.length} OR t.created_by=$${p.length})`); }
  if (f.status === 'abertos' || !f.status) cond.push(`t.status = ANY('{${ABERTOS.join(',')}}')`);
  else if (f.status !== 'todos') { p.push(f.status); cond.push(`t.status=$${p.length}`); }
  if (f.prioridade) { p.push(f.prioridade); cond.push(`t.prioridade=$${p.length}`); }
  if (f.categoria) { p.push(f.categoria); cond.push(`t.categoria=$${p.length}`); }
  if (f.responsavel) { p.push(f.responsavel); cond.push(`t.responsavel_id=$${p.length}`); }
  if (f.busca) { p.push(`%${f.busca}%`); cond.push(`(t.protocolo ILIKE $${p.length} OR s.nome ILIKE $${p.length} OR s.email ILIKE $${p.length} OR s.telefone ILIKE $${p.length})`); }
  return q(
    `SELECT t.*, s.nome aluno, s.email aluno_email, s.telefone aluno_telefone, pr.nome produto, r.nome responsavel
       FROM support_tickets t JOIN students s ON s.id=t.student_id LEFT JOIN products pr ON pr.id=t.product_id JOIN users r ON r.id=t.responsavel_id
      ${cond.length ? 'WHERE ' + cond.join(' AND ') : ''}
      ORDER BY CASE t.prioridade WHEN 'critica' THEN 0 WHEN 'alta' THEN 1 WHEN 'normal' THEN 2 ELSE 3 END, t.aberto_em LIMIT 300`,
    p
  );
}

export async function ticketCompleto(id) {
  const t = await q1(
    `SELECT t.*, s.nome aluno, s.email aluno_email, s.telefone aluno_telefone, pr.nome produto, r.nome responsavel
       FROM support_tickets t JOIN students s ON s.id=t.student_id LEFT JOIN products pr ON pr.id=t.product_id JOIN users r ON r.id=t.responsavel_id WHERE t.id=$1`, [id]);
  if (!t) return null;
  t.eventos = await q('SELECT e.*, x.nome usuario FROM support_ticket_events e LEFT JOIN users x ON x.id=e.user_id WHERE e.ticket_id=$1 ORDER BY e.created_at', [id]);
  return t;
}

// Volume por dimensão no período (dashboard)
export async function volumes(desde, ate) {
  const periodo = `t.aberto_em >= ${INI('$1')} AND t.aberto_em < ${FIM('$2')}`;
  const por = (col) => q(`SELECT ${col} chave, COUNT(*)::int n FROM support_tickets t LEFT JOIN products pr ON pr.id=t.product_id WHERE ${periodo} GROUP BY 1 ORDER BY n DESC LIMIT 10`, [desde, ate]);
  const [categoria, curso, canal, prioridade, total, serie] = await Promise.all([
    por('t.categoria'), por(`COALESCE(pr.nome, 'Atendimento geral')`), por('t.canal'), por('t.prioridade'),
    q1(`SELECT COUNT(*)::int n, COUNT(*) FILTER (WHERE t.status IN ('resolvido','encerrado'))::int finalizados,
               COUNT(*) FILTER (WHERE t.resolvido_em IS NOT NULL AND t.resolvido_em <= t.sla_solucao_limite)::int no_prazo,
               COUNT(*) FILTER (WHERE t.resolvido_em IS NOT NULL)::int com_solucao, AVG(t.satisfacao) satisfacao, SUM(t.reaberturas)::int reaberturas
          FROM support_tickets t WHERE ${periodo}`, [desde, ate]),
    q(`SELECT (t.aberto_em AT TIME ZONE ${TZ})::date dia, COUNT(*)::int n FROM support_tickets t WHERE ${periodo} GROUP BY 1 ORDER BY 1`, [desde, ate]),
  ]);
  return { categoria, curso, canal, prioridade, total, serie };
}
