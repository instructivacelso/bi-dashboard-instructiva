// Acadêmico/Professores — regras e cálculos puros (testáveis). Divisão por zero -> null.
import { dividir } from './calc.js';

export const ATIVIDADES = {
  gravacao: 'Gravação de aulas', criativos: 'Criativos para marketing', materiais: 'Apostilas e materiais',
  suporte: 'Suporte aos alunos', lives: 'Live ou aula ao vivo', vendas: 'Atendimento e vendas', planejamento: 'Planejamento e reunião',
};
export const ETAPAS_CONTEUDO = {
  ideia: 'Ideia', pesquisa: 'Pesquisa', roteiro: 'Roteiro', preparacao: 'Preparação', gravacao: 'Gravação', edicao: 'Edição',
  revisao: 'Revisão técnica', ajustes: 'Ajustes', aprovacao: 'Aprovação', publicacao: 'Publicação', atualizacao: 'Atualização', arquivado: 'Arquivado',
};
export const ORDEM_CONTEUDO = ['ideia', 'pesquisa', 'roteiro', 'preparacao', 'gravacao', 'edicao', 'revisao', 'ajustes', 'aprovacao', 'publicacao'];
export const PRIORIDADES = { baixa: 'Baixa', media: 'Média', alta: 'Alta' };
export const STATUS_PROFESSOR = { ativo: 'Ativo', afastado: 'Afastado', inativo: 'Inativo' };

// ---------- Permissões ----------
export const veAcademico = (u) => ['superadmin', 'diretoria'].includes(u?.papel) || !!u?.lotacoes?.some((l) => l.setor === 'academico' && l.gerente);
export const ehProfessor = (u) => !!u?.lotacoes?.some((l) => l.setor === 'academico' && l.subsetor === 'professores');
export const ehDoAcademico = (u) => !!u?.lotacoes?.some((l) => l.setor === 'academico') || ['superadmin', 'diretoria'].includes(u?.papel);
export const gereConteudo = (u) => veAcademico(u) || ehProfessor(u);
export const configuraAcademico = (u) => u?.papel === 'superadmin' || (u?.papel === 'gerente' && !!u?.lotacoes?.some((l) => l.setor === 'academico' && l.gerente));

// ---------- Fórmulas (documento dos professores) ----------
export const cumprimentoPlano = (concluidas, planejadas) => dividir(concluidas, planejadas);
export const entregaNoPrazo = (noPrazo, concluidas) => dividir(noPrazo, concluidas);
export const aprovacaoSemRetrabalho = (aprovadasPrimeira, avaliadas) => dividir(aprovadasPrimeira, avaliadas);
export const taxaRegravacao = (regravadas, gravadas) => dividir(regravadas, gravadas);
export const resolucaoSuporte = (resolvidos, chamados) => dividir(resolvidos, chamados);
export const comparecimentoLive = (presentes, inscritos) => dividir(presentes, inscritos);
export const conversaoVenda = (vendas, oportunidades) => dividir(vendas, oportunidades);
export const ticketMedio = (valor, vendas) => dividir(valor, vendas);
export const receitaPorLive = (receita, lives) => dividir(receita, lives);

// Consolida os formulários diários dos professores (soma de fluxo + taxas)
export function consolidarProdutividade(linhas = []) {
  const campos = ['horas', 'grav_aulas', 'grav_minutos', 'grav_tempo', 'grav_publicadas', 'grav_regravadas',
    'criativos_produzidos', 'criativos_aprovados', 'criativos_publicados', 'criativos_refacao',
    'mat_paginas_novas', 'mat_paginas_revisadas', 'mat_exercicios', 'mat_concluidos',
    'sup_alunos', 'sup_chamados', 'sup_resolvidos', 'sup_primeiro', 'sup_pendentes',
    'live_realizadas', 'live_inscritos', 'live_presentes', 'live_leads', 'live_vendas', 'live_receita',
    'vnd_leads', 'vnd_followups', 'vnd_qtd', 'vnd_valor', 'plan_reunioes'];
  const t = Object.fromEntries(campos.map((c) => [c, Math.round(linhas.reduce((s, l) => s + (Number(l[c]) || 0), 0) * 100) / 100]));
  t.taxaRegravacao = taxaRegravacao(t.grav_regravadas, t.grav_aulas);
  t.horasPorHoraConteudo = dividir(t.grav_tempo, t.grav_minutos / 60);
  t.aprovacaoCriativos = dividir(t.criativos_aprovados, t.criativos_produzidos);
  t.resolucaoSuporte = resolucaoSuporte(t.sup_resolvidos, t.sup_chamados);
  t.primeiroContato = dividir(t.sup_primeiro, t.sup_chamados);
  t.comparecimentoLive = comparecimentoLive(t.live_presentes, t.live_inscritos);
  t.conversaoVenda = conversaoVenda(t.vnd_qtd, t.vnd_leads);
  t.ticketMedio = ticketMedio(t.vnd_valor, t.vnd_qtd);
  t.receitaPorLive = receitaPorLive(t.live_receita, t.live_realizadas);
  return t;
}

// O pipeline só avança (ou vai para atualização/arquivado)
export function etapaConteudoValida(de, para) {
  if (de === para) return true;
  if (['atualizacao', 'arquivado'].includes(para)) return true;
  if (['publicacao', 'arquivado'].includes(de)) return de === 'publicacao' && para === 'atualizacao';
  const i = ORDEM_CONTEUDO.indexOf(de), f = ORDEM_CONTEUDO.indexOf(para);
  return i >= 0 && f > i;
}
