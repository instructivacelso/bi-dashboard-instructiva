'use server';
import { revalidatePath } from 'next/cache';
import { exigirUsuario } from '@/lib/auth.js';
import { transacao, q1 } from '@/lib/db.js';
import { auditar } from '@/lib/auditoria.js';
import { hoje } from '@/lib/datas.js';
import { lerNumero } from '@/lib/formato.js';
import { FORMULARIOS, formularioAplicavel, lancamentoAberto, ETAPAS_AUTOMACAO_ROTULOS } from '@/lib/formularios.js';
import { formulariosDo, podeEditar, ehSuperadmin } from '@/lib/perm.js';
import { lancamentosDoUsuario } from '@/lib/dados.js';

class ErroValidacao extends Error {}
const falha = (m) => { throw new ErroValidacao(m); };

const texto = (fd, nome, rotulo, obrig = false, max = 500) => {
  const v = String(fd.get(nome) ?? '').trim();
  if (obrig && !v) falha(`Preencha: ${rotulo}.`);
  if (v.length > max) falha(`${rotulo}: use no máximo ${max} caracteres.`);
  return v || null;
};
const inteiro = (fd, nome, rotulo, obrig = true) => {
  const n = lerNumero(fd.get(nome));
  if (n === null) { if (obrig) falha(`Preencha: ${rotulo}.`); return null; }
  if (!Number.isInteger(n) || n < 0) falha(`${rotulo} precisa ser um número inteiro, zero ou maior.`);
  return n;
};
const valor = (fd, nome, rotulo, obrig = true) => {
  const n = lerNumero(fd.get(nome));
  if (n === null) { if (obrig) falha(`Preencha: ${rotulo}.`); return null; }
  if (n < 0) falha(`${rotulo} não pode ser negativo.`);
  return Math.round(n * 100) / 100;
};
const simNao = (fd, nome, rotulo) => {
  const v = fd.get(nome);
  if (v !== 'sim' && v !== 'nao') falha(`Responda: ${rotulo}.`);
  return v === 'sim';
};
const opcao = (fd, nome, rotulo, opcoes) => {
  const v = String(fd.get(nome) || '');
  if (!opcoes.includes(v)) falha(`Escolha: ${rotulo}.`);
  return v;
};
const data = (fd, nome, rotulo) => {
  const v = String(fd.get(nome) || '').trim();
  if (!v) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) falha(`${rotulo}: data inválida.`);
  return v;
};

// Lê e valida os campos de cada formulário. Devolve as colunas a gravar.
const LEITORES = {
  trafego(fd) {
    const r = {
      valor_gasto: valor(fd, 'valor_gasto', 'Valor gasto no dia'),
      visitas: inteiro(fd, 'visitas', 'Visitas na página'),
      cadastros: inteiro(fd, 'cadastros', 'Cadastros no dia'),
      houve_problema: simNao(fd, 'houve_problema', 'Houve algum problema?'),
    };
    r.problema_descricao = r.houve_problema ? texto(fd, 'problema_descricao', 'Descrição do problema', true, 300) : null;
    r.problema_acao = r.houve_problema ? texto(fd, 'problema_acao', 'Ação que está sendo realizada', true, 300) : null;
    return r;
  },
  whatsapp(fd) {
    const r = {
      convites_api: inteiro(fd, 'convites_api', 'Convites enviados via API'),
      entradas_api: inteiro(fd, 'entradas_api', 'Entradas por API'),
      entradas_organico: inteiro(fd, 'entradas_organico', 'Entradas pelo orgânico'),
      total_grupos: inteiro(fd, 'total_grupos', 'Total atual nos grupos'),
      custo_disparos: valor(fd, 'custo_disparos', 'Valor gasto com disparos', false),
      houve_problema: fd.get('houve_problema') === 'sim',
    };
    r.problema_descricao = r.houve_problema ? texto(fd, 'problema_descricao', 'Descrição do problema', true, 300) : null;
    return r;
  },
  automacao(fd) {
    const r = {
      captacao_ok: simNao(fd, 'captacao_ok', 'Página, formulário e entrada no WhatsApp estão funcionando?'),
      checkout_ok: simNao(fd, 'checkout_ok', 'Checkout e confirmação de compra estão funcionando?'),
      onboarding_ok: simNao(fd, 'onboarding_ok', 'Onboarding dos compradores está funcionando?'),
      houve_problema: simNao(fd, 'houve_problema', 'Existe algum problema?'),
    };
    const precisaIncidente = !r.captacao_ok || !r.checkout_ok || !r.onboarding_ok || r.houve_problema;
    let incidente = null;
    if (precisaIncidente) {
      incidente = {
        etapa: opcao(fd, 'etapa', 'Etapa afetada', ETAPAS_AUTOMACAO),
        afetados: inteiro(fd, 'afetados', 'Pessoas ou alunos afetados', false),
        descricao: texto(fd, 'incidente_descricao', 'Descrição do problema', true, 400),
        prioridade: opcao(fd, 'prioridade', 'Prioridade', ['baixa', 'media', 'alta', 'critica']),
        previsao_solucao: data(fd, 'previsao_solucao', 'Previsão de solução'),
      };
    }
    return { ...r, __incidente: incidente };
  },
  editor(fd) {
    const r = {
      tipo_entrega: opcao(fd, 'tipo_entrega', 'Tipo de entrega', ['criativo', 'aula', 'vsl', 'reels', 'corte', 'outro']),
      quantidade: inteiro(fd, 'quantidade', 'Quantidade concluída no dia'),
      situacao: opcao(fd, 'situacao', 'Status', ['concluido', 'em_producao', 'atrasado']),
      entrega: texto(fd, 'entrega', 'Link da entrega ou descrição curta', true, 400),
    };
    r.motivo_atraso = r.situacao === 'atrasado' ? texto(fd, 'motivo_atraso', 'Motivo do atraso', true, 300) : null;
    return r;
  },
  live(fd) {
    const r = {
      participantes_unicos: inteiro(fd, 'participantes_unicos', 'Pessoas únicas que participaram'),
      lista_reserva: inteiro(fd, 'lista_reserva', 'Pessoas na lista de reserva'),
      problema_tecnico: simNao(fd, 'problema_tecnico', 'Houve problema técnico?'),
    };
    r.observacao = r.problema_tecnico ? texto(fd, 'observacao', 'Observação sobre o problema', true, 300) : null;
    return r;
  },
  gerente(fd) {
    const r = { situacao: opcao(fd, 'situacao', 'Situação do dia', ['verde', 'amarelo', 'vermelho']) };
    const alerta = r.situacao !== 'verde';
    r.gargalo = alerta ? texto(fd, 'gargalo', 'Principal gargalo', true, 300) : null;
    r.acao = alerta ? texto(fd, 'acao', 'Ação que será tomada', true, 300) : null;
    const resp = lerNumero(fd.get('responsavel_id'));
    if (alerta && !resp) falha('Escolha o responsável pela ação.');
    r.responsavel_id = alerta ? resp : null;
    r.prazo = alerta ? data(fd, 'prazo', 'Prazo da ação') : null;
    return r;
  },
};

const ETAPAS_AUTOMACAO = Object.keys(ETAPAS_AUTOMACAO_ROTULOS);

// Ações corretivas geradas automaticamente a partir dos formulários
function acaoGerada(form, r, userId) {
  if (form === 'gerente' && r.situacao !== 'verde') return { gargalo: r.gargalo, acao: r.acao, responsavel_id: r.responsavel_id, prazo: r.prazo };
  if (form === 'trafego' && r.houve_problema) return { gargalo: r.problema_descricao, acao: r.problema_acao, responsavel_id: userId, prazo: null };
  if (form === 'whatsapp' && r.houve_problema) return { gargalo: r.problema_descricao, acao: 'Resolver problema informado no WhatsApp', responsavel_id: userId, prazo: null };
  if (form === 'editor' && r.situacao === 'atrasado') return { gargalo: `Entrega atrasada: ${r.motivo_atraso}`, acao: `Concluir ${r.tipo_entrega}: ${r.entrega}`.slice(0, 300), responsavel_id: userId, prazo: null };
  return null;
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

    const dados = LEITORES[form](fd);
    const incidente = dados.__incidente;
    delete dados.__incidente;

    const resultado = await transacao(async (db) => {
      let atual = null;
      if (registroId) {
        atual = (await db.query(`SELECT * FROM ${cfg.tabela} WHERE id=$1 FOR UPDATE`, [registroId])).rows[0];
        if (!atual) falha('Registro não encontrado.');
      } else {
        // Um fechamento por usuário, lançamento e dia (live: um por lançamento e dia)
        const chave = cfg.porUsuario ? 'AND created_by=$3' : '';
        atual = (await db.query(
          `SELECT * FROM ${cfg.tabela} WHERE launch_id=$1 AND data_ref=$2 ${chave} FOR UPDATE`,
          cfg.porUsuario ? [launchId, dia, u.id] : [launchId, dia]
        )).rows[0] || null;
      }

      const lanc = (await db.query('SELECT * FROM launches WHERE id=$1', [atual ? atual.launch_id : launchId])).rows[0];
      if (!lanc) falha('Lançamento não encontrado.');

      if (atual) {
        const perm = podeEditar(u, atual, dia);
        if (!perm.pode) falha(atual.created_by === u.id ? 'O prazo de edição deste registro terminou. Peça a correção ao gerente.' : 'Você não pode alterar o registro de outra pessoa.');
        let motivo = null;
        if (perm.correcao) motivo = texto(fd, 'motivo', 'Motivo da correção', true, 300);
        else if (!lancamentoAberto(lanc)) falha('Este lançamento está encerrado e disponível só para consulta.');
        const cols = Object.keys(dados);
        const sets = cols.map((c, i) => `${c}=$${i + 1}`).join(', ');
        const novo = (await db.query(
          `UPDATE ${cfg.tabela} SET ${sets}, updated_by=$${cols.length + 1}, updated_at=now() WHERE id=$${cols.length + 2} RETURNING *`,
          [...cols.map((c) => dados[c]), u.id, atual.id]
        )).rows[0];
        await auditar(db, { userId: u.id, acao: perm.correcao ? 'corrigir' : 'editar', entidade: cfg.tabela, entidadeId: atual.id, antes: atual, depois: { ...novo, motivo } });
        return { registro: novo, lanc, editado: true };
      }

      // Registro novo: precisa ter o formulário, o lançamento atribuído e aplicável hoje
      if (!ehSuperadmin(u) && !formulariosDo(u).includes(form)) falha('Este formulário não está atribuído a você.');
      const meus = await lancamentosDoUsuario(u);
      if (!meus.some((l) => l.id === lanc.id)) falha('Você não tem acesso a este lançamento.');
      if (!formularioAplicavel(form, lanc, dia)) falha('Este formulário não se aplica a este lançamento hoje.');
      const cols = Object.keys(dados);
      const novo = (await db.query(
        `INSERT INTO ${cfg.tabela} (data_ref, launch_id, created_by, ${cols.join(', ')})
         VALUES ($1, $2, $3, ${cols.map((_, i) => `$${i + 4}`).join(', ')}) RETURNING *`,
        [dia, lanc.id, u.id, ...cols.map((c) => dados[c])]
      )).rows[0];
      await auditar(db, { userId: u.id, acao: 'criar', entidade: cfg.tabela, entidadeId: novo.id, depois: novo });
      return { registro: novo, lanc, editado: false };
    });

    // Efeitos: incidente da automação e ações corretivas
    const reg = resultado.registro;
    await transacao(async (db) => {
      if (form === 'automacao') {
        const existente = (await db.query(`SELECT * FROM automation_incidents WHERE entry_id=$1 AND status='aberto' LIMIT 1`, [reg.id])).rows[0];
        if (incidente && existente) {
          await db.query(
            `UPDATE automation_incidents SET etapa=$1, afetados=$2, descricao=$3, prioridade=$4, previsao_solucao=$5, updated_by=$6, updated_at=now() WHERE id=$7`,
            [incidente.etapa, incidente.afetados, incidente.descricao, incidente.prioridade, incidente.previsao_solucao, u.id, existente.id]
          );
          await auditar(db, { userId: u.id, acao: 'editar', entidade: 'automation_incidents', entidadeId: existente.id, antes: existente, depois: incidente });
        } else if (incidente) {
          const inc = (await db.query(
            `INSERT INTO automation_incidents (entry_id, data_ref, launch_id, etapa, afetados, descricao, prioridade, previsao_solucao, created_by)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id`,
            [reg.id, reg.data_ref, reg.launch_id, incidente.etapa, incidente.afetados, incidente.descricao, incidente.prioridade, incidente.previsao_solucao, u.id]
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
           DO UPDATE SET gargalo=EXCLUDED.gargalo, acao=EXCLUDED.acao, responsavel_id=EXCLUDED.responsavel_id, prazo=EXCLUDED.prazo, updated_by=$9, updated_at=now()`,
          [reg.data_ref, reg.launch_id, form, reg.id, acao.gargalo, acao.acao, acao.responsavel_id, acao.prazo, u.id]
        );
      } else {
        await db.query(`UPDATE action_items SET status='cancelada', updated_by=$1, updated_at=now() WHERE origem=$2 AND origem_id=$3 AND status IN ('aberta','em_andamento')`, [u.id, form, reg.id]);
      }
    });

    revalidatePath('/');
    revalidatePath('/marketing/dashboard');
    return {
      ok: true,
      mensagem: resultado.editado ? 'Alterações salvas.' : 'Formulário enviado. Obrigado! Você pode editar até o fim do dia.',
    };
  } catch (e) {
    if (e instanceof ErroValidacao) return { erro: e.message };
    if (e?.digest?.startsWith?.('NEXT_REDIRECT')) throw e;
    console.error('[formulario]', e);
    return { erro: 'Não foi possível salvar agora. Tente de novo em instantes.' };
  }
}
