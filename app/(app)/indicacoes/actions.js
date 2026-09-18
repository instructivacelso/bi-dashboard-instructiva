'use server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { exigirUsuario } from '@/lib/auth.js';
import { transacao, q, q1 } from '@/lib/db.js';
import { auditar } from '@/lib/auditoria.js';
import { hoje } from '@/lib/datas.js';
import { lerNumero } from '@/lib/formato.js';
import { ErroValidacao, texto, inteiro, opcao, decimal } from '@/lib/leitores.js';
import { normalizarContato } from '@/lib/leitoresSuporte.js';
import { lerGerenteIndicacao } from '@/lib/leitoresIndicacao.js';
import {
  TIPOS_BENEFICIO, STATUS_CAMPANHA, RESPOSTAS_CONVITE, AVISOS, VALIDACOES, ETAPAS, PAGAMENTOS, STATUS_VENDA, GARGALOS_INDICACAO,
  normalizarTelefone, validacaoInicial, marcosAtingidos, podeContatar, etapaValida, veTodaIndicacao, registraIndicacao, ehDaIndicacao, gereBeneficios,
} from '@/lib/indicacao.js';
import { pontualidade } from '@/lib/comercial.js';
import { numerosIndicacao } from '@/lib/dadosIndicacao.js';
import { configuracao } from '@/lib/dadosComercial.js';

const falha = (m) => { throw new ErroValidacao(m); };
function tratar(e) {
  if (e instanceof ErroValidacao) return { erro: e.message };
  if (e?.digest?.startsWith?.('NEXT_REDIRECT')) throw e;
  console.error('[indicacao]', e);
  return { erro: 'Não foi possível salvar agora. Tente de novo em instantes.' };
}
const ev = (db, id, userId, evento, de = null, para = null, detalhe = null) =>
  db.query('INSERT INTO referral_events (referral_id, user_id, evento, de, para, detalhe) VALUES ($1,$2,$3,$4,$5,$6)', [id, userId, evento, de, para, detalhe]);

async function aluno(db, nome, contato) {
  const c = normalizarContato(contato);
  const achado = c.email ? (await db.query('SELECT id FROM students WHERE lower(email)=$1', [c.email])).rows[0] : (await db.query('SELECT id FROM students WHERE telefone=$1', [c.telefone])).rows[0];
  if (achado) return achado.id;
  return (await db.query('INSERT INTO students (nome, email, telefone) VALUES ($1,$2,$3) RETURNING id', [nome, c.email, c.telefone])).rows[0].id;
}

// Gera o benefício quando o aluno atinge a quantidade de indicações VÁLIDAS da campanha
async function conferirBeneficios(db, campaignId, referrerId) {
  const camp = (await db.query('SELECT * FROM referral_campaigns WHERE id=$1', [campaignId])).rows[0];
  const validas = (await db.query(`SELECT COUNT(*)::int n FROM referrals WHERE campaign_id=$1 AND referrer_id=$2 AND validacao='valida'`, [campaignId, referrerId])).rows[0].n;
  const alvo = marcosAtingidos(validas, camp.qtd_por_beneficio);
  for (let m = 1; m <= alvo; m++) {
    const sorteio = camp.gera_sorteio ? (await db.query(`SELECT nextval('referral_sorteio_seq') n`)).rows[0].n : null;
    await db.query(
      `INSERT INTO referral_benefits (campaign_id, referrer_id, marco, tipo, descricao, valor, numero_sorteio) VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT DO NOTHING`,
      [campaignId, referrerId, m, camp.beneficio_tipo, camp.beneficio_descricao, camp.beneficio_valor, sorteio]
    );
  }
}

// ---------- Campanhas ----------
export async function salvarCampanha(_e, fd) {
  try {
    const u = await exigirUsuario();
    if (!veTodaIndicacao(u) || u.vendoComo) falha('Só o gerente de Indicação e o administrador cadastram campanhas.');
    const id = lerNumero(fd.get('id'));
    const d = {
      nome: texto(fd, 'nome', 'Nome da campanha', 150),
      product_id: lerNumero(fd.get('product_id')) || null,
      qtd_por_beneficio: inteiro(fd, 'qtd_por_beneficio', 'Indicações válidas por benefício'),
      beneficio_tipo: opcao(fd, 'beneficio_tipo', 'Tipo de benefício', Object.keys(TIPOS_BENEFICIO)),
      beneficio_descricao: texto(fd, 'beneficio_descricao', 'Descrição do benefício', 300),
      beneficio_valor: decimal(fd, 'beneficio_valor', 'Valor/custo do benefício'),
      gera_sorteio: fd.get('gera_sorteio') === 'on',
      meta_diaria_indicacoes: lerNumero(fd.get('meta_diaria_indicacoes')), meta_diaria_vendas: lerNumero(fd.get('meta_diaria_vendas')),
      status: opcao(fd, 'status', 'Situação', Object.keys(STATUS_CAMPANHA)),
    };
    if (d.qtd_por_beneficio < 1) falha('A quantidade por benefício precisa ser pelo menos 1.');
    await transacao(async (db) => {
      const cols = Object.keys(d);
      if (id) {
        const antes = (await db.query('SELECT * FROM referral_campaigns WHERE id=$1', [id])).rows[0];
        await db.query(`UPDATE referral_campaigns SET ${cols.map((c, i) => `${c}=$${i + 1}`).join(', ')}, updated_by=$${cols.length + 1}, updated_at=now() WHERE id=$${cols.length + 2}`, [...cols.map((c) => d[c]), u.id, id]);
        await auditar(db, { userId: u.id, acao: 'editar', entidade: 'referral_campaigns', entidadeId: id, antes, depois: d });
      } else {
        const r = (await db.query(`INSERT INTO referral_campaigns (${cols.join(', ')}, created_by) VALUES (${cols.map((_, i) => `$${i + 1}`).join(', ')}, $${cols.length + 1}) RETURNING id`, [...cols.map((c) => d[c]), u.id])).rows[0];
        await auditar(db, { userId: u.id, acao: 'criar', entidade: 'referral_campaigns', entidadeId: r.id, depois: d });
      }
    });
    revalidatePath('/indicacoes/campanhas');
    return { ok: true, mensagem: id ? 'Campanha atualizada.' : 'Campanha criada.' };
  } catch (e) { return tratar(e); }
}

// ---------- Convite + indicações recebidas ----------
export async function registrarIndicacoes(_e, fd) {
  try {
    const u = await exigirUsuario();
    if (u.vendoComo) falha(`Você está vendo como ${u.nome}. Volte para sua conta para registrar.`);
    if (!registraIndicacao(u)) falha('Seu perfil não registra indicações.');
    const campaignId = lerNumero(fd.get('campaign_id'));
    const camp = campaignId ? await q1(`SELECT * FROM referral_campaigns WHERE id=$1 AND status='ativa'`, [campaignId]) : null;
    if (!camp) falha('Escolha uma campanha ativa.');
    const nomeAluno = texto(fd, 'aluno_nome', 'Nome do aluno indicador', 150);
    const contatoAluno = String(fd.get('aluno_contato') || '');
    const resposta = opcao(fd, 'resposta', 'Resposta do aluno ao convite', Object.keys(RESPOSTAS_CONVITE));
    const produtos = (await q('SELECT id FROM products')).map((p) => p.id);
    const contatos = [];
    if (resposta === 'aceitou') {
      const qtd = inteiro(fd, 'qtd', 'Quantidade de contatos indicados');
      for (const i of [...new Set(fd.getAll('ind_idx').map(String))]) {
        const n = contatos.length + 1;
        const interesse = lerNumero(fd.get(`ind${i}_interesse`));
        contatos.push({
          nome: texto(fd, `ind${i}_nome`, `Contato ${n}: nome`, 150),
          telefone_digitado: texto(fd, `ind${i}_telefone`, `Contato ${n}: telefone`, 40),
          interesse_product_id: interesse && produtos.includes(interesse) ? interesse : null,
          aviso: opcao(fd, `ind${i}_aviso`, `Contato ${n}: aviso ao indicado`, ['avisado', 'nao_confirmado', 'autorizado']),
        });
      }
      if (contatos.length !== qtd) falha(`Você informou ${qtd} contato(s): preencha cada um.`);
    }
    const resumo = await transacao(async (db) => {
      const studentId = await aluno(db, nomeAluno, contatoAluno);
      await db.query('INSERT INTO referral_invitations (campaign_id, student_id, resposta, created_by) VALUES ($1,$2,$3,$4)', [camp.id, studentId, resposta, u.id]);
      const r = { novas: 0, duplicadas: 0, telefoneRuim: 0 };
      const vistos = new Set();
      for (const c of contatos) {
        const tel = normalizarTelefone(c.telefone_digitado);
        const existe = tel && (vistos.has(tel) || (await db.query('SELECT 1 FROM referrals WHERE telefone=$1 LIMIT 1', [tel])).rowCount > 0);
        const validacao = validacaoInicial(tel, existe);
        if (tel) vistos.add(tel);
        const ref = (await db.query(
          `INSERT INTO referrals (campaign_id, referrer_id, nome, telefone, telefone_digitado, interesse_product_id, aviso, validacao, motivo_invalidacao, created_by)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id`,
          [camp.id, studentId, c.nome, tel, c.telefone_digitado, c.interesse_product_id, c.aviso, validacao,
            validacao === 'duplicada' ? 'Telefone já indicado antes' : validacao === 'telefone_incorreto' ? 'Telefone inválido' : null, u.id]
        )).rows[0];
        await ev(db, ref.id, u.id, 'criada', null, validacao);
        if (validacao === 'duplicada') r.duplicadas++; else if (validacao === 'telefone_incorreto') r.telefoneRuim++; else r.novas++;
      }
      await auditar(db, { userId: u.id, acao: 'criar', entidade: 'referral_invitations', depois: { campanha: camp.id, aluno: studentId, resposta, contatos: contatos.length } });
      return r;
    });
    revalidatePath('/indicacoes');
    const partes = [`${resumo.novas} aguardando validação`];
    if (resumo.duplicadas) partes.push(`${resumo.duplicadas} duplicada(s)`);
    if (resumo.telefoneRuim) partes.push(`${resumo.telefoneRuim} com telefone inválido`);
    return { ok: true, mensagem: resposta === 'aceitou' ? `Convite e indicações registrados: ${partes.join(', ')}.` : 'Convite registrado.' };
  } catch (e) { return tratar(e); }
}

// ---------- Atualizar uma indicação (validação, distribuição, funil, venda) ----------
export async function atualizarIndicacao(_e, fd) {
  try {
    const u = await exigirUsuario();
    if (u.vendoComo) falha(`Você está vendo como ${u.nome}. Volte para sua conta para salvar.`);
    const id = lerNumero(fd.get('id'));
    const r = await q1('SELECT * FROM referrals WHERE id=$1', [id]);
    if (!r) falha('Indicação não encontrada.');
    const gestor = veTodaIndicacao(u) || registraIndicacao(u);
    if (!gestor && r.vendedor_id !== u.id) falha('Esta indicação não está com você.');
    await transacao(async (db) => {
      const mud = {};
      if (gestor) {
        const validacao = opcao(fd, 'validacao', 'Validação', Object.keys(VALIDACOES));
        if (validacao !== r.validacao) {
          if (validacao === 'valida') {
            if (!r.telefone) falha('Telefone inválido: corrija o cadastro antes de validar.');
            const outra = (await db.query(`SELECT 1 FROM referrals WHERE telefone=$1 AND id<>$2 AND validacao IN ('valida','pendente') LIMIT 1`, [r.telefone, r.id])).rowCount;
            if (outra) falha('Este telefone já foi indicado em outra indicação. Uma duplicada não pode ser validada (evita benefício em dobro).');
          }
          mud.validacao = validacao;
          mud.motivo_invalidacao = validacao === 'valida' || validacao === 'pendente' ? null : texto(fd, 'motivo_invalidacao', 'Motivo da invalidação', 300);
          if (validacao === 'valida') mud.validado_em = new Date();
          await ev(db, id, u.id, 'validada', r.validacao, validacao, mud.motivo_invalidacao);
        }
        const aviso = opcao(fd, 'aviso', 'Aviso ao indicado', Object.keys(AVISOS));
        if (aviso !== r.aviso) { mud.aviso = aviso; await ev(db, id, u.id, aviso === 'bloqueado' ? 'bloqueada' : 'aviso', r.aviso, aviso); }
        const vend = lerNumero(fd.get('vendedor_id')) || null;
        if (vend !== r.vendedor_id) {
          if (vend && (mud.validacao || r.validacao) !== 'valida') falha('Só indicações válidas podem ser distribuídas a um vendedor.');
          mud.vendedor_id = vend; mud.distribuido_em = vend ? new Date() : null; await ev(db, id, u.id, 'distribuida', String(r.vendedor_id || ''), String(vend || ''));
        }
      }
      const atual = { ...r, ...mud };
      const etapa = opcao(fd, 'etapa', 'Etapa', Object.keys(ETAPAS));
      const tentativa = fd.get('tentativa') === 'sim';
      if ((etapa !== r.etapa || tentativa) && !podeContatar(atual) && !['perdida', 'sem_interesse'].includes(etapa)) {
        falha(atual.aviso === 'bloqueado' ? 'Este contato pediu para não receber mensagens: não registre novas tentativas.' : 'Só indicações válidas podem ser trabalhadas.');
      }
      if (tentativa) { mud.tentativas = r.tentativas + 1; await ev(db, id, u.id, 'tentativa'); }
      if (etapa !== r.etapa) {
        if (!etapaValida(r.etapa, etapa)) falha(`Não é possível voltar de "${ETAPAS[r.etapa]}" para "${ETAPAS[etapa]}".`);
        mud.etapa = etapa;
        const mapa = { contatado: 'contato', respondeu: 'resposta', conversa: 'conversa', agendado: 'agendado', proposta: 'proposta', venda: 'venda', perdida: 'perdida', sem_interesse: 'perdida' };
        // Pulos de etapa registram as etapas intermediárias (o funil fica coerente)
        const ordem = ['nova', 'contatado', 'respondeu', 'conversa', 'agendado', 'proposta', 'venda'];
        const ini = ordem.indexOf(r.etapa), fim = ordem.indexOf(etapa);
        const passos = ini >= 0 && fim > ini ? ordem.slice(ini + 1, fim + 1) : [etapa];
        for (const pz of passos) await ev(db, id, u.id, mapa[pz] || pz, r.etapa, pz);
        if (!r.primeiro_contato_em && etapa !== 'nova') mud.primeiro_contato_em = new Date();
        if (etapa === 'venda') {
          mud.venda_valor = decimal(fd, 'venda_valor', 'Valor da venda');
          if (mud.venda_valor <= 0) falha('O valor da venda precisa ser maior que zero.');
          mud.venda_pagamento = opcao(fd, 'venda_pagamento', 'Forma de pagamento', Object.keys(PAGAMENTOS));
          mud.venda_status = opcao(fd, 'venda_status', 'Status da venda', Object.keys(STATUS_VENDA));
          mud.venda_product_id = lerNumero(fd.get('venda_product_id')) || r.interesse_product_id;
          if (!mud.venda_product_id) falha('Escolha o curso vendido.');
          mud.venda_em = new Date();
        }
      } else if (r.etapa === 'venda' && fd.get('venda_status')) {
        const st = opcao(fd, 'venda_status', 'Status da venda', Object.keys(STATUS_VENDA));
        if (st !== r.venda_status) { mud.venda_status = st; await ev(db, id, u.id, 'status_venda', r.venda_status, st); }
      }
      if (!Object.keys(mud).length) return;
      const cols = Object.keys(mud);
      await db.query(`UPDATE referrals SET ${cols.map((c, i) => `${c}=$${i + 1}`).join(', ')}, updated_by=$${cols.length + 1}, updated_at=now() WHERE id=$${cols.length + 2}`, [...cols.map((c) => mud[c]), u.id, id]);
      if (mud.validacao) await conferirBeneficios(db, r.campaign_id, r.referrer_id);
      await auditar(db, { userId: u.id, acao: 'editar', entidade: 'referrals', entidadeId: id, antes: r, depois: mud });
    });
    revalidatePath('/indicacoes');
    return { ok: true, mensagem: 'Indicação atualizada.' };
  } catch (e) { return tratar(e); }
}

// ---------- Benefícios ----------
export async function atualizarBeneficio(fd) {
  const u = await exigirUsuario();
  if (!gereBeneficios(u) || u.vendoComo) return;
  const id = Number(fd.get('id'));
  const para = String(fd.get('status'));
  if (!['pendente', 'aprovado', 'entregue', 'cancelado'].includes(para)) return;
  await transacao(async (db) => {
    const b = (await db.query('SELECT * FROM referral_benefits WHERE id=$1 FOR UPDATE', [id])).rows[0];
    if (!b || b.status === para) return;
    await db.query(`UPDATE referral_benefits SET status=$1, aprovado_por=CASE WHEN $1='aprovado' THEN $2 ELSE aprovado_por END,
                     aprovado_em=CASE WHEN $1='aprovado' THEN now() ELSE aprovado_em END, entregue_em=CASE WHEN $1='entregue' THEN now() ELSE NULL END, updated_at=now() WHERE id=$3`, [para, u.id, id]);
    await auditar(db, { userId: u.id, acao: 'editar', entidade: 'referral_benefits', entidadeId: id, antes: { status: b.status }, depois: { status: para } });
  });
  revalidatePath('/indicacoes/beneficios');
}

// ---------- Fechamento do gerente de Indicação ----------
export async function salvarGerenteIndicacao(_e, fd) {
  try {
    const u = await exigirUsuario();
    if (u.vendoComo) falha(`Você está vendo como ${u.nome}. Volte para sua conta para enviar.`);
    if (!u.lotacoes.some((l) => l.formulario === 'indicacao_gerente')) falha('Este formulário é do gerente de Indicação.');
    const dia = hoje();
    const camps = (await q('SELECT id FROM referral_campaigns')).map((c) => c.id);
    const d = lerGerenteIndicacao(fd, camps);
    const numeros = await numerosIndicacao(dia, dia);
    const limite = await configuracao('indicacao_horario_limite', '19:00');
    const dep = await q1(`SELECT id FROM departments WHERE slug='indicacoes'`);
    const editado = await transacao(async (db) => {
      const atual = (await db.query('SELECT * FROM referral_manager_closings WHERE user_id=$1 AND data_ref=$2 FOR UPDATE', [u.id, dia])).rows[0];
      const dados = { ...d, feedbacks: d.feedbacks ? JSON.stringify(d.feedbacks) : null, numeros: JSON.stringify(numeros) };
      const cols = Object.keys(dados);
      let novo;
      if (atual) novo = (await db.query(`UPDATE referral_manager_closings SET ${cols.map((c, i) => `${c}=$${i + 1}`).join(', ')}, updated_by=$${cols.length + 1}, updated_at=now() WHERE id=$${cols.length + 2} RETURNING *`, [...cols.map((c) => dados[c]), u.id, atual.id])).rows[0];
      else novo = (await db.query(`INSERT INTO referral_manager_closings (data_ref, user_id, created_by, pontualidade, ${cols.join(', ')}) VALUES ($1,$2,$2,$3, ${cols.map((_, i) => `$${i + 4}`).join(', ')}) RETURNING *`, [dia, u.id, pontualidade(new Date(), limite), ...cols.map((c) => dados[c])])).rows[0];
      await db.query(
        `INSERT INTO action_items (data_ref, origem, origem_id, gargalo, acao, responsavel_id, prazo, created_by, department_id)
         VALUES ($1,'indicacao_gerente',$2,$3,$4,$5,$6,$7,$8)
         ON CONFLICT (origem, origem_id) WHERE origem_id IS NOT NULL
         DO UPDATE SET gargalo=EXCLUDED.gargalo, acao=EXCLUDED.acao, responsavel_id=EXCLUDED.responsavel_id, prazo=EXCLUDED.prazo, updated_by=$7, updated_at=now()`,
        [dia, novo.id, `${GARGALOS_INDICACAO[d.gargalo]} (${d.prioridade})`, d.acao, d.responsavel_id, d.prazo, u.id, dep.id]
      );
      await auditar(db, { userId: u.id, acao: atual ? 'editar' : 'criar', entidade: 'referral_manager_closings', entidadeId: novo.id, antes: atual, depois: novo });
      return !!atual;
    });
    revalidatePath('/'); revalidatePath('/indicacoes/gerente');
    return { ok: true, mensagem: editado ? 'Alterações salvas.' : 'Fechamento gerencial enviado. A ação corretiva foi criada.' };
  } catch (e) { return tratar(e); }
}
