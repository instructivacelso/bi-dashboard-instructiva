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

import { notaQualidade, resumoQualidade, resultadoMarketing, pontuacao } from '../lib/academico.js';

test('nota de qualidade é a média dos critérios', () => {
  assert.equal(notaQualidade({ precisao: 9, didatica: 8, audio_video: 7 }), 8);
  assert.equal(notaQualidade({}), null);
});

test('qualidade separa aprovação de primeira e retrabalho', () => {
  const r = resumoQualidade([
    { content_id: 1, status: 'aprovado', nota: 9, no_prazo: true },
    { content_id: 2, status: 'reprovado', nota: 5, no_prazo: false },
    { content_id: 2, status: 'aprovado', nota: 8, no_prazo: true },   // 2ª avaliação do mesmo conteúdo
    { content_id: 3, status: 'aprovado_ajuste', nota: 7, no_prazo: true },
  ]);
  assert.equal(r.conteudos, 3);
  assert.equal(r.aprovadosPrimeira, 1);            // só o conteúdo 1 passou de primeira
  assert.equal(r.aprovacaoSemRetrabalho, 1 / 3);
  assert.equal(r.reprovacoes, 1);
  assert.equal(r.retrabalho, 2 / 4);               // 1 reprovação + 1 ajuste em 4 avaliações
  assert.equal(r.noPrazo, 3 / 4);
  assert.equal(r.notaMedia, 7.25);
});

test('resultado de marketing: CPL e ROAS (sem digitar)', () => {
  const m = resultadoMarketing({ investimento: 2000, leads: 100, receita: 10000 });
  assert.equal(m.cpl, 20);
  assert.equal(m.roas, 5);
  assert.equal(resultadoMarketing({ investimento: 0, leads: 0 }).cpl, null);
});

test('pontuação só conta entrega válida, desconta reprovação e ajusta pela qualidade', () => {
  const pesos = { aula_publicada: 10, aula_gravada: 4, venda: 5 };
  // 3 gravadas, 1 regravada => 2 válidas; 2 publicadas; 1 venda
  const p = pontuacao({ grav_aulas: 3, grav_regravadas: 1, grav_publicadas: 2, vnd_qtd: 1 }, pesos, { reprovacoes: 1, notaMedia: 8 });
  assert.equal(p.bruto, 2 * 10 + 2 * 4 + 1 * 5);    // 33
  assert.equal(p.desconto, 10);                     // 1 reprovação × peso de aula publicada
  assert.equal(p.fator, 0.8);
  assert.equal(p.total, Math.round((33 - 10) * 0.8 * 100) / 100); // 18.4
  assert.equal(pontuacao({}, pesos, {}).total, 0);
  assert.equal(pontuacao({ grav_publicadas: 1 }, pesos, { notaMedia: 2 }).fator, 0.5); // piso do fator
});
