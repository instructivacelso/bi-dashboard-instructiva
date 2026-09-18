import { exigirUsuario } from '@/lib/auth.js';
import { q1 } from '@/lib/db.js';
import { hoje, somarDias, fmtData } from '@/lib/datas.js';
import { numero, pct, moeda } from '@/lib/formato.js';
import { dividir, semaforo } from '@/lib/calc.js';
import { ETAPAS, ehColaboradorIndicacao, veTodaIndicacao } from '@/lib/indicacao.js';
import { consolidarDiarios, numerosIndicacao, alertasIndicacao } from '@/lib/dadosIndicacao.js';
import { fmtDuracao } from '@/lib/suporte.js';
import { Topo, Aviso, Kpi, Semaforo } from '@/components/Ui.js';

export const dynamic = 'force-dynamic';

export default async function PainelColaborador() {
  const u = await exigirUsuario();
  if (!ehColaboradorIndicacao(u) && !veTodaIndicacao(u)) return <Aviso tipo="erro">Área do time de Indicação.</Aviso>;
  const dia = hoje();
  const dow = (new Date(`${dia}T12:00:00Z`).getUTCDay() + 6) % 7;
  const semana = somarDias(dia, -dow); const mes = `${dia.slice(0, 8)}01`;
  const [dHoje, dSem, dMes, pip, alertas, metas, enviadoHoje, benef] = await Promise.all([
    consolidarDiarios(dia, dia, u.id), consolidarDiarios(semana, dia, u.id), consolidarDiarios(mes, dia, u.id),
    numerosIndicacao(mes, dia, u.id), alertasIndicacao(u.id),
    q1('SELECT * FROM referral_goals WHERE user_id=$1', [u.id]), q1('SELECT id FROM referral_daily_forms WHERE user_id=$1 AND data_ref=$2', [u.id, dia]),
    q1(`SELECT COUNT(*)::int n, COUNT(*) FILTER (WHERE escolha IS NULL)::int sem_escolha FROM referral_benefits b WHERE status IN ('pendente','aprovado')
          AND EXISTS (SELECT 1 FROM referrals r WHERE r.referrer_id=b.referrer_id AND r.campaign_id=b.campaign_id AND r.responsavel_id=$1)`, [u.id]),
  ]);
  const m = metas || {};
  const cor = (v, meta) => (meta ? semaforo(v, meta) : v ? '' : 'neutro');
  const f = dMes.total.funil;
  return (
    <>
      <Topo titulo="Meu painel — Indicação" descricao={`Dados dos seus formulários diários e do seu pipeline · ${fmtData(dia)}`}>
        <a className="btn sec" href="/indicacoes">Meu pipeline</a>
        <a className="btn" href="/indicacoes/diario">{enviadoHoje ? 'Ajustar formulário de hoje' : 'Preencher formulário de hoje'}</a>
      </Topo>
      {!enviadoHoje && <Aviso>Você ainda não enviou o formulário de hoje.</Aviso>}
      <section className="grade g4">
        <Kpi rotulo="Trabalhados hoje" valor={numero(dHoje.total.trabalhados)} cor={cor(dHoje.total.trabalhados, m.meta_trabalhados_dia)} progresso={dividir(dHoje.total.trabalhados, m.meta_trabalhados_dia)} meta={m.meta_trabalhados_dia ? `meta ${m.meta_trabalhados_dia}` : 'meta não definida'} />
        <Kpi rotulo="Validadas hoje" valor={numero(dHoje.total.validadas)} cor={cor(dHoje.total.validadas, m.meta_validadas_dia)} progresso={dividir(dHoje.total.validadas, m.meta_validadas_dia)} meta={m.meta_validadas_dia ? `meta ${m.meta_validadas_dia}` : 'meta não definida'} />
        <Kpi rotulo="Validadas na semana" valor={numero(dSem.total.validadas)} cor={cor(dSem.total.validadas, m.meta_validadas_semana)} progresso={dividir(dSem.total.validadas, m.meta_validadas_semana)} meta={m.meta_validadas_semana ? `meta ${m.meta_validadas_semana}` : 'meta não definida'} />
        <Kpi rotulo="Vendas no mês" valor={numero(dMes.total.vendas_qtd)} cor={cor(dMes.total.vendas_qtd, m.meta_vendas_mes)} progresso={dividir(dMes.total.vendas_qtd, m.meta_vendas_mes)} meta={`${moeda(dMes.total.vendas_valor, 0)}${m.meta_receita_mes ? ` de ${moeda(m.meta_receita_mes, 0)}` : ''}`} />
      </section>
      <section className="secao"><h2>No mês (seus formulários)</h2>
        <div className="grade g4">
          <Kpi rotulo="Recebidas" valor={numero(dMes.total.recebidas)} />
          <Kpi rotulo="Responderam" valor={numero(dMes.total.responderam)} meta={`taxa de contato ${pct(f.contato)}`} />
          <Kpi rotulo="Encaminhadas" valor={numero(dMes.total.encaminhadas)} meta={`qualificação ${pct(f.qualificacao)}`} />
          <Kpi rotulo="Conversão em venda" valor={pct(f.conversaoVenda)} meta={`geral ${pct(f.conversaoGeral)} · ticket ${moeda(f.ticketMedio, 0)}`} />
        </div>
      </section>
      <section className="secao grade g2">
        <div className="painel">
          <div className="painel-cab"><h2>Follow-ups atrasados</h2>{alertas.followupsVencidos.length > 0 && <Semaforo cor="vermelho" texto={String(alertas.followupsVencidos.length)} />}</div>
          {alertas.followupsVencidos.length === 0 ? <p className="suave">Nenhum atrasado.</p> : <table><tbody>{alertas.followupsVencidos.map((r) => <tr key={r.id}><td><a href={`/indicacoes/${r.id}`}><b>{r.nome}</b></a><br /><span className="suave pequeno">{ETAPAS[r.etapa]}</span></td><td className="num" style={{ color: 'var(--vermelho)' }}>{fmtData(r.proximo_contato)}</td></tr>)}</tbody></table>}
        </div>
        <div className="painel">
          <div className="painel-cab"><h2>Próximos follow-ups (3 dias)</h2></div>
          {alertas.proximosFollowups.length === 0 ? <p className="suave">Nada agendado.</p> : <table><tbody>{alertas.proximosFollowups.map((r) => <tr key={r.id}><td><a href={`/indicacoes/${r.id}`}><b>{r.nome}</b></a><br /><span className="suave pequeno">{ETAPAS[r.etapa]}</span></td><td className="num">{fmtData(r.proximo_contato)}</td></tr>)}</tbody></table>}
        </div>
      </section>
      <section className="secao painel">
        <div className="painel-cab"><h2>Atenção no seu pipeline</h2></div>
        <div className="leitura">
          <div><span>Sem primeira tentativa no prazo</span><b style={{ color: pip.semContato ? 'var(--vermelho)' : undefined }}>{numero(pip.semContato)}</b></div>
          <div><span>Paradas no mesmo estágio</span><b>{numero(pip.paradas)}</b></div>
          <div><span>Qualificadas sem vendedor</span><b>{numero(pip.semVendedor)}</b></div>
          <div><span>Tempo até 1º contato (mês)</span><b>{fmtDuracao(pip.tempoPrimeiroContato)}</b></div>
          <div><span>Benefícios pendentes</span><b>{numero(benef.n)}</b></div>
          <div><span>Benefícios sem escolha do aluno</span><b>{numero(benef.sem_escolha)}</b></div>
        </div>
      </section>
    </>
  );
}
