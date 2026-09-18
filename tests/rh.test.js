import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  headcountMedio, turnover, taxaDesligamento, absenteismo, taxaAtraso, retencao, custoMedio, custoContratacao,
  funilRecrutamento, consolidarRh, veRh, operaRh, configuraRh, veSalario,
} from '../lib/rh.js';

test('headcount médio e turnover', () => {
  assert.equal(headcountMedio(40, 44), 42);
  // ((3 admissões + 1 deslig)/2) / 42 = 2/42
  assert.equal(turnover(3, 1, 42), 2 / 42);
  assert.equal(turnover(0, 0, 0), null); // sem quadro não quebra
  assert.equal(taxaDesligamento(2, 40), 0.05);
});

test('absenteísmo, atraso e retenção', () => {
  assert.equal(absenteismo(16, 800), 0.02);
  assert.equal(taxaAtraso(5, 100), 0.05);
  assert.equal(retencao(9, 10), 0.9);
  assert.equal(absenteismo(10, 0), null);
});

test('custo médio e custo por contratação', () => {
  assert.equal(custoMedio(420000, 42), 10000);
  assert.equal(custoContratacao(6000, 3), 2000);
  assert.equal(custoContratacao(6000, 0), null);
});

test('funil de recrutamento', () => {
  const f = funilRecrutamento({ candidatos: 100, entrevistas: 40, aprovados: 10, propostas: 8, contratacoes: 6 });
  assert.equal(f.triagem, 0.4);
  assert.equal(f.aprovacao, 0.25);
  assert.equal(f.aceite, 0.75);
  assert.equal(f.geral, 0.06);
});

test('consolidação dos fechamentos diários soma o fluxo e calcula taxas', () => {
  const c = consolidarRh([
    { admissoes: 1, deslig_vol: 1, deslig_invol: 0, presentes: 40, faltas_just: 1, faltas_injust: 1, atrasos: 3, horas_extras: 4.5, candidatos: 10, entrevistas: 4, contratacoes: 1, treino_participantes: 8, treino_ausentes: 2 },
    { admissoes: 1, presentes: 42, faltas_injust: 1, atrasos: 2, horas_extras: 1.5, candidatos: 5, entrevistas: 2 },
  ]);
  assert.equal(c.admissoes, 2);
  assert.equal(c.desligamentos, 1);
  assert.equal(c.faltas, 3); // 1+1+1
  assert.equal(c.horas_extras, 6); // 4.5 + 1.5
  assert.equal(c.atrasos, 5);
  assert.equal(c.candidatos, 15);
  assert.equal(c.presencaTreino, 0.8); // 8 / (8+2)
  assert.equal(consolidarRh([]).admissoes, 0); // vazio não quebra
});

test('permissões do RH e visibilidade de salário', () => {
  const oper = { papel: 'colaborador', lotacoes: [{ setor: 'rh', subsetor: 'operacao' }] };
  const ger = { papel: 'gerente', lotacoes: [{ setor: 'rh', gerente: true }] };
  const dir = { papel: 'diretoria', lotacoes: [] };
  assert.equal(operaRh(oper), true);
  assert.equal(veRh(oper), false);
  assert.equal(veRh(ger), true);
  assert.equal(configuraRh(ger), true);
  assert.equal(configuraRh(oper), false);
  assert.equal(veSalario(oper), false); // RH operacional não vê salário
  assert.equal(veSalario(ger), true);
  assert.equal(veSalario(dir), true);
});
