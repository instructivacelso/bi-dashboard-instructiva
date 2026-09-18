import { exigirUsuario } from '@/lib/auth.js';
import { hoje } from '@/lib/datas.js';
import { moeda, pct } from '@/lib/formato.js';
import { veSalario, STATUS_FOLHA } from '@/lib/rh.js';
import { folhaDoMes } from '@/lib/dadosRh.js';
import { Topo, Aviso, Kpi, Semaforo } from '@/components/Ui.js';
import FormEstado from '@/components/FormEstado.js';
import { salvarFolha, enviarFolhaFinanceiro } from '../actions.js';

export const dynamic = 'force-dynamic';
const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const rot = (mes) => { const [a, m] = mes.split('-'); return `${MESES[Number(m) - 1]}/${a}`; };
const somaMes = (mes, n) => { const [a, m] = mes.split('-').map(Number); const d = new Date(Date.UTC(a, m - 1 + n, 1)); return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`; };

export default async function Folha(props) {
  const sp = await props.searchParams;
  const u = await exigirUsuario();
  if (!veSalario(u)) return <><Topo titulo="Folha e custo de pessoal" /><Aviso tipo="erro">A folha é restrita ao gerente de RH e à diretoria.</Aviso></>;
  const mesAtual = hoje().slice(0, 7);
  const mes = /^\d{4}-\d{2}$/.test(sp.mes || '') && sp.mes <= mesAtual ? sp.mes : mesAtual;
  const f = await folhaDoMes(mes);
  const inp = (k, id, v) => <input name={`${k}_${id}`} type="text" inputMode="decimal" pattern="[0-9.,]*" defaultValue={v ?? ''} style={{ width: 92 }} disabled={f.enviada} />;

  return (
    <>
      <Topo titulo="Folha e custo de pessoal" descricao={`${rot(mes)} · ${f.lancadas}/${f.total} colaborador(es) lançados`}>
        <a className="btn sec peq" href={`/rh/folha?mes=${somaMes(mes, -1)}`}>← {rot(somaMes(mes, -1))}</a>
        {mes < mesAtual && <a className="btn sec peq" href={`/rh/folha?mes=${somaMes(mes, 1)}`}>{rot(somaMes(mes, 1))} →</a>}
        <a className="btn sec" href="/rh">Painel</a>
      </Topo>

      <section className="grade g4">
        <Kpi rotulo="Custo total de pessoal" valor={moeda(f.custoTotal, 0)} meta={f.enviada ? 'enviada ao financeiro' : 'inclui encargos e provisões'} />
        <Kpi rotulo="Folha % da receita" valor={pct(f.folhaPercentReceita)} meta={`receita ${moeda(f.receita, 0)}`} />
        <Kpi rotulo="Colaboradores" valor={`${f.lancadas}/${f.total}`} meta="lançados no mês" />
        <Kpi rotulo="Custo médio" valor={moeda(f.total ? f.custoTotal / f.total : 0, 0)} />
      </section>

      {f.enviada && <section className="secao"><Aviso tipo="ok">Folha de {rot(mes)} fechada e enviada ao financeiro. Para reabrir, fale com o administrador.</Aviso></section>}

      <section className="secao painel"><div className="painel-cab"><h2>Folha por colaborador</h2></div>
        {f.total === 0 ? <Aviso>Nenhum colaborador ativo. Cadastre em <a href="/rh/colaboradores">Colaboradores</a>.</Aviso> : (
          <FormEstado action={salvarFolha} botao={f.enviada ? 'Folha enviada' : 'Salvar folha'}>
            <input type="hidden" name="competencia" value={mes} />
            <div className="tabela-wrap"><table>
              <thead><tr><th>Colaborador</th><th className="num">Base</th><th className="num">Variável</th><th className="num">Benefícios</th><th className="num">Encargos</th><th className="num">Descontos</th><th className="num">Provisões</th><th className="num">Custo</th></tr></thead>
              <tbody>{f.linhas.map((l) => (
                <tr key={l.employee_id}>
                  <td>{l.nome}<input type="hidden" name="employee" value={l.employee_id} /><div className="suave pequeno">{l.setor || '—'}</div></td>
                  <td className="num">{inp('base', l.employee_id, l.salario_base ?? l.salario)}</td>
                  <td className="num">{inp('variavel', l.employee_id, l.variavel)}</td>
                  <td className="num">{inp('beneficios', l.employee_id, l.beneficios)}</td>
                  <td className="num">{inp('encargos', l.employee_id, l.encargos)}</td>
                  <td className="num">{inp('descontos', l.employee_id, l.descontos)}</td>
                  <td className="num suave">{l.provisoes != null ? moeda(l.provisoes, 0) : '—'}</td>
                  <td className="num"><b>{l.custo_total != null ? moeda(l.custo_total, 0) : '—'}</b></td>
                </tr>
              ))}</tbody>
            </table></div>
            <p className="suave pequeno" style={{ marginTop: 8 }}>As provisões de férias e 13º e o custo total são calculados ao salvar. A base já vem do cadastro do colaborador.</p>
          </FormEstado>
        )}
        {!f.enviada && f.lancadas > 0 && (
          <form action={enviarFolhaFinanceiro} style={{ marginTop: 12 }}>
            <input type="hidden" name="competencia" value={mes} />
            <button className="btn" type="submit">Fechar e enviar ao financeiro</button>
            <span className="suave pequeno" style={{ marginLeft: 10 }}>O total vira um lançamento de pessoal no resultado do mês, sem redigitar.</span>
          </form>
        )}
      </section>

      {f.porSetor.length > 0 && (
        <section className="secao painel"><div className="painel-cab"><h2>Custo por setor</h2></div>
          <div className="tabela-wrap"><table>
            <thead><tr><th>Setor</th><th className="num">Pessoas</th><th className="num">Custo</th><th className="num">% da folha</th></tr></thead>
            <tbody>{f.porSetor.map((s) => <tr key={s.setor}><td>{s.setor}</td><td className="num">{s.n}</td><td className="num">{moeda(s.custo, 0)}</td><td className="num">{pct(f.custoTotal ? s.custo / f.custoTotal : null)}</td></tr>)}</tbody>
          </table></div>
        </section>
      )}
    </>
  );
}
