'use server';
import bcrypt from 'bcryptjs';
import { redirect } from 'next/navigation';
import { q1, pool } from '@/lib/db.js';
import { criarSessao, encerrarSessao } from '@/lib/auth.js';
import { auditar } from '@/lib/auditoria.js';

export async function entrar(_estado, formData) {
  const email = String(formData.get('email') || '').trim().toLowerCase();
  const senha = String(formData.get('senha') || '');
  if (!email || !senha) return { erro: 'Informe e-mail e senha.' };
  const u = await q1('SELECT id, senha_hash, ativo FROM users WHERE email=$1', [email]);
  if (!u || !(await bcrypt.compare(senha, u.senha_hash))) return { erro: 'E-mail ou senha incorretos.' };
  if (!u.ativo) return { erro: 'Seu acesso está desativado. Fale com o administrador.' };
  await criarSessao(u.id);
  await pool.query('UPDATE users SET ultimo_login=now() WHERE id=$1', [u.id]);
  await auditar(pool, { userId: u.id, acao: 'login', entidade: 'users', entidadeId: u.id });
  redirect('/');
}

export async function sair() {
  encerrarSessao();
  redirect('/login');
}

export async function redefinirSenha(_estado, formData) {
  const token = String(formData.get('token') || '');
  const senha = String(formData.get('senha') || '');
  const conf = String(formData.get('confirmacao') || '');
  if (senha.length < 8) return { erro: 'A senha precisa ter pelo menos 8 caracteres.' };
  if (senha !== conf) return { erro: 'As senhas não conferem.' };
  const u = await q1('SELECT id FROM users WHERE reset_token=$1 AND reset_expira > now() AND ativo', [token]);
  if (!u) return { erro: 'Este link expirou ou já foi usado. Peça um novo ao administrador.' };
  await pool.query('UPDATE users SET senha_hash=$1, reset_token=NULL, reset_expira=NULL, updated_at=now() WHERE id=$2', [await bcrypt.hash(senha, 10), u.id]);
  await auditar(pool, { userId: u.id, acao: 'redefinir_senha', entidade: 'users', entidadeId: u.id });
  return { ok: true };
}
