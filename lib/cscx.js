// Regras do CS/CX (funções puras, testáveis)
import { dividir } from './calc.js';

export const MATRICULA = { ativa: 'Ativa', suspensa: 'Suspensa', cancelada: 'Cancelada', concluida: 'Concluída' };
export const FAIXAS = { saudavel: 'Saudável', atencao: 'Atenção', risco: 'Risco alto', critico: 'Crítico' };
export const COR_FAIXA = { saudavel: 'verde', atencao: 'amarelo', risco: 'vermelho', critico: 'vermelho' };
export const TIPOS_REGISTRO = { contato: 'Contato com o aluno', pesquisa: 'Pesquisa (NPS/CSAT/CES)', voz: 'Voz do cliente', cancelamento: 'Cancelamento ou reembolso', oportunidade: 'Oportunidade' };
export const SUBTIPOS = {
  contato: { onboarding: 'Onboarding', proativo: 'Acompanhamento proativo', retencao: 'Retenção', recuperacao: 'Recuperação de inativo' },
  pesquisa: { nps: 'NPS (0 a 10)', csat: 'CSAT (1 a 5)', ces: 'Esforço / CES (1 a 5)' },
  voz: { reclamacao: 'Reclamação', elogio: 'Elogio', sugestao: 'Sugestão' },
  cancelamento: { cancelamento: 'Pedido de cancelamento', reembolso: 'Pedido de reembolso' },
  oportunidade: { indicacao: 'Promotor para Indicação', renovacao: 'Renovação', upsell: 'Upsell', crosssell: 'Cross-sell' },
};
export const STATUS_POR_TIPO = {
  contato: { respondeu: 'Aluno respondeu', nao_respondeu: 'Não respondeu' },
  pesquisa: { respondida: 'Respondida' },
  voz: { aberta: 'Aberta', em_tratativa: 'Em tratativa', resolvida: 'Resolvida' },
  cancelamento: { solicitado: 'Solicitado', em_retencao: 'Em retenção', recuperado: 'Recuperado', concluido: 'Cancelamento concluído' },
  oportunidade: { identificada: 'Identificada', encaminhada: 'Encaminhada', convertida: 'Convertida em venda', perdida: 'Perdida' },
};
export const CANAIS = { whatsapp: 'WhatsApp', ligacao: 'Ligação', email: 'E-mail', plataforma: 'Plataforma', grupo: 'Grupo de alunos', outro: 'Outro' };
export const ETAPAS_JORNADA = { compra: 'Compra', onboarding: 'Onboarding', acesso: 'Primeiro acesso', inicio: 'Início do curso', engajamento: 'Engajamento', progresso: 'Progresso', conclusao: 'Conclusão', certificado: 'Certificado', suporte: 'Suporte', pagamento: 'Pagamento' };
export const SETORES = { produto: 'Produto', academico: 'Acadêmico', marketing: 'Marketing', comercial: 'Comercial', financeiro: 'Financeiro', automacao: 'Automação', suporte: 'Suporte', pos_venda: 'Pós-venda', indicacoes: 'Indicações' };
export const GRAVIDADE = { normal: 'Normal', grave: 'Grave' };
export const SITUACAO_BASE = { saudavel: 'Crescimento saudável', estavel: 'Estável', atencao: 'Atenção', critica: 'Crítica' };
export const GARGALOS_CS = {
  onboarding: 'Onboarding', acesso: 'Acesso', plataforma: 'Plataforma', conteudo: 'Conteúdo', engajamento: 'Engajamento', suporte: 'Suporte', comunicacao: 'Comunicação',
  pagamento: 'Pagamento', cancelamento: 'Cancelamento', certificado: 'Certificado', grupo: 'Grupo de alunos', produto: 'Produto', professor: 'Professor',
  processo: 'Processo interno', dependencia: 'Dependência de outro setor', outro: 'Outro',
};
export const TIPOS_FEEDBACK = { reconhecimento: 'Reconhecimento', correcao: 'Correção', desenvolvimento: 'Desenvolvimento', alinhamento: 'Alinhamento' };

const diasEntre = (a, b) => (a && b ? Math.floor((new Date(`${b}T12:00:00Z`) - new Date(`${String(a).slice(0, 10)}T12:00:00Z`)) / 86400000) : null);

// Health score 0–100. ctx = { ultimaPesquisa: {escala, nota} | null, reclamacoesAbertas, cancelamentoAberto, ultimoContato: 'respondeu'|'nao_respondeu'|null }
export function healthScore(aluno, ctx, regra, hojeISO) {
  const L = regra.limites; const P = regra.pesos;
  const dias = aluno.ultimo_acesso ? diasEntre(aluno.ultimo_acesso, hojeISO) : null;
  const c = {
    acesso: dias === null ? 0 : dias <= L.dias_ok ? 1 : dias <= L.dias_atencao ? 0.6 : dias <= L.dias_risco ? 0.3 : 0,
    progresso: Math.min(Math.max(Number(aluno.progresso) || 0, 0), 100) / 100,
    satisfacao: !ctx.ultimaPesquisa ? 0.6 : ctx.ultimaPesquisa.escala === 'nps' ? ctx.ultimaPesquisa.nota / 10
      : ctx.ultimaPesquisa.escala === 'ces' ? (5 - ctx.ultimaPesquisa.nota) / 4 : (ctx.ultimaPesquisa.nota - 1) / 4,
    reclamacoes: ctx.reclamacoesAbertas === 0 ? 1 : ctx.reclamacoesAbertas === 1 ? 0.4 : 0,
    cancelamento: ctx.cancelamentoAberto ? 0 : 1,
    resposta: ctx.ultimoContato === 'respondeu' ? 1 : ctx.ultimoContato === 'nao_respondeu' ? 0.3 : 0.7,
  };
  const totalPesos = Object.values(P).reduce((s, v) => s + Number(v), 0) || 1;
  const score = Math.round((Object.keys(P).reduce((s, k) => s + (c[k] ?? 0) * Number(P[k]), 0) / totalPesos) * 100);
  return { score, faixa: faixaDe(score, L), componentes: c };
}
export const faixaDe = (score, L) => (score >= L.saudavel ? 'saudavel' : score >= L.atencao ? 'atencao' : score >= L.risco ? 'risco' : 'critico');

// NPS = % promotores (9-10) − % detratores (0-6)
export function nps(notas) {
  if (!notas.length) return { nps: null, promotores: 0, neutros: 0, detratores: 0 };
  const p = notas.filter((n) => n >= 9).length, d = notas.filter((n) => n <= 6).length;
  return { nps: Math.round(((p - d) / notas.length) * 100), promotores: p, neutros: notas.length - p - d, detratores: d };
}
export const csat = (notas) => dividir(notas.filter((n) => n >= 4).length, notas.length);

// Permissões
export const veTodoCs = (u) => ['superadmin', 'diretoria'].includes(u?.papel) || !!u?.lotacoes?.some((l) => l.setor === 'cscx' && l.gerente);
export const ehDoCs = (u) => veTodoCs(u) || !!u?.lotacoes?.some((l) => l.setor === 'cscx');
