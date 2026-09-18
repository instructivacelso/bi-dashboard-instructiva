// Regras de quando cada formulário do Marketing se aplica.

export const FORMULARIOS = {
  trafego: { titulo: 'Tráfego pago', tabela: 'traffic_daily_entries', porUsuario: true },
  whatsapp: { titulo: 'WhatsApp, API e orgânico', tabela: 'whatsapp_daily_entries', porUsuario: true },
  automacao: { titulo: 'Automação e onboarding', tabela: 'automation_daily_entries', porUsuario: true },
  editor: { titulo: 'Edição de vídeos e criativos', tabela: 'editor_daily_entries', porUsuario: true },
  live: { titulo: 'Resultado da live', tabela: 'live_results', porUsuario: false },
  gerente: { titulo: 'Fechamento do gerente', tabela: 'manager_daily_closings', porUsuario: true },
};

const FASES_ATIVAS = ['captacao', 'evento', 'vendas'];
const FASES = {
  trafego: FASES_ATIVAS,
  whatsapp: FASES_ATIVAS,
  automacao: FASES_ATIVAS,
  editor: ['planejamento', ...FASES_ATIVAS],
  live: FASES_ATIVAS,
  gerente: FASES_ATIVAS,
};

export const STATUS_LANCAMENTO = {
  planejamento: 'Planejamento', captacao: 'Captação', evento: 'Evento', vendas: 'Vendas', encerrado: 'Encerrado', cancelado: 'Cancelado',
};

export function lancamentoAberto(l) {
  return l && !['encerrado', 'cancelado'].includes(l.status);
}

// O formulário deve aparecer hoje para este lançamento?
export function formularioAplicavel(form, lancamento, hojeISO) {
  if (!lancamento || !FASES[form]) return false;
  if (!FASES[form].includes(lancamento.status)) return false;
  if (form === 'live') {
    const dataLive = lancamento.data_live ? String(lancamento.data_live instanceof Date ? lancamento.data_live.toISOString() : lancamento.data_live).slice(0, 10) : null;
    return dataLive === hojeISO || lancamento.live_liberada === true;
  }
  return true;
}

export const ETAPAS_AUTOMACAO_ROTULOS = {
  pagina: 'Página',
  formulario: 'Formulário',
  whatsapp: 'WhatsApp',
  checkout: 'Checkout',
  pagina_obrigado: 'Página de obrigado',
  boas_vindas: 'Boas-vindas',
  conta_aluno: 'Conta do aluno',
  grupo_alunos: 'Grupo de alunos',
  regras_grupo: 'Regras do grupo',
  orientacao_acesso: 'Orientação de acesso',
  entrega_suporte: 'Entrega ao suporte',
};

export const TIPOS_ENTREGA = { criativo: 'Criativo', aula: 'Aula', vsl: 'VSL', reels: 'Reels', corte: 'Corte', outro: 'Outro' };
export const SITUACAO_EDITOR = { concluido: 'Concluído', em_producao: 'Em produção', atrasado: 'Atrasado' };
export const PRIORIDADES = { baixa: 'Baixa', media: 'Média', alta: 'Alta', critica: 'Crítica' };
