// Regras do módulo Indicação (funções puras, testáveis)
import { dividir } from './calc.js';

export const TIPOS_BENEFICIO = { bonus_curso: 'Bônus de curso', cashback: 'Cashback', apostila: 'Apostila', outro: 'Outro' };
export const STATUS_CAMPANHA = { ativa: 'Ativa', pausada: 'Pausada', encerrada: 'Encerrada' };
export const RESPOSTAS_CONVITE = { aceitou: 'Aceitou participar', recusou: 'Recusou', sem_resposta: 'Ainda não respondeu' };
export const AVISOS = { avisado: 'Aluno avisou o contato', nao_confirmado: 'Aviso não confirmado', autorizado: 'Contato autorizou', bloqueado: 'Bloqueado / não quer contato' };
export const VALIDACOES = { pendente: 'Aguardando validação', valida: 'Válida', invalida: 'Inválida', duplicada: 'Duplicada', telefone_incorreto: 'Telefone incorreto', fora_perfil: 'Fora do perfil' };
export const ETAPAS = { nova: 'Nova', contatado: 'Contatado', respondeu: 'Respondeu', conversa: 'Conversa iniciada', agendado: 'Agendado', proposta: 'Proposta enviada', venda: 'Venda', perdida: 'Perdida', sem_interesse: 'Sem interesse' };
export const ORDEM_ETAPAS = ['nova', 'contatado', 'respondeu', 'conversa', 'agendado', 'proposta', 'venda'];
export const PAGAMENTOS = { cartao: 'Cartão', pix: 'PIX', boleto: 'Boleto' };
export const STATUS_VENDA = { aprovada: 'Aprovada', boleto_gerado: 'Boleto gerado', aguardando: 'Aguardando pagamento', pago: 'Pago' };
export const STATUS_BENEFICIO = { pendente: 'Pendente', aprovado: 'Aprovado', entregue: 'Entregue', cancelado: 'Cancelado' };
export const CLASSIFICACAO = { acima: 'Acima da meta', dentro: 'Dentro da meta', abaixo: 'Abaixo da meta', critico: 'Crítico' };
export const ETAPAS_QUEBRA = { adesao: 'Adesão', validacao: 'Validação', contato: 'Contato', resposta: 'Resposta', agendamento: 'Agendamento', proposta: 'Proposta', venda: 'Venda' };
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

// Contatos bloqueados ou sem interesse não recebem novas tentativas
export const podeContatar = (r) => r.aviso !== 'bloqueado' && r.etapa !== 'sem_interesse' && ['valida'].includes(r.validacao);

// Etapa só avança (ou vai para perdida/sem interesse)
export function etapaValida(de, para) {
  if (de === para) return true;
  if (['perdida', 'sem_interesse'].includes(para)) return de !== 'venda';
  if (['perdida', 'sem_interesse', 'venda'].includes(de)) return false;
  return ORDEM_ETAPAS.indexOf(para) > ORDEM_ETAPAS.indexOf(de);
}

// Taxas do funil (seção 8 do documento)
export function funilIndicacao(t) {
  return {
    adesao: dividir(t.aceitaram, t.convidados),
    validacao: dividir(t.validas, t.recebidas),
    contato: dividir(t.contatadas, t.validas),
    resposta: dividir(t.responderam, t.contatadas),
    agendamento: dividir(t.agendamentos, t.responderam),
    proposta: dividir(t.propostas, t.conversas),
    vendaSobreValida: dividir(t.vendas, t.validas),
    vendaSobreProposta: dividir(t.vendas, t.propostas),
    receitaPorValida: dividir(t.faturamento, t.validas),
    custoPorValida: dividir(t.custo, t.validas),
    custoPorVenda: dividir(t.custo, t.vendas),
    receitaLiquida: t.recebido != null ? t.recebido - (t.custo || 0) : null,
    retorno: dividir(t.faturamento, t.custo),
  };
}

// Etapa com a menor taxa de passagem (maior quebra)
export function maiorQuebra(f) {
  const pares = [['adesao', f.adesao], ['validacao', f.validacao], ['contato', f.contato], ['resposta', f.resposta], ['agendamento', f.agendamento], ['proposta', f.proposta], ['venda', f.vendaSobreProposta]]
    .filter(([, v]) => v !== null && v !== undefined);
  return pares.length ? pares.sort((a, b) => a[1] - b[1])[0][0] : null;
}

// Permissões
export const veTodaIndicacao = (u) => ['superadmin', 'diretoria'].includes(u?.papel) || !!u?.lotacoes?.some((l) => l.setor === 'indicacoes' && l.gerente);
export const registraIndicacao = (u) => veTodaIndicacao(u) || !!u?.lotacoes?.some((l) => l.setor === 'cscx' || (l.setor === 'indicacoes' && l.subsetor === 'coleta'));
export const ehDaIndicacao = (u) => veTodaIndicacao(u) || registraIndicacao(u) || !!u?.lotacoes?.some((l) => l.setor === 'indicacoes');
export const gereBeneficios = (u) => veTodaIndicacao(u) || !!u?.lotacoes?.some((l) => l.setor === 'financeiro');
