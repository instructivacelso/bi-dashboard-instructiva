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

import { custoFolha, provisaoMensal, folhaPercentReceita, enps, climaExibivel } from '../lib/rh.js';

test('custo de folha soma remuneração + encargos + provisões − descontos', () => {
  assert.equal(custoFolha({ salario_base: 3000, variavel: 500, beneficios: 400, encargos: 900, provisoes: 320, descontos: 200 }), 3000 + 500 + 400 + 900 + 320 - 200);
  assert.equal(custoFolha({}), 0);
});

test('provisão mensal de férias (com 1/3) e 13º', () => {
  // 3000: (3000/12*(4/3)) + 3000/12 = 333.33 + 250 = 583.33
  assert.equal(provisaoMensal(3000, 0), 583.33);
});

test('folha como % da receita e eNPS', () => {
  assert.equal(folhaPercentReceita(30000, 100000), 0.3);
  assert.equal(folhaPercentReceita(30000, 0), null);
  assert.equal(enps(60, 10, 100), 0.5);
  assert.equal(enps(1, 1, 0), null);
});

test('clima só aparece com o mínimo de respostas (anonimato)', () => {
  assert.equal(climaExibivel(8, 5), true);
  assert.equal(climaExibivel(3, 5), false);
  assert.equal(climaExibivel(0, 5), false);
});

import { mediaCriterios, resumoPdi, horasTreinoPorPessoa, taxaConclusaoTreino, prioridadeSucessao } from '../lib/rh.js';

test('média dos critérios de avaliação', () => {
  assert.equal(mediaCriterios({ resultados: 8, qualidade: 7, equipe: 9 }), 8);
  assert.equal(mediaCriterios({}), null);
});

test('resumo de PDI (pendentes, atrasados, em dia)', () => {
  const r = resumoPdi([
    { status: 'concluido' }, { status: 'concluido' },
    { status: 'aberto', prazo: '2026-01-01' },   // atrasado (antes de hoje)
    { status: 'em_andamento', prazo: '2026-12-31' },
  ], '2026-09-18');
  assert.equal(r.total, 4);
  assert.equal(r.pendentes, 2);
  assert.equal(r.atrasados, 1);
  assert.equal(r.concluidos, 2);
  assert.equal(r.emDia, 0.5);
});

test('treinamento: horas por pessoa e taxa de conclusão', () => {
  assert.equal(horasTreinoPorPessoa(40, 10), 4);
  assert.equal(taxaConclusaoTreino(18, 20), 0.9);
  assert.equal(taxaConclusaoTreino(0, 0), null);
});

test('prioridade de sucessão', () => {
  assert.equal(prioridadeSucessao({ risco_perda: 'alto', impacto: 'alto' }), 'alta');
  assert.equal(prioridadeSucessao({ prontidao: 'sem_sucessor', impacto: 'alto' }), 'alta');
  assert.equal(prioridadeSucessao({ risco_perda: 'alto', impacto: 'baixo' }), 'media');
  assert.equal(prioridadeSucessao({ risco_perda: 'baixo', impacto: 'baixo', prontidao: 'pronto' }), 'baixa');
});
