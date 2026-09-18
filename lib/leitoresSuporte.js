// Validação do Suporte (funções puras, testáveis)
import { ErroValidacao, texto, inteiro, opcao, simNao, data } from './leitores.js';
import { lerNumero } from './formato.js';
import {
  CANAIS, CATEGORIAS, PRIORIDADES, STATUS, FINALIZADOS, SETORES_ENCAMINHAMENTO, TURNOS, CLASSIFICACAO, CLASSIFICACAO_SLA,
  GARGALOS_SUPORTE, PRIORIDADES_ACAO, TIPOS_FEEDBACK, descricaoValida,
} from './suporte.js';

const falha = (m) => { throw new ErroValidacao(m); };

export function normalizarContato(txt) {
  const s = String(txt || '').trim();
  if (!s) falha('Informe o e-mail ou o telefone do aluno.');
  if (s.includes('@')) {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)) falha('E-mail do aluno inválido.');
    return { email: s.toLowerCase(), telefone: null };
  }
  let d = s.replace(/\D/g, '');
  if (d.length === 10 || d.length === 11) d = `55${d}`;
  if (d.length < 12 || d.length > 13) falha('Telefone do aluno inválido. Use DDD + número.');
  return { email: null, telefone: `+${d}` };
}

const dataHora = (fd, nome, rotulo) => {
  const v = String(fd.get(nome) || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(v)) falha(`Preencha: ${rotulo}.`);
  return `${v}:00-03:00`; // horário de Brasília
};

// ctx = { produtosAtivos: number[], statusAnterior: string|null }
export function lerTicket(fd, ctx) {
  const aluno = { nome: texto(fd, 'aluno_nome', 'Nome do aluno', 150), ...normalizarContato(fd.get('aluno_contato')) };
  const prod = String(fd.get('produto') || '');
  if (!prod) falha('Escolha o curso ou "Atendimento geral".');
  const product_id = prod === 'geral' ? null : lerNumero(prod);
  if (prod !== 'geral' && !ctx.produtosAtivos.includes(product_id)) falha('Curso inválido.');
  const descricao = texto(fd, 'descricao', 'Descrição da solicitação', 2000);
  if (!descricaoValida(descricao)) falha('Descreva o problema com mais detalhes (o que o aluno relatou, em pelo menos 15 caracteres).');
  const d = {
    product_id,
    canal: opcao(fd, 'canal', 'Canal de atendimento', Object.keys(CANAIS)),
    categoria: opcao(fd, 'categoria', 'Categoria do problema', Object.keys(CATEGORIAS)),
    descricao,
    prioridade: opcao(fd, 'prioridade', 'Prioridade', Object.keys(PRIORIDADES)),
    status: opcao(fd, 'status', 'Status', Object.keys(STATUS)),
    acao_realizada: texto(fd, 'acao_realizada', 'Ação realizada pelo Suporte', 2000),
    encaminhamento: opcao(fd, 'encaminhamento', 'Encaminhamento', Object.keys(SETORES_ENCAMINHAMENTO)),
  };
  if (d.acao_realizada.length < 10) falha('Descreva a ação realizada (diagnóstico e procedimento). Se não foi possível agir, justifique.');

  const eraFinal = ctx.statusAnterior && FINALIZADOS.includes(ctx.statusAnterior);
  if (eraFinal && !FINALIZADOS.includes(d.status) && d.status !== 'reaberto') falha('Para voltar a atender um caso resolvido, use o status "Reaberto".');
  if (d.status === 'reaberto' && !eraFinal) falha('Só é possível reabrir um atendimento que já foi resolvido ou encerrado.');
  d.motivo_reabertura = d.status === 'reaberto' && ctx.statusAnterior !== 'reaberto' ? texto(fd, 'motivo_reabertura', 'Motivo da reabertura', 300) : null;
  if (!ctx.statusAnterior && d.status === 'reaberto') falha('Um atendimento novo não pode começar como reaberto.');

  if (d.encaminhamento !== 'suporte') {
    d.enc_responsavel = texto(fd, 'enc_responsavel', 'Responsável ou setor de destino', 150);
    d.enc_motivo = texto(fd, 'enc_motivo', 'Motivo do encaminhamento', 300);
    d.enc_prazo = dataHora(fd, 'enc_prazo', 'Prazo esperado de retorno');
  } else { d.enc_responsavel = null; d.enc_motivo = null; d.enc_prazo = null; }
  if (d.status === 'aguardando_setor' && d.encaminhamento === 'suporte') falha('Status "Aguardando outro setor" exige escolher o setor de encaminhamento.');

  if (FINALIZADOS.includes(d.status)) {
    d.solucao = texto(fd, 'solucao', 'Solução aplicada', 2000);
    d.aluno_confirmou = simNao(fd, 'aluno_confirmou', 'O aluno confirmou a solução?');
    const nota = lerNumero(fd.get('satisfacao'));
    d.satisfacao = nota === null ? null : Math.round(nota);
    if (d.satisfacao !== null && (d.satisfacao < 1 || d.satisfacao > 5)) falha('A avaliação do aluno vai de 1 a 5.');
    d.proxima_acao = null; d.prox_responsavel = null; d.prox_prazo = null; d.prox_contato = null;
  } else {
    d.proxima_acao = texto(fd, 'proxima_acao', 'Próxima ação', 500);
    d.prox_responsavel = texto(fd, 'prox_responsavel', 'Responsável pela próxima ação', 150);
    d.prox_prazo = data(fd, 'prox_prazo', 'Prazo da próxima ação');
    d.prox_contato = data(fd, 'prox_contato', 'Data do próximo contato');
    d.solucao = null; d.aluno_confirmou = null; d.satisfacao = null;
  }
  return { aluno, dados: d };
}

const multiLinhas = (fd, prefixo, qtd, campos) => {
  const out = [];
  for (const i of [...new Set(fd.getAll(`${prefixo}_idx`).map(String))]) {
    const n = out.length + 1;
    const o = {};
    for (const [c, rot, tipo, opc] of campos) {
      const nome = `${prefixo}${i}_${c}`;
      o[c] = tipo === 'data' ? data(fd, nome, `${rot} (${n})`) : tipo === 'opcao' ? opcao(fd, nome, `${rot} (${n})`, opc) : texto(fd, nome, `${rot} (${n})`, 300);
    }
    out.push(o);
  }
  if (qtd !== null && out.length !== qtd) falha(`Você informou ${qtd}: registre cada um na lista.`);
  return out;
};

export function lerFechamentoSuporte(fd, ctx = {}) {
  const d = {
    turno: opcao(fd, 'turno', 'Turno', Object.keys(TURNOS)),
    confere_recebidos: simNao(fd, 'confere_recebidos', 'Os atendimentos recebidos estão corretos?'),
    confere_trabalhados: simNao(fd, 'confere_trabalhados', 'Os atendimentos trabalhados estão corretos?'),
    classificacao: opcao(fd, 'classificacao', 'Classificação do resultado', Object.keys(CLASSIFICACAO)),
    problema_recorrente: texto(fd, 'problema_recorrente', 'Problema mais recorrente', 300),
    curso_afetado: texto(fd, 'curso_afetado', 'Curso mais afetado', 150),
    causa: texto(fd, 'causa', 'Possível causa', 300),
    prevencao: texto(fd, 'prevencao', 'Sugestão de prevenção', 300),
    encaminhamento_critico: texto(fd, 'encaminhamento_critico', 'Encaminhamento mais crítico', 300),
    caso_critico: simNao(fd, 'caso_critico', 'Houve caso crítico?'),
    reclamacao_grave: simNao(fd, 'reclamacao_grave', 'Houve reclamação grave?'),
    risco_cancelamento: simNao(fd, 'risco_cancelamento', 'Houve risco de cancelamento?'),
    aluno_sem_resposta: simNao(fd, 'aluno_sem_resposta', 'Houve aluno sem resposta por prazo excessivo?'),
    aval_positivas: inteiro(fd, 'aval_positivas', 'Avaliações positivas'),
    aval_negativas: inteiro(fd, 'aval_negativas', 'Avaliações negativas'),
    dificuldade: texto(fd, 'dificuldade', 'Principal dificuldade', 300),
    melhoria: texto(fd, 'melhoria', 'Principal melhoria identificada', 300),
    acao_amanha: texto(fd, 'acao_amanha', 'Ação para amanhã', 300),
    prazo: data(fd, 'prazo', 'Prazo'),
    observacao: texto(fd, 'observacao', 'Observação para o gerente', 300),
  };
  const resp = lerNumero(fd.get('responsavel_id'));
  if (!resp) falha('Escolha o responsável pela ação.');
  d.responsavel_id = resp;
  d.divergencia_recebidos = d.confere_recebidos ? null : texto(fd, 'divergencia_recebidos', 'Divergência nos recebidos', 300);
  d.divergencia_trabalhados = d.confere_trabalhados ? null : texto(fd, 'divergencia_trabalhados', 'Divergência nos trabalhados', 300);
  d.justificativa_backlog = ctx.temCriticoOuVencido ? texto(fd, 'justificativa_backlog', 'Justificativa dos tickets críticos ou vencidos', 400) : null;
  d.motivo_atraso_sla = ctx.temForaSla ? texto(fd, 'motivo_atraso_sla', 'Principal motivo de atraso do SLA', 300) : null;
  const algumCritico = d.caso_critico || d.reclamacao_grave || d.risco_cancelamento || d.aluno_sem_resposta;
  if (algumCritico) {
    const qtd = inteiro(fd, 'casos_qtd', 'Quantidade de casos a registrar');
    if (qtd < 1) falha('Você marcou uma situação crítica: registre pelo menos um caso.');
    d.casos = multiLinhas(fd, 'caso', qtd, [['aluno', 'Aluno'], ['problema', 'Problema'], ['responsavel', 'Responsável'], ['acao', 'Ação'], ['prazo', 'Prazo', 'data']]);
  } else d.casos = null;
  return d;
}

export function lerGerenteSuporte(fd) {
  const d = {
    cobertura_suficiente: simNao(fd, 'cobertura_suficiente', 'A cobertura da equipe foi suficiente?'),
    ausencia_sobrecarga: simNao(fd, 'ausencia_sobrecarga', 'Houve ausência ou sobrecarga?'),
    ajuste_distribuicao: texto(fd, 'ajuste_distribuicao', 'Ajuste de distribuição realizado', 300),
    numeros_corretos: simNao(fd, 'numeros_corretos', 'Os números estão corretos?'),
    classificacao_sla: opcao(fd, 'classificacao_sla', 'Classificação do SLA', Object.keys(CLASSIFICACAO_SLA)),
    motivo_backlog: texto(fd, 'motivo_backlog', 'Motivo principal do backlog', 300),
    qtd_priorizar: inteiro(fd, 'qtd_priorizar', 'Quantidade a priorizar amanhã'),
    estrategia_backlog: texto(fd, 'estrategia_backlog', 'Estratégia de redução', 300),
    responsavel_backlog: texto(fd, 'responsavel_backlog', 'Responsável pela redução do backlog', 150),
    motivo_insatisfacao: texto(fd, 'motivo_insatisfacao', 'Principal motivo de insatisfação', 300),
    atendimento_revisao: texto(fd, 'atendimento_revisao', 'Atendimento que precisa de revisão', 300),
    acao_qualidade: texto(fd, 'acao_qualidade', 'Ação de melhoria da qualidade', 300),
    problema_recorrente: texto(fd, 'problema_recorrente', 'Principal problema recorrente', 300),
    curso_afetado: texto(fd, 'curso_afetado', 'Curso ou produto afetado', 150),
    causa_provavel: texto(fd, 'causa_provavel', 'Causa provável', 300),
    setor_causa: opcao(fd, 'setor_causa', 'Setor que pode eliminar a causa', Object.keys(SETORES_ENCAMINHAMENTO)),
    sugestao_preventiva: texto(fd, 'sugestao_preventiva', 'Sugestão preventiva', 300),
    prioridade_recorrente: opcao(fd, 'prioridade_recorrente', 'Prioridade do problema recorrente', Object.keys(PRIORIDADES_ACAO)),
    casos_qtd: inteiro(fd, 'casos_qtd', 'Quantidade de casos críticos a registrar'),
    reconhecimento: texto(fd, 'reconhecimento', 'Reconhecimento do destaque', 300),
    acao_acompanhamento: texto(fd, 'acao_acompanhamento', 'Ação de acompanhamento', 300),
    redistribuicao: texto(fd, 'redistribuicao', 'Redistribuição necessária', 300),
    feedbacks_qtd: inteiro(fd, 'feedbacks_qtd', 'Quantidade de feedbacks individuais'),
    reuniao_realizada: simNao(fd, 'reuniao_realizada', 'Houve reunião diária?'),
    treinamento: simNao(fd, 'treinamento', 'Houve treinamento ou orientação?'),
    proximo_acompanhamento: data(fd, 'proximo_acompanhamento', 'Próximo acompanhamento'),
    gargalo: opcao(fd, 'gargalo', 'Principal gargalo', Object.keys(GARGALOS_SUPORTE)),
    etapa_afetada: texto(fd, 'etapa_afetada', 'Etapa afetada', 150),
    setor_envolvido: opcao(fd, 'setor_envolvido', 'Setor envolvido', Object.keys(SETORES_ENCAMINHAMENTO)),
    impacto: texto(fd, 'impacto', 'Impacto estimado', 300),
    acao: texto(fd, 'acao', 'Ação corretiva', 300),
    prazo: data(fd, 'prazo', 'Prazo'),
    prioridade: opcao(fd, 'prioridade', 'Prioridade', Object.keys(PRIORIDADES_ACAO)),
  };
  const resp = lerNumero(fd.get('responsavel_id'));
  if (!resp) falha('Escolha o responsável pela ação.');
  d.responsavel_id = resp;
  if (!d.cobertura_suficiente) { d.impacto_cobertura = texto(fd, 'impacto_cobertura', 'Impacto da cobertura insuficiente', 300); d.acao_cobertura = texto(fd, 'acao_cobertura', 'Ação tomada', 300); }
  else { d.impacto_cobertura = null; d.acao_cobertura = null; }
  if (!d.numeros_corretos) { d.divergencia = texto(fd, 'divergencia', 'Divergência', 300); d.responsavel_correcao = texto(fd, 'responsavel_correcao', 'Responsável pela correção', 150); }
  else { d.divergencia = null; d.responsavel_correcao = null; }
  if (['abaixo', 'critico'].includes(d.classificacao_sla)) { d.causa_sla = texto(fd, 'causa_sla', 'Causa do SLA', 300); d.acao_sla = texto(fd, 'acao_sla', 'Ação imediata', 300); }
  else { d.causa_sla = null; d.acao_sla = null; }
  d.casos = d.casos_qtd > 0 ? multiLinhas(fd, 'caso', d.casos_qtd, [['aluno', 'Aluno'], ['problema', 'Problema'], ['impacto', 'Impacto'], ['responsavel', 'Responsável atual'], ['setor', 'Setor envolvido'], ['acao', 'Ação imediata'], ['prazo', 'Prazo', 'data'], ['status', 'Status']]) : null;
  d.feedbacks = d.feedbacks_qtd > 0 ? multiLinhas(fd, 'fb', d.feedbacks_qtd, [['colaborador', 'Colaborador'], ['tipo', 'Tipo', 'opcao', Object.keys(TIPOS_FEEDBACK)], ['tema', 'Tema'], ['acao', 'Ação combinada'], ['prazo', 'Prazo', 'data']]) : null;
  if (d.reuniao_realizada) {
    d.reuniao_tema = texto(fd, 'reuniao_tema', 'Tema da reunião', 200); d.reuniao_assuntos = texto(fd, 'reuniao_assuntos', 'Assuntos abordados', 400);
    d.reuniao_decisoes = texto(fd, 'reuniao_decisoes', 'Decisões tomadas', 400); d.reuniao_justificativa = null;
  } else { d.reuniao_tema = null; d.reuniao_assuntos = null; d.reuniao_decisoes = null; d.reuniao_justificativa = texto(fd, 'reuniao_justificativa', 'Por que não houve reunião', 300); }
  d.motivo_sem_feedback = d.feedbacks_qtd === 0 ? texto(fd, 'motivo_sem_feedback', 'Por que não houve feedback', 300) : null;
  d.treinamento_tema = d.treinamento ? texto(fd, 'treinamento_tema', 'Tema do treinamento', 200) : null;
  return d;
}
