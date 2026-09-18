import { exigirUsuario } from '@/lib/auth.js';
import { hoje, fmtData } from '@/lib/datas.js';
import { numero } from '@/lib/formato.js';
import { veRh, TIPOS_AVALIACAO, CRITERIOS_AVALIACAO, POTENCIAL, STATUS_PDI } from '@/lib/rh.js';
import { desempenhoResumo } from '@/lib/dadosRh.js';
import { listaColaboradores } from '@/lib/dadosRh.js';
import { q } from '@/lib/db.js';
import { Topo, Aviso, Kpi, Semaforo } from '@/components/Ui.js';
import FormEstado from '@/components/FormEstado.js';
import ListaQtd from '@/components/ListaQtd.js';
import { salvarAvaliacao, atualizarPdi } from '../actions.js';

export const dynamic = 'force-dynamic';
const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const rot = (mes) => { const [a, m] = mes.split('-'); return `${MESES[Number(m) - 1]}/${a}`; };
const somaMes = (mes, n) => { const [a, m] = mes.split('-').map(Number); const d = new Date(Date.UTC(a, m - 1 + n, 1)); return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`; };
const fim = (mes) => { const [a, m] = mes.split('-').map(Number); const d = new Date(Date.UTC(a, m, 0)); return `${a}-${String(m).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`; };

export default async function Desempenho(props) {
  const sp = await props.searchParams;
  const u = await exigirUsuario();
  if (!veRh(u)) return <><Topo titulo="Desempenho e PDI" /><Aviso tipo="erro">Área do gerente de RH e da diretoria.</Aviso></>;
  const mesAtual = hoje().slice(0, 7);
  const mes = /^\d{4}-\d{2}$/.test(sp.mes || '') && sp.mes <= mesAtual ? sp.mes : mesAtual;
  const [d, colabs, pdiAbertos] = await Promise.all([
    desempenhoResumo(`${mes}-01`, fim(mes)),
    listaColaboradores({ status: 'ativo' }),
    q(`SELECT p.*, e.nome colaborador FROM hr_pdi p JOIN hr_employees e ON e.id=p.employee_id WHERE p.status IN ('aberto','em_andamento') ORDER BY p.prazo NULLS LAST LIMIT 30`),
  ]);

  return (
    <>
      <Topo titulo="Desempenho e PDI" descricao={`${rot(mes)} · ${d.total} avaliação(ões)`}>
        <a className="btn sec peq" href={`/rh/desempenho?mes=${somaMes(mes, -1)}`}>← {rot(somaMes(mes, -1))}</a>
        {mes < mesAtual && <a className="btn sec peq" href={`/rh/desempenho?mes=${somaMes(mes, 1)}`}>{rot(somaMes(mes, 1))} →</a>}
        <a className="btn sec" href="/rh">Painel</a>
      </Topo>

      <section className="grade g4">
        <Kpi rotulo="Média de desempenho" valor={d.mediaGeral != null ? numero(d.mediaGeral, 1) : '—'} meta="nota geral (0–10)" />
        <Kpi rotulo="Avaliações no mês" valor={numero(d.total)} />
        <Kpi rotulo="PDIs pendentes" valor={numero(d.pdi.pendentes)} cor={d.pdi.atrasados > 0 ? 'amarelo' : ''} meta={`${d.pdi.atrasados} atrasado(s)`} />
        <Kpi rotulo="PDIs concluídos" valor={numero(d.pdi.concluidos)} meta={d.pdi.total ? `${Math.round((d.pdi.emDia || 0) * 100)}% do total` : ''} />
      </section>

      <section className="secao painel"><h2>Registrar avaliação</h2>
        <FormEstado action={salvarAvaliacao} botao="Salvar avaliação">
          <div className="linha-campos">
            <div className="campo"><label>Colaborador</label><select name="employee_id" required defaultValue=""><option value="">Escolha…</option>{colabs.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}</select></div>
            <div className="campo"><label>Competência</label><input name="competencia" type="month" defaultValue={mes} required /></div>
            <div className="campo"><label>Tipo</label><select name="tipo" defaultValue="periodica">{Object.entries(TIPOS_AVALIACAO).map(([v, r]) => <option key={v} value={v}>{r}</option>)}</select></div>
            <div className="campo"><label>Nota geral (0–10)</label><input name="nota_geral" inputMode="decimal" pattern="[0-9.,]*" placeholder="0–10" /></div>
            <div className="campo"><label>Potencial</label><select name="potencial" defaultValue=""><option value="">—</option>{Object.entries(POTENCIAL).map(([v, r]) => <option key={v} value={v}>{r}</option>)}</select></div>
          </div>
          <p className="suave pequeno">Critérios (0 a 10, opcionais):</p>
          <div className="linha-campos">
            {Object.entries(CRITERIOS_AVALIACAO).map(([k, r]) => (
              <div className="campo" key={k}><label>{r}</label><input name={`crit_${k}`} inputMode="decimal" pattern="[0-9.,]*" style={{ width: 80 }} /></div>
            ))}
          </div>
          <div className="linha-campos">
            <div className="campo"><label>Pontos fortes</label><input name="pontos_fortes" /></div>
            <div className="campo"><label>Pontos a desenvolver</label><input name="pontos_desenvolver" /></div>
            <div className="campo"><label>Próxima revisão</label><input name="proxima_revisao" type="date" /></div>
          </div>
          <div className="campo"><label>Ações de PDI</label><input name="pdi_qtd" inputMode="numeric" pattern="[0-9]*" defaultValue="0" style={{ width: 80 }} /></div>
          <ListaQtd campoQtd="pdi_qtd" prefixo="pdi" titulo="Ação" campos={[{ nome: 'acao', rotulo: 'Ação de desenvolvimento', tipo: 'texto' }, { nome: 'resp', rotulo: 'Responsável', tipo: 'texto', opcional: true }, { nome: 'prazo', rotulo: 'Prazo', tipo: 'data', opcional: true }]} />
        </FormEstado>
      </section>

      <section className="secao grade g2">
        <div className="painel"><div className="painel-cab"><h2>Avaliações recentes</h2></div>
          {d.avaliacoes.length === 0 ? <Aviso>Sem avaliações no período.</Aviso> : (
            <div className="tabela-wrap"><table>
              <thead><tr><th>Colaborador</th><th>Tipo</th><th className="num">Nota</th><th className="num">Média crit.</th><th>Avaliador</th></tr></thead>
              <tbody>{d.avaliacoes.map((a) => <tr key={a.id}><td>{a.colaborador}</td><td>{TIPOS_AVALIACAO[a.tipo]}</td><td className="num">{a.nota_geral != null ? numero(a.nota_geral, 1) : '—'}</td><td className="num">{a.media_criterios != null ? numero(a.media_criterios, 1) : '—'}</td><td className="suave pequeno">{a.avaliador || '—'}</td></tr>)}</tbody>
            </table></div>
          )}
        </div>
        <div className="painel"><div className="painel-cab"><h2>PDIs em aberto</h2></div>
          {pdiAbertos.length === 0 ? <Aviso>Nenhum PDI em aberto.</Aviso> : (
            <div className="tabela-wrap"><table>
              <thead><tr><th>Colaborador</th><th>Ação</th><th>Prazo</th><th /></tr></thead>
              <tbody>{pdiAbertos.map((p) => { const atrasado = p.prazo && String(p.prazo).slice(0, 10) < hoje(); return (
                <tr key={p.id}><td>{p.colaborador}</td><td>{p.acao}</td><td>{p.prazo ? <span style={{ color: atrasado ? 'var(--vermelho)' : undefined }}>{fmtData(p.prazo)}</span> : '—'}</td>
                  <td><form action={atualizarPdi}><input type="hidden" name="id" value={p.id} /><input type="hidden" name="status" value="concluido" /><button className="btn sec peq" type="submit">Concluir</button></form></td></tr>
              ); })}</tbody>
            </table></div>
          )}
        </div>
      </section>
    </>
  );
}
