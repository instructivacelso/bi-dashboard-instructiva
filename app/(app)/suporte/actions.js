'use server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { exigirUsuario } from '@/lib/auth.js';
import { transacao, q, q1 } from '@/lib/db.js';
import { auditar } from '@/lib/auditoria.js';
import { hoje } from '@/lib/datas.js';
import { lerNumero } from '@/lib/formato.js';
import { ErroValidacao } from '@/lib/leitores.js';
import { lerTicket, lerFechamentoSuporte, lerGerenteSuporte } from '@/lib/leitoresSuporte.js';
import { FINALIZADOS, GARGALOS_SUPORTE, veTodoSuporte, ehDoSuporte, podeConfigurarSla, limitesSla } from '@/lib/suporte.js';
import { pontualidade } from '@/lib/comercial.js';
import { numerosSuporte } from '@/lib/dadosSuporte.js';
import { configuracao } from '@/lib/dadosComercial.js';

const falha = (m) => { throw new ErroValidacao(m); };
function tratar(e) {
  if (e instanceof ErroValidacao) return { erro: e.message };
  if (e?.digest?.startsWith?.('NEXT_REDIRECT')) throw e;
  if (e?.code === '23505') return { erro: 'Este fechamento já foi enviado hoje. Recarregue a página para editar.' };
  console.error('[suporte]', e);
  return { erro: 'Não foi possível salvar agora. Tente de novo em instantes.' };
}
const evento = (db, ticketId, userId, ev, de = null, para = null, detalhe = null) =>
  db.query('INSERT INTO support_ticket_events (ticket_id, user_id, evento, de, para, detalhe) VALUES ($1,$2,$3,$4,$5,$6)', [ticketId, userId, ev, de, para, detalhe]);

async function acharOuCriarAluno(db, aluno) {
  const achado = aluno.email
    ? (await db.query('SELECT * FROM students WHERE lower(email)=$1', [aluno.email])).rows[0]
    : (await db.query('SELECT * FROM students WHERE telefone=$1', [aluno.telefone])).rows[0];
  if (achado) {
    if (achado.nome !== aluno.nome) await db.query('UPDATE students SET nome=$1 WHERE id=$2', [aluno.nome, achado.id]);
    return achado.id;
  }
  return (await db.query('INSERT INTO students (nome, email, telefone) VALUES ($1,$2,$3) RETURNING id', [aluno.nome, aluno.email, aluno.telefone])).rows[0].id;
}

// ---------- Ticket (criar ou atualizar) ----------
export async function salvarTicket(_e, fd) {
  let novoId = null;
  try {
    const u = await exigirUsuario();
    if (u.vendoComo) falha(`Você está vendo como ${u.nome}. Volte para sua conta para salvar.`);
    if (!ehDoSuporte(u)) falha('Só a equipe de Suporte registra atendimentos.');
    const id = lerNumero(fd.get('id'));
    const atual = id ? await q1('SELECT * FROM support_tickets WHERE id=$1', [id]) : null;
    if (id && !atual) falha('Atendimento não encontrado.');
    if (atual && atual.responsavel_id !== u.id && atual.created_by !== u.id && !veTodoSuporte(u)) falha('Este atendimento é de outro colaborador.');
    const produtosAtivos = (await q('SELECT id FROM products WHERE ativo')).map((p) => p.id);
    const { aluno, dados } = lerTicket(fd, { produtosAtivos, statusAnterior: atual?.status || null });
    const motivo = dados.motivo_reabertura; delete dados.motivo_reabertura;
    // Responsável: o gerente pode reatribuir; o atendente fica como responsável
    let responsavel = atual ? atual.responsavel_id : u.id;
    const pedido = lerNumero(fd.get('responsavel_id'));
    if (pedido && veTodoSuporte(u)) responsavel = pedido;

    await transacao(async (db) => {
      const studentId = await acharOuCriarAluno(db, aluno);
      const agora = new Date();
      if (!atual) {
        const regra = (await db.query('SELECT * FROM support_sla WHERE prioridade=$1', [dados.prioridade])).rows[0];
        const lim = limitesSla(agora, regra);
        const seq = (await db.query(`SELECT nextval('support_protocolo_seq') n`)).rows[0].n;
        const protocolo = `SUP-${hoje().replace(/-/g, '')}-${String(seq).padStart(4, '0')}`;
        const t = (await db.query(
          `INSERT INTO support_tickets (protocolo, student_id, product_id, canal, categoria, descricao, prioridade, status, acao_realizada, encaminhamento,
             enc_responsavel, enc_motivo, enc_prazo, enc_em, solucao, aluno_confirmou, satisfacao, proxima_acao, prox_responsavel, prox_prazo, prox_contato,
             responsavel_id, aberto_em, primeira_resposta_em, resolvido_em, encerrado_em, sla_resposta_limite, sla_solucao_limite, created_by)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29) RETURNING *`,
          [protocolo, studentId, dados.product_id, dados.canal, dados.categoria, dados.descricao, dados.prioridade, dados.status, dados.acao_realizada, dados.encaminhamento,
            dados.enc_responsavel, dados.enc_motivo, dados.enc_prazo, dados.encaminhamento !== 'suporte' ? agora : null, dados.solucao, dados.aluno_confirmou, dados.satisfacao,
            dados.proxima_acao, dados.prox_responsavel, dados.prox_prazo, dados.prox_contato, responsavel, agora,
            dados.status !== 'novo' ? agora : null, FINALIZADOS.includes(dados.status) ? agora : null, dados.status === 'encerrado' ? agora : null,
            lim.resposta, lim.solucao, u.id]
        )).rows[0];
        novoId = t.id;
        await evento(db, t.id, u.id, 'aberto', null, dados.status, `Protocolo ${protocolo}`);
        if (dados.status !== 'novo') await evento(db, t.id, u.id, 'primeira_resposta');
        if (dados.encaminhamento !== 'suporte') await evento(db, t.id, u.id, 'encaminhado', null, dados.encaminhamento, dados.enc_motivo);
        if (FINALIZADOS.includes(dados.status)) await evento(db, t.id, u.id, 'resolvido');
        if (dados.status === 'encerrado') await evento(db, t.id, u.id, 'encerrado');
        await auditar(db, { userId: u.id, acao: 'criar', entidade: 'support_tickets', entidadeId: t.id, depois: t });
        return;
      }
      // Atualização: registra cada mudança na linha do tempo
      const extra = { student_id: studentId, responsavel_id: responsavel };
      if (!atual.primeira_resposta_em && dados.status !== 'novo') { extra.primeira_resposta_em = agora; await evento(db, id, u.id, 'primeira_resposta'); }
      if (atual.status !== dados.status) await evento(db, id, u.id, 'status', atual.status, dados.status);
      if (atual.encaminhamento !== dados.encaminhamento) {
        if (dados.encaminhamento !== 'suporte') { extra.enc_em = agora; await evento(db, id, u.id, 'encaminhado', atual.encaminhamento, dados.encaminhamento, dados.enc_motivo); }
        else await evento(db, id, u.id, 'retorno', atual.encaminhamento, 'suporte');
      } else if (atual.status === 'aguardando_setor' && dados.status !== 'aguardando_setor') await evento(db, id, u.id, 'retorno', atual.encaminhamento, dados.status);
      if (FINALIZADOS.includes(dados.status) && !FINALIZADOS.includes(atual.status)) { extra.resolvido_em = agora; await evento(db, id, u.id, 'resolvido'); }
      if (dados.status === 'encerrado' && atual.status !== 'encerrado') { extra.encerrado_em = agora; await evento(db, id, u.id, 'encerrado'); }
      if (dados.status === 'reaberto' && atual.status !== 'reaberto') {
        extra.reaberturas = atual.reaberturas + 1; extra.resolvido_em = null; extra.encerrado_em = null;
        await evento(db, id, u.id, 'reaberto', atual.status, 'reaberto', motivo);
      }
      if (responsavel !== atual.responsavel_id) await evento(db, id, u.id, 'reatribuido', String(atual.responsavel_id), String(responsavel));
      if (atual.prioridade !== dados.prioridade) {
        const regra = (await db.query('SELECT * FROM support_sla WHERE prioridade=$1', [dados.prioridade])).rows[0];
        const lim = limitesSla(atual.aberto_em, regra);
        extra.sla_resposta_limite = lim.resposta; extra.sla_solucao_limite = lim.solucao;
      }
      await evento(db, id, u.id, 'atualizado');
      const tudo = { ...dados, ...extra };
      const cols = Object.keys(tudo);
      const novo = (await db.query(`UPDATE support_tickets SET ${cols.map((c, i) => `${c}=$${i + 1}`).join(', ')}, updated_by=$${cols.length + 1}, updated_at=now() WHERE id=$${cols.length + 2} RETURNING *`,
        [...cols.map((c) => tudo[c]), u.id, id])).rows[0];
      await auditar(db, { userId: u.id, acao: 'editar', entidade: 'support_tickets', entidadeId: id, antes: atual, depois: { ...novo, motivo_reabertura: motivo } });
    });
    revalidatePath('/suporte');
    if (!id) redirect(`/suporte/ticket/${novoId}?criado=1`);
    return { ok: true, mensagem: 'Atendimento atualizado.' };
  } catch (e) { return tratar(e); }
}

// ---------- Fechamento do atendente ----------
export async function salvarFechamentoSuporte(_e, fd) {
  try {
    const u = await exigirUsuario();
    if (u.vendoComo) falha(`Você está vendo como ${u.nome}. Volte para sua conta para enviar.`);
    if (!u.lotacoes.some((l) => l.formulario === 'suporte_fechamento')) falha('Este formulário é da equipe de atendimento do Suporte.');
    const dia = hoje();
    const numeros = await numerosSuporte([u.id], dia);
    const d = lerFechamentoSuporte(fd, { temCriticoOuVencido: numeros.vencidos > 0 || numeros.criticosAbertos > 0, temForaSla: numeros.foraPrazo > 0 });
    const limite = await configuracao('suporte_horario_limite', '19:00');
    const editado = await transacao(async (db) => {
      const atual = (await db.query('SELECT * FROM support_daily_closings WHERE user_id=$1 AND data_ref=$2 FOR UPDATE', [u.id, dia])).rows[0];
      const dados = { ...d, casos: d.casos ? JSON.stringify(d.casos) : null, numeros: JSON.stringify(numeros) };
      const cols = Object.keys(dados);
      let novo;
      if (atual) novo = (await db.query(`UPDATE support_daily_closings SET ${cols.map((c, i) => `${c}=$${i + 1}`).join(', ')}, updated_by=$${cols.length + 1}, updated_at=now() WHERE id=$${cols.length + 2} RETURNING *`, [...cols.map((c) => dados[c]), u.id, atual.id])).rows[0];
      else novo = (await db.query(`INSERT INTO support_daily_closings (data_ref, user_id, created_by, pontualidade, ${cols.join(', ')}) VALUES ($1,$2,$2,$3, ${cols.map((_, i) => `$${i + 4}`).join(', ')}) RETURNING *`, [dia, u.id, pontualidade(new Date(), limite), ...cols.map((c) => dados[c])])).rows[0];
      await auditar(db, { userId: u.id, acao: atual ? 'editar' : 'criar', entidade: 'support_daily_closings', entidadeId: novo.id, antes: atual, depois: novo });
      return !!atual;
    });
    revalidatePath('/'); revalidatePath('/suporte/fechamento');
    return { ok: true, mensagem: editado ? 'Alterações salvas.' : 'Fechamento enviado. Obrigado!' };
  } catch (e) { return tratar(e); }
}

// ---------- Fechamento do gerente de Suporte ----------
export async function salvarGerenteSuporte(_e, fd) {
  try {
    const u = await exigirUsuario();
    if (u.vendoComo) falha(`Você está vendo como ${u.nome}. Volte para sua conta para enviar.`);
    if (!u.lotacoes.some((l) => l.formulario === 'suporte_gerente')) falha('Este formulário é do gerente de Suporte.');
    const dia = hoje();
    const numeros = await numerosSuporte(null, dia);
    const d = lerGerenteSuporte(fd);
    const limite = await configuracao('suporte_horario_limite', '19:00');
    const dep = await q1(`SELECT id FROM departments WHERE slug='suporte'`);
    const editado = await transacao(async (db) => {
      const atual = (await db.query('SELECT * FROM support_manager_closings WHERE user_id=$1 AND data_ref=$2 FOR UPDATE', [u.id, dia])).rows[0];
      const dados = { ...d, casos: d.casos ? JSON.stringify(d.casos) : null, feedbacks: d.feedbacks ? JSON.stringify(d.feedbacks) : null, numeros: JSON.stringify(numeros) };
      const cols = Object.keys(dados);
      let novo;
      if (atual) novo = (await db.query(`UPDATE support_manager_closings SET ${cols.map((c, i) => `${c}=$${i + 1}`).join(', ')}, updated_by=$${cols.length + 1}, updated_at=now() WHERE id=$${cols.length + 2} RETURNING *`, [...cols.map((c) => dados[c]), u.id, atual.id])).rows[0];
      else novo = (await db.query(`INSERT INTO support_manager_closings (data_ref, user_id, created_by, pontualidade, ${cols.join(', ')}) VALUES ($1,$2,$2,$3, ${cols.map((_, i) => `$${i + 4}`).join(', ')}) RETURNING *`, [dia, u.id, pontualidade(new Date(), limite), ...cols.map((c) => dados[c])])).rows[0];
      await db.query(
        `INSERT INTO action_items (data_ref, origem, origem_id, gargalo, acao, responsavel_id, prazo, created_by, department_id)
         VALUES ($1,'suporte_gerente',$2,$3,$4,$5,$6,$7,$8)
         ON CONFLICT (origem, origem_id) WHERE origem_id IS NOT NULL
         DO UPDATE SET gargalo=EXCLUDED.gargalo, acao=EXCLUDED.acao, responsavel_id=EXCLUDED.responsavel_id, prazo=EXCLUDED.prazo, updated_by=$7, updated_at=now()`,
        [dia, novo.id, `${GARGALOS_SUPORTE[d.gargalo]} (${d.prioridade})`, d.acao, d.responsavel_id, d.prazo, u.id, dep.id]
      );
      await auditar(db, { userId: u.id, acao: atual ? 'editar' : 'criar', entidade: 'support_manager_closings', entidadeId: novo.id, antes: atual, depois: novo });
      return !!atual;
    });
    revalidatePath('/'); revalidatePath('/suporte/gerente');
    return { ok: true, mensagem: editado ? 'Alterações salvas.' : 'Fechamento gerencial enviado. A ação corretiva foi criada.' };
  } catch (e) { return tratar(e); }
}

// ---------- SLA por prioridade ----------
export async function salvarSla(_e, fd) {
  try {
    const u = await exigirUsuario();
    if (!podeConfigurarSla(u) || u.vendoComo) falha('Só o gerente de Suporte e o administrador configuram o SLA.');
    await transacao(async (db) => {
      for (const p of ['critica', 'alta', 'normal', 'baixa']) {
        const r = lerNumero(fd.get(`resposta_${p}`)); const s = lerNumero(fd.get(`solucao_${p}`));
        if (!r || !s || r <= 0 || s <= 0) falha('Informe tempos maiores que zero para todas as prioridades.');
        await db.query('UPDATE support_sla SET resposta_min=$1, solucao_horas=$2, updated_by=$3, updated_at=now() WHERE prioridade=$4', [Math.round(r), Math.round(s), u.id, p]);
      }
      const lim = String(fd.get('horario_limite') || '');
      if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(lim)) falha('Horário-limite inválido.');
      await db.query(`INSERT INTO configuracoes (chave, valor, updated_by) VALUES ('suporte_horario_limite',$1,$2) ON CONFLICT (chave) DO UPDATE SET valor=$1, updated_by=$2, updated_at=now()`, [lim, u.id]);
      await auditar(db, { userId: u.id, acao: 'editar', entidade: 'support_sla' });
    });
    revalidatePath('/suporte/sla');
    return { ok: true, mensagem: 'SLA salvo. Vale para os novos atendimentos e para mudanças de prioridade.' };
  } catch (e) { return tratar(e); }
}
