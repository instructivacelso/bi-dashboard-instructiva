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
import { lerFechamentoRh } from '@/lib/leitoresRh.js';
import { operaRh, configuraRh, veRh, veSalario, VINCULOS, MODALIDADES, STATUS_COLAB, TIPOS_MOVIMENTO, TIPOS_DESLIGAMENTO, custoFolha, provisaoMensal, TIPOS_AVALIACAO, CRITERIOS_AVALIACAO, STATUS_PDI, PRONTIDAO, NIVEIS, POTENCIAL } from '@/lib/rh.js';

const falha = (m) => { throw new ErroValidacao(m); };
function tratar(e) {
  if (e instanceof ErroValidacao) return { erro: e.message };
  if (e?.code === '23505') return { erro: 'Já existe um registro com esses dados.' };
  console.error('[rh]', e);
  return { erro: 'Não foi possível salvar. Tente novamente.' };
}
const val = (fd, n) => { const x = lerNumero(fd.get(n)); return x === null ? null : Math.round(x * 100) / 100; };
const dt = (fd, n) => { const v = String(fd.get(n) || '').trim(); return /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null; };

export async function salvarCargo(_e, fd) {
  try {
    const u = await exigirUsuario();
    if (!configuraRh(u) || u.vendoComo) falha('Só o gerente de RH e o administrador mexem nos cargos.');
    const id = lerNumero(fd.get('id'));
    const dados = { nome: texto(fd, 'nome', 'Nome do cargo', 120), department_id: lerNumero(fd.get('department_id')) || null, nivel: String(fd.get('nivel') || '').trim().slice(0, 60) || null, faixa_min: val(fd, 'faixa_min'), faixa_max: val(fd, 'faixa_max'), ativo: id ? fd.get('ativo') === 'on' : true };
    await transacao(async (db) => {
      if (id) await db.query('UPDATE hr_positions SET nome=$1, department_id=$2, nivel=$3, faixa_min=$4, faixa_max=$5, ativo=$6 WHERE id=$7', [dados.nome, dados.department_id, dados.nivel, dados.faixa_min, dados.faixa_max, dados.ativo, id]);
      else await db.query('INSERT INTO hr_positions (nome, department_id, nivel, faixa_min, faixa_max) VALUES ($1,$2,$3,$4,$5)', [dados.nome, dados.department_id, dados.nivel, dados.faixa_min, dados.faixa_max]);
      await auditar(db, { userId: u.id, acao: id ? 'editar' : 'criar', entidade: 'hr_positions', entidadeId: id, depois: dados });
    });
    revalidatePath('/rh/cadastros');
    return { ok: true, mensagem: 'Cargo salvo.' };
  } catch (e) { return tratar(e); }
}

export async function salvarColaborador(_e, fd) {
  try {
    const u = await exigirUsuario();
    if (!operaRh(u) || u.vendoComo) falha('Só a equipe de RH cadastra colaboradores.');
    const id = lerNumero(fd.get('id'));
    const d = {
      nome: texto(fd, 'nome', 'Nome', 150), matricula: String(fd.get('matricula') || '').trim().slice(0, 40) || null,
      unidade: String(fd.get('unidade') || '').trim().slice(0, 120) || null, cidade: String(fd.get('cidade') || '').trim().slice(0, 120) || null,
      department_id: lerNumero(fd.get('department_id')) || null, position_id: lerNumero(fd.get('position_id')) || null,
      gestor_id: lerNumero(fd.get('gestor_id')) || null, admissao: dt(fd, 'admissao'),
      vinculo: opcao(fd, 'vinculo', 'Vínculo', Object.keys(VINCULOS)), jornada: String(fd.get('jornada') || '').trim().slice(0, 80) || null,
      modalidade: opcao(fd, 'modalidade', 'Modalidade', Object.keys(MODALIDADES)), centro_custo: String(fd.get('centro_custo') || '').trim().slice(0, 80) || null,
      experiencia_fim: dt(fd, 'experiencia_fim'), contrato_fim: dt(fd, 'contrato_fim'),
      status: opcao(fd, 'status', 'Status', Object.keys(STATUS_COLAB)), observacao: String(fd.get('observacao') || '').trim().slice(0, 400) || null,
    };
    if (d.status === 'desligado') { d.desligado_em = dt(fd, 'desligado_em') || hoje(); d.desligado_tipo = opcao(fd, 'desligado_tipo', 'Tipo de desligamento', Object.keys(TIPOS_DESLIGAMENTO)); }
    else { d.desligado_em = null; d.desligado_tipo = null; }
    const podeSalario = veSalario(u);
    const salario = podeSalario ? val(fd, 'salario') : undefined;
    await transacao(async (db) => {
      const antes = id ? (await db.query('SELECT * FROM hr_employees WHERE id=$1', [id])).rows[0] : null;
      if (id) {
        const cols = Object.keys(d);
        await db.query(`UPDATE hr_employees SET ${cols.map((c, i) => `${c}=$${i + 1}`).join(', ')}${podeSalario ? `, salario=$${cols.length + 1}` : ''}, updated_by=$${cols.length + (podeSalario ? 2 : 1)}, updated_at=now() WHERE id=$${cols.length + (podeSalario ? 3 : 2)}`,
          podeSalario ? [...cols.map((c) => d[c]), salario, u.id, id] : [...cols.map((c) => d[c]), u.id, id]);
        if (antes && d.status === 'desligado' && antes.status !== 'desligado') await db.query('INSERT INTO hr_movements (employee_id, data, tipo, detalhe, created_by) VALUES ($1,$2,$3,$4,$5)', [id, d.desligado_em, 'desligamento', TIPOS_DESLIGAMENTO[d.desligado_tipo], u.id]);
        // Auditoria sem expor salário para quem não pode vê-lo
        await auditar(db, { userId: u.id, acao: 'editar', entidade: 'hr_employees', entidadeId: id, antes: podeSalario ? antes : { ...antes, salario: undefined }, depois: d });
      } else {
        const cols = Object.keys(d);
        const r = await db.query(`INSERT INTO hr_employees (${cols.join(', ')}${podeSalario ? ', salario' : ''}, created_by) VALUES (${cols.map((_, i) => `$${i + 1}`).join(', ')}${podeSalario ? `, $${cols.length + 1}` : ''}, $${cols.length + (podeSalario ? 2 : 1)}) RETURNING id`,
          podeSalario ? [...cols.map((c) => d[c]), salario, u.id] : [...cols.map((c) => d[c]), u.id]);
        if (d.admissao) await db.query('INSERT INTO hr_movements (employee_id, data, tipo, created_by) VALUES ($1,$2,$3,$4)', [r.rows[0].id, d.admissao, 'admissao', u.id]);
        await auditar(db, { userId: u.id, acao: 'criar', entidade: 'hr_employees', entidadeId: r.rows[0].id, depois: d });
      }
    });
    revalidatePath('/rh/colaboradores');
    return { ok: true, mensagem: 'Colaborador salvo.' };
  } catch (e) { return tratar(e); }
}

export async function salvarMovimento(_e, fd) {
  try {
    const u = await exigirUsuario();
    if (!operaRh(u) || u.vendoComo) falha('Sem permissão.');
    const employee_id = lerNumero(fd.get('employee_id'));
    if (!employee_id) falha('Colaborador inválido.');
    const tipo = opcao(fd, 'tipo', 'Tipo', Object.keys(TIPOS_MOVIMENTO));
    const data = dt(fd, 'data') || hoje();
    const detalhe = String(fd.get('detalhe') || '').trim().slice(0, 300) || null;
    const valor = ['alteracao_salario', 'promocao'].includes(tipo) ? (veSalario(u) ? val(fd, 'valor') : null) : null;
    await transacao(async (db) => {
      await db.query('INSERT INTO hr_movements (employee_id, data, tipo, detalhe, valor, created_by) VALUES ($1,$2,$3,$4,$5,$6)', [employee_id, data, tipo, detalhe, valor, u.id]);
      if (tipo === 'alteracao_salario' && valor !== null && veSalario(u)) await db.query('UPDATE hr_employees SET salario=$1, updated_by=$2, updated_at=now() WHERE id=$3', [valor, u.id, employee_id]);
      await auditar(db, { userId: u.id, acao: 'criar', entidade: 'hr_movements', entidadeId: employee_id, depois: { tipo, data } });
    });
    revalidatePath(`/rh/colaboradores/${employee_id}`);
    return { ok: true, mensagem: 'Movimentação registrada.' };
  } catch (e) { return tratar(e); }
}

export async function salvarFechamentoRh(_e, fd) {
  try {
    const u = await exigirUsuario();
    if (u.vendoComo) falha(`Você está vendo como ${u.nome}. Volte para sua conta para enviar.`);
    if (!operaRh(u)) falha('Este fechamento é da equipe de RH.');
    const usuarios = new Set((await q('SELECT id FROM users WHERE ativo')).map((x) => x.id));
    const r = lerFechamentoRh(fd, { hoje: hoje(), janelaDias: 7, usuarios });
    const limite = await configuracao('rh_horario_limite', '19:00');
    const editado = await transacao(async (db) => {
      const atual = (await db.query('SELECT * FROM hr_daily_closings WHERE user_id=$1 AND data_ref=$2 FOR UPDATE', [u.id, r.data_ref])).rows[0];
      const dados = { ...r }; delete dados.data_ref;
      const cols = Object.keys(dados);
      let novo;
      if (atual) novo = (await db.query(`UPDATE hr_daily_closings SET ${cols.map((c, i) => `${c}=$${i + 1}`).join(', ')}, updated_by=$${cols.length + 1}, updated_at=now() WHERE id=$${cols.length + 2} RETURNING id`, [...cols.map((c) => dados[c]), u.id, atual.id])).rows[0];
      else {
        const pont = r.data_ref !== hoje() ? 'atrasado' : pontualidade(new Date(), limite);
        novo = (await db.query(`INSERT INTO hr_daily_closings (data_ref, user_id, created_by, pontualidade, ${cols.join(', ')}) VALUES ($1,$2,$2,$3, ${cols.map((_, i) => `$${i + 4}`).join(', ')}) RETURNING id`, [r.data_ref, u.id, pont, ...cols.map((c) => dados[c])])).rows[0];
      }
      await auditar(db, { userId: u.id, acao: atual ? 'editar' : 'criar', entidade: 'hr_daily_closings', entidadeId: novo.id, antes: atual, depois: r });
      return !!atual;
    });
    revalidatePath('/'); revalidatePath('/rh'); revalidatePath('/rh/fechamento');
    return { ok: true, mensagem: editado ? 'Fechamento atualizado.' : 'Fechamento do dia enviado. Obrigado!' };
  } catch (e) { return tratar(e); }
}

export async function salvarConfigRh(_e, fd) {
  try {
    const u = await exigirUsuario();
    if (!configuraRh(u) || u.vendoComo) falha('Sem permissão.');
    const lim = String(fd.get('horario_limite') || '');
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(lim)) falha('Horário-limite inválido.');
    const abs = lerNumero(fd.get('meta_absenteismo')), tur = lerNumero(fd.get('meta_turnover'));
    if (abs === null || abs < 0 || tur === null || tur < 0) falha('As metas devem ser zero ou mais.');
    await transacao(async (db) => {
      for (const [chave, valor] of [['rh_horario_limite', lim], ['rh_meta_absenteismo', String(abs)], ['rh_meta_turnover', String(tur)]])
        await db.query(`INSERT INTO configuracoes (chave, valor, updated_by) VALUES ($1,$2,$3) ON CONFLICT (chave) DO UPDATE SET valor=$2, updated_by=$3, updated_at=now()`, [chave, valor, u.id]);
      await auditar(db, { userId: u.id, acao: 'editar', entidade: 'configuracoes', depois: { rh: true } });
    });
    revalidatePath('/rh/cadastros');
    return { ok: true, mensagem: 'Parâmetros salvos.' };
  } catch (e) { return tratar(e); }
}

// ---------- Etapa 2: folha e clima ----------
const mesValido = (v) => /^\d{4}-\d{2}$/.test(v);

export async function salvarFolha(_e, fd) {
  try {
    const u = await exigirUsuario();
    if (!veSalario(u) || u.vendoComo) falha('A folha é restrita ao gerente de RH e à diretoria.');
    const mes = String(fd.get('competencia') || '');
    if (!mesValido(mes)) falha('Mês inválido.');
    const competencia = `${mes}-01`;
    const ids = fd.getAll('employee').map(Number).filter(Boolean);
    await transacao(async (db) => {
      for (const id of ids) {
        const g = (k) => { const n = lerNumero(fd.get(`${k}_${id}`)); if (n !== null && n < 0) falha('Valores da folha não podem ser negativos.'); return n === null ? 0 : Math.round(n * 100) / 100; };
        const base = g('base'), variavel = g('variavel'), beneficios = g('beneficios'), encargos = g('encargos'), descontos = g('descontos');
        const provisoes = provisaoMensal(base, variavel);
        const custo = custoFolha({ salario_base: base, variavel, beneficios, encargos, descontos, provisoes });
        await db.query(`INSERT INTO hr_payroll (competencia, employee_id, salario_base, variavel, beneficios, encargos, descontos, provisoes, custo_total, updated_by)
                        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
                        ON CONFLICT (competencia, employee_id) DO UPDATE SET salario_base=$3, variavel=$4, beneficios=$5, encargos=$6, descontos=$7, provisoes=$8, custo_total=$9, updated_by=$10, updated_at=now()
                        WHERE hr_payroll.status <> 'enviada_financeiro'`, [competencia, id, base, variavel, beneficios, encargos, descontos, provisoes, custo, u.id]);
      }
      await auditar(db, { userId: u.id, acao: 'editar', entidade: 'hr_payroll', depois: { competencia, colaboradores: ids.length } });
    });
    revalidatePath('/rh/folha');
    return { ok: true, mensagem: 'Folha salva.' };
  } catch (e) { return tratar(e); }
}

export async function enviarFolhaFinanceiro(fd) {
  const u = await exigirUsuario();
  if (!veSalario(u) || u.vendoComo) return { erro: 'Sem permissão.' };
  const mes = String(fd.get('competencia') || '');
  if (!mesValido(mes)) return { erro: 'Mês inválido.' };
  const competencia = `${mes}-01`;
  try {
    await transacao(async (db) => {
      const tot = (await db.query(`SELECT COALESCE(SUM(custo_total),0) v, COUNT(*) n FROM hr_payroll WHERE competencia=$1`, [competencia])).rows[0];
      if (Number(tot.n) === 0) falha('Lance a folha antes de enviar.');
      await db.query(`UPDATE hr_payroll SET status='enviada_financeiro', updated_by=$2, updated_at=now() WHERE competencia=$1`, [competencia, u.id]);
      // Envia o total ao Financeiro como lançamento de pessoal (sem redigitar); substitui o anterior do mês
      const desc = `Folha de pessoal — ${mes}`;
      await db.query(`DELETE FROM fin_adjustments WHERE competencia=$1 AND descricao=$2`, [competencia, desc]);
      await db.query(`INSERT INTO fin_adjustments (competencia, tipo, grupo, descricao, valor, created_by) VALUES ($1,'outro','pessoal',$2,$3,$4)`, [competencia, desc, Number(tot.v), u.id]);
      await auditar(db, { userId: u.id, acao: 'editar', entidade: 'hr_payroll', depois: { competencia, enviada: true, total: Number(tot.v) } });
    });
    revalidatePath('/rh/folha'); revalidatePath('/financeiro/resultado');
    return { ok: true, mensagem: 'Folha fechada e enviada ao financeiro.' };
  } catch (e) { return tratar(e); }
}

export async function salvarClima(_e, fd) {
  try {
    const u = await exigirUsuario();
    if (!configuraRh(u) || u.vendoComo) falha('Só o gerente de RH e o administrador lançam clima.');
    const mes = String(fd.get('competencia') || '');
    if (!mesValido(mes)) falha('Mês inválido.');
    const competencia = `${mes}-01`;
    const dep = lerNumero(fd.get('department_id')) || null;
    const g = (k) => { const n = lerNumero(fd.get(k)); if (n !== null && n < 0) falha('Números não podem ser negativos.'); return n === null ? 0 : Math.round(n); };
    const respostas = g('respostas'), promotores = g('promotores'), neutros = g('neutros'), detratores = g('detratores');
    if (promotores + neutros + detratores > respostas) falha('A soma de promotores, neutros e detratores não pode passar do total de respostas.');
    const sat = lerNumero(fd.get('satisfacao_media'));
    if (sat !== null && (sat < 0 || sat > 10)) falha('A satisfação média vai de 0 a 10.');
    await transacao(async (db) => {
      await db.query(`INSERT INTO hr_climate (competencia, department_id, respostas, promotores, neutros, detratores, satisfacao_media, observacao, created_by)
                      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
                      ON CONFLICT (competencia, department_id) DO UPDATE SET respostas=$3, promotores=$4, neutros=$5, detratores=$6, satisfacao_media=$7, observacao=$8`,
        [competencia, dep, respostas, promotores, neutros, detratores, sat, String(fd.get('observacao') || '').trim().slice(0, 400) || null, u.id]);
      await auditar(db, { userId: u.id, acao: 'criar', entidade: 'hr_climate', depois: { competencia, respostas } });
    });
    revalidatePath('/rh/clima');
    return { ok: true, mensagem: 'Clima registrado.' };
  } catch (e) { return tratar(e); }
}

// ---------- Etapa 2 (parte 2): avaliações, PDI, treinamentos, sucessão ----------
export async function salvarAvaliacao(_e, fd) {
  try {
    const u = await exigirUsuario();
    if (!veRh(u) || u.vendoComo) falha('Só o gerente de RH e a diretoria registram avaliações.');
    const employee_id = lerNumero(fd.get('employee_id'));
    if (!employee_id) falha('Escolha o colaborador.');
    const mes = String(fd.get('competencia') || ''); if (!mesValido(mes)) falha('Mês inválido.');
    const tipo = opcao(fd, 'tipo', 'Tipo', Object.keys(TIPOS_AVALIACAO));
    const nota = lerNumero(fd.get('nota_geral'));
    if (nota !== null && (nota < 0 || nota > 10)) falha('A nota geral vai de 0 a 10.');
    const criterios = {};
    for (const k of Object.keys(CRITERIOS_AVALIACAO)) { const n = lerNumero(fd.get(`crit_${k}`)); if (n !== null) { if (n < 0 || n > 10) falha('Os critérios vão de 0 a 10.'); criterios[k] = n; } }
    const potencial = ['baixo', 'medio', 'alto'].includes(String(fd.get('potencial'))) ? String(fd.get('potencial')) : null;
    const acoes = [];
    for (const i of [...new Set(fd.getAll('pdi_idx').map(String))]) { const a = String(fd.get(`pdi${i}_acao`) || '').trim(); if (a) acoes.push({ acao: a.slice(0, 300), responsavel: String(fd.get(`pdi${i}_resp`) || '').trim().slice(0, 120) || null, prazo: dt(fd, `pdi${i}_prazo`) }); }
    await transacao(async (db) => {
      const ev = (await db.query(`INSERT INTO hr_evaluations (employee_id, competencia, tipo, avaliador_id, nota_geral, criterios, pontos_fortes, pontos_desenvolver, potencial, proxima_revisao, created_by)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING id`,
        [employee_id, `${mes}-01`, tipo, u.id, nota, Object.keys(criterios).length ? JSON.stringify(criterios) : null, String(fd.get('pontos_fortes') || '').trim().slice(0, 500) || null, String(fd.get('pontos_desenvolver') || '').trim().slice(0, 500) || null, potencial, dt(fd, 'proxima_revisao'), u.id])).rows[0];
      for (const a of acoes) await db.query('INSERT INTO hr_pdi (employee_id, evaluation_id, acao, responsavel, prazo, created_by) VALUES ($1,$2,$3,$4,$5,$6)', [employee_id, ev.id, a.acao, a.responsavel, a.prazo, u.id]);
      await auditar(db, { userId: u.id, acao: 'criar', entidade: 'hr_evaluations', entidadeId: ev.id, depois: { employee_id, tipo, nota } });
    });
    revalidatePath('/rh/desempenho'); revalidatePath(`/rh/colaboradores/${employee_id}`);
    return { ok: true, mensagem: 'Avaliação registrada.' };
  } catch (e) { return tratar(e); }
}

export async function atualizarPdi(fd) {
  const u = await exigirUsuario();
  if (!veRh(u) || u.vendoComo) return;
  const id = lerNumero(fd.get('id')); const status = String(fd.get('status') || '');
  if (!id || !STATUS_PDI[status]) return;
  await transacao(async (db) => {
    await db.query('UPDATE hr_pdi SET status=$1 WHERE id=$2', [status, id]);
    await auditar(db, { userId: u.id, acao: 'editar', entidade: 'hr_pdi', entidadeId: id, depois: { status } });
  });
  revalidatePath('/rh/desempenho');
}

export async function salvarTreinamento(_e, fd) {
  try {
    const u = await exigirUsuario();
    if (!veRh(u) || u.vendoComo) falha('Sem permissão.');
    const mes = String(fd.get('competencia') || ''); if (!mesValido(mes)) falha('Mês inválido.');
    const nome = texto(fd, 'nome', 'Nome do treinamento', 150);
    const carga = lerNumero(fd.get('carga_horaria')); if (carga !== null && carga < 0) falha('Carga horária inválida.');
    const custo = lerNumero(fd.get('custo')); if (custo !== null && custo < 0) falha('Custo inválido.');
    const participantes = fd.getAll('participante').map(Number).filter(Boolean);
    await transacao(async (db) => {
      const t = (await db.query(`INSERT INTO hr_trainings (nome, competencia, competencia_dev, publico, instrutor, formato, carga_horaria, custo, data_treino, observacao, created_by)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING id`,
        [nome, `${mes}-01`, String(fd.get('competencia_dev') || '').trim().slice(0, 120) || null, String(fd.get('publico') || '').trim().slice(0, 120) || null, String(fd.get('instrutor') || '').trim().slice(0, 120) || null, String(fd.get('formato') || '').trim().slice(0, 80) || null, carga ?? 0, custo ?? 0, dt(fd, 'data_treino'), String(fd.get('observacao') || '').trim().slice(0, 300) || null, u.id])).rows[0];
      for (const pid of participantes) { const pres = fd.get(`presente_${pid}`) !== 'nao'; await db.query('INSERT INTO hr_training_participants (training_id, employee_id, presente) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING', [t.id, pid, pres]); }
      await auditar(db, { userId: u.id, acao: 'criar', entidade: 'hr_trainings', entidadeId: t.id, depois: { nome, participantes: participantes.length } });
    });
    revalidatePath('/rh/treinamentos');
    return { ok: true, mensagem: 'Treinamento registrado.' };
  } catch (e) { return tratar(e); }
}

export async function salvarSucessao(_e, fd) {
  try {
    const u = await exigirUsuario();
    if (!veRh(u) || u.vendoComo) falha('Sem permissão.');
    const employee_id = lerNumero(fd.get('employee_id'));
    if (!employee_id) falha('Escolha a posição-chave.');
    const d = {
      sucessor_id: lerNumero(fd.get('sucessor_id')) || null,
      prontidao: opcao(fd, 'prontidao', 'Prontidão', Object.keys(PRONTIDAO)),
      risco_perda: opcao(fd, 'risco_perda', 'Risco de perda', Object.keys(NIVEIS)),
      impacto: opcao(fd, 'impacto', 'Impacto', Object.keys(NIVEIS)),
      plano_retencao: String(fd.get('plano_retencao') || '').trim().slice(0, 400) || null,
    };
    if (d.sucessor_id === employee_id) falha('O sucessor não pode ser a própria pessoa.');
    await transacao(async (db) => {
      await db.query(`INSERT INTO hr_succession (employee_id, sucessor_id, prontidao, risco_perda, impacto, plano_retencao, updated_by)
        VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT (employee_id) DO UPDATE SET sucessor_id=$2, prontidao=$3, risco_perda=$4, impacto=$5, plano_retencao=$6, updated_by=$7, updated_at=now()`,
        [employee_id, d.sucessor_id, d.prontidao, d.risco_perda, d.impacto, d.plano_retencao, u.id]);
      await auditar(db, { userId: u.id, acao: 'editar', entidade: 'hr_succession', entidadeId: employee_id, depois: d });
    });
    revalidatePath('/rh/sucessao');
    return { ok: true, mensagem: 'Sucessão salva.' };
  } catch (e) { return tratar(e); }
}
