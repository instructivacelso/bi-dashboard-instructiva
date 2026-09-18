'use server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { exigirUsuario } from '@/lib/auth.js';
import { transacao, q, q1 } from '@/lib/db.js';
import { auditar } from '@/lib/auditoria.js';
import { hoje } from '@/lib/datas.js';
import { lerNumero } from '@/lib/formato.js';
import { ErroValidacao, texto } from '@/lib/leitores.js';
import { normalizarContato } from '@/lib/leitoresSuporte.js';
import { lerAlunoCs, lerRegistroCs, lerGerenteCs } from '@/lib/leitoresCs.js';
import { veTodoCs, ehDoCs, STATUS_POR_TIPO, GARGALOS_CS } from '@/lib/cscx.js';
import { recalcularHealth, numerosCs } from '@/lib/dadosCs.js';
import { pontualidade } from '@/lib/comercial.js';
import { configuracao } from '@/lib/dadosComercial.js';
import { somarDias } from '@/lib/datas.js';

const falha = (m) => { throw new ErroValidacao(m); };
function tratar(e) {
  if (e instanceof ErroValidacao) return { erro: e.message };
  if (e?.digest?.startsWith?.('NEXT_REDIRECT')) throw e;
  if (e?.code === '23505') return { erro: 'Este aluno já está na carteira. Busque por ele na lista.' };
  console.error('[cscx]', e);
  return { erro: 'Não foi possível salvar agora. Tente de novo em instantes.' };
}
async function podeMexer(u, csAlunoId) {
  if (veTodoCs(u)) return true;
  const a = await q1('SELECT responsavel_id FROM cs_alunos WHERE id=$1', [csAlunoId]);
  return a && a.responsavel_id === u.id;
}

export async function salvarAlunoCs(_e, fd) {
  let novoId = null;
  try {
    const u = await exigirUsuario();
    if (u.vendoComo) falha(`Você está vendo como ${u.nome}. Volte para sua conta para salvar.`);
    if (!ehDoCs(u)) falha('Área da equipe de CS/CX.');
    const id = lerNumero(fd.get('id'));
    if (id && !(await podeMexer(u, id))) falha('Este aluno é da carteira de outro colaborador.');
    const produtos = (await q('SELECT id FROM products')).map((p) => p.id);
    const d = lerAlunoCs(fd, { produtos, userId: u.id });
    if (!veTodoCs(u)) d.responsavel_id = id ? (await q1('SELECT responsavel_id FROM cs_alunos WHERE id=$1', [id])).responsavel_id : u.id;
    await transacao(async (db) => {
      let alunoId = id;
      if (!id) {
        const nome = texto(fd, 'aluno_nome', 'Nome do aluno', 150);
        const c = normalizarContato(fd.get('aluno_contato'));
        let st = c.email ? (await db.query('SELECT id FROM students WHERE lower(email)=$1', [c.email])).rows[0] : (await db.query('SELECT id FROM students WHERE telefone=$1', [c.telefone])).rows[0];
        if (!st) st = (await db.query('INSERT INTO students (nome, email, telefone) VALUES ($1,$2,$3) RETURNING id', [nome, c.email, c.telefone])).rows[0];
        const cols = Object.keys(d);
        alunoId = (await db.query(`INSERT INTO cs_alunos (student_id, created_by, ${cols.join(', ')}) VALUES ($1,$2, ${cols.map((_, i) => `$${i + 3}`).join(', ')}) RETURNING id`, [st.id, u.id, ...cols.map((k) => d[k])])).rows[0].id;
        novoId = alunoId;
        await auditar(db, { userId: u.id, acao: 'criar', entidade: 'cs_alunos', entidadeId: alunoId, depois: d });
      } else {
        const antes = (await db.query('SELECT * FROM cs_alunos WHERE id=$1', [id])).rows[0];
        const cols = Object.keys(d);
        await db.query(`UPDATE cs_alunos SET ${cols.map((c, i) => `${c}=$${i + 1}`).join(', ')}, updated_by=$${cols.length + 1}, updated_at=now() WHERE id=$${cols.length + 2}`, [...cols.map((k) => d[k]), u.id, id]);
        await auditar(db, { userId: u.id, acao: 'editar', entidade: 'cs_alunos', entidadeId: id, antes, depois: d });
      }
      await recalcularHealth(db, alunoId);
    });
    revalidatePath('/cs');
    if (novoId) redirect(`/cs/aluno/${novoId}?criado=1`);
    return { ok: true, mensagem: 'Ficha atualizada e health score recalculado.' };
  } catch (e) { return tratar(e); }
}

export async function registrarCs(_e, fd) {
  try {
    const u = await exigirUsuario();
    if (u.vendoComo) falha(`Você está vendo como ${u.nome}. Volte para sua conta para salvar.`);
    const csAlunoId = lerNumero(fd.get('cs_aluno_id'));
    if (!csAlunoId || !(await podeMexer(u, csAlunoId))) falha('Este aluno é da carteira de outro colaborador.');
    const d = lerRegistroCs(fd);
    await transacao(async (db) => {
      const cols = Object.keys(d);
      const r = (await db.query(`INSERT INTO cs_registros (cs_aluno_id, created_by, ${cols.join(', ')}, resolvido_em) VALUES ($1,$2, ${cols.map((_, i) => `$${i + 3}`).join(', ')}, $${cols.length + 3}) RETURNING id`,
        [csAlunoId, u.id, ...cols.map((k) => d[k]), ['resolvida', 'recuperado', 'concluido', 'convertida'].includes(d.status) ? new Date() : null])).rows[0];
      if (d.tipo === 'cancelamento' && d.status === 'concluido') await db.query(`UPDATE cs_alunos SET matricula='cancelada', updated_by=$1, updated_at=now() WHERE id=$2`, [u.id, csAlunoId]);
      await recalcularHealth(db, csAlunoId);
      await auditar(db, { userId: u.id, acao: 'criar', entidade: 'cs_registros', entidadeId: r.id, depois: d });
    });
    revalidatePath(`/cs/aluno/${csAlunoId}`);
    return { ok: true, mensagem: 'Registro salvo e health score recalculado.' };
  } catch (e) { return tratar(e); }
}

// Atualiza a situação de um registro (ex.: reclamação resolvida, cancelamento recuperado)
export async function atualizarRegistroCs(fd) {
  const u = await exigirUsuario();
  if (u.vendoComo) return;
  const id = Number(fd.get('id'));
  const r = await q1('SELECT * FROM cs_registros WHERE id=$1', [id]);
  if (!r || !(await podeMexer(u, r.cs_aluno_id))) return;
  const status = String(fd.get('status'));
  if (!STATUS_POR_TIPO[r.tipo]?.[status] || status === r.status) return;
  await transacao(async (db) => {
    await db.query(`UPDATE cs_registros SET status=$1, resolvido_em=CASE WHEN $1 IN ('resolvida','recuperado','concluido','convertida') THEN now() ELSE NULL END, updated_by=$2, updated_at=now() WHERE id=$3`, [status, u.id, id]);
    if (r.tipo === 'cancelamento' && status === 'concluido') await db.query(`UPDATE cs_alunos SET matricula='cancelada', updated_at=now() WHERE id=$1`, [r.cs_aluno_id]);
    await recalcularHealth(db, r.cs_aluno_id);
    await auditar(db, { userId: u.id, acao: 'editar', entidade: 'cs_registros', entidadeId: id, antes: { status: r.status }, depois: { status } });
  });
  revalidatePath(`/cs/aluno/${r.cs_aluno_id}`);
}

// Nova versão da regra de health score (a anterior fica guardada)
export async function salvarRegraHealth(_e, fd) {
  try {
    const u = await exigirUsuario();
    if (!veTodoCs(u) || u.vendoComo || u.papel === 'diretoria') falha('Só o gerente de CS/CX e o administrador alteram a regra.');
    const n = (k) => { const v = lerNumero(fd.get(k)); if (v === null || v < 0) falha('Preencha todos os pesos e limites com números zero ou maiores.'); return v; };
    const pesos = { acesso: n('acesso'), progresso: n('progresso'), satisfacao: n('satisfacao'), reclamacoes: n('reclamacoes'), cancelamento: n('cancelamento'), resposta: n('resposta') };
    if (Object.values(pesos).reduce((s, v) => s + v, 0) <= 0) falha('A soma dos pesos precisa ser maior que zero.');
    const limites = { dias_ok: n('dias_ok'), dias_atencao: n('dias_atencao'), dias_risco: n('dias_risco'), saudavel: n('saudavel'), atencao: n('atencao_faixa'), risco: n('risco_faixa') };
    if (!(limites.dias_ok < limites.dias_atencao && limites.dias_atencao < limites.dias_risco)) falha('Os dias sem acesso precisam ser crescentes (ok < atenção < risco).');
    if (!(limites.saudavel > limites.atencao && limites.atencao > limites.risco)) falha('As faixas precisam ser decrescentes (saudável > atenção > risco).');
    const total = await transacao(async (db) => {
      await db.query('UPDATE cs_health_rules SET ativa=FALSE WHERE ativa');
      const v = (await db.query('INSERT INTO cs_health_rules (pesos, limites, created_by) VALUES ($1,$2,$3) RETURNING versao', [JSON.stringify(pesos), JSON.stringify(limites), u.id])).rows[0];
      const ids = (await db.query('SELECT id FROM cs_alunos')).rows;
      for (const a of ids) await recalcularHealth(db, a.id);
      await auditar(db, { userId: u.id, acao: 'criar', entidade: 'cs_health_rules', entidadeId: v.versao, depois: { pesos, limites } });
      return ids.length;
    });
    revalidatePath('/cs');
    return { ok: true, mensagem: `Nova regra salva. ${total} aluno(s) recalculados.` };
  } catch (e) { return tratar(e); }
}

export async function salvarGerenteCs(_e, fd) {
  try {
    const u = await exigirUsuario();
    if (u.vendoComo) falha(`Você está vendo como ${u.nome}. Volte para sua conta para enviar.`);
    if (!u.lotacoes.some((l) => l.formulario === 'cs_gerente')) falha('Este formulário é do gerente de CS/CX.');
    const dia = hoje();
    const d = lerGerenteCs(fd);
    const numeros = await numerosCs(somarDias(dia, -29), dia);
    const limite = await configuracao('cs_horario_limite', '19:00');
    const dep = await q1(`SELECT id FROM departments WHERE slug='cscx'`);
    const editado = await transacao(async (db) => {
      const atual = (await db.query('SELECT * FROM cs_manager_closings WHERE user_id=$1 AND data_ref=$2 FOR UPDATE', [u.id, dia])).rows[0];
      let novo;
      if (atual) novo = (await db.query('UPDATE cs_manager_closings SET numeros=$1, respostas=$2, responsavel_id=$3, prazo=$4, prioridade=$5, updated_by=$6, updated_at=now() WHERE id=$7 RETURNING *',
        [JSON.stringify(numeros), JSON.stringify(d.respostas), d.responsavel_id, d.prazo, d.prioridade, u.id, atual.id])).rows[0];
      else novo = (await db.query('INSERT INTO cs_manager_closings (data_ref, user_id, created_by, numeros, respostas, responsavel_id, prazo, prioridade, pontualidade) VALUES ($1,$2,$2,$3,$4,$5,$6,$7,$8) RETURNING *',
        [dia, u.id, JSON.stringify(numeros), JSON.stringify(d.respostas), d.responsavel_id, d.prazo, d.prioridade, pontualidade(new Date(), limite)])).rows[0];
      await db.query(
        `INSERT INTO action_items (data_ref, origem, origem_id, gargalo, acao, responsavel_id, prazo, created_by, department_id)
         VALUES ($1,'cs_gerente',$2,$3,$4,$5,$6,$7,$8)
         ON CONFLICT (origem, origem_id) WHERE origem_id IS NOT NULL
         DO UPDATE SET gargalo=EXCLUDED.gargalo, acao=EXCLUDED.acao, responsavel_id=EXCLUDED.responsavel_id, prazo=EXCLUDED.prazo, updated_by=$7, updated_at=now()`,
        [dia, novo.id, `${GARGALOS_CS[d.respostas.gargalo]} (${d.prioridade})`, d.respostas.acao, d.responsavel_id, d.prazo, u.id, dep.id]
      );
      await auditar(db, { userId: u.id, acao: atual ? 'editar' : 'criar', entidade: 'cs_manager_closings', entidadeId: novo.id, antes: atual, depois: novo });
      return !!atual;
    });
    revalidatePath('/'); revalidatePath('/cs/gerente');
    return { ok: true, mensagem: editado ? 'Alterações salvas.' : 'Fechamento gerencial enviado. A ação corretiva foi criada.' };
  } catch (e) { return tratar(e); }
}
