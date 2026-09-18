// RH — regras e cálculos puros (testáveis). Divisão por zero -> null.
import { dividir } from './calc.js';

export const VINCULOS = { clt: 'CLT', pj: 'PJ', estagio: 'Estágio', temporario: 'Temporário', terceiro: 'Terceiro', socio: 'Sócio', outro: 'Outro' };
export const MODALIDADES = { presencial: 'Presencial', hibrido: 'Híbrido', remoto: 'Remoto' };
export const STATUS_COLAB = { ativo: 'Ativo', ferias: 'Férias', afastado: 'Afastado', aviso: 'Aviso prévio', desligado: 'Desligado', suspenso: 'Suspenso' };
export const TIPOS_MOVIMENTO = { admissao: 'Admissão', desligamento: 'Desligamento', promocao: 'Promoção', transferencia: 'Transferência', alteracao_salario: 'Alteração de salário', alteracao_cargo: 'Alteração de cargo', ferias: 'Férias', afastamento: 'Afastamento', retorno: 'Retorno' };
export const TIPOS_DESLIGAMENTO = { voluntario: 'Voluntário (pedido)', involuntario: 'Involuntário (empresa)', fim_contrato: 'Fim de contrato', outro: 'Outro' };
export const STATUS_FECHAMENTO_RH = { rascunho: 'Rascunho', enviado: 'Enviado', conferido: 'Conferido' };

// ---------- Permissões ----------
export const veRh = (u) => ['superadmin', 'diretoria'].includes(u?.papel) || !!u?.lotacoes?.some((l) => l.setor === 'rh' && l.gerente);
export const operaRh = (u) => u?.papel === 'superadmin' || !!u?.lotacoes?.some((l) => l.setor === 'rh');
export const ehGerenteRh = (u) => ['superadmin', 'diretoria'].includes(u?.papel) || !!u?.lotacoes?.some((l) => l.setor === 'rh' && l.gerente);
export const configuraRh = (u) => u?.papel === 'superadmin' || (u?.papel === 'gerente' && !!u?.lotacoes?.some((l) => l.setor === 'rh' && l.gerente));
// Dados sensíveis (salário): só gerente de RH, diretoria e admin
export const veSalario = (u) => ['superadmin', 'diretoria'].includes(u?.papel) || (u?.papel === 'gerente' && !!u?.lotacoes?.some((l) => l.setor === 'rh' && l.gerente));

// ---------- Fórmulas (documento do RH) ----------
export const headcountMedio = (ini, fim) => (Number(ini || 0) + Number(fim || 0)) / 2;
export const turnover = (admissoes, desligamentos, hcMedio) => dividir((Number(admissoes || 0) + Number(desligamentos || 0)) / 2, hcMedio);
export const taxaDesligamento = (desligamentos, hcMedio) => dividir(desligamentos, hcMedio);
export const absenteismo = (horasAusencia, horasPrevistas) => dividir(horasAusencia, horasPrevistas);
export const taxaAtraso = (atrasos, jornadasPrevistas) => dividir(atrasos, jornadasPrevistas);
export const retencao = (permanecem, elegiveis) => dividir(permanecem, elegiveis);
export const custoMedio = (custoTotal, hcMedio) => dividir(custoTotal, hcMedio);
export const custoContratacao = (custos, admissoes) => dividir(custos, admissoes);

// Funil de recrutamento (conversões entre etapas do fechamento acumulado)
export function funilRecrutamento(t = {}) {
  return {
    triagem: dividir(t.entrevistas, t.candidatos),
    aprovacao: dividir(t.aprovados, t.entrevistas),
    proposta: dividir(t.propostas, t.aprovados),
    aceite: dividir(t.contratacoes, t.propostas),
    geral: dividir(t.contratacoes, t.candidatos),
  };
}

// Consolida os fechamentos diários do período (soma de fluxo)
export function consolidarRh(linhas = []) {
  const campos = ['admissoes', 'deslig_vol', 'deslig_invol', 'transferencias', 'promocoes', 'exp_inicio', 'exp_fim',
    'presentes', 'faltas_just', 'faltas_injust', 'atrasos', 'saidas_antec', 'pendencias_ponto',
    'solicitacoes', 'solic_resolvidas', 'solic_pendentes', 'conflitos',
    'vagas_abertas', 'candidatos', 'entrevistas', 'aprovados', 'propostas', 'contratacoes',
    'integracoes', 'treinamentos', 'treino_participantes', 'treino_ausentes'];
  const t = Object.fromEntries(campos.map((c) => [c, linhas.reduce((s, l) => s + (Number(l[c]) || 0), 0)]));
  t.horas_extras = Math.round(linhas.reduce((s, l) => s + (Number(l.horas_extras) || 0), 0) * 100) / 100;
  t.desligamentos = t.deslig_vol + t.deslig_invol;
  t.faltas = t.faltas_just + t.faltas_injust;
  // Jornadas previstas ~ presentes + faltas (aproximação diária); atraso e absenteísmo relativos
  const jornadas = t.presentes + t.faltas;
  t.taxaAtraso = taxaAtraso(t.atrasos, jornadas);
  t.absenteismo = absenteismo(t.faltas, jornadas); // por jornada, aproximação da Etapa 1
  t.resolucaoRh = dividir(t.solic_resolvidas, t.solicitacoes);
  t.presencaTreino = dividir(t.treino_participantes, t.treino_participantes + t.treino_ausentes);
  t.funil = funilRecrutamento(t);
  return t;
}
