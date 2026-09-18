'use server';
import { revalidatePath } from 'next/cache';
import { exigirUsuario } from '@/lib/auth.js';
import { transacao } from '@/lib/db.js';
import { auditar } from '@/lib/auditoria.js';
import { vePainelEmpresa, gerenteDe, ehSuperadmin, ehDiretoria, formulariosDo } from '@/lib/perm.js';

export async function atualizarAcao(fd) {
  const u = await exigirUsuario();
  const id = Number(fd.get('id'));
  const status = String(fd.get('status'));
  if (!['aberta', 'em_andamento', 'concluida', 'cancelada'].includes(status)) return;
  await transacao(async (db) => {
    const a = (await db.query('SELECT * FROM action_items WHERE id=$1 FOR UPDATE', [id])).rows[0];
    if (!a) return;
    const pode = ehSuperadmin(u) || gerenteDe(u, 'marketing') || (!ehDiretoria(u) && a.responsavel_id === u.id);
    if (!pode) return;
    await db.query(
      `UPDATE action_items SET status=$1, concluida_em=CASE WHEN $1='concluida' THEN now() ELSE NULL END, updated_by=$2, updated_at=now() WHERE id=$3`,
      [status, u.id, id]
    );
    await auditar(db, { userId: u.id, acao: 'editar', entidade: 'action_items', entidadeId: id, antes: { status: a.status }, depois: { status } });
  });
  revalidatePath('/acoes');
}

export async function resolverIncidente(fd) {
  const u = await exigirUsuario();
  const id = Number(fd.get('id'));
  const pode = ehSuperadmin(u) || gerenteDe(u, 'marketing') || formulariosDo(u).includes('automacao');
  if (!pode || ehDiretoria(u)) return;
  await transacao(async (db) => {
    await db.query(`UPDATE automation_incidents SET status='resolvido', resolvido_em=now(), updated_by=$1, updated_at=now() WHERE id=$2 AND status='aberto'`, [u.id, id]);
    await auditar(db, { userId: u.id, acao: 'resolver', entidade: 'automation_incidents', entidadeId: id });
  });
  revalidatePath('/acoes');
}
