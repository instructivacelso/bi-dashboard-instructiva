// Validação do CS/CX (funções puras, testáveis)
import { ErroValidacao, texto, inteiro, opcao, simNao, data, decimal } from './leitores.js';
import { lerNumero } from './formato.js';
import { MATRICULA, SUBTIPOS, STATUS_POR_TIPO, CANAIS, ETAPAS_JORNADA, SETORES, GRAVIDADE, SITUACAO_BASE, GARGALOS_CS, TIPOS_FEEDBACK } from './cscx.js';

const falha = (m) => { throw new ErroValidacao(m); };
const dataOpc = (fd, nome) => { const v = String(fd.get(nome) || '').trim(); if (!v) return null; if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) falha('Data inválida.'); return v; };

export function lerAlunoCs(fd, ctx) {
  const d = {
    product_id: lerNumero(fd.get('product_id')),
    matricula: opcao(fd, 'matricula', 'Situação da matrícula', Object.keys(MATRICULA)),
    compra_em: data(fd, 'compra_em', 'Data da compra'),
    valor_contrato: decimal(fd, 'valor_contrato', 'Valor do contrato'),
    turma: String(fd.get('turma') || '').trim().slice(0, 80) || null,
    boas_vindas: fd.get('boas_vindas') === 'on', entrou_grupo: fd.get('entrou_grupo') === 'on', orientado: fd.get('orientado') === 'on', iniciou_curso: fd.get('iniciou_curso') === 'on',
    acesso_liberado_em: dataOpc(fd, 'acesso_liberado_em'), primeiro_acesso_em: dataOpc(fd, 'primeiro_acesso_em'), ultimo_acesso: dataOpc(fd, 'ultimo_acesso'),
    progresso: inteiro(fd, 'progresso', 'Progresso no curso (%)'),
  };
  if (!d.product_id || !ctx.produtos.includes(d.product_id)) falha('Escolha o curso do aluno.');
  if (d.progresso > 100) falha('O progresso vai de 0 a 100%.');
  if (d.primeiro_acesso_em && !d.acesso_liberado_em) falha('Informe quando o acesso foi liberado antes do primeiro acesso.');
  if (d.ultimo_acesso && !d.primeiro_acesso_em) d.primeiro_acesso_em = d.ultimo_acesso;
  if (d.acesso_liberado_em && d.acesso_liberado_em < d.compra_em) falha('A liberação do acesso não pode ser antes da compra.');
  if (d.iniciou_curso && !d.primeiro_acesso_em) falha('Para marcar que iniciou o curso, informe o primeiro acesso.');
  const resp = lerNumero(fd.get('responsavel_id'));
  d.responsavel_id = resp || ctx.userId;
  return d;
}

export function lerRegistroCs(fd) {
  const tipo = opcao(fd, 'tipo', 'Tipo de registro', Object.keys(SUBTIPOS));
  const d = {
    tipo,
    subtipo: opcao(fd, `subtipo_${tipo}`, 'Qual', Object.keys(SUBTIPOS[tipo])),
    status: opcao(fd, `status_${tipo}`, 'Situação', Object.keys(STATUS_POR_TIPO[tipo])),
    descricao: texto(fd, 'descricao', 'Descrição', 1000),
    canal: null, escala: null, nota: null, categoria: null, gravidade: null, setor_destino: null, valor: null, estrategia: null, voz_cliente: false,
  };
  if (tipo === 'contato') d.canal = opcao(fd, 'canal', 'Canal', Object.keys(CANAIS));
  if (tipo === 'pesquisa') {
    d.escala = d.subtipo;
    d.nota = inteiro(fd, 'nota', 'Nota');
    const max = d.escala === 'nps' ? 10 : 5, min = d.escala === 'nps' ? 0 : 1;
    if (d.nota < min || d.nota > max) falha(`A nota de ${d.escala.toUpperCase()} vai de ${min} a ${max}.`);
    d.categoria = opcao(fd, 'etapa_pesquisa', 'Etapa da jornada avaliada', Object.keys(ETAPAS_JORNADA));
  }
  if (tipo === 'voz') {
    d.categoria = opcao(fd, 'etapa_voz', 'Etapa da jornada', Object.keys(ETAPAS_JORNADA));
    d.gravidade = opcao(fd, 'gravidade', 'Gravidade', Object.keys(GRAVIDADE));
    d.voz_cliente = fd.get('voz_cliente') === 'on';
    d.setor_destino = d.voz_cliente || d.subtipo === 'reclamacao' ? opcao(fd, 'setor_voz', 'Setor para encaminhar', Object.keys(SETORES)) : null;
  }
  if (tipo === 'cancelamento') {
    d.categoria = texto(fd, 'motivo_cancelamento', 'Motivo', 200);
    d.valor = decimal(fd, 'valor_cancelamento', 'Valor do contrato em jogo');
    d.estrategia = ['em_retencao', 'recuperado'].includes(d.status) ? texto(fd, 'estrategia', 'Estratégia de retenção', 300) : null;
  }
  if (tipo === 'oportunidade') {
    d.setor_destino = opcao(fd, 'setor_oport', 'Setor responsável', Object.keys(SETORES));
    if (d.subtipo === 'indicacao' && d.setor_destino !== 'indicacoes') falha('Promotores vão para o time de Indicações.');
    d.valor = d.status === 'convertida' ? decimal(fd, 'valor_oport', 'Valor da venda') : null;
  }
  return d;
}

// Fechamento do gerente: 10 blocos. Devolve { respostas, responsavel_id, prazo, prioridade }
export function lerGerenteCs(fd) {
  const t = (n, r, m = 300) => texto(fd, n, r, m);
  const r = {
    dados_conferidos: simNao(fd, 'dados_conferidos', 'Os dados da base estão corretos?'),
    situacao_base: opcao(fd, 'situacao_base', 'Situação da base', Object.keys(SITUACAO_BASE)),
    quebra_onboarding: t('quebra_onboarding', 'Principal quebra do onboarding'), curso_onboarding: t('curso_onboarding', 'Curso ou processo mais afetado', 150),
    setor_onboarding: opcao(fd, 'setor_onboarding', 'Setor responsável pelo onboarding', Object.keys(SETORES)), acao_onboarding: t('acao_onboarding', 'Ação corretiva do onboarding'),
    prazo_onboarding: data(fd, 'prazo_onboarding', 'Prazo do onboarding'),
    curso_menor_engajamento: t('curso_menor_engajamento', 'Curso com menor engajamento', 150), causa_engajamento: t('causa_engajamento', 'Causa provável'),
    segmento_engajamento: t('segmento_engajamento', 'Segmento a trabalhar'), acao_engajamento: t('acao_engajamento', 'Ação de recuperação'),
    grupo_prioritario: t('grupo_prioritario', 'Grupo prioritário'), acao_risco: t('acao_risco', 'Ação de recuperação dos alunos em risco'),
    responsavel_risco: t('responsavel_risco', 'Responsável', 150), prazo_risco: data(fd, 'prazo_risco', 'Prazo'),
    motivo_promotores: t('motivo_promotores', 'Principal motivo dos promotores'), motivo_detratores: t('motivo_detratores', 'Principal motivo dos detratores'),
    pior_ponto: opcao(fd, 'pior_ponto', 'Ponto da jornada com pior avaliação', Object.keys(ETAPAS_JORNADA)), acao_satisfacao: t('acao_satisfacao', 'Ação de melhoria'),
    dores: [1, 2, 3].map((n) => t(`dor_${n}`, `Dor ${n} do aluno`, 150)), atrito: t('atrito', 'Principal atrito da jornada'), causa_atrito: t('causa_atrito', 'Causa provável'),
    setor_atrito: opcao(fd, 'setor_atrito', 'Setor envolvido', Object.keys(SETORES)), impacto_atrito: t('impacto_atrito', 'Impacto'), sugestao_atrito: t('sugestao_atrito', 'Sugestão de melhoria'),
    motivo_cancelamento: t('motivo_cancelamento', 'Principal motivo de cancelamento'), estrategia_retencao: t('estrategia_retencao', 'Estratégia de retenção utilizada'),
    acao_preventiva: t('acao_preventiva', 'Ação preventiva'), responsavel_retencao: t('responsavel_retencao', 'Responsável pela retenção', 150), prazo_retencao: data(fd, 'prazo_retencao', 'Prazo da retenção'),
    segmento_expansao: t('segmento_expansao', 'Segmento prioritário'), oferta_recomendada: t('oferta_recomendada', 'Oferta ou continuidade recomendada'),
    qtd_encaminhada: inteiro(fd, 'qtd_encaminhada', 'Quantidade encaminhada'), setor_expansao: opcao(fd, 'setor_expansao', 'Setor responsável pela expansão', ['comercial', 'indicacoes']),
    prazo_expansao: data(fd, 'prazo_expansao', 'Prazo da expansão'),
    feedbacks_qtd: inteiro(fd, 'feedbacks_qtd', 'Quantidade de feedbacks'), reuniao_realizada: simNao(fd, 'reuniao_realizada', 'Houve reunião diária?'),
    reconhecimento: t('reconhecimento', 'Reconhecimento realizado'), acao_desenvolvimento: t('acao_desenvolvimento', 'Ação de desenvolvimento'),
    proximo_acompanhamento: data(fd, 'proximo_acompanhamento', 'Próximo acompanhamento'),
    gargalo: opcao(fd, 'gargalo', 'Principal gargalo', Object.keys(GARGALOS_CS)), etapa_jornada: opcao(fd, 'etapa_jornada', 'Etapa da jornada afetada', Object.keys(ETAPAS_JORNADA)),
    setor_envolvido: opcao(fd, 'setor_envolvido', 'Setor envolvido', Object.keys(SETORES)), alunos_afetados: inteiro(fd, 'alunos_afetados', 'Alunos afetados'),
    impacto: t('impacto', 'Impacto financeiro ou de experiência'), decisao: t('decisao', 'Decisão tomada'), acao: t('acao', 'Ação corretiva'),
  };
  r.divergencia = r.dados_conferidos ? null : t('divergencia', 'Divergência nos dados');
  if (['atencao', 'critica'].includes(r.situacao_base)) { r.causa_base = t('causa_base', 'Causa'); r.acao_base = t('acao_base', 'Ação'); }
  if (r.reuniao_realizada) { r.reuniao_tema = t('reuniao_tema', 'Tema da reunião', 200); r.reuniao_assuntos = t('reuniao_assuntos', 'Assuntos abordados', 400); }
  else r.reuniao_motivo = t('reuniao_motivo', 'Por que não houve reunião');
  if (r.feedbacks_qtd > 0) {
    r.feedbacks = [];
    for (const i of [...new Set(fd.getAll('fb_idx').map(String))]) {
      const n = r.feedbacks.length + 1;
      r.feedbacks.push({ colaborador: t(`fb${i}_colaborador`, `Feedback ${n}: colaborador`, 150), tipo: opcao(fd, `fb${i}_tipo`, `Feedback ${n}: tipo`, Object.keys(TIPOS_FEEDBACK)), tema: t(`fb${i}_tema`, `Feedback ${n}: tema`), prazo: data(fd, `fb${i}_prazo`, `Feedback ${n}: prazo`) });
    }
    if (r.feedbacks.length !== r.feedbacks_qtd) falha(`Você informou ${r.feedbacks_qtd} feedback(s): registre cada um na lista.`);
  }
  const resp = lerNumero(fd.get('responsavel_id'));
  if (!resp) falha('Escolha o responsável pela ação.');
  return { respostas: r, responsavel_id: resp, prazo: data(fd, 'prazo', 'Prazo da ação'), prioridade: opcao(fd, 'prioridade', 'Prioridade', ['baixa', 'media', 'alta', 'critica']) };
}
