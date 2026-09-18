import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { SignJWT, jwtVerify } from 'jose';
import { q, q1 } from './db.js';

const COOKIE = 'bi_sessao';
const DURACAO_H = 12;

function chave() {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 24) throw new Error('SESSION_SECRET ausente ou curto demais (mínimo 24 caracteres).');
  return new TextEncoder().encode(s);
}

export async function criarSessao(userId) {
  const token = await new SignJWT({ uid: userId })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${DURACAO_H}h`)
    .sign(chave());
  cookies().set(COOKIE, token, {
    httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/', maxAge: DURACAO_H * 3600,
  });
}

export function encerrarSessao() {
  cookies().delete(COOKIE);
}

export async function carregarUsuario(id) {
  const u = await q1(
    `SELECT u.id, u.nome, u.email, u.cargo, u.ativo, r.chave AS papel, r.nome AS papel_nome
       FROM users u JOIN roles r ON r.id = u.role_id WHERE u.id = $1`,
    [id]
  );
  if (!u || !u.ativo) return null;
  const lot = await q(
    `SELECT d.slug AS setor, d.nome AS setor_nome, s.slug AS subsetor, s.nome AS subsetor_nome,
            s.formulario, s.formulario_ativo, a.gerente
       FROM user_department_assignments a
       JOIN departments d ON d.id = a.department_id
       LEFT JOIN subdepartments s ON s.id = a.subdepartment_id
      WHERE a.user_id = $1 AND d.ativo`,
    [id]
  );
  u.lotacoes = lot.map((l) => ({
    setor: l.setor, setorNome: l.setor_nome, subsetor: l.subsetor, subsetorNome: l.subsetor_nome,
    formulario: l.formulario, formularioAtivo: l.formulario_ativo, gerente: l.gerente,
  }));
  return u;
}

export async function usuarioAtual() {
  const token = cookies().get(COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, chave());
    return await carregarUsuario(payload.uid);
  } catch {
    return null;
  }
}

export async function exigirUsuario() {
  const u = await usuarioAtual();
  if (!u) redirect('/login');
  return u;
}
