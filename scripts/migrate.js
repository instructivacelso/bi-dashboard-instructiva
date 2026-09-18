import fs from 'node:fs';
import path from 'node:path';
import pg from 'pg';
import bcrypt from 'bcryptjs';
import { PERFIS, SETORES, SUBSETORES_MARKETING, SUBSETORES_OUTROS } from '../lib/estrutura.js';

const dir = path.resolve(process.cwd(), 'db/migrations');

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error('[migrate] DATABASE_URL não definida.');
    process.exit(1);
  }
  const client = new pg.Client({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : false,
  });
  await client.connect();
  try {
    await client.query(`CREATE TABLE IF NOT EXISTS schema_migrations (nome TEXT PRIMARY KEY, aplicada_em TIMESTAMPTZ NOT NULL DEFAULT now())`);
    const feitas = new Set((await client.query('SELECT nome FROM schema_migrations')).rows.map((r) => r.nome));
    for (const arq of fs.readdirSync(dir).filter((f) => f.endsWith('.sql')).sort()) {
      if (feitas.has(arq)) continue;
      console.log(`[migrate] aplicando ${arq}`);
      await client.query('BEGIN');
      await client.query(fs.readFileSync(path.join(dir, arq), 'utf8'));
      await client.query('INSERT INTO schema_migrations (nome) VALUES ($1)', [arq]);
      await client.query('COMMIT');
    }

    // Dados base (idempotente: só insere o que não existe)
    for (const p of PERFIS) {
      const r = await client.query(
        `INSERT INTO roles (chave, nome, descricao) VALUES ($1,$2,$3)
         ON CONFLICT (chave) DO UPDATE SET nome = EXCLUDED.nome RETURNING id`,
        [p.chave, p.nome, p.descricao]
      );
      for (const perm of p.permissoes) {
        await client.query(`INSERT INTO permissions (role_id, chave) VALUES ($1,$2) ON CONFLICT DO NOTHING`, [r.rows[0].id, perm]);
      }
    }
    for (const s of SETORES) {
      await client.query(
        `INSERT INTO departments (slug, nome, descricao, modulo_ativo, ordem) VALUES ($1,$2,$3,$4,$5)
         ON CONFLICT (slug) DO NOTHING`,
        [s.slug, s.nome, s.descricao, s.modulo_ativo, s.ordem]
      );
    }
    const mkt = (await client.query(`SELECT id FROM departments WHERE slug='marketing'`)).rows[0].id;
    for (const s of SUBSETORES_MARKETING) {
      await client.query(
        `INSERT INTO subdepartments (department_id, slug, nome, descricao, formulario, ordem) VALUES ($1,$2,$3,$4,$5,$6)
         ON CONFLICT (department_id, slug) DO NOTHING`,
        [mkt, s.slug, s.nome, s.descricao, s.formulario, s.ordem]
      );
    }

    for (const [slug, lista] of Object.entries(SUBSETORES_OUTROS)) {
      const dep = (await client.query('SELECT id FROM departments WHERE slug=$1', [slug])).rows[0];
      if (!dep) continue;
      for (const x of lista) {
        await client.query(
          `INSERT INTO subdepartments (department_id, slug, nome, ordem, formulario) VALUES ($1,$2,$3,$4,$5) ON CONFLICT (department_id, slug) DO NOTHING`,
          [dep.id, x.slug, x.nome, x.ordem, x.formulario || null]
        );
      }
    }

    const { rows } = await client.query(`SELECT COUNT(*)::int n FROM users u JOIN roles r ON r.id=u.role_id WHERE r.chave='superadmin'`);
    if (rows[0].n === 0) {
      const email = (process.env.ADMIN_EMAIL || 'admin@instructiva.com.br').toLowerCase();
      const senha = process.env.ADMIN_SENHA;
      if (!senha) {
        console.warn('[migrate] ADMIN_SENHA não definida: superadministrador não foi criado.');
      } else {
        const role = (await client.query(`SELECT id FROM roles WHERE chave='superadmin'`)).rows[0].id;
        await client.query(
          `INSERT INTO users (nome, email, senha_hash, role_id, cargo) VALUES ($1,$2,$3,$4,$5) ON CONFLICT (email) DO NOTHING`,
          ['Escola Instructiva', email, await bcrypt.hash(senha, 10), role, 'Administração do sistema']
        );
        console.log(`[migrate] superadministrador criado: ${email}`);
      }
    }
    console.log('[migrate] ok');
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('[migrate] erro:', e.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}
main();
