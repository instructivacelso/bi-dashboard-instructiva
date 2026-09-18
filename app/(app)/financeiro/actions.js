'use server';
import { revalidatePath } from 'next/cache';
import { exigirUsuario } from '@/lib/auth.js';
import { transacao, q } from '@/lib/db.js';
import { auditar } from '@/lib/auditoria.js';
import { hoje } from '@/lib/datas.js';
import { lerNumero } from '@/lib/formato.js';
import { pontualidade } from '@/lib/comercial.js';
import { configuracao } from '@/lib/dadosComercial.js';
import { ErroValidacao, texto, opcao } from '@/lib/leitores.js';
import { lerFechamentoFinanceiro } from '@/lib/leitoresFinanceiro.js';
import { operaFinanceiro, configuraFinanceiro, ehGerenteFinanceiro, TIPOS_CONTA, NATUREZAS, GRUPOS_CATEGORIA, TIPOS_AJUSTE, GRUPOS_AJUSTE } from '@/lib/financeiro.js';

const falha = (m) => { throw new ErroValidacao(m); };
function tratar(e) {
  if (e instanceof ErroValidacao) return { erro: e.message };
  if (e?.code === '23505') return { erro: 'Já existe um registro com esses dados.' };
  console.error('[financeiro]', e);
  return { erro: 'Não foi possível salvar. Tente novamente.' };
}
const val = (fd, n) => { const x = lerNumero(fd.get(n)); return x === null ? 0 : Math.round(x * 100) / 100; };

// ---------- Cadastros ----------
export async function salvarConta(_e, fd) {
  try {
    const u = await exigirUsuario();
    if (!configuraFinanceiro(u) || u.vendoComo) falha('Só o gerente financeiro e o administrador mexem nos cadastros.');
    const id = lerNumero(fd.get('id'));
    const dados = {
      nome: texto(fd, 'nome', 'Nome da conta', 120), instituicao: String(fd.get('instituicao') || '').trim().slice(0, 120) || null,
      tipo: opcao(fd, 'tipo', 'Tipo', Object.keys(TIPOS_CONTA)), saldo_inicial: val(fd, 'saldo_inicial'),
      ativo: id ? fd.get('ativo') === 'on' : true, ordem: lerNumero(fd.get('ordem')) || 0,
    };
    await transacao(async (db) => {
      if (id) await db.query('UPDATE fin_accounts SET nome=$1, instituicao=$2, tipo=$3, saldo_inicial=$4, ativo=$5, ordem=$6, updated_at=now() WHERE id=$7', [dados.nome, dados.instituicao, dados.tipo, dados.saldo_inicial, dados.ativo, dados.ordem, id]);
      else await db.query('INSERT INTO fin_accounts (nome, instituicao, tipo, saldo_inicial, ordem) VALUES ($1,$2,$3,$4,$5)', [dados.nome, dados.instituicao, dados.tipo, dados.saldo_inicial, dados.ordem]);
      await auditar(db, { userId: u.id, acao: id ? 'editar' : 'criar', entidade: 'fin_accounts', entidadeId: id, depois: dados });
    });
    revalidatePath('/financeiro/cadastros');
    return { ok: true, mensagem: 'Conta salva.' };
  } catch (e) { return tratar(e); }
}

export async function salvarCategoria(_e, fd) {
  try {
    const u = await exigirUsuario();
    if (!configuraFinanceiro(u) || u.vendoComo) falha('Sem permissão.');
    const id = lerNumero(fd.get('id'));
    const dados = { nome: texto(fd, 'nome', 'Nome da categoria', 120), natureza: opcao(fd, 'natureza', 'Natureza', Object.keys(NATUREZAS)), grupo: opcao(fd, 'grupo', 'Grupo', Object.keys(GRUPOS_CATEGORIA)), ativo: id ? fd.get('ativo') === 'on' : true };
    await transacao(async (db) => {
      if (id) await db.query('UPDATE fin_categories SET nome=$1, natureza=$2, grupo=$3, ativo=$4 WHERE id=$5', [dados.nome, dados.natureza, dados.grupo, dados.ativo, id]);
      else await db.query('INSERT INTO fin_categories (nome, natureza, grupo) VALUES ($1,$2,$3)', [dados.nome, dados.natureza, dados.grupo]);
      await auditar(db, { userId: u.id, acao: id ? 'editar' : 'criar', entidade: 'fin_categories', entidadeId: id, depois: dados });
    });
    revalidatePath('/financeiro/cadastros');
    return { ok: true, mensagem: 'Categoria salva.' };
  } catch (e) { return tratar(e); }
}

async function salvarSimples(fd, tabela, rotulo, caminho, u) {
  const id = lerNumero(fd.get('id'));
  const nome = texto(fd, 'nome', rotulo, 120);
  const doc = tabela === 'fin_suppliers' ? (String(fd.get('documento') || '').trim().slice(0, 40) || null) : undefined;
  const ativo = id ? fd.get('ativo') === 'on' : true;
  await transacao(async (db) => {
    if (tabela === 'fin_suppliers') {
      if (id) await db.query('UPDATE fin_suppliers SET nome=$1, documento=$2, ativo=$3 WHERE id=$4', [nome, doc, ativo, id]);
      else await db.query('INSERT INTO fin_suppliers (nome, documento) VALUES ($1,$2)', [nome, doc]);
    } else {
      if (id) await db.query('UPDATE fin_cost_centers SET nome=$1, ativo=$2 WHERE id=$3', [nome, ativo, id]);
      else await db.query('INSERT INTO fin_cost_centers (nome) VALUES ($1)', [nome]);
    }
    await auditar(db, { userId: u.id, acao: id ? 'editar' : 'criar', entidade: tabela, entidadeId: id, depois: { nome } });
  });
  revalidatePath(caminho);
}
export async function salvarFornecedor(_e, fd) {
  try { const u = await exigirUsuario(); if (!configuraFinanceiro(u) || u.vendoComo) falha('Sem permissão.'); await salvarSimples(fd, 'fin_suppliers', 'Nome do fornecedor', '/financeiro/cadastros', u); return { ok: true, mensagem: 'Fornecedor salvo.' }; } catch (e) { return tratar(e); }
}
export async function salvarCentro(_e, fd) {
  try { const u = await exigirUsuario(); if (!configuraFinanceiro(u) || u.vendoComo) falha('Sem permissão.'); await salvarSimples(fd, 'fin_cost_centers', 'Nome do centro de custo', '/financeiro/cadastros', u); return { ok: true, mensagem: 'Centro de custo salvo.' }; } catch (e) { return tratar(e); }
}

export async function salvarRecorrente(_e, fd) {
  try {
    const u = await exigirUsuario();
    if (!configuraFinanceiro(u) || u.vendoComo) falha('Sem permissão.');
    const id = lerNumero(fd.get('id'));
    const dia = lerNumero(fd.get('dia_vencimento'));
    if (!dia || dia < 1 || dia > 31) falha('Informe o dia de vencimento (1 a 31).');
    const dados = { descricao: texto(fd, 'descricao', 'Descrição', 150), category_id: lerNumero(fd.get('category_id')) || null, valor: val(fd, 'valor'), dia_vencimento: dia, ativo: id ? fd.get('ativo') === 'on' : true };
    await transacao(async (db) => {
      if (id) await db.query('UPDATE fin_recurring SET descricao=$1, category_id=$2, valor=$3, dia_vencimento=$4, ativo=$5, updated_by=$6, updated_at=now() WHERE id=$7', [dados.descricao, dados.category_id, dados.valor, dados.dia_vencimento, dados.ativo, u.id, id]);
      else await db.query('INSERT INTO fin_recurring (descricao, category_id, valor, dia_vencimento, updated_by) VALUES ($1,$2,$3,$4,$5)', [dados.descricao, dados.category_id, dados.valor, dados.dia_vencimento, u.id]);
      await auditar(db, { userId: u.id, acao: id ? 'editar' : 'criar', entidade: 'fin_recurring', entidadeId: id, depois: dados });
    });
    revalidatePath('/financeiro/cadastros');
    return { ok: true, mensagem: 'Compromisso recorrente salvo.' };
  } catch (e) { return tratar(e); }
}

export async function salvarConfig(_e, fd) {
  try {
    const u = await exigirUsuario();
    if (!configuraFinanceiro(u) || u.vendoComo) falha('Sem permissão.');
    const lim = String(fd.get('horario_limite') || '');
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(lim)) falha('Horário-limite inválido.');
    const pb = lerNumero(fd.get('prob_boleto')), pi = lerNumero(fd.get('prob_inadimplencia'));
    if (pb === null || pb < 0 || pb > 100 || pi === null || pi < 0 || pi > 100) falha('As probabilidades devem ficar entre 0 e 100.');
    await transacao(async (db) => {
      for (const [chave, valor] of [['financeiro_horario_limite', lim], ['financeiro_prob_boleto', String(Math.round(pb))], ['financeiro_prob_inadimplencia', String(Math.round(pi))]])
        await db.query(`INSERT INTO configuracoes (chave, valor, updated_by) VALUES ($1,$2,$3) ON CONFLICT (chave) DO UPDATE SET valor=$2, updated_by=$3, updated_at=now()`, [chave, valor, u.id]);
      await auditar(db, { userId: u.id, acao: 'editar', entidade: 'configuracoes', depois: { financeiro: true } });
    });
    revalidatePath('/financeiro/cadastros');
    return { ok: true, mensagem: 'Parâmetros salvos.' };
  } catch (e) { return tratar(e); }
}

// ---------- Fechamento diário ----------
export async function salvarFechamento(_e, fd) {
  try {
    const u = await exigirUsuario();
    if (u.vendoComo) falha(`Você está vendo como ${u.nome}. Volte para sua conta para enviar.`);
    if (!operaFinanceiro(u)) falha('Este fechamento é da equipe financeira.');
    const [contas, produtos, categorias, centros, fornecedores, usuarios] = await Promise.all([
      q('SELECT id FROM fin_accounts WHERE ativo'), q('SELECT id FROM products'), q('SELECT id FROM fin_categories'),
      q('SELECT id FROM fin_cost_centers'), q('SELECT id FROM fin_suppliers'), q('SELECT id FROM users WHERE ativo'),
    ]);
    const conj = (r) => new Set(r.map((x) => x.id));
    const ctx = { hoje: hoje(), janelaDias: 7, contas: conj(contas), produtos: conj(produtos), categorias: conj(categorias), centros: conj(centros), fornecedores: conj(fornecedores), usuarios: conj(usuarios) };
    const { cabecalho: c, saldos, entradas, pagamentos } = lerFechamentoFinanceiro(fd, ctx);
    // Só o gerente financeiro pode marcar como "fechado"
    if (c.status === 'fechado' && !ehGerenteFinanceiro(u)) falha('Só o gerente financeiro pode fechar o dia. Deixe como "conferido".');
    const limite = await configuracao('financeiro_horario_limite', '19:00');

    const editado = await transacao(async (db) => {
      const atual = (await db.query('SELECT * FROM fin_daily_closings WHERE data_ref=$1 FOR UPDATE', [c.data_ref])).rows[0];
      if (atual && atual.status === 'fechado' && !ehGerenteFinanceiro(u)) falha('Este dia já foi fechado pelo gerente. Peça a ele para reabrir.');
      const cols = ['status', 'justificativa_data', 'observacao', 'receber_hoje', 'receber_7', 'receber_mes', 'receber_30', 'receber_60', 'receber_90', 'receber_mais90', 'receber_vencido',
        'inad_clientes', 'inad_acordos', 'inad_1_7', 'inad_8_30', 'inad_31_60', 'inad_61_90', 'inad_mais90', 'inad_recuperado',
        'bancos_conciliados', 'plataformas_conciliadas', 'divergencia_valor', 'divergencia_motivo', 'divergencia_acao', 'divergencia_responsavel_id', 'divergencia_prazo', 'risco'];
      let closingId;
      if (atual) {
        closingId = atual.id;
        const fechou = c.status === 'fechado' && atual.status !== 'fechado';
        await db.query(`UPDATE fin_daily_closings SET ${cols.map((k, i) => `${k}=$${i + 1}`).join(', ')}, updated_by=$${cols.length + 1}, updated_at=now(),
          fechado_por=${fechou ? `$${cols.length + 1}` : 'fechado_por'}, fechado_em=${fechou ? 'now()' : 'fechado_em'} WHERE id=$${cols.length + 2}`,
          [...cols.map((k) => c[k]), u.id, closingId]);
      } else {
        const pont = c.data_ref !== hoje() ? 'atrasado' : pontualidade(new Date(), limite);
        const todas = [...cols, 'pontualidade'];
        const r = await db.query(`INSERT INTO fin_daily_closings (data_ref, user_id, created_by, ${c.status === 'fechado' ? 'fechado_por, fechado_em, ' : ''}${todas.join(', ')})
          VALUES ($1,$2,$2,${c.status === 'fechado' ? '$2, now(), ' : ''}${todas.map((_, i) => `$${i + 3}`).join(', ')}) RETURNING id`,
          [c.data_ref, u.id, ...cols.map((k) => c[k]), pont]);
        closingId = r.rows[0].id;
      }
      // Substitui as linhas filhas
      await db.query('DELETE FROM fin_closing_balances WHERE closing_id=$1', [closingId]);
      for (const b of saldos) await db.query('INSERT INTO fin_closing_balances (closing_id, account_id, saldo_inicial, entradas, saidas, saldo_final, bloqueado) VALUES ($1,$2,$3,$4,$5,$6,$7)', [closingId, b.account_id, b.saldo_inicial, b.entradas, b.saidas, b.saldo_final, b.bloqueado]);
      await db.query('DELETE FROM fin_entries WHERE closing_id=$1', [closingId]);
      for (const e of entradas) await db.query('INSERT INTO fin_entries (closing_id, data_ref, tipo, origem, product_id, cliente, valor_bruto, taxa, valor_liquido, account_id) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)', [closingId, c.data_ref, e.tipo, e.origem, e.product_id, e.cliente, e.valor_bruto, e.taxa, e.valor_liquido, e.account_id]);
      await db.query('DELETE FROM fin_payments WHERE closing_id=$1', [closingId]);
      for (const p of pagamentos) await db.query('INSERT INTO fin_payments (closing_id, data_ref, supplier_id, descricao, category_id, cost_center_id, valor_previsto, valor_pago, vencimento, pago_em, forma_pagamento, status, created_by) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)', [closingId, c.data_ref, p.supplier_id, p.descricao, p.category_id, p.cost_center_id, p.valor_previsto, p.valor_pago, p.vencimento, p.pago_em, p.forma_pagamento, p.status, u.id]);
      await auditar(db, { userId: u.id, acao: atual ? 'editar' : 'criar', entidade: 'fin_daily_closings', entidadeId: closingId, antes: atual, depois: c });
      return !!atual;
    });
    revalidatePath('/'); revalidatePath('/financeiro'); revalidatePath('/financeiro/painel');
    return { ok: true, mensagem: editado ? 'Fechamento atualizado.' : 'Fechamento do dia enviado.' };
  } catch (e) { return tratar(e); }
}

// ---------- Etapa 2: ajustes de competência (DRE) ----------
export async function salvarAjuste(_e, fd) {
  try {
    const u = await exigirUsuario();
    if (!configuraFinanceiro(u) || u.vendoComo) falha('Só o gerente financeiro e o administrador lançam ajustes.');
    const mes = String(fd.get('competencia') || '').trim(); // formato YYYY-MM
    if (!/^\d{4}-\d{2}$/.test(mes)) falha('Escolha o mês de competência.');
    const competencia = `${mes}-01`;
    const tipo = opcao(fd, 'tipo', 'Tipo', Object.keys(TIPOS_AJUSTE));
    const grupo = opcao(fd, 'grupo', 'Grupo no resultado', Object.keys(GRUPOS_AJUSTE));
    const descricao = texto(fd, 'descricao', 'Descrição', 200);
    const valor = val(fd, 'valor');
    if (valor <= 0) falha('Informe um valor maior que zero.');
    const product_id = lerNumero(fd.get('product_id')) || null;
    await transacao(async (db) => {
      const r = await db.query('INSERT INTO fin_adjustments (competencia, tipo, grupo, descricao, product_id, valor, created_by) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id', [competencia, tipo, grupo, descricao, product_id, valor, u.id]);
      await auditar(db, { userId: u.id, acao: 'criar', entidade: 'fin_adjustments', entidadeId: r.rows[0].id, depois: { competencia, tipo, grupo, valor } });
    });
    revalidatePath('/financeiro/resultado');
    return { ok: true, mensagem: 'Ajuste lançado.' };
  } catch (e) { return tratar(e); }
}

export async function excluirAjuste(fd) {
  const u = await exigirUsuario();
  if (!configuraFinanceiro(u) || u.vendoComo) return;
  const id = lerNumero(fd.get('id'));
  if (!id) return;
  await transacao(async (db) => {
    const a = (await db.query('SELECT * FROM fin_adjustments WHERE id=$1', [id])).rows[0];
    if (!a) return;
    await db.query('DELETE FROM fin_adjustments WHERE id=$1', [id]);
    await auditar(db, { userId: u.id, acao: 'excluir', entidade: 'fin_adjustments', entidadeId: id, antes: a });
  });
  revalidatePath('/financeiro/resultado');
}
