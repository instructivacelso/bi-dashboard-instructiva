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

// ---------- Etapa 2: folha e clima/eNPS ----------
export const STATUS_FOLHA = { rascunho: 'Rascunho', fechada: 'Fechada', enviada_financeiro: 'Enviada ao financeiro' };

// Provisão mensal de férias (1/12 + 1/3 sobre férias) e 13º (1/12) sobre a remuneração
export const provisaoMensal = (base, variavel = 0) => { const r = Number(base || 0) + Number(variavel || 0); return Math.round((r * (1 / 12) * (1 + 1 / 3) + r * (1 / 12)) * 100) / 100; };
// Custo total de um colaborador na folha do mês
export function custoFolha(l = {}) {
  const n = (x) => Number(x || 0);
  return Math.round((n(l.salario_base) + n(l.variavel) + n(l.beneficios) + n(l.encargos) + n(l.provisoes) - n(l.descontos)) * 100) / 100;
}
// Folha como percentual da receita (fração)
export const folhaPercentReceita = (folha, receita) => dividir(folha, receita);
// eNPS = %promotores − %detratores (fração −1..1)
export function enps(promotores, detratores, respostas) {
  if (!respostas) return null;
  return Math.round(((Number(promotores || 0) - Number(detratores || 0)) / respostas) * 1000) / 1000;
}
// Regra de anonimato: só exibe o resultado com um mínimo de respostas
export const climaExibivel = (respostas, minimo) => Number(respostas || 0) >= Number(minimo || 0) && Number(respostas || 0) > 0;

// ---------- Etapa 2 (parte 2): avaliações, treinamentos, sucessão ----------
export const TIPOS_AVALIACAO = { experiencia: 'Experiência', periodica: 'Periódica', '360': '360°', autoavaliacao: 'Autoavaliação' };
export const CRITERIOS_AVALIACAO = { resultados: 'Resultados e metas', qualidade: 'Qualidade', produtividade: 'Produtividade', conhecimento: 'Conhecimento técnico', organizacao: 'Organização', comunicacao: 'Comunicação', equipe: 'Trabalho em equipe', pontualidade: 'Pontualidade', cultura: 'Aderência à cultura' };
export const STATUS_PDI = { aberto: 'Aberto', em_andamento: 'Em andamento', concluido: 'Concluído', cancelado: 'Cancelado' };
export const PRONTIDAO = { pronto: 'Pronto agora', curto_prazo: 'Curto prazo', medio_prazo: 'Médio prazo', sem_sucessor: 'Sem sucessor' };
export const NIVEIS = { baixo: 'Baixo', medio: 'Médio', alto: 'Alto' };
export const POTENCIAL = { baixo: 'Baixo', medio: 'Médio', alto: 'Alto' };

// Média dos critérios preenchidos numa avaliação
export function mediaCriterios(criterios = {}) {
  const vals = Object.values(criterios || {}).map(Number).filter((v) => Number.isFinite(v));
  return vals.length ? Math.round((vals.reduce((s, v) => s + v, 0) / vals.length) * 100) / 100 : null;
}
// Resumo dos PDIs (aberto/andamento = pendente; atrasado = pendente com prazo vencido)
export function resumoPdi(pdis = [], hojeIso) {
  const pend = pdis.filter((p) => ['aberto', 'em_andamento'].includes(p.status));
  const atrasados = pend.filter((p) => p.prazo && String(p.prazo).slice(0, 10) < hojeIso);
  const concluidos = pdis.filter((p) => p.status === 'concluido').length;
  return { total: pdis.length, pendentes: pend.length, atrasados: atrasados.length, concluidos, emDia: dividir(concluidos, pdis.length) };
}
// Treinamento
export const horasTreinoPorPessoa = (cargaTotalHoras, pessoas) => dividir(cargaTotalHoras, pessoas);
export const taxaConclusaoTreino = (presentes, inscritos) => dividir(presentes, inscritos);
// Sucessão: prioridade quando alto risco de perda e alto impacto (ou sem sucessor)
export function prioridadeSucessao(s = {}) {
  if (s.prontidao === 'sem_sucessor' && (s.risco_perda === 'alto' || s.impacto === 'alto')) return 'alta';
  if (s.risco_perda === 'alto' && s.impacto === 'alto') return 'alta';
  if (s.risco_perda === 'alto' || s.impacto === 'alto' || s.prontidao === 'sem_sucessor') return 'media';
  return 'baixa';
}
