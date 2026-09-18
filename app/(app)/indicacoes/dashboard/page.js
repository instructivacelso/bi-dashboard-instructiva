import { exigirUsuario } from '@/lib/auth.js';
import { hoje, somarDias } from '@/lib/datas.js';
import { numero, pct, moeda } from '@/lib/formato.js';
import { dividir } from '@/lib/calc.js';
import { ETAPAS_QUEBRA, ORIGENS, veTodaIndicacao } from '@/lib/indicacao.js';
import { numerosIndicacao, topIndicadores, consolidarDiarios } from '@/lib/dadosIndicacao.js';
import { Topo, Aviso, Kpi, Semaforo } from '@/components/Ui.js';
import { Validacao, Atendimento, Beneficios, Funil, Vendas } from '@/components/NumerosIndicacao.js';

export const dynamic = 'force-dynamic';
const PERIODOS = { 1: 'Hoje', 7: 'Últimos 7 dias', 30: 'Últimos 30 dias', 90: 'Últimos 90 dias' };

export default async function DashboardIndicacao(props) {
  const sp = await props.searchParams;
  const u = await exigirUsuario();
  if (!veTodaIndicacao(u)) return <><Topo titulo="Dashboard de Indicação" /><Aviso tipo="erro">Restrito ao gerente de Indicação e à Diretoria.</Aviso></>;
  const dia = hoje();
  const per = PERIODOS[sp.periodo] ? sp.periodo : '30';
  const desde = somarDias(dia, -(Number(per) - 1));
  const [n, top, diarios] = await Promise.all([numerosIndicacao(desde, dia), topIndicadores(desde, dia), consolidarDiarios(desde, dia)]);
  const etapas = [['Convidados', n.convidados], ['Aceitaram', n.aceitaram], ['Indicações', n.recebidas], ['Trabalhadas', n.trabalhados], ['Contato realizado', n.responderam], ['Validadas', n.validadas], ['Encaminhadas', n.encaminhadas], ['Em negociação', n.negociacao], ['Vendas', n.vendas]];
  const max = Math.max(...etapas.map((e) => e[1] || 0), 1);
  return (
    <>
      <Topo titulo="Dashboard de Indicação" descricao={PERIODOS[per]}><a className="btn sec" href="/indicacoes">Pipeline</a><a className="btn sec" href="/indicacoes/metas">Metas</a><a className="btn sec" href="/indicacoes/beneficios">Benefícios</a></Topo>
      <form className="filtros" method="get"><div className="campo"><label htmlFor="f-p">Período</label><select id="f-p" name="periodo" defaultValue={per}>{Object.entries(PERIODOS).map(([k, r]) => <option key={k} value={k}>{r}</option>)}</select></div><button className="btn peq">Aplicar</button></form>
      <section className="grade g4">
        <Kpi rotulo="Faturamento do canal" valor={moeda(n.faturamento, 0)} meta={`${numero(n.vendas)} vendas · ticket ${moeda(n.ticketMedio, 0)}`} />
        <Kpi rotulo="Custo dos benefícios" valor={moeda(n.custo, 0)} meta={`custo por venda ${moeda(n.funil.custoPorVenda, 0)}`} />
        <Kpi rotulo="Receita líquida estimada" valor={moeda(n.funil.receitaLiquida, 0)} meta={`retorno ${n.funil.retorno ? `${numero(n.funil.retorno, 1)}x` : 'sem dados'}`} />
        <Kpi rotulo="Conversão geral" valor={pct(n.funil.conversaoGeral)} meta={`vendas ÷ indicações recebidas · em venda ${pct(n.funil.conversaoVenda)}`} />
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
      <section className="secao grade g2">
        <div className="painel"><div className="painel-cab"><h2>Conversões</h2></div><Funil n={n} /></div>
        <div className="painel"><div className="painel-cab"><h2>Vendas e receita</h2></div><Vendas n={n} /></div>
      </section>
      <section className="secao painel">
        <div className="painel-cab"><h2>Formulários diários do time</h2><span className="suave pequeno">{numero(diarios.linhas.length)} envios no período</span></div>
        {diarios.pessoas.length === 0 ? <p className="suave">Nenhum formulário diário no período.</p> : (
          <div className="tabela-wrap"><table>
            <thead><tr><th>Colaborador</th><th className="num">Dias</th><th className="num">Recebidas</th><th className="num">Trabalhados</th><th className="num">Responderam</th><th className="num">Validadas</th><th className="num">Follow-ups</th><th className="num">Encaminhadas</th><th className="num">Vendas</th><th className="num">Valor</th><th className="num">Conversão</th></tr></thead>
            <tbody>{[...diarios.pessoas, { id: 'total', nome: 'Total', dias: diarios.linhas.length, ...diarios.total }].map((p) => (
              <tr key={p.id} style={p.id === 'total' ? { fontWeight: 700 } : undefined}><td>{p.nome}</td><td className="num">{p.dias}</td><td className="num">{numero(p.recebidas)}</td><td className="num">{numero(p.trabalhados)}</td><td className="num">{numero(p.responderam)}</td><td className="num">{numero(p.validadas)}</td><td className="num">{numero(p.followups)}</td><td className="num">{numero(p.encaminhadas)}</td><td className="num">{numero(p.vendas_qtd)}</td><td className="num">{moeda(p.vendas_valor, 0)}</td><td className="num">{pct(p.funil.conversaoVenda)}</td></tr>
            ))}</tbody>
          </table></div>
        )}
      </section>
      <section className="secao painel"><div className="painel-cab"><h2>Origem das indicações</h2></div>
        {n.porOrigem.length === 0 ? <p className="suave">Sem dados.</p> : <table><tbody>{n.porOrigem.map((o) => <tr key={o.chave}><td>{ORIGENS[o.chave] || 'Não informada'}</td><td className="num">{numero(o.n)} indicações</td><td className="num">{numero(o.vendas)} vendas</td><td className="num">{pct(dividir(o.vendas, o.n))}</td></tr>)}</tbody></table>}
      </section>
      <section className="secao painel"><div className="painel-cab"><h2>Benefícios e custo</h2></div><Beneficios n={n} /></section>
      <section className="secao grade g2">
        <div className="painel"><div className="painel-cab"><h2>Colaboradores (pipeline)</h2></div>
          {n.porVendedor.length === 0 ? <p className="suave">Sem indicações no período.</p> : <table><tbody>{n.porVendedor.map((v) => <tr key={v.id}><td><b>{v.nome}</b><br /><span className="suave pequeno">{numero(v.recebidas)} recebidas · {numero(v.encaminhadas)} encaminhadas · conversão {pct(v.conversao)}</span></td><td className="num">{numero(v.vendas)}</td><td className="num"><b>{moeda(v.faturamento, 0)}</b></td></tr>)}</tbody></table>}
        </div>
        <div className="painel"><div className="painel-cab"><h2>Alunos que mais indicam</h2></div>
          {top.length === 0 ? <p className="suave">Sem indicações no período.</p> : <table><tbody>{top.map((s) => <tr key={s.id}><td><b>{s.nome}</b><br /><span className="suave pequeno">{numero(s.indicacoes)} indicações · {numero(s.validas)} válidas</span></td><td className="num">{numero(s.vendas)} vendas</td><td className="num"><b>{moeda(Number(s.receita), 0)}</b></td></tr>)}</tbody></table>}
        </div>
      </section>
    </>
  );
}
