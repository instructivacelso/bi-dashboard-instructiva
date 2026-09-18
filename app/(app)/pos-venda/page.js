import { exigirUsuario } from '@/lib/auth.js';
import { hoje, fmtData } from '@/lib/datas.js';
import { moeda, numero, pct } from '@/lib/formato.js';
import { semaforo } from '@/lib/calc.js';
import { vePosvenda, operaPosvenda, configuraPosvenda } from '@/lib/posvenda.js';
import { numerosPosvenda } from '@/lib/dadosPosvenda.js';
import { Topo, Aviso, Kpi } from '@/components/Ui.js';

export const dynamic = 'force-dynamic';
const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const rot = (mes) => { const [a, m] = mes.split('-'); return `${MESES[Number(m) - 1]}/${a}`; };
const somaMes = (mes, n) => { const [a, m] = mes.split('-').map(Number); const d = new Date(Date.UTC(a, m - 1 + n, 1)); return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`; };
const fim = (mes) => { const [a, m] = mes.split('-').map(Number); const d = new Date(Date.UTC(a, m, 0)); return `${a}-${String(m).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`; };
const npsPts = (v) => (v === null || v === undefined ? '—' : `${Math.round(v * 100)}`);

export default async function PainelPosvenda(props) {
  const sp = await props.searchParams;
  const u = await exigirUsuario();
  if (!vePosvenda(u)) {
    return (<><Topo titulo="Pós-venda" descricao="Área do gerente de pós-venda e da diretoria." />
      {operaPosvenda(u) ? <Aviso>Você faz o <a href="/pos-venda/fechamento">fechamento do dia</a>.</Aviso> : <Aviso tipo="erro">Sem acesso ao pós-venda.</Aviso>}</>);
  }
  const mesAtual = hoje().slice(0, 7);
  const mes = /^\d{4}-\d{2}$/.test(sp.mes || '') && sp.mes <= mesAtual ? sp.mes : mesAtual;
  const n = await numerosPosvenda(`${mes}-01`, fim(mes));

  return (
    <>
      <Topo titulo="Pós-venda — painel" descricao={`${rot(mes)} · retenção e renovação · ${n.diasComEnvio} dia(s) com fechamento`}>
        <a className="btn sec peq" href={`/pos-venda?mes=${somaMes(mes, -1)}`}>← {rot(somaMes(mes, -1))}</a>
        {mes < mesAtual && <a className="btn sec peq" href={`/pos-venda?mes=${somaMes(mes, 1)}`}>{rot(somaMes(mes, 1))} →</a>}
        {configuraPosvenda(u) && <a className="btn sec" href="/pos-venda/cadastros">Cadastros</a>}
      </Topo>

      <section className="grade g4">
        <Kpi rotulo="Taxa de renovação" valor={pct(n.taxaRenovacao)} cor={n.taxaRenovacao !== null ? semaforo(n.taxaRenovacao, n.metaRenovacao, 'maior') : ''} meta={`${n.renov_feitas}/${n.renov_vencendo} · meta ${pct(n.metaRenovacao)}`} />
        <Kpi rotulo="Churn" valor={pct(n.churn)} cor={n.churn !== null ? semaforo(n.churn, 1 - n.metaRenovacao, 'menor') : ''} meta={`${n.cancelamentos} cancelamento(s)`} />
        <Kpi rotulo="NPS" valor={npsPts(n.nps)} cor={n.nps !== null ? semaforo(n.nps, n.metaNps, 'maior') : ''} meta={`${n.nps_respostas} resposta(s) · meta ${npsPts(n.metaNps)}`} />
        <Kpi rotulo="Receita retida" valor={moeda(n.receitaRetida, 0)} meta={`renovações ${moeda(n.renov_valor, 0)} + upsell ${moeda(n.upsell_valor, 0)}`} />
      </section>

      <section className="secao grade g2">
        <div className="painel"><div className="painel-cab"><h2>Onboarding e acompanhamento</h2></div>
          <div className="leitura">
            <div><span>Novos alunos</span><b>{numero(n.novos_alunos)}</b></div>
            <div><span>Onboarding concluído</span><b>{pct(n.onboardingConclusao)}</b></div>
            <div><span>Contatos de acompanhamento</span><b>{numero(n.contatos)}</b></div>
            <div><span>Alunos em risco</span><b>{numero(n.alunos_risco)}</b></div>
          </div>
        </div>
        <div className="painel"><div className="painel-cab"><h2>Renovação, upsell e inadimplência</h2></div>
          <div className="leitura">
            <div><span>Ticket de renovação</span><b>{moeda(n.ticketRenovacao, 0)}</b></div>
            <div><span>Upsell (ofertas/vendas)</span><b>{numero(n.upsell_ofertas)} / {numero(n.upsell_vendas)}</b></div>
            <div><span>Conversão de upsell</span><b>{pct(n.upsellConversao)}</b></div>
            <div><span>Inadimplência de renovação</span><b>{numero(n.inad_alunos)} · {moeda(n.inad_valor, 0)}</b></div>
          </div>
        </div>
      </section>

      <section className="secao grade g2">
        <div className="painel"><div className="painel-cab"><h2>Motivos de cancelamento</h2></div>
          {n.motivosCancelamento.length === 0 ? <Aviso>Sem cancelamentos com motivo no período.</Aviso> : (
            <div className="tabela-wrap"><table>
              <thead><tr><th>Motivo</th><th className="num">Qtd</th></tr></thead>
              <tbody>{n.motivosCancelamento.map((mo, i) => <tr key={i}><td>{mo.motivo}</td><td className="num">{mo.n}</td></tr>)}</tbody>
            </table></div>
          )}
        </div>
        <div className="painel"><div className="painel-cab"><h2>Riscos apontados</h2></div>
          {n.riscos.length === 0 ? <Aviso>Nenhum risco registrado no período.</Aviso> : (
            <div className="leitura">{n.riscos.map((r, i) => (
              <div key={i}><span>{fmtData(r.data_ref)}{r.prazo ? ` · prazo ${fmtData(r.prazo)}` : ''}</span><b style={{ fontWeight: 500 }}>{r.risco}{r.plano ? ` — ${r.plano}` : ''}</b></div>
            ))}</div>
          )}
        </div>
      </section>
    </>
  );
}
