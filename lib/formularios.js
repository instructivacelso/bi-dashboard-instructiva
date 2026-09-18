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

// Lançamentos que valem para o formulário hoje. Se houver lançamento real aberto, usa ele;
// se não houver, usa a "Operação geral" (fixa) para ninguém ficar sem formulário.
export function lancamentosDoFormulario(form, lancamentos, hojeISO) {
  const aplicaveis = lancamentos.filter((l) => formularioAplicavel(form, l, hojeISO));
  const reais = aplicaveis.filter((l) => !l.permanente);
  if (reais.length) return reais;
  if (form === 'live') return [];
  return lancamentos.filter((l) => l.permanente);
}

// O formulário deve aparecer hoje para este lançamento?
export function formularioAplicavel(form, lancamento, hojeISO) {
  if (!lancamento || !FASES[form]) return false;
  if (lancamento.permanente) return form !== 'live';
  if (!FASES[form].includes(lancamento.status)) return false;
  if (form === 'live') {
    const dataLive = lancamento.data_live ? String(lancamento.data_live instanceof Date ? lancamento.data_live.toISOString() : lancamento.data_live).slice(0, 10) : null;
    return dataLive === hojeISO || lancamento.live_liberada === true;
  }
  return true;
}

// Etapa afetada (incidentes). Chaves antigas mantidas para registros anteriores.
export const ETAPAS_AUTOMACAO_ROTULOS = {
  pagina: 'Página',
  formulario: 'Formulário',
  redirecionamento_whatsapp: 'Redirecionamento para WhatsApp',
  checkout: 'Checkout',
  confirmacao_compra: 'Confirmação da compra',
  pagina_obrigado: 'Página de obrigado',
  boas_vindas: 'Boas-vindas',
  liberacao_conta: 'Liberação da conta',
  grupo_alunos: 'Grupo de alunos',
  regras_grupo: 'Regras do grupo',
  orientacao_acesso: 'Orientação de acesso',
  entrega_suporte: 'Entrega ao Suporte',
};
export const ETAPAS_ANTIGAS = { whatsapp: 'WhatsApp', conta_aluno: 'Conta do aluno' };
export const rotuloEtapa = (k) => ETAPAS_AUTOMACAO_ROTULOS[k] || ETAPAS_ANTIGAS[k] || k;

// As 9 etapas monitoradas no fechamento da Automação
export const ETAPAS_MONITORADAS = [
  { campo: 'pagina_ok', rotulo: 'Status da página' },
  { campo: 'formulario_ok', rotulo: 'Status do formulário de cadastro' },
  { campo: 'whatsapp_ok', rotulo: 'Status do redirecionamento e integração com WhatsApp' },
  { campo: 'checkout_ok', rotulo: 'Status do checkout e da confirmação da compra' },
  { campo: 'obrigado_ok', rotulo: 'Status da página de obrigado' },
  { campo: 'boas_vindas_ok', rotulo: 'Status das mensagens de boas-vindas' },
  { campo: 'conta_ok', rotulo: 'Status da criação/liberação da conta do aluno' },
  { campo: 'grupo_ok', rotulo: 'Status da entrada no grupo e envio das regras' },
  { campo: 'orientacao_ok', rotulo: 'Status da orientação inicial e transferência para o Suporte' },
];

export const PLATAFORMAS_TRAFEGO = ['Meta Ads', 'Google Ads', 'YouTube Ads', 'TikTok Ads', 'Outra'];
export const PLATAFORMAS_LIVE = { youtube: 'YouTube', instagram: 'Instagram', zoom: 'Zoom', streamyard: 'StreamYard', outra: 'Outra' };
export const TIPOS_ENTREGA = { criativo: 'Criativo', aula: 'Aula', vsl: 'VSL', reels: 'Reels', corte: 'Corte', outro: 'Outro' };
export const SITUACAO_EDITOR = { nao_iniciado: 'Não iniciado', em_producao: 'Em produção', concluido: 'Concluído', atrasado: 'Atrasado' };
export const PRIORIDADE_EDITOR = { baixa: 'Baixa', normal: 'Normal', alta: 'Alta', urgente: 'Urgente' };
export const PRIORIDADES = { baixa: 'Baixa', media: 'Média', alta: 'Alta', critica: 'Crítica' };
export const SEMAFORO_OPCOES = { verde: 'Verde', amarelo: 'Amarelo', vermelho: 'Vermelho' };
export const GARGALOS = {
  nenhum: 'Nenhum', estrategia: 'Estratégia', trafego: 'Tráfego', pagina: 'Página', formulario: 'Formulário', whatsapp: 'WhatsApp/API',
  automacao: 'Automação', criativos: 'Criativos', live: 'Live', lista: 'Lista de reserva', checkout: 'Checkout', comercial: 'Comercial', outro: 'Outro',
};

// Texto exibido no topo de cada formulário
export const DESCRICOES = {
  trafego: 'Registre os números essenciais da captação dos lançamentos sob sua responsabilidade e informe se existe algum problema que possa comprometer os resultados.',
  whatsapp: 'Registre quantos convites foram enviados, quantas pessoas entraram pela página, por API e por ações orgânicas e informe o total atual nos grupos do lançamento.',
  automacao: 'Confirme o funcionamento das automações da captação, do checkout e do onboarding. Quando houver falha, registre a etapa afetada e a previsão de solução.',
  editor: 'Registre as entregas audiovisuais realizadas para cada lançamento ou projeto e sinalize rapidamente qualquer atraso.',
  live: 'Registre os números essenciais da live para medir quantas pessoas participaram e avançaram para a lista de reserva.',
  gerente: 'Analise os números consolidados, classifique a situação do lançamento, identifique o principal gargalo e defina a ação corretiva.',
};

// Formulários do Comercial (não dependem de lançamento)
export const FORMULARIOS_COMERCIAL = {
  vendedor: { titulo: 'Fechamento do vendedor', rota: '/comercial/vendedor', tabela: 'seller_daily_closings',
    descricao: 'Registre leads, pipeline, atividades e as vendas do dia. Leva cerca de 3 minutos.' },
  gerente_comercial: { titulo: 'Fechamento do gerente comercial', rota: '/comercial/gerente', tabela: 'commercial_manager_closings',
    descricao: 'Confira os números do time, registre feedbacks, reunião, gargalos e o plano de ação.' },
  suporte_fechamento: { titulo: 'Fechamento do Suporte', rota: '/suporte/fechamento', tabela: 'support_daily_closings',
    descricao: 'Os números vêm dos seus atendimentos. Confira, analise e registre o plano do dia seguinte.' },
  cs_gerente: { titulo: 'Fechamento do gerente de CS/CX', rota: '/cs/gerente', tabela: 'cs_manager_closings',
    descricao: 'Confira a saúde da base, a satisfação, os riscos e as oportunidades, e registre o plano de ação.' },
  indicacao_gerente: { titulo: 'Fechamento do gerente de Indicação', rota: '/indicacoes/gerente', tabela: 'referral_manager_closings',
    descricao: 'Confira o funil de indicação, a qualidade, os benefícios e registre o plano de ação.' },
  indicacao_colaborador: { titulo: 'Formulário do dia — Indicação', rota: '/indicacoes/diario', tabela: 'referral_daily_forms',
    descricao: 'Dez campos: recebidas, trabalhados, respostas, validadas, follow-ups, encaminhadas e vendas. Leva uns 3 minutos.' },
  suporte_gerente: { titulo: 'Fechamento do gerente de Suporte', rota: '/suporte/gerente', tabela: 'support_manager_closings',
    descricao: 'Confira os números da equipe, SLA, backlog e qualidade, e registre o plano de ação.' },
  financeiro_fechamento: { titulo: 'Fechamento financeiro do dia', rota: '/financeiro/fechamento', tabela: 'fin_daily_closings',
    descricao: 'Saldo das contas, entradas, contas a pagar e a receber, inadimplência e conciliação. As vendas vêm prontas.' },
  rh_fechamento: { titulo: 'Fechamento do RH', rota: '/rh/fechamento', tabela: 'hr_daily_closings',
    descricao: 'Movimentação, ponto, ocorrências, recrutamento e treinamentos do dia. Marque “não” nas seções sem ocorrência.' },
  professor_diario: { titulo: 'Meu dia (professor)', rota: '/academico/diario', tabela: 'academic_daily_forms',
    descricao: 'Marque as atividades do dia — gravação, criativos, materiais, suporte, lives, vendas, planejamento — e só elas aparecem.' },
  posvenda_fechamento: { titulo: 'Fechamento do pós-venda', rota: '/pos-venda/fechamento', tabela: 'posvenda_daily_closings',
    descricao: 'Onboarding, acompanhamento, renovações, cancelamentos, upsell, satisfação e inadimplência. Marque “não” nas seções sem ocorrência.' },
};
export const rotaFormulario = (f) => FORMULARIOS_COMERCIAL[f]?.rota || `/marketing/${f}`;
