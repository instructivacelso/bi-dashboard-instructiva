import { exigirUsuario } from '@/lib/auth.js';
import { hoje, somarDias } from '@/lib/datas.js';
import { numero, pct, moeda } from '@/lib/formato.js';
import { dividir } from '@/lib/calc.js';
import { veTodoCs, FAIXAS, COR_FAIXA } from '@/lib/cscx.js';
import { numerosCs, carteira } from '@/lib/dadosCs.js';
import { Topo, Aviso, Kpi, Semaforo } from '@/components/Ui.js';
import { Onboarding, Engajamento, Satisfacao, Voz, Retencao, Expansao } from '@/components/NumerosCs.js';

export const dynamic = 'force-dynamic';
const PERIODOS = { 7: 'Últimos 7 dias', 30: 'Últimos 30 dias', 90: 'Últimos 90 dias' };
export default async function DashboardCs(props) {
  const sp = await props.searchParams;
  const u = await exigirUsuario();
  if (!veTodoCs(u)) return <><Topo titulo="Dashboard de CS/CX" /><Aviso tipo="erro">Restrito ao gerente de CS/CX e à Diretoria.</Aviso></>;
  const dia = hoje(); const per = PERIODOS[sp.periodo] ? sp.periodo : '30';
  const [n, risco] = await Promise.all([numerosCs(somarDias(dia, -(Number(per) - 1)), dia), carteira(u, true, { matricula: 'ativa' })]);
  const emRisco = risco.filter((a) => ['risco', 'critico'].includes(a.faixa)).slice(0, 10);
  const jornada = [['Compras', n.onboarding.compras], ['Acesso liberado', n.onboarding.liberados], ['1º acesso', n.onboarding.acessaram], ['Iniciaram', n.onboarding.iniciaram], ['Com 50%+', n.engajamento.progredindo], ['Concluíram', n.engajamento.concluiram]];
  const max = Math.max(...jornada.map((j) => j[1] || 0), 1);
  return (
    <>
      <Topo titulo="Dashboard de CS/CX" descricao={PERIODOS[per]}><a className="btn sec" href="/cs">Carteira</a><a className="btn sec" href="/cs/health">Health score</a></Topo>
      <form className="filtros" method="get"><div className="campo"><label htmlFor="f-p">Período</label><select id="f-p" name="periodo" defaultValue={per}>{Object.entries(PERIODOS).map(([k, r]) => <option key={k} value={k}>{r}</option>)}</select></div><button className="btn peq">Aplicar</button></form>
      <section className="grade g4">
        <Kpi rotulo="Alunos ativos" valor={numero(n.ativos)} meta={`${numero(n.novos)} novos no período`} />
        <Kpi rotulo="Em risco (alto + crítico)" valor={numero(n.health.risco + n.health.critico)} cor={n.health.risco + n.health.critico ? 'vermelho' : 'verde'} meta={`${moeda(n.health.valorEmRisco, 0)} em contratos`} />
        <Kpi rotulo="NPS" valor={n.satisfacao.nps === null ? 'sem dados' : numero(n.satisfacao.nps)} cor={n.satisfacao.nps === null ? '' : n.satisfacao.nps >= 50 ? 'verde' : n.satisfacao.nps >= 0 ? 'amarelo' : 'vermelho'} meta={`${numero(n.satisfacao.respostas)} respostas`} />
        <Kpi rotulo="Receita preservada" valor={moeda(n.retencao.preservada, 0)} meta={`recuperação ${pct(n.retencao.taxaRecuperacao)} · perdida ${moeda(n.retencao.perdida, 0)}`} />
      </section>
      <section className="secao painel">
        <div className="painel-cab"><h2>Jornada do aluno</h2><p>Compras do período e situação atual da base.</p></div>
        <div className="funil">{jornada.map(([nome, valor], i) => (
          <div key={nome}>
            {i > 0 && <div className="funil-passagem"><span /><span className="taxa">{dividir(valor, jornada[i - 1][1]) === null ? 'sem base para calcular' : `${pct(dividir(valor, jornada[i - 1][1]))} passaram`}</span><span /></div>}
            <div className="funil-etapa"><div className="funil-nome">{nome}</div><div className="funil-barra"><span className="preench" style={{ width: `${valor ? Math.max((valor / max) * 100, 0.8) : 0}%` }} /><b>{numero(valor)}</b></div><div className="funil-meta" /></div>
          </div>
        ))}</div>
      </section>
      <section className="secao grade g2">
        <div className="painel"><div className="painel-cab"><h2>Saúde da base</h2></div>
          <div className="leitura">{Object.keys(FAIXAS).map((k) => <div key={k}><span>{FAIXAS[k]}</span><b>{numero(n.health[k])}</b></div>)}</div></div>
        <div className="painel"><div className="painel-cab"><h2>Alunos em risco (prioridade)</h2></div>
          {emRisco.length === 0 ? <p className="suave">Nenhum aluno em risco alto ou crítico.</p> : <table><tbody>{emRisco.map((a) => <tr key={a.id}><td><a href={`/cs/aluno/${a.id}`}><b>{a.nome}</b></a><br /><span className="suave pequeno">{a.produto} · {a.responsavel || 'sem responsável'}</span></td><td><Semaforo cor={COR_FAIXA[a.faixa]} texto={`${FAIXAS[a.faixa]} · ${a.health_score}`} /></td></tr>)}</tbody></table>}
        </div>
      </section>
      <section className="secao grade g2">
        <div className="painel"><div className="painel-cab"><h2>Onboarding</h2></div><Onboarding n={n} /></div>
        <div className="painel"><div className="painel-cab"><h2>Engajamento</h2></div><Engajamento n={n} /></div>
        <div className="painel"><div className="painel-cab"><h2>Satisfação</h2></div><Satisfacao n={n} /></div>
        <div className="painel"><div className="painel-cab"><h2>Voz do cliente</h2></div><Voz n={n} /></div>
        <div className="painel"><div className="painel-cab"><h2>Retenção</h2></div><Retencao n={n} /></div>
        <div className="painel"><div className="painel-cab"><h2>Expansão e indicação</h2></div><Expansao n={n} /></div>
      </section>
    </>
  );
}
