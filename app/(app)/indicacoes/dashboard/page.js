import { exigirUsuario } from '@/lib/auth.js';
import { hoje, somarDias } from '@/lib/datas.js';
import { numero, pct, moeda } from '@/lib/formato.js';
import { dividir } from '@/lib/calc.js';
import { ETAPAS_QUEBRA, veTodaIndicacao } from '@/lib/indicacao.js';
import { numerosIndicacao, topIndicadores } from '@/lib/dadosIndicacao.js';
import { Topo, Aviso, Kpi, Semaforo } from '@/components/Ui.js';
import { Validacao, Atendimento, Beneficios } from '@/components/NumerosIndicacao.js';

export const dynamic = 'force-dynamic';
const PERIODOS = { 1: 'Hoje', 7: 'Últimos 7 dias', 30: 'Últimos 30 dias', 90: 'Últimos 90 dias' };

export default async function DashboardIndicacao(props) {
  const sp = await props.searchParams;
  const u = await exigirUsuario();
  if (!veTodaIndicacao(u)) return <><Topo titulo="Dashboard de Indicação" /><Aviso tipo="erro">Restrito ao gerente de Indicação e à Diretoria.</Aviso></>;
  const dia = hoje();
  const per = PERIODOS[sp.periodo] ? sp.periodo : '30';
  const desde = somarDias(dia, -(Number(per) - 1));
  const [n, top] = await Promise.all([numerosIndicacao(desde, dia), topIndicadores(desde, dia)]);
  const etapas = [['Convidados', n.convidados], ['Aceitaram', n.aceitaram], ['Indicações', n.recebidas], ['Válidas', n.validas], ['Contatadas', n.contatadas], ['Responderam', n.responderam], ['Agendamentos', n.agendamentos], ['Propostas', n.propostas], ['Vendas', n.vendas]];
  const max = Math.max(...etapas.map((e) => e[1] || 0), 1);
  return (
    <>
      <Topo titulo="Dashboard de Indicação" descricao={PERIODOS[per]}><a className="btn sec" href="/indicacoes">Indicações</a><a className="btn sec" href="/indicacoes/beneficios">Benefícios</a></Topo>
      <form className="filtros" method="get"><div className="campo"><label htmlFor="f-p">Período</label><select id="f-p" name="periodo" defaultValue={per}>{Object.entries(PERIODOS).map(([k, r]) => <option key={k} value={k}>{r}</option>)}</select></div><button className="btn peq">Aplicar</button></form>
      <section className="grade g4">
        <Kpi rotulo="Faturamento do canal" valor={moeda(n.faturamento, 0)} meta={`${numero(n.vendas)} vendas · ticket ${moeda(n.ticketMedio, 0)}`} />
        <Kpi rotulo="Custo dos benefícios" valor={moeda(n.custo, 0)} meta={`custo por venda ${moeda(n.funil.custoPorVenda, 0)}`} />
        <Kpi rotulo="Receita líquida estimada" valor={moeda(n.funil.receitaLiquida, 0)} meta={`retorno ${n.funil.retorno ? `${numero(n.funil.retorno, 1)}x` : 'sem dados'}`} />
        <Kpi rotulo="Conversão geral" valor={pct(n.funil.vendaSobreValida)} meta="vendas ÷ indicações válidas" />
      </section>
      <section className="secao painel">
        <div className="painel-cab"><h2>Funil de indicação</h2>{n.maiorQuebra && <Semaforo cor="vermelho" texto={`Maior quebra: ${ETAPAS_QUEBRA[n.maiorQuebra]}`} />}</div>
        <div className="funil">{etapas.map(([nome, valor], i) => (
          <div key={nome}>
            {i > 0 && <div className="funil-passagem"><span /><span className="taxa">{i === 2 ? `${numero(dividir(valor, etapas[1][1]), 1)} indicações por aluno` : (dividir(valor, etapas[i - 1][1]) === null ? 'sem base para calcular' : `${pct(dividir(valor, etapas[i - 1][1]))} passaram`)}</span><span /></div>}
            <div className="funil-etapa"><div className="funil-nome">{nome}</div><div className="funil-barra"><span className="preench" style={{ width: `${valor ? Math.max((valor / max) * 100, 0.8) : 0}%` }} /><b>{numero(valor)}</b></div><div className="funil-meta" /></div>
          </div>
        ))}</div>
      </section>
      <section className="secao grade g2">
        <div className="painel"><div className="painel-cab"><h2>Qualidade das indicações</h2></div><Validacao n={n} /></div>
        <div className="painel"><div className="painel-cab"><h2>Atendimento</h2></div><Atendimento n={n} /></div>
      </section>
      <section className="secao painel"><div className="painel-cab"><h2>Benefícios e custo</h2></div><Beneficios n={n} /></section>
      <section className="secao grade g2">
        <div className="painel"><div className="painel-cab"><h2>Vendedores</h2></div>
          {n.porVendedor.length === 0 ? <p className="suave">Sem indicações distribuídas no período.</p> : <table><tbody>{n.porVendedor.map((v) => <tr key={v.id}><td><b>{v.nome}</b><br /><span className="suave pequeno">{numero(v.trabalhadas)} trabalhadas · conversão {pct(v.conversao)}</span></td><td className="num">{numero(v.vendas)}</td><td className="num"><b>{moeda(v.faturamento, 0)}</b></td></tr>)}</tbody></table>}
        </div>
        <div className="painel"><div className="painel-cab"><h2>Alunos que mais indicam</h2></div>
          {top.length === 0 ? <p className="suave">Sem indicações no período.</p> : <table><tbody>{top.map((s) => <tr key={s.id}><td><b>{s.nome}</b><br /><span className="suave pequeno">{numero(s.indicacoes)} indicações · {numero(s.validas)} válidas</span></td><td className="num">{numero(s.vendas)} vendas</td><td className="num"><b>{moeda(Number(s.receita), 0)}</b></td></tr>)}</tbody></table>}
        </div>
      </section>
    </>
  );
}
