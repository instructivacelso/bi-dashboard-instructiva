import { test } from 'node:test';
import assert from 'node:assert/strict';
import { healthScore, faixaDe, nps, csat, veTodoCs, ehDoCs } from '../lib/cscx.js';
import { lerAlunoCs, lerRegistroCs } from '../lib/leitoresCs.js';

const fd = (o) => ({ get: (k) => (Array.isArray(o[k]) ? o[k][0] : o[k] ?? null), getAll: (k) => (o[k] === undefined ? [] : Array.isArray(o[k]) ? o[k] : [o[k]]) });
const regra = { pesos: { acesso: 30, progresso: 25, satisfacao: 15, reclamacoes: 10, cancelamento: 15, resposta: 5 }, limites: { dias_ok: 7, dias_atencao: 15, dias_risco: 30, saudavel: 70, atencao: 50, risco: 30 } };
const ctxBom = { ultimaPesquisa: { escala: 'nps', nota: 10 }, reclamacoesAbertas: 0, cancelamentoAberto: false, ultimoContato: 'respondeu' };

test('health score: aluno engajado é saudável; sumido com cancelamento é crítico', () => {
  assert.equal(healthScore({ ultimo_acesso: '2026-09-17', progresso: 80 }, ctxBom, regra, '2026-09-18').faixa, 'saudavel');
  const ruim = healthScore({ ultimo_acesso: null, progresso: 0 }, { ultimaPesquisa: { escala: 'nps', nota: 2 }, reclamacoesAbertas: 2, cancelamentoAberto: true, ultimoContato: 'nao_respondeu' }, regra, '2026-09-18');
  assert.equal(ruim.faixa, 'critico'); assert.ok(ruim.score < 30);
});
test('health score respeita os pesos configurados', () => {
  const soAcesso = { ...regra, pesos: { acesso: 100, progresso: 0, satisfacao: 0, reclamacoes: 0, cancelamento: 0, resposta: 0 } };
  assert.equal(healthScore({ ultimo_acesso: '2026-09-18', progresso: 0 }, ctxBom, soAcesso, '2026-09-18').score, 100);
  assert.equal(healthScore({ ultimo_acesso: '2026-08-01', progresso: 100 }, ctxBom, soAcesso, '2026-09-18').score, 0);
  assert.equal(faixaDe(55, regra.limites), 'atencao');
});
test('NPS e CSAT', () => {
  assert.deepEqual(nps([10, 9, 8, 3]), { nps: 25, promotores: 2, neutros: 1, detratores: 1 });
  assert.equal(nps([]).nps, null);
  assert.equal(csat([5, 4, 2, 1]), 0.5);
});
test('ficha do aluno: coerência de datas e progresso', () => {
  const b = { product_id: '1', matricula: 'ativa', compra_em: '2026-09-01', valor_contrato: '1.200,00', progresso: '30' };
  assert.doesNotThrow(() => lerAlunoCs(fd(b), { produtos: [1], userId: 5 }));
  assert.throws(() => lerAlunoCs(fd({ ...b, progresso: '150' }), { produtos: [1], userId: 5 }), /0 a 100/);
  assert.throws(() => lerAlunoCs(fd({ ...b, acesso_liberado_em: '2026-08-01' }), { produtos: [1], userId: 5 }), /antes da compra/);
  assert.throws(() => lerAlunoCs(fd({ ...b, iniciou_curso: 'on' }), { produtos: [1], userId: 5 }), /primeiro acesso/);
});
test('registro: nota fora da escala e promotor fora de Indicações são barrados', () => {
  assert.throws(() => lerRegistroCs(fd({ tipo: 'pesquisa', subtipo_pesquisa: 'csat', status_pesquisa: 'respondida', nota: '9', etapa_pesquisa: 'suporte', descricao: 'x' })), /1 a 5/);
  assert.doesNotThrow(() => lerRegistroCs(fd({ tipo: 'pesquisa', subtipo_pesquisa: 'nps', status_pesquisa: 'respondida', nota: '9', etapa_pesquisa: 'suporte', descricao: 'x' })));
  assert.throws(() => lerRegistroCs(fd({ tipo: 'oportunidade', subtipo_oportunidade: 'indicacao', status_oportunidade: 'encaminhada', setor_oport: 'comercial', descricao: 'x' })), /Indicações/);
  assert.throws(() => lerRegistroCs(fd({ tipo: 'cancelamento', subtipo_cancelamento: 'cancelamento', status_cancelamento: 'recuperado', motivo_cancelamento: 'Tempo', valor_cancelamento: '100', descricao: 'x' })), /Estratégia/);
});
test('permissões do CS/CX', () => {
  assert.equal(veTodoCs({ papel: 'colaborador', lotacoes: [{ setor: 'cscx', gerente: false }] }), false);
  assert.equal(ehDoCs({ papel: 'colaborador', lotacoes: [{ setor: 'cscx', gerente: false }] }), true);
});
