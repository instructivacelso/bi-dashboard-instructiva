import { exigirUsuario } from '@/lib/auth.js';
import { hoje, fmtData } from '@/lib/datas.js';
import { moeda, numero, pct } from '@/lib/formato.js';
import { semaforo } from '@/lib/calc.js';
import { veRh, operaRh, configuraRh, veSalario } from '@/lib/rh.js';
import { numerosRh } from '@/lib/dadosRh.js';
import { Topo, Aviso, Kpi, Semaforo } from '@/components/Ui.js';

export const dynamic = 'force-dynamic';
const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const rot = (mes) => { const [a, m] = mes.split('-'); return `${MESES[Number(m) - 1]}/${a}`; };
const somaMes = (mes, n) => { const [a, m] = mes.split('-').map(Number); const d = new Date(Date.UTC(a, m - 1 + n, 1)); return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`; };
const fim = (mes) => { const [a, m] = mes.split('-').map(Number); const d = new Date(Date.UTC(a, m, 0)); return `${a}-${String(m).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`; };

export default async function PainelRh(props) {
  const sp = await props.searchParams;
  const u = await exigirUsuario();
  if (!veRh(u)) {
    return (<><Topo titulo="RH" descricao="Área do gerente de RH e da diretoria." />
      {operaRh(u) ? <Aviso>O painel é do gerente. Você faz o <a href="/rh/fechamento">fechamento do dia</a> e cuida dos <a href="/rh/colaboradores">colaboradores</a>.</Aviso> : <Aviso tipo="erro">Sem acesso ao RH.</Aviso>}</>);
  }
  const mesAtual = hoje().slice(0, 7);
  const mes = /^\d{4}-\d{2}$/.test(sp.mes || '') && sp.mes <= mesAtual ? sp.mes : mesAtual;
  const n = await numerosRh(`${mes}-01`, fim(mes));

  return (
    <>
      <Topo titulo="RH — painel" descricao={`${rot(mes)} · ${n.headcountAtual} pessoa(s) na empresa hoje · ${n.diasComEnvio} dia(s) com fechamento`}>
        <a className="btn sec peq" href={`/rh?mes=${somaMes(mes, -1)}`}>← {rot(somaMes(mes, -1))}</a>
        {mes < mesAtual && <a className="btn sec peq" href={`/rh?mes=${somaMes(mes, 1)}`}>{rot(somaMes(mes, 1))} →</a>}
        <a className="btn sec" href="/rh/colaboradores">Colaboradores</a>
        {veSalario(u) && <a className="btn sec" href="/rh/folha">Folha</a>}
        <a className="btn sec" href="/rh/clima">Clima e eNPS</a>
        <a className="btn sec" href="/rh/desempenho">Desempenho</a>
        <a className="btn sec" href="/rh/treinamentos">Treinamentos</a>
        <a className="btn sec" href="/rh/sucessao">Sucessão</a>
        {configuraRh(u) && <a className="btn sec" href="/rh/cadastros">Cadastros</a>}
      </Topo>

      <section className="grade g4">
        <Kpi rotulo="Headcount" valor={numero(n.headcountAtual)} meta={`início ${n.headcountIni} · fim ${n.headcountFim} · médio ${numero(n.headcountMedio, 1)}`} />
        <Kpi rotulo="Turnover do mês" valor={pct(n.turnover)} cor={n.turnover !== null ? semaforo(n.turnover, n.metaTurnover, 'menor') : ''} meta={`${n.admissoes} adm · ${n.desligamentos} deslig`} />
        <Kpi rotulo="Absenteísmo" valor={pct(n.absenteismo)} cor={n.absenteismo !== null ? semaforo(n.absenteismo, n.metaAbsenteismo, 'menor') : ''} meta={`${n.ponto.faltas} falta(s) no período`} />
        {veSalario(u)
          ? <Kpi rotulo="Custo de pessoal" valor={moeda(n.custoTotal, 0)} meta={`médio ${moeda(n.custoMedio, 0)} · ${n.comSalario} c/ salário`} />
          : <Kpi rotulo="Horas extras" valor={numero(n.horasExtras, 1)} meta="no período" />}
      </section>

      <section className="secao grade g2">
        <div className="painel"><div className="painel-cab"><h2>Pessoas por setor</h2></div>
          <div className="tabela-wrap"><table>
            <thead><tr><th>Setor</th><th className="num">Pessoas</th>{veSalario(u) && <th className="num">Custo</th>}</tr></thead>
            <tbody>{n.porSetor.map((s) => <tr key={s.chave}><td>{s.chave}</td><td className="num">{s.n}</td>{veSalario(u) && <td className="num">{moeda(s.custo, 0)}</td>}</tr>)}</tbody>
          </table></div>
        </div>
        <div className="painel"><div className="painel-cab"><h2>Quadro</h2></div>
          <div className="leitura">
            <div><span>Por unidade</span><b>{n.porUnidade.map((x) => `${x.chave}: ${x.n}`).join(' · ') || '—'}</b></div>
            <div><span>Em experiência</span><b>{numero(n.emExperiencia)}</b></div>
            <div><span>Vagas abertas</span><b>{numero(n.vagasAbertas)}</b></div>
            <div><span>Deslig. voluntário</span><b>{pct(n.turnoverVol)}</b></div>
            <div><span>Experiências vencendo (7d)</span><b>{numero(n.experienciasVencendo)}</b></div>
            <div><span>Contratos vencendo (30d)</span><b>{numero(n.contratosVencendo)}</b></div>
          </div>
        </div>
      </section>

      <section className="secao grade g2">
        <div className="painel"><div className="painel-cab"><h2>Recrutamento (mês)</h2></div>
          <div className="leitura">
            <div><span>Candidatos</span><b>{numero(n.recrutamento.candidatos)}</b></div>
            <div><span>Entrevistas</span><b>{numero(n.recrutamento.entrevistas)}</b></div>
            <div><span>Contratações</span><b>{numero(n.recrutamento.contratacoes)}</b></div>
            <div><span>Conversão do funil</span><b>{pct(n.recrutamento.funil.geral)}</b></div>
          </div>
        </div>
        <div className="painel"><div className="painel-cab"><h2>Ponto e treinamento (mês)</h2></div>
          <div className="leitura">
            <div><span>Presenças</span><b>{numero(n.ponto.presentes)}</b></div>
            <div><span>Atrasos</span><b>{numero(n.ponto.atrasos)}</b></div>
            <div><span>Horas extras</span><b>{numero(n.horasExtras, 1)}</b></div>
            <div><span>Treinamentos</span><b>{numero(n.treino.treinamentos)}</b></div>
            <div><span>Participantes</span><b>{numero(n.treino.participantes)}</b></div>
            <div><span>Presença no treino</span><b>{pct(n.treino.presenca)}</b></div>
          </div>
        </div>
      </section>
    </>
  );
}
