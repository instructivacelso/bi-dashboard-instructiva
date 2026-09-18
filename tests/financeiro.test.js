import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  consolidarSaldos, disponivelConta, resultadoCaixaDia, liquidoEntrada, inadimplencia,
  aReceberPorJanela, projecaoCaixa, cobertura, capitalDeGiro, situacaoDia,
  ehGerenteFinanceiro, operaFinanceiro, configuraFinanceiro,
} from '../lib/financeiro.js';

test('saldo consolidado: soma por conta, disponível desconta o bloqueado', () => {
  const t = consolidarSaldos([
    { saldo_inicial: 1000, entradas: 500, saidas: 200, saldo_final: 1300, bloqueado: 100 },
    { saldo_inicial: 0, entradas: 0, saidas: 0, saldo_final: 400, bloqueado: 0 },
  ]);
  assert.equal(t.saldoFinal, 1700); assert.equal(t.bloqueado, 100); assert.equal(t.disponivel, 1600);
  assert.equal(disponivelConta({ saldo_final: 1300, bloqueado: 100 }), 1200);
  assert.equal(consolidarSaldos([]).disponivel, 0); // sem contas não quebra
});

test('resultado de caixa do dia e líquido da entrada', () => {
  assert.equal(resultadoCaixaDia(5000, 3200), 1800);
  assert.equal(resultadoCaixaDia(0, 500), -500);
  assert.equal(liquidoEntrada(1000, 43.9), 956.1); // desconta a taxa, arredonda em centavos
});

test('inadimplência: soma faixas e taxa = vencido ÷ base', () => {
  const i = inadimplencia({ inad_1_7: 100, inad_8_30: 200, inad_31_60: 0, inad_61_90: 0, inad_mais90: 700, inad_clientes: 5, recebido30: 9000 });
  assert.equal(i.vencido, 1000); assert.equal(i.clientes, 5);
  assert.equal(i.taxa, 0.1); // 1000 / (1000 + 9000)
  assert.equal(inadimplencia({}).taxa, null); // sem base não quebra
});

test('a receber por janela: total futuro ignora hoje e vencido', () => {
  const r = aReceberPorJanela({ receber_hoje: 100, receber_7: 300, receber_30: 1000, receber_60: 500, receber_90: 200, receber_mais90: 50, receber_vencido: 400 });
  assert.equal(r.futuroTotal, 300 + 1000 + 500 + 200 + 50);
  assert.equal(r.vencido, 400);
});

test('projeção de caixa: contratado ignora boleto, provável aplica probabilidade, aponta risco', () => {
  const p = projecaoCaixa({
    disponivel: 1000,
    aReceber: { sete: 500, trinta: 2000, sessenta: 0, noventa: 0 },
    boletoPorJanela: { sete: 0, trinta: 1000, sessenta: 0, noventa: 0 },
    inadRecuperavel: 0,
    aPagar: { sete: 2000, trinta: 1500, sessenta: 0, noventa: 0 },
    probBoleto: 0.8, probInad: 0,
  });
  // contratado em 7 dias: 1000 + 500 - 2000 = -500 (negativo => risco em "sete")
  assert.equal(p.contratado[0].saldo, -500);
  // provável em 30 dias inclui 80% do boleto de 1000: passo a passo
  // sete: 1000+500-2000=-500 ; trinta: -500 + (2000-1000+800) -1500 = -500 + 1800 -1500 = -200
  assert.equal(p.provavel[0].saldo, -500);
  assert.equal(p.provavel[1].saldo, -200);
  assert.equal(p.janelaRisco, 'sete');
  assert.equal(p.menorSaldo, -500);
});

test('cobertura e capital de giro', () => {
  assert.equal(cobertura(1000, 2000, 1500), 2); // (1000+2000)/1500
  assert.equal(cobertura(1000, 0, 0), null); // pagamentos zero => sem dado
  assert.equal(capitalDeGiro(5000, 2000, 1000), 2000); // falta 2000
  assert.equal(capitalDeGiro(1000, 2000, 1000), 0); // sobra => 0, nunca negativo
});

test('semáforo do dia: vermelho se falta caixa hoje ou há divergência', () => {
  assert.equal(situacaoDia({ disponivel: 1000, aPagarHoje: 1200 }), 'vermelho');
  assert.equal(situacaoDia({ disponivel: 1000, aPagarHoje: 0, divergencia: 50 }), 'vermelho');
  assert.equal(situacaoDia({ disponivel: 1000, aPagarHoje: 0, resultadoDia: -100 }), 'amarelo');
  assert.equal(situacaoDia({ disponivel: 1000, aPagarHoje: 500, resultadoDia: 200 }), 'verde');
});

test('permissões do financeiro', () => {
  const oper = { papel: 'colaborador', lotacoes: [{ setor: 'financeiro', subsetor: 'operacao' }] };
  const ger = { papel: 'gerente', lotacoes: [{ setor: 'financeiro', gerente: true }] };
  const dir = { papel: 'diretoria', lotacoes: [] };
  const outro = { papel: 'colaborador', lotacoes: [{ setor: 'marketing' }] };
  assert.equal(operaFinanceiro(oper), true);
  assert.equal(ehGerenteFinanceiro(oper), false);
  assert.equal(ehGerenteFinanceiro(ger), true);
  assert.equal(ehGerenteFinanceiro(dir), true);
  assert.equal(configuraFinanceiro(ger), true);
  assert.equal(configuraFinanceiro(oper), false);
  assert.equal(operaFinanceiro(outro), false);
});

import { lerFechamentoFinanceiro } from '../lib/leitoresFinanceiro.js';

function form(obj) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(obj)) { if (Array.isArray(v)) v.forEach((x) => fd.append(k, x)); else fd.set(k, v); }
  return fd;
}
const CTX = { hoje: '2026-09-18', janelaDias: 7, contas: new Set([1, 2]), produtos: new Set([9]), categorias: new Set([3]), centros: new Set([4]), fornecedores: new Set([5]), usuarios: new Set([7]) };
const base = { data_ref: '2026-09-18', status: 'conferido', divergencia_valor: '0', risco: '' };

test('leitor: saldo final é calculado (inicial + entradas - saídas)', () => {
  const fd = form({ ...base, saldo_conta: '1', sc1_saldo_inicial: '1.000,00', sc1_entradas: '500', sc1_saidas: '200', sc1_bloqueado: '0' });
  const r = lerFechamentoFinanceiro(fd, CTX);
  assert.equal(r.saldos[0].saldo_final, 1300);
});

test('leitor: data futura e fora da janela de 7 dias são recusadas', () => {
  assert.throws(() => lerFechamentoFinanceiro(form({ ...base, data_ref: '2026-09-20' }), CTX), /futuro/);
  assert.throws(() => lerFechamentoFinanceiro(form({ ...base, data_ref: '2026-09-01' }), CTX), /7 dias/);
});

test('leitor: entrada calcula líquido e recusa taxa maior que o bruto', () => {
  const ok = lerFechamentoFinanceiro(form({ ...base, ent_idx: '0', ent0_tipo: 'pix', ent0_valor_bruto: '1000', ent0_taxa: '30' }), CTX);
  assert.equal(ok.entradas[0].valor_liquido, 970);
  assert.throws(() => lerFechamentoFinanceiro(form({ ...base, ent_idx: '0', ent0_tipo: 'cartao', ent0_valor_bruto: '100', ent0_taxa: '150' }), CTX), /taxa/);
});

test('leitor: pagamento pago exige valor; previsto OU pago é obrigatório', () => {
  assert.throws(() => lerFechamentoFinanceiro(form({ ...base, pag_idx: '0', pag0_descricao: 'Luz', pag0_status: 'pago', pag0_valor_pago: '0', pag0_valor_previsto: '0' }), CTX), /valor pago/);
  const ok = lerFechamentoFinanceiro(form({ ...base, pag_idx: '0', pag0_descricao: 'Aluguel', pag0_status: 'previsto', pag0_valor_previsto: '2500', pag0_vencimento: '2026-09-25' }), CTX);
  assert.equal(ok.pagamentos[0].valor_previsto, 2500);
});

test('leitor: divergência > 0 exige motivo, ação, responsável e prazo; fechar exige conciliação', () => {
  assert.throws(() => lerFechamentoFinanceiro(form({ ...base, divergencia_valor: '50' }), CTX), /responsável|Preencha/);
  const ok = lerFechamentoFinanceiro(form({ ...base, divergencia_valor: '50', divergencia_motivo: 'Diferença no cartão', divergencia_acao: 'Conferir extrato', divergencia_responsavel_id: '7', divergencia_prazo: '2026-09-19' }), CTX);
  assert.equal(ok.cabecalho.divergencia_responsavel_id, 7);
  assert.throws(() => lerFechamentoFinanceiro(form({ ...base, status: 'fechado', bancos_conciliados: 'nao' }), CTX), /conciliados/);
});
