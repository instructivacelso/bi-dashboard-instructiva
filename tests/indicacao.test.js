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
test('bloqueado não recebe contato; etapa não volta', () => {
  assert.equal(podeContatar({ aviso: 'bloqueado', etapa: 'nova', validacao: 'valida' }), false);
  assert.equal(podeContatar({ aviso: 'avisado', etapa: 'nova', validacao: 'pendente' }), false);
  assert.equal(podeContatar({ aviso: 'avisado', etapa: 'nova', validacao: 'valida' }), true);
  assert.equal(etapaValida('proposta', 'contatado'), false);
  assert.equal(etapaValida('contatado', 'agendado'), true);
  assert.equal(etapaValida('venda', 'perdida'), false);
});
test('fórmulas do funil e maior quebra', () => {
  const f = funilIndicacao({ convidados: 100, aceitaram: 40, recebidas: 80, validas: 60, contatadas: 50, responderam: 10, conversas: 8, agendamentos: 5, propostas: 4, vendas: 2, faturamento: 4000, custo: 500, recebido: 3000 });
  assert.equal(f.adesao, 0.4); assert.equal(f.validacao, 0.75); assert.equal(f.resposta, 0.2); assert.equal(f.vendaSobreProposta, 0.5);
  assert.equal(f.custoPorVenda, 250); assert.equal(f.receitaLiquida, 2500); assert.equal(f.retorno, 8);
  assert.equal(maiorQuebra(f), 'resposta');
  assert.equal(funilIndicacao({}).adesao, null);
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
    vendas_corretas: 'sim', etapa_maior_quebra: 'resposta', motivo_quebra: 'x', acao_conversao: 'y', feedbacks_qtd: '0', reconhecimento: 'a', acao_acompanhamento: 'b',
    redistribuicao: 'nenhuma', beneficios_atrasados: 'nao', beneficio_excepcional: 'nao', reuniao_realizada: 'sim', reuniao_tema: 't', reuniao_assuntos: 'a',
    objecao_1: 'a', objecao_2: 'b', objecao_3: 'c', gargalo: 'demora_contato', etapa_afetada: 'contato', acao: 'x', responsavel_id: '2', prazo: '2026-09-20', prioridade: 'alta' };
  assert.doesNotThrow(() => lerGerenteIndicacao(fd(b), [1]));
  assert.throws(() => lerGerenteIndicacao(fd({ ...b, campanhas: ['9'] }), [1]), /campanha/);
  assert.throws(() => lerGerenteIndicacao(fd({ ...b, beneficio_excepcional: 'sim' }), [1]), /Justificativa/);
  assert.throws(() => lerGerenteIndicacao(fd({ ...b, reuniao_realizada: 'nao' }), [1]), /Motivo/);
  assert.throws(() => lerGerenteIndicacao(fd({ ...b, classificacao_convites: 'critico' }), [1]), /Causa/);
});
