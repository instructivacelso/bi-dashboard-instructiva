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
import { lerGerenteIndicacao, lerDiarioIndicacao } from '@/lib/leitoresIndicacao.js';
import {
  TIPOS_BENEFICIO, STATUS_CAMPANHA, RESPOSTAS_CONVITE, AVISOS, ETAPAS, ORDEM_ETAPAS, PAGAMENTOS, STATUS_VENDA, GARGALOS_INDICACAO, ORIGENS,
  ESCOLHAS_BENEFICIO, MOTIVOS_INVALIDA, MOTIVOS_PERDA,
  normalizarTelefone, validacaoInicial, marcosAtingidos, podeContatar, etapaValida, veTodaIndicacao, registraIndicacao, ehColaboradorIndicacao, gereBeneficios,
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

// ---------- Convite + indicações recebidas (cadastro individual) ----------
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
    const origem = opcao(fd, 'origem_indicacao', 'Origem da indicação', Object.keys(ORIGENS));
    // O colaborador fica responsável pelas indicações que registra; o gerente pode escolher outro
    let responsavel = u.id;
    const pedido = lerNumero(fd.get('responsavel_id'));
    if (pedido && veTodaIndicacao(u)) responsavel = pedido;
    const produtos = (await q('SELECT id FROM products')).map((p) => p.id);
    const contatos = [];
    if (resposta === 'aceitou') {
      const qtd = inteiro(fd, 'qtd', 'Quantidade de contatos indicados');
      for (const i of [...new Set(fd.getAll('ind_idx').map(String))]) {
        const n = contatos.length + 1;
        const interesse = lerNumero(fd.get(`ind${i}_interesse`));
        const email = String(fd.get(`ind${i}_email`) || '').trim().toLowerCase();
        if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) falha(`Contato ${n}: e-mail inválido.`);
        contatos.push({
          nome: texto(fd, `ind${i}_nome`, `Contato ${n}: nome`, 150),
          telefone_digitado: texto(fd, `ind${i}_telefone`, `Contato ${n}: telefone`, 40),
          email: email || null,
          cidade: String(fd.get(`ind${i}_cidade`) || '').trim().slice(0, 100) || null,
          interesse_product_id: interesse && produtos.includes(interesse) ? interesse : null,
          aviso: opcao(fd, `ind${i}_aviso`, `Contato ${n}: aviso ao indicado`, ['avisado', 'nao_confirmado', 'autorizado']),
        });
      }
      if (contatos.length !== qtd) falha(`Você informou ${qtd} contato(s): preencha cada um.`);
    }
    const resumo = await transacao(async (db) => {
      const studentId = await aluno(db, nomeAluno, contatoAluno);
      await db.query('INSERT INTO referral_invitations (campaign_id, student_id, resposta, created_by) VALUES ($1,$2,$3,$4)', [camp.id, studentId, resposta, u.id]);
      const r = { novas: 0, duplicadas: [], telefoneRuim: 0 };
      const vistos = new Set();
      for (const c of contatos) {
        const tel = normalizarTelefone(c.telefone_digitado);
        // Duplicidade: mesmo telefone ou mesmo e-mail já indicado
        let existente = null;
        if (tel && vistos.has(tel)) existente = { nome: c.nome };
        if (!existente && (tel || c.email)) {
          existente = (await db.query(`SELECT r.nome, x.nome resp FROM referrals r LEFT JOIN users x ON x.id=r.responsavel_id
                                         WHERE (r.telefone=$1 AND $1 IS NOT NULL) OR (lower(r.email)=$2 AND $2 IS NOT NULL) LIMIT 1`, [tel, c.email])).rows[0] || null;
        }
        const validacao = validacaoInicial(tel, !!existente);
        if (tel) vistos.add(tel);
        const etapa = validacao === 'pendente' ? 'recebida' : 'invalida';
        const motivo = validacao === 'duplicada' ? `Já indicado antes${existente?.resp ? ` (com ${existente.resp})` : ''}` : validacao === 'telefone_incorreto' ? 'Telefone inválido' : null;
        const ref = (await db.query(
          `INSERT INTO referrals (campaign_id, referrer_id, nome, telefone, telefone_digitado, email, cidade, interesse_product_id, aviso, validacao, motivo_invalidacao,
             etapa, origem_indicacao, responsavel_id, created_by)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) RETURNING id`,
          [camp.id, studentId, c.nome, tel, c.telefone_digitado, c.email, c.cidade, c.interesse_product_id, c.aviso, validacao, motivo, etapa, origem, responsavel, u.id]
        )).rows[0];
        await ev(db, ref.id, u.id, 'recebida', null, etapa, motivo);
        if (validacao === 'duplicada') r.duplicadas.push(c.nome); else if (validacao === 'telefone_incorreto') r.telefoneRuim++; else r.novas++;
      }
      await auditar(db, { userId: u.id, acao: 'criar', entidade: 'referral_invitations', depois: { campanha: camp.id, aluno: studentId, resposta, contatos: contatos.length } });
      return r;
    });
    revalidatePath('/indicacoes');
    const partes = [`${resumo.novas} nova(s) no pipeline`];
    if (resumo.duplicadas.length) partes.push(`${resumo.duplicadas.length} já indicada(s) antes (${resumo.duplicadas.join(', ')}) — ficaram registradas como duplicadas`);
    if (resumo.telefoneRuim) partes.push(`${resumo.telefoneRuim} com telefone inválido`);
    return { ok: true, mensagem: resposta === 'aceitou' ? `Registrado: ${partes.join('; ')}.` : 'Convite registrado.' };
  } catch (e) { return tratar(e); }
}

// ---------- Atualizar uma indicação no pipeline ----------
export async function atualizarIndicacao(_e, fd) {
  try {
    const u = await exigirUsuario();
    if (u.vendoComo) falha(`Você está vendo como ${u.nome}. Volte para sua conta para salvar.`);
    const id = lerNumero(fd.get('id'));
    const r = await q1('SELECT * FROM referrals WHERE id=$1', [id]);
    if (!r) falha('Indicação não encontrada.');
    const gestor = veTodaIndicacao(u);
    const dono = r.responsavel_id === u.id || r.created_by === u.id;
    const vendedor = r.vendedor_id === u.id;
    if (!gestor && !dono && !vendedor) falha('Esta indicação não está com você.');
    await transacao(async (db) => {
      const mud = {};
      const etapa = opcao(fd, 'etapa', 'Estágio', Object.keys(ETAPAS));
      // Vendedor só mexe da negociação em diante
      if (!gestor && !dono && vendedor && !['encaminhada', 'negociacao', 'venda', 'perdida'].includes(etapa)) falha('Como vendedor, você atualiza negociação, venda ou perda.');
      if (gestor || dono) {
        const aviso = opcao(fd, 'aviso', 'Aviso ao indicado', Object.keys(AVISOS));
        if (aviso !== r.aviso) { mud.aviso = aviso; await ev(db, id, u.id, aviso === 'bloqueado' ? 'bloqueada' : 'aviso', r.aviso, aviso); }
      }
      if (gestor) {
        const resp = lerNumero(fd.get('responsavel_id'));
        if (resp && resp !== r.responsavel_id) { mud.responsavel_id = resp; await ev(db, id, u.id, 'reatribuida', String(r.responsavel_id), String(resp)); }
      }
      if (gestor || dono) {
        const vend = lerNumero(fd.get('vendedor_id')) || null;
        if (vend !== r.vendedor_id) { mud.vendedor_id = vend; mud.distribuido_em = vend ? new Date() : null; await ev(db, id, u.id, 'distribuida', String(r.vendedor_id || ''), String(vend || '')); }
      }
      const prox = String(fd.get('proximo_contato') || '').trim();
      if (prox && !/^\d{4}-\d{2}-\d{2}$/.test(prox)) falha('Data do próximo contato inválida.');
      if ((prox || null) !== (r.proximo_contato ? String(r.proximo_contato).slice(0, 10) : null)) mud.proximo_contato = prox || null;
      const passo = String(fd.get('proximo_passo') || '').trim().slice(0, 300) || null;
      if (passo !== r.proximo_passo) mud.proximo_passo = passo;

      const atual = { ...r, ...mud };
      const contato = fd.get('contato') === 'sim';
      if ((contato || (etapa !== r.etapa && !['sem_resposta', 'sem_interesse', 'invalida', 'perdida'].includes(etapa))) && !podeContatar(atual)) {
        falha(atual.aviso === 'bloqueado' ? 'Este contato pediu para não receber mensagens: não registre novas tentativas.' : 'Esta indicação está encerrada.');
      }
      // Tentativa (1ª vez) ou follow-up (retorno em indicação já trabalhada)
      if (contato) {
        mud.tentativas = r.tentativas + 1;
        await ev(db, id, u.id, r.tentativas > 0 ? 'followup' : 'tentativa');
      }
      let novaEtapa = etapa;
      if (contato && ['recebida', 'aguardando_contato'].includes(etapa)) novaEtapa = 'tentativa';
      if (novaEtapa !== r.etapa) {
        if (!etapaValida(r.etapa, novaEtapa)) falha(`Não é possível ir de "${ETAPAS[r.etapa]}" para "${ETAPAS[novaEtapa]}".`);
        mud.etapa = novaEtapa;
        // Pulos registram as etapas intermediárias, para o funil ficar coerente
        const ini = ORDEM_ETAPAS.indexOf(r.etapa === 'sem_resposta' ? 'tentativa' : r.etapa), fim = ORDEM_ETAPAS.indexOf(novaEtapa);
        const passos = ini >= 0 && fim > ini ? ORDEM_ETAPAS.slice(ini + 1, fim + 1) : [novaEtapa];
        for (const pz of passos) if (pz !== 'tentativa' || !contato) await ev(db, id, u.id, pz, r.etapa, pz);
        if (!r.primeiro_contato_em && ORDEM_ETAPAS.indexOf(novaEtapa) >= ORDEM_ETAPAS.indexOf('contato_realizado')) mud.primeiro_contato_em = new Date();
        if (ORDEM_ETAPAS.indexOf(novaEtapa) >= ORDEM_ETAPAS.indexOf('validada') && r.validacao !== 'valida') {
          if (!r.telefone) falha('Telefone inválido: corrija o cadastro antes de validar.');
          const outra = (await db.query(`SELECT 1 FROM referrals WHERE telefone=$1 AND id<>$2 AND validacao IN ('valida','pendente') AND etapa <> 'invalida' LIMIT 1`, [r.telefone, r.id])).rowCount;
          if (outra) falha('Este telefone já está em outra indicação ativa. Uma duplicada não pode ser validada (evita benefício em dobro).');
          mud.validacao = 'valida'; mud.validado_em = new Date();
        }
        if (['encaminhada', 'negociacao', 'venda'].includes(novaEtapa)) {
          if (!(mud.vendedor_id ?? r.vendedor_id)) falha('Para encaminhar, escolha o vendedor responsável.');
          if (!(mud.proximo_passo ?? r.proximo_passo) && novaEtapa === 'encaminhada') falha('Para encaminhar, registre o próximo passo para o vendedor.');
        }
        if (novaEtapa === 'invalida') {
          mud.motivo_invalidacao = MOTIVOS_INVALIDA[opcao(fd, 'motivo_invalida', 'Motivo da invalidação', Object.keys(MOTIVOS_INVALIDA))];
          if (r.validacao === 'pendente' || r.validacao === 'valida') mud.validacao = 'invalida';
        }
        if (['perdida', 'sem_interesse'].includes(novaEtapa)) mud.motivo_perda = MOTIVOS_PERDA[opcao(fd, 'motivo_perda', 'Motivo da perda', Object.keys(MOTIVOS_PERDA))];
        if (novaEtapa === 'venda') {
          mud.venda_valor = decimal(fd, 'venda_valor', 'Valor da venda');
          if (mud.venda_valor <= 0) falha('O valor da venda precisa ser maior que zero.');
          mud.venda_pagamento = opcao(fd, 'venda_pagamento', 'Forma de pagamento', Object.keys(PAGAMENTOS));
          mud.venda_status = opcao(fd, 'venda_status', 'Status do pagamento', Object.keys(STATUS_VENDA));
          mud.venda_product_id = lerNumero(fd.get('venda_product_id')) || r.interesse_product_id;
          if (!mud.venda_product_id) falha('Escolha o curso vendido.');
          mud.venda_em = new Date();
        }
      } else if (r.etapa === 'venda' && fd.get('venda_status')) {
        const st = opcao(fd, 'venda_status', 'Status do pagamento', Object.keys(STATUS_VENDA));
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

// ---------- Benefícios: escolha do aluno e status de entrega ----------
export async function atualizarBeneficio(fd) {
  const u = await exigirUsuario();
  if (!gereBeneficios(u) || u.vendoComo) return;
  const id = Number(fd.get('id'));
  const para = String(fd.get('status'));
  const escolha = String(fd.get('escolha') || '');
  if (!['pendente', 'aprovado', 'entregue', 'cancelado'].includes(para)) return;
  if (escolha && !ESCOLHAS_BENEFICIO[escolha]) return;
  await transacao(async (db) => {
    const b = (await db.query('SELECT * FROM referral_benefits WHERE id=$1 FOR UPDATE', [id])).rows[0];
    if (!b) return;
    // Aprovar e entregar só com o gerente; o colaborador registra a escolha do aluno
    const statusFinal = veTodaIndicacao(u) || u.lotacoes.some((l) => l.setor === 'financeiro') ? para : b.status;
    const valor = escolha && ESCOLHAS_BENEFICIO[escolha].valor !== null ? ESCOLHAS_BENEFICIO[escolha].valor : b.valor;
    await db.query(`UPDATE referral_benefits SET status=$1, escolha=COALESCE(NULLIF($4,''), escolha), valor=$5, aprovado_por=CASE WHEN $1='aprovado' AND status<>'aprovado' THEN $2 ELSE aprovado_por END,
                     aprovado_em=CASE WHEN $1='aprovado' AND status<>'aprovado' THEN now() ELSE aprovado_em END,
                     entregue_em=CASE WHEN $1='entregue' THEN COALESCE(entregue_em, now()) ELSE NULL END, updated_at=now() WHERE id=$3`, [statusFinal, u.id, id, escolha, valor]);
    await auditar(db, { userId: u.id, acao: 'editar', entidade: 'referral_benefits', entidadeId: id, antes: { status: b.status, escolha: b.escolha }, depois: { status: statusFinal, escolha } });
  });
  revalidatePath('/indicacoes/beneficios');
}

// ---------- Formulário diário do colaborador de indicação ----------
export async function salvarDiarioIndicacao(_e, fd) {
  try {
    const u = await exigirUsuario();
    if (u.vendoComo) falha(`Você está vendo como ${u.nome}. Volte para sua conta para enviar.`);
    if (!ehColaboradorIndicacao(u)) falha('Este formulário é do colaborador de indicação.');
    const produtos = (await q('SELECT id FROM products')).map((p) => p.id);
    const d = lerDiarioIndicacao(fd, { hoje: hoje(), janelaDias: 7, produtos });
    const limite = await configuracao('indicacao_horario_limite', '19:00');
    const editado = await transacao(async (db) => {
      const atual = (await db.query('SELECT * FROM referral_daily_forms WHERE user_id=$1 AND data_ref=$2 FOR UPDATE', [u.id, d.data_ref])).rows[0];
      const dados = { ...d, vendas: d.vendas ? JSON.stringify(d.vendas) : null };
      delete dados.data_ref;
      const cols = Object.keys(dados);
      let novo;
      if (atual) novo = (await db.query(`UPDATE referral_daily_forms SET ${cols.map((c, i) => `${c}=$${i + 1}`).join(', ')}, updated_by=$${cols.length + 1}, updated_at=now() WHERE id=$${cols.length + 2} RETURNING *`, [...cols.map((c) => dados[c]), u.id, atual.id])).rows[0];
      else {
        // Registro de outro dia (atrasado) é marcado como atrasado
        const pont = d.data_ref !== hoje() ? 'atrasado' : pontualidade(new Date(), limite);
        novo = (await db.query(`INSERT INTO referral_daily_forms (data_ref, user_id, created_by, pontualidade, ${cols.join(', ')}) VALUES ($1,$2,$2,$3, ${cols.map((_, i) => `$${i + 4}`).join(', ')}) RETURNING *`, [d.data_ref, u.id, pont, ...cols.map((c) => dados[c])])).rows[0];
      }
      await auditar(db, { userId: u.id, acao: atual ? 'editar' : 'criar', entidade: 'referral_daily_forms', entidadeId: novo.id, antes: atual, depois: novo });
      return !!atual;
    });
    revalidatePath('/'); revalidatePath('/indicacoes/diario'); revalidatePath('/indicacoes/painel');
    return { ok: true, mensagem: editado ? 'Alterações salvas.' : 'Formulário do dia enviado. Obrigado!' };
  } catch (e) { return tratar(e); }
}

// ---------- Metas por colaborador e prazos dos alertas ----------
export async function salvarMetasIndicacao(_e, fd) {
  try {
    const u = await exigirUsuario();
    if (!veTodaIndicacao(u) || u.vendoComo) falha('Só o gerente de Indicação e o administrador definem metas.');
    await transacao(async (db) => {
      for (const id of fd.getAll('colaborador').map(Number).filter(Boolean)) {
        const m = (k) => { const n = lerNumero(fd.get(`${k}_${id}`)); if (n !== null && n < 0) falha('Metas não podem ser negativas.'); return n; };
        await db.query(`INSERT INTO referral_goals (user_id, meta_trabalhados_dia, meta_validadas_dia, meta_validadas_semana, meta_vendas_mes, meta_receita_mes, updated_by)
                        VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT (user_id) DO UPDATE SET meta_trabalhados_dia=$2, meta_validadas_dia=$3, meta_validadas_semana=$4, meta_vendas_mes=$5, meta_receita_mes=$6, updated_by=$7, updated_at=now()`,
          [id, m('trab'), m('valid_dia'), m('valid_sem'), m('vendas_mes'), m('receita_mes'), u.id]);
      }
      for (const [chave, campo, min] of [['indicacao_prazo_primeiro_contato_h', 'prazo_h', 1], ['indicacao_dias_parada', 'dias_parada', 1]]) {
        const v = lerNumero(fd.get(campo));
        if (v === null || v < min) falha('Informe os prazos dos alertas (números maiores que zero).');
        await db.query(`INSERT INTO configuracoes (chave, valor, updated_by) VALUES ($1,$2,$3) ON CONFLICT (chave) DO UPDATE SET valor=$2, updated_by=$3, updated_at=now()`, [chave, String(Math.round(v)), u.id]);
      }
      const lim = String(fd.get('horario_limite') || '');
      if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(lim)) falha('Horário-limite inválido.');
      await db.query(`INSERT INTO configuracoes (chave, valor, updated_by) VALUES ('indicacao_horario_limite',$1,$2) ON CONFLICT (chave) DO UPDATE SET valor=$1, updated_by=$2, updated_at=now()`, [lim, u.id]);
      await auditar(db, { userId: u.id, acao: 'editar', entidade: 'referral_goals' });
    });
    revalidatePath('/indicacoes/metas');
    return { ok: true, mensagem: 'Metas e prazos salvos.' };
  } catch (e) { return tratar(e); }
}

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
