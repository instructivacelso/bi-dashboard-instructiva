import { q, q1 } from './db.js';
import { funilIndicacao, maiorQuebra } from './indicacao.js';
import { dividir } from './calc.js';

const TZ = `'America/Sao_Paulo'`;
const INI = (p) => `(${p}::date)::timestamp AT TIME ZONE ${TZ}`;
const FIM = (p) => `((${p}::date + 1))::timestamp AT TIME ZONE ${TZ}`;
const entre = (col, a = '$1', b = '$2') => `${col} >= ${INI(a)} AND ${col} < ${FIM(b)}`;

export const campanhasAtivas = () => q(`SELECT c.*, p.nome produto FROM referral_campaigns c LEFT JOIN products p ON p.id=c.product_id WHERE c.status='ativa' ORDER BY c.nome`);
export const todasCampanhas = () => q(`SELECT c.*, p.nome produto FROM referral_campaigns c LEFT JOIN products p ON p.id=c.product_id ORDER BY c.status, c.nome`);

export async function vendedoresIndicacao() {
  return q(`SELECT DISTINCT x.id, x.nome FROM users x JOIN user_department_assignments a ON a.user_id=x.id
              JOIN departments d ON d.id=a.department_id LEFT JOIN subdepartments s ON s.id=a.subdepartment_id
             WHERE x.ativo AND d.slug='indicacoes' AND (s.slug='vendas' OR a.gerente) ORDER BY x.nome`);
}

// Números consolidados do pipeline num período (desde..ate, datas ISO); userId opcional (colaborador)
export async function numerosIndicacao(desde, ate, userId = null) {
  const p = userId ? [desde, ate, userId] : [desde, ate];
  const doResp = userId ? 'AND r.responsavel_id=$3' : '';
  const evR = (evento) => q1(`SELECT COUNT(DISTINCT e.referral_id)::int n FROM referral_events e JOIN referrals r ON r.id=e.referral_id WHERE e.evento='${evento}' AND ${entre('e.created_at')} ${doResp}`, p);
  const cfg = await q(`SELECT chave, valor FROM configuracoes WHERE chave IN ('indicacao_prazo_primeiro_contato_h','indicacao_dias_parada')`);
  const prazoH = Number(cfg.find((c) => c.chave === 'indicacao_prazo_primeiro_contato_h')?.valor || 24);
  const diasParada = Number(cfg.find((c) => c.chave === 'indicacao_dias_parada')?.valor || 3);
  const [conv, rec, aviso, trabalhados, responderam, validadas, interesse, encaminhadas, negociacao, followups, tempo, semContato, paradas, semVendedor, vendas, porProduto, porVendedor, porOrigem, benef, indicadores] = await Promise.all([
    q1(`SELECT COUNT(*)::int convidados, COUNT(*) FILTER (WHERE resposta='aceitou')::int aceitaram, COUNT(*) FILTER (WHERE resposta='recusou')::int recusaram,
               COUNT(*) FILTER (WHERE resposta='sem_resposta')::int sem_resposta FROM referral_invitations WHERE ${entre('convidado_em')} ${userId ? 'AND created_by=$3' : ''}`, p),
    q1(`SELECT COUNT(*)::int recebidas, COUNT(*) FILTER (WHERE validacao='valida')::int validas, COUNT(*) FILTER (WHERE validacao='invalida' OR etapa='invalida')::int invalidas,
               COUNT(*) FILTER (WHERE validacao='duplicada')::int duplicadas, COUNT(*) FILTER (WHERE validacao='telefone_incorreto')::int tel_incorreto,
               COUNT(*) FILTER (WHERE validacao='fora_perfil')::int fora_perfil, COUNT(*) FILTER (WHERE etapa IN ('recebida','aguardando_contato','tentativa'))::int pendentes,
               COUNT(*) FILTER (WHERE etapa='sem_resposta')::int sem_resposta_etapa
          FROM referrals r WHERE ${entre('r.created_at')} ${doResp}`, p),
    q1(`SELECT COUNT(*) FILTER (WHERE aviso='avisado')::int avisados, COUNT(*) FILTER (WHERE aviso='nao_confirmado')::int nao_confirmados,
               COUNT(*) FILTER (WHERE aviso='autorizado')::int autorizados, COUNT(*) FILTER (WHERE aviso='bloqueado')::int bloqueados, COUNT(*)::int total
          FROM referrals r WHERE ${entre('r.created_at')} ${doResp}`, p),
    evR('tentativa'), evR('contato_realizado'), evR('validada'), evR('interesse'), evR('encaminhada'), evR('negociacao'),
    q1(`SELECT COUNT(*)::int n FROM referral_events e JOIN referrals r ON r.id=e.referral_id WHERE e.evento='followup' AND ${entre('e.created_at')} ${doResp}`, p),
    q1(`SELECT AVG(EXTRACT(EPOCH FROM (primeiro_contato_em - created_at))/60) m,
               AVG(EXTRACT(EPOCH FROM (distribuido_em - created_at))/60) FILTER (WHERE distribuido_em IS NOT NULL) enc,
               AVG(EXTRACT(EPOCH FROM (venda_em - created_at))/60) FILTER (WHERE venda_em IS NOT NULL) venda
          FROM referrals r WHERE primeiro_contato_em IS NOT NULL AND ${entre('r.primeiro_contato_em')} ${doResp}`, p),
    q1(`SELECT COUNT(*)::int n FROM referrals r WHERE etapa IN ('recebida','aguardando_contato') AND created_at < now() - ($1::int * interval '1 hour') ${userId ? 'AND r.responsavel_id=$2' : ''}`, userId ? [prazoH, userId] : [prazoH]),
    q1(`SELECT COUNT(*)::int n FROM referrals r WHERE etapa NOT IN ('venda','sem_interesse','invalida','perdida') AND updated_at < now() - ($1::int * interval '1 day') ${userId ? 'AND r.responsavel_id=$2' : ''}`, userId ? [diasParada, userId] : [diasParada]),
    q1(`SELECT COUNT(*)::int n FROM referrals r WHERE etapa IN ('encaminhada','negociacao') AND vendedor_id IS NULL ${userId ? 'AND r.responsavel_id=$1' : ''}`, userId ? [userId] : []),
    q1(`SELECT COUNT(*) FILTER (WHERE venda_status <> 'cancelada')::int vendas, COALESCE(SUM(venda_valor) FILTER (WHERE venda_status <> 'cancelada'),0) faturamento,
               COALESCE(SUM(venda_valor) FILTER (WHERE venda_status IN ('aprovada','pago')),0) aprovado,
               COALESCE(SUM(venda_valor) FILTER (WHERE venda_pagamento='cartao' AND venda_status <> 'cancelada'),0) cartao,
               COALESCE(SUM(venda_valor) FILTER (WHERE venda_pagamento='pix' AND venda_status <> 'cancelada'),0) pix,
               COALESCE(SUM(venda_valor) FILTER (WHERE venda_pagamento='boleto' AND venda_status <> 'cancelada'),0) boleto,
               COALESCE(SUM(venda_valor) FILTER (WHERE venda_status='pago' OR (venda_status='aprovada' AND venda_pagamento NOT IN ('boleto'))),0) recebido,
               COALESCE(SUM(venda_valor) FILTER (WHERE venda_status IN ('boleto_gerado','aguardando')),0) pendente,
               COUNT(*) FILTER (WHERE venda_status='cancelada')::int canceladas
          FROM referrals r WHERE etapa='venda' AND ${entre('r.venda_em')} ${doResp}`, p),
    q(`SELECT COALESCE(pr.nome,'Sem curso') chave, COUNT(*)::int n, SUM(r.venda_valor) total FROM referrals r LEFT JOIN products pr ON pr.id=r.venda_product_id
        WHERE r.etapa='venda' AND r.venda_status <> 'cancelada' AND ${entre('r.venda_em')} ${doResp} GROUP BY 1 ORDER BY total DESC`, p),
    q(`SELECT x.id, x.nome,
              COUNT(r.id)::int recebidas,
              COUNT(r.id) FILTER (WHERE r.primeiro_contato_em IS NOT NULL)::int trabalhadas,
              COALESCE(SUM(r.tentativas),0)::int tentativas,
              COUNT(r.id) FILTER (WHERE r.etapa IN ('encaminhada','negociacao','venda'))::int encaminhadas,
              COUNT(r.id) FILTER (WHERE r.etapa='venda' AND r.venda_status <> 'cancelada')::int vendas,
              COALESCE(SUM(r.venda_valor) FILTER (WHERE r.etapa='venda' AND r.venda_status <> 'cancelada'),0) faturamento,
              COUNT(r.id) FILTER (WHERE r.etapa NOT IN ('venda','sem_interesse','invalida','perdida'))::int pendentes,
              AVG(EXTRACT(EPOCH FROM (r.primeiro_contato_em - r.created_at))/60) tempo_contato
         FROM users x JOIN referrals r ON r.responsavel_id=x.id AND ${entre('r.created_at')}
        GROUP BY x.id, x.nome ORDER BY faturamento DESC`, [desde, ate]),
    q(`SELECT COALESCE(origem_indicacao,'nao_informada') chave, COUNT(*)::int n, COUNT(*) FILTER (WHERE etapa='venda')::int vendas FROM referrals r WHERE ${entre('r.created_at')} ${doResp} GROUP BY 1 ORDER BY n DESC`, p),
    q1(`SELECT COUNT(*) FILTER (WHERE status='pendente')::int pendentes, COUNT(*) FILTER (WHERE status='aprovado')::int aprovados,
               COUNT(*) FILTER (WHERE status='entregue')::int entregues, COUNT(*) FILTER (WHERE status IN ('pendente','aprovado') AND created_at < now() - interval '7 days')::int atrasados,
               COALESCE(SUM(valor) FILTER (WHERE (tipo='cashback' OR escolha='cashback') AND status IN ('pendente','aprovado')),0) cashback_pendente,
               COALESCE(SUM(valor) FILTER (WHERE (tipo='cashback' OR escolha='cashback') AND status='entregue'),0) cashback_pago,
               COUNT(numero_sorteio)::int sorteios, COUNT(*) FILTER (WHERE escolha IS NULL AND status <> 'cancelado')::int sem_escolha,
               COALESCE(SUM(valor) FILTER (WHERE status <> 'cancelado'),0) custo, COUNT(DISTINCT referrer_id)::int alunos_cinco
          FROM referral_benefits WHERE ${entre('created_at')}`, [desde, ate]),
    q1(`SELECT COUNT(DISTINCT referrer_id)::int ativos, COUNT(*)::int indicacoes FROM referrals r WHERE ${entre('r.created_at')} ${doResp}`, p),
  ]);
  const n = (x) => Number(x || 0);
  const t = {
    ...conv, ...rec, ...aviso,
    trabalhados: trabalhados.n, responderam: responderam.n, validadas: validadas.n, interesse: interesse.n, encaminhadas: encaminhadas.n, negociacao: negociacao.n,
    followups: followups.n, contatadas: responderam.n,
    tempoPrimeiroContato: tempo.m ? n(tempo.m) : null, tempoAteEncaminhar: tempo.enc ? n(tempo.enc) : null, tempoAteVenda: tempo.venda ? n(tempo.venda) : null,
    semContato: semContato.n, paradas: paradas.n, semVendedor: semVendedor.n,
    vendas: vendas.vendas, faturamento: n(vendas.faturamento), aprovado: n(vendas.aprovado), cartao: n(vendas.cartao), pix: n(vendas.pix), boleto: n(vendas.boleto),
    recebido: n(vendas.recebido), pendenteRecebimento: n(vendas.pendente), canceladas: vendas.canceladas, ticketMedio: dividir(n(vendas.faturamento), vendas.vendas),
    beneficiosPendentes: benef.pendentes, beneficiosAprovados: benef.aprovados, beneficiosEntregues: benef.entregues, beneficiosAtrasados: benef.atrasados,
    beneficiosSemEscolha: benef.sem_escolha, alunosCinco: benef.alunos_cinco,
    cashbackPendente: n(benef.cashback_pendente), cashbackPago: n(benef.cashback_pago), sorteios: benef.sorteios, custo: n(benef.custo),
    indicadoresAtivos: indicadores.ativos, indicacoesPorAluno: dividir(indicadores.indicacoes, indicadores.ativos),
    porProduto, porOrigem,
    porVendedor: porVendedor.map((v) => ({ ...v, faturamento: n(v.faturamento), conversao: dividir(v.vendas, v.encaminhadas), tempo_contato: v.tempo_contato ? n(v.tempo_contato) : null })),
  };
  t.taxaAdesao = dividir(t.aceitaram, t.convidados);
  t.taxaAviso = dividir(t.avisados + t.autorizados, t.total);
  t.pctInvalidas = dividir(t.invalidas + t.duplicadas + t.tel_incorreto, t.recebidas);
  t.pctSemResposta = dividir(t.sem_resposta_etapa, t.recebidas);
  t.funil = funilIndicacao(t);
  t.maiorQuebra = maiorQuebra(t.funil);
  return t;
}

// Soma dos formulários diários dos colaboradores (período e, opcionalmente, um colaborador)
export async function consolidarDiarios(desde, ate, userId = null) {
  const p = userId ? [desde, ate, userId] : [desde, ate];
  const linhas = await q(
    `SELECT f.*, x.nome FROM referral_daily_forms f JOIN users x ON x.id=f.user_id WHERE f.data_ref BETWEEN $1 AND $2 ${userId ? 'AND f.user_id=$3' : ''} ORDER BY x.nome, f.data_ref`, p);
  const campos = ['recebidas', 'trabalhados', 'responderam', 'validadas', 'followups', 'encaminhadas', 'vendas_qtd'];
  const soma = (ls) => {
    const t = Object.fromEntries(campos.map((c) => [c, ls.reduce((s, l) => s + (l[c] || 0), 0)]));
    t.vendas_valor = ls.reduce((s, l) => s + Number(l.vendas_valor || 0), 0);
    t.funil = funilIndicacao({ trabalhados: t.trabalhados, responderam: t.responderam, validadas: t.validadas, encaminhadas: t.encaminhadas, vendas: t.vendas_qtd, recebidas: t.recebidas, faturamento: t.vendas_valor, followups: t.followups });
    return t;
  };
  const porPessoa = {};
  for (const l of linhas) (porPessoa[l.user_id] ||= { id: l.user_id, nome: l.nome, linhas: [] }).linhas.push(l);
  const pessoas = Object.values(porPessoa).map((x) => ({ ...x, dias: x.linhas.length, ...soma(x.linhas) }));
  return { total: soma(linhas), pessoas, linhas };
}

// Alertas do pipeline (para um colaborador ou para a equipe)
export async function alertasIndicacao(userId = null) {
  const f = userId ? 'AND r.responsavel_id=$1' : '';
  const p = userId ? [userId] : [];
  const [vencidos, proximos] = await Promise.all([
    q(`SELECT r.id, r.nome, r.proximo_contato, r.etapa FROM referrals r WHERE r.proximo_contato < CURRENT_DATE AND r.etapa NOT IN ('venda','sem_interesse','invalida','perdida') ${f} ORDER BY r.proximo_contato LIMIT 20`, p),
    q(`SELECT r.id, r.nome, r.proximo_contato, r.etapa FROM referrals r WHERE r.proximo_contato BETWEEN CURRENT_DATE AND CURRENT_DATE + 3 AND r.etapa NOT IN ('venda','sem_interesse','invalida','perdida') ${f} ORDER BY r.proximo_contato LIMIT 20`, p),
  ]);
  return { followupsVencidos: vencidos, proximosFollowups: proximos };
}

// Alunos que mais indicam (período)
export async function topIndicadores(desde, ate) {
  return q(
    `SELECT s.id, s.nome, COUNT(r.id)::int indicacoes, COUNT(r.id) FILTER (WHERE r.validacao='valida')::int validas,
            COUNT(r.id) FILTER (WHERE r.etapa='venda')::int vendas, COALESCE(SUM(r.venda_valor) FILTER (WHERE r.etapa='venda'),0) receita
       FROM referrals r JOIN students s ON s.id=r.referrer_id WHERE ${entre('r.created_at')}
      GROUP BY s.id, s.nome ORDER BY vendas DESC, validas DESC LIMIT 10`, [desde, ate]);
}

export async function listaIndicacoes(u, veTudo, f = {}) {
  const cond = []; const p = [];
  if (!veTudo) { p.push(u.id); cond.push(`(r.vendedor_id=$${p.length} OR r.responsavel_id=$${p.length} OR r.created_by=$${p.length})`); }
  if (f.etapa) { p.push(f.etapa); cond.push(`r.etapa=$${p.length}`); }
  if (f.validacao) { p.push(f.validacao); cond.push(`r.validacao=$${p.length}`); }
  if (f.vendedor) { p.push(f.vendedor); cond.push(`r.vendedor_id=$${p.length}`); }
  if (f.busca) { p.push(`%${f.busca}%`); cond.push(`(r.nome ILIKE $${p.length} OR r.telefone ILIKE $${p.length} OR s.nome ILIKE $${p.length})`); }
  return q(
    `SELECT r.*, s.nome indicador, c.nome campanha, v.nome vendedor, pr.nome interesse, rp.nome responsavel FROM referrals r
       JOIN students s ON s.id=r.referrer_id JOIN referral_campaigns c ON c.id=r.campaign_id
       LEFT JOIN users v ON v.id=r.vendedor_id LEFT JOIN products pr ON pr.id=r.interesse_product_id LEFT JOIN users rp ON rp.id=r.responsavel_id
      ${cond.length ? 'WHERE ' + cond.join(' AND ') : ''} ORDER BY r.created_at DESC LIMIT 500`, p);
}
