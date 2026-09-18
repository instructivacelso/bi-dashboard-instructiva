'use server';
import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { exigirUsuario } from '@/lib/auth.js';
import { transacao } from '@/lib/db.js';
import { auditar } from '@/lib/auditoria.js';
import { lerNumero } from '@/lib/formato.js';
import { hoje } from '@/lib/datas.js';
import { ehSuperadmin, gerenteDe, lancaComercial } from '@/lib/perm.js';
import { PLATAFORMAS_TRAFEGO } from '@/lib/formularios.js';

class Erro extends Error {}
const falha = (m) => { throw new Erro(m); };
const txt = (fd, n, rot, obrig = false) => {
  const v = String(fd.get(n) ?? '').trim();
  if (obrig && !v) falha(`Preencha: ${rot}.`);
  return v || null;
};
const num = (fd, n) => lerNumero(fd.get(n));
const dt = (fd, n) => {
  const v = String(fd.get(n) || '').trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null;
};

async function executar(fn, caminho) {
  try {
    const r = await fn();
    if (caminho) revalidatePath(caminho);
    return { ok: true, ...(r || {}) };
  } catch (e) {
    if (e instanceof Erro) return { erro: e.message };
    if (e?.code === '23505') return { erro: 'Já existe um registro com esses dados (ex.: e-mail repetido).' };
    console.error('[admin]', e);
    return { erro: 'Não foi possível salvar. Tente novamente.' };
  }
}

async function soSuperadmin() {
  const u = await exigirUsuario();
  if (!ehSuperadmin(u)) falha('Apenas o superadministrador pode fazer isso.');
  return u;
}

// ---------- Usuários ----------
export async function salvarUsuario(_e, fd) {
  return executar(async () => {
    const u = await soSuperadmin();
    const id = num(fd, 'id');
    const dados = {
      nome: txt(fd, 'nome', 'Nome', true),
      email: txt(fd, 'email', 'E-mail', true).toLowerCase(),
      cargo: txt(fd, 'cargo', 'Cargo'),
      role_id: num(fd, 'role_id') || falha('Escolha o perfil.'),
      ativo: fd.get('ativo') === 'on',
    };
    if (id === u.id && !dados.ativo) falha('Você não pode desativar a si mesmo.');
    const senha = String(fd.get('senha') || '');
    if (!id && senha.length < 8) falha('Defina uma senha inicial com pelo menos 8 caracteres.');
    if (id && senha && senha.length < 8) falha('A nova senha precisa ter pelo menos 8 caracteres.');

    // Lotações: "sub:<id>" e "dep:<id>"; gerente: "ger:<depId>"
    const subs = fd.getAll('sub').map(Number).filter(Boolean);
    const deps = fd.getAll('dep').map(Number).filter(Boolean);
    const gers = new Set(fd.getAll('ger').map(Number));

    await transacao(async (db) => {
      let antes = null;
      let userId = id;
      if (id) {
        antes = (await db.query('SELECT id, nome, email, cargo, role_id, ativo FROM users WHERE id=$1', [id])).rows[0];
        if (!antes) falha('Usuário não encontrado.');
        await db.query('UPDATE users SET nome=$1, email=$2, cargo=$3, role_id=$4, ativo=$5, updated_at=now() WHERE id=$6',
          [dados.nome, dados.email, dados.cargo, dados.role_id, dados.ativo, id]);
        if (senha) await db.query('UPDATE users SET senha_hash=$1 WHERE id=$2', [await bcrypt.hash(senha, 10), id]);
      } else {
        userId = (await db.query('INSERT INTO users (nome, email, cargo, role_id, ativo, senha_hash) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id',
          [dados.nome, dados.email, dados.cargo, dados.role_id, dados.ativo, await bcrypt.hash(senha, 10)])).rows[0].id;
      }
      await db.query('DELETE FROM user_department_assignments WHERE user_id=$1', [userId]);
      const subRows = subs.length ? (await db.query('SELECT id, department_id FROM subdepartments WHERE id = ANY($1)', [subs])).rows : [];
      const depsComSub = new Set(subRows.map((s) => s.department_id));
      for (const s of subRows) {
        await db.query('INSERT INTO user_department_assignments (user_id, department_id, subdepartment_id, gerente) VALUES ($1,$2,$3,$4)',
          [userId, s.department_id, s.id, gers.has(s.department_id)]);
      }
      for (const d of new Set([...deps, ...gers])) {
        if (depsComSub.has(d)) continue;
        await db.query('INSERT INTO user_department_assignments (user_id, department_id, gerente) VALUES ($1,$2,$3)', [userId, d, gers.has(d)]);
      }
      await auditar(db, { userId: u.id, acao: id ? 'editar' : 'criar', entidade: 'users', entidadeId: userId, antes, depois: { ...dados, subs, deps, gerente: [...gers], senha_alterada: !!senha } });
    });
    return { mensagem: id ? 'Usuário atualizado.' : 'Usuário criado.' };
  }, '/admin/usuarios');
}

export async function gerarLinkSenha(_e, fd) {
  return executar(async () => {
    const u = await soSuperadmin();
    const id = num(fd, 'id');
    const token = crypto.randomBytes(24).toString('hex');
    await transacao(async (db) => {
      await db.query(`UPDATE users SET reset_token=$1, reset_expira=now() + interval '24 hours' WHERE id=$2`, [token, id]);
      await auditar(db, { userId: u.id, acao: 'gerar_link_senha', entidade: 'users', entidadeId: id });
    });
    const base = process.env.APP_URL || '';
    return { mensagem: `Link gerado (vale 24 horas): ${base}/redefinir/${token}` };
  });
}

// ---------- Setores ----------
export async function salvarSetor(_e, fd) {
  return executar(async () => {
    const u = await soSuperadmin();
    const id = num(fd, 'id');
    await transacao(async (db) => {
      const antes = (await db.query('SELECT * FROM departments WHERE id=$1', [id])).rows[0];
      const depois = { nome: txt(fd, 'nome', 'Nome', true), descricao: txt(fd, 'descricao', 'Descrição'), modulo_ativo: fd.get('modulo_ativo') === 'on', ativo: fd.get('ativo') === 'on' };
      await db.query('UPDATE departments SET nome=$1, descricao=$2, modulo_ativo=$3, ativo=$4 WHERE id=$5', [depois.nome, depois.descricao, depois.modulo_ativo, depois.ativo, id]);
      for (const s of (await db.query('SELECT id FROM subdepartments WHERE department_id=$1', [id])).rows) {
        const ativoForm = fd.get(`form_${s.id}`) === 'on';
        await db.query('UPDATE subdepartments SET formulario_ativo=$1 WHERE id=$2', [ativoForm, s.id]);
      }
      await auditar(db, { userId: u.id, acao: 'editar', entidade: 'departments', entidadeId: id, antes, depois });
    });
    return { mensagem: 'Setor atualizado.' };
  }, '/admin/setores');
}

export async function criarSubsetor(_e, fd) {
  return executar(async () => {
    const u = await soSuperadmin();
    const dep = num(fd, 'department_id');
    const nome = txt(fd, 'nome', 'Nome do subsetor', true);
    const slug = nome.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    await transacao(async (db) => {
      const r = await db.query('INSERT INTO subdepartments (department_id, slug, nome, descricao, ordem) VALUES ($1,$2,$3,$4,99) RETURNING id', [dep, slug, nome, txt(fd, 'descricao', 'Descrição')]);
      await auditar(db, { userId: u.id, acao: 'criar', entidade: 'subdepartments', entidadeId: r.rows[0].id, depois: { dep, nome } });
    });
    return { mensagem: 'Subsetor criado.' };
  }, '/admin/setores');
}

// ---------- Produtos ----------
export async function salvarProduto(_e, fd) {
  return executar(async () => {
    const u = await soSuperadmin();
    const id = num(fd, 'id');
    const dados = { nome: txt(fd, 'nome', 'Nome do produto', true), categoria: txt(fd, 'categoria', 'Categoria'), ativo: id ? fd.get('ativo') === 'on' : true };
    await transacao(async (db) => {
      if (id) {
        const antes = (await db.query('SELECT * FROM products WHERE id=$1', [id])).rows[0];
        await db.query('UPDATE products SET nome=$1, categoria=$2, ativo=$3 WHERE id=$4', [dados.nome, dados.categoria, dados.ativo, id]);
        await auditar(db, { userId: u.id, acao: 'editar', entidade: 'products', entidadeId: id, antes, depois: dados });
      } else {
        const r = await db.query('INSERT INTO products (nome, categoria) VALUES ($1,$2) RETURNING id', [dados.nome, dados.categoria]);
        await auditar(db, { userId: u.id, acao: 'criar', entidade: 'products', entidadeId: r.rows[0].id, depois: dados });
      }
    });
    return { mensagem: 'Produto salvo.' };
  }, '/admin/produtos');
}

// ---------- Lançamentos ----------
const CAMPOS_LANC = {
  texto: ['nome', 'professor', 'link_pagina', 'link_grupo', 'link_live', 'link_checkout'],
  data: ['captacao_inicio', 'captacao_fim', 'data_live', 'vendas_inicio', 'vendas_fim'],
  inteiro: ['meta_cadastros', 'meta_grupos', 'meta_live', 'meta_lista', 'meta_vendas'],
  valor: ['orcamento', 'meta_faturamento', 'cpl_max', 'cac_max', 'roas_min'],
};
const STATUS = ['planejamento', 'captacao', 'evento', 'vendas', 'encerrado', 'cancelado'];

export async function salvarLancamento(_e, fd) {
  const r = await executar(async () => {
    const u = await exigirUsuario();
    if (!ehSuperadmin(u) && !gerenteDe(u, 'marketing')) falha('Apenas o gerente de Marketing ou o superadministrador cadastram lançamentos.');
    const id = num(fd, 'id');
    const d = {};
    for (const c of CAMPOS_LANC.texto) d[c] = txt(fd, c, c);
    if (!d.nome) falha('Preencha o nome do lançamento.');
    for (const c of CAMPOS_LANC.data) d[c] = dt(fd, c);
    for (const c of CAMPOS_LANC.inteiro) { const n = num(fd, c); d[c] = n === null ? null : Math.round(n); }
    for (const c of CAMPOS_LANC.valor) d[c] = num(fd, c);
    d.product_id = num(fd, 'product_id');
    d.gerente_id = num(fd, 'gerente_id');
    d.status = STATUS.includes(fd.get('status')) ? fd.get('status') : falha('Escolha o status.');
    d.live_liberada = fd.get('live_liberada') === 'on';
    if (d.captacao_inicio && d.captacao_fim && d.captacao_fim < d.captacao_inicio) falha('O fim da captação é anterior ao início.');
    if (d.vendas_inicio && d.vendas_fim && d.vendas_fim < d.vendas_inicio) falha('O fechamento das vendas é anterior à abertura.');
    const atribuidos = fd.getAll('usuarios').map(Number).filter(Boolean);

    let novoId = id;
    await transacao(async (db) => {
      const cols = Object.keys(d);
      if (id) {
        const antes = (await db.query('SELECT * FROM launches WHERE id=$1', [id])).rows[0];
        if (!antes) falha('Lançamento não encontrado.');
        await db.query(`UPDATE launches SET ${cols.map((c, i) => `${c}=$${i + 1}`).join(', ')}, updated_by=$${cols.length + 1}, updated_at=now() WHERE id=$${cols.length + 2}`,
          [...cols.map((c) => d[c]), u.id, id]);
        await auditar(db, { userId: u.id, acao: 'editar', entidade: 'launches', entidadeId: id, antes, depois: { ...d, atribuidos } });
      } else {
        novoId = (await db.query(`INSERT INTO launches (${cols.join(', ')}, created_by, updated_by) VALUES (${cols.map((_, i) => `$${i + 1}`).join(', ')}, $${cols.length + 1}, $${cols.length + 1}) RETURNING id`,
          [...cols.map((c) => d[c]), u.id])).rows[0].id;
        await auditar(db, { userId: u.id, acao: 'criar', entidade: 'launches', entidadeId: novoId, depois: { ...d, atribuidos } });
      }
      await db.query('DELETE FROM launch_user_assignments WHERE launch_id=$1', [novoId]);
      for (const uid of atribuidos) {
        const pls = fd.getAll(`plataformas_${uid}`).map(String).filter((p) => PLATAFORMAS_TRAFEGO.includes(p));
        await db.query('INSERT INTO launch_user_assignments (launch_id, user_id, plataformas) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING', [novoId, uid, pls.length ? pls : null]);
      }
    });
    return { mensagem: id ? 'Lançamento atualizado.' : 'Lançamento criado.', novoId, criado: !id };
  }, '/admin/lancamentos');
  if (r.ok && r.criado) redirect(`/admin/lancamentos/${r.novoId}`);
  return r;
}

// ---------- Resultado comercial por lançamento (manual até existir integração) ----------
export async function salvarComercial(_e, fd) {
  return executar(async () => {
    const u = await exigirUsuario();
    if (!lancaComercial(u)) falha('Seu perfil não pode lançar vendas.');
    const launch = num(fd, 'launch_id') || falha('Escolha o lançamento.');
    const data = dt(fd, 'data_ref') || hoje();
    const vendas = num(fd, 'vendas');
    const fat = num(fd, 'faturamento');
    if (vendas === null || vendas < 0 || !Number.isInteger(vendas)) falha('Informe a quantidade de vendas (número inteiro).');
    if (fat === null || fat < 0) falha('Informe o faturamento.');
    await transacao(async (db) => {
      const antes = (await db.query(`SELECT * FROM commercial_launch_results WHERE launch_id=$1 AND data_ref=$2 AND origem='manual'`, [launch, data])).rows[0];
      const r = await db.query(
        `INSERT INTO commercial_launch_results (launch_id, data_ref, vendas, faturamento, created_by, updated_by) VALUES ($1,$2,$3,$4,$5,$5)
         ON CONFLICT (launch_id, data_ref, origem) DO UPDATE SET vendas=EXCLUDED.vendas, faturamento=EXCLUDED.faturamento, updated_by=$5, updated_at=now() RETURNING id`,
        [launch, data, vendas, fat, u.id]
      );
      await auditar(db, { userId: u.id, acao: antes ? 'editar' : 'criar', entidade: 'commercial_launch_results', entidadeId: r.rows[0].id, antes, depois: { launch, data, vendas, fat } });
    });
    return { mensagem: 'Resultado comercial salvo.' };
  }, '/admin/comercial');
}

// ---------- Equipe cadastrada dentro do setor (gerente do setor ou superadmin) ----------
async function podeGerirSetor(u, depId) {
  const { rows } = await (await import('@/lib/db.js')).pool.query('SELECT slug FROM departments WHERE id=$1', [depId]);
  if (!rows[0]) falha('Setor não encontrado.');
  if (!ehSuperadmin(u) && !gerenteDe(u, rows[0].slug)) falha('Só o gerente deste setor ou o administrador podem cadastrar a equipe.');
  return rows[0].slug;
}

export async function salvarMembroSetor(_e, fd) {
  return executar(async () => {
    const u = await exigirUsuario();
    const depId = num(fd, 'department_id');
    const slug = await podeGerirSetor(u, depId);
    const papel = String(fd.get('papel') || 'colaborador');
    const permitidos = ehSuperadmin(u) ? ['colaborador', 'externo', 'gerente'] : ['colaborador', 'externo'];
    if (!permitidos.includes(papel)) falha('Perfil não permitido.');
    const nome = txt(fd, 'nome', 'Nome', true);
    const email = txt(fd, 'email', 'E-mail', true).toLowerCase();
    const senha = String(fd.get('senha') || '');
    if (senha.length < 8) falha('A senha inicial precisa ter pelo menos 8 caracteres.');
    const subs = fd.getAll('sub').map(Number).filter(Boolean);
    await transacao(async (db) => {
      const role = (await db.query('SELECT id FROM roles WHERE chave=$1', [papel])).rows[0].id;
      const validos = subs.length ? (await db.query('SELECT id FROM subdepartments WHERE department_id=$1 AND id = ANY($2)', [depId, subs])).rows.map((r) => r.id) : [];
      const temSubs = (await db.query('SELECT COUNT(*)::int n FROM subdepartments WHERE department_id=$1 AND ativo', [depId])).rows[0].n;
      if (temSubs && !validos.length && papel !== 'gerente') falha('Marque pelo menos uma atividade da pessoa.');
      const novo = (await db.query('INSERT INTO users (nome,email,cargo,role_id,senha_hash) VALUES ($1,$2,$3,$4,$5) RETURNING id',
        [nome, email, txt(fd, 'cargo', 'Cargo'), role, await bcrypt.hash(senha, 10)])).rows[0].id;
      const gerente = papel === 'gerente';
      if (validos.length) for (const s of validos) await db.query('INSERT INTO user_department_assignments (user_id,department_id,subdepartment_id,gerente) VALUES ($1,$2,$3,$4)', [novo, depId, s, gerente]);
      else await db.query('INSERT INTO user_department_assignments (user_id,department_id,gerente) VALUES ($1,$2,$3)', [novo, depId, gerente]);
      await auditar(db, { userId: u.id, acao: 'criar', entidade: 'users', entidadeId: novo, depois: { nome, email, papel, setor: slug, subs: validos } });
    });
    return { mensagem: `${nome} foi cadastrado. Envie o e-mail e a senha inicial para a pessoa.` };
  }, '/setor');
}

export async function alternarMembro(fd) {
  const u = await exigirUsuario();
  const depId = Number(fd.get('department_id'));
  const alvo = Number(fd.get('user_id'));
  try { await podeGerirSetor(u, depId); } catch { return; }
  if (alvo === u.id) return;
  await transacao(async (db) => {
    const naoMexe = (await db.query(`SELECT r.chave FROM users x JOIN roles r ON r.id=x.role_id WHERE x.id=$1`, [alvo])).rows[0];
    if (!naoMexe || (['superadmin', 'diretoria', 'gerente'].includes(naoMexe.chave) && !ehSuperadmin(u))) return;
    const r = (await db.query('UPDATE users SET ativo = NOT ativo, updated_at=now() WHERE id=$1 RETURNING ativo', [alvo])).rows[0];
    await auditar(db, { userId: u.id, acao: r.ativo ? 'reativar' : 'desativar', entidade: 'users', entidadeId: alvo });
  });
  revalidatePath('/setor');
}
