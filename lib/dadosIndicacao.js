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

// Números consolidados de um período (desde..ate, datas ISO)
export async function numerosIndicacao(desde, ate) {
  const p = [desde, ate];
  const ev = (evento) => q1(`SELECT COUNT(DISTINCT referral_id)::int n FROM referral_events WHERE evento='${evento}' AND ${entre('created_at')}`, p);
  const [conv, rec, aviso, dist, contatadas, tempo, tentativas, responderam, conversas, agend, propostas, semContato, paradas, vendas, porProduto, porVendedor, benef, indicadores] = await Promise.all([
    q1(`SELECT COUNT(*)::int convidados, COUNT(*) FILTER (WHERE resposta='aceitou')::int aceitaram, COUNT(*) FILTER (WHERE resposta='recusou')::int recusaram,
               COUNT(*) FILTER (WHERE resposta='sem_resposta')::int sem_resposta FROM referral_invitations WHERE ${entre('convidado_em')}`, p),
    q1(`SELECT COUNT(*)::int recebidas, COUNT(*) FILTER (WHERE validacao='valida')::int validas, COUNT(*) FILTER (WHERE validacao='invalida')::int invalidas,
               COUNT(*) FILTER (WHERE validacao='duplicada')::int duplicadas, COUNT(*) FILTER (WHERE validacao='telefone_incorreto')::int tel_incorreto,
               COUNT(*) FILTER (WHERE validacao='fora_perfil')::int fora_perfil, COUNT(*) FILTER (WHERE validacao='pendente')::int pendentes
          FROM referrals WHERE ${entre('created_at')}`, p),
    q1(`SELECT COUNT(*) FILTER (WHERE aviso='avisado')::int avisados, COUNT(*) FILTER (WHERE aviso='nao_confirmado')::int nao_confirmados,
               COUNT(*) FILTER (WHERE aviso='autorizado')::int autorizados, COUNT(*) FILTER (WHERE aviso='bloqueado')::int bloqueados, COUNT(*)::int total
          FROM referrals WHERE ${entre('created_at')}`, p),
    q1(`SELECT COUNT(*)::int n FROM referrals WHERE distribuido_em IS NOT NULL AND ${entre('distribuido_em')}`, p),
    ev('contato'),
    q1(`SELECT AVG(EXTRACT(EPOCH FROM (primeiro_contato_em - COALESCE(distribuido_em, validado_em, created_at)))/60) m FROM referrals WHERE primeiro_contato_em IS NOT NULL AND ${entre('primeiro_contato_em')}`, p),
    q1(`SELECT COUNT(*)::int n FROM referral_events WHERE evento='tentativa' AND ${entre('created_at')}`, p),
    ev('resposta'), ev('conversa'), ev('agendado'), ev('proposta'),
    q1(`SELECT COUNT(*)::int n FROM referrals WHERE validacao='valida' AND primeiro_contato_em IS NULL AND etapa NOT IN ('perdida','sem_interesse')`),
    q1(`SELECT COUNT(*)::int n FROM referrals WHERE validacao='valida' AND etapa NOT IN ('venda','perdida','sem_interesse') AND updated_at < now() - interval '3 days'`),
    q1(`SELECT COUNT(*)::int vendas, COALESCE(SUM(venda_valor),0) faturamento,
               COALESCE(SUM(venda_valor) FILTER (WHERE venda_status IN ('aprovada','pago')),0) aprovado,
               COALESCE(SUM(venda_valor) FILTER (WHERE venda_pagamento='cartao'),0) cartao, COALESCE(SUM(venda_valor) FILTER (WHERE venda_pagamento='pix'),0) pix,
               COALESCE(SUM(venda_valor) FILTER (WHERE venda_pagamento='boleto'),0) boleto,
               COALESCE(SUM(venda_valor) FILTER (WHERE venda_status='pago' OR (venda_status='aprovada' AND venda_pagamento<>'boleto')),0) recebido
          FROM referrals WHERE etapa='venda' AND ${entre('venda_em')}`, p),
    q(`SELECT COALESCE(pr.nome,'Sem curso') chave, COUNT(*)::int n, SUM(r.venda_valor) total FROM referrals r LEFT JOIN products pr ON pr.id=r.venda_product_id
        WHERE r.etapa='venda' AND ${entre('r.venda_em')} GROUP BY 1 ORDER BY total DESC`, p),
    q(`SELECT x.id, x.nome,
              COUNT(r.id) FILTER (WHERE r.distribuido_em IS NOT NULL)::int recebidas,
              COUNT(r.id) FILTER (WHERE r.primeiro_contato_em IS NOT NULL)::int trabalhadas,
              COALESCE(SUM(r.tentativas),0)::int tentativas,
              COUNT(r.id) FILTER (WHERE r.etapa IN ('respondeu','conversa','agendado','proposta','venda'))::int respostas,
              COUNT(r.id) FILTER (WHERE r.etapa IN ('agendado','proposta','venda'))::int agendamentos,
              COUNT(r.id) FILTER (WHERE r.etapa IN ('proposta','venda'))::int propostas,
              COUNT(r.id) FILTER (WHERE r.etapa='venda')::int vendas, COALESCE(SUM(r.venda_valor) FILTER (WHERE r.etapa='venda'),0) faturamento,
              COUNT(r.id) FILTER (WHERE r.etapa NOT IN ('venda','perdida','sem_interesse'))::int pendentes,
              AVG(EXTRACT(EPOCH FROM (r.primeiro_contato_em - r.distribuido_em))/60) tempo_contato
         FROM users x JOIN referrals r ON r.vendedor_id=x.id AND ${entre('r.distribuido_em')}
        GROUP BY x.id, x.nome ORDER BY faturamento DESC`, p),
    q1(`SELECT COUNT(*) FILTER (WHERE status='pendente')::int pendentes, COUNT(*) FILTER (WHERE status='aprovado')::int aprovados,
               COUNT(*) FILTER (WHERE status='entregue')::int entregues, COUNT(*) FILTER (WHERE status IN ('pendente','aprovado') AND created_at < now() - interval '7 days')::int atrasados,
               COALESCE(SUM(valor) FILTER (WHERE tipo='cashback' AND status IN ('pendente','aprovado')),0) cashback_pendente,
               COALESCE(SUM(valor) FILTER (WHERE tipo='cashback' AND status='entregue'),0) cashback_pago,
               COUNT(numero_sorteio)::int sorteios, COALESCE(SUM(valor) FILTER (WHERE status <> 'cancelado'),0) custo
          FROM referral_benefits WHERE ${entre('created_at')}`, p),
    q1(`SELECT COUNT(DISTINCT referrer_id)::int ativos, COUNT(*)::int indicacoes FROM referrals WHERE ${entre('created_at')}`, p),
  ]);
  const t = {
    ...conv, ...rec, ...aviso, distribuidas: dist.n, contatadas: contatadas.n, tempoPrimeiroContato: tempo.m ? Number(tempo.m) : null,
    tentativas: tentativas.n, responderam: responderam.n, conversas: conversas.n, agendamentos: agend.n, propostas: propostas.n,
    semContato: semContato.n, paradas: paradas.n,
    vendas: vendas.vendas, faturamento: Number(vendas.faturamento), aprovado: Number(vendas.aprovado), cartao: Number(vendas.cartao), pix: Number(vendas.pix),
    boleto: Number(vendas.boleto), recebido: Number(vendas.recebido), ticketMedio: dividir(Number(vendas.faturamento), vendas.vendas),
    beneficiosPendentes: benef.pendentes, beneficiosAprovados: benef.aprovados, beneficiosEntregues: benef.entregues, beneficiosAtrasados: benef.atrasados,
    cashbackPendente: Number(benef.cashback_pendente), cashbackPago: Number(benef.cashback_pago), sorteios: benef.sorteios, custo: Number(benef.custo),
    indicadoresAtivos: indicadores.ativos, indicacoesPorAluno: dividir(indicadores.indicacoes, indicadores.ativos),
    porProduto, porVendedor: porVendedor.map((v) => ({ ...v, faturamento: Number(v.faturamento), conversao: dividir(v.vendas, v.trabalhadas), tempo_contato: v.tempo_contato ? Number(v.tempo_contato) : null })),
  };
  t.taxaAdesao = dividir(t.aceitaram, t.convidados);
  t.taxaAviso = dividir(t.avisados + t.autorizados, t.total);
  t.funil = funilIndicacao(t);
  t.maiorQuebra = maiorQuebra(t.funil);
  return t;
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
  if (!veTudo) { p.push(u.id); cond.push(`(r.vendedor_id=$${p.length} OR r.created_by=$${p.length})`); }
  if (f.etapa) { p.push(f.etapa); cond.push(`r.etapa=$${p.length}`); }
  if (f.validacao) { p.push(f.validacao); cond.push(`r.validacao=$${p.length}`); }
  if (f.vendedor) { p.push(f.vendedor); cond.push(`r.vendedor_id=$${p.length}`); }
  if (f.busca) { p.push(`%${f.busca}%`); cond.push(`(r.nome ILIKE $${p.length} OR r.telefone ILIKE $${p.length} OR s.nome ILIKE $${p.length})`); }
  return q(
    `SELECT r.*, s.nome indicador, c.nome campanha, v.nome vendedor, pr.nome interesse FROM referrals r
       JOIN students s ON s.id=r.referrer_id JOIN referral_campaigns c ON c.id=r.campaign_id
       LEFT JOIN users v ON v.id=r.vendedor_id LEFT JOIN products pr ON pr.id=r.interesse_product_id
      ${cond.length ? 'WHERE ' + cond.join(' AND ') : ''} ORDER BY r.created_at DESC LIMIT 300`, p);
}
