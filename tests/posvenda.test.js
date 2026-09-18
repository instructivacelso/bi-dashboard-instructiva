import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  taxaRenovacao, churn, retencaoDecisao, ticketRenovacao, upsellConversao, onboardingConclusao, nps,
  consolidarPosvenda, vePosvenda, operaPosvenda, configuraPosvenda,
} from '../lib/posvenda.js';

test('renovação, churn e retenção', () => {
  assert.equal(taxaRenovacao(85, 100), 0.85);
  assert.equal(churn(15, 100), 0.15);
  assert.equal(retencaoDecisao(85, 15), 0.85);
  assert.equal(taxaRenovacao(0, 0), null); // divisão por zero
});

test('ticket, upsell e onboarding', () => {
  assert.equal(ticketRenovacao(17000, 85), 200);
  assert.equal(upsellConversao(6, 30), 0.2);
  assert.equal(onboardingConclusao(18, 20), 0.9);
});

test('NPS = %promotores − %detratores (fração)', () => {
  assert.equal(nps(60, 10, 100), 0.5);
  assert.equal(nps(30, 30, 100), 0);
  assert.equal(nps(10, 50, 100), -0.4);
  assert.equal(nps(1, 1, 0), null); // sem respostas
});

test('consolidação dos fechamentos do pós-venda', () => {
  const c = consolidarPosvenda([
    { renov_vencendo: 60, renov_feitas: 50, renov_valor: 10000, cancelamentos: 10, upsell_ofertas: 20, upsell_vendas: 5, upsell_valor: 2500, nps_respostas: 40, nps_promotores: 24, nps_detratores: 8, novos_alunos: 12, onboarding_concluidos: 10 },
    { renov_vencendo: 40, renov_feitas: 35, renov_valor: 7000, cancelamentos: 5, nps_respostas: 10, nps_promotores: 6, nps_detratores: 1 },
  ]);
  assert.equal(c.renov_vencendo, 100);
  assert.equal(c.renov_feitas, 85);
  assert.equal(c.taxaRenovacao, 0.85);
  assert.equal(c.churn, 0.15);
  assert.equal(c.ticketRenovacao, 200); // 17000/85
  assert.equal(c.receitaRetida, 19500); // 17000 + 2500
  assert.equal(c.nps, (30 - 9) / 50); // promotores 30, detratores 9, respostas 50
  assert.equal(consolidarPosvenda([]).renov_feitas, 0);
});

test('permissões do pós-venda', () => {
  const oper = { papel: 'colaborador', lotacoes: [{ setor: 'pos-venda', subsetor: 'operacao' }] };
  const ger = { papel: 'gerente', lotacoes: [{ setor: 'pos-venda', gerente: true }] };
  assert.equal(operaPosvenda(oper), true);
  assert.equal(vePosvenda(oper), false);
  assert.equal(vePosvenda(ger), true);
  assert.equal(configuraPosvenda(ger), true);
  assert.equal(configuraPosvenda(oper), false);
});
