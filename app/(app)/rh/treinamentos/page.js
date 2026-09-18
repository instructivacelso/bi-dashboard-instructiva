import { exigirUsuario } from '@/lib/auth.js';
import { hoje, fmtData } from '@/lib/datas.js';
import { moeda, numero, pct } from '@/lib/formato.js';
import { veRh } from '@/lib/rh.js';
import { treinamentosPeriodo, listaColaboradores } from '@/lib/dadosRh.js';
import { Topo, Aviso, Kpi } from '@/components/Ui.js';
import FormEstado from '@/components/FormEstado.js';
import { salvarTreinamento } from '../actions.js';

export const dynamic = 'force-dynamic';
const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const rot = (mes) => { const [a, m] = mes.split('-'); return `${MESES[Number(m) - 1]}/${a}`; };
const somaMes = (mes, n) => { const [a, m] = mes.split('-').map(Number); const d = new Date(Date.UTC(a, m - 1 + n, 1)); return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`; };
const fim = (mes) => { const [a, m] = mes.split('-').map(Number); const d = new Date(Date.UTC(a, m, 0)); return `${a}-${String(m).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`; };

export default async function Treinamentos(props) {
  const sp = await props.searchParams;
  const u = await exigirUsuario();
  if (!veRh(u)) return <><Topo titulo="Treinamentos" /><Aviso tipo="erro">Área do gerente de RH e da diretoria.</Aviso></>;
  const mesAtual = hoje().slice(0, 7);
  const mes = /^\d{4}-\d{2}$/.test(sp.mes || '') && sp.mes <= mesAtual ? sp.mes : mesAtual;
  const [t, colabs] = await Promise.all([treinamentosPeriodo(`${mes}-01`, fim(mes)), listaColaboradores({ status: 'ativo' })]);

  return (
    <>
      <Topo titulo="Treinamentos" descricao={`${rot(mes)} · ${t.total} treinamento(s)`}>
        <a className="btn sec peq" href={`/rh/treinamentos?mes=${somaMes(mes, -1)}`}>← {rot(somaMes(mes, -1))}</a>
        {mes < mesAtual && <a className="btn sec peq" href={`/rh/treinamentos?mes=${somaMes(mes, 1)}`}>{rot(somaMes(mes, 1))} →</a>}
        <a className="btn sec" href="/rh">Painel</a>
      </Topo>

      <section className="grade g4">
        <Kpi rotulo="Treinamentos" valor={numero(t.total)} />
        <Kpi rotulo="Horas por pessoa" valor={t.horasPorPessoa != null ? numero(t.horasPorPessoa, 1) : '—'} />
        <Kpi rotulo="Conclusão (presença)" valor={pct(t.conclusao)} />
        <Kpi rotulo="Custo" valor={moeda(t.custo, 0)} />
      </section>

      <section className="secao painel"><h2>Novo treinamento</h2>
        <FormEstado action={salvarTreinamento} botao="Registrar treinamento">
          <div className="linha-campos">
            <div className="campo"><label>Nome</label><input name="nome" required /></div>
            <div className="campo"><label>Competência (mês)</label><input name="competencia" type="month" defaultValue={mes} required /></div>
            <div className="campo"><label>Data</label><input name="data_treino" type="date" /></div>
            <div className="campo"><label>Competência desenvolvida</label><input name="competencia_dev" placeholder="ex.: atendimento" /></div>
          </div>
          <div className="linha-campos">
            <div className="campo"><label>Instrutor</label><input name="instrutor" /></div>
            <div className="campo"><label>Formato</label><input name="formato" placeholder="presencial, online…" /></div>
            <div className="campo"><label>Carga horária</label><input name="carga_horaria" inputMode="decimal" pattern="[0-9.,]*" placeholder="0" /></div>
            <div className="campo"><label>Custo</label><input name="custo" inputMode="decimal" pattern="[0-9.,]*" placeholder="0,00" /></div>
          </div>
          <div className="campo"><label>Participantes</label>
            <div className="chips">{colabs.map((c) => (
              <label key={c.id} className="chip"><input type="checkbox" name="participante" value={c.id} /> {c.nome}</label>
            ))}</div>
          </div>
        </FormEstado>
      </section>

      <section className="secao painel"><div className="painel-cab"><h2>Treinamentos do mês</h2></div>
        {t.treinamentos.length === 0 ? <Aviso>Nenhum treinamento no mês.</Aviso> : (
          <div className="tabela-wrap"><table>
            <thead><tr><th>Nome</th><th>Data</th><th className="num">Carga</th><th className="num">Inscritos</th><th className="num">Presentes</th><th className="num">Conclusão</th><th className="num">Nota</th><th className="num">Custo</th></tr></thead>
            <tbody>{t.treinamentos.map((x) => <tr key={x.id}><td>{x.nome}</td><td>{x.data_treino ? fmtData(x.data_treino) : '—'}</td><td className="num">{numero(x.carga_horaria, 1)}h</td><td className="num">{x.inscritos}</td><td className="num">{x.presentes}</td><td className="num">{pct(x.conclusao)}</td><td className="num">{x.nota != null ? numero(x.nota, 1) : '—'}</td><td className="num">{moeda(x.custo, 0)}</td></tr>)}</tbody>
          </table></div>
        )}
      </section>
    </>
  );
}
