// Dados fictícios para demonstração. Uso: npm run seed
import pg from 'pg';
import bcrypt from 'bcryptjs';
const db = new pg.Client({ connectionString: process.env.DATABASE_URL, ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : false });
const hoje = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date());
const dia = (n) => { const d = new Date(`${hoje}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const r = (a, b) => Math.round(a + Math.random() * (b - a));
const one = async (sql, p) => (await db.query(sql, p)).rows[0];

await db.connect();
if ((await db.query(`SELECT 1 FROM users WHERE email='ana@demo.instructiva'`)).rowCount) { console.log('Demo já existe.'); process.exit(0); }
const role = async (k) => (await one('SELECT id FROM roles WHERE chave=$1', [k])).id;
const sub = async (s) => one(`SELECT s.id, s.department_id FROM subdepartments s JOIN departments d ON d.id=s.department_id WHERE d.slug='marketing' AND s.slug=$1`, [s]);
const hash = await bcrypt.hash('demo12345', 10);
async function user(nome, email, papel, subs, gerente = false) {
  const u = await one('INSERT INTO users (nome,email,senha_hash,role_id,cargo) VALUES ($1,$2,$3,$4,$5) RETURNING id', [nome, email, hash, await role(papel), subs.join(', ')]);
  for (const s of subs) { const x = await sub(s); await db.query('INSERT INTO user_department_assignments (user_id,department_id,subdepartment_id,gerente) VALUES ($1,$2,$3,$4)', [u.id, x.department_id, x.id, gerente]); }
  return u.id;
}
const ana = await user('Ana Gerente', 'ana@demo.instructiva', 'gerente', ['gerencia', 'lives'], true);
const bruno = await user('Bruno Tráfego (externo)', 'bruno@demo.instructiva', 'externo', ['trafego']);
const carla = await user('Carla Tráfego (externa)', 'carla@demo.instructiva', 'externo', ['trafego']);
const diego = await user('Diego WhatsApp', 'diego@demo.instructiva', 'colaborador', ['whatsapp']);
const edu = await user('Eduarda Automação', 'eduarda@demo.instructiva', 'colaborador', ['automacao']);
const fel = await user('Felipe Editor', 'felipe@demo.instructiva', 'colaborador', ['edicao']);
await one('INSERT INTO users (nome,email,senha_hash,role_id,cargo) VALUES ($1,$2,$3,$4,$5) RETURNING id', ['Diretor Demo', 'diretoria@demo.instructiva', hash, await role('diretoria'), 'Diretoria']);

const prod = async (n, c) => (await one('INSERT INTO products (nome,categoria) VALUES ($1,$2) RETURNING id', [n, c])).id;
const p1 = await prod('Eletricista Residencial', 'Curso profissionalizante');
const p2 = await prod('Pós em Automação Industrial', 'Pós-graduação');
const p3 = await prod('Técnico em Eletrônica', 'Curso técnico');
async function lanc(d, equipe) {
  const cols = Object.keys(d);
  const l = await one(`INSERT INTO launches (${cols}) VALUES (${cols.map((_, i) => `$${i + 1}`)}) RETURNING id`, Object.values(d));
  for (const u of equipe) await db.query('INSERT INTO launch_user_assignments (launch_id,user_id) VALUES ($1,$2)', [l.id, u]);
  return l.id;
}
const L1 = await lanc({ nome: 'Eletricista Residencial — Captação', product_id: p1, professor: 'Prof. Marcos', gerente_id: ana, status: 'captacao', captacao_inicio: dia(-14), captacao_fim: dia(5), data_live: dia(6), orcamento: 30000, meta_cadastros: 6000, meta_grupos: 4200, meta_live: 1500, meta_lista: 400, meta_vendas: 150, meta_faturamento: 150000, cpl_max: 5, cac_max: 200, roas_min: 5 }, [bruno, diego, edu, fel]);
const L2 = await lanc({ nome: 'Pós Automação — Vendas', product_id: p2, professor: 'Prof. Helena', gerente_id: ana, status: 'vendas', captacao_inicio: dia(-30), captacao_fim: dia(-5), data_live: dia(-3), orcamento: 45000, meta_cadastros: 5000, meta_grupos: 3500, meta_live: 1200, meta_lista: 300, meta_vendas: 90, meta_faturamento: 270000, cpl_max: 9, cac_max: 500, roas_min: 6 }, [carla, diego, edu, fel]);
await lanc({ nome: 'Técnico em Eletrônica — Planejamento', product_id: p3, gerente_id: ana, status: 'planejamento', captacao_inicio: dia(20) }, [fel]);

for (const [L, trafego, ini, fim] of [[L1, bruno, -14, -1], [L2, carla, -30, -5]]) {
  let total = 0;
  for (let i = ini; i <= fim; i++) {
    const gasto = r(900, 1600), vis = r(1400, 2600), cad = Math.round(vis * (0.12 + Math.random() * 0.08));
    await db.query('INSERT INTO traffic_daily_entries (data_ref,launch_id,valor_gasto,visitas,cadastros,created_by) VALUES ($1,$2,$3,$4,$5,$6)', [dia(i), L, gasto, vis, cad, trafego]);
    const api = Math.round(cad * 0.45), org = r(15, 60); total += api + org - r(5, 20);
    await db.query('INSERT INTO whatsapp_daily_entries (data_ref,launch_id,convites_api,entradas_api,entradas_organico,total_grupos,custo_disparos,created_by) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)', [dia(i), L, cad, api, org, total, r(40, 90), diego]);
    await db.query('INSERT INTO automation_daily_entries (data_ref,launch_id,captacao_ok,checkout_ok,onboarding_ok,created_by) VALUES ($1,$2,true,true,true,$3)', [dia(i), L, edu]);
  }
}
await db.query('INSERT INTO live_results (data_ref,launch_id,participantes_unicos,lista_reserva,created_by) VALUES ($1,$2,780,210,$3)', [dia(-3), L2, ana]);
for (let i = -3; i <= -1; i++) await db.query('INSERT INTO commercial_launch_results (data_ref,launch_id,vendas,faturamento,created_by) VALUES ($1,$2,$3,$4,$5)', [dia(i), L2, r(12, 22), r(35000, 65000), ana]);
const mc = await one(`INSERT INTO manager_daily_closings (data_ref,launch_id,situacao,gargalo,acao,responsavel_id,prazo,created_by) VALUES ($1,$2,'amarelo','Entrada nos grupos abaixo do planejado','Novo disparo para cadastros fora do WhatsApp',$3,$4,$5) RETURNING id`, [dia(-1), L1, diego, dia(2), ana]);
await db.query(`INSERT INTO action_items (data_ref,launch_id,origem,origem_id,gargalo,acao,responsavel_id,prazo,created_by) VALUES ($1,$2,'gerente',$3,'Entrada nos grupos abaixo do planejado','Novo disparo para cadastros fora do WhatsApp',$4,$5,$6)`, [dia(-1), L1, mc.id, diego, dia(2), ana]);
await db.query(`INSERT INTO automation_incidents (data_ref,launch_id,etapa,afetados,descricao,prioridade,previsao_solucao,created_by) VALUES ($1,$2,'boas_vindas',37,'Mensagem de boas-vindas não disparou para compras via boleto','alta',$3,$4)`, [dia(-1), L2, dia(1), edu]);
console.log('Demo criada. Logins (senha demo12345): ana@, bruno@, carla@, diego@, eduarda@, felipe@, diretoria@demo.instructiva');
await db.end();
