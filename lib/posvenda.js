// Pós-venda — regras e cálculos puros (testáveis). Divisão por zero -> null.
import { dividir } from './calc.js';

export const STATUS_FECHAMENTO_PV = { rascunho: 'Rascunho', enviado: 'Enviado', conferido: 'Conferido' };
const SETOR = 'pos-venda';

// ---------- Permissões ----------
export const vePosvenda = (u) => ['superadmin', 'diretoria'].includes(u?.papel) || !!u?.lotacoes?.some((l) => l.setor === SETOR && l.gerente);
export const operaPosvenda = (u) => u?.papel === 'superadmin' || !!u?.lotacoes?.some((l) => l.setor === SETOR);
export const ehGerentePosvenda = (u) => ['superadmin', 'diretoria'].includes(u?.papel) || !!u?.lotacoes?.some((l) => l.setor === SETOR && l.gerente);
export const configuraPosvenda = (u) => u?.papel === 'superadmin' || (u?.papel === 'gerente' && !!u?.lotacoes?.some((l) => l.setor === SETOR && l.gerente));

// ---------- Fórmulas ----------
export const taxaRenovacao = (feitas, vencendo) => dividir(feitas, vencendo);
export const churn = (cancelamentos, vencendo) => dividir(cancelamentos, vencendo);
export const retencaoDecisao = (feitas, cancelamentos) => dividir(feitas, feitas + cancelamentos);
export const ticketRenovacao = (valor, feitas) => dividir(valor, feitas);
export const upsellConversao = (vendas, ofertas) => dividir(vendas, ofertas);
export const onboardingConclusao = (concluidos, novos) => dividir(concluidos, novos);
// eNPS/NPS = %promotores − %detratores (fração −1..1)
export function nps(promotores, detratores, respostas) {
  if (!respostas) return null;
  return Math.round(((Number(promotores || 0) - Number(detratores || 0)) / respostas) * 1000) / 1000;
}

// Consolida os fechamentos diários do período (soma de fluxo + taxas)
export function consolidarPosvenda(linhas = []) {
  const campos = ['novos_alunos', 'onboarding_concluidos', 'contatos', 'alunos_risco',
    'renov_vencendo', 'renov_feitas', 'renov_valor', 'cancelamentos',
    'upsell_ofertas', 'upsell_vendas', 'upsell_valor',
    'nps_respostas', 'nps_promotores', 'nps_neutros', 'nps_detratores',
    'inad_alunos', 'inad_valor'];
  const t = Object.fromEntries(campos.map((c) => [c, Math.round(linhas.reduce((s, l) => s + (Number(l[c]) || 0), 0) * 100) / 100]));
  t.taxaRenovacao = taxaRenovacao(t.renov_feitas, t.renov_vencendo);
  t.churn = churn(t.cancelamentos, t.renov_vencendo);
  t.retencao = retencaoDecisao(t.renov_feitas, t.cancelamentos);
  t.ticketRenovacao = ticketRenovacao(t.renov_valor, t.renov_feitas);
  t.upsellConversao = upsellConversao(t.upsell_vendas, t.upsell_ofertas);
  t.onboardingConclusao = onboardingConclusao(t.onboarding_concluidos, t.novos_alunos);
  t.nps = nps(t.nps_promotores, t.nps_detratores, t.nps_respostas);
  t.receitaRetida = Math.round((t.renov_valor + t.upsell_valor) * 100) / 100;
  return t;
}
