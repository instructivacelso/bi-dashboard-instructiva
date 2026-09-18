// Financeiro — regras e cálculos puros (testáveis). Dinheiro em número; divisão por zero -> null.
import { dividir } from './calc.js';

// ---------- Listas padronizadas ----------
export const TIPOS_CONTA = { corrente: 'Conta corrente', poupanca: 'Poupança', aplicacao: 'Aplicação', carteira: 'Carteira digital', caixa: 'Caixa/dinheiro' };
export const NATUREZAS = { entrada: 'Entrada', saida: 'Saída' };
export const GRUPOS_CATEGORIA = {
  receita: 'Receita', custo_variavel: 'Custo variável', custo_fixo: 'Custo fixo', pessoal: 'Pessoal/folha',
  imposto: 'Impostos', marketing: 'Marketing', divida: 'Dívidas e financiamentos', outra: 'Outra',
};
export const TIPOS_ENTRADA = {
  pix: 'Pix', cartao: 'Liquidação de cartão', boleto: 'Boleto pago', recorrencia: 'Recorrência', transferencia: 'Transferência',
  recuperacao: 'Recuperação de inadimplência', outra: 'Outra entrada',
};
export const FORMAS_PAGAMENTO = { pix: 'Pix', cartao: 'Cartão', boleto: 'Boleto', transferencia: 'Transferência', dinheiro: 'Dinheiro', outra: 'Outra' };
export const STATUS_PAGAMENTO = { previsto: 'Previsto', aprovado: 'Aprovado', pago: 'Pago', vencido: 'Vencido', renegociado: 'Renegociado', cancelado: 'Cancelado' };
export const STATUS_FECHAMENTO = { rascunho: 'Rascunho', aguardando_conciliacao: 'Aguardando conciliação', conferido: 'Conferido', fechado: 'Fechado' };
export const RISCOS = { baixo: 'Baixo', atencao: 'Atenção', alto: 'Alto — decisão da diretoria' };

// ---------- Permissões ----------
export const ehGerenteFinanceiro = (u) => ['superadmin', 'diretoria'].includes(u?.papel) || !!u?.lotacoes?.some((l) => l.setor === 'financeiro' && l.gerente);
export const ehDoFinanceiro = (u) => !!u?.lotacoes?.some((l) => l.setor === 'financeiro') || ['superadmin', 'diretoria'].includes(u?.papel);
export const operaFinanceiro = (u) => u?.papel === 'superadmin' || !!u?.lotacoes?.some((l) => l.setor === 'financeiro'); // lança e concilia
export const veFinanceiro = (u) => ehGerenteFinanceiro(u); // dashboards e relatórios
export const configuraFinanceiro = (u) => u?.papel === 'superadmin' || (u?.papel === 'gerente' && !!u?.lotacoes?.some((l) => l.setor === 'financeiro' && l.gerente));

// ---------- Saldo bancário (estoque: uma linha por conta no fechamento) ----------
export const disponivelConta = (b) => Number(b.saldo_final || 0) - Number(b.bloqueado || 0);
export function consolidarSaldos(linhas = []) {
  const t = { saldoInicial: 0, entradas: 0, saidas: 0, saldoFinal: 0, bloqueado: 0 };
  for (const b of linhas) {
    t.saldoInicial += Number(b.saldo_inicial || 0); t.entradas += Number(b.entradas || 0); t.saidas += Number(b.saidas || 0);
    t.saldoFinal += Number(b.saldo_final || 0); t.bloqueado += Number(b.bloqueado || 0);
  }
  t.disponivel = t.saldoFinal - t.bloqueado;
  return t;
}

// ---------- Fluxo do dia ----------
export const resultadoCaixaDia = (entradas, saidas) => Number(entradas || 0) - Number(saidas || 0);
export const liquidoEntrada = (bruto, taxa) => Math.round((Number(bruto || 0) - Number(taxa || 0)) * 100) / 100;

// ---------- Inadimplência (bloco 8) ----------
// Taxa = valor vencido ÷ valor que deveria ter sido recebido × 100 (fração)
export function inadimplencia(f = {}) {
  const vencido = (f.inad_1_7 || 0) + (f.inad_8_30 || 0) + (f.inad_31_60 || 0) + (f.inad_61_90 || 0) + (f.inad_mais90 || 0);
  const base = vencido + (f.recebido30 || 0); // o que deveria ter entrado no período
  return {
    vencido, clientes: f.inad_clientes || 0, recuperado: f.inad_recuperado || 0, acordos: f.inad_acordos || 0,
    taxa: dividir(vencido, base),
    faixas: [
      ['1 a 7 dias', f.inad_1_7 || 0], ['8 a 30 dias', f.inad_8_30 || 0], ['31 a 60 dias', f.inad_31_60 || 0],
      ['61 a 90 dias', f.inad_61_90 || 0], ['+90 dias', f.inad_mais90 || 0],
    ],
  };
}

// ---------- Contas a receber e a pagar por janela (blocos 5 e 7) ----------
export function aReceberPorJanela(f = {}) {
  return {
    hoje: f.receber_hoje || 0, sete: f.receber_7 || 0, mes: f.receber_mes || 0,
    trinta: f.receber_30 || 0, sessenta: f.receber_60 || 0, noventa: f.receber_90 || 0,
    mais90: f.receber_mais90 || 0, vencido: f.receber_vencido || 0,
    futuroTotal: (f.receber_7 || 0) + (f.receber_30 || 0) + (f.receber_60 || 0) + (f.receber_90 || 0) + (f.receber_mais90 || 0),
  };
}

// ---------- Projeção de caixa (bloco 10) ----------
// entradas/saidas por janela: { sete, trinta, sessenta, noventa }. boletosProvaveis/inad aplicam probabilidade.
// probBoleto e probInad em fração (0..1).
export function projecaoCaixa({ disponivel = 0, aReceber = {}, boletoPorJanela = {}, inadRecuperavel = 0, aPagar = {}, probBoleto = 0.8, probInad = 0.3 } = {}) {
  const janelas = ['sete', 'trinta', 'sessenta', 'noventa'];
  const cenario = (fatorBoleto, fatorInad) => {
    let saldo = disponivel; const curva = [];
    for (const j of janelas) {
      const receb = (aReceber[j] || 0) - (boletoPorJanela[j] || 0) + (boletoPorJanela[j] || 0) * fatorBoleto;
      const extraInad = j === 'trinta' ? inadRecuperavel * fatorInad : 0;
      saldo += receb + extraInad - (aPagar[j] || 0);
      curva.push({ janela: j, saldo: Math.round(saldo * 100) / 100 });
    }
    return curva;
  };
  const contratado = cenario(0, 0); // só o certo (não conta boleto nem inadimplência)
  const provavel = cenario(probBoleto, probInad);
  const conservador = cenario(probBoleto / 2, 0);
  const menor = Math.min(...provavel.map((p) => p.saldo), disponivel);
  const risco = provavel.find((p) => p.saldo < 0);
  return { contratado, provavel, conservador, menorSaldo: Math.round(menor * 100) / 100, janelaRisco: risco ? risco.janela : null };
}

// Cobertura de N dias = (disponível + recebíveis prováveis) ÷ pagamentos previstos
export const cobertura = (disponivel, recebiveis, pagamentos) => dividir(Number(disponivel || 0) + Number(recebiveis || 0), pagamentos);
// Necessidade de capital de giro (positivo = falta)
export const capitalDeGiro = (saidasPrevistas, entradasProvaveis, disponivel) =>
  Math.max(0, Number(saidasPrevistas || 0) - Number(entradasProvaveis || 0) - Number(disponivel || 0));

// Situação do dia para o semáforo do fechamento
export function situacaoDia({ disponivel = 0, aPagarHoje = 0, resultadoDia = 0, divergencia = 0 } = {}) {
  if (disponivel - aPagarHoje < 0 || divergencia > 0) return 'vermelho';
  if (resultadoDia < 0) return 'amarelo';
  return 'verde';
}

// ---------- Etapa 2: resultado do mês (DRE, margem, CAC, ponto de equilíbrio) ----------
export const TIPOS_AJUSTE = { depreciacao: 'Depreciação', amortizacao: 'Amortização', juros: 'Juros', imposto: 'Imposto', pro_labore: 'Pró-labore', provisao: 'Provisão', outro: 'Outro' };
export const GRUPOS_AJUSTE = { custo_variavel: 'Custo variável', custo_fixo: 'Custo fixo', pessoal: 'Pessoal', imposto: 'Impostos', juros: 'Juros', depreciacao: 'Depreciação', outra: 'Outra' };

// DRE gerencial. Entradas já somadas por grupo (números; nunca digitados duas vezes).
export function montarDRE(v = {}) {
  const n = (x) => Number(x || 0);
  const receitaBruta = n(v.receitaBruta);
  const deducoes = n(v.taxas) + n(v.impostos);
  const receitaLiquida = receitaBruta - deducoes;
  const variaveis = n(v.custosVariaveis) + n(v.marketing);
  const margemContribuicao = receitaLiquida - variaveis;
  const margemPct = dividir(margemContribuicao, receitaLiquida);
  const fixos = n(v.custosFixos) + n(v.pessoal);
  const ebitda = margemContribuicao - fixos;
  const depreciacao = n(v.depreciacao);
  const juros = n(v.juros);
  const resultado = ebitda - depreciacao - juros;
  return {
    receitaBruta, taxas: n(v.taxas), impostos: n(v.impostos), deducoes, receitaLiquida,
    custosVariaveis: n(v.custosVariaveis), marketing: n(v.marketing), variaveis,
    margemContribuicao, margemPct,
    custosFixos: n(v.custosFixos), pessoal: n(v.pessoal), fixos,
    ebitda, ebitdaPct: dividir(ebitda, receitaBruta), depreciacao, juros,
    resultado, margemLiquida: dividir(resultado, receitaBruta),
  };
}

// Faturamento de equilíbrio = custos fixos ÷ margem de contribuição (%)
export const pontoEquilibrio = (fixos, margemPct) => (margemPct && margemPct > 0 ? Math.round((Number(fixos || 0) / margemPct) * 100) / 100 : null);
// Custo de aquisição = investimento ÷ vendas
export const cac = (investimento, vendas) => dividir(Number(investimento || 0), vendas);
// Margem de um produto
export function margemProduto(receita, custo) {
  const m = Number(receita || 0) - Number(custo || 0);
  return { margem: Math.round(m * 100) / 100, pct: dividir(m, receita) };
}
// Rateio de um custo indireto pela participação de cada produto na receita
export function ratearPorReceita(totalIndireto, receitasPorProduto = []) {
  const soma = receitasPorProduto.reduce((s, r) => s + Number(r.receita || 0), 0);
  return receitasPorProduto.map((r) => ({ id: r.id, rateio: soma > 0 ? Math.round((Number(totalIndireto || 0) * (Number(r.receita || 0) / soma)) * 100) / 100 : 0 }));
}

// ---------- Etapa 3: dívidas, patrimônio, investidores, consórcios, alçadas ----------
export const TIPOS_DIVIDA = { financiamento: 'Financiamento', emprestimo: 'Empréstimo', cartao: 'Cartão de crédito', parcelamento: 'Parcelamento', cheque_especial: 'Cheque especial', outro: 'Outro' };
export const STATUS_DIVIDA = { ativa: 'Ativa', quitada: 'Quitada', renegociada: 'Renegociada', atrasada: 'Atrasada' };
export const TIPOS_CAPITAL = { aporte: 'Aporte', retirada: 'Retirada', distribuicao: 'Distribuição de lucros' };
export const STATUS_CONSORCIO = { ativo: 'Ativo', contemplado: 'Contemplado', encerrado: 'Encerrado', cancelado: 'Cancelado' };
export const TIPOS_ATIVO = { imovel: 'Imóvel', veiculo: 'Veículo', equipamento: 'Equipamento', mobiliario: 'Mobiliário', intangivel: 'Intangível', aplicacao: 'Aplicação financeira', outro: 'Outro' };

const num = (x) => Number(x || 0);
const ativas = (ds) => ds.filter((d) => ['ativa', 'atrasada', 'renegociada'].includes(d.status));

// Soma do saldo devedor das dívidas em aberto
export const saldoDevedorTotal = (dividas = []) => Math.round(ativas(dividas).reduce((s, d) => s + num(d.saldo_devedor), 0) * 100) / 100;
// Parcela mensal comprometida (dívidas + consórcios ativos)
export const parcelaMensalTotal = (dividas = [], consorcios = []) =>
  Math.round((ativas(dividas).reduce((s, d) => s + num(d.parcela_valor), 0)
    + consorcios.filter((c) => c.status === 'ativo').reduce((s, c) => s + num(c.parcela_valor), 0)) * 100) / 100;
// Juros do mês (saldo × taxa mensal)
export const jurosMes = (dividas = []) => Math.round(ativas(dividas).reduce((s, d) => s + num(d.saldo_devedor) * num(d.taxa_mensal), 0) * 100) / 100;
// Patrimônio
export const patrimonioTotal = (ativos = []) => Math.round(ativos.reduce((s, a) => s + num(a.valor_atual), 0) * 100) / 100;
export const patrimonioLiquido = (ativos = [], dividas = []) => Math.round((patrimonioTotal(ativos) - saldoDevedorTotal(dividas)) * 100) / 100;
// Grau de endividamento = dívida ÷ patrimônio (ativos)
export const grauEndividamento = (dividas = [], ativos = []) => dividir(saldoDevedorTotal(dividas), patrimonioTotal(ativos));
// Progresso de quitação
export const progressoDivida = (pagas, total) => dividir(pagas, total);
// Alçada: pagamento acima do limite exige diretoria
export const alcadaExcedida = (valor, limite) => num(valor) > num(limite) && num(limite) > 0;
// Capital líquido dos sócios no período (aportes − retiradas − distribuições)
export function capitalLiquido(movimentos = []) {
  return Math.round(movimentos.reduce((s, m) => s + (m.tipo === 'aporte' ? num(m.valor) : -num(m.valor)), 0) * 100) / 100;
}
