// Regras do módulo Suporte (funções puras, testáveis)
import { dividir } from './calc.js';

export const CANAIS = { whatsapp: 'WhatsApp', ligacao: 'Ligação', email: 'E-mail', chat: 'Chat', plataforma: 'Plataforma', grupo: 'Grupo de alunos', presencial: 'Presencial', outro: 'Outro' };
export const CATEGORIAS = {
  acesso: 'Acesso ou login', senha: 'Senha', plataforma: 'Plataforma', curso_nao_liberado: 'Curso não liberado', aula_indisponivel: 'Módulo ou aula indisponível',
  video_material: 'Vídeo ou material', certificado: 'Certificado', grupo_whatsapp: 'Grupo de WhatsApp', cadastro: 'Cadastro ou matrícula', pagamento: 'Pagamento',
  cancelamento: 'Cancelamento ou reembolso', duvida_academica: 'Dúvida acadêmica', tecnico: 'Problema técnico', outro: 'Outro',
};
export const PRIORIDADES = { baixa: 'Baixa', normal: 'Normal', alta: 'Alta', critica: 'Crítica' };
export const STATUS = {
  novo: 'Novo', em_atendimento: 'Em atendimento', aguardando_aluno: 'Aguardando aluno', aguardando_setor: 'Aguardando outro setor',
  resolvido: 'Resolvido', encerrado: 'Encerrado', reaberto: 'Reaberto',
};
export const ABERTOS = ['novo', 'em_atendimento', 'aguardando_aluno', 'aguardando_setor', 'reaberto'];
export const FINALIZADOS = ['resolvido', 'encerrado'];
export const SETORES_ENCAMINHAMENTO = {
  suporte: 'Permanece no Suporte', automacao: 'Automação', financeiro: 'Financeiro', pos_venda: 'Pós-venda', cscx: 'CS/CX',
  comercial: 'Comercial', academico: 'Professor ou Acadêmico', gestao: 'Gestão', outro: 'Outro',
};
export const TURNOS = { manha: 'Manhã', tarde: 'Tarde', noite: 'Noite', integral: 'Integral' };
export const CLASSIFICACAO = { acima: 'Acima da meta', dentro: 'Dentro da meta', abaixo: 'Abaixo da meta', critico: 'Crítico' };
export const CLASSIFICACAO_SLA = { dentro: 'Dentro da meta', atencao: 'Atenção', abaixo: 'Abaixo da meta', critico: 'Crítico' };
export const GARGALOS_SUPORTE = {
  falta_equipe: 'Falta de equipe', sobrecarga: 'Sobrecarga', processo: 'Falha de processo', automacao: 'Falha de automação', plataforma: 'Plataforma',
  acesso: 'Acesso', informacao: 'Falta de informação', dependencia: 'Dependência de outro setor', treinamento: 'Falta de treinamento',
  produto: 'Problema recorrente de produto', sla: 'SLA inadequado', outro: 'Outro',
};
export const PRIORIDADES_ACAO = { baixa: 'Baixa', media: 'Média', alta: 'Alta', critica: 'Crítica' };
export const TIPOS_FEEDBACK = { reconhecimento: 'Reconhecimento', correcao: 'Correção', desenvolvimento: 'Desenvolvimento', alinhamento: 'Alinhamento' };

// Frases genéricas que não descrevem o problema
const GENERICAS = ['aluno com problema', 'problema', 'erro', 'ajuda', 'duvida', 'dúvida', 'nao funciona', 'não funciona', 'aluno com duvida', 'aluno com dúvida'];
export function descricaoValida(txt) {
  const t = String(txt || '').trim().toLowerCase();
  if (t.length < 15) return false;
  return !GENERICAS.includes(t.replace(/[.!]+$/, ''));
}

// Limites de SLA a partir da abertura
export function limitesSla(abertoEm, regra) {
  const a = new Date(abertoEm);
  return {
    resposta: new Date(a.getTime() + regra.resposta_min * 60000),
    solucao: new Date(a.getTime() + regra.solucao_horas * 3600000),
  };
}

// Situação do SLA de um ticket agora: ok | atencao (menos de 20% do prazo) | vencido
export function situacaoSla(t, agora = new Date()) {
  const fim = FINALIZADOS.includes(t.status) ? new Date(t.resolvido_em || t.encerrado_em || agora) : agora;
  const limite = !t.primeira_resposta_em && !FINALIZADOS.includes(t.status) ? new Date(t.sla_resposta_limite) : new Date(t.sla_solucao_limite);
  if (fim > limite) return 'vencido';
  if (FINALIZADOS.includes(t.status)) return 'ok';
  const total = limite - new Date(t.aberto_em);
  return total > 0 && (limite - agora) / total < 0.2 ? 'atencao' : 'ok';
}

// Ticket finalizado dentro do prazo de solução?
export const dentroSla = (t) => !!t.resolvido_em && new Date(t.resolvido_em) <= new Date(t.sla_solucao_limite);

export const minutos = (de, ate) => (de && ate ? (new Date(ate) - new Date(de)) / 60000 : null);
export function fmtDuracao(min) {
  if (min === null || min === undefined || !isFinite(min)) return 'sem dados';
  if (min < 60) return `${Math.round(min)} min`;
  if (min < 1440) return `${(min / 60).toFixed(1).replace('.', ',')} h`;
  return `${(min / 1440).toFixed(1).replace('.', ',')} dias`;
}

// Indicadores a partir de uma lista de tickets e contagens de eventos
export function indicadoresSuporte({ trabalhados, resolvidos, reabertos, concluidos, dentroPrazo, encaminhados, positivas, negativas }) {
  return {
    taxaResolucao: dividir(resolvidos, trabalhados),
    taxaReabertura: dividir(reabertos, resolvidos),
    cumprimentoSla: dividir(dentroPrazo, concluidos),
    taxaEncaminhamento: dividir(encaminhados, trabalhados),
    satisfacaoPositiva: dividir(positivas, (positivas || 0) + (negativas || 0)),
  };
}

// Backlog final = inicial + novos − encerrados
export const backlogFinal = (inicial, novos, encerrados) => inicial + novos - encerrados;

// Pontuação contextual do atendente (não só quantidade): resolução 30%, SLA 30%, volume 20%, criticidade 10%, sem reabertura 10%
export function rankingSuporte(linhas) {
  const max = Math.max(...linhas.map((l) => l.trabalhados || 0), 0);
  return linhas.map((l) => ({
    ...l,
    pontuacao: 0.3 * (l.taxaResolucao || 0) + 0.3 * (l.sla ?? 0) + 0.2 * (max ? (l.trabalhados || 0) / max : 0)
      + 0.1 * Math.min((l.criticos || 0) / Math.max(l.trabalhados || 1, 1) * 2, 1) + 0.1 * (1 - (l.taxaReabertura || 0)),
  })).sort((a, b) => b.pontuacao - a.pontuacao);
}

// Permissões: gerente do Suporte, diretoria e administrador veem tudo; atendente vê os seus
export const veTodoSuporte = (u) => ['superadmin', 'diretoria'].includes(u?.papel) || !!u?.lotacoes?.some((l) => l.setor === 'suporte' && l.gerente);
export const ehDoSuporte = (u) => veTodoSuporte(u) || !!u?.lotacoes?.some((l) => l.setor === 'suporte');
export const podeConfigurarSla = (u) => u?.papel === 'superadmin' || !!u?.lotacoes?.some((l) => l.setor === 'suporte' && l.gerente);
