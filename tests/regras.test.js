import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dividir, calcTrafego, indicadoresMarketing, montarFunil, semaforo, calcWhatsapp } from '../lib/calc.js';
import { podeEditar, veLancamento, formulariosDo, veDashboardSetor } from '../lib/perm.js';
import { formularioAplicavel } from '../lib/formularios.js';
import { lerNumero } from '../lib/formato.js';

const H = '2026-09-18';
const colab = { id: 5, papel: 'colaborador', lotacoes: [{ setor: 'marketing', formulario: 'trafego', gerente: false }] };
const externo = { id: 6, papel: 'externo', lotacoes: [{ setor: 'marketing', formulario: 'trafego', gerente: false }] };
const gerente = { id: 2, papel: 'gerente', lotacoes: [{ setor: 'marketing', formulario: 'gerente', gerente: true }] };
const diretoria = { id: 3, papel: 'diretoria', lotacoes: [] };

test('divisão por zero e ausência viram null', () => {
  assert.equal(dividir(10, 0), null);
  assert.equal(dividir(null, 5), null);
  assert.equal(calcTrafego({ valor_gasto: 100, visitas: 0, cadastros: 0 }).cpl, null);
  assert.equal(calcTrafego({ valor_gasto: 100, visitas: 200, cadastros: 20 }).cpl, 5);
});
test('taxas do marketing', () => {
  const i = indicadoresMarketing({ investimento: 1000, visitas: 1000, cadastros: 200, grupos: 100, live: 50, lista: 10, vendas: 5, faturamento: 5000 });
  assert.equal(i.cpl, 5); assert.equal(i.conversaoPagina, 0.2); assert.equal(i.entradaWhatsapp, 0.5);
  assert.equal(i.cac, 200); assert.equal(i.roas, 5); assert.equal(i.naoEntraramWhatsapp, 100);
});
test('whatsapp: entradas e conversão', () => {
  const w = calcWhatsapp({ convites_api: 100, entradas_api: 40, entradas_organico: 10, custo_disparos: null });
  assert.equal(w.entradasTotais, 50); assert.equal(w.conversaoConvites, 0.4); assert.equal(w.custoPorEntradaApi, null);
});
test('funil aponta gargalo frente ao planejado', () => {
  const { gargalo } = montarFunil({ visitas: 10000, cadastros: 2000, grupos: 600, live: 300, lista: 100, vendas: 30 },
    { cadastros: 2000, grupos: 1400, live: 500, lista: 150, vendas: 40 });
  assert.equal(gargalo.chave, 'grupos');
});
test('semáforo', () => {
  assert.equal(semaforo(100, 100), 'verde'); assert.equal(semaforo(85, 100), 'amarelo'); assert.equal(semaforo(50, 100), 'vermelho');
  assert.equal(semaforo(4, 5, 'menor'), 'verde'); assert.equal(semaforo(7, 5, 'menor'), 'vermelho'); assert.equal(semaforo(3, null), 'neutro');
});
test('edição: autor só no dia; gerente corrige com auditoria; diretoria nunca', () => {
  assert.equal(podeEditar(colab, { created_by: 5, data_ref: H }, H).pode, true);
  assert.equal(podeEditar(colab, { created_by: 5, data_ref: '2026-09-17' }, H).pode, false);
  assert.equal(podeEditar(colab, { created_by: 9, data_ref: H }, H).pode, false);
  assert.deepEqual(podeEditar(gerente, { created_by: 5, data_ref: '2026-09-01' }, H), { pode: true, correcao: true });
  assert.equal(podeEditar(diretoria, { created_by: 5, data_ref: H }, H).pode, false);
});
test('externo só vê lançamentos atribuídos; gerente vê todos', () => {
  assert.equal(veLancamento(externo, 1, [1]), true);
  assert.equal(veLancamento(externo, 2, [1]), false);
  assert.equal(veLancamento(gerente, 2, []), true);
  assert.equal(veDashboardSetor(externo, 'marketing'), false);
  assert.deepEqual(formulariosDo(diretoria), []);
});
test('aplicabilidade dos formulários', () => {
  assert.equal(formularioAplicavel('trafego', { status: 'captacao' }, H), true);
  assert.equal(formularioAplicavel('trafego', { status: 'encerrado' }, H), false);
  assert.equal(formularioAplicavel('live', { status: 'evento', data_live: H }, H), true);
  assert.equal(formularioAplicavel('live', { status: 'evento', data_live: '2026-09-20', live_liberada: false }, H), false);
  assert.equal(formularioAplicavel('live', { status: 'evento', data_live: '2026-09-20', live_liberada: true }, H), true);
});
test('leitura de números em formato brasileiro', () => {
  assert.equal(lerNumero('1.234,56'), 1234.56); assert.equal(lerNumero('R$ 50'), 50); assert.equal(lerNumero(''), null);
});

import { lancamentosDoFormulario } from '../lib/formularios.js';
test('ninguém fica sem formulário: sem lançamento aberto usa a Operação geral', () => {
  const geral = { id: 1, status: 'captacao', permanente: true };
  const aberto = { id: 2, status: 'captacao', permanente: false };
  const encerrado = { id: 3, status: 'encerrado', permanente: false };
  assert.deepEqual(lancamentosDoFormulario('automacao', [geral, encerrado], H).map((l) => l.id), [1]);
  assert.deepEqual(lancamentosDoFormulario('automacao', [geral, aberto], H).map((l) => l.id), [2]);
  assert.deepEqual(lancamentosDoFormulario('live', [geral], H), []);
});
