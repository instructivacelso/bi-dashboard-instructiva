// Leitura e validação do fechamento financeiro diário (função pura, testável).
import { lerNumero } from './formato.js';
import { ErroValidacao, texto, opcao, data } from './leitores.js';
import { TIPOS_ENTRADA, FORMAS_PAGAMENTO, STATUS_PAGAMENTO, STATUS_FECHAMENTO, RISCOS, liquidoEntrada } from './financeiro.js';

const falha = (m) => { throw new ErroValidacao(m); };
// dinheiro: vazio vira 0; aceita negativo só quando permitido (saldos)
const dinheiro = (fd, nome, rotulo, { negativo = false } = {}) => {
  const bruto = fd.get(nome);
  if (bruto === null || bruto === undefined || String(bruto).trim() === '') return 0;
  const n = lerNumero(bruto);
  if (n === null) falha(`${rotulo}: valor inválido.`);
  if (!negativo && n < 0) falha(`${rotulo} não pode ser negativo.`);
  return Math.round(n * 100) / 100;
};
const inteiro0 = (fd, nome, rotulo) => {
  const n = lerNumero(fd.get(nome));
  if (n === null) return 0;
  if (!Number.isInteger(n) || n < 0) falha(`${rotulo}: informe um número inteiro (0 ou mais).`);
  return n;
};
const idxs = (fd, prefixo) => [...new Set(fd.getAll(`${prefixo}_idx`).map(String))];
const dataOpc = (fd, nome, rotulo) => { const v = String(fd.get(nome) || '').trim(); if (!v) return null; if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) falha(`${rotulo}: data inválida.`); return v; };

// ctx = { hoje, janelaDias, contas:Set, produtos:Set, categorias:Set, centros:Set, fornecedores:Set, usuarios:Set }
export function lerFechamentoFinanceiro(fd, ctx) {
  const dataRef = data(fd, 'data_ref', 'Data de referência');
  const min = ctx.janelaDias != null ? somar(ctx.hoje, -ctx.janelaDias) : null;
  if (dataRef > ctx.hoje) falha('A data de referência não pode ser no futuro.');
  if (min && dataRef < min) falha(`Só é possível registrar até ${ctx.janelaDias} dias atrás. Para datas mais antigas, fale com o gerente.`);

  const c = {
    data_ref: dataRef,
    status: opcao(fd, 'status', 'Status do fechamento', Object.keys(STATUS_FECHAMENTO)),
    justificativa_data: dataRef !== ctx.hoje ? texto(fd, 'justificativa_data', 'Justificativa do registro em outra data', 300) : null,
    observacao: String(fd.get('observacao') || '').trim().slice(0, 400) || null,
  };

  // Bloco 2 — saldo por conta (uma linha por conta ativa)
  const saldos = [];
  for (const id of fd.getAll('saldo_conta').map(Number).filter(Boolean)) {
    if (!ctx.contas.has(id)) falha('Conta inválida no saldo do dia.');
    const p = (s) => `sc${id}_${s}`;
    const saldo_inicial = dinheiro(fd, p('saldo_inicial'), 'Saldo inicial', { negativo: true });
    const entradas = dinheiro(fd, p('entradas'), 'Entradas da conta');
    const saidas = dinheiro(fd, p('saidas'), 'Saídas da conta');
    const bloqueado = dinheiro(fd, p('bloqueado'), 'Valor bloqueado');
    saldos.push({ account_id: id, saldo_inicial, entradas, saidas, bloqueado, saldo_final: Math.round((saldo_inicial + entradas - saidas) * 100) / 100 });
  }

  // Bloco 3 — entradas recebidas no dia
  const entradas = [];
  for (const i of idxs(fd, 'ent')) {
    const n = entradas.length + 1;
    const bruto = dinheiro(fd, `ent${i}_valor_bruto`, `Entrada ${n}: valor bruto`);
    if (bruto <= 0) falha(`Entrada ${n}: o valor precisa ser maior que zero.`);
    const taxa = dinheiro(fd, `ent${i}_taxa`, `Entrada ${n}: taxa`);
    if (taxa > bruto) falha(`Entrada ${n}: a taxa não pode ser maior que o valor bruto.`);
    const account_id = lerNumero(fd.get(`ent${i}_account_id`)) || null;
    if (account_id && !ctx.contas.has(account_id)) falha(`Entrada ${n}: conta de destino inválida.`);
    const product_id = lerNumero(fd.get(`ent${i}_product_id`)) || null;
    entradas.push({
      tipo: opcao(fd, `ent${i}_tipo`, `Entrada ${n}: tipo`, Object.keys(TIPOS_ENTRADA)),
      origem: String(fd.get(`ent${i}_origem`) || '').trim().slice(0, 120) || null,
      cliente: String(fd.get(`ent${i}_cliente`) || '').trim().slice(0, 150) || null,
      product_id: product_id && ctx.produtos.has(product_id) ? product_id : null,
      valor_bruto: bruto, taxa, valor_liquido: liquidoEntrada(bruto, taxa), account_id,
    });
  }

  // Bloco 6 — contas pagas e a pagar
  const pagamentos = [];
  for (const i of idxs(fd, 'pag')) {
    const n = pagamentos.length + 1;
    const status = opcao(fd, `pag${i}_status`, `Conta ${n}: status`, Object.keys(STATUS_PAGAMENTO));
    const valor_previsto = dinheiro(fd, `pag${i}_valor_previsto`, `Conta ${n}: valor previsto`);
    const valor_pago = dinheiro(fd, `pag${i}_valor_pago`, `Conta ${n}: valor pago`);
    if (status === 'pago' && valor_pago <= 0) falha(`Conta ${n}: informe o valor pago.`);
    const pago_em = status === 'pago' ? (dataOpc(fd, `pag${i}_pago_em`, `Conta ${n}: data de pagamento`) || dataRef) : null;
    const category_id = lerNumero(fd.get(`pag${i}_category_id`)) || null;
    const supplier_id = lerNumero(fd.get(`pag${i}_supplier_id`)) || null;
    const cost_center_id = lerNumero(fd.get(`pag${i}_cost_center_id`)) || null;
    pagamentos.push({
      descricao: texto(fd, `pag${i}_descricao`, `Conta ${n}: descrição`, 200),
      supplier_id: supplier_id && ctx.fornecedores.has(supplier_id) ? supplier_id : null,
      category_id: category_id && ctx.categorias.has(category_id) ? category_id : null,
      cost_center_id: cost_center_id && ctx.centros.has(cost_center_id) ? cost_center_id : null,
      valor_previsto, valor_pago,
      vencimento: dataOpc(fd, `pag${i}_vencimento`, `Conta ${n}: vencimento`), pago_em,
      forma_pagamento: pick(fd, `pag${i}_forma_pagamento`, Object.keys(FORMAS_PAGAMENTO)), status,
    });
    if (valor_previsto <= 0 && valor_pago <= 0) falha(`Conta ${n}: informe o valor previsto ou o valor pago.`);
  }

  // Bloco 5 — a receber (snapshot por faixa)
  for (const k of ['receber_hoje', 'receber_7', 'receber_mes', 'receber_30', 'receber_60', 'receber_90', 'receber_mais90', 'receber_vencido'])
    c[k] = dinheiro(fd, k, 'A receber');

  // Bloco 8 — inadimplência
  c.inad_clientes = inteiro0(fd, 'inad_clientes', 'Clientes inadimplentes');
  c.inad_acordos = inteiro0(fd, 'inad_acordos', 'Acordos realizados');
  for (const k of ['inad_1_7', 'inad_8_30', 'inad_31_60', 'inad_61_90', 'inad_mais90', 'inad_recuperado']) c[k] = dinheiro(fd, k, 'Inadimplência');

  // Bloco 10 — conciliação e previsão
  c.bancos_conciliados = fd.get('bancos_conciliados') === 'sim';
  c.plataformas_conciliadas = fd.get('plataformas_conciliadas') === 'sim';
  c.divergencia_valor = dinheiro(fd, 'divergencia_valor', 'Valor da divergência');
  if (c.divergencia_valor > 0) {
    c.divergencia_motivo = texto(fd, 'divergencia_motivo', 'Motivo da divergência', 300);
    c.divergencia_acao = texto(fd, 'divergencia_acao', 'Ação necessária', 300);
    const resp = lerNumero(fd.get('divergencia_responsavel_id'));
    if (!resp || !ctx.usuarios.has(resp)) falha('Escolha o responsável pela correção da divergência.');
    c.divergencia_responsavel_id = resp;
    c.divergencia_prazo = data(fd, 'divergencia_prazo', 'Prazo para resolver a divergência');
  } else { c.divergencia_motivo = null; c.divergencia_acao = null; c.divergencia_responsavel_id = null; c.divergencia_prazo = null; }
  c.risco = pick(fd, 'risco', Object.keys(RISCOS));

  // Fechar só depois de justificar divergência e conciliar
  if (c.status === 'fechado') {
    if (c.divergencia_valor > 0 && (!c.divergencia_motivo || !c.divergencia_acao)) falha('Para fechar o dia, justifique a divergência (motivo, ação, responsável e prazo).');
    if (!c.bancos_conciliados) falha('Para fechar o dia, confirme que os bancos foram conciliados.');
  }
  return { cabecalho: c, saldos, entradas, pagamentos };
}

function pick(fd, nome, lista) { const v = String(fd.get(nome) || ''); return v && lista.includes(v) ? v : null; }
function somar(iso, n) { const d = new Date(`${iso}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); }
