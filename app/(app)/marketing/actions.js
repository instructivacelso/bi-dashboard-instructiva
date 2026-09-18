'use server';
import { revalidatePath } from 'next/cache';
import { exigirUsuario } from '@/lib/auth.js';
import { transacao } from '@/lib/db.js';
import { auditar } from '@/lib/auditoria.js';
import { hoje } from '@/lib/datas.js';
import { lerNumero } from '@/lib/formato.js';
import { FORMULARIOS, formularioAplicavel, lancamentoAberto, GARGALOS } from '@/lib/formularios.js';
import { LEITORES, ErroValidacao } from '@/lib/leitores.js';
import { formulariosDo, podeEditar, ehSuperadmin } from '@/lib/perm.js';
import { lancamentosDoUsuario, plataformasDo } from '@/lib/dados.js';

const falha = (m) => { throw new ErroValidacao(m); };

// Ações corretivas geradas pelos formulários
function acaoGerada(form, r, userId) {
  if (form === 'gerente') {
    if (r.gargalo === 'nenhum') return null;
    return { gargalo: GARGALOS[r.gargalo] || r.gargalo, acao: r.acao, responsavel_id: r.responsavel_id, prazo: r.prazo };
  }
  if (form === 'trafego' && r.houve_problema) return { gargalo: `Tráfego (${r.plataforma}): ${r.problema_descricao}`, acao: r.problema_acao, responsavel_id: userId, prazo: null };
  if (form === 'whatsapp' && r.houve_problema) return { gargalo: `WhatsApp: ${r.problema_descricao}`, acao: r.problema_acao, responsavel_id: userId, prazo: null };
  if (form === 'editor' && r.situacao === 'atrasado') return { gargalo: `Entrega atrasada: ${r.motivo_atraso}`, acao: `Concluir ${r.titulo}`.slice(0, 300), responsavel_id: userId, prazo: r.prazo };
  return null;
}

async function atualizar(db, tabela, id, dados, userId) {
  const cols = Object.keys(dados);
  return (await db.query(
    `UPDATE ${tabela} SET ${cols.map((c, i) => `${c}=$${i + 1}`).join(', ')}, updated_by=$${cols.length + 1}, updated_at=now() WHERE id=$${cols.length + 2} RETURNING *`,
    [...cols.map((c) => dados[c]), userId, id]
  )).rows[0];
}

async function inserir(db, tabela, base, dados) {
  const tudo = { ...base, ...dados };
  const cols = Object.keys(tudo);
  return (await db.query(
    `INSERT INTO ${tabela} (${cols.join(', ')}) VALUES (${cols.map((_, i) => `$${i + 1}`).join(', ')}) RETURNING *`,
    cols.map((c) => tudo[c])
  )).rows[0];
}

export async function salvarFormulario(_estado, fd) {
  try {
    const u = await exigirUsuario();
    const form = String(fd.get('form') || '');
    const cfg = FORMULARIOS[form];
    if (!cfg) falha('Formulário desconhecido.');
    const dia = hoje();
    const registroId = lerNumero(fd.get('registro_id'));
    const launchId = lerNumero(fd.get('launch_id'));
    if (!launchId) falha('Escolha o lançamento.');

    // 1. Validação: nada vazio, condicionais obrigatórios quando aparecem
    let linhas;
    let incidente = null;
    if (form === 'trafego') linhas = LEITORES.trafego(fd);
    else if (form === 'automacao') { const r = LEITORES.automacao(fd); linhas = [r.dados]; incidente = r.incidente; }
    else if (form === 'gerente') linhas = [LEITORES.gerente(fd, { userId: u.id, hoje: dia })];
    else linhas = [LEITORES[form](fd)];

    // 2. Gravação
    const salvos = await transacao(async (db) => {
      const out = [];
      if (registroId) {
        const atual = (await db.query(`SELECT * FROM ${cfg.tabela} WHERE id=$1 FOR UPDATE`, [registroId])).rows[0];
        if (!atual) falha('Registro não encontrado.');
        const perm = podeEditar(u, atual, dia);
        if (!perm.pode) falha(atual.created_by === u.id ? 'O prazo de edição deste registro terminou. Peça a correção ao gerente.' : 'Você não pode alterar o registro de outra pessoa.');
        const lanc = (await db.query('SELECT * FROM launches WHERE id=$1', [atual.launch_id])).rows[0];
        if (!perm.correcao && !lancamentoAberto(lanc)) falha('Este lançamento está encerrado e disponível só para consulta.');
        const motivo = perm.correcao ? String(fd.get('motivo') || '').trim() || falha('Informe o motivo da correção.') : null;
        const dados = linhas[0];
        if (form === 'trafego' && dados.plataforma !== atual.plataforma) falha('A plataforma do registro não pode ser trocada.');
        const novo = await atualizar(db, cfg.tabela, atual.id, dados, u.id);
        await auditar(db, { userId: u.id, acao: perm.correcao ? 'corrigir' : 'editar', entidade: cfg.tabela, entidadeId: atual.id, antes: atual, depois: { ...novo, motivo } });
        out.push({ registro: novo, editado: true });
        return out;
      }

      const lanc = (await db.query('SELECT * FROM launches WHERE id=$1', [launchId])).rows[0];
      if (!lanc) falha('Lançamento não encontrado.');
      if (!ehSuperadmin(u) && !formulariosDo(u).includes(form)) falha('Este formulário não está atribuído a você.');
      const meus = await lancamentosDoUsuario(u);
      if (!meus.some((l) => l.id === lanc.id)) falha('Você não tem acesso a este lançamento.');
      if (!formularioAplicavel(form, lanc, dia)) falha('Este formulário não se aplica a este lançamento hoje.');
      if (form === 'trafego') {
        const minhas = await plataformasDo(u.id, lanc.id);
        for (const l of linhas) if (!minhas.includes(l.plataforma)) falha(`A plataforma ${l.plataforma} não está atribuída a você neste lançamento.`);
      }

      for (const dados of linhas) {
        // Chave de unicidade: dia + lançamento (+ pessoa) (+ plataforma no Tráfego)
        const cond = ['launch_id=$1', 'data_ref=$2'];
        const params = [lanc.id, dia];
        if (cfg.porUsuario) { params.push(u.id); cond.push(`created_by=$${params.length}`); }
        if (form === 'trafego') { params.push(dados.plataforma); cond.push(`plataforma=$${params.length}`); }
        const atual = (await db.query(`SELECT * FROM ${cfg.tabela} WHERE ${cond.join(' AND ')} FOR UPDATE`, params)).rows[0];
        if (atual) {
          const perm = podeEditar(u, atual, dia);
          if (!perm.pode) falha('O resultado deste dia já foi enviado por outra pessoa. Para corrigir, fale com o gerente.');
          const novo = await atualizar(db, cfg.tabela, atual.id, dados, u.id);
          await auditar(db, { userId: u.id, acao: 'editar', entidade: cfg.tabela, entidadeId: atual.id, antes: atual, depois: novo });
          out.push({ registro: novo, editado: true });
        } else {
          const novo = await inserir(db, cfg.tabela, { data_ref: dia, launch_id: lanc.id, created_by: u.id, origem: 'manual' }, dados);
          await auditar(db, { userId: u.id, acao: 'criar', entidade: cfg.tabela, entidadeId: novo.id, depois: novo });
          out.push({ registro: novo, editado: false });
        }
      }
      return out;
    });

    // 3. Efeitos: incidente da automação e ações corretivas
    await transacao(async (db) => {
      for (const { registro: reg } of salvos) {
        if (form === 'automacao') {
          const existente = (await db.query(`SELECT * FROM automation_incidents WHERE entry_id=$1 AND status <> 'resolvido' LIMIT 1`, [reg.id])).rows[0];
          if (incidente && existente) {
            await db.query(
              `UPDATE automation_incidents SET etapa=$1, afetados=$2, descricao=$3, prioridade=$4, previsao_solucao=$5, updated_by=$6, updated_at=now() WHERE id=$7`,
              [incidente.etapa, incidente.afetados, incidente.descricao, incidente.prioridade, incidente.previsao_solucao, u.id, existente.id]
            );
            await auditar(db, { userId: u.id, acao: 'editar', entidade: 'automation_incidents', entidadeId: existente.id, antes: existente, depois: incidente });
          } else if (incidente) {
            const inc = (await db.query(
              `INSERT INTO automation_incidents (entry_id, data_ref, launch_id, etapa, afetados, descricao, prioridade, previsao_solucao, responsavel_id, created_by)
               VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$9) RETURNING id`,
              [reg.id, reg.data_ref, reg.launch_id, incidente.etapa, incidente.afetados, incidente.descricao, incidente.prioridade, incidente.previsao_solucao, reg.created_by]
            )).rows[0];
            await auditar(db, { userId: u.id, acao: 'criar', entidade: 'automation_incidents', entidadeId: inc.id, depois: incidente });
          } else if (existente) {
            await db.query(`UPDATE automation_incidents SET status='resolvido', resolvido_em=now(), updated_by=$1, updated_at=now() WHERE id=$2`, [u.id, existente.id]);
            await auditar(db, { userId: u.id, acao: 'resolver', entidade: 'automation_incidents', entidadeId: existente.id });
          }
        }
        const acao = acaoGerada(form, reg, reg.created_by);
        if (acao) {
          await db.query(
            `INSERT INTO action_items (data_ref, launch_id, origem, origem_id, gargalo, acao, responsavel_id, prazo, created_by)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
             ON CONFLICT (origem, origem_id) WHERE origem_id IS NOT NULL
             DO UPDATE SET gargalo=EXCLUDED.gargalo, acao=EXCLUDED.acao, responsavel_id=EXCLUDED.responsavel_id, prazo=EXCLUDED.prazo,
                           status=CASE WHEN action_items.status IN ('concluida','cancelada') THEN 'aberta' ELSE action_items.status END, updated_by=$9, updated_at=now()`,
            [reg.data_ref, reg.launch_id, form, reg.id, acao.gargalo, acao.acao, acao.responsavel_id, acao.prazo, u.id]
          );
        } else {
          await db.query(`UPDATE action_items SET status='cancelada', updated_by=$1, updated_at=now() WHERE origem=$2 AND origem_id=$3 AND status IN ('aberta','em_andamento')`, [u.id, form, reg.id]);
        }
      }
    });

    revalidatePath('/');
    revalidatePath('/marketing/dashboard');
    const editado = salvos.every((x) => x.editado);
    return { ok: true, mensagem: editado ? 'Alterações salvas.' : 'Formulário enviado. Obrigado! Você pode ajustar até o fim do dia.' };
  } catch (e) {
    if (e instanceof ErroValidacao) return { erro: e.message };
    if (e?.digest?.startsWith?.('NEXT_REDIRECT')) throw e;
    if (e?.code === '23505') return { erro: 'Este registro já foi enviado hoje. Recarregue a página para editar.' };
    console.error('[formulario]', e);
    return { erro: 'Não foi possível salvar agora. Tente de novo em instantes.' };
  }
}
