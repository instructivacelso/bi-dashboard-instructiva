import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  cumprimentoPlano, entregaNoPrazo, aprovacaoSemRetrabalho, taxaRegravacao, resolucaoSuporte,
  comparecimentoLive, conversaoVenda, ticketMedio, receitaPorLive, consolidarProdutividade,
  etapaConteudoValida, veAcademico, ehProfessor, configuraAcademico,
} from '../lib/academico.js';

test('fórmulas de produtividade', () => {
  assert.equal(cumprimentoPlano(8, 10), 0.8);
  assert.equal(entregaNoPrazo(7, 8), 0.875);
  assert.equal(aprovacaoSemRetrabalho(6, 8), 0.75);
  assert.equal(taxaRegravacao(2, 10), 0.2);
  assert.equal(resolucaoSuporte(18, 20), 0.9);
  assert.equal(comparecimentoLive(120, 300), 0.4);
  assert.equal(conversaoVenda(6, 30), 0.2);
  assert.equal(ticketMedio(9000, 6), 1500);
  assert.equal(receitaPorLive(9000, 3), 3000);
  assert.equal(taxaRegravacao(2, 0), null); // divisão por zero
});

test('consolidação dos diários dos professores', () => {
  const c = consolidarProdutividade([
    { horas: 8, grav_aulas: 3, grav_minutos: 90, grav_regravadas: 1, sup_chamados: 10, sup_resolvidos: 8, live_realizadas: 1, live_inscritos: 100, live_presentes: 40, live_receita: 3000, vnd_leads: 20, vnd_qtd: 4, vnd_valor: 6000 },
    { horas: 6, grav_aulas: 2, grav_minutos: 60, criativos_produzidos: 5, criativos_aprovados: 4 },
  ]);
  assert.equal(c.horas, 14);
  assert.equal(c.grav_aulas, 5);
  assert.equal(c.taxaRegravacao, 1 / 5);
  assert.equal(c.resolucaoSuporte, 0.8);
  assert.equal(c.comparecimentoLive, 0.4);
  assert.equal(c.ticketMedio, 1500);
  assert.equal(c.aprovacaoCriativos, 0.8);
  assert.equal(consolidarProdutividade([]).horas, 0);
});

test('pipeline de conteúdo só avança (ou vai para atualização/arquivado)', () => {
  assert.equal(etapaConteudoValida('ideia', 'roteiro'), true);
  assert.equal(etapaConteudoValida('roteiro', 'ideia'), false); // não volta
  assert.equal(etapaConteudoValida('gravacao', 'gravacao'), true); // mesma etapa
  assert.equal(etapaConteudoValida('edicao', 'arquivado'), true);
  assert.equal(etapaConteudoValida('publicacao', 'atualizacao'), true);
  assert.equal(etapaConteudoValida('publicacao', 'gravacao'), false); // publicado não regride
});

test('permissões do acadêmico', () => {
  const prof = { papel: 'colaborador', lotacoes: [{ setor: 'academico', subsetor: 'professores' }] };
  const coord = { papel: 'gerente', lotacoes: [{ setor: 'academico', gerente: true }] };
  const dir = { papel: 'diretoria', lotacoes: [] };
  assert.equal(ehProfessor(prof), true);
  assert.equal(veAcademico(prof), false);
  assert.equal(veAcademico(coord), true);
  assert.equal(veAcademico(dir), true);
  assert.equal(configuraAcademico(coord), true);
  assert.equal(configuraAcademico(prof), false);
});
