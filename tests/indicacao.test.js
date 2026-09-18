import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizarTelefone, validacaoInicial, marcosAtingidos, podeContatar, etapaValida, funilIndicacao, maiorQuebra, veTodaIndicacao, registraIndicacao } from '../lib/indicacao.js';
import { lerGerenteIndicacao } from '../lib/leitoresIndicacao.js';

const fd = (o) => ({ get: (k) => (Array.isArray(o[k]) ? o[k][0] : o[k] ?? null), getAll: (k) => (o[k] === undefined ? [] : Array.isArray(o[k]) ? o[k] : [o[k]]) });

test('telefone normalizado com código do país; inválido vira null', () => {
  assert.equal(normalizarTelefone('(45) 99999-1234'), '+5545999991234');
  assert.equal(normalizarTelefone('+55 45 3333-1234'), '+554533331234');
  assert.equal(normalizarTelefone('1234'), null);
});
test('validação inicial: telefone ruim, duplicada ou pendente', () => {
  assert.equal(validacaoInicial(null, false), 'telefone_incorreto');
  assert.equal(validacaoInicial('+5545999991234', true), 'duplicada');
  assert.equal(validacaoInicial('+5545999991234', false), 'pendente');
});
test('benefício a cada N indicações válidas', () => {
  assert.equal(marcosAtingidos(4, 5), 0); assert.equal(marcosAtingidos(5, 5), 1); assert.equal(marcosAtingidos(11, 5), 2);
});
test('pipeline de 13 estágios: bloqueado não recebe contato; etapa não volta', () => {
  assert.equal(podeContatar({ aviso: 'bloqueado', etapa: 'recebida', validacao: 'pendente' }), false);
  assert.equal(podeContatar({ aviso: 'avisado', etapa: 'recebida', validacao: 'pendente' }), true);
  assert.equal(podeContatar({ aviso: 'avisado', etapa: 'recebida', validacao: 'duplicada' }), false);
  assert.equal(podeContatar({ aviso: 'avisado', etapa: 'perdida', validacao: 'valida' }), false);
  assert.equal(etapaValida('negociacao', 'contato_realizado'), false);
  assert.equal(etapaValida('tentativa', 'validada'), true);
  assert.equal(etapaValida('interesse', 'sem_interesse'), true);
  assert.equal(etapaValida('sem_resposta', 'contato_realizado'), true);
  assert.equal(etapaValida('invalida', 'validada'), false);
  assert.equal(etapaValida('venda', 'perdida'), false);
});
test('fórmulas do documento e maior quebra', () => {
  const f = funilIndicacao({ convidados: 100, aceitaram: 40, recebidas: 80, trabalhados: 50, responderam: 40, validadas: 30, encaminhadas: 6, vendas: 3, faturamento: 6000, followups: 12, custo: 500, recebido: 4000 });
  assert.equal(f.contato, 0.8); assert.equal(f.validacao, 0.75); assert.equal(f.qualificacao, 0.2); assert.equal(f.conversaoVenda, 0.5);
  assert.equal(f.conversaoGeral, 3 / 80); assert.equal(f.ticketMedio, 2000); assert.equal(f.receitaPorRecebida, 75); assert.equal(f.followupsPorVenda, 4);
  assert.equal(maiorQuebra(f), 'qualificacao');
  const z = funilIndicacao({});
  assert.equal(z.contato, null); assert.equal(z.conversaoGeral, null); // divisão por zero não quebra
});
test('permissões', () => {
  assert.equal(veTodaIndicacao({ papel: 'gerente', lotacoes: [{ setor: 'indicacoes', gerente: true }] }), true);
  assert.equal(registraIndicacao({ papel: 'colaborador', lotacoes: [{ setor: 'cscx' }] }), true);
  assert.equal(registraIndicacao({ papel: 'colaborador', lotacoes: [{ setor: 'indicacoes', subsetor: 'vendas' }] }), false);
});
test('gerente: condicionais obrigatórios', () => {
  const b = { campanhas: ['1'], produto_principal: 'Eletro', equipe_envolvida: 'Time', meta_indicacoes: '10', meta_vendas: '2', situacao_campanha: 'ativa',
    convites_conferidos: 'sim', classificacao_convites: 'dentro', motivo_invalidacao: 'nenhum', problema_qualidade: 'x', acao_qualidade: 'y',
    problema_privacidade: 'nao', acao_privacidade: 'nenhuma', ajuste_mensagem: 'nenhum', problema_atendimento: 'x', qtd_priorizar: '0', acao_recuperacao: 'y',
    vendas_corretas: 'sim', etapa_maior_quebra: 'contato', motivo_quebra: 'x', acao_conversao: 'y', feedbacks_qtd: '0', reconhecimento: 'a', acao_acompanhamento: 'b',
    redistribuicao: 'nenhuma', beneficios_atrasados: 'nao', beneficio_excepcional: 'nao', reuniao_realizada: 'sim', reuniao_tema: 't', reuniao_assuntos: 'a',
    objecao_1: 'a', objecao_2: 'b', objecao_3: 'c', gargalo: 'demora_contato', etapa_afetada: 'contato', acao: 'x', responsavel_id: '2', prazo: '2026-09-20', prioridade: 'alta' };
  assert.doesNotThrow(() => lerGerenteIndicacao(fd(b), [1]));
  assert.throws(() => lerGerenteIndicacao(fd({ ...b, campanhas: ['9'] }), [1]), /campanha/);
  assert.throws(() => lerGerenteIndicacao(fd({ ...b, beneficio_excepcional: 'sim' }), [1]), /Justificativa/);
  assert.throws(() => lerGerenteIndicacao(fd({ ...b, reuniao_realizada: 'nao' }), [1]), /Motivo/);
  assert.throws(() => lerGerenteIndicacao(fd({ ...b, classificacao_convites: 'critico' }), [1]), /Causa/);
});

// ---------- Formulário diário do colaborador ----------
import { lerDiarioIndicacao } from '../lib/leitoresIndicacao.js';
const ctxD = { hoje: '2026-09-18', janelaDias: 7, produtos: [1, 2] };
const baseD = { data_ref: '2026-09-18', origens: ['campanha', 'nps_csat'], recebidas: '5', trabalhados: '8', responderam: '4', validadas: '3', followups: '6', encaminhadas: '2', vendas_qtd: '0' };
const fdD = (o) => { const f = new FormData(); for (const [k, v] of Object.entries(o)) for (const x of [].concat(v)) f.append(k, x); return f; };

test('diário: 10 campos, zero aceito, vazio não', () => {
  const d = lerDiarioIndicacao(fdD({ ...baseD, recebidas: '0' }), ctxD);
  assert.equal(d.recebidas, 0); assert.equal(d.vendas_valor, 0); assert.equal(d.vendas, null);
  assert.throws(() => lerDiarioIndicacao(fdD({ ...baseD, followups: '' }), ctxD), /Follow-ups/);
  assert.throws(() => lerDiarioIndicacao(fdD({ ...baseD, origens: [] }), ctxD), /origem/);
  assert.throws(() => lerDiarioIndicacao(fdD({ ...baseD, origens: ['outra'] }), ctxD), /outra origem/);
});
test('diário: data em outro dia exige justificativa; futuro e muito antigo bloqueados', () => {
  assert.throws(() => lerDiarioIndicacao(fdD({ ...baseD, data_ref: '2026-09-16' }), ctxD), /Justificativa do registro/);
  assert.equal(lerDiarioIndicacao(fdD({ ...baseD, data_ref: '2026-09-16', justificativa_data: 'Esqueci ontem' }), ctxD).data_ref, '2026-09-16');
  assert.throws(() => lerDiarioIndicacao(fdD({ ...baseD, data_ref: '2026-09-19' }), ctxD), /futuro/);
  assert.throws(() => lerDiarioIndicacao(fdD({ ...baseD, data_ref: '2026-09-01', justificativa_data: 'x' }), ctxD), /7 dias/);
});
test('diário: números incoerentes exigem justificativa', () => {
  assert.throws(() => lerDiarioIndicacao(fdD({ ...baseD, responderam: '10' }), ctxD), /Justificativa/);
  assert.throws(() => lerDiarioIndicacao(fdD({ ...baseD, encaminhadas: '5' }), ctxD), /encaminhadas/);
  assert.equal(lerDiarioIndicacao(fdD({ ...baseD, responderam: '10', validadas: '3', justificativa_numeros: 'Respostas de ontem' }), ctxD).responderam, 10);
});
test('diário: vendas exigem cada linha; cancelada não soma receita', () => {
  assert.throws(() => lerDiarioIndicacao(fdD({ ...baseD, vendas_qtd: '1' }), ctxD), /preencha cada uma/);
  const v = (i, valor, status) => ({ [`vd${i}_indicador`]: 'Aluno', [`vd${i}_indicado`]: 'Cliente', [`vd${i}_vendedor`]: 'Ana', [`vd${i}_produto`]: '1', [`vd${i}_valor`]: valor, [`vd${i}_pagamento`]: 'pix', [`vd${i}_status`]: status });
  const d = lerDiarioIndicacao(fdD({ ...baseD, vendas_qtd: '2', vd_idx: ['0', '1'], ...v(0, '1.500,00', 'pago'), ...v(1, '900', 'cancelada') }), ctxD);
  assert.equal(d.vendas.length, 2); assert.equal(d.vendas_valor, 1500);
  assert.throws(() => lerDiarioIndicacao(fdD({ ...baseD, vendas_qtd: '1', vd_idx: ['0'], ...v(0, '100', 'pago'), vd0_produto: '9' }), ctxD), /curso/);
});
test('diário: pedido de ajuda exige descrição', () => {
  assert.throws(() => lerDiarioIndicacao(fdD({ ...baseD, precisa_ajuda: 'sim' }), ctxD), /ajuda/);
  assert.equal(lerDiarioIndicacao(fdD({ ...baseD, precisa_ajuda: 'sim', ajuda_descricao: 'Muitos sem resposta' }), ctxD).precisa_ajuda, true);
});
