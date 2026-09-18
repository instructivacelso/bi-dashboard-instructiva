import { exigirUsuario } from '@/lib/auth.js';
import { hoje } from '@/lib/datas.js';
import { numero } from '@/lib/formato.js';
import { semaforo } from '@/lib/calc.js';
import { veRh, configuraRh } from '@/lib/rh.js';
import { climaDoPeriodo } from '@/lib/dadosRh.js';
import { q } from '@/lib/db.js';
import { Topo, Aviso, Semaforo } from '@/components/Ui.js';
import FormEstado from '@/components/FormEstado.js';
import { salvarClima } from '../actions.js';

export const dynamic = 'force-dynamic';
const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const rotC = (comp) => { const [a, m] = String(comp).slice(0, 7).split('-'); return `${MESES[Number(m) - 1]}/${a}`; };
const pts = (v) => (v === null || v === undefined ? '—' : `${Math.round(v * 100)}`);

export default async function Clima() {
  const u = await exigirUsuario();
  if (!veRh(u)) return <><Topo titulo="Clima e eNPS" /><Aviso tipo="erro">Área do gerente de RH e da diretoria.</Aviso></>;
  const [c, setores] = await Promise.all([climaDoPeriodo(), q('SELECT id, nome FROM departments WHERE modulo_ativo ORDER BY nome')]);
  const mes = hoje().slice(0, 7);

  return (
    <>
      <Topo titulo="Clima e eNPS" descricao={`Resultado anônimo por competência. Só aparece com ${c.minimo}+ respostas.`}><a className="btn sec" href="/rh">Painel</a></Topo>

      {configuraRh(u) && (
        <section className="secao painel"><h2>Registrar resultado do mês</h2>
          <FormEstado action={salvarClima} botao="Salvar clima">
            <div className="linha-campos">
              <div className="campo"><label>Competência</label><input name="competencia" type="month" defaultValue={mes} required /></div>
              <div className="campo"><label>Escopo</label><select name="department_id" defaultValue=""><option value="">Empresa toda</option>{setores.map((s) => <option key={s.id} value={s.id}>{s.nome}</option>)}</select></div>
              <div className="campo"><label>Satisfação média (0–10)</label><input name="satisfacao_media" inputMode="decimal" pattern="[0-9.,]*" placeholder="opcional" /></div>
            </div>
            <div className="linha-campos">
              <div className="campo"><label>Respostas</label><input name="respostas" inputMode="numeric" pattern="[0-9]*" placeholder="0" /></div>
              <div className="campo"><label>Promotores</label><input name="promotores" inputMode="numeric" pattern="[0-9]*" placeholder="0" /></div>
              <div className="campo"><label>Neutros</label><input name="neutros" inputMode="numeric" pattern="[0-9]*" placeholder="0" /></div>
              <div className="campo"><label>Detratores</label><input name="detratores" inputMode="numeric" pattern="[0-9]*" placeholder="0" /></div>
            </div>
            <div className="campo"><label>Observação</label><input name="observacao" /></div>
          </FormEstado>
          <p className="suave pequeno">Para preservar o anonimato, o resultado de um grupo só aparece com pelo menos {c.minimo} respostas.</p>
        </section>
      )}

      <section className="secao painel"><div className="painel-cab"><h2>Histórico</h2></div>
        {c.linhas.length === 0 ? <Aviso>Nenhum resultado registrado ainda.</Aviso> : (
          <div className="tabela-wrap"><table>
            <thead><tr><th>Competência</th><th>Escopo</th><th className="num">Respostas</th><th className="num">eNPS</th><th className="num">Satisfação</th></tr></thead>
            <tbody>{c.linhas.map((l) => (
              <tr key={l.id}>
                <td>{rotC(l.competencia)}</td><td>{l.setor || 'Empresa toda'}</td><td className="num">{l.respostas}</td>
                <td className="num">{l.exibivel ? <Semaforo cor={l.enps !== null ? semaforo(l.enps, c.metaEnps, 'maior') : 'neutro'} texto={pts(l.enps)} /> : <span className="suave">poucas respostas</span>}</td>
                <td className="num">{l.exibivel && l.satisfacao_media != null ? numero(l.satisfacao_media, 1) : '—'}</td>
              </tr>
            ))}</tbody>
          </table></div>
        )}
      </section>
    </>
  );
}
