'use server';
import { revalidatePath } from 'next/cache';
import { exigirUsuario } from '@/lib/auth.js';
import { transacao, q, q1 } from '@/lib/db.js';
import { auditar } from '@/lib/auditoria.js';
import { hoje } from '@/lib/datas.js';
import { lerNumero } from '@/lib/formato.js';
import { ErroValidacao } from '@/lib/leitores.js';
import { lerVendedor, lerGerenteComercial } from '@/lib/leitoresComercial.js';
import { cidadeDoVendedor, cidadeDoGerente, cidadesVisiveis, ehDiretorComercial, pontualidade, GARGALOS_COMERCIAL } from '@/lib/comercial.js';
import { configuracao } from '@/lib/dadosComercial.js';

const falha = (m) => { throw new ErroValidacao(m); };

function tratarErro(e) {
  if (e instanceof ErroValidacao) return { erro: e.message };
  if (e?.digest?.startsWith?.('NEXT_REDIRECT')) throw e;
  if (e?.code === '23505') return { erro: e.constraint === 'uq_sales_identificador' || String(e.detail || '').includes('identificador') ? 'Já existe uma venda com esse identificador de pedido. Confira se ela não foi lançada antes.' : 'Este fechamento já foi enviado hoje. Recarregue a página para editar.' };
  console.error('[comercial]', e);
  return { erro: 'Não foi possível salvar agora. Tente de novo em instantes.' };
}

async function upsert(db, tabela, chave, dados, userId, extraInsert = {}) {
  const where = Object.keys(chave).map((k, i) => `${k}=$${i + 1}`).join(' AND ');
  const atual = (await db.query(`SELECT * FROM ${tabela} WHERE ${where} FOR UPDATE`, Object.values(chave))).rows[0];
  const cols = Object.keys(dados);
  if (atual) {
    const novo = (await db.query(
      `UPDATE ${tabela} SET ${cols.map((c, i) => `${c}=$${i + 1}`).join(', ')}, updated_by=$${cols.length + 1}, updated_at=now() WHERE id=$${cols.length + 2} RETURNING *`,
      [...cols.map((c) => dados[c]), userId, atual.id]
    )).rows[0];
    return { atual, novo };
  }
  const tudo = { ...chave, ...extraInsert, ...dados, created_by: userId };
  const ks = Object.keys(tudo);
  const novo = (await db.query(`INSERT INTO ${tabela} (${ks.join(', ')}) VALUES (${ks.map((_, i) => `$${i + 1}`).join(', ')}) RETURNING *`, ks.map((k) => tudo[k]))).rows[0];
  return { atual: null, novo };
}

// ---------- Fechamento do vendedor ----------
export async function salvarVendedor(_e, fd) {
  try {
    const u = await exigirUsuario();
    if (u.vendoComo) falha(`Você está vendo como ${u.nome}. Volte para sua conta para enviar.`);
    const cidade = cidadeDoVendedor(u);
    if (!cidade) falha('Seu cadastro não está ligado a um time comercial (Jesuítas ou Toledo). Fale com o administrador.');
    const dep = await q1('SELECT id FROM departments WHERE slug=$1', [cidade]);
    const dia = hoje();
    const produtosAtivos = (await q('SELECT id FROM products WHERE ativo')).map((p) => p.id);
    const anterior = await q1('SELECT * FROM seller_daily_closings WHERE user_id=$1 AND data_ref < $2 ORDER BY data_ref DESC LIMIT 1', [u.id, dia]);
    const { dados, vendas } = lerVendedor(fd, { produtosAtivos, anterior });
    const limite = await configuracao('comercial_horario_limite', '19:00');

    const r = await transacao(async (db) => {
      const { atual, novo } = await upsert(db, 'seller_daily_closings', { user_id: u.id, data_ref: dia }, { ...dados, department_id: dep.id }, u.id,
        { pontualidade: pontualidade(new Date(), limite) });
      const antesVendas = atual ? (await db.query(`SELECT * FROM sales WHERE closing_id=$1 AND origem='manual'`, [novo.id])).rows : [];
      if (atual) await db.query(`DELETE FROM sales WHERE closing_id=$1 AND origem='manual'`, [novo.id]);
      for (const v of vendas) {
        const s = (await db.query(
          `INSERT INTO sales (closing_id, data_ref, user_id, department_id, product_id, funil, forma_pagamento, valor, status, identificador, origem, created_by)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'manual',$3) RETURNING id`,
          [novo.id, dia, u.id, dep.id, v.product_id, v.funil, v.forma_pagamento, v.valor, v.status, v.identificador]
        )).rows[0];
        await db.query('INSERT INTO sale_status_history (sale_id, de, para, user_id) VALUES ($1, NULL, $2, $3)', [s.id, v.status, u.id]);
      }
      await auditar(db, { userId: u.id, acao: atual ? 'editar' : 'criar', entidade: 'seller_daily_closings', entidadeId: novo.id, antes: atual ? { ...atual, vendas: antesVendas } : null, depois: { ...novo, vendas } });
      return { editado: !!atual, pontualidade: novo.pontualidade };
    });
    revalidatePath('/comercial/vendedor');
    revalidatePath('/');
    return { ok: true, mensagem: r.editado ? 'Alterações salvas.' : `Fechamento enviado${r.pontualidade === 'atrasado' ? ' (depois do horário-limite)' : ' no prazo'}. Obrigado!` };
  } catch (e) { return tratarErro(e); }
}

// ---------- Fechamento do gerente comercial ----------
export async function salvarGerenteComercial(_e, fd) {
  try {
    const u = await exigirUsuario();
    if (u.vendoComo) falha(`Você está vendo como ${u.nome}. Volte para sua conta para enviar.`);
    const cidade = cidadeDoGerente(u);
    if (!cidade) falha('Seu cadastro não está ligado como gerente de um time comercial. Fale com o administrador.');
    const dep = await q1('SELECT id FROM departments WHERE slug=$1', [cidade]);
    const dia = hoje();
    const { dados, feedbacks } = lerGerenteComercial(fd);
    const limite = await configuracao('comercial_horario_limite', '19:00');

    const editado = await transacao(async (db) => {
      const { atual, novo } = await upsert(db, 'commercial_manager_closings', { user_id: u.id, department_id: dep.id, data_ref: dia }, dados, u.id,
        { pontualidade: pontualidade(new Date(), limite) });
      await db.query('DELETE FROM commercial_manager_feedbacks WHERE closing_id=$1', [novo.id]);
      for (const f of feedbacks) {
        await db.query('INSERT INTO commercial_manager_feedbacks (closing_id, alvo, tipo, tema, acao, acompanhamento) VALUES ($1,$2,$3,$4,$5,$6)',
          [novo.id, f.alvo, f.tipo, f.tema, f.acao, f.acompanhamento]);
      }
      await db.query(
        `INSERT INTO action_items (data_ref, origem, origem_id, gargalo, acao, responsavel_id, prazo, created_by, department_id)
         VALUES ($1,'gerente_comercial',$2,$3,$4,$5,$6,$7,$8)
         ON CONFLICT (origem, origem_id) WHERE origem_id IS NOT NULL
         DO UPDATE SET gargalo=EXCLUDED.gargalo, acao=EXCLUDED.acao, responsavel_id=EXCLUDED.responsavel_id, prazo=EXCLUDED.prazo, updated_by=$7, updated_at=now()`,
        [dia, novo.id, `${GARGALOS_COMERCIAL[dados.gargalo]} (${dados.prioridade})`, dados.acao, dados.responsavel_id, dados.prazo, u.id, dep.id]
      );
      await auditar(db, { userId: u.id, acao: atual ? 'editar' : 'criar', entidade: 'commercial_manager_closings', entidadeId: novo.id, antes: atual, depois: { ...novo, feedbacks } });
      return !!atual;
    });
    revalidatePath('/comercial/gerente');
    revalidatePath('/');
    return { ok: true, mensagem: editado ? 'Alterações salvas.' : 'Fechamento gerencial enviado. A ação corretiva foi criada.' };
  } catch (e) { return tratarErro(e); }
}

// ---------- Metas e horário-limite ----------
export async function salvarMetas(_e, fd) {
  try {
    const u = await exigirUsuario();
    if (!ehDiretorComercial(u) || u.vendoComo) falha('Só o administrador e a diretoria comercial definem metas.');
    const limite = String(fd.get('horario_limite') || '').trim();
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(limite)) falha('Horário-limite inválido. Use o formato 00:00.');
    await transacao(async (db) => {
      await db.query(`INSERT INTO configuracoes (chave, valor, updated_by) VALUES ('comercial_horario_limite',$1,$2)
                      ON CONFLICT (chave) DO UPDATE SET valor=EXCLUDED.valor, updated_by=EXCLUDED.updated_by, updated_at=now()`, [limite, u.id]);
      for (const id of fd.getAll('vendedor').map(Number).filter(Boolean)) {
        const m = (k) => { const n = lerNumero(fd.get(`${k}_${id}`)); if (n !== null && n < 0) falha('Metas não podem ser negativas.'); return n; };
        const vals = [m('diaria'), m('semanal'), m('mensal')];
        await db.query(`INSERT INTO seller_goals (user_id, meta_diaria, meta_semanal, meta_mensal, updated_by) VALUES ($1,$2,$3,$4,$5)
                        ON CONFLICT (user_id) DO UPDATE SET meta_diaria=$2, meta_semanal=$3, meta_mensal=$4, updated_by=$5, updated_at=now()`, [id, ...vals, u.id]);
      }
      await auditar(db, { userId: u.id, acao: 'editar', entidade: 'seller_goals', depois: { horario_limite: limite } });
    });
    revalidatePath('/comercial/metas');
    return { ok: true, mensagem: 'Metas e horário-limite salvos.' };
  } catch (e) { return tratarErro(e); }
}

// ---------- Atualizar status de uma venda (ex.: boleto pago) sem apagar o histórico ----------
export async function atualizarStatusVenda(fd) {
  const u = await exigirUsuario();
  if (u.vendoComo) return;
  const id = Number(fd.get('id'));
  const para = String(fd.get('status'));
  if (!['aprovada', 'boleto_gerado', 'aguardando', 'pago', 'cancelada'].includes(para)) return;
  await transacao(async (db) => {
    const s = (await db.query('SELECT s.*, d.slug cidade FROM sales s JOIN departments d ON d.id=s.department_id WHERE s.id=$1 FOR UPDATE', [id])).rows[0];
    if (!s || s.status === para) return;
    const pode = s.user_id === u.id || cidadesVisiveis(u).includes(s.cidade);
    if (!pode) return;
    await db.query('UPDATE sales SET status=$1, updated_by=$2, updated_at=now() WHERE id=$3', [para, u.id, id]);
    await db.query('INSERT INTO sale_status_history (sale_id, de, para, user_id) VALUES ($1,$2,$3,$4)', [id, s.status, para, u.id]);
    await auditar(db, { userId: u.id, acao: 'editar', entidade: 'sales', entidadeId: id, antes: { status: s.status }, depois: { status: para } });
  });
  revalidatePath('/comercial/dashboard');
}
