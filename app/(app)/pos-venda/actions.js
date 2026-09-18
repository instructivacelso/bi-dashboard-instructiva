'use server';
import { revalidatePath } from 'next/cache';
import { exigirUsuario } from '@/lib/auth.js';
import { transacao } from '@/lib/db.js';
import { auditar } from '@/lib/auditoria.js';
import { hoje } from '@/lib/datas.js';
import { lerNumero } from '@/lib/formato.js';
import { pontualidade } from '@/lib/comercial.js';
import { configuracao } from '@/lib/dadosComercial.js';
import { ErroValidacao } from '@/lib/leitores.js';
import { lerFechamentoPosvenda } from '@/lib/leitoresPosvenda.js';
import { operaPosvenda, configuraPosvenda } from '@/lib/posvenda.js';

const falha = (m) => { throw new ErroValidacao(m); };
function tratar(e) {
  if (e instanceof ErroValidacao) return { erro: e.message };
  if (e?.code === '23505') return { erro: 'Já existe um registro com esses dados.' };
  console.error('[posvenda]', e);
  return { erro: 'Não foi possível salvar. Tente novamente.' };
}

export async function salvarFechamentoPosvenda(_e, fd) {
  try {
    const u = await exigirUsuario();
    if (u.vendoComo) falha(`Você está vendo como ${u.nome}. Volte para sua conta para enviar.`);
    if (!operaPosvenda(u)) falha('Este fechamento é da equipe de pós-venda.');
    const r = lerFechamentoPosvenda(fd, { hoje: hoje(), janelaDias: 7 });
    const limite = await configuracao('posvenda_horario_limite', '19:00');
    const editado = await transacao(async (db) => {
      const atual = (await db.query('SELECT * FROM posvenda_daily_closings WHERE user_id=$1 AND data_ref=$2 FOR UPDATE', [u.id, r.data_ref])).rows[0];
      const dados = { ...r }; delete dados.data_ref;
      const cols = Object.keys(dados);
      let novo;
      if (atual) novo = (await db.query(`UPDATE posvenda_daily_closings SET ${cols.map((c, i) => `${c}=$${i + 1}`).join(', ')}, updated_by=$${cols.length + 1}, updated_at=now() WHERE id=$${cols.length + 2} RETURNING id`, [...cols.map((c) => dados[c]), u.id, atual.id])).rows[0];
      else {
        const pont = r.data_ref !== hoje() ? 'atrasado' : pontualidade(new Date(), limite);
        novo = (await db.query(`INSERT INTO posvenda_daily_closings (data_ref, user_id, created_by, pontualidade, ${cols.join(', ')}) VALUES ($1,$2,$2,$3, ${cols.map((_, i) => `$${i + 4}`).join(', ')}) RETURNING id`, [r.data_ref, u.id, pont, ...cols.map((c) => dados[c])])).rows[0];
      }
      await auditar(db, { userId: u.id, acao: atual ? 'editar' : 'criar', entidade: 'posvenda_daily_closings', entidadeId: novo.id, antes: atual, depois: r });
      return !!atual;
    });
    revalidatePath('/'); revalidatePath('/pos-venda'); revalidatePath('/pos-venda/fechamento');
    return { ok: true, mensagem: editado ? 'Fechamento atualizado.' : 'Fechamento do dia enviado. Obrigado!' };
  } catch (e) { return tratar(e); }
}

export async function salvarConfigPosvenda(_e, fd) {
  try {
    const u = await exigirUsuario();
    if (!configuraPosvenda(u) || u.vendoComo) falha('Sem permissão.');
    const lim = String(fd.get('horario_limite') || '');
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(lim)) falha('Horário-limite inválido.');
    const renov = lerNumero(fd.get('meta_renovacao')), nps = lerNumero(fd.get('meta_nps'));
    if (renov === null || renov < 0 || nps === null) falha('Informe as metas.');
    await transacao(async (db) => {
      for (const [chave, valor] of [['posvenda_horario_limite', lim], ['posvenda_meta_renovacao', String(renov)], ['posvenda_meta_nps', String(nps)]])
        await db.query(`INSERT INTO configuracoes (chave, valor, updated_by) VALUES ($1,$2,$3) ON CONFLICT (chave) DO UPDATE SET valor=$2, updated_by=$3, updated_at=now()`, [chave, valor, u.id]);
      await auditar(db, { userId: u.id, acao: 'editar', entidade: 'configuracoes', depois: { posvenda: true } });
    });
    revalidatePath('/pos-venda/cadastros');
    return { ok: true, mensagem: 'Parâmetros salvos.' };
  } catch (e) { return tratar(e); }
}
