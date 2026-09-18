import { test } from 'node:test';
import assert from 'node:assert/strict';
import { totaisVendas, inconsistenciasPipeline, cidadesVisiveis, cidadeDoVendedor, rankingEquilibrado, projecaoMensal, pontualidade } from '../lib/comercial.js';
import { lerVendedor, lerGerenteComercial } from '../lib/leitoresComercial.js';

// FormData simples para testes
function fd(obj) {
  return {
    get: (k) => (Array.isArray(obj[k]) ? obj[k][0] : obj[k] ?? null),
    getAll: (k) => (obj[k] === undefined ? [] : Array.isArray(obj[k]) ? obj[k] : [obj[k]]),
  };
}
const baseVendedor = {
  funis: ['lancamento', 'outbound'], produtos: ['1'], leads_recebidos: '10', pipeline_qtd: '30', pipeline_valor: '60000',
  negociacao_qtd: '8', negociacao_valor: '16000', fechamento_qtd: '3', fechamento_valor: '6000',
  ligacoes: '40', followups: '25', agendamentos: '4', dificuldade: 'preco', prioridade_amanha: 'Retornar fechamentos', observacao: 'Dia bom',
};

test('totais de vendas: cartão, PIX, boleto; boleto não conta como recebido', () => {
  const t = totaisVendas([
    { valor: 1000, forma_pagamento: 'cartao', status: 'aprovada' },
    { valor: 500, forma_pagamento: 'pix', status: 'aprovada' },
    { valor: 800, forma_pagamento: 'boleto', status: 'boleto_gerado' },
    { valor: 999, forma_pagamento: 'pix', status: 'cancelada' },
  ]);
  assert.equal(t.qtd, 3); assert.equal(t.total, 2300); assert.equal(t.cartao, 1000); assert.equal(t.pix, 500); assert.equal(t.boleto, 800);
  assert.equal(t.recebido, 1500); assert.equal(t.qtdBoleto, 1); assert.ok(Math.abs(t.ticketMedio - 766.67) < 0.01);
});

test('vendedor sem venda exige motivo; com venda exige linhas completas', () => {
  const ctx = { produtosAtivos: [1, 2], anterior: null };
  assert.throws(() => lerVendedor(fd({ ...baseVendedor, houve_venda: 'nao' }), ctx), /motivo/i);
  const ok = lerVendedor(fd({ ...baseVendedor, houve_venda: 'nao', motivo_sem_venda: 'preco' }), ctx);
  assert.equal(ok.vendas.length, 0);
  assert.throws(() => lerVendedor(fd({ ...baseVendedor, houve_venda: 'sim' }), ctx), /pelo menos uma venda/);
  const r = lerVendedor(fd({ ...baseVendedor, houve_venda: 'sim', venda_idx: ['a'], a: 1, v: 1,
    va_produto: '2', va_funil: 'indicacao', va_pagamento: 'pix', va_valor: '1.500,00', va_status: 'aprovada' }), ctx);
  assert.equal(r.vendas[0].valor, 1500); assert.equal(r.vendas[0].product_id, 2);
});

test('campos vazios bloqueiam; zero é aceito', () => {
  const ctx = { produtosAtivos: [1], anterior: null };
  assert.throws(() => lerVendedor(fd({ ...baseVendedor, ligacoes: '', houve_venda: 'nao', motivo_sem_venda: 'preco' }), ctx), /Ligações/);
  assert.doesNotThrow(() => lerVendedor(fd({ ...baseVendedor, ligacoes: '0', houve_venda: 'nao', motivo_sem_venda: 'preco' }), ctx));
  assert.throws(() => lerVendedor(fd({ ...baseVendedor, produtos: ['99'], houve_venda: 'nao', motivo_sem_venda: 'preco' }), ctx), /curso/);
});

test('pipeline inconsistente exige justificativa', () => {
  assert.equal(inconsistenciasPipeline({ pipeline_valor: 100, negociacao_qtd: 5, negociacao_valor: 50, fechamento_qtd: 2, fechamento_valor: 30 }, null).length, 0);
  assert.equal(inconsistenciasPipeline({ pipeline_valor: 100, negociacao_qtd: 1, negociacao_valor: 50, fechamento_qtd: 2, fechamento_valor: 30 }, null).length, 1);
  assert.equal(inconsistenciasPipeline({ pipeline_valor: 40, negociacao_qtd: 5, negociacao_valor: 10, fechamento_qtd: 1, fechamento_valor: 5 }, { pipeline_valor: 100 }, 0).length, 1);
  const ctx = { produtosAtivos: [1], anterior: null };
  assert.throws(() => lerVendedor(fd({ ...baseVendedor, fechamento_qtd: '20', houve_venda: 'nao', motivo_sem_venda: 'preco' }), ctx), /Justificativa/);
});

test('cidade: vendedor vem do cadastro; gerente vê só a dele; diretor vê as duas', () => {
  const vend = { papel: 'colaborador', lotacoes: [{ setor: 'comercial-toledo', formulario: 'vendedor', gerente: false }] };
  const ger = { papel: 'gerente', lotacoes: [{ setor: 'comercial-jesuitas', formulario: 'gerente_comercial', gerente: true }] };
  const dir = { papel: 'colaborador', lotacoes: [{ setor: 'comercial-diretoria', formulario: null, gerente: false }] };
  assert.equal(cidadeDoVendedor(vend), 'comercial-toledo');
  assert.deepEqual(cidadesVisiveis(vend), []);
  assert.deepEqual(cidadesVisiveis(ger), ['comercial-jesuitas']);
  assert.deepEqual(cidadesVisiveis(dir).sort(), ['comercial-jesuitas', 'comercial-toledo']);
});

test('ranking não olha só faturamento', () => {
  const r = rankingEquilibrado([
    { id: 1, pctMeta: 1.2, conversao: 0.02, atividade: 5, fechamento_valor: 0 },
    { id: 2, pctMeta: 1.0, conversao: 0.2, atividade: 80, fechamento_valor: 9000 },
  ]);
  assert.equal(r[0].id, 2);
});

test('projeção mensal e pontualidade', () => {
  assert.ok(projecaoMensal(10000, '2026-09-18') > 10000);
  assert.equal(projecaoMensal(0, '2026-09-18'), 0);
  assert.equal(pontualidade(new Date('2026-09-18T20:00:00Z'), '19:00'), 'no_prazo'); // 17h em Brasília
  assert.equal(pontualidade(new Date('2026-09-18T23:30:00Z'), '19:00'), 'atrasado'); // 20h30
});

test('gerente: condicionais viram obrigatórios', () => {
  const base = {
    operacoes: ['inbound'], numeros_conferidos: 'sim', disparos_valor: '0', mensagens_enviadas: '0', mensagens_entregues: '0', respostas: '0',
    campanha_disparo: 'Nenhuma', conversao_classificacao: 'dentro', destaque_positivo: 'Ana', acao_acompanhamento: 'Acompanhar Bia',
    feedbacks_qtd: '0', feedback_individual: 'nao', feedback_coletivo: 'nao', feedback_motivo: 'Agenda cheia', reuniao_realizada: 'nao',
    reuniao_motivo: 'Feriado', reuniao_compensacao: 'Amanhã 8h', motivacao_houve: 'nao', motivacao_motivo: 'Sem tempo', motivacao_proxima: '2026-09-20',
    objecao_1: 'Preço', objecao_2: 'Tempo', objecao_3: 'Confiança', gargalo: 'followup', etapa_afetada: 'negociacao', impacto: 'Médio',
    acao: 'Cadência de follow-up', responsavel_id: '3', prazo: '2026-09-21', prioridade: 'alta',
  };
  assert.doesNotThrow(() => lerGerenteComercial(fd(base)));
  assert.throws(() => lerGerenteComercial(fd({ ...base, numeros_conferidos: 'nao' })), /divergência/);
  assert.throws(() => lerGerenteComercial(fd({ ...base, conversao_classificacao: 'critica' })), /Justificativa/);
  assert.throws(() => lerGerenteComercial(fd({ ...base, feedbacks_qtd: '2' })), /registre cada um/);
  assert.throws(() => lerGerenteComercial(fd({ ...base, mensagens_enviadas: '10', mensagens_entregues: '20' })), /entregues/);
});
