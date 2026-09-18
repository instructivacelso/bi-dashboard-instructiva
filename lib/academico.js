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

// ---------- Etapa 2: qualidade, retrabalho, marketing, pontuação opcional ----------
export const STATUS_QUALIDADE = { aprovado: 'Aprovado', aprovado_ajuste: 'Aprovado com ajuste', reprovado: 'Reprovado' };
export const CRITERIOS_QUALIDADE = { precisao: 'Precisão técnica', didatica: 'Clareza didática', organizacao: 'Organização', audio_video: 'Áudio e vídeo', pratica: 'Aplicação prática', roteiro: 'Aderência ao roteiro', identidade: 'Identidade da escola' };
export const PESOS_ROTULOS = { aula_publicada: 'Aula publicada', aula_gravada: 'Aula gravada', criativo_aprovado: 'Criativo aprovado', pagina_nova: 'Página nova', pagina_revisada: 'Página revisada', chamado_resolvido: 'Chamado resolvido', live: 'Live realizada', venda: 'Venda' };

// Nota de qualidade = média dos critérios preenchidos
export function notaQualidade(criterios = {}) {
  const v = Object.values(criterios || {}).map(Number).filter(Number.isFinite);
  return v.length ? Math.round((v.reduce((s, x) => s + x, 0) / v.length) * 100) / 100 : null;
}

// Resumo das avaliações de qualidade (produção, aprovação e retrabalho separados)
// avaliacoes: [{ content_id, status, nota, no_prazo }] em ordem cronológica
export function resumoQualidade(avaliacoes = []) {
  const primeira = new Map();
  for (const a of avaliacoes) if (!primeira.has(a.content_id)) primeira.set(a.content_id, a);
  const conteudos = primeira.size;
  const aprovadosPrimeira = [...primeira.values()].filter((a) => a.status === 'aprovado').length;
  const reprovacoes = avaliacoes.filter((a) => a.status === 'reprovado').length;
  const ajustes = avaliacoes.filter((a) => a.status === 'aprovado_ajuste').length;
  const notas = avaliacoes.map((a) => Number(a.nota)).filter(Number.isFinite);
  const comPrazo = avaliacoes.filter((a) => a.no_prazo !== null && a.no_prazo !== undefined);
  return {
    avaliacoes: avaliacoes.length, conteudos, aprovadosPrimeira, reprovacoes, ajustes,
    aprovacaoSemRetrabalho: aprovacaoSemRetrabalho(aprovadosPrimeira, conteudos),
    retrabalho: dividir(reprovacoes + ajustes, avaliacoes.length),
    notaMedia: notas.length ? Math.round((notas.reduce((s, n) => s + n, 0) / notas.length) * 100) / 100 : null,
    noPrazo: entregaNoPrazo(comPrazo.filter((a) => a.no_prazo).length, comPrazo.length),
  };
}

// Resultado de marketing dos lançamentos do professor (recebido do módulo de Marketing)
export function resultadoMarketing({ investimento = 0, leads = 0, receita = 0 } = {}) {
  return { investimento: Number(investimento || 0), leads: Number(leads || 0), receita: Number(receita || 0), cpl: dividir(Number(investimento || 0), leads), roas: dividir(Number(receita || 0), Number(investimento || 0)) };
}

// Pontuação opcional com memória do cálculo. Só pontua entregas válidas;
// reprovações descontam o peso de uma aula publicada cada; qualidade média ajusta (fator 0,5 a 1,0).
export function pontuacao(c = {}, pesos = {}, qualidade = {}) {
  const p = (k) => Number(pesos[k] || 0);
  const itens = [
    ['aula_publicada', Number(c.grav_publicadas || 0)],
    ['aula_gravada', Math.max(0, Number(c.grav_aulas || 0) - Number(c.grav_regravadas || 0))], // regravação não pontua
    ['criativo_aprovado', Number(c.criativos_aprovados || 0)],
    ['pagina_nova', Number(c.mat_paginas_novas || 0)],
    ['pagina_revisada', Number(c.mat_paginas_revisadas || 0)],
    ['chamado_resolvido', Number(c.sup_resolvidos || 0)],
    ['live', Number(c.live_realizadas || 0)],
    ['venda', Number(c.vnd_qtd || 0) + Number(c.live_vendas || 0)],
  ].map(([k, qtd]) => ({ chave: k, rotulo: PESOS_ROTULOS[k], qtd, peso: p(k), pontos: Math.round(qtd * p(k) * 100) / 100 }));
  const bruto = Math.round(itens.reduce((s, i) => s + i.pontos, 0) * 100) / 100;
  const desconto = Math.round(Number(qualidade.reprovacoes || 0) * p('aula_publicada') * 100) / 100;
  const fator = qualidade.notaMedia != null ? Math.max(0.5, Math.min(1, Number(qualidade.notaMedia) / 10)) : 1;
  const total = Math.max(0, Math.round((bruto - desconto) * fator * 100) / 100);
  return { itens, bruto, desconto, fator: Math.round(fator * 100) / 100, total };
}
