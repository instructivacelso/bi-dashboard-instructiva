// Validação do fechamento do gerente de Indicação (função pura, testável)
import { ErroValidacao, texto, inteiro, opcao, simNao, data, decimal } from './leitores.js';
import { lerNumero } from './formato.js';
import { STATUS_CAMPANHA, CLASSIFICACAO, ETAPAS_QUEBRA, GARGALOS_INDICACAO, TIPOS_FEEDBACK } from './indicacao.js';

const falha = (m) => { throw new ErroValidacao(m); };
const linhas = (fd, prefixo, qtd, campos) => {
  const out = [];
  for (const i of [...new Set(fd.getAll(`${prefixo}_idx`).map(String))]) {
    const n = out.length + 1; const o = {};
    for (const [c, rot, tipo, opc] of campos) {
      const nome = `${prefixo}${i}_${c}`;
      o[c] = tipo === 'data' ? data(fd, nome, `${rot} (${n})`) : tipo === 'opcao' ? opcao(fd, nome, `${rot} (${n})`, opc) : texto(fd, nome, `${rot} (${n})`, 300);
    }
    out.push(o);
  }
  if (out.length !== qtd) falha(`Você informou ${qtd} feedback(s): registre cada um na lista.`);
  return out;
};

export function lerGerenteIndicacao(fd, campanhasValidas) {
  const campanhas = [...new Set(fd.getAll('campanhas').map(Number))].filter((id) => campanhasValidas.includes(id));
  if (!campanhas.length) falha('Escolha pelo menos uma campanha trabalhada.');
  const d = {
    campanhas,
    produto_principal: texto(fd, 'produto_principal', 'Produto ou curso principal', 150),
    equipe_envolvida: texto(fd, 'equipe_envolvida', 'Equipe envolvida', 200),
    meta_indicacoes: inteiro(fd, 'meta_indicacoes', 'Meta diária de indicações'),
    meta_vendas: inteiro(fd, 'meta_vendas', 'Meta diária de vendas'),
    situacao_campanha: opcao(fd, 'situacao_campanha', 'Situação da campanha', Object.keys(STATUS_CAMPANHA)),
    convites_conferidos: simNao(fd, 'convites_conferidos', 'Os números de convites estão corretos?'),
    classificacao_convites: opcao(fd, 'classificacao_convites', 'Classificação da participação', Object.keys(CLASSIFICACAO)),
    motivo_invalidacao: texto(fd, 'motivo_invalidacao', 'Principal motivo de invalidação', 300),
    problema_qualidade: texto(fd, 'problema_qualidade', 'Problema de qualidade identificado', 300),
    acao_qualidade: texto(fd, 'acao_qualidade', 'Ação para melhorar a qualidade', 300),
    problema_privacidade: simNao(fd, 'problema_privacidade', 'Houve problema de abordagem ou privacidade?'),
    acao_privacidade: texto(fd, 'acao_privacidade', 'Ação tomada', 300),
    ajuste_mensagem: texto(fd, 'ajuste_mensagem', 'Ajuste na mensagem ou processo', 300),
    problema_atendimento: texto(fd, 'problema_atendimento', 'Principal problema de atendimento', 300),
    qtd_priorizar: inteiro(fd, 'qtd_priorizar', 'Quantidade a priorizar'),
    acao_recuperacao: texto(fd, 'acao_recuperacao', 'Ação de recuperação', 300),
    vendas_corretas: simNao(fd, 'vendas_corretas', 'Os números de vendas estão corretos?'),
    etapa_maior_quebra: opcao(fd, 'etapa_maior_quebra', 'Etapa com maior quebra', Object.keys(ETAPAS_QUEBRA)),
    motivo_quebra: texto(fd, 'motivo_quebra', 'Motivo provável da quebra', 300),
    acao_conversao: texto(fd, 'acao_conversao', 'Ação para melhorar a conversão', 300),
    feedbacks_qtd: inteiro(fd, 'feedbacks_qtd', 'Quantidade de feedbacks'),
    reconhecimento: texto(fd, 'reconhecimento', 'Reconhecimento do destaque', 300),
    acao_acompanhamento: texto(fd, 'acao_acompanhamento', 'Ação de acompanhamento', 300),
    redistribuicao: texto(fd, 'redistribuicao', 'Redistribuição necessária', 300),
    beneficios_atrasados: simNao(fd, 'beneficios_atrasados', 'Existem benefícios atrasados?'),
    beneficio_excepcional: simNao(fd, 'beneficio_excepcional', 'Houve benefício excepcional?'),
    reuniao_realizada: simNao(fd, 'reuniao_realizada', 'Houve reunião diária?'),
    objecoes: [1, 2, 3].map((n) => texto(fd, `objecao_${n}`, `Objeção ${n}`, 150)),
    gargalo: opcao(fd, 'gargalo', 'Principal gargalo', Object.keys(GARGALOS_INDICACAO)),
    etapa_afetada: opcao(fd, 'etapa_afetada', 'Etapa afetada', Object.keys(ETAPAS_QUEBRA)),
    acao: texto(fd, 'acao', 'Ação corretiva', 300),
    prazo: data(fd, 'prazo', 'Prazo'),
    prioridade: opcao(fd, 'prioridade', 'Prioridade', ['baixa', 'media', 'alta', 'critica']),
  };
  const resp = lerNumero(fd.get('responsavel_id'));
  if (!resp) falha('Escolha o responsável pela ação.');
  d.responsavel_id = resp;
  d.convites_divergencia = d.convites_conferidos ? null : texto(fd, 'convites_divergencia', 'Divergência nos convites', 300);
  if (['abaixo', 'critico'].includes(d.classificacao_convites)) { d.causa_convites = texto(fd, 'causa_convites', 'Causa', 300); d.acao_convites = texto(fd, 'acao_convites', 'Ação', 300); }
  else { d.causa_convites = null; d.acao_convites = null; }
  if (!d.vendas_corretas) {
    d.vendas_divergencia = texto(fd, 'vendas_divergencia', 'Divergência nas vendas', 300); d.vendas_origem = texto(fd, 'vendas_origem', 'Origem da divergência', 150); d.vendas_acao = texto(fd, 'vendas_acao', 'Ação corretiva', 300);
  } else { d.vendas_divergencia = null; d.vendas_origem = null; d.vendas_acao = null; }
  d.feedbacks = d.feedbacks_qtd > 0 ? linhas(fd, 'fb', d.feedbacks_qtd, [['colaborador', 'Colaborador'], ['tipo', 'Tipo', 'opcao', Object.keys(TIPOS_FEEDBACK)], ['tema', 'Tema'], ['acao', 'Ação'], ['prazo', 'Prazo', 'data']]) : null;
  if (d.beneficios_atrasados) { d.pendencia_beneficio = texto(fd, 'pendencia_beneficio', 'Principal pendência', 300); d.responsavel_beneficio = texto(fd, 'responsavel_beneficio', 'Responsável', 150); d.prazo_beneficio = data(fd, 'prazo_beneficio', 'Prazo do benefício'); }
  else { d.pendencia_beneficio = null; d.responsavel_beneficio = null; d.prazo_beneficio = null; }
  if (d.beneficio_excepcional) { d.justificativa_excepcional = texto(fd, 'justificativa_excepcional', 'Justificativa do benefício excepcional', 300); d.aprovacao_excepcional = texto(fd, 'aprovacao_excepcional', 'Quem aprovou', 150); }
  else { d.justificativa_excepcional = null; d.aprovacao_excepcional = null; }
  if (d.reuniao_realizada) { d.reuniao_tema = texto(fd, 'reuniao_tema', 'Tema da reunião', 200); d.reuniao_assuntos = texto(fd, 'reuniao_assuntos', 'Assuntos abordados', 400); d.reuniao_motivo = null; d.reuniao_compensacao = null; }
  else { d.reuniao_tema = null; d.reuniao_assuntos = null; d.reuniao_motivo = texto(fd, 'reuniao_motivo', 'Motivo de não ter havido reunião', 300); d.reuniao_compensacao = texto(fd, 'reuniao_compensacao', 'Ação de compensação', 300); }
  return d;
}

// ---------- Formulário diário do colaborador de indicação (10 campos) ----------
import { ORIGENS, PAGAMENTOS, STATUS_VENDA, OBJECOES, MOTIVOS_INVALIDA, MOTIVOS_PERDA } from './indicacao.js';

// ctx = { hoje, janelaDias, produtos: number[] }
export function lerDiarioIndicacao(fd, ctx) {
  const dataRef = data(fd, 'data_ref', 'Data do registro');
  const min = new Date(`${ctx.hoje}T12:00:00Z`); min.setUTCDate(min.getUTCDate() - ctx.janelaDias);
  if (dataRef > ctx.hoje) falha('A data do registro não pode ser no futuro.');
  if (dataRef < min.toISOString().slice(0, 10)) falha(`Só é possível registrar até ${ctx.janelaDias} dias atrás. Para datas mais antigas, fale com o gerente.`);
  const d = {
    data_ref: dataRef,
    origens: [...new Set(fd.getAll('origens').map(String))].filter((o) => ORIGENS[o]),
    recebidas: inteiro(fd, 'recebidas', 'Indicações novas recebidas'),
    trabalhados: inteiro(fd, 'trabalhados', 'Indicados trabalhados'),
    responderam: inteiro(fd, 'responderam', 'Indicados que responderam'),
    validadas: inteiro(fd, 'validadas', 'Indicações validadas'),
    followups: inteiro(fd, 'followups', 'Follow-ups realizados'),
    encaminhadas: inteiro(fd, 'encaminhadas', 'Oportunidades encaminhadas ao comercial'),
    vendas_qtd: inteiro(fd, 'vendas_qtd', 'Quantidade de vendas confirmadas'),
  };
  if (!d.origens.length) falha('Escolha pelo menos uma origem das indicações trabalhadas.');
  d.origem_outra = d.origens.includes('outra') ? texto(fd, 'origem_outra', 'Descrição da outra origem', 150) : null;
  d.justificativa_data = dataRef !== ctx.hoje ? texto(fd, 'justificativa_data', 'Justificativa do registro em outra data', 300) : null;

  // Coerência dos números: exige justificativa quando algo não bate
  const problemas = [];
  if (d.responderam > d.trabalhados) problemas.push('mais respostas do que indicados trabalhados');
  if (d.validadas > d.responderam) problemas.push('mais validadas do que respostas');
  if (d.encaminhadas > d.validadas) problemas.push('mais encaminhadas do que validadas');
  d.justificativa_numeros = problemas.length ? texto(fd, 'justificativa_numeros', `Justificativa (${problemas.join(', ')})`, 300) : null;

  // Campo 10: vendas (linhas quando houver venda)
  const vendas = [];
  if (d.vendas_qtd > 0) {
    for (const i of [...new Set(fd.getAll('vd_idx').map(String))]) {
      const n = vendas.length + 1;
      const produto = lerNumero(fd.get(`vd${i}_produto`));
      if (!produto || !ctx.produtos.includes(produto)) falha(`Venda ${n}: escolha o curso.`);
      const valor = decimal(fd, `vd${i}_valor`, `Venda ${n}: valor`);
      if (valor <= 0) falha(`Venda ${n}: o valor precisa ser maior que zero.`);
      vendas.push({
        indicador: texto(fd, `vd${i}_indicador`, `Venda ${n}: aluno indicador`, 150),
        indicado: texto(fd, `vd${i}_indicado`, `Venda ${n}: cliente indicado`, 150),
        vendedor: texto(fd, `vd${i}_vendedor`, `Venda ${n}: vendedor responsável`, 150),
        produto, valor,
        pagamento: opcao(fd, `vd${i}_pagamento`, `Venda ${n}: forma de pagamento`, Object.keys(PAGAMENTOS)),
        status: opcao(fd, `vd${i}_status`, `Venda ${n}: status do pagamento`, Object.keys(STATUS_VENDA)),
      });
    }
    if (vendas.length !== d.vendas_qtd) falha(`Você informou ${d.vendas_qtd} venda(s): preencha cada uma.`);
  }
  d.vendas = vendas.length ? vendas : null;
  // Valor total vem da soma das linhas; cancelada não conta como receita
  d.vendas_valor = Math.round(vendas.filter((v) => v.status !== 'cancelada').reduce((s, v) => s + v.valor, 0) * 100) / 100;

  // Complementos opcionais (obrigatórios só quando marcados)
  const opc = (nome, lista) => { const v = String(fd.get(nome) || ''); return v && lista[v] ? v : null; };
  d.objecao = opc('objecao', OBJECOES);
  d.motivo_invalidas = opc('motivo_invalidas', MOTIVOS_INVALIDA);
  d.motivo_perda = opc('motivo_perda', MOTIVOS_PERDA);
  d.gargalo = String(fd.get('gargalo') || '').trim().slice(0, 300) || null;
  d.precisa_ajuda = fd.get('precisa_ajuda') === 'sim';
  d.ajuda_descricao = d.precisa_ajuda ? texto(fd, 'ajuda_descricao', 'Em que você precisa de ajuda do gerente', 300) : null;
  d.observacao = String(fd.get('observacao') || '').trim().slice(0, 300) || null;
  return d;
}
