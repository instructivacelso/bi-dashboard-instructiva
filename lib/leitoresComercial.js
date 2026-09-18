// Validação dos formulários do Comercial (funções puras, testáveis)
import { ErroValidacao, texto, inteiro, decimal, opcao, simNao, data } from './leitores.js';
import { lerNumero } from './formato.js';
import {
  FUNIS, OPERACOES, PAGAMENTOS, STATUS_VENDA_INICIAL, MOTIVOS_SEM_VENDA, DIFICULDADES, CLASSIFICACAO_CONVERSAO,
  TEMAS_REUNIAO, TIPOS_MOTIVACAO, TIPOS_FEEDBACK, GARGALOS_COMERCIAL, ETAPAS_FUNIL, PRIORIDADES, inconsistenciasPipeline,
} from './comercial.js';

const falha = (m) => { throw new ErroValidacao(m); };
const multi = (fd, nome, rotulo, validos) => {
  const v = [...new Set(fd.getAll(nome).map(String))].filter((x) => validos.includes(x));
  if (!v.length) falha(`Escolha pelo menos uma opção em: ${rotulo}.`);
  return v;
};

// ctx = { produtosAtivos: number[], anterior: registro do dia anterior ou null }
export function lerVendedor(fd, ctx) {
  const produtos = [...new Set(fd.getAll('produtos').map(Number))].filter((id) => ctx.produtosAtivos.includes(id));
  if (!produtos.length) falha('Escolha pelo menos um curso trabalhado hoje.');
  const d = {
    funis: multi(fd, 'funis', 'Funis trabalhados', Object.keys(FUNIS)),
    produtos,
    leads_recebidos: inteiro(fd, 'leads_recebidos', 'Leads recebidos hoje'),
    pipeline_qtd: inteiro(fd, 'pipeline_qtd', 'Leads na pipeline'),
    pipeline_valor: decimal(fd, 'pipeline_valor', 'Valor da pipeline'),
    negociacao_qtd: inteiro(fd, 'negociacao_qtd', 'Leads em negociação'),
    negociacao_valor: decimal(fd, 'negociacao_valor', 'Valor em negociação'),
    fechamento_qtd: inteiro(fd, 'fechamento_qtd', 'Leads em fechamento'),
    fechamento_valor: decimal(fd, 'fechamento_valor', 'Valor em fechamento'),
    ligacoes: inteiro(fd, 'ligacoes', 'Ligações'),
    followups: inteiro(fd, 'followups', 'Follow-ups'),
    agendamentos: inteiro(fd, 'agendamentos', 'Agendamentos'),
    houve_venda: simNao(fd, 'houve_venda', 'Houve venda hoje?'),
    dificuldade: opcao(fd, 'dificuldade', 'Principal dificuldade do dia', Object.keys(DIFICULDADES)),
    prioridade_amanha: texto(fd, 'prioridade_amanha', 'Prioridade para amanhã', 300),
    observacao: texto(fd, 'observacao', 'Observação', 300),
  };

  const vendas = [];
  if (d.houve_venda) {
    const idx = [...new Set(fd.getAll('venda_idx').map(String))];
    for (const i of idx) {
      const n = vendas.length + 1;
      const product_id = lerNumero(fd.get(`v${i}_produto`));
      if (!product_id || !ctx.produtosAtivos.includes(product_id)) falha(`Venda ${n}: escolha o curso vendido.`);
      const valor = decimal(fd, `v${i}_valor`, `Venda ${n}: valor`);
      if (valor <= 0) falha(`Venda ${n}: o valor precisa ser maior que zero.`);
      const ident = String(fd.get(`v${i}_identificador`) || '').trim();
      vendas.push({
        product_id,
        funil: opcao(fd, `v${i}_funil`, `Venda ${n}: origem`, Object.keys(FUNIS)),
        forma_pagamento: opcao(fd, `v${i}_pagamento`, `Venda ${n}: forma de pagamento`, Object.keys(PAGAMENTOS)),
        valor,
        status: opcao(fd, `v${i}_status`, `Venda ${n}: status`, STATUS_VENDA_INICIAL),
        identificador: ident ? ident.slice(0, 80) : null,
      });
    }
    if (!vendas.length) falha('Você marcou que houve venda: adicione pelo menos uma venda.');
    const ids = vendas.map((v) => v.identificador?.toLowerCase()).filter(Boolean);
    if (new Set(ids).size !== ids.length) falha('Há duas vendas com o mesmo identificador.');
    d.motivo_sem_venda = null;
  } else {
    d.motivo_sem_venda = opcao(fd, 'motivo_sem_venda', 'Principal motivo de não ter vendido', Object.keys(MOTIVOS_SEM_VENDA));
  }

  const totalVendas = vendas.reduce((t, v) => t + v.valor, 0);
  const problemas = inconsistenciasPipeline(d, ctx.anterior, totalVendas);
  d.justificativa_pipeline = problemas.length ? texto(fd, 'justificativa_pipeline', `Justificativa da pipeline (${problemas[0]})`, 400) : null;
  return { dados: d, vendas, problemas };
}

export function lerGerenteComercial(fd) {
  const d = {
    operacoes: multi(fd, 'operacoes', 'Operações trabalhadas', Object.keys(OPERACOES)),
    numeros_conferidos: simNao(fd, 'numeros_conferidos', 'Os números estão conferidos?'),
    disparos_valor: decimal(fd, 'disparos_valor', 'Valor gasto com disparos'),
    mensagens_enviadas: inteiro(fd, 'mensagens_enviadas', 'Mensagens enviadas'),
    mensagens_entregues: inteiro(fd, 'mensagens_entregues', 'Mensagens entregues'),
    respostas: inteiro(fd, 'respostas', 'Respostas recebidas'),
    campanha_disparo: texto(fd, 'campanha_disparo', 'Campanha ou finalidade do disparo', 200),
    conversao_classificacao: opcao(fd, 'conversao_classificacao', 'Classificação da conversão', Object.keys(CLASSIFICACAO_CONVERSAO)),
    destaque_positivo: texto(fd, 'destaque_positivo', 'Destaque positivo', 300),
    acao_acompanhamento: texto(fd, 'acao_acompanhamento', 'Ação de acompanhamento', 300),
    feedbacks_qtd: inteiro(fd, 'feedbacks_qtd', 'Quantidade de feedbacks'),
    feedback_individual: simNao(fd, 'feedback_individual', 'Houve feedback individual?'),
    feedback_coletivo: simNao(fd, 'feedback_coletivo', 'Houve feedback coletivo?'),
    reuniao_realizada: simNao(fd, 'reuniao_realizada', 'A reunião diária foi realizada?'),
    motivacao_houve: simNao(fd, 'motivacao_houve', 'Houve ação de motivação ou desenvolvimento?'),
    objecoes: [1, 2, 3].map((n) => texto(fd, `objecao_${n}`, `Objeção ${n}`, 150)),
    gargalo: opcao(fd, 'gargalo', 'Principal gargalo', Object.keys(GARGALOS_COMERCIAL)),
    etapa_afetada: opcao(fd, 'etapa_afetada', 'Etapa do funil afetada', Object.keys(ETAPAS_FUNIL)),
    impacto: texto(fd, 'impacto', 'Impacto estimado', 300),
    acao: texto(fd, 'acao', 'Ação corretiva', 300),
    prazo: data(fd, 'prazo', 'Prazo da ação'),
    prioridade: opcao(fd, 'prioridade', 'Prioridade', Object.keys(PRIORIDADES)),
  };
  if (d.mensagens_entregues > d.mensagens_enviadas) falha('Mensagens entregues não podem ser mais que as enviadas.');
  if (d.respostas > d.mensagens_entregues) falha('Respostas não podem ser mais que as mensagens entregues.');
  const resp = lerNumero(fd.get('responsavel_id'));
  if (!resp) falha('Escolha o responsável pela ação.');
  d.responsavel_id = resp;

  // Condicionais (obrigatórios quando aparecem)
  if (!d.numeros_conferidos) {
    d.divergencia_descricao = texto(fd, 'divergencia_descricao', 'Descrição da divergência', 300);
    d.divergencia_origem = texto(fd, 'divergencia_origem', 'Vendedor ou origem afetada', 150);
    d.divergencia_acao = texto(fd, 'divergencia_acao', 'Ação para correção', 300);
  } else { d.divergencia_descricao = null; d.divergencia_origem = null; d.divergencia_acao = null; }
  d.conversao_justificativa = ['abaixo', 'critica'].includes(d.conversao_classificacao) ? texto(fd, 'conversao_justificativa', 'Justificativa da conversão', 300) : null;

  const feedbacks = [];
  if (d.feedbacks_qtd > 0) {
    for (const i of [...new Set(fd.getAll('fb_idx').map(String))]) {
      const n = feedbacks.length + 1;
      feedbacks.push({
        alvo: texto(fd, `fb${i}_alvo`, `Feedback ${n}: vendedor ou grupo`, 120),
        tipo: opcao(fd, `fb${i}_tipo`, `Feedback ${n}: tipo`, Object.keys(TIPOS_FEEDBACK)),
        tema: texto(fd, `fb${i}_tema`, `Feedback ${n}: tema`, 200),
        acao: texto(fd, `fb${i}_acao`, `Feedback ${n}: ação combinada`, 300),
        acompanhamento: data(fd, `fb${i}_data`, `Feedback ${n}: data de acompanhamento`),
      });
    }
    if (feedbacks.length !== d.feedbacks_qtd) falha(`Você informou ${d.feedbacks_qtd} feedback(s): registre cada um na lista.`);
    d.feedback_motivo = null;
  } else {
    d.feedback_motivo = texto(fd, 'feedback_motivo', 'Motivo de não ter havido feedback', 300);
  }

  if (d.reuniao_realizada) {
    d.reuniao_temas = multi(fd, 'reuniao_temas', 'Tema principal da reunião', Object.keys(TEMAS_REUNIAO));
    d.reuniao_assuntos = texto(fd, 'reuniao_assuntos', 'Assuntos abordados', 400);
    d.reuniao_decisoes = texto(fd, 'reuniao_decisoes', 'Decisões tomadas', 400);
    d.reuniao_pendencias = texto(fd, 'reuniao_pendencias', 'Pendências geradas', 400);
    d.reuniao_motivo = null; d.reuniao_compensacao = null;
  } else {
    d.reuniao_temas = null; d.reuniao_assuntos = null; d.reuniao_decisoes = null; d.reuniao_pendencias = null;
    d.reuniao_motivo = texto(fd, 'reuniao_motivo', 'Motivo de não ter havido reunião', 300);
    d.reuniao_compensacao = texto(fd, 'reuniao_compensacao', 'Nova data ou ação de compensação', 300);
  }

  if (d.motivacao_houve) {
    d.motivacao_tipo = opcao(fd, 'motivacao_tipo', 'Tipo da ação de motivação', Object.keys(TIPOS_MOTIVACAO));
    d.motivacao_publico = texto(fd, 'motivacao_publico', 'Público envolvido', 150);
    d.motivacao_objetivo = texto(fd, 'motivacao_objetivo', 'Objetivo', 300);
    d.motivacao_resultado = texto(fd, 'motivacao_resultado', 'Resultado percebido', 300);
    d.motivacao_motivo = null; d.motivacao_proxima = null;
  } else {
    d.motivacao_tipo = null; d.motivacao_publico = null; d.motivacao_objetivo = null; d.motivacao_resultado = null;
    d.motivacao_motivo = texto(fd, 'motivacao_motivo', 'Motivo de não ter havido ação', 300);
    d.motivacao_proxima = data(fd, 'motivacao_proxima', 'Previsão da próxima ação');
  }
  return { dados: d, feedbacks };
}
