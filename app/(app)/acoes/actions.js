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

export async function atualizarIncidente(fd) {
  const u = await exigirUsuario();
  const id = Number(fd.get('id'));
  const status = String(fd.get('status'));
  const resp = Number(fd.get('responsavel_id')) || null;
  if (!['aberto', 'em_andamento', 'resolvido'].includes(status)) return;
  const pode = ehSuperadmin(u) || gerenteDe(u, 'marketing') || formulariosDo(u).includes('automacao');
  if (!pode || ehDiretoria(u)) return;
  await transacao(async (db) => {
    const antes = (await db.query('SELECT status, responsavel_id FROM automation_incidents WHERE id=$1 FOR UPDATE', [id])).rows[0];
    if (!antes) return;
    await db.query(
      `UPDATE automation_incidents SET status=$1, responsavel_id=COALESCE($2, responsavel_id),
         iniciado_em = CASE WHEN $1='em_andamento' AND iniciado_em IS NULL THEN now() ELSE iniciado_em END,
         resolvido_em = CASE WHEN $1='resolvido' THEN now() ELSE NULL END, updated_by=$3, updated_at=now() WHERE id=$4`,
      [status, resp, u.id, id]
    );
    await auditar(db, { userId: u.id, acao: 'editar', entidade: 'automation_incidents', entidadeId: id, antes, depois: { status, responsavel_id: resp } });
  });
  revalidatePath('/acoes');
}
