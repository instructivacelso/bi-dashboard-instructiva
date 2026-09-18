import { exigirUsuario } from '@/lib/auth.js';
import { hoje, somarDias, fmtData } from '@/lib/datas.js';
import { numero, pct } from '@/lib/formato.js';
import { dividir } from '@/lib/calc.js';
import { CATEGORIAS, CANAIS, PRIORIDADES, veTodoSuporte, fmtDuracao } from '@/lib/suporte.js';
import { numerosSuporte, desempenhoAtendentes, volumes } from '@/lib/dadosSuporte.js';
import { Topo, Aviso, Kpi, Semaforo } from '@/components/Ui.js';
import Serie from '@/components/Serie.js';
import { Encaminhamentos } from '@/components/NumerosSuporte.js';

export const dynamic = 'force-dynamic';
const PERIODOS = { 7: 'Últimos 7 dias', 30: 'Últimos 30 dias', 90: 'Últimos 90 dias' };

export default async function DashboardSuporte(props) {
  const sp = await props.searchParams;
  const u = await exigirUsuario();
  if (!veTodoSuporte(u)) return <><Topo titulo="Dashboard do Suporte" /><Aviso tipo="erro">Restrito ao gerente de Suporte e à Diretoria.</Aviso></>;
  const dia = hoje();
  const per = PERIODOS[sp.periodo] ? sp.periodo : '30';
  const desde = somarDias(dia, -(Number(per) - 1));
  const [n, perf, vol] = await Promise.all([numerosSuporte(null, dia), desempenhoAtendentes(dia), volumes(desde, dia)]);
  const tot = vol.total;
  const slaPeriodo = dividir(tot.no_prazo, tot.com_solucao);
  const serieMap = Object.fromEntries(vol.serie.map((r) => [String(r.dia).slice(0, 10), r.n]));
  const dias = []; for (let d = desde; d <= dia; d = somarDias(d, 1)) dias.push(d);
  const Lista = ({ titulo, itens, rot }) => (
    <div className="painel"><div className="painel-cab"><h2>{titulo}</h2></div>
      {itens.length === 0 ? <p className="suave">Sem dados no período.</p> : <table><tbody>{itens.map((x) => <tr key={x.chave}><td>{rot(x.chave)}</td><td className="num"><b>{numero(x.n)}</b></td></tr>)}</tbody></table>}
    </div>
  );
  return (
    <>
      <Topo titulo="Dashboard do Suporte" descricao={`Hoje (${fmtData(dia).slice(0, 5)}) e ${PERIODOS[per].toLowerCase()}`}>
        <a className="btn sec" href="/suporte">Fila</a><a className="btn sec" href="/suporte/sla">SLA</a>
      </Topo>
      <form className="filtros" method="get"><div className="campo"><label htmlFor="f-p">Período</label><select id="f-p" name="periodo" defaultValue={per}>{Object.entries(PERIODOS).map(([k, r]) => <option key={k} value={k}>{r}</option>)}</select></div><button className="btn peq">Aplicar</button></form>
      {(n.criticosAbertos > 0 || n.vencidos > 0) && <Aviso tipo="erro">{n.criticosAbertos} crítico(s) em aberto · {n.vencidos} fora do SLA.</Aviso>}
      <section className="secao"><h2>Hoje</h2>
        <div className="grade g4">
          <Kpi rotulo="Recebidos" valor={numero(n.novos)} meta={`${numero(n.reabertos)} reabertos`} />
          <Kpi rotulo="Resolvidos" valor={numero(n.resolvidos)} meta={`taxa ${pct(n.taxaResolucao)}`} />
          <Kpi rotulo="Em aberto" valor={numero(n.backlogFinal)} cor={n.vencidos ? 'vermelho' : 'verde'} meta={`${numero(n.vencidos)} vencidos · ${numero(n.aguardandoSetor)} com outro setor`} />
          <Kpi rotulo="SLA hoje" valor={pct(n.cumprimentoSla)} cor={n.cumprimentoSla === null ? '' : n.cumprimentoSla >= 0.9 ? 'verde' : n.cumprimentoSla >= 0.75 ? 'amarelo' : 'vermelho'} meta={`1ª resposta ${fmtDuracao(n.tempoPrimeiraResposta)} · solução ${fmtDuracao(n.tempoSolucao)}`} />
        </div>
      </section>
      <section className="secao"><h2>{PERIODOS[per]}</h2>
        <div className="grade g4">
          <Kpi rotulo="Atendimentos abertos" valor={numero(tot.n)} meta={`${numero(tot.finalizados)} finalizados`} />
          <Kpi rotulo="Cumprimento do SLA" valor={pct(slaPeriodo)} cor={slaPeriodo === null ? '' : slaPeriodo >= 0.9 ? 'verde' : slaPeriodo >= 0.75 ? 'amarelo' : 'vermelho'} />
          <Kpi rotulo="Satisfação média" valor={tot.satisfacao ? Number(tot.satisfacao).toFixed(1).replace('.', ',') : 'sem dados'} meta="de 1 a 5" />
          <Kpi rotulo="Reaberturas" valor={numero(tot.reaberturas)} meta={`taxa ${pct(dividir(tot.reaberturas, tot.finalizados))}`} />
        </div>
      </section>
      <section className="secao grade g3"><Serie titulo="Atendimentos por dia" pontos={dias.map((d) => ({ data: d, v: serieMap[d] ?? null }))} formato={numero} cor="#ff8a3d" barras /></section>
      <section className="secao grade g2">
        <Lista titulo="Por categoria" itens={vol.categoria} rot={(k) => CATEGORIAS[k] || k} />
        <Lista titulo="Por curso" itens={vol.curso} rot={(k) => k} />
        <Lista titulo="Por canal" itens={vol.canal} rot={(k) => CANAIS[k] || k} />
        <Lista titulo="Por prioridade" itens={vol.prioridade} rot={(k) => PRIORIDADES[k] || k} />
      </section>
      <section className="secao painel">
        <div className="painel-cab"><h2>Equipe hoje</h2><p>Ordenado por resolução, SLA, volume, criticidade e reabertura.</p></div>
        <div className="tabela-wrap"><table>
          <thead><tr><th>Atendente</th><th className="num">Trabalhados</th><th className="num">Resolvidos</th><th className="num">SLA</th><th className="num">Em aberto</th><th className="num">Vencidos</th><th>Fechamento</th></tr></thead>
          <tbody>{perf.map((l) => (
            <tr key={l.id}><td><b>{l.nome}</b></td><td className="num">{numero(l.trabalhados)}</td><td className="num">{numero(l.resolvidos)}</td><td className="num">{pct(l.sla)}</td><td className="num">{numero(l.backlogFinal)}</td><td className="num">{numero(l.vencidos)}</td>
              <td>{l.fechamento ? <Semaforo cor={l.fechamento.pontualidade === 'atrasado' ? 'amarelo' : 'verde'} texto={l.fechamento.pontualidade === 'atrasado' ? 'Com atraso' : 'Enviado'} /> : <Semaforo cor="vermelho" texto="Pendente" />}</td></tr>
          ))}</tbody>
        </table></div>
      </section>
      <section className="secao painel"><div className="painel-cab"><h2>Encaminhamentos hoje</h2></div><Encaminhamentos n={n} /></section>
    </>
  );
}
