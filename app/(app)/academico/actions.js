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
import { lerDiarioProfessor } from '@/lib/leitoresAcademico.js';
import { ehProfessor, veAcademico, gereConteudo, configuraAcademico, ehDoAcademico, etapaConteudoValida, ETAPAS_CONTEUDO, PRIORIDADES, STATUS_PROFESSOR, STATUS_QUALIDADE, CRITERIOS_QUALIDADE, PESOS_ROTULOS, notaQualidade } from '@/lib/academico.js';

const falha = (m) => { throw new ErroValidacao(m); };
function tratar(e) {
  if (e instanceof ErroValidacao) return { erro: e.message };
  if (e?.code === '23505') return { erro: 'Já existe um registro com esses dados.' };
  console.error('[academico]', e);
  return { erro: 'Não foi possível salvar. Tente novamente.' };
}
const val = (fd, n) => { const x = lerNumero(fd.get(n)); return x === null ? null : Math.round(x * 100) / 100; };
const dt = (fd, n) => { const v = String(fd.get(n) || '').trim(); return /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null; };

export async function salvarDiarioProfessor(_e, fd) {
  try {
    const u = await exigirUsuario();
    if (u.vendoComo) falha(`Você está vendo como ${u.nome}. Volte para sua conta para enviar.`);
    if (!ehProfessor(u)) falha('Este formulário é dos professores.');
    const d = lerDiarioProfessor(fd, { hoje: hoje(), janelaDias: 7 });
    const limite = await configuracao('academico_horario_limite', '20:00');
    const editado = await transacao(async (db) => {
      const atual = (await db.query('SELECT * FROM academic_daily_forms WHERE user_id=$1 AND data_ref=$2 FOR UPDATE', [u.id, d.data_ref])).rows[0];
      const dados = { ...d }; delete dados.data_ref;
      const cols = Object.keys(dados);
      let novo;
      if (atual) novo = (await db.query(`UPDATE academic_daily_forms SET ${cols.map((c, i) => `${c}=$${i + 1}`).join(', ')}, updated_by=$${cols.length + 1}, updated_at=now() WHERE id=$${cols.length + 2} RETURNING id`, [...cols.map((c) => dados[c]), u.id, atual.id])).rows[0];
      else {
        const pont = d.data_ref !== hoje() ? 'atrasado' : pontualidade(new Date(), limite);
        novo = (await db.query(`INSERT INTO academic_daily_forms (data_ref, user_id, created_by, pontualidade, ${cols.join(', ')}) VALUES ($1,$2,$2,$3, ${cols.map((_, i) => `$${i + 4}`).join(', ')}) RETURNING id`, [d.data_ref, u.id, pont, ...cols.map((c) => dados[c])])).rows[0];
      }
      await auditar(db, { userId: u.id, acao: atual ? 'editar' : 'criar', entidade: 'academic_daily_forms', entidadeId: novo.id, antes: atual, depois: d });
      return !!atual;
    });
    revalidatePath('/'); revalidatePath('/academico'); revalidatePath('/academico/diario'); revalidatePath('/academico/painel');
    return { ok: true, mensagem: editado ? 'Registro do dia atualizado.' : 'Registro do dia enviado. Obrigado!' };
  } catch (e) { return tratar(e); }
}

export async function salvarProfessor(_e, fd) {
  try {
    const u = await exigirUsuario();
    if (!configuraAcademico(u) || u.vendoComo) falha('Só a coordenação e o administrador cadastram professores.');
    const id = lerNumero(fd.get('id'));
    const d = {
      user_id: lerNumero(fd.get('user_id')) || null, nome: texto(fd, 'nome', 'Nome', 150),
      especialidade: String(fd.get('especialidade') || '').trim().slice(0, 120) || null, unidade: String(fd.get('unidade') || '').trim().slice(0, 120) || null,
      gestor_id: lerNumero(fd.get('gestor_id')) || null, status: opcao(fd, 'status', 'Status', Object.keys(STATUS_PROFESSOR)),
    };
    d.ativo = d.status === 'ativo';
    await transacao(async (db) => {
      if (id) await db.query('UPDATE academic_teachers SET user_id=$1, nome=$2, especialidade=$3, unidade=$4, gestor_id=$5, status=$6, ativo=$7 WHERE id=$8', [d.user_id, d.nome, d.especialidade, d.unidade, d.gestor_id, d.status, d.ativo, id]);
      else await db.query('INSERT INTO academic_teachers (user_id, nome, especialidade, unidade, gestor_id, status, ativo) VALUES ($1,$2,$3,$4,$5,$6,$7)', [d.user_id, d.nome, d.especialidade, d.unidade, d.gestor_id, d.status, d.ativo]);
      await auditar(db, { userId: u.id, acao: id ? 'editar' : 'criar', entidade: 'academic_teachers', entidadeId: id, depois: d });
    });
    revalidatePath('/academico/cadastros');
    return { ok: true, mensagem: 'Professor salvo.' };
  } catch (e) { return tratar(e); }
}

// Criar item no pipeline ou mover de etapa
export async function salvarConteudo(_e, fd) {
  try {
    const u = await exigirUsuario();
    if (!gereConteudo(u) || u.vendoComo) falha('Sem permissão para o pipeline de conteúdo.');
    const id = lerNumero(fd.get('id'));
    await transacao(async (db) => {
      if (id) {
        const c = (await db.query('SELECT * FROM academic_content WHERE id=$1 FOR UPDATE', [id])).rows[0];
        if (!c) falha('Conteúdo não encontrado.');
        const etapa = opcao(fd, 'etapa', 'Etapa', Object.keys(ETAPAS_CONTEUDO));
        if (etapa !== c.etapa) {
          if (!etapaConteudoValida(c.etapa, etapa)) falha(`Não é possível ir de "${ETAPAS_CONTEUDO[c.etapa]}" para "${ETAPAS_CONTEUDO[etapa]}".`);
          await db.query('INSERT INTO academic_content_events (content_id, de, para, user_id) VALUES ($1,$2,$3,$4)', [id, c.etapa, etapa, u.id]);
          if (etapa === 'publicacao') await db.query('UPDATE academic_content SET publicado_em=CURRENT_DATE WHERE id=$1', [id]);
        }
        const prioridade = opcao(fd, 'prioridade', 'Prioridade', Object.keys(PRIORIDADES));
        await db.query('UPDATE academic_content SET etapa=$1, prioridade=$2, prazo=$3, responsavel_id=$4, link=$5, observacao=$6, updated_by=$7, updated_at=now() WHERE id=$8',
          [etapa, prioridade, dt(fd, 'prazo'), lerNumero(fd.get('responsavel_id')) || null, String(fd.get('link') || '').trim().slice(0, 400) || null, String(fd.get('observacao') || '').trim().slice(0, 400) || null, u.id, id]);
        await auditar(db, { userId: u.id, acao: 'editar', entidade: 'academic_content', entidadeId: id, antes: c, depois: { etapa } });
      } else {
        const titulo = texto(fd, 'titulo', 'Título', 200);
        const r = await db.query('INSERT INTO academic_content (titulo, product_id, curso, tipo, etapa, prioridade, prazo, responsavel_id, created_by) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id',
          [titulo, lerNumero(fd.get('product_id')) || null, String(fd.get('curso') || '').trim().slice(0, 150) || null, String(fd.get('tipo') || '').trim().slice(0, 80) || null,
           opcao(fd, 'etapa', 'Etapa', Object.keys(ETAPAS_CONTEUDO)), opcao(fd, 'prioridade', 'Prioridade', Object.keys(PRIORIDADES)), dt(fd, 'prazo'), lerNumero(fd.get('responsavel_id')) || u.id, u.id]);
        await db.query('INSERT INTO academic_content_events (content_id, para, user_id) VALUES ($1,$2,$3)', [r.rows[0].id, 'ideia', u.id]);
        await auditar(db, { userId: u.id, acao: 'criar', entidade: 'academic_content', entidadeId: r.rows[0].id, depois: { titulo } });
      }
    });
    revalidatePath('/academico/pipeline'); revalidatePath('/academico');
    return { ok: true, mensagem: id ? 'Conteúdo atualizado.' : 'Conteúdo criado no pipeline.' };
  } catch (e) { return tratar(e); }
}

export async function salvarMetasAcademico(_e, fd) {
  try {
    const u = await exigirUsuario();
    if (!veAcademico(u) || u.vendoComo) falha('Só a coordenação e a diretoria definem metas.');
    await transacao(async (db) => {
      for (const uid of fd.getAll('professor').map(Number).filter(Boolean)) {
        const m = (k) => { const n = lerNumero(fd.get(`${k}_${uid}`)); if (n !== null && n < 0) falha('As metas não podem ser negativas.'); return n; };
        await db.query(`INSERT INTO academic_goals (user_id, meta_aulas_mes, meta_criativos_mes, meta_paginas_mes, meta_lives_mes, meta_receita_mes, meta_entrega_prazo, updated_by)
                        VALUES ($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT (user_id) DO UPDATE SET meta_aulas_mes=$2, meta_criativos_mes=$3, meta_paginas_mes=$4, meta_lives_mes=$5, meta_receita_mes=$6, meta_entrega_prazo=$7, updated_by=$8, updated_at=now()`,
          [uid, m('aulas'), m('criativos'), m('paginas'), m('lives'), m('receita'), m('prazo'), u.id]);
      }
      const lim = String(fd.get('horario_limite') || '');
      if (lim) { if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(lim)) falha('Horário-limite inválido.'); await db.query(`INSERT INTO configuracoes (chave, valor, updated_by) VALUES ('academico_horario_limite',$1,$2) ON CONFLICT (chave) DO UPDATE SET valor=$1, updated_by=$2, updated_at=now()`, [lim, u.id]); }
      await auditar(db, { userId: u.id, acao: 'editar', entidade: 'academic_goals' });
    });
    revalidatePath('/academico/cadastros');
    return { ok: true, mensagem: 'Metas salvas.' };
  } catch (e) { return tratar(e); }
}

// ---------- Etapa 2: qualidade e pontuação ----------
export async function salvarQualidade(_e, fd) {
  try {
    const u = await exigirUsuario();
    if (!veAcademico(u) || u.vendoComo) falha('Só a coordenação avalia a qualidade das entregas.');
    const content_id = lerNumero(fd.get('content_id'));
    if (!content_id) falha('Escolha o conteúdo.');
    const status = opcao(fd, 'status', 'Resultado', Object.keys(STATUS_QUALIDADE));
    const criterios = {};
    for (const k of Object.keys(CRITERIOS_QUALIDADE)) { const n = lerNumero(fd.get(`q_${k}`)); if (n !== null) { if (n < 0 || n > 10) falha('Os critérios vão de 0 a 10.'); criterios[k] = n; } }
    const nota = notaQualidade(criterios);
    const motivo = status === 'aprovado' ? (String(fd.get('motivo') || '').trim().slice(0, 300) || null) : texto(fd, 'motivo', 'Motivo do ajuste ou da reprovação', 300);
    const prazo = status === 'aprovado' ? null : dt(fd, 'prazo_correcao');
    await transacao(async (db) => {
      const c = (await db.query('SELECT * FROM academic_content WHERE id=$1 FOR UPDATE', [content_id])).rows[0];
      if (!c) falha('Conteúdo não encontrado.');
      const primeira = (await db.query('SELECT COUNT(*)::int n FROM academic_quality WHERE content_id=$1', [content_id])).rows[0].n === 0;
      const noPrazo = c.prazo ? String(c.prazo).slice(0, 10) >= new Date().toISOString().slice(0, 10) : null;
      await db.query('INSERT INTO academic_quality (content_id, avaliador_id, criterios, nota, status, motivo, prazo_correcao, no_prazo) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)',
        [content_id, u.id, Object.keys(criterios).length ? JSON.stringify(criterios) : null, nota, status, motivo, prazo, noPrazo]);
      const mud = {};
      if (primeira) mud.aprovado_primeira = status === 'aprovado';
      if (status === 'aprovado') {
        // Aprovado segue para aprovação (ou fica onde está, se já passou)
        if (['revisao', 'ajustes'].includes(c.etapa)) { mud.etapa = 'aprovacao'; await db.query('INSERT INTO academic_content_events (content_id, de, para, user_id) VALUES ($1,$2,$3,$4)', [content_id, c.etapa, 'aprovacao', u.id]); }
      } else {
        // Ajuste ou reprovação: volta para Ajustes e conta um ciclo de retrabalho
        mud.ciclos_revisao = Number(c.ciclos_revisao || 0) + 1;
        if (c.etapa !== 'ajustes') { mud.etapa = 'ajustes'; await db.query('INSERT INTO academic_content_events (content_id, de, para, user_id) VALUES ($1,$2,$3,$4)', [content_id, c.etapa, 'ajustes', u.id]); }
        if (prazo) mud.prazo = prazo;
      }
      if (Object.keys(mud).length) { const cols = Object.keys(mud); await db.query(`UPDATE academic_content SET ${cols.map((k, i) => `${k}=$${i + 1}`).join(', ')}, updated_by=$${cols.length + 1}, updated_at=now() WHERE id=$${cols.length + 2}`, [...cols.map((k) => mud[k]), u.id, content_id]); }
      await auditar(db, { userId: u.id, acao: 'criar', entidade: 'academic_quality', entidadeId: content_id, depois: { status, nota } });
    });
    revalidatePath('/academico/qualidade'); revalidatePath('/academico/pipeline'); revalidatePath('/academico');
    return { ok: true, mensagem: status === 'aprovado' ? 'Entrega aprovada.' : 'Avaliação registrada: o conteúdo voltou para ajustes.' };
  } catch (e) { return tratar(e); }
}

export async function salvarPesos(_e, fd) {
  try {
    const u = await exigirUsuario();
    if (!configuraAcademico(u) || u.vendoComo) falha('Só a coordenação e o administrador configuram a pontuação.');
    await transacao(async (db) => {
      for (const k of Object.keys(PESOS_ROTULOS)) {
        const n = lerNumero(fd.get(`peso_${k}`));
        if (n === null) continue;
        if (n < 0) falha('Os pesos não podem ser negativos.');
        await db.query(`INSERT INTO academic_weights (chave, peso, updated_by) VALUES ($1,$2,$3) ON CONFLICT (chave) DO UPDATE SET peso=$2, updated_by=$3, updated_at=now()`, [k, n, u.id]);
      }
      const ativa = fd.get('ativa') === 'on' ? 'true' : 'false';
      await db.query(`INSERT INTO configuracoes (chave, valor, updated_by) VALUES ('academico_pontuacao_ativa',$1,$2) ON CONFLICT (chave) DO UPDATE SET valor=$1, updated_by=$2, updated_at=now()`, [ativa, u.id]);
      await auditar(db, { userId: u.id, acao: 'editar', entidade: 'academic_weights', depois: { ativa } });
    });
    revalidatePath('/academico/qualidade'); revalidatePath('/academico/cadastros');
    return { ok: true, mensagem: 'Pontuação salva.' };
  } catch (e) { return tratar(e); }
}
