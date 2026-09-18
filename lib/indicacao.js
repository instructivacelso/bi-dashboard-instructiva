// Regras do módulo Indicação (funções puras, testáveis)
import { dividir } from './calc.js';

export const TIPOS_BENEFICIO = { bonus_curso: 'Bônus de curso', cashback: 'Cashback', apostila: 'Apostila', outro: 'Outro' };
export const STATUS_CAMPANHA = { ativa: 'Ativa', pausada: 'Pausada', encerrada: 'Encerrada' };
export const RESPOSTAS_CONVITE = { aceitou: 'Aceitou participar', recusou: 'Recusou', sem_resposta: 'Ainda não respondeu' };
export const AVISOS = { avisado: 'Aluno avisou o contato', nao_confirmado: 'Aviso não confirmado', autorizado: 'Contato autorizou', bloqueado: 'Bloqueado / não quer contato' };
export const VALIDACOES = { pendente: 'Aguardando validação', valida: 'Válida', invalida: 'Inválida', duplicada: 'Duplicada', telefone_incorreto: 'Telefone incorreto', fora_perfil: 'Fora do perfil' };
export const ETAPAS = {
  recebida: 'Indicação recebida', aguardando_contato: 'Aguardando primeiro contato', tentativa: 'Tentativa de contato', contato_realizado: 'Contato realizado',
  validada: 'Indicação validada', interesse: 'Interesse identificado', encaminhada: 'Encaminhada ao vendedor', negociacao: 'Em negociação', venda: 'Venda realizada',
  sem_resposta: 'Sem resposta', sem_interesse: 'Sem interesse', invalida: 'Indicação inválida', perdida: 'Perdida',
};
export const ORDEM_ETAPAS = ['recebida', 'aguardando_contato', 'tentativa', 'contato_realizado', 'validada', 'interesse', 'encaminhada', 'negociacao', 'venda'];
export const ETAPAS_FINAIS = ['sem_resposta', 'sem_interesse', 'invalida', 'perdida'];
export const ORIGENS = {
  nps_csat: 'Pesquisa NPS/CSAT', pos_venda: 'Pós-venda', suporte: 'Suporte', certificado_evento: 'Certificado/evento', aluno_ativo: 'Aluno ativo',
  ex_aluno: 'Ex-aluno', campanha: 'Campanha de indicação', vendedor: 'Vendedor', professor: 'Professor', grupo_whatsapp: 'Grupo de WhatsApp', outra: 'Outra',
};
export const ESCOLHAS_BENEFICIO = { tres_cursos: { rotulo: 'Três cursos de bônus', valor: null }, cashback: { rotulo: 'Cashback de R$ 250', valor: 250 }, apostila: { rotulo: 'Apostila', valor: null } };
export const OBJECOES = { preco: 'Preço', tempo: 'Falta de tempo', confianca: 'Falta de confiança', nao_e_momento: 'Não é o momento', ja_estuda: 'Já estuda em outro lugar', pagamento: 'Forma de pagamento', outra: 'Outra' };
export const MOTIVOS_INVALIDA = { telefone: 'Telefone errado', duplicada: 'Duplicada', sem_perfil: 'Sem perfil', nao_autorizou: 'Não autorizou contato', outro: 'Outro' };
export const MOTIVOS_PERDA = { preco: 'Preço', sem_resposta: 'Parou de responder', concorrente: 'Fechou com concorrente', sem_interesse: 'Perdeu interesse', pagamento: 'Pagamento', outro: 'Outro' };
export const PAGAMENTOS = { pix: 'PIX', cartao: 'Cartão', boleto: 'Boleto', outra: 'Outra' };
export const STATUS_VENDA = { pago: 'Pago', aprovada: 'Aprovada', boleto_gerado: 'Boleto gerado', aguardando: 'Aguardando pagamento', cancelada: 'Cancelada/estornada' };
export const STATUS_BENEFICIO = { pendente: 'Pendente', aprovado: 'Aprovado', entregue: 'Entregue', cancelado: 'Cancelado' };
export const CLASSIFICACAO = { acima: 'Acima da meta', dentro: 'Dentro da meta', abaixo: 'Abaixo da meta', critico: 'Crítico' };
export const ETAPAS_QUEBRA = { adesao: 'Adesão', contato: 'Contato', validacao: 'Validação', qualificacao: 'Qualificação', venda: 'Venda' };
export const GARGALOS_INDICACAO = {
  poucos_convites: 'Poucos alunos convidados', baixa_adesao: 'Baixa adesão', poucas_indicacoes: 'Poucas indicações por aluno', dados_invalidos: 'Dados inválidos',
  duplicidade: 'Duplicidade', sem_aviso: 'Falta de aviso ao contato', demora_contato: 'Demora no primeiro contato', poucas_tentativas: 'Poucas tentativas',
  baixo_agendamento: 'Baixo agendamento', baixa_conversao: 'Baixa conversão', oferta: 'Oferta', preco: 'Preço', pagamento: 'Condição de pagamento',
  followup: 'Falta de follow-up', beneficio_fraco: 'Benefício pouco atrativo', beneficio_atrasado: 'Benefício atrasado', processo: 'Processo', sistema: 'Sistema', outro: 'Outro',
};
export const TIPOS_FEEDBACK = { reconhecimento: 'Reconhecimento', correcao: 'Correção', desenvolvimento: 'Desenvolvimento', alinhamento: 'Alinhamento' };

// Telefone com código do país. Devolve null se não for um telefone válido.
export function normalizarTelefone(txt) {
  let d = String(txt || '').replace(/\D/g, '');
  if (d.length === 10 || d.length === 11) d = `55${d}`;
  if (d.length < 12 || d.length > 13) return null;
  return `+${d}`;
}

// Situação inicial de uma indicação: telefone ruim, duplicada ou aguardando validação
export function validacaoInicial(telefone, jaExiste) {
  if (!telefone) return 'telefone_incorreto';
  if (jaExiste) return 'duplicada';
  return 'pendente';
}

// Quantos benefícios o aluno já conquistou com N indicações válidas
export const marcosAtingidos = (validas, porBeneficio) => Math.floor(validas / porBeneficio);

// Contatos bloqueados, sem interesse, inválidos ou perdidos não recebem novas tentativas
export const podeContatar = (r) => r.aviso !== 'bloqueado' && !['sem_interesse', 'invalida', 'perdida', 'venda'].includes(r.etapa) && !['duplicada', 'telefone_incorreto'].includes(r.validacao);

// O pipeline só avança; pode ir para um estágio final; "sem resposta" pode ser retomado
export function etapaValida(de, para) {
  if (de === para) return true;
  if (de === 'venda') return false;
  if (['sem_interesse', 'invalida', 'perdida'].includes(de)) return false;
  if (ETAPAS_FINAIS.includes(para)) return true;
  if (de === 'sem_resposta') return ['tentativa', 'contato_realizado', 'validada', 'interesse'].includes(para);
  return ORDEM_ETAPAS.indexOf(para) > ORDEM_ETAPAS.indexOf(de);
}

// Taxas do funil (documento do time de indicação)
export function funilIndicacao(t) {
  return {
    adesao: dividir(t.aceitaram, t.convidados),
    contato: dividir(t.responderam, t.trabalhados),
    validacao: dividir(t.validadas, t.responderam),
    qualificacao: dividir(t.encaminhadas, t.validadas),
    conversaoVenda: dividir(t.vendas, t.encaminhadas),
    conversaoGeral: dividir(t.vendas, t.recebidas),
    ticketMedio: dividir(t.faturamento, t.vendas),
    receitaPorRecebida: dividir(t.faturamento, t.recebidas),
    followupsPorVenda: dividir(t.followups, t.vendas),
    custoPorVenda: dividir(t.custo, t.vendas),
    receitaLiquida: t.recebido != null ? t.recebido - (t.custo || 0) : null,
    retorno: dividir(t.faturamento, t.custo),
  };
}

// Etapa com a menor taxa de passagem (maior quebra)
export function maiorQuebra(f) {
  const pares = [['adesao', f.adesao], ['contato', f.contato], ['validacao', f.validacao], ['qualificacao', f.qualificacao], ['venda', f.conversaoVenda]]
    .filter(([, v]) => v !== null && v !== undefined);
  return pares.length ? pares.sort((a, b) => a[1] - b[1])[0][0] : null;
}

// Permissões
export const veTodaIndicacao = (u) => ['superadmin', 'diretoria'].includes(u?.papel) || !!u?.lotacoes?.some((l) => l.setor === 'indicacoes' && l.gerente);
export const ehColaboradorIndicacao = (u) => !!u?.lotacoes?.some((l) => l.setor === 'indicacoes' && l.subsetor === 'coleta');
export const registraIndicacao = (u) => veTodaIndicacao(u) || ehColaboradorIndicacao(u) || !!u?.lotacoes?.some((l) => l.setor === 'cscx');
export const ehDaIndicacao = (u) => registraIndicacao(u) || !!u?.lotacoes?.some((l) => l.setor === 'indicacoes');
export const gereBeneficios = (u) => veTodaIndicacao(u) || ehColaboradorIndicacao(u) || !!u?.lotacoes?.some((l) => l.setor === 'financeiro');
